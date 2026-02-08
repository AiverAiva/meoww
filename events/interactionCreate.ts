import { logger } from "../utils/logger.ts";
import { Event } from "../types.ts";
import { commands } from "../commands/registry.ts";

export const interactionCreateEvent: Event = {
  name: "interactionCreate",
  execute: async (bot, rawInteraction) => {
    // deno-lint-ignore no-explicit-any
    const interaction = rawInteraction as any;
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
};
