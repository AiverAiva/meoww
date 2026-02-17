import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import {
  formatPreviewComponents,
  getNHentaiPreview,
} from "../../utils/previewers/mod.ts";
import { IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";

/**
 * Handles 'Share Public' interaction.
 * Custom ID Format: share_p:SOURCE:ID
 */
export async function handleShare(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  const [_prefix, source, id] = customId.split(":");

  // In Discordeno v21, user might be in interaction.user or interaction.member.user
  const user = interaction.user || interaction.member?.user;
  let channelId = interaction.channelId || interaction.message?.channelId;

  // Sometimes it's a BigInt in the object but need to ensure it's handled as BigInt
  if (channelId) channelId = BigInt(channelId);

  logger.info(
    "Share Public triggered: Source {source}, ID {id} by {user} in channel {channel}",
    {
      source,
      id,
      user: user?.id,
      channel: channelId,
    },
  );

  if (!channelId) {
    logger.error("Cannot share: channelId is missing from interaction.", {
      interactionKeys: Object.keys(interaction),
      hasMessage: !!interaction.message,
    });
    return;
  }

  let preview = null;

  if (source === "nhentai") {
    preview = await getNHentaiPreview(`https://nhentai.net/g/${id}/`);
  }

  if (!preview) {
    return await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: "❌ Failed to fetch content for sharing.",
          flags: MessageFlags.Ephemeral,
        },
      },
    );
  }

  // Send a public message to the channel
  try {
    await bot.helpers.sendMessage(channelId, {
      flags: IS_COMPONENTS_V2,
      components: formatPreviewComponents(
        preview,
      ) as unknown as import("@discordeno/bot").ActionRow[],
    });

    // Acknowledge the interaction to avoid 'Interaction failed' on the user side
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredUpdateMessage,
      },
    );
  } catch (error) {
    logger.error("Failed to share publicly: {error}", { error });
  }
}
