import { getDb } from "./db.ts";
import { logger } from "./logger.ts";

interface HoneypotDoc {
  guildId: string;
  channelId: string;
  createdAt: Date;
  bannedCount: number;
  counterMessageId: string | null;
}

const COLLECTION = "honeypot_channels";

async function col() {
  const db = await getDb();
  return db.collection<HoneypotDoc>(COLLECTION);
}

export async function ensureIndexes() {
  const c = await col();
  await c.createIndex({ guildId: 1 }, { unique: true });
  await c.createIndex({ channelId: 1 });
}

export async function getHoneypotChannel(
  guildId: string,
): Promise<string | undefined> {
  const doc = await (await col()).findOne({ guildId });
  return doc?.channelId;
}

export async function setHoneypotChannel(
  guildId: string,
  channelId: string,
): Promise<void> {
  await (await col()).updateOne(
    { guildId },
    {
      $set: { guildId, channelId, createdAt: new Date() },
      $setOnInsert: { bannedCount: 0, counterMessageId: null },
    },
    { upsert: true },
  );
  invalidateCache();
  logger.info("Honeypot channel set for guild {guild}: {channel}", {
    guild: guildId,
    channel: channelId,
  });
}

export async function removeHoneypotChannel(guildId: string): Promise<void> {
  await (await col()).deleteOne({ guildId });
  invalidateCache();
  logger.info("Honeypot channel removed for guild {guild}", {
    guild: guildId,
  });
}

export async function incrementBanCount(guildId: string): Promise<number> {
  const result = await (await col()).findOneAndUpdate(
    { guildId },
    { $inc: { bannedCount: 1 } },
    { returnDocument: "after" },
  );
  return result?.bannedCount ?? 0;
}

export async function getBanCount(guildId: string): Promise<number> {
  const doc = await (await col()).findOne({ guildId });
  return doc?.bannedCount ?? 0;
}

export async function getCounterMessageId(
  guildId: string,
): Promise<string | undefined> {
  const doc = await (await col()).findOne({ guildId });
  return doc?.counterMessageId ?? undefined;
}

export async function setCounterMessageId(
  guildId: string,
  messageId: string,
): Promise<void> {
  await (await col()).updateOne(
    { guildId },
    { $set: { counterMessageId: messageId } },
  );
}

// --- In-memory cache for isHoneypotChannel ---

let channelCache: Set<string> | null = null;
let cacheTs = 0;
const CACHE_TTL = 60_000;

function invalidateCache() {
  channelCache = null;
}

async function getChannelSet(): Promise<Set<string>> {
  const now = Date.now();
  if (channelCache && now - cacheTs < CACHE_TTL) {
    return channelCache;
  }
  const docs = await (await col()).find({}, { projection: { channelId: 1 } })
    .toArray();
  channelCache = new Set(docs.map((d) => d.channelId));
  cacheTs = now;
  return channelCache;
}

export async function isHoneypotChannel(
  channelId: string,
): Promise<boolean> {
  const cache = await getChannelSet();
  return cache.has(channelId);
}
