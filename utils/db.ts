import { MongoClient } from "mongodb";
import { logger } from "./logger.ts";

const uri = Deno.env.get("MONGODB_URI") ?? "mongodb://localhost:27017";
const dbName = Deno.env.get("MONGODB_DB") ?? "meoww";

let client: MongoClient | null = null;

export async function getDb() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    logger.info("Connected to MongoDB (db={db})", { db: dbName });
  }
  return client.db(dbName);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    logger.info("MongoDB connection closed.");
  }
}
