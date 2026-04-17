import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import {
  formatPreviewComponents,
  getHanimePreview,
  HANIME_VIDEO_REGEX,
} from "../../utils/previewers/mod.ts";
import { isNSFWSafe, sendNSFWMessageError } from "../../utils/nsfw_check.ts";

export const hanimeListener: MessageListener = {
  name: "hanime",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return HANIME_VIDEO_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const content = message.content;

    const preview = await getHanimePreview(content);
    if (!preview) return;

    // TODO: [temporary] NSFW check bypassed for testing
    // if (preview.isNSFW) {
    //   const nsrfCheck = await isNSFWSafe(bot, message.channelId, message.guildId);
    //   if (nsrfCheck === false) {
    //     await sendNSFWMessageError(bot, message.channelId, message.id);
    //     return;
    //   }
    //   if (nsrfCheck === undefined) {
    //     logger.debug("Hanime listener: NSFW check unavailable (access denied), allowing content");
    //   }
    // }

    logger.info("Hanime listener triggered in channel {id}", {
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
