import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getWNACGFullViewer,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles WNACG 'View in Discord' button and pagination interactions.
 * New Custom ID Format: wnacg_v_AID_VIEWID_TARGET
 */
export async function handleWNACGView(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  const parts = customId.split("_");
  // parts[0] = wnacg, parts[1] = v, parts[2] = AID, parts[3] = VIEWID, parts[4] = TARGET
  const aid = parts[2];
  const viewId = parts[3];
  const target = parts[4];

  logger.debug(
    "WNACG Interaction: AID {aid}, ViewID {viewId}, Target {target}",
    {
      aid,
      viewId,
      target,
    },
  );

  const isInitial = target === "0";

  if (!viewId || viewId === "none") {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: isInitial
          ? InteractionResponseTypes.ChannelMessageWithSource
          : InteractionResponseTypes.UpdateMessage,
        data: {
          content:
            "❌ Invalid session. Please try clicking the original link again.",
          flags: isInitial ? MessageFlags.Ephemeral : 0,
        },
      },
    );
  }

  const viewer = await getWNACGFullViewer(aid, viewId);

  // Since getWNACGFullViewer now handles internal errors and returns an error card,
  // we only need to check if it returned anything at all.
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
    logger.error("Failed to handle WNACG interaction: {error}", { error });
  }
}
