import { ComponentV2Type } from "../components_v2.ts";
import { decodeHtmlEntities } from "../html_utils.ts";
import { logger } from "../logger.ts";

/**
 * Shopee short links, including country hosts such as tw.shp.ee.
 * Product pages on shopee.tw do not return product Open Graph to this client.
 * The short link does, when requested with a link-unfurl user agent.
 */
export const SHOPEE_REGEX =
  /https?:\/\/(?:[a-z]{2}\.)?shp\.ee\/[A-Za-z0-9_-]+/i;

const SHOPEE_COLOR = 0xEE4D2D;
const CRAWLER_UA = "TelegramBot (like TwitterBot)";
const GENERIC_TITLE = "花得更少買得更好";
const FETCH_TIMEOUT_MS = 10_000;

export interface ShopeeOg {
  title: string;
  description: string;
  imageUrl: string | null;
}

function metaContent(html: string, property: string): string {
  const match = html.match(
    new RegExp(
      `<meta[^>]*property=["']${property}["'][^>]*content=["']([\\s\\S]*?)["']`,
      "i",
    ),
  );
  return match?.[1] ?? "";
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

/** Drop characters that would break a Discord markdown link label. */
function linkLabel(text: string): string {
  return text.replace(/[\[\]]/g, "");
}

export function parseShopeeOg(html: string): ShopeeOg | null {
  const rawTitle = decodeHtmlEntities(metaContent(html, "og:title")).trim();
  if (!rawTitle || rawTitle.includes(GENERIC_TITLE)) return null;

  const title = rawTitle
    .replace(/\s*\|\s*蝦皮購物\s*$/u, "")
    .replace(/\s*\|\s*Shopee\s*$/iu, "")
    .trim();
  if (!title) return null;

  let description = decodeHtmlEntities(metaContent(html, "og:description"));
  description = description.replace(/\s+/g, " ").trim();
  const semi = description.indexOf(";");
  if (semi >= 0) description = description.slice(0, semi).trim();
  description = description
    .replace(/\s*\|\s*蝦皮購物\s*$/u, "")
    .replace(/\s*\|\s*Shopee\s*$/iu, "")
    .trim();
  description = clip(description, 200);
  if (!description || description === title) description = "";

  let imageUrl: string | null = null;
  const imageRaw = decodeHtmlEntities(metaContent(html, "og:image")).trim();
  try {
    const image = new URL(imageRaw);
    if (
      image.protocol === "https:" &&
      image.hostname.endsWith(".susercontent.com")
    ) {
      imageUrl = image.toString();
    }
  } catch {
    imageUrl = null;
  }

  return { title, description, imageUrl };
}

function isShopeeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "shopee.tw" ||
    host.endsWith(".shopee.tw") ||
    /(^|\.)shopee\.[a-z]{2,}$/.test(host) ||
    /(^|\.)shopee\.com\.[a-z]{2}$/.test(host) ||
    /(^|\.)shopee\.co\.[a-z]{2}$/.test(host);
}

/** Strip tracking params and rewrite `-i.{shop}.{item}` to `/product/{shop}/{item}`. */
export function cleanShopeeProductUrl(
  raw: string | null | undefined,
  base?: string,
): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!isShopeeHost(parsed.hostname)) return null;

  const product = parsed.pathname.match(/\/product\/(\d+)\/(\d+)/);
  if (product) {
    return `${parsed.origin}/product/${product[1]}/${product[2]}`;
  }
  const slug = parsed.pathname.match(/-i\.(\d+)\.(\d+)\/?$/);
  if (slug) {
    return `${parsed.origin}/product/${slug[1]}/${slug[2]}`;
  }
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return `${parsed.origin}${path}`;
}

export async function getShopeePreview(content: string) {
  const match = content.match(SHOPEE_REGEX);
  if (!match) return null;

  const shortUrl = match[0];
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    const [pageRes, redirectRes] = await Promise.all([
      fetch(shortUrl, {
        headers: {
          "User-Agent": CRAWLER_UA,
          "Accept": "text/html",
        },
        redirect: "follow",
        signal,
      }),
      fetch(shortUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "manual",
        signal,
      }).catch((error) => {
        logger.debug("Shopee canonical lookup failed: {error}", { error });
        return null;
      }),
    ]);

    if (!pageRes.ok) {
      logger.debug("Shopee unfurl returned status {status}", {
        status: pageRes.status,
      });
      return { error: "Failed to fetch Shopee preview", color: 0xFF0000 };
    }

    const og = parseShopeeOg(await pageRes.text());
    if (!og) {
      return { error: "Shopee preview was not available", color: 0xFF0000 };
    }

    const link = cleanShopeeProductUrl(
      redirectRes?.headers.get("location"),
      shortUrl,
    ) ?? shortUrl;

    return {
      color: SHOPEE_COLOR,
      isNSFW: false,
      components: [
        ...(og.imageUrl
          ? [{
            type: ComponentV2Type.MediaGallery,
            items: [{
              media: { url: og.imageUrl },
              spoiler: false,
            }],
          }]
          : []),
        {
          type: ComponentV2Type.TextDisplay,
          content: `### [${linkLabel(og.title)}](${link})`,
        },
        ...(og.description
          ? [{
            type: ComponentV2Type.TextDisplay,
            content: og.description,
          }]
          : []),
        {
          type: ComponentV2Type.TextDisplay,
          content: `[View on Shopee](${link})`,
        },
      ],
    };
  } catch (error) {
    logger.error("Failed to fetch Shopee preview: {error}", { error });
    return { error: "Failed to fetch Shopee preview", color: 0xFF0000 };
  }
}
