import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";

// Regular expressions
export const PH_VIDEO_REGEX =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/;
export const PH_MODEL_REGEX =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pornhub\.com\/model\/([a-zA-Z0-9-_]+)/;

interface PHVideoInfo {
  type: "video";
  title: string;
  author: string;
  thumbnail: string;
  views: string;
  uploadDate: string;
  url: string;
  description: string;
}

interface PHModelInfo {
  type: "model";
  name: string;
  subscribers: string;
  views: string;
  avatar?: string;
  url: string;
}

type PHInfo = PHVideoInfo | PHModelInfo;

async function fetchVideoInfo(
  viewKey: string,
): Promise<{ info?: PHVideoInfo; error?: string }> {
  try {
    const res = await fetch(
      `https://www.pornhub.com/view_video.php?viewkey=${viewKey}`,
    );
    const text = await res.text();

    const jsonLdMatch = text.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s,
    );
    if (!jsonLdMatch) return { error: "Video not found or is private" };

    const jsonLd = JSON.parse(jsonLdMatch[1]);

    const title = decodeHtmlEntities(jsonLd.name);

    return {
      info: {
        type: "video",
        title: title,
        author: jsonLd.author,
        thumbnail: Array.isArray(jsonLd.thumbnailUrl)
          ? jsonLd.thumbnailUrl[0]
          : jsonLd.thumbnailUrl,
        // deno-lint-ignore no-explicit-any
        views: jsonLd.interactionStatistic?.find((s: any) =>
          s.interactionType === "http://schema.org/WatchAction"
        )?.userInteractionCount || "Unknown",
        uploadDate: jsonLd.uploadDate
          ? new Date(jsonLd.uploadDate).toLocaleDateString()
          : "Unknown Date",
        url: jsonLd.contentUrl ||
          `https://www.pornhub.com/view_video.php?viewkey=${viewKey}`,
        description: jsonLd.description,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch PH video info: {error}", { error });
    return { error: "Failed to fetch video info" };
  }
}

async function fetchModelInfo(
  username: string,
): Promise<{ info?: PHModelInfo; error?: string }> {
  try {
    const url = `https://www.pornhub.com/model/${username}`;
    const res = await fetch(url);
    const text = await res.text();

    const rawName = text.match(
      /<span[^>]*?class="[^"]*?js-profile-header-title[^"]*?"[^>]*?>(.*?)<\/span>/s,
    )?.[1]?.trim();

    if (!rawName) return { error: "Model not found or profile is private" };

    const name = decodeHtmlEntities(rawName);
    const subscribers = text.match(
      /<span class="[^"]*?bold[^"]*?">([\d\.KkMm]+)<\/span>\s*<span>Subscribers<\/span>/s,
    )?.[1];
    const avatar = text.match(/<img[^>]*?id="getAvatar"[^>]*?src="(.*?)"/)?.[1];
    const views = text.match(
      /<span>Video Views:<\/span>\s*<span[^>]*?>([\d,KkMm\.]+)/i,
    )?.[1];

    return {
      info: {
        type: "model",
        name,
        subscribers: subscribers || "Unknown",
        views: views || "Unknown",
        avatar,
        url,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch PH model info: {error}", { error });
    return { error: "Failed to fetch model info" };
  }
}

export async function getPornhubPreview(content: string) {
  let result: { info?: PHInfo; error?: string } | null = null;

  const videoMatch = content.match(PH_VIDEO_REGEX);
  if (videoMatch) {
    const viewKey = videoMatch[1];
    result = await fetchVideoInfo(viewKey);
  }

  if (!result) {
    const modelMatch = content.match(PH_MODEL_REGEX);
    if (modelMatch) {
      const username = modelMatch[1];
      result = await fetchModelInfo(username);
    }
  }

  if (!result) return null;

  if (result.error || !result.info) {
    return {
      error: result.error || "Could not fetch content.",
      color: 0xFF0000,
    };
  }

  const info = result.info;
  // deno-lint-ignore no-explicit-any
  let components: any[] = [];

  if (info.type === "video") {
    components = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [
          {
            media: {
              url: info.thumbnail,
            },
            spoiler: false,
          },
        ],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### [${info.title}](${info.url})\n**${info.views} Views** • ${info.uploadDate}\nby **${info.author}**`,
      },
    ];
  } else {
    components = [
      ...(info.avatar
        ? [{
          type: ComponentV2Type.MediaGallery,
          items: [
            {
              media: {
                url: info.avatar,
              },
              spoiler: false,
            },
          ],
        }]
        : []),
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### [${info.name}](${info.url})\n**${info.subscribers} Subscribers** • **${info.views} Video Views**`,
      },
    ];
  }

  return {
    color: 0xFFA31A, // Pornhub Orange
    components,
  };
}
