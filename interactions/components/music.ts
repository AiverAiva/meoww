import { InteractionResponseTypes } from "@discordeno/bot";
import { AnyBot } from "../../types.ts";
import { lavalink } from "../../utils/lavalink.ts";
import { logger } from "../../utils/logger.ts";
import {
  ComponentV2Type,
  IS_COMPONENTS_V2,
} from "../../utils/components_v2.ts";
import { createErrorCard, UI_COLORS } from "../../utils/ui_factory.ts";
import { createMusicSearchUI, createNowPlayingUI } from "../../utils/music_ui.ts";
import { npMessages } from "../../utils/lavalink.ts";

export async function handleMusicSearch(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  const customId = interaction.data?.customId; // music_search_source:query
  const source = interaction.data?.values?.[0] || "ytsearch"; // defaults to YouTube
  const query = customId.split(":")[1];

  if (!query) return;

  // Defer update
  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredUpdateMessage,
      },
    );
  } catch (error) {
    logger.debug("Failed to defer music search interaction: {error}", {
      error,
    });
  }

  try {
    // Search for tracks
    // deno-lint-ignore no-explicit-any
    const node = (lavalink as any).nodeManager.leastUsedNodes()[0];
    if (!node) {
      throw new Error("No Lavalink nodes available.");
    }
    const res = await node.search({
      query: `${source}:${query}`,
    });

    logger.debug("Search result for {query}: {count} tracks.", {
      query: `${source}:${query}`,
      count: res?.tracks?.length || 0,
    });

    const tracks = (res?.tracks || []).slice(0, 10);
    const errorMessage = res?.loadType === "error"
      ? (res.exception?.message || "Unknown Lavalink error")
      : undefined;

    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      flags: IS_COMPONENTS_V2,
      // deno-lint-ignore no-explicit-any
      components: createMusicSearchUI(
        query,
        source,
        tracks,
        errorMessage,
      ) as any,
    });
  } catch (error: any) {
    logger.error("Music search error: {error}", { error });

    let readableError = "An unexpected error occurred.";
    if (error instanceof SyntaxError) {
      readableError = `The ${source} search returned an invalid response (Node instability).`;
    } else if (error.name === "TimeoutError" || error.message?.includes("timed out")) {
      readableError = `The ${source} search timed out (Upstream API slow/down).`;
    } else if (error.message) {
      readableError = error.message;
    }

    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      flags: IS_COMPONENTS_V2,
      // deno-lint-ignore no-explicit-any
      components: [
        createErrorCard(`### ❌ Search Failed: ${source.toUpperCase()}\n${readableError}`),
      ] as any,
    });
  }
}

export async function handleMusicSelectTrack(
  bot: AnyBot,
  // deno-lint-ignore no-explicit-any
  interaction: any,
) {
  // In search result, we use value: "source:identifier"
  const value = interaction.data?.values?.[0]; // source:identifier
  if (!value) return;

  // Acknowledge the selection
  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredUpdateMessage,
      },
    );
  } catch (error) {
    logger.debug("Failed to defer music selection interaction: {error}", {
      error,
    });
  }

  try {
    // Search for the specific track
    logger.debug("Resolving selected track: {value}", { value });
    // deno-lint-ignore no-explicit-any
    const node = (lavalink as any).nodeManager.leastUsedNodes()[0];
    if (!node) throw new Error("No Lavalink nodes available.");

    const res = await node.search({ query: value });
    const track = res?.tracks?.[0];

    if (!track) {
      throw new Error("Could not resolve the selected track.");
    }

    // Get user's voice channel
    const guildId = interaction.guildId;
    const userId = interaction.user?.id || interaction.member?.user?.id;
    // deno-lint-ignore no-explicit-any
    const vs = await (bot.helpers as any).getUserVoiceState(
      guildId,
      userId,
    ).catch(() => null);

    if (!vs?.channelId) {
      throw new Error("You must be in a voice channel to play music.");
    }

    // Create or get player
    let player = lavalink.getPlayer(guildId.toString());

    if (!player) {
      player = lavalink.createPlayer({
        guildId: guildId.toString(),
        voiceChannelId: vs.channelId.toString(),
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

    // Save for real-time updates
    npMessages.set(guildId.toString(), {
      token: interaction.token,
      channelId: interaction.channelId.toString(),
    });

    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      flags: IS_COMPONENTS_V2,
      components: createNowPlayingUI(player, track) as any,
    });
  } catch (error) {
    logger.error("Track selection error: {error}", { error });
    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      flags: IS_COMPONENTS_V2,
      components: [
        createErrorCard("Failed to add the selected track to queue."),
      ] as any,
    });
  }
}
