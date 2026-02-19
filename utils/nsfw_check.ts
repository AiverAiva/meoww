import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import { AnyBot } from "../types.ts";
import { logger } from "./logger.ts";
import { UI_COLORS } from "./ui_factory.ts";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "./components_v2.ts";

/**
 * Checks if a channel is safe for NSFW content.
 * NSFW content is allowed in:
 * 1. Direct Messages (DM) - where guildId is undefined.
 * 2. Channels explicitly marked as NSFW in a Guild.
 */
export async function isNSFWSafe(
  bot: AnyBot,
  channelId: bigint,
  guildId?: bigint,
): Promise<boolean> {
  // If no guildId or it is 0, it's a DM (or system channel)
  if (!guildId || guildId === BigInt(0) || guildId === 0n) {
    return true;
  }

  try {
    const channel = await bot.helpers.getChannel(channelId);
    return !!channel.nsfw;
  } catch (error) {
    logger.error("Failed to fetch channel for NSFW check: {error}", { error });
    // In case of error (e.g. channel not found/no access), we default to unsafe for server channels.
    return false;
  }
}

/**
 * Sends a standard error response when NSFW content is used in a non-NSFW channel.
 */
export async function sendNSFWError(
  bot: AnyBot,
  interaction: import("@discordeno/bot").Interaction,
) {
  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          flags: (MessageFlags.Ephemeral as number) | IS_COMPONENTS_V2,
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.ERROR,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    "### ❌ NSFW Content Detected\nThis content can only be displayed in **NSFW channels**.\nPlease send this in an NSFW channel.",
                },
              ],
            },
          ] as unknown as import("@discordeno/bot").ActionRow[],
        },
      },
    );
  } catch (error) {
    logger.error("Failed to send NSFW error response: {error}", { error });
  }
}

/**
 * Sends a standard error message when an NSFW link is detected in a non-NSFW channel via listener.
 */
export async function sendNSFWMessageError(
  bot: AnyBot,
  channelId: bigint,
  messageId: bigint,
) {
  try {
    await bot.helpers.sendMessage(channelId, {
      messageReference: {
        messageId,
        failIfNotExists: false,
      },
      allowedMentions: {
        repliedUser: false,
      },
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: ComponentV2Type.Container,
          accent_color: UI_COLORS.ERROR,
          components: [
            {
              type: ComponentV2Type.TextDisplay,
              content:
                "### ❌ NSFW Content Detected\nThis content is restricted to **NSFW channels**.\nPlease send this in an NSFW channel.",
            },
          ],
        },
      ] as unknown as import("@discordeno/bot").ActionRow[],
    });
  } catch (error) {
    logger.error("Failed to send NSFW message error: {error}", { error });
  }
}
