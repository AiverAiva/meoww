import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getPixivPreview,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles Pixiv pagination button interactions.
 */
export async function handlePixivPagination(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  logger.debug("Pixiv pagination interaction: {customId}", { customId });

  const parts = customId.split("_");
  // Format: pixiv_v_artworkId_targetPage_currentPage_type
  const artworkId = parts[2];
  const type = parts[5]; // f, v, n, l

  let pageIndex = 0;
  if (type === "f") {
    pageIndex = 0;
  } else if (type === "l") {
    pageIndex = 999; // Handled by clamping in getPixivPreview
  } else {
    // For 'v' (prev) and 'n' (next), the target page is in parts[3]
    pageIndex = parseInt(parts[3], 10);
  }

  logger.debug("Pixiv pagination: artworkId={id}, type={type}, pageIndex={page}", {
    id: artworkId,
    type,
    page: pageIndex,
  });

  const preview = await getPixivPreview(
    `https://www.pixiv.net/artworks/${artworkId}`,
    pageIndex,
  );

  if (!preview) {
    logger.warn("Pixiv preview returned null for artwork {id}", { id: artworkId });
    return;
  }

  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          components: formatPreviewComponents({
            ...preview,
            color: preview.color ?? 0x0096FA,
          }) as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  } catch (error) {
    logger.error("Failed to update Pixiv pagination: {error}", { error });
  }
}
