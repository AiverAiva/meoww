import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";

export const PIXIV_REGEX =
  /https?:\/\/(?:www\.)?pixiv\.net\/(?:[a-zA-Z0-9_-]+\/)?artworks\/(\d+)/;

const FETCH_TIMEOUT_MS = 10_000;

interface PixivInfo {
  title: string;
  author: string;
  authorId: string;
  imageUrls: string[];
  url: string;
  description: string;
  tags: string[];
  xRestrict: number;
}

interface PixivUrls {
  regular?: string;
  original?: string;
  small?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Discord cannot fetch i.pximg.net. phixiv still proxies those paths. */
export function pixivEmbedImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "i.pximg.net") {
      return null;
    }
    return `https://www.phixiv.net/i${url.pathname}`;
  } catch {
    return null;
  }
}

function pickEmbedUrl(urls: unknown): string | null {
  if (!isRecord(urls)) return null;
  const sized = urls as PixivUrls;
  return pixivEmbedImageUrl(sized.regular) ??
    pixivEmbedImageUrl(sized.original) ??
    pixivEmbedImageUrl(sized.small);
}

function readTags(body: Record<string, unknown>): string[] {
  if (!isRecord(body.tags) || !Array.isArray(body.tags.tags)) return [];
  const names: string[] = [];
  for (const item of body.tags.tags) {
    if (!isRecord(item) || typeof item.tag !== "string") continue;
    const name = item.tag.trim();
    if (name) names.push(name);
  }
  return names;
}

function catPages(artworkId: string, count: number): string[] {
  const pages = Math.max(1, count);
  return Array.from(
    { length: pages },
    (_, index) => `https://pixiv.cat/${artworkId}-${index + 1}.jpg`,
  );
}

/**
 * Read a Pixiv ajax illust body, plus the optional `/pages` body.
 * `pages` wins because it lists every image. pixiv.cat is only a fallback.
 */
export function readPixivArtwork(
  artworkId: string,
  detailBody: unknown,
  pagesBody: unknown,
): Omit<PixivInfo, "url"> | null {
  if (!isRecord(detailBody)) return null;

  const title = typeof detailBody.title === "string" && detailBody.title.trim()
    ? detailBody.title.trim()
    : typeof detailBody.illustTitle === "string" &&
        detailBody.illustTitle.trim()
    ? detailBody.illustTitle.trim()
    : "Untitled";
  const author = typeof detailBody.userName === "string" &&
      detailBody.userName.trim()
    ? detailBody.userName.trim()
    : "Unknown Artist";
  const authorId = typeof detailBody.userId === "string"
    ? detailBody.userId
    : typeof detailBody.userId === "number"
    ? String(detailBody.userId)
    : "";
  const description = typeof detailBody.description === "string"
    ? detailBody.description
    : "";
  const xRestrict = typeof detailBody.xRestrict === "number"
    ? detailBody.xRestrict
    : 0;
  const pageCount = typeof detailBody.pageCount === "number"
    ? detailBody.pageCount
    : 1;

  const fromPages = Array.isArray(pagesBody)
    ? pagesBody.map((page) => isRecord(page) ? pickEmbedUrl(page.urls) : null)
      .filter((url): url is string => !!url)
    : [];
  const imageUrls = fromPages.length > 0
    ? fromPages
    : pageCount > 1
    ? catPages(artworkId, pageCount)
    : [pickEmbedUrl(detailBody.urls) ?? `https://pixiv.cat/${artworkId}.jpg`];

  return {
    title,
    author,
    authorId,
    imageUrls,
    description,
    tags: readTags(detailBody),
    xRestrict,
  };
}

export function pixivPlainText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/gm, "")
    .trim()
    .substring(0, 200);
}

export function formatPixivTagLine(tags: string[]): string {
  const block = tags
    .map((tag) => {
      const clean = tag.replace(/\s+/g, "").replace(/`/g, "");
      if (!clean) return "";
      return `\`${clean.startsWith("#") ? clean : `#${clean}`}\``;
    })
    .filter(Boolean)
    .join(" ");
  if (!block) return "";
  return `🏷️ ${block}`.substring(0, 1000);
}

function linkLabel(text: string): string {
  return text.replace(/[\[\]]/g, "");
}

/**
 * Logged-out R-18 responses omit image URLs and `/pages` returns 404.
 * phixiv still publishes the master1200 path. Later pages share that path.
 */
export function phixivPageUrls(html: string, pageCount: number): string[] {
  const match = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  ) ??
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    );
  if (!match) return [];

  let image: URL;
  try {
    image = new URL(match[1]);
  } catch {
    return [];
  }
  if (
    image.protocol !== "https:" ||
    !(image.hostname === "phixiv.net" || image.hostname.endsWith(".phixiv.net"))
  ) {
    return [];
  }

  const count = Math.max(1, pageCount);
  if (!/_p0(?=[._])/.test(image.pathname)) {
    return count === 1 ? [`${image.origin}${image.pathname}`] : [];
  }
  return Array.from(
    { length: count },
    (_, index) =>
      `${image.origin}${image.pathname.replace(/_p0(?=[._])/, `_p${index}`)}`,
  );
}

