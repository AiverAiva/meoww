import {
  ApplicationCommandTypes,
  InteractionResponseTypes,
  OverwriteTypes,
} from "@discordeno/bot";
import { Command } from "./mod.ts";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { createErrorCard, UI_COLORS } from "../utils/ui_factory.ts";
import { getHoneypotChannel, getBanCount } from "../utils/honeypot_store.ts";
import { logger } from "../utils/logger.ts";

const ADMINISTRATOR = 0x8n;
const BAN_MEMBERS = 0x4n;
const MANAGE_CHANNELS = 0x10n;
const MANAGE_MESSAGES = 0x2000n;

const REQUIRED_PERMS = [
  { flag: BAN_MEMBERS, name: "Ban Members" },
  { flag: MANAGE_CHANNELS, name: "Manage Channels" },
  { flag: MANAGE_MESSAGES, name: "Manage Messages" },
];

// deno-lint-ignore no-explicit-any
function ephemeralError(bot: any, interaction: any, message: string) {
  return bot.helpers.sendInteractionResponse(
    interaction.id,
    interaction.token,
    {
      type: InteractionResponseTypes.ChannelMessageWithSource,
      data: {
        flags: IS_COMPONENTS_V2 | 64,
        components: [createErrorCard(message)] as any,
      },
    },
  );
}

export const honeypotCommand: Command = {
  name: "honeypot",
  description: "Manage the honeypot anti-spam channel",
  type: ApplicationCommandTypes.ChatInput,
  integrationTypes: [0],
  defaultMemberPermissions: ["ADMINISTRATOR"],
  execute: async (bot, interaction) => {
    const guildId = interaction.guildId;
    if (!guildId) {
      return await ephemeralError(bot, interaction,
        "This command can only be used in a server.",
      );
    }

    // Check bot permissions first
    const botPerms: bigint = interaction.appPermissions ?? 0n;
    if ((botPerms & ADMINISTRATOR) === 0n) {
      const missing = REQUIRED_PERMS
        .filter((p) => (botPerms & p.flag) === 0n)
        .map((p) => `• ${p.name}`);

      if (missing.length > 0) {
        return await ephemeralError(bot, interaction,
          "The bot is missing the following permissions:\n\n" +
          missing.join("\n") + "\n\n" +
          "Please grant these permissions and try again.",
        );
      }
    }

    const memberPerms = interaction.member?.permissions;
    if (memberPerms) {
      const perms = typeof memberPerms === "bigint"
        ? memberPerms
        : BigInt(memberPerms);
      if ((perms & ADMINISTRATOR) === 0n) {
        return await ephemeralError(bot, interaction,
          "You need the **Administrator** permission to use this command.",
        );
      }
    }

    const existing = await getHoneypotChannel(guildId.toString());
    const banCount = existing ? await getBanCount(guildId.toString()) : 0;

    logger.debug("Honeypot command invoked in guild {guild}", {
      guild: guildId.toString(),
    });

    // deno-lint-ignore no-explicit-any
    const containerComponents: any[] = [];

    if (existing) {
      containerComponents.push(
        {
          type: ComponentV2Type.TextDisplay,
          content: "### 🍯 Honeypot Already Configured",
        },
        {
          type: ComponentV2Type.Separator,
        },
        {
          type: ComponentV2Type.TextDisplay,
          content:
            `Current honeypot channel: <#${existing}>\n\n` +
            `**Bans issued:** ${banCount}\n\n` +
            `Anyone who sends a message there is automatically banned and their recent messages purged.\n\n` +
            `What would you like to do?`,
        },
        {
          type: ComponentV2Type.ActionRow,
          components: [
            {
              type: ComponentV2Type.Button,
              style: 1,
              label: "Rebind Current Channel",
              custom_id: "honeypot_bind_current",
              emoji: { name: "🔗" },
            },
            {
              type: ComponentV2Type.Button,
              style: 2,
              label: "Create New One",
              custom_id: "honeypot_setup_new",
              emoji: { name: "✨" },
            },
            {
              type: ComponentV2Type.Button,
              style: 4,
              label: "Unbind / Disable",
              custom_id: "honeypot_unbind",
              emoji: { name: "🗑️" },
            },
          ],
        },
      );
    } else {
      containerComponents.push(
        {
          type: ComponentV2Type.TextDisplay,
          content: "### 🍯 Honeypot Channel Setup",
        },
        {
          type: ComponentV2Type.Separator,
        },
        {
          type: ComponentV2Type.TextDisplay,
          content:
            "A honeypot channel is a trap for compromised accounts. Anyone who sends a message in it will be **immediately banned** and their recent messages purged.\n\n" +
            "**No honeypot channel configured yet.**",
        },
        {
          type: ComponentV2Type.ActionRow,
          components: [
            {
              type: ComponentV2Type.Button,
              style: 1,
              label: "Bind Current Channel",
              custom_id: "honeypot_bind_current",
              emoji: { name: "🔗" },
            },
            {
              type: ComponentV2Type.Button,
              style: 2,
              label: "Setup One For Me",
              custom_id: "honeypot_setup_new",
              emoji: { name: "✨" },
            },
          ],
        },
      );
    }

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          flags: IS_COMPONENTS_V2 | 64,
          components: [
            {
              type: ComponentV2Type.Container,
              accent_color: existing ? UI_COLORS.WARNING : UI_COLORS.INFO,
              components: containerComponents,
            },
          ] as any,
        },
      },
    );
  },
};
