import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { logger } from "../../utils/logger.ts";
import { handleNHentaiView } from "./nhentai.ts";
import { handleJMComicView } from "./jmcomic.ts";
import { handleWNACGView } from "./wnacg.ts";

/**
 * Handles generic ID-based preview interactions.
 * Custom ID Format: id_preview:SOURCE:ID
 */
export async function handleIdPreview(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  const customId = interaction.data?.customId;
  if (!customId) return;

  const [prefix, source, id] = customId.split(":");
  if (prefix !== "id_preview") return;

  logger.debug("ID Preview Interaction: Source {source}, ID {id}", {
    source,
    id,
  });

  switch (source) {
    case "nhentai":
      await handleNHentaiView(bot, interaction);
      break;
    case "jmcomic":
      await handleJMComicView(bot, interaction);
      break;
    case "wnacg":
      await handleWNACGView(bot, interaction);
      break;
    default:
      await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: {
            content: `❌ Unsupported preview source: \`${source}\``,
          },
        },
      );
  }
}
