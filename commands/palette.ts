import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "../types.ts";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { getPalettePreview } from "../utils/previewers/palette.ts";
import { createContainer } from "../utils/ui_factory.ts";

export const paletteCommand: Command = {
  name: "palette",
  description: "Generate a color palette from hex colors in text",
  type: ApplicationCommandTypes.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionTypes.String,
      name: "text",
      description: "Text containing hex color codes (e.g. #1E1829)",
      required: true,
    },
  ],
  integrationTypes: [
    DiscordApplicationIntegrationType.GuildInstall,
    DiscordApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    DiscordInteractionContextType.Guild,
    DiscordInteractionContextType.BotDm,
    DiscordInteractionContextType.PrivateChannel,
  ],
  execute: async (bot, interaction) => {
    const text = interaction.data?.options?.[0]?.value as string;
    if (!text) {
      return await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: "❌ No text provided." },
        },
      );
    }

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: {},
      },
    );

    const preview = getPalettePreview(text);

    if (!preview) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        { content: "❌ No hex colors found in the text." },
      );
    }

    const components = [createContainer(preview.components, preview.color)];

    await bot.helpers.editOriginalInteractionResponse(
      interaction.token,
      {
        flags: IS_COMPONENTS_V2,
        components:
          components as unknown as import("@discordeno/bot").ActionRow[],
        files: [preview.file],
      },
    );
  },
};

export const paletteMessageCommand: Command = {
  name: "Color Palette",
  description: "",
  type: ApplicationCommandTypes.Message,
  integrationTypes: [
    DiscordApplicationIntegrationType.GuildInstall,
    DiscordApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    DiscordInteractionContextType.Guild,
    DiscordInteractionContextType.BotDm,
    DiscordInteractionContextType.PrivateChannel,
  ],
  execute: async (bot, interaction) => {
    const message = interaction.data?.resolved?.messages?.values().next().value;
    const content = message?.content || "";

    if (!content) {
      return await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: "❌ No content found in this message." },
        },
      );
    }

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: {},
      },
    );

    const preview = getPalettePreview(content);

    if (!preview) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        { content: "❌ No hex colors found in this message." },
      );
    }

    const components = [createContainer(preview.components, preview.color)];

    await bot.helpers.editOriginalInteractionResponse(
      interaction.token,
      {
        flags: IS_COMPONENTS_V2,
        components:
          components as unknown as import("@discordeno/bot").ActionRow[],
        files: [preview.file],
      },
    );
  },
};
