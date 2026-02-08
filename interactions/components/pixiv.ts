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

  const parts = customId.split("_");
  const artworkId = parts[2];
  const pageIndex = parseInt(parts[3], 10);

  const preview = await getPixivPreview(
    `https://www.pixiv.net/artworks/${artworkId}`,
    pageIndex,
  );

  if (!preview) return;

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
