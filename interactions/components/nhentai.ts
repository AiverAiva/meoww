import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getNHentaiFullViewer,
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

  const id = parts[2];
  const targetPage = parseInt(parts[3], 10) || 1;
  const buttonType = parts.length > 5 ? parts[5] : parts[4];

  logger.debug(
    "nHentai Interaction: ID {id}, Target {targetPage}, Btn {buttonType}",
    { id, targetPage, buttonType },
  );

  const isInitial = buttonType === "0";

  // Directly fetch viewer data without deferral for instant UI feedback
  const viewer = await getNHentaiFullViewer(id, targetPage);

  if (!viewer) {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          content: "❌ Critical error: Failed to initialize viewer.",
          flags: isInitial ? MessageFlags.Ephemeral : 0,
        },
      },
    );
  }

  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2 | (isInitial ? MessageFlags.Ephemeral : 0),
          components: formatPreviewComponents(
            viewer,
          ) as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  } catch (error) {
    logger.error("Failed to handle nHentai interaction: {error}", { error });
  }
}
