import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getJMComicFullViewer,
  getJMComicPreview,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles JMComic 'View in Discord' and pagination interactions.
 * Custom ID Format: jmcomic_v_ID_TARGETPAGE_CURRENTPAGE_BUTTON
 */
export async function handleJMComicView(
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
    "JMComic Interaction: ID {id}, Target {targetPage}, Btn {buttonType}, Quick {isQuickPreview}",
    { id, targetPage, buttonType, isQuickPreview },
  );

  const data = isQuickPreview
    ? await getJMComicPreview(`https://18comic.vip/photo/${id}`)
    : await getJMComicFullViewer(id, targetPage);

  if (!data) {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          content: "❌ Critical error: Failed to fetch JMComic data.",
        },
      },
    );
  }

  try {
    const components = formatPreviewComponents(data);

    // Injecting share button is no longer needed as we're not using ephemeral

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
    logger.error("Failed to handle JMComic interaction: {error}", { error });
  }
}
