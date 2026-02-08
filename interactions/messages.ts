import { AnyBot } from "../types.ts";
import { messageListeners } from "../listeners/message/mod.ts";
import { logger } from "../utils/logger.ts";

/**
 * Entry point for all message creation events.
 * Dispatches the message to all registered listeners.
 */
// deno-lint-ignore no-explicit-any
export async function handleMessageCreate(bot: AnyBot, message: any) {
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
}
