import { AnyBot } from "../../types.ts";
import { handlePixivPagination } from "./pixiv.ts";
import { handleWNACGView } from "./wnacg.ts";
import { handleNHentaiView } from "./nhentai.ts";
import { handleJMComicView } from "./jmcomic.ts";
import { handleIdPreview } from "./id_preview.ts";
import { handleMusicSearch, handleMusicSelectTrack } from "./music.ts";
import {
  handleHoneypotBindCurrent,
  handleHoneypotSetupNew,
  handleHoneypotUnbind,
  handleHoneypotDeleteChannel,
  handleHoneypotKeepChannel,
} from "./honeypot.ts";

/**
 * Entry point for all message component interactions.
 */
export async function handleComponentInteraction(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;

  if (!customId) return;

  if (customId.startsWith("pixiv_v_")) {
    await handlePixivPagination(bot, interaction);
  } else if (customId.startsWith("wnacg_v_")) {
    await handleWNACGView(bot, interaction);
  } else if (customId.startsWith("nhentai_v_")) {
    await handleNHentaiView(bot, interaction);
  } else if (customId.startsWith("jmcomic_v_")) {
    await handleJMComicView(bot, interaction);
  } else if (customId.startsWith("id_preview:")) {
    await handleIdPreview(bot, interaction);
  } else if (customId.startsWith("music_search_source:")) {
    await handleMusicSearch(bot, interaction);
  } else if (customId === "music_select_track") {
    await handleMusicSelectTrack(bot, interaction);
  } else if (customId === "honeypot_bind_current") {
    await handleHoneypotBindCurrent(bot, interaction);
  } else if (customId === "honeypot_setup_new") {
    await handleHoneypotSetupNew(bot, interaction);
  } else if (customId === "honeypot_unbind") {
    await handleHoneypotUnbind(bot, interaction);
  } else if (customId.startsWith("honeypot_delete_ch:")) {
    await handleHoneypotDeleteChannel(bot, interaction);
  } else if (customId.startsWith("honeypot_keep_ch:")) {
    await handleHoneypotKeepChannel(bot, interaction);
  }
}
