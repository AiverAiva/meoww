import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { Command } from "../types.ts";
import { lavalink } from "../utils/lavalink.ts";
import { logger } from "../utils/logger.ts";
import { ComponentV2Type, IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { createErrorCard, UI_COLORS } from "../utils/ui_factory.ts";

import { createMusicSearchUI } from "../utils/music_ui.ts";

export const musicCommand: Command = {
  name: "music",
  description: "Music related commands",
  type: ApplicationCommandTypes.ChatInput,
  options: [
    {
      type: ApplicationCommandOptionTypes.SubCommand,
      name: "play",
      description: "Play music from a URL or search query",
      options: [
        {
          type: ApplicationCommandOptionTypes.String,
          name: "query",
          description: "The song name or URL",
          required: true,
        },
      ],
    },
    {
      type: ApplicationCommandOptionTypes.SubCommand,
      name: "skip",
      description: "Skip the current song",
    },
  ],
  execute: async (bot, interaction) => {
    const subCommand = interaction.data?.options?.[0];
    if (subCommand?.name === "play") {
      const query = subCommand.options?.[0]?.value as string;

      // Check if user is in a voice channel
      const guildId = interaction.guildId;
      if (!guildId) {
        return await bot.helpers.sendInteractionResponse(
          interaction.id,
          interaction.token,
          {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [
                createErrorCard("This command can only be used in a server."),
              ] as any,
            },
          },
        );
      }

      // Check if user is in a voice channel
      const userId = interaction.user?.id || interaction.member?.user?.id;
      let channelId: bigint | undefined;

      try {
        // Fetch via helper (robust)
        // deno-lint-ignore no-explicit-any
        const vs = await (bot.helpers as any).getUserVoiceState(
          guildId,
          userId,
        ).catch((e: any) => {
          // 10065 is Unknown Voice State (user not in voice)
          if (e.status === 404 || e.code === 10065) return null;
          throw e;
        });

        channelId = vs?.channelId;
        logger.debug("Voice check: {channelId}", {
          channelId: channelId?.toString(),
        });
      } catch (e) {
        logger.debug("Voice check failed: {e}", { e });
      }

      if (!channelId) {
        return await bot.helpers.sendInteractionResponse(
          interaction.id,
          interaction.token,
          {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [
                createErrorCard(
                  "Please join a voice channel to use this command.",
                ),
              ] as any,
            },
          },
        );
      }

      // Defer response
      await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.DeferredChannelMessageWithSource,
          data: {},
        },
      );

      try {
        // Check if it's a URL
        const isUrl = /^https?:\/\//.test(query);

        if (isUrl) {
          // deno-lint-ignore no-explicit-any
          const node = (lavalink as any).nodeManager.leastUsedNodes()[0];
          if (!node) {
            throw new Error("No Lavalink nodes available.");
          }
          const res = await node.search({ query: query });
          if (!res || !res.tracks.length) {
            return await bot.helpers.editOriginalInteractionResponse(
              interaction.token,
              {
                flags: IS_COMPONENTS_V2,
                // deno-lint-ignore no-explicit-any
                components: [
                  createErrorCard("No tracks found for that URL."),
                ] as any,
              },
            );
          }

          const track = res.tracks[0];

          // Create or get player
          let player = lavalink.getPlayer(guildId.toString());

          if (!player) {
            player = lavalink.createPlayer({
              guildId: guildId.toString(),
              voiceChannelId: channelId.toString(),
              textChannelId: (interaction.channelId as bigint).toString(),
              selfDeaf: true,
              selfMute: false,
              volume: 75,
            });
          }

          // Ensure connected
          if (!player.connected) {
            await player.connect();
          }

          // Add and play
          await player.queue.add(track);
          if (!player.playing && !player.paused) {
            await player.play();
          }

          return await bot.helpers.editOriginalInteractionResponse(
            interaction.token,
            {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [{
                type: ComponentV2Type.Container,
                accent_color: UI_COLORS.SUCCESS,
                components: [
                  {
                    type: ComponentV2Type.TextDisplay,
                    content:
                      `🎶 Playing now: **${track.info.title}**\nChannel: <#${channelId}>`,
                  },
                ],
              }] as any,
            },
          );
        } else {
          // Search query - Show results immediately (default YouTube)
          const source = "ytsearch";
          // deno-lint-ignore no-explicit-any
          const node = (lavalink as any).nodeManager.leastUsedNodes()[0];
          if (!node) {
            throw new Error("No Lavalink nodes available.");
          }

          const res = await node.search({
            query: `${source}:${query}`,
          });

          logger.debug("Initial search result for {query}: {count} tracks.", {
            query: `${source}:${query}`,
            count: res?.tracks?.length || 0,
          });

          const tracks = (res?.tracks || []).slice(0, 10);
          const errorMessage = res?.loadType === "error"
            ? (res.exception?.message || "Unknown Lavalink error")
            : undefined;

          return await bot.helpers.editOriginalInteractionResponse(
            interaction.token,
            {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: createMusicSearchUI(
                query,
                source,
                tracks,
                errorMessage,
              ) as any,
            },
          );
        }
      } catch (error) {
        logger.error("Music command error: {error}", { error });
        await bot.helpers.editOriginalInteractionResponse(interaction.token, {
          flags: IS_COMPONENTS_V2,
          // deno-lint-ignore no-explicit-any
          components: [
            createErrorCard("An error occurred while processing your request."),
          ] as any,
        });
      }
    }

    if (subCommand?.name === "skip") {
      const guildId = interaction.guildId;
      if (!guildId) {
        return await bot.helpers.sendInteractionResponse(
          interaction.id,
          interaction.token,
          {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [
                createErrorCard("This command can only be used in a server."),
              ] as any,
            },
          },
        );
      }

      const player = lavalink.getPlayer(guildId.toString());
      if (!player || !player.queue.current) {
        return await bot.helpers.sendInteractionResponse(
          interaction.id,
          interaction.token,
          {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
              flags: IS_COMPONENTS_V2,
              // deno-lint-ignore no-explicit-any
              components: [
                createErrorCard("There is nothing playing right now."),
              ] as any,
            },
          },
        );
      }

      const isLastSong = player.queue.tracks.length === 0;
      if (!isLastSong) {
        await player.skip();
      } else {
        await player.stop();
      }

      return await bot.helpers.sendInteractionResponse(
        interaction.id,
        interaction.token,
        {
          type: InteractionResponseTypes.ChannelMessageWithSource,
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
                    content: isLastSong
                      ? "⏹️ **Stopped the music (end of queue).**"
                      : "⏭️ **Skipped the current song.**",
                  },
                ],
              },
            ] as any,
          },
        },
      );
    }
  },
};
