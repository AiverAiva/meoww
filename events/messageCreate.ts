import { Event } from "../types.ts";
import { messageListeners } from "../listeners/message/mod.ts";
import { logger } from "../utils/logger.ts";

export const messageCreateEvent: Event = {
  name: "messageCreate",
  execute: async (bot, message) => {
    // Dispatch to all listeners
    for (const listener of messageListeners) {
      try {
        const shouldRun = await listener.filter(message);
        if (shouldRun) {
          await listener.execute(bot, message);
        }
      } catch (error) {
        logger.error("Error in listener {name}: {error}", {
          name: listener.name,
          error: error,
        });
      }
    }
  },
};
