import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import {
  formatPreviewComponents,
  getPornhubPreview,
  PH_MODEL_REGEX,
  PH_VIDEO_REGEX,
} from "../../utils/previewers/mod.ts";

export const pornhubListener: MessageListener = {
  name: "pornhub",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return PH_VIDEO_REGEX.test(content) || PH_MODEL_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const content = message.content;

    const preview = await getPornhubPreview(content);
    if (!preview) return;

    logger.info("Pornhub listener triggered in channel {id}", {
      id: message.channelId,
    });

    const components = formatPreviewComponents(preview);

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
