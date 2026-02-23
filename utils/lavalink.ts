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

  // Player events on Manager
  // deno-lint-ignore no-explicit-any
  lavalink.on("trackStart", (player: any, track: any) => {
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

  // deno-lint-ignore no-explicit-any
  lavalink.on("queueEnd", (player: any) => {
    logger.info("Queue ended in {guildId}", {
      guildId: player.guildId,
    });
  });

  logger.info("Initializing Lavalink manager...");
  await lavalink.init();
  logger.info("Lavalink manager initialized. Nodes in manager: {count}", {
    count: lavalink.nodeManager.nodes.size,
  });

  return lavalink;
}
