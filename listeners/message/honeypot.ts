import { MessageListener } from "../../types.ts";
import {
  isHoneypotChannel,
  incrementBanCount,
  getCounterMessageId,
} from "../../utils/honeypot_store.ts";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import { UI_COLORS } from "../../utils/ui_factory.ts";
import { logger } from "../../utils/logger.ts";

// Per-process dedup guard. Only effective for single-process bots.
const triggered = new Set<string>();

export const honeypotListener: MessageListener = {
  name: "honeypot",
  filter: async (rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    if (message.isBot) return false;
    if (message.webhookId) return false;
    return await isHoneypotChannel(message.channelId?.toString());
  },
  execute: async (bot, rawMessage) => {
    // deno-lint-ignore no-explicit-any
    const message = rawMessage as any;
    const guildId = message.guildId;
    const channelId = message.channelId;
    const userId = message.author?.id;

    if (!guildId || !channelId || !userId) return;

    const botId = bot.id.toString();
    if (userId.toString() === botId) return;

    // Race condition guard — skip if this user is already being processed
    const userIdStr = userId.toString();
    if (triggered.has(userIdStr)) return;
    triggered.add(userIdStr);

    try {
      logger.warn(
        "Honeypot triggered by {user} ({userId}) in guild {guild}",
        {
          user: message.author?.username ?? "Unknown",
          userId: userIdStr,
          guild: guildId.toString(),
        },
      );

      // 1. Try to DM the user before banning
      let guildName = "a server";
      try {
        const guild = await bot.helpers.getGuild(guildId);
        guildName = guild.name ?? "a server";
      } catch {
        // fallback
      }

      try {
        const dmChannel = await bot.helpers.getDmChannel(userId);
        await bot.helpers.sendMessage(dmChannel.id, {
          content:
            `You were automatically banned from **${guildName}** for sending a message in a honeypot channel.\n\n` +
            `If your account was compromised, contact the server staff to appeal.`,
        });
      } catch {
        logger.debug("Could not DM user {userId} (DMs may be disabled)", {
          userId: userIdStr,
        });
      }

      // 2. Ban the user (Discord natively deletes last 1 hour of messages)
      try {
        await bot.helpers.banMember(
          guildId,
          userId,
          { deleteMessageSeconds: 60 * 60 },
          "Honeypot triggered — possible compromised account",
        );
        logger.info(
          "Banned user {userId} ({user}) via honeypot in guild {guild}",
          {
            userId: userIdStr,
            user: message.author?.username ?? "Unknown",
            guild: guildId.toString(),
          },
        );

        // Update ban counter message
        try {
          const newCount = await incrementBanCount(guildId.toString());
          const counterMsgId = await getCounterMessageId(
            guildId.toString(),
          );
          if (counterMsgId) {
            await bot.helpers.editMessage(channelId, counterMsgId, {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [
                {
                  type: ComponentV2Type.Container,
                  accent_color: UI_COLORS.INFO,
                  components: [
                    {
                      type: ComponentV2Type.TextDisplay,
                      content:
                        `### 📊 Honeypot Ban Counter\n**${newCount}** account${newCount === 1 ? "" : "s"} banned so far.`,
                    },
                  ],
                },
              ] as any,
            });
          }
        } catch (counterError) {
          logger.debug(
            "Failed to update ban counter: {error}",
            { error: counterError },
          );
        }
      } catch (error) {
        logger.error("Failed to ban honeypot user {userId}: {error}", {
          userId: userIdStr,
          error,
        });
      }
    } finally {
      triggered.delete(userIdStr);
    }
  },
};
