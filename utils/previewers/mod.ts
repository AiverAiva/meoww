import { createContainer, createErrorCard } from "../ui_factory.ts";
import { getPornhubPreview } from "./pornhub.ts";
import { getTwitterPreview } from "./twitter.ts";
import { getPixivPreview } from "./pixiv.ts";

export * from "./twitter.ts";
export * from "./pornhub.ts";
export * from "./pixiv.ts";

export const SUPPORTED_PLATFORMS = [
  "Twitter / X",
  "Pornhub (Videos & Models)",
  "Pixiv (Artworks)",
];

export async function getAnyPreview(content: string) {
  // Check Twitter
  const twitter = await getTwitterPreview(content);
  if (twitter) return twitter;

  // Check Pornhub
  const pornhub = await getPornhubPreview(content);
  if (pornhub) return pornhub;

  // Check Pixiv
  const pixiv = await getPixivPreview(content);
  if (pixiv) return pixiv;

  return null;
}

/**
 * Formats a preview result into valid Component V2 structures.
 * Returns the flat array of components directly to avoid invalid nesting in Sections/Containers.
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

  // return result.components || [];
  return [createContainer(result.components || [], result.color)];
}
