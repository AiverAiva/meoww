import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  ComponentV2Type,
  IS_COMPONENTS_V2,
} from "../../utils/components_v2.ts";

// Regular expressions to match X/Twitter links
const X_REGEX =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?:[a-zA-Z0-9_]+)\/status\/([0-9]+)/;
const X_I_REGEX =
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

async function fetchTweetInfo(
  tweetId: string,
): Promise<{ info?: TweetInfo; error?: string }> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
    const data = await res.json();

    if (data.code !== 200) {
      logger.warn("FxTwitter API returned error: {code} {message}", {
        code: data.code,
        message: data.message,
      });
      return { error: data.message || "Unknown error" };
    }

    const tweet = data.tweet;

    // deno-lint-ignore no-explicit-any
    const media = (tweet.media?.all || []).map((m: any) => ({
      type: m.type,
      url: m.url,
      thumbnail_url: m.thumbnail_url,
    }));

    // If no media, use the first image if available, typically from card
    // But FxTwitter usually puts everything in media.all

    return {
      info: {
        url: tweet.url,
        text: tweet.text,
        author: {
          name: tweet.author.name,
          screen_name: tweet.author.screen_name,
          avatar_url: tweet.author.avatar_url,
        },
        media: media,
        stats: {
          replies: tweet.replies,
          retweets: tweet.retweets,
          likes: tweet.likes,
          views: tweet.views,
        },
        created_at: new Date(tweet.created_at).toLocaleString(),
      },
    };
  } catch (error) {
    logger.error("Failed to fetch tweet info: {error}", { error });
    return { error: "Failed to fetch tweet info" };
  }
}

export const twitterListener: MessageListener = {
  name: "twitter",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return X_REGEX.test(content) || X_I_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const content = message.content;

    let tweetId = content.match(X_REGEX)?.[1];
    if (!tweetId) {
      tweetId = content.match(X_I_REGEX)?.[1];
    }

    if (!tweetId) return;

    const result = await fetchTweetInfo(tweetId);

    if (result.error || !result.info) {
      await bot.helpers.sendMessage(message.channelId, {
        messageReference: {
          messageId: message.id,
          channelId: message.channelId,
          guildId: message.guildId,
          failIfNotExists: false,
        },
        allowedMentions: { repliedUser: false },
        flags: IS_COMPONENTS_V2,
        components: [
          {
            type: ComponentV2Type.Container,
            accent_color: 0xFF0000, // Red for error
            components: [
              {
                type: ComponentV2Type.TextDisplay,
                content: `❌ **Error**\n${
                  result.error || "Could not fetch Tweet."
                }`,
              },
            ],
          },
        ] as unknown as import("@discordeno/bot").ActionRow[],
      });
      return;
    }

    const info = result.info;

    logger.info("Twitter listener found tweet: {id}", { id: tweetId });

    // Build media items for gallery
    // deno-lint-ignore no-explicit-any
    const mediaItems: any[] = info.media.map((m) => {
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

    // If it's a video, we might want to prioritize showing it properly.
    // Components V2 MediaGallery supports videos if they are directly linkable?
    // Actually, for Discord V2, we often just want the thumbnail as a link to the video or similar.
    // Let's stick to the MediaGallery item structure.

    // Truncate text if too long
    const truncatedText = info.text.length > 200
      ? info.text.substring(0, 197) + "..."
      : info.text;

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.Container,
        accent_color: 0x1DA1F2, // X/Twitter Blue
        components: [
          // Author Header
          {
            type: ComponentV2Type.TextDisplay,
            content: `**${info.author.name}** (@${info.author.screen_name})`,
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
            content:
              `❤️ **${info.stats.likes}**  🔁 **${info.stats.retweets}**  💬 **${info.stats.replies}**  👁️ **${
                info.stats.views ?? "N/A"
              }**\n${info.created_at}`,
          },

          // Link
          {
            type: ComponentV2Type.TextDisplay,
            content: `[View on X](${info.url})`,
          },
        ],
      },
    ];

    await bot.helpers.sendMessage(message.channelId, {
      messageReference: {
        messageId: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        failIfNotExists: false,
      },
      allowedMentions: {
        repliedUser: false,
      },
      flags: IS_COMPONENTS_V2,
      components:
        components as unknown as import("@discordeno/bot").ActionRow[],
    });
  },
};
