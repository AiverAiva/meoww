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
import { logger } from "../utils/logger.ts";
import {
  createNoLinksFoundCard,
  createSourceSelectionCard,
} from "../utils/ui_factory.ts";

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

    // Defer the response since fetching might take time.
    // Making it public as requested.
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
      logger.debug("No link preview found for: {content}", { content });
      // Check for exactly 6 digits anywhere in the message.
      const digitMatch = content.match(/(\d{6})/);

      if (digitMatch) {
        const id = digitMatch[1];
        return await bot.helpers.editOriginalInteractionResponse(
          interaction.token,
          {
            flags: IS_COMPONENTS_V2,
            // deno-lint-ignore no-explicit-any
            components: [createSourceSelectionCard(id)] as any,
          },
        );
      }

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

    // Injection of share button is no longer needed since we are not using ephemeral previews

    await bot.helpers.editOriginalInteractionResponse(
      interaction.token,
      {
        flags: IS_COMPONENTS_V2,
        components:
          components as unknown as import("@discordeno/bot").ActionRow[],
      },
    );
  },
};
