import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import {
  hasLatex,
  extractLatex,
  getLatexPreview,
} from "../../utils/previewers/latex.ts";
import { createContainer } from "../../utils/ui_factory.ts";

export const latexListener: MessageListener = {
  name: "latex",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = message.content ?? "";
    return hasLatex(content);
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const content = message.content;

    logger.debug("Running LaTeX preview check for: {content}", { content });

    const expressions = extractLatex(content);
    if (expressions.length === 0) return;

    const preview = await getLatexPreview(expressions[0]);
    if (!preview) return;

    logger.info("LaTeX listener triggered in channel {id}.", {
      id: message.channelId,
    });

    const components = [createContainer(preview.components, preview.color)];

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
      files: [preview.file],
    });
  },
};
