import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getWNACGFullViewer,
  getWNACGPreview,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles WNACG 'View in Discord' button and pagination interactions.
 * Custom ID Format: wnacg_v_AID_PAGE_CURRENTPAGE_TYPE
 */
export async function handleWNACGView(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  const parts = customId.split("_");
  const idParts = customId.split(":");

  const id = idParts.length > 2 ? idParts[2] : parts[2];
  let targetPage = parseInt(parts[3], 10) || 1;

  // Handle StringSelect values for "Jump to page"
  if (interaction.data?.values && interaction.data.values.length > 0) {
    targetPage = parseInt(interaction.data.values[0], 10);
  }

  const buttonType = parts.length > 5 ? parts[5] : parts[4];

  const isInitial = buttonType === "0";
  const isQuickPreview = customId.startsWith("id_preview:");

  logger.debug(
    "WNACG Interaction: ID {id}, Target {targetPage}, Btn {buttonType}, Quick {isQuickPreview}",
    { id, targetPage, buttonType, isQuickPreview },
  );

  // If it's a quick preview (from 6-digit detection), we fetch the gallery preview
  const data = isQuickPreview
    ? await getWNACGPreview(`https://www.wnacg.com/photos-index-aid-${id}.html`)
    : await getWNACGFullViewer(id, targetPage);

  if (!data) {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          content: "❌ Critical error: Failed to fetch WNACG data.",
        },
      },
    );
  }

  try {
    const components = formatPreviewComponents(data);
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2 | (isInitial ? 64 : 0),
          components:
            components as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  } catch (error) {
    logger.error("Failed to handle WNACG interaction: {error}", { error });
  }
}
