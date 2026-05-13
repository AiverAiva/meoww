import { AnyBot } from "../../types.ts";
import {
  InteractionResponseTypes,
  OverwriteTypes,
  type OverwriteReadable,
} from "@discordeno/bot";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "../../utils/components_v2.ts";
import { UI_COLORS } from "../../utils/ui_factory.ts";
import {
  getHoneypotChannel,
  setHoneypotChannel,
  removeHoneypotChannel,
  setCounterMessageId,
} from "../../utils/honeypot_store.ts";
import { logger } from "../../utils/logger.ts";

const HONEYPOT_WARNING =
  `### ⚠️ DO NOT SEND MESSAGES IN THIS CHANNEL ⚠️\n\n` +
  `This channel is a honeypot trap. **Any message sent here will result in an immediate ban.**\n\n` +
  `If your account was compromised and a message was sent here automatically — contact server staff to appeal.\n\n` +
  `All messages from compromised accounts are automatically purged to keep this server safe.`;

function getPermissionOverwrites(guildId: bigint): OverwriteReadable[] {
  return [
    {
      id: guildId,
      type: OverwriteTypes.Role,
      allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"],
    },
  ];
}

async function sendWarningMessage(bot: AnyBot, channelId: bigint) {
  await bot.helpers.sendMessage(channelId, {
    flags: IS_COMPONENTS_V2,
    // deno-lint-ignore no-explicit-any
    components: [
      {
        type: ComponentV2Type.Container,
        accent_color: UI_COLORS.ERROR,
        components: [
          {
            type: ComponentV2Type.TextDisplay,
            content: HONEYPOT_WARNING,
          },
        ],
      },
    ] as any,
  });
}

async function sendCounterMessage(bot: AnyBot, channelId: bigint) {
  const msg = await bot.helpers.sendMessage(channelId, {
    flags: IS_COMPONENTS_V2,
    // deno-lint-ignore no-explicit-any
    components: [
      {
        type: ComponentV2Type.Container,
        accent_color: UI_COLORS.INFO,
        components: [
          {
            type: ComponentV2Type.TextDisplay,
            content: "### 📊 Honeypot Ban Counter\n**0** accounts banned so far.",
          },
        ],
      },
    ] as any,
  });
  return msg.id;
}

async function sendDeletePrompt(
  bot: AnyBot,
  interactionToken: string,
  oldChannelId: string,
) {
  await bot.helpers.sendFollowupMessage(interactionToken, {
    flags: IS_COMPONENTS_V2 | 64,
    // deno-lint-ignore no-explicit-any
    components: [
      {
        type: ComponentV2Type.Container,
        accent_color: UI_COLORS.WARNING,
        components: [
          {
            type: ComponentV2Type.TextDisplay,
            content:
              `### 🗑️ Delete the old honeypot channel?\n` +
              `The previous honeypot channel <#${oldChannelId}> is no longer active.\n` +
              `Would you like to delete it?`,
          },
          {
            type: ComponentV2Type.ActionRow,
            components: [
              {
                type: ComponentV2Type.Button,
                style: 4,
                label: "Yes, delete it",
                custom_id: `honeypot_delete_ch:${oldChannelId}`,
                emoji: { name: "🗑️" },
              },
              {
                type: ComponentV2Type.Button,
                style: 2,
                label: "No, keep it",
                custom_id: `honeypot_keep_ch:${oldChannelId}`,
              },
            ],
          },
        ],
      },
    ] as any,
  });
}

