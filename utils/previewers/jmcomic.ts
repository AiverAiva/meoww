import { ComponentV2Type } from "../components_v2.ts";
import { createErrorCard } from "../ui_factory.ts";

export const JMCOMIC_REGEX =
  /https?:\/\/(?:www\.)?(?:18comic\.(?:vip|org|art|xyz)|jm-comic\.(?:me|top))\/(?:photo|album)\/(\d+)/;

/**
 * Basic HTML entity decoder for common entities found in titles.
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ");
}

/**
 * Wraps an image URL with a proxy that handles the 'torn image' descrambling.
 */
function wrapImageWithProxy(url: string): string {
  return `https://enderdaniel.work/pic/transform?url=${
    encodeURIComponent(url)
  }`;
}

export async function getJMComicPreview(content: string) {
  const match = content.match(JMCOMIC_REGEX);
  if (!match) return null;

  const id = match[1];
  const isAlbum = content.includes("/album/");
  const originalUrl = isAlbum
    ? `https://18comic.vip/album/${id}`
    : `https://18comic.vip/photo/${id}`;

  // Always use the photo URL for metadata scraping as it contains the page selector
  const fetchUrl = `https://18comic.vip/photo/${id}`;

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch 18comic: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const titleRaw = titleMatch ? titleMatch[1] : "";
    let title = decodeHTMLEntities(titleRaw)
      .replace(/ | 18Comic \u5929\u5802\u5df4\u6bd4\u502b/i, "")
      .replace(/ - \u7b2c\d+\u9801/i, "")
      .trim();

    // Clean title further if it contains a pipe (common in JM titles)
    if (title.includes("|")) {
      title = title.split("|")[0].trim();
    }
    if (!title) title = `JMComic ${id}`;

    // Host and extension detection
    const cdnMatch = html.match(
      /cdn-msp\d*\.18comic\.(?:vip|org|art|xyz|me|top)/,
    );
    const host = cdnMatch ? cdnMatch[0] : "cdn-msp3.18comic.vip";
    const ext = html.includes(".webp") || html.includes("webp: true")
      ? "webp"
      : "jpg";

    const rawThumbUrl = `https://${host}/media/photos/${id}/00001.${ext}`;
    const thumbUrl = wrapImageWithProxy(rawThumbUrl);

    // Extract page count
    // Logic: Look for any select tag that's likely the page selector (as in the provided Python snippet)
    // We search for a select that contains many options.
    const selectMatches = html.match(/<select[^>]*>([\s\S]*?)<\/select>/gi);
    let pageCount = 0;
    if (selectMatches) {
      for (const select of selectMatches) {
        const options = select.match(/<option/gi);
        if (options && options.length > 5) { // Most comics have > 5 pages
          pageCount = options.length;
          break;
        }
      }
    }

    if (!pageCount) {
      // Fallback patterns
      const pageMatch = html.match(/total_pages\s*[=:]\s*(\d+)/i) ||
        html.match(/var\s+total_pages\s*=\s*(\d+)/) ||
        html.match(/class="label">(\d+)\u9801/) ||
        html.match(/(\d+)\s*頁/);
      pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0;
    }

    // Direct copy of nhentai structure
    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: thumbUrl }, spoiler: false }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${title}](${originalUrl})\n${
          pageCount ? `**${pageCount}P** • ` : ""
        }ID: \`${id}\``,
      },
      {
        type: ComponentV2Type.ActionRow,
        components: [{
          type: ComponentV2Type.Button,
          style: 1,
          label: "📂 View in Discord",
          custom_id: `jmcomic_v_${id}_1_0_0`,
        }],
      },
    ];

    return { color: 0xFB7299, components };
  } catch (error) {
    return {
      color: 0xFB7299,
      components: [
        createErrorCard(
          error instanceof Error
            ? error.message
            : "Failed to fetch 18Comic data.",
        ),
      ],
    };
  }
}

export async function getJMComicFullViewer(id: string, page: number) {
  const url = `https://18comic.vip/photo/${id}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    if (!response.ok) throw new Error("Failed to fetch JMComic data.");
    const html = await response.text();

    // Extract page count
    const selectMatches = html.match(/<select[^>]*>([\s\S]*?)<\/select>/gi);
    let pageCount = 0;
    if (selectMatches) {
      for (const select of selectMatches) {
        const options = select.match(/<option/gi);
        if (options && options.length > 5) {
          pageCount = options.length;
          break;
        }
      }
    }

    if (!pageCount) {
      const pageMatch = html.match(/total_pages\s*[=:]\s*(\d+)/i) ||
        html.match(/var\s+total_pages\s*=\s*(\d+)/) ||
        html.match(/class="label">(\d+)\u9801/) ||
        html.match(/(\d+)\s*頁/);
      pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0;
    }

    const clampedPage = Math.max(1, Math.min(page, pageCount || 9999));

    const cdnMatch = html.match(
      /cdn-msp\d*\.18comic\.(?:vip|org|art|xyz|me|top)/,
    );
    const host = cdnMatch ? cdnMatch[0] : "cdn-msp3.18comic.vip";
    const ext = html.includes(".webp") || html.includes("webp: true")
      ? "webp"
      : "jpg";

    const pad = (n: number) => n.toString().padStart(5, "0");
    const rawImageUrl = `https://${host}/media/photos/${id}/${
      pad(clampedPage)
    }.${ext}`;
    const imageUrl = wrapImageWithProxy(rawImageUrl);

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const titleRaw = titleMatch ? titleMatch[1] : "";
    const title = decodeHTMLEntities(titleRaw)
      .replace(/ | 18Comic \u5929\u5802\u5df4\u6bd4\u502b/i, "")
      .replace(/ - \u7b2c\d+\u9801/i, "").trim() || `JMComic ${id}`;

    // Direct copy of nhentai structure
    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: imageUrl }, spoiler: false }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${title}](${url})\nPage **${clampedPage}** / **${
          pageCount || "?"
        }**`,
      },
    ];

    if (pageCount > 1 || !pageCount) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏪",
            custom_id: `jmcomic_v_${id}_1_${clampedPage}_f`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⬅️",
            custom_id: `jmcomic_v_${id}_${clampedPage - 1}_${clampedPage}_v`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${clampedPage} / ${pageCount || "?"}`,
            custom_id: `jmcomic_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "➡️",
            custom_id: `jmcomic_v_${id}_${clampedPage + 1}_${clampedPage}_n`,
            disabled: pageCount > 0 && clampedPage === pageCount,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏩",
            custom_id: `jmcomic_v_${id}_${pageCount || 999}_${clampedPage}_l`,
            disabled: pageCount > 0 && clampedPage === pageCount,
          },
        ],
      });
    }

    return { color: 0xFB7299, components };
  } catch (error) {
    return {
      color: 0xFB7299,
      components: [
        createErrorCard(
          error instanceof Error ? error.message : "Failed to load image.",
        ),
      ],
    };
  }
}
