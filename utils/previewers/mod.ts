import { createContainer, createErrorCard } from "../ui_factory.ts";
import { getPornhubPreview } from "./pornhub.ts";
import { getTwitterPreview } from "./twitter.ts";

export * from "./twitter.ts";
export * from "./pornhub.ts";

export const SUPPORTED_PLATFORMS = ["Twitter / X", "Pornhub (Videos & Models)"];

export async function getAnyPreview(content: string) {
  // Check Twitter
  const twitter = await getTwitterPreview(content);
  if (twitter) return twitter;

  // Check Pornhub
  const pornhub = await getPornhubPreview(content);
  if (pornhub) return pornhub;

  return null;
}

/**
 * Formats a preview result into a Component V2 Container or Error message.
 */
export function formatPreviewComponents(result: {
  // deno-lint-ignore no-explicit-any
  components?: any[];
  error?: string;
  color: number;
}) {
  if (result.error) {
    return [createErrorCard(result.error)];
  }

  return [createContainer(result.components || [], result.color)];
}
