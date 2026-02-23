import { LavalinkManager } from "lavalink-client";
import { AnyBot } from "../types.ts";
import { logger } from "./logger.ts";

export let lavalink: LavalinkManager;

export async function initLavalink(bot: AnyBot) {
  const urlStr = (Deno.env.get("LAVALINK_HOST") || "http://localhost:2333")
    .trim();
  const password = (Deno.env.get("LAVALINK_PASSWORD") || "youshallnotpass")
    .trim();

  const url = new URL(urlStr);

  lavalink = new LavalinkManager({
    nodes: [
      {
        authorization: password,
        host: url.hostname,
        port: url.port
          ? parseInt(url.port)
          : (url.protocol === "https:" ? 443 : 2333),
        secure: url.protocol === "https:",
        id: "main-node",
      },
    ],
    sendToShard: (guildId, payload) => {
      // Discordeno gateway send
      // guildId is string from lavalink-client, need to convert to bigint for shard detection if multi-shard
      // bot.gateway.sendPayload usually takes the shardId if we want to be specific,
      // but DD often handles it if we use the helper.
      // Actually bot.gateway.calculateShardId(guildId)
      const shardId = bot.gateway.calculateShardId(BigInt(guildId));
      bot.gateway.shards.get(shardId)?.send(payload);
    },
    client: {
      id: bot.id.toString(),
      username: "Meoww",
    },
    userId: bot.id.toString(),
    playerOptions: {
      onEmptyQueue: {
        destroyAfterMs: 60000,
      },
      onDisconnect: {
        destroyPlayer: true,
      },
    },
  });

  // deno-lint-ignore no-explicit-any
  lavalink.nodeManager.on("connect", (node: any) => {
    logger.info("Lavalink node {id} connected. Host: {host}", {
      id: node.id,
      host: node.options.host,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.nodeManager.on("disconnect", (node: any, reason: any) => {
    logger.warn("Lavalink node {id} disconnected. Reason: {reason}", {
      id: node.id,
      reason,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.nodeManager.on("error", (node: any, error: any) => {
    logger.error("Lavalink node {id} error: {error}", {
      id: node.id,
      error: error.message || error,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.on("queueEnd", (player: any) => {
    logger.info("Queue ended in {guildId}", {
      guildId: player.guildId,
    });
    // The playerOptions.onEmptyQueue.destroyAfterMs handles this automatically.
  });

  // Track people joining/leaving to handle "alone" state
  const aloneTimers = new Map<string, number>();

  // deno-lint-ignore no-explicit-any
  lavalink.on("playerVoiceLeave", async (player: any, userId: any) => {
    logger.debug("User {userId} left voice in {guildId}", { userId, guildId: player.guildId });
    
    // Check if bot is alone
    // Note: lavalink-client v2 version of "alone" detection
    // We can use the bot gateway to check channel members or 
    // simply trust the player's internal state if it has it.
    // In Discordeno, we might need to fetch the guild to be sure.
    
    try {
      const guild = await bot.helpers.getGuild(BigInt(player.guildId));
      const voiceStates = guild.voiceStates; // Map<userId, VoiceState>
      
      const membersInChannel = Array.from(voiceStates.values()).filter(
        (vs) => vs.channelId?.toString() === player.voiceChannelId
      );

      // If only the bot (or no one) is left
      // Sometimes the bot isn't in voiceStates if it's not cached, but we check length
      // Bots usually count as 1. If length <= 1, it means only bot or no one.
      if (membersInChannel.length <= 1) {
        logger.info("Bot is alone in {channelId}. Starting 60s timeout.", { 
          channelId: player.voiceChannelId 
        });
        
        const timer = setTimeout(async () => {
          const p = lavalink.getPlayer(player.guildId);
          if (p && p.connected) {
            await p.destroy();
            logger.info("Bot left {channelId} due to being alone.", { 
              channelId: player.voiceChannelId 
            });
          }
          aloneTimers.delete(player.guildId);
        }, 60000);
        
        aloneTimers.set(player.guildId, timer);
      }
    } catch (error) {
      logger.error("Error checking alone state: {error}", { error });
    }
  });

  // deno-lint-ignore no-explicit-any
  lavalink.on("playerVoiceJoin", (player: any, userId: any) => {
    const timer = aloneTimers.get(player.guildId);
    if (timer) {
      clearTimeout(timer);
      aloneTimers.delete(player.guildId);
      logger.info("User joined {channelId}. Cancelled alone timeout.", { 
        channelId: player.voiceChannelId 
      });
    }
  });

  // Clear timer when a new track starts
  // deno-lint-ignore no-explicit-any
  lavalink.on("trackStart", (player: any, track: any) => {
    const timer = aloneTimers.get(player.guildId);
    if (timer) {
      clearTimeout(timer);
      aloneTimers.delete(player.guildId);
    }
    logger.info("Track started in {guildId}: {title}", {
      guildId: player.guildId,
      title: track.info.title,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.on("trackEnd", (player: any, track: any, reason: any) => {
    logger.info("Track ended in {guildId}: {title}. Reason: {reason}", {
      guildId: player.guildId,
      title: track?.info?.title,
      reason,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.on("trackStuck", (player: any, track: any, threshold: any) => {
    logger.warn("Track stuck in {guildId}: {title}. Threshold: {threshold}", {
      guildId: player.guildId,
      title: track?.info?.title,
      threshold,
    });
  });

  // deno-lint-ignore no-explicit-any
  lavalink.on("trackError", (player: any, track: any, error: any) => {
    logger.error("Track error in {guildId}: {title}. Error: {error}", {
      guildId: player.guildId,
      title: track?.info?.title,
      error: error.message || error,
    });
  });

  logger.info("Initializing Lavalink manager...");
  await lavalink.init();
  logger.info("Lavalink manager initialized. Nodes in manager: {count}", {
    count: lavalink.nodeManager.nodes.size,
  });

  return lavalink;
}
