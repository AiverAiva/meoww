import {
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "../types.ts";
import {
  formatPreviewComponents,
  getAnyPreview,
  SUPPORTED_PLATFORMS,
} from "../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { createNoLinksFoundCard } from "../utils/ui_factory.ts";

export const previewCommand: Command = {
  name: "Preview Link",
  description: "", // Context menus don't have descriptions
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
    // Get the message content from the interaction data
    const message = interaction.data?.resolved?.messages?.values().next().value;
    const content = message?.content || "";

    if (!content) {
      return await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: {
            content: "❌ No content found in this message.",
          },
        },
      );
    }

    // Defer the response since fetching might take time
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: {},
      },
    );

    const preview = await getAnyPreview(content);

    if (!preview) {
      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [createNoLinksFoundCard(SUPPORTED_PLATFORMS)] as any,
        },
      );
    }

    const components = formatPreviewComponents(preview);

    await bot.helpers.editOriginalInteractionResponse(
      interaction.token,
      {
        flags: IS_COMPONENTS_V2,
        // deno-lint-ignore no-explicit-any
        components: components as any,
      },
    );
  },
};
