import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";

// Regular expression for hanime1.me video URLs
export const HANIME_VIDEO_REGEX =
  /https?:\/\/(?:www\.)?hanime1\.me\/watch\?v=(\d+)/;

interface HanimeVideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  tags: string[];
  url: string;
  videoUrl?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36";

/**
 * Fetches hanime video information by scraping the page
 */
async function fetchHanimeVideoInfo(
  videoId: string,
): Promise<{ info?: HanimeVideoInfo; error?: string }> {
  try {
    const url = `https://hanime1.me/watch?v=${videoId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (res.status === 403) {
      return { error: "Access Denied (403). Site might be behind Cloudflare." };
    }
    if (res.status === 404) {
      return { error: "Video not found (404)." };
    }
    if (!res.ok) {
      return { error: `Server returned status ${res.status}` };
    }

    const text = await res.text();

    // Extract title from page
    const titleMatch = text.match(
      /<title>(.*?)<\/title>/i,
    );
    let title = "Unknown Title";
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1])
        .replace(/\s*-\s*H動漫.*$/, "") // Remove site suffix
        .trim();
    }

    // Try to find thumbnail/poster image
    let thumbnail = "";

    // Look for og:image meta tag
    const ogImageMatch = text.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    );
    if (ogImageMatch) {
      thumbnail = ogImageMatch[1];
    }

    // Fallback: look for poster attribute in video tag
    if (!thumbnail) {
      const posterMatch = text.match(/poster="([^"]+)"/i);
      if (posterMatch) {
        thumbnail = posterMatch[1];
      }
    }

    // Extract tags
    const tags: string[] = [];
    const tagMatches = text.matchAll(
      /https:\/\/hanime1\.me\/search\?tags%5B%5D=([^&"]+)/g,
    );
    for (const match of tagMatches) {
      const tag = decodeURIComponent(match[1]);
      if (!tags.includes(tag) && tags.length < 15) {
        tags.push(tag);
      }
    }

    // Attempt to fetch video URL from download page
    let videoUrl: string | undefined;
    try {
      const downloadRes = await fetch(
        `https://hanime1.me/download?v=${videoId}`,
        {
          headers: { "User-Agent": USER_AGENT },
        },
      );
      if (downloadRes.ok) {
        const downloadText = await downloadRes.text();
        // Look for 720p or 1080p links first
        const mp4Matches = downloadText.match(
          /https?:\/\/[^\s"'<>|]+\.(?:mp4)[^\s"'<>|]*/gi,
        );
        if (mp4Matches) {
          // Prefer 720p or 1080p
          videoUrl = mp4Matches.find((m) => m.includes("720p")) ||
            mp4Matches.find((m) => m.includes("1080p")) ||
            mp4Matches[0];
        }
      }
    } catch (err) {
      logger.debug("Failed to fetch download page for video url: {err}", {
        err,
      });
    }

    return {
      info: {
        id: videoId,
        title,
        thumbnail: thumbnail || `https://hanime1.me/static/default-thumb.jpg`,
        tags,
        url,
        videoUrl,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch Hanime video info: {error}", { error });
    return { error: "Failed to fetch video info" };
  }
}

export async function getHanimePreview(content: string) {
  const match = content.match(HANIME_VIDEO_REGEX);
  if (!match) return null;

  const videoId = match[1];
  const result = await fetchHanimeVideoInfo(videoId);

  if (result.error || !result.info) {
    return {
      error: result.error || "Could not fetch video info.",
      color: 0xFF0000,
    };
  }

  const info = result.info;
  // deno-lint-ignore no-explicit-any
  const components: any[] = [
    {
      type: ComponentV2Type.MediaGallery,
      items: [
        {
          media: {
            url: info.videoUrl || info.thumbnail,
          },
          spoiler: false,
        },
      ],
    },
    {
      type: ComponentV2Type.TextDisplay,
      content: `### [${info.title}](${info.url})\nID: \`${info.id}\``,
    },
  ];

  // Add tags if available
  if (info.tags.length > 0) {
    components.push({
      type: ComponentV2Type.TextDisplay,
      content: `🏷️ ${
        info.tags.map((t) => `\`#${t.replace(/\s+/g, "")}\``).join(" ")
      }`.substring(0, 1000),
    });
  }

  return {
    color: 0xFF1744, // Red/Pink color for hanime
    components,
  };
}
