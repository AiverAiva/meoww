import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";
import { createErrorCard } from "../ui_factory.ts";

export const WNACG_REGEX =
  /https?:\/\/(?:www\.)?wnacg\.com\/photos-(?:index|slide)-aid-(\d+)\.html/;

interface WNACGMetadata {
  aid: string;
  title: string;
  uploader: string;
  totalPageCount: number;
  tags: string[];
  firstViewId: string;
  coverUrl: string;
}

interface WNACGViewData {
  highResUrl: string;
  nextViewId: string | null;
  prevViewId: string | null;
  firstViewId: string | null;
  lastViewId: string | null;
  currentPageNum: number;
  totalPageNum: number;
  title: string; // Breadcrumb title
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36";

/**
 * Normalizes WNACG URLs to prevent double slashes and ensure protocol.
 */
function normalizeWnacgUrl(url: string | undefined): string {
  if (!url) return "";
  let clean = decodeHtmlEntities(url).trim();
  if (clean.startsWith("//")) {
    clean = "https:" + clean;
  } else if (clean.startsWith("/")) {
    clean = "https://wnacg.com" + clean;
  }
  return clean.replace(/(https?:\/\/)\/+/g, "$1");
}

/**
 * Fetches WNACG content with error handling.
 */
async function fetchWNACG(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.status === 403) {
      throw new Error(
        "Access Denied (403). WNACG might be behind Cloudflare verification.",
      );
    }
    if (res.status === 404) {
      throw new Error(
        "Content Not Found (404). This gallery might have been deleted.",
      );
    }
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
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
 * Fetches basic metadata from the index page.
 */
async function fetchWNACGMetadata(aid: string): Promise<WNACGMetadata> {
  const url = `https://wnacg.com/photos-index-aid-${aid}.html`;
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

  const firstViewId = text.match(/\/photos-view-id-(\d+)\.html/)?.[1] || "";

  let coverUrl = text.match(
    /<div class="[^"]*uwthumb[^"]*">[\s\S]*?<img[^>]+src="([^"]+)"/,
  )?.[1];
  coverUrl = normalizeWnacgUrl(coverUrl);

  return {
    aid,
    title,
    uploader,
    totalPageCount,
    tags,
    firstViewId,
    coverUrl,
  };
}

/**
 * Fetches high-res image and navigation IDs from a viewing page.
 */
async function fetchWNACGViewData(
  viewId: string,
): Promise<WNACGViewData> {
  const url = `https://wnacg.com/photos-view-id-${viewId}.html`;
  const text = await fetchWNACG(url);

  const highResUrlMatch = text.match(/<img[^>]+id="picarea"[^>]+src="([^"]+)"/);
  if (!highResUrlMatch) {
    throw new Error("Could not find image source on the page.");
  }
  const highResUrl = normalizeWnacgUrl(highResUrlMatch[1]);

  // Page labels
  const pagelabMatch = text.match(
    /class="newpagelabel"><b>(\d+)<\/b>\/(\d+)</,
  );
  const currentPageNum = pagelabMatch ? parseInt(pagelabMatch[1], 10) : 1;
  const totalPageNum = pagelabMatch ? parseInt(pagelabMatch[2], 10) : 1;

  // Title from breadcrumbs
  const titleMatch = text.match(
    /<div[^>]+class="png bread">[\s\S]*?<a[^>]+>(.*?)<\/a>/,
  );
  const title = decodeHtmlEntities(
    titleMatch ? titleMatch[1].trim() : "Viewing Gallery",
  );

  // Navigation IDs
  const selectContentMatch = text.match(
    /<select[^>]+class="pageselect"[^>]*>([\s\S]*?)<\/select>/i,
  );
  const selectContent = selectContentMatch?.[1];

  let firstViewId = null,
    lastViewId = null,
    prevViewId = null,
    nextViewId = null;

  if (selectContent) {
    const options = [...selectContent.matchAll(/<option[^>]+value="(\d+)"/gi)]
      .map((m) => m[1]);
    if (options.length > 0) {
      firstViewId = options[0];
      lastViewId = options[options.length - 1];
      const currentIndex = currentPageNum - 1;
      prevViewId = (currentIndex > 0 && currentIndex < options.length)
        ? options[currentIndex - 1]
        : null;
      nextViewId = (currentIndex >= 0 && currentIndex < options.length - 1)
        ? options[currentIndex + 1]
        : null;
    }
  }

  return {
    highResUrl,
    nextViewId,
    prevViewId,
    firstViewId,
    lastViewId,
    currentPageNum,
    totalPageNum,
    title,
  };
}

export async function getWNACGPreview(content: string) {
  const match = content.match(WNACG_REGEX);
  if (!match) return null;

  try {
    const meta = await fetchWNACGMetadata(match[1]);

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
          `### [${meta.title}](https://wnacg.com/photos-index-aid-${meta.aid}.html)\nUploaded by **${meta.uploader}** • **${meta.totalPageCount}P**`,
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
          custom_id: `wnacg_v_${meta.aid}_${meta.firstViewId}_0`,
        }],
      },
    ];

    return { color: 0x9B59B6, components };
  } catch (error) {
    return {
      color: 0x9B59B6,
      components: [
        createErrorCard(
          error instanceof Error
            ? error.message
            : "Failed to fetch WNACG metadata.",
        ),
      ],
    };
  }
}

export async function getWNACGFullViewer(aid: string, viewId: string) {
  try {
    const viewData = await fetchWNACGViewData(viewId);

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: viewData.highResUrl
          ? [{ media: { url: viewData.highResUrl }, spoiler: false }]
          : [],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### [${viewData.title}](https://wnacg.com/photos-index-aid-${aid}.html)\nPage **${viewData.currentPageNum}** / **${viewData.totalPageNum}**`,
      },
    ];

    if (viewData.totalPageNum > 1) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏪",
            custom_id: `wnacg_v_${aid}_${viewData.firstViewId || "none"}_f`,
            disabled: !viewData.firstViewId || viewData.currentPageNum === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⬅️",
            custom_id: `wnacg_v_${aid}_${viewData.prevViewId || "none"}_v`,
            disabled: !viewData.prevViewId,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${viewData.currentPageNum} / ${viewData.totalPageNum}`,
            custom_id: `wnacg_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "➡️",
            custom_id: `wnacg_v_${aid}_${viewData.nextViewId || "none"}_n`,
            disabled: !viewData.nextViewId,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏩",
            custom_id: `wnacg_v_${aid}_${viewData.lastViewId || "none"}_l`,
            disabled: !viewData.lastViewId ||
              viewData.currentPageNum === viewData.totalPageNum,
          },
        ],
      });
    }

    return { color: 0x9B59B6, components };
  } catch (error) {
    return {
      color: 0x9B59B6,
      components: [
        createErrorCard(
          error instanceof Error ? error.message : "Failed to load image.",
        ),
      ],
    };
  }
}
