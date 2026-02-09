import { AnyBot } from "../../types.ts";
import { handlePixivPagination } from "./pixiv.ts";
import { handleWNACGView } from "./wnacg.ts";

/**
 * Entry point for all message component interactions.
 */
export async function handleComponentInteraction(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;

  if (!customId) return;

  if (customId.startsWith("pixiv_p_")) {
    await handlePixivPagination(bot, interaction);
  } else if (customId.startsWith("wnacg_v_")) {
    await handleWNACGView(bot, interaction);
  }
}
