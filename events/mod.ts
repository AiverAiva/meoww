import { AnyBot } from "../types.ts";
import { readyEvent } from "./ready.ts";
import { interactionCreateEvent } from "./interactionCreate.ts";
import { messageCreateEvent } from "./messageCreate.ts";

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
}
