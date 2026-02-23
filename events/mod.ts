import { AnyBot } from "../types.ts";
import { readyEvent } from "./ready.ts";
import { interactionCreateEvent } from "./interactionCreate.ts";
import { messageCreateEvent } from "./messageCreate.ts";
import { lavalink } from "../utils/lavalink.ts";
import { logger } from "../utils/logger.ts";

/**
 * Helper to register events after bot creation.
 */
export function registerEvents(bot: AnyBot) {
  // We use casting to bypass strict DesiredProperties mismatches in the handler signatures
  // while still using our cleaner modular structure.

  // deno-lint-ignore no-explicit-any
  const events = bot.events as any;

  events.ready = (payload: unknown, rawPayload: unknown) =>
    readyEvent.execute(bot, payload, rawPayload);

  events.interactionCreate = (interaction: unknown) =>
    interactionCreateEvent.execute(bot, interaction);

  events.messageCreate = (message: unknown) =>
    messageCreateEvent.execute(bot, message);

  // Lavalink voice events (using raw for exact payload structure)
  // deno-lint-ignore no-explicit-any
  events.raw = (data: any) => {
    if (data.t === "VOICE_STATE_UPDATE" || data.t === "VOICE_SERVER_UPDATE") {
      if (typeof (lavalink as any)?.sendRawData === "function") {
        (lavalink as any).sendRawData(data);
      } else {
        logger.debug(
          "lavalink.sendRawData is missing! Available keys: {keys}",
          {
            keys: Object.keys(lavalink || {}),
          },
        );
      }
    }
  };
}
