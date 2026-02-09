import { createContainer, createErrorCard } from "../ui_factory.ts";
import { getPornhubPreview } from "./pornhub.ts";
import { getTwitterPreview } from "./twitter.ts";
import { getPixivPreview } from "./pixiv.ts";
import { getWNACGPreview } from "./wnacg.ts";
import { getNHentaiPreview } from "./nhentai.ts";

export * from "./twitter.ts";
export * from "./pornhub.ts";
export * from "./pixiv.ts";
export * from "./wnacg.ts";
export * from "./nhentai.ts";

export const SUPPORTED_PLATFORMS = [
  "Twitter / X",
  "Pornhub (Videos & Models)",
  "Pixiv (Artworks)",
  // "WNACG (Manga/Doujin)",
  "nHentai",
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

  // Check WNACG
  const wnacg = await getWNACGPreview(content);
  if (wnacg) return wnacg;

  // Check nHentai
  const nhentai = await getNHentaiPreview(content);
  if (nhentai) return nhentai;

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
