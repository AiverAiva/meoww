import { InteractionTypes } from "@discordeno/bot";
import { Event } from "../types.ts";
import { handleComponentInteraction } from "../interactions/components/mod.ts";
import { handleCommandInteraction } from "../interactions/commands.ts";

export const interactionCreateEvent: Event = {
  name: "interactionCreate",
  execute: async (bot, rawInteraction) => {
    // deno-lint-ignore no-explicit-any
    const interaction = rawInteraction as any;

    // Dispatch based on interaction type
    switch (interaction.type) {
      case InteractionTypes.ApplicationCommand:
        await handleCommandInteraction(bot, interaction);
        break;
      case InteractionTypes.MessageComponent:
        await handleComponentInteraction(bot, interaction);
        break;
    }
  },
};
