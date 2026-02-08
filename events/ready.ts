import { logger } from "../utils/logger.ts";
import { Event } from "../types.ts";
import { commands } from "../commands/registry.ts";

export const readyEvent: Event = {
  name: "ready",
  execute: async (bot, rawPayload) => {
    // deno-lint-ignore no-explicit-any
    const payload = rawPayload as any;
    const username = payload.user?.username ?? "Bot";
    const discriminator = payload.user?.discriminator ?? "0000";

    logger.info("Successfully connected to gateway as {user}", {
      user: `${username}#${discriminator}`,
    });

    // Register slash commands (Global)
    try {
      await bot.helpers.upsertGlobalApplicationCommands(
        Array.from(
          commands.values(),
        ) as unknown as import("@discordeno/bot").CreateApplicationCommand[],
      );
      logger.info("Slash commands registered.");
    } catch (error) {
      logger.error("Failed to register slash commands: {error}", { error });
    }
  },
};
