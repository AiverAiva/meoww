import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "../types.ts";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { getLatexPreview } from "../utils/previewers/latex.ts";
import { createContainer } from "../utils/ui_factory.ts";

export const latexCommand: Command = {
  name: "latex",
  description: "Render LaTeX as an image",
  type: ApplicationCommandTypes.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionTypes.String,
      name: "text",
      description: "LaTeX expression to render",
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
    const latex = interaction.data?.options?.[0]?.value as string;
    if (!latex) {
      return await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: "❌ No LaTeX expression provided." },
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

    const preview = await getLatexPreview(latex);

    if (!preview) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        { content: "❌ Failed to render LaTeX expression." },
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

export const latexMessageCommand: Command = {
  name: "Preview LaTeX",
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

    const { extractLatex } = await import("../utils/previewers/latex.ts");
    const expressions = extractLatex(content);

    if (expressions.length === 0) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        { content: "❌ No LaTeX expressions found in this message." },
      );
    }

    const preview = await getLatexPreview(expressions[0]);

    if (!preview) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        { content: "❌ Failed to render LaTeX expression." },
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
