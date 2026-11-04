import "@std/dotenv/load";
import { createBot, Intents } from "@discordeno/bot";
import { logger } from "./utils/logger.ts";
import { registerEvents } from "./events/mod.ts";
// import { initLavalink } from "./utils/lavalink.ts"; // Music: keep commented out while no Lavalink node is available
import { getDb } from "./utils/db.ts";
import { ensureIndexes } from "./utils/honeypot_store.ts";

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
      attachments: true,
    } as const,
    attachment: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      url: true,
      duration_secs: true,
    } as any,
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
      appPermissions: true,
    } as any,
    channel: {
      id: true,
      guildId: true,
      type: true,
      nsfw: true,
      parentId: true,
      name: true,
    } as any,
    guild: {
      id: true,
      name: true,
    } as any,
    member: {
      id: true,
      nick: true,
      roles: true,
      user: true,
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

// Initialize MongoDB
await getDb();
await ensureIndexes();

// Initialize Lavalink
// await initLavalink(bot); // Music: keep commented out while no Lavalink node is available

// Initialize the modular event system
registerEvents(bot);

logger.info("Starting bot...");
await bot.start();
