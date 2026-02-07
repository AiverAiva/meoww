import {
  ApplicationCommandTypes,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "./mod.ts";

export const pingCommand: Command = {
  name: "ping",
  description: "Replies with Pong!",
  type: ApplicationCommandTypes.ChatInput,
  execute: async (bot, interaction) => {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: "Pong!",
        },
      },
    );
  },
};