export async function handleHoneypotBindCurrent(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!guildId || !channelId) return;

  const oldChannelId = await getHoneypotChannel(guildId.toString());

  try {
    await bot.helpers.editChannel(channelId, {
      permissionOverwrites: getPermissionOverwrites(guildId),
    });

    await setHoneypotChannel(guildId.toString(), channelId.toString());

    await sendWarningMessage(bot, channelId);

    const counterMsgId = await sendCounterMessage(bot, channelId);
    await setCounterMessageId(guildId.toString(), counterMsgId.toString());

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.SUCCESS,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    `### ✅ Honeypot Channel Bound\nBound <#${channelId}> as the honeypot channel. Anyone who sends a message here will be automatically banned.`,
                },
              ],
            },
          ] as any,
        },
      },
    );

    if (oldChannelId && oldChannelId !== channelId.toString()) {
      await sendDeletePrompt(bot, interaction.token, oldChannelId);
    }
  } catch (error) {
    logger.error("Honeypot bind current failed: {error}", { error });
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.ERROR,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    "### ❌ Failed to bind channel\nMake sure the bot has **Manage Channels** permission.",
                },
              ],
            },
          ] as any,
        },
      },
    );
  }
}

export async function handleHoneypotSetupNew(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const oldChannelId = await getHoneypotChannel(guildId.toString());

  try {
    const newChannel = await bot.helpers.createChannel(guildId, {
      name: "⚠️-do-not-type-here",
      permissionOverwrites: getPermissionOverwrites(guildId),
    });

    // deno-lint-ignore no-explicit-any
    const newChannelId = newChannel.id as any as bigint;

    await setHoneypotChannel(guildId.toString(), newChannelId.toString());

    await sendWarningMessage(bot, newChannelId);

    const counterMsgId = await sendCounterMessage(bot, newChannelId);
    await setCounterMessageId(guildId.toString(), counterMsgId.toString());

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.SUCCESS,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    `### ✅ Honeypot Channel Created\nCreated and bound <#${newChannelId}> as the honeypot channel. Anyone who sends a message there will be automatically banned.`,
                },
              ],
            },
          ] as any,
        },
      },
    );

    if (oldChannelId && oldChannelId !== newChannelId.toString()) {
      await sendDeletePrompt(bot, interaction.token, oldChannelId);
    }
  } catch (error) {
    logger.error("Honeypot setup new failed: {error}", { error });
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.ERROR,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    "### ❌ Failed to create channel\nMake sure the bot has **Manage Channels** permission.",
                },
              ],
            },
          ] as any,
        },
      },
    );
  }
}

export async function handleHoneypotUnbind(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const oldChannelId = await getHoneypotChannel(guildId.toString());

  await removeHoneypotChannel(guildId.toString());

  await bot.helpers.sendInteractionResponse(
    interaction.id,
    interaction.token,
    {
      type: InteractionResponseTypes.UpdateMessage,
      data: {
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
                  "### 🗑️ Honeypot Unbound\nThe honeypot channel has been disabled. No more auto-bans will occur.",
              },
            ],
          },
        ] as any,
      },
    },
  );

  if (oldChannelId) {
    await sendDeletePrompt(bot, interaction.token, oldChannelId);
  }
}

export async function handleHoneypotDeleteChannel(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  const customId: string = interaction.data?.customId ?? "";
  const channelId = customId.split(":")[1];
  if (!channelId) return;

  try {
    await bot.helpers.deleteChannel(channelId, "Honeypot channel cleanup");

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.SUCCESS,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content: "### ✅ Channel Deleted\nThe old honeypot channel has been deleted.",
                },
              ],
            },
          ] as any,
        },
      },
    );
  } catch {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.UpdateMessage,
        data: {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: UI_COLORS.WARNING,
              components: [
                {
                  type: ComponentV2Type.TextDisplay,
                  content:
                    "### ⚠️ Channel Already Deleted\nThe channel may have already been removed.",
                },
              ],
            },
          ] as any,
        },
      },
    );
  }
}

export async function handleHoneypotKeepChannel(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  await bot.helpers.sendInteractionResponse(
    interaction.id,
    interaction.token,
    {
      type: InteractionResponseTypes.UpdateMessage,
      data: {
        flags: IS_COMPONENTS_V2,
        // deno-lint-ignore no-explicit-any
        components: [
          {
            type: ComponentV2Type.Container,
            accent_color: UI_COLORS.INFO,
            components: [
              {
                type: ComponentV2Type.TextDisplay,
                content: "### 👍 Okay\nThe old honeypot channel has been kept.",
              },
            ],
          },
        ] as any,
      },
    },
  );
}
