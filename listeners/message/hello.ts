import { MessageListener } from "../../types.ts";
import { logger } from "../../utils/logger.ts";

export const helloListener: MessageListener = {
  name: "hello",
  filter: (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    const content = (message.content ?? "").toLowerCase();
    return content.includes("hi bot") || content.includes("hello bot");
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    logger.info("Hello listener triggered by {user}", {
      user: message.author?.username ?? "Unknown",
    });

    await bot.helpers.sendMessage(message.channelId, {
      content: `Hi ${message.author?.username ?? "there"}! I'm here to help.`,
    });
  },
};
