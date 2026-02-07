import "@std/dotenv/load";
import { createBot, Intents } from "@discordeno/bot";

const token = Deno.env.get("DISCORD_TOKEN");

if (!token) {
  console.error("DISCORD_TOKEN environment variable is not set correctly in .env!");
  console.info("Please edit the .env file and provide a valid Discord Bot Token.");
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
    } as const,
  },
  events: {
    ready() {
      console.log("Successfully connected to gateway");
    },
    messageCreate(message) {
      // Basic ping command
      if (message.content === "!ping") {
        console.log("Received !ping command");
        bot.helpers.sendMessage(message.channelId, {
          content: "Pong!",
        });
      }
    },
  },
});

console.log("Starting bot...");
await bot.start();
