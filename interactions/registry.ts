import { AnyBot } from "../types.ts";
import { logger } from "../utils/logger.ts";
import { commands } from "../commands/registry.ts";

/**
 * Synchronizes application commands with Discord.
 */
export async function syncCommands(bot: AnyBot) {
  try {
    await bot.helpers.upsertGlobalApplicationCommands(
      Array.from(
        commands.values(),
      ) as unknown as import("@discordeno/bot").CreateApplicationCommand[],
    );
    logger.info("Application commands synchronized.");
  } catch (error) {
    logger.error("Failed to synchronize application commands: {error}", {
      error,
    });
  }
}
