import { AnyBot } from "../types.ts";
import { logger } from "../utils/logger.ts";
import { commands } from "../commands/registry.ts";

/**
 * Entry point for all application command interactions (Slash & Context Menus).
 */
// deno-lint-ignore no-explicit-any
export async function handleCommandInteraction(bot: AnyBot, interaction: any) {
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
}
