import "@std/dotenv/load";
import { createBot, Intents } from "@discordeno/bot";
import { logger } from "./utils/logger.ts";
import { registerEvents } from "./events/mod.ts";

const token = Deno.env.get("DISCORD_TOKEN");

if (!token) {
  logger.error(
    "DISCORD_TOKEN environment variable is not set correctly in .env!",
  );
  Deno.exit(1);
}

const bot = createBot({
  token,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
  desiredProperties: {
    message: {
      content: true,
      channelId: true,
      id: true,
      author: true,
    } as const,
    interaction: {
      id: true,
      token: true,
      type: true,
      data: true,
      user: true,
      member: true,
      channelId: true,
      message: true,
    } as const,
  },
});

// Initialize the modular event system
registerEvents(bot);

logger.info("Starting bot...");
await bot.start();
