import {
  ApplicationCommandTypes,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "./mod.ts";
import { logger } from "../utils/logger.ts";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "../utils/components_v2.ts";

export const pingCommand: Command = {
  name: "ping",
  description: "Replies with Pong! (Components V2)",
  type: ApplicationCommandTypes.ChatInput,
  execute: async (bot, interaction) => {
    logger.debug("Sending Pong response (V2) to {user}", {
      user: interaction.user?.username ?? interaction.member?.user?.username ??
        "Unknown",
    });

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          flags: IS_COMPONENTS_V2,
          components: [
            {
              type: ComponentV2Type.Container,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content: "🏓 Pong!",
                },
              ],
            },
          ] as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  },
};
