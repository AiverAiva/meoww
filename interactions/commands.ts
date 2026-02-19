import { AnyBot } from "../types.ts";
import { logger } from "../utils/logger.ts";
import { commands } from "../commands/registry.ts";
import { isNSFWSafe, sendNSFWError } from "../utils/nsfw_check.ts";

/**
 * Entry point for all application command interactions (Slash & Context Menus).
 */
// deno-lint-ignore no-explicit-any
export async function handleCommandInteraction(bot: AnyBot, interaction: any) {
  if (!interaction.data?.name) return;

  const command = commands.get(interaction.data.name);
  if (command) {
    // Perform NSFW safety check only if the command is marked as NSFW.
    if (command.nsfw) {
      const isSafe = await isNSFWSafe(
        bot,
        interaction.channelId,
        interaction.guildId,
      );
      if (!isSafe) {
        return await sendNSFWError(bot, interaction);
      }
    }

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