export async function getPixivPreview(content: string, pageIndex = 0) {
  const match = content.match(PIXIV_REGEX);
  if (!match) return null;

  const artworkId = match[1];
  const url = `https://www.pixiv.net/artworks/${artworkId}`;
  const headers = {
    "Accept": "application/json",
    "Referer": "https://www.pixiv.net/",
    "User-Agent": "Mozilla/5.0",
  };
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    const [detailResult, pagesResult] = await Promise.allSettled([
      fetch(`https://www.pixiv.net/ajax/illust/${artworkId}?lang=zh_tw`, {
        headers,
        signal,
      }),
      fetch(
        `https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=zh_tw`,
        { headers, signal },
      ),
    ]);

    if (detailResult.status !== "fulfilled" || !detailResult.value.ok) {
      throw new Error("Pixiv artwork request failed");
    }
    const detail = await detailResult.value.json();
    if (detail.error || !detail.body) {
      throw new Error("Pixiv artwork response had no body");
    }

    let pagesBody: unknown = null;
    if (pagesResult.status === "fulfilled" && pagesResult.value.ok) {
      const pages = await pagesResult.value.json();
      if (!pages.error && Array.isArray(pages.body)) pagesBody = pages.body;
    }

    const artwork = readPixivArtwork(artworkId, detail.body, pagesBody);
    if (!artwork) throw new Error("Pixiv artwork was unreadable");

    if (
      artwork.imageUrls.some((imageUrl) => imageUrl.includes("://pixiv.cat/"))
    ) {
      try {
        const unfurl = await fetch(
          `https://www.phixiv.net/artworks/${artworkId}`,
          {
            headers: {
              "Accept": "text/html",
              "User-Agent": "Discordbot/2.0",
            },
            signal,
          },
        );
        if (unfurl.ok) {
          const discovered = phixivPageUrls(
            await unfurl.text(),
            artwork.imageUrls.length,
          );
          if (discovered.length === artwork.imageUrls.length) {
            artwork.imageUrls = discovered;
          }
        }
      } catch (error) {
        logger.debug("Pixiv image discovery failed: {error}", { error });
      }
    }

    const info: PixivInfo = { ...artwork, url };
    logger.debug(
      "Pixiv preview: artworkId={id}, pageCount={count}, pageIndex={index}",
      { id: artworkId, count: info.imageUrls.length, index: pageIndex },
    );

    const isNSFW = info.xRestrict > 0;
    const pageCount = info.imageUrls.length;
    const safePageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
    const currentImage = info.imageUrls[safePageIndex];
    const decodedDescription = pixivPlainText(info.description);
    const tagLine = formatPixivTagLine(info.tags);

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [
          {
            media: { url: currentImage },
            spoiler: false,
          },
        ],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${
          linkLabel(decodeHtmlEntities(info.title))
        }](${info.url})\nby **${decodeHtmlEntities(info.author)}**`,
      },
      ...(decodedDescription
        ? [{
          type: ComponentV2Type.TextDisplay,
          content: decodedDescription,
        }]
        : []),
      ...(tagLine
        ? [{
          type: ComponentV2Type.TextDisplay,
          content: tagLine,
        }]
        : []),
    ];

    if (pageCount > 1) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏪",
            custom_id: `pixiv_v_${artworkId}_0_${safePageIndex}_f`,
            disabled: safePageIndex === 0,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⬅️",
            custom_id: `pixiv_v_${artworkId}_${
              safePageIndex - 1
            }_${safePageIndex}_v`,
            disabled: safePageIndex === 0,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${safePageIndex + 1} / ${pageCount}`,
            custom_id: `pixiv_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "➡️",
            custom_id: `pixiv_v_${artworkId}_${
              safePageIndex + 1
            }_${safePageIndex}_n`,
            disabled: safePageIndex === pageCount - 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏩",
            custom_id: `pixiv_v_${artworkId}_${
              pageCount - 1
            }_${safePageIndex}_l`,
            disabled: safePageIndex === pageCount - 1,
          },
        ],
      });
    }

    return {
      color: 0x0096FA,
      components,
      isNSFW,
    };
  } catch (error) {
    logger.error("Failed to fetch Pixiv info: {error}", { error });
    return {
      color: 0x0096FA,
      components: [
        {
          type: ComponentV2Type.MediaGallery,
          items: [
            {
              media: {
                url: `https://pixiv.cat/${artworkId}.jpg`,
              },
              spoiler: false,
            },
          ],
        },
        {
          type: ComponentV2Type.TextDisplay,
          content:
            `### [Artwork ${artworkId}](${url})\n(Metadata fetch failed, showing preview from pixiv.cat)`,
        },
      ],
    };
  }
}
