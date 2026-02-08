import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";

// Regular expressions to match X/Twitter links
export const X_REGEX =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?:[a-zA-Z0-9_]+)\/status\/([0-9]+)/;
export const X_I_REGEX =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/i\/status\/([0-9]+)/;

interface TweetInfo {
  url: string;
  text: string;
  author: {
    name: string;
    screen_name: string;
    avatar_url: string;
  };
  media: {
    type: "photo" | "video" | "animated_gif";
    url: string;
    thumbnail_url?: string;
  }[];
  stats: {
    replies: number;
    retweets: number;
    likes: number;
    views: number | null;
  };
  created_at: string;
}

export async function getTwitterPreview(content: string) {
  let tweetId = content.match(X_REGEX)?.[1];
  if (!tweetId) {
    tweetId = content.match(X_I_REGEX)?.[1];
  }

  if (!tweetId) return null;

  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
    const data = await res.json();

    if (data.code !== 200) {
      return {
        error: data.message || "Unknown error",
        color: 0xFF0000,
      };
    }

    const tweet = data.tweet;

    // Build media items for gallery
    // deno-lint-ignore no-explicit-any
    const mediaItems: any[] = (tweet.media?.all || []).map((m: any) => {
      if (m.type === "video" || m.type === "animated_gif") {
        return {
          media: {
            url: m.url, // Video URL
            thumbnail: m.thumbnail_url ? { url: m.thumbnail_url } : undefined,
          },
          spoiler: false,
        };
      } else {
        return {
          media: {
            url: m.url, // Photo URL
          },
          spoiler: false,
        };
      }
    });

    // Decode HTML entities
    const decodedText = decodeHtmlEntities(tweet.text);

    // Truncate text if too long
    const truncatedText = decodedText.length > 200
      ? decodedText.substring(0, 197) + "..."
      : decodedText;

    const statsText =
      `❤️ **${tweet.likes}**  🔁 **${tweet.retweets}**  💬 **${tweet.replies}**  👁️ **${
        tweet.views ?? "N/A"
      }**\n${new Date(tweet.created_at).toLocaleString()}`;

    return {
      color: 0x1DA1F2, // X/Twitter Blue
      components: [
        // Author Header
        {
          type: ComponentV2Type.TextDisplay,
          content: `**${tweet.author.name}** (@${tweet.author.screen_name})`,
        },
        // Content Text
        {
          type: ComponentV2Type.TextDisplay,
          content: truncatedText,
        },
        // Media Gallery (if any)
        ...(mediaItems.length > 0
          ? [{
            type: ComponentV2Type.MediaGallery,
            items: mediaItems,
          }]
          : []),
        // Stats Footer
        {
          type: ComponentV2Type.TextDisplay,
          content: statsText,
        },
        // Link
        {
          type: ComponentV2Type.TextDisplay,
          content: `[View on X](${tweet.url})`,
        },
      ],
    };
  } catch (error) {
    logger.error("Failed to fetch tweet info: {error}", { error });
    return {
      error: "Failed to fetch tweet info",
      color: 0xFF0000,
    };
  }
}
