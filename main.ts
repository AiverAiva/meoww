import "@std/dotenv/load";
import { createBot, Intents } from "@discordeno/bot";
import { pingCommand } from "./commands/ping.ts";
import { Command } from "./commands/mod.ts";
import { logger } from "./utils/logger.ts";

const token = Deno.env.get("DISCORD_TOKEN");

if (!token) {
  logger.error(
    "DISCORD_TOKEN environment variable is not set correctly in .env!",
  );
  Deno.exit(1);
}

// Collection of commands
const commands = new Map<string, Command>();
commands.set(pingCommand.name, pingCommand);

const bot = createBot({
  token,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
  desiredProperties: {
    message: {
      content: true,
      channelId: true,
      id: true,
    } as const,
    interaction: {
      id: true,
      token: true,
      type: true,
      data: true,
    } as const,
  },
  events: {
    async ready() {
      logger.info("Successfully connected to gateway");

      // Register slash commands (Global)
      // We cast to unknown then CreateApplicationCommand[] to satisfy the compiler's strictness with custom command objects
      await bot.helpers.upsertGlobalApplicationCommands(
        Array.from(
          commands.values(),
        ) as unknown as import("@discordeno/bot").CreateApplicationCommand[],
      );
      logger.info("Slash commands registered.");
    },
    async interactionCreate(interaction) {
      if (!interaction.data?.name) return;

      const command = commands.get(interaction.data.name);
      if (command) {
        logger.debug("Executing command: {name}", { name: command.name });
        try {
          await command.execute(bot, interaction);
        } catch (error) {
          logger.error("Error executing command {name}: {error}", {
            name: command.name,
            error: error,
          });
        }
      }
    },
  },
});

logger.info("Starting bot...");
await bot.start();
