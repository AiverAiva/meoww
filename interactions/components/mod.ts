import { AnyBot } from "../../types.ts";
import { handlePixivPagination } from "./pixiv.ts";
import { handleWNACGView } from "./wnacg.ts";
import { handleNHentaiView } from "./nhentai.ts";
import { handleJMComicView } from "./jmcomic.ts";
import { handleIdPreview } from "./id_preview.ts";
import { handleShare } from "./share.ts";

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
  } else if (customId.startsWith("nhentai_v_")) {
    await handleNHentaiView(bot, interaction);
  } else if (customId.startsWith("jmcomic_v_")) {
    await handleJMComicView(bot, interaction);
  } else if (customId.startsWith("id_preview:")) {
    await handleIdPreview(bot, interaction);
  } else if (customId.startsWith("share_p:")) {
    await handleShare(bot, interaction);
  }
}
