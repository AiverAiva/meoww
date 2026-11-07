import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import {
  formatPreviewComponents,
  getShopeePreview,
  SHOPEE_REGEX,
} from "../../utils/previewers/mod.ts";

export const shopeeListener: MessageListener = {
  name: "shopee",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return SHOPEE_REGEX.test(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const content = message.content;

    const preview = await getShopeePreview(content);
    if (!preview || ("error" in preview && preview.error)) return;

    logger.info("Shopee listener found a short link in channel {id}", {
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
