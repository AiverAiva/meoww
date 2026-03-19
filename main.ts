import "@std/dotenv/load";
import { createBot, Intents } from "@discordeno/bot";
import { logger } from "./utils/logger.ts";
import { registerEvents } from "./events/mod.ts";
import { initLavalink } from "./utils/lavalink.ts";

const token = Deno.env.get("DISCORD_TOKEN");

if (!token) {
  logger.error(
    "DISCORD_TOKEN environment variable is not set correctly in .env!",
  );
  Deno.exit(1);
}

const bot = createBot({
  token,
  intents: Intents.Guilds |
    Intents.GuildMessages |
    Intents.MessageContent |
    Intents.GuildVoiceStates,
  desiredProperties: {
    message: {
      content: true,
      channelId: true,
      guildId: true,
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
      guildId: true,
      message: true,
    } as any,
    channel: {
      id: true,
      guildId: true,
      type: true,
      nsfw: true,
    } as any,
    member: {
      id: true,
      nick: true,
      roles: true,
    } as any,
    user: {
      id: true,
      username: true,
      discriminator: true,
      avatar: true,
    } as const,
    voiceState: {
      channelId: true,
      guildId: true,
      userId: true,
    } as any,
  },
});

// Initialize Lavalink
await initLavalink(bot);

// Initialize the modular event system
registerEvents(bot);

logger.info("Starting bot...");
await bot.start();
