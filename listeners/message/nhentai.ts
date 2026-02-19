import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import {
  formatPreviewComponents,
  getNHentaiPreview,
  NHENTAI_REGEX,
} from "../../utils/previewers/mod.ts";
import { isNSFWSafe, sendNSFWMessageError } from "../../utils/nsfw_check.ts";

export const nhentaiListener: MessageListener = {
  name: "nhentai",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return NHENTAI_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;

    // Strict NSFW check for automatic listener
    const isSafe = await isNSFWSafe(bot, message.channelId, message.guildId);
    if (!isSafe) {
      logger.debug("nHentai listener skipped: Not in NSFW safe environment.");
      await sendNSFWMessageError(bot, message.channelId, message.id);
      return;
    }

    const content = message.content;

    logger.debug("Running nHentai preview check for: {content}", { content });

    // getNHentaiPreview now returns Promise<{ color, components } | null> (no file)
    const preview = await getNHentaiPreview(content);

    if (!preview) return;

    logger.info(
      "nHentai listener triggered in channel {id}.",
      { id: message.channelId },
    );

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
      // Removed files since we use direct URLs now
    });
  },
};
