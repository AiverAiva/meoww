import {
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
  MessageFlags,
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
    // Making it ephemeral as requested.
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: {
          flags: MessageFlags.Ephemeral,
        },
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
            flags: IS_COMPONENTS_V2 | MessageFlags.Ephemeral,
            // deno-lint-ignore no-explicit-any
            components: [createSourceSelectionCard(id)] as any,
          },
        );
      }

      return await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        {
          flags: IS_COMPONENTS_V2 | MessageFlags.Ephemeral,
          // deno-lint-ignore no-explicit-any
          components: [createNoLinksFoundCard(SUPPORTED_PLATFORMS)] as any,
        },
      );
    }

    const components = formatPreviewComponents(preview) as any;

    // Inject share button for nhentai if it's an ephemeral preview
    if (content.includes("nhentai.net/g/")) {
      try {
        const id = content.match(/nhentai\.net\/g\/(\d+)/)?.[1];
        if (id) {
          const container = components[0];
          if (container && container.components) {
            const actionRow = container.components.find((c: any) =>
              c.type === 1 && c.components && c.components.length < 5
            );
            if (actionRow) {
              actionRow.components.push({
                type: 2,
                style: 2,
                label: "📤 Share Public",
                custom_id: `share_p:nhentai:${id}`,
              });
            }
          }
        }
      } catch (e) {
        logger.debug("Failed to inject share button in preview command: {e}", {
          e,
        });
      }
    }

    await bot.helpers.editOriginalInteractionResponse(
      interaction.token,
      {
        flags: IS_COMPONENTS_V2 | MessageFlags.Ephemeral,
        // deno-lint-ignore no-explicit-any
        components: components as any,
      },
    );
  },
};
