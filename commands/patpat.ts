import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
  iconBigintToHash,
} from "@discordeno/bot";
import { Command } from "../types.ts";
import { generatePatpatGif } from "../utils/gif/patpat_generator.ts";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

export const patpatCommand: Command = {
  name: "patpat",
  description: "Patpat someone! 🐾",
  type: ApplicationCommandTypes.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionTypes.User,
      name: "user",
      description: "The user to patpat",
      required: false,
    },
  ],
  integrationTypes: [
    DiscordApplicationIntegrationType.GuildInstall,
    DiscordApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    DiscordInteractionContextType.Guild,
    DiscordInteractionContextType.BotDm,
    DiscordInteractionContextType.PrivateChannel,
  ],
  execute: async (bot, interaction) => {
    // Determine target user
    let targetUser = interaction.data?.resolved?.users?.values().next().value;
    
    // If not found (e.g. Slash Command option), check options
    if (!targetUser && interaction.data?.options?.[0]) {
        const userId = interaction.data.options[0].value as string;
        targetUser = interaction.data.resolved?.users?.get(userId);
    }

    // Default to self if no user targeted
    if (!targetUser) {
        targetUser = interaction.user || interaction.member?.user;
    }

    if (!targetUser) return;

    // Defer response
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
      },
    );

    try {
      // Get avatar URL (PNG 256)
      const avatarBigint = targetUser.avatar;
      const avatarHash = avatarBigint ? iconBigintToHash(avatarBigint) : undefined;
      
      let avatarUrl: string;
      if (avatarHash) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${targetUser.id}/${avatarHash}.png?size=256`;
      } else {
        const index = targetUser.discriminator === "0" || !targetUser.discriminator
          ? Number((BigInt(targetUser.id) >> 22n) % 6n)
          : Number(targetUser.discriminator) % 5;
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
      }

      logger.debug("Patpat: Target {user} ({id}), AvatarHash: {hash}, URL: {url}", {
        user: targetUser.username,
        id: targetUser.id,
        hash: avatarHash ?? "none",
        url: avatarUrl
      });

      // Download avatar
      const resp = await fetch(avatarUrl);
      if (!resp.ok) throw new Error(`Failed to download avatar: ${resp.statusText}`);
      const avatarBuffer = new Uint8Array(await resp.arrayBuffer());

      // Generate GIF
      const assetDir = join(Deno.cwd(), "assets", "patpat");
      const gif = await generatePatpatGif(avatarBuffer, assetDir);

      // Send response
      await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        {
          content: `<@${interaction.user?.id ?? interaction.member?.user?.id}> patpat'ed <@${targetUser.id}> 🐾`,
          files: [
            {
              blob: new Blob([gif as Uint8Array], { type: "image/gif" }),
              name: "patpat.gif",
            },
          ],
        },
      );
    } catch (error) {
      logger.error("Error in patpat command: {error}", { error });
      await bot.helpers.editOriginalInteractionResponse(
        interaction.token,
        {
          content: "❌ An error occurred while generating the patpat GIF.",
        },
      );
    }
  },
};

// Also export as Context Menus
export const patpatUserCommand: Command = {
  ...patpatCommand,
  name: "patpat",
  description: "", // Context menus don't have descriptions
  type: ApplicationCommandTypes.User,
  options: undefined,
};

export const patpatMessageCommand: Command = {
  ...patpatCommand,
  name: "patpat",
  description: "",
  type: ApplicationCommandTypes.Message,
  options: undefined,
  execute: (bot, interaction) => {
    // Get target message author
    const message = interaction.data?.resolved?.messages?.values().next().value;
    if (!message) return;
    
    // Inject the target user from the message author
    interaction.data.resolved.users = new Map([[message.authorId, message.author]]);
    interaction.data.options = [{ value: message.authorId }];
    
    return patpatCommand.execute(bot, interaction);
  }
};
