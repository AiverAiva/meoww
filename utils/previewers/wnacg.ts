import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";
import { createErrorCard, createPageJumpOptions } from "../ui_factory.ts";

export const WNACG_REGEX =
  /https?:\/\/(?:www\.)?wnacg\.com\/photos-(?:index|slide|item)-aid-(\d+)\.html/;

interface WNACGMetadata {
  aid: string;
  title: string;
  uploader: string;
  totalPageCount: number;
  tags: string[];
  coverUrl: string;
}

interface WNACGGallery {
  aid: string;
  title: string;
  pages: string[]; // List of high-res image URLs
}

const galleryCache = new Map<string, WNACGGallery>();

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36";

/**
 * Normalizes WNACG URLs.
 */
function normalizeWnacgUrl(url: string | undefined): string {
  if (!url) return "";
  let clean = decodeHtmlEntities(url).trim();
  if (clean.startsWith("//")) {
    clean = "https:" + clean;
  } else if (clean.startsWith("/")) {
    clean = "https://www.wnacg.com" + clean;
  }
  return clean.replace(/(https?:\/\/)\/+/g, "$1");
}

/**
 * Fetches WNACG content with headers.
 */
async function fetchWNACG(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Origin": "https://www.wnacg.com",
        "Referer": "https://www.wnacg.com/",
      },
    });
    if (res.status === 403) {
      throw new Error("Access Denied (403). Cloudflare protection.");
    }
    if (res.status === 404) {
      throw new Error("Gallery Not Found (404).");
    }
    if (!res.ok) {
      throw new Error(`Server status ${res.status}`);
    }
    return await res.text();
  } catch (error) {
    logger.error("WNACG Fetch Error: {url} - {error}", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Parses mReader.initData from the photos-item page.
 */
async function getGalleryData(aid: string): Promise<WNACGGallery> {
  const cached = galleryCache.get(aid);
  if (cached) return cached;

  const url = `https://www.wnacg.com/photos-item-aid-${aid}.html`;
  const text = await fetchWNACG(url);

  // Extract page URLs from JSON-like structure
  const pageUrlMatch = text.match(/"page_url":\s*\[(.*?)\]/);
  if (!pageUrlMatch) {
    throw new Error("Failed to extract image URLs from reader data.");
  }

  const urls = pageUrlMatch[1]
    .split(",")
    .map((u) => u.trim().replace(/^"(.*)"$/, "$1"))
    .filter((u) => u.length > 0)
    .map((u) => normalizeWnacgUrl(u));

  // Extract title from breadcrumbs or h2
  const titleMatch = text.match(/<h2[^>]*>(.*?)<\/h2>/);
  const title = decodeHtmlEntities(
    titleMatch ? titleMatch[1].trim() : "Untitled Gallery",
  );

  const gallery = { aid, title, pages: urls };
  galleryCache.set(aid, gallery);
  return gallery;
}

/**
 * Fetches metadata for preview.
 */
async function fetchWNACGMetadata(aid: string): Promise<WNACGMetadata> {
  const url = `https://www.wnacg.com/photos-index-aid-${aid}.html`;
  const text = await fetchWNACG(url);

  const title = decodeHtmlEntities(
    text.match(/<h2[^>]*>(.*?)<\/h2>/)?.[1]?.trim() || "Untitled",
  );
  const uploader =
    text.match(/<div class="asTBcell uwuinfo">[\s\S]*?<a[^>]+>([^<]+)<\/a>/)
      ?.[1]?.trim() || "Unknown";
  const tags = [
    ...text.matchAll(
      /<a[^>]+href="\/albums-index-tag-([^"]+)\.html"[^>]*>(.*?)<\/a>/g,
    ),
  ]
    .map((m) => m[2].trim())
    .filter((v, i, a) => a.indexOf(v) === i);

  const pageCountMatch = text.match(/頁數：(\d+)P/) ||
    text.match(/>(\d+)\s+張/);
  const totalPageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0;

  let coverUrl = text.match(
    /<div class="[^"]*uwthumb[^"]*">[\s\S]*?<img[^>]+src="([^"]+)"/,
  )?.[1];
  coverUrl = normalizeWnacgUrl(coverUrl);

  return { aid, title, uploader, totalPageCount, tags, coverUrl };
}

export async function getWNACGPreview(content: string) {
  const match = content.match(WNACG_REGEX);
  if (!match) return null;
  const aid = match[1];

  try {
    const meta = await fetchWNACGMetadata(aid);
    const components: any[] = [
      ...(meta.coverUrl
        ? [{
          type: ComponentV2Type.MediaGallery,
          items: [{ media: { url: meta.coverUrl }, spoiler: false }],
        }]
        : []),
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### [${meta.title}](https://www.wnacg.com/photos-index-aid-${meta.aid}.html)\n**${meta.totalPageCount}P** • ID: \`${meta.aid}\``,
        // Uploaded by **${meta.uploader}** •
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `🏷️ ${
          meta.tags.map((t) => `\`#${t.replace(/\s+/g, "")}\``).join(" ")
        }`.substring(0, 1000),
      },
      {
        type: ComponentV2Type.ActionRow,
        components: [{
          type: ComponentV2Type.Button,
          style: 1,
          label: "📂 View in Discord",
          custom_id: `wnacg_v_${aid}_1_0`,
        }],
      },
    ];
    return { color: 0x9B59B6, components, isNSFW: true };
  } catch (error) {
    return {
      color: 0x9B59B6,
      isNSFW: true,
      components: [createErrorCard(
        error instanceof Error
          ? error.message
          : "Failed to fetch WNACG metadata.",
      )],
    };
  }
}

export async function getWNACGFullViewer(aid: string, page: number) {
  try {
    const gallery = await getGalleryData(aid);
    const pageCount = gallery.pages.length;
    const clampedPage = Math.max(1, Math.min(page, pageCount));
    const imageUrl = gallery.pages[clampedPage - 1];

    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: imageUrl }, spoiler: false }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### [${gallery.title}](https://www.wnacg.com/photos-index-aid-${aid}.html)\nPage **${clampedPage}** / **${pageCount}**`,
      },
    ];

    if (pageCount > 1) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏪",
            custom_id: `wnacg_v_${aid}_1_${clampedPage}_f`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⬅️",
            custom_id: `wnacg_v_${aid}_${clampedPage - 1}_${clampedPage}_v`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${clampedPage} / ${pageCount}`,
            custom_id: `wnacg_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "➡️",
            custom_id: `wnacg_v_${aid}_${clampedPage + 1}_${clampedPage}_n`,
            disabled: clampedPage === pageCount,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏩",
            custom_id: `wnacg_v_${aid}_${pageCount}_${clampedPage}_l`,
            disabled: clampedPage === pageCount,
          },
        ],
      });

      // Add "Jump to page" dropdown
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.StringSelect,
            custom_id: `wnacg_v_${aid}_jump_${clampedPage}_j`,
            placeholder: "Jump to page...",
            options: createPageJumpOptions(clampedPage, pageCount),
          },
        ],
      });
    }

    return { color: 0x9B59B6, components, isNSFW: true };
  } catch (error) {
    return {
      color: 0x9B59B6,
      isNSFW: true,
      components: [
        createErrorCard(
          error instanceof Error ? error.message : "Failed to load image.",
        ),
      ],
    };
  }
}
