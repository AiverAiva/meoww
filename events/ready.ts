import { logger } from "../utils/logger.ts";
import { Event } from "../types.ts";
import { syncCommands } from "../interactions/registry.ts";

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

    // Register/Sync commands
    await syncCommands(bot);
  },
};
