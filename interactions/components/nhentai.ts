import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getNHentaiFullViewer,
  getNHentaiPreview,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles nHentai 'View in Discord' and pagination interactions.
 * Custom ID Format: nhentai_v_ID_TARGETPAGE_CURRENTPAGE_BUTTON
 */
export async function handleNHentaiView(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  const parts = customId.split("_");
  const idParts = customId.split(":");

  const id = idParts.length > 2 ? idParts[2] : parts[2];
  const targetPage = parseInt(parts[3], 10) || 1;
  const buttonType = parts.length > 5 ? parts[5] : parts[4];

  const isInitial = buttonType === "0";
  const isQuickPreview = customId.startsWith("id_preview:");

  logger.debug(
    "nHentai Interaction: ID {id}, Target {targetPage}, Btn {buttonType}, Quick {isQuickPreview}",
    { id, targetPage, buttonType, isQuickPreview },
  );

  // If it's a quick preview (from 6-digit detection), we fetch the gallery preview
  const data = isQuickPreview
    ? await getNHentaiPreview(`https://nhentai.net/g/${id}/`)
    : await getNHentaiFullViewer(id, targetPage);

  if (!data) {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          content: "❌ Critical error: Failed to fetch nHentai data.",
        },
      },
    );
  }

  try {
    const components = formatPreviewComponents(data);

    // Only inject 'Share Public' for the initial Quick Preview card.
    // We skip 'isInitial' (View in Discord) because the viewer already has 5 buttons.
    // Injecting share button is no longer needed as we're not using ephemeral

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          components:
            components as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  } catch (error) {
    logger.error("Failed to handle nHentai interaction: {error}", { error });
  }
}
