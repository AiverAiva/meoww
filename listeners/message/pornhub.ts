import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  ComponentV2Type,
  IS_COMPONENTS_V2,
} from "../../utils/components_v2.ts";

// Regular expression to match Pornhub video links
const PH_REGEX =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/;

async function fetchVideoInfo(viewKey: string) {
  try {
    const res = await fetch(
      `https://www.pornhub.com/view_video.php?viewkey=${viewKey}`,
    );
    const text = await res.text();

    // Extract JSON-LD for reliable metadata
    const jsonLdMatch = text.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s,
    );
    if (!jsonLdMatch) return null;

    const jsonLd = JSON.parse(jsonLdMatch[1]);

    // Decode HTML entities in title
    const title = jsonLd.name
      .replaceAll("&apos;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&comma;", ",")
      .replaceAll("&amp;", "&")
      .replaceAll("&period;", ".");

    return {
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
      duration: jsonLd.duration,
    };
  } catch (error) {
    logger.error("Failed to fetch PH video info: {error}", { error });
    return null;
  }
}

export const pornhubListener: MessageListener = {
  name: "pornhub",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return PH_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const match = message.content.match(PH_REGEX);
    if (!match) return;

    const viewKey = match[1];
    const info = await fetchVideoInfo(viewKey);

    if (!info) return;

    logger.info("Pornhub listener found video: {title}", { title: info.title });

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
      components: [
        {
          type: ComponentV2Type.Container,
          components: [
            {
              type: ComponentV2Type.MediaGallery,
              items: [
                {
                  media: {
                    url: info.thumbnail,
                  },
                  spoiler: true,
                },
              ],
              // deno-lint-ignore no-explicit-any
            } as any,
            {
              type: ComponentV2Type.TextDisplay,
              content:
                `### [${info.title}](${info.url})\n**${info.views} Views** • ${info.uploadDate}\nby **${info.author}**`,
            },
          ],
        },
      ] as unknown as import("@discordeno/bot").ActionRow[],
    });
  },
};
