import { createContainer, createErrorCard } from "../ui_factory.ts";
import { getPornhubPreview } from "./pornhub.ts";
import { getTwitterPreview } from "./twitter.ts";
import { getPixivPreview } from "./pixiv.ts";
import { getWNACGPreview } from "./wnacg.ts";
import { getNHentaiPreview } from "./nhentai.ts";
import { getHanimePreview } from "./hanime.ts";
import { getJMComicPreview } from "./jmcomic.ts";

export * from "./twitter.ts";
export * from "./pornhub.ts";
export * from "./pixiv.ts";
export * from "./wnacg.ts";
export * from "./nhentai.ts";
export * from "./hanime.ts";
export * from "./jmcomic.ts";

export const SUPPORTED_PLATFORMS = [
  "Twitter / X",
  "Pornhub (Videos & Models)",
  "Pixiv (Artworks)",
  // "WNACG (Manga/Doujin)",
  "nHentai",
  // "18Comic (JM)",
  // "Hanime1.me (Videos)",
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

  // Check Hanime
  const hanime = await getHanimePreview(content);
  if (hanime) return hanime;

  // Check JMComic
  const jmcomic = await getJMComicPreview(content);
  if (jmcomic) return jmcomic;

  return null;
}

/**
 * Formats a preview result into valid Component V2 structures.
 * To avoid 'Invalid Form Body' errors (UNION_TYPE_CHOICES), we keep only TextDisplay in Containers.
 * MediaGallery and ActionRow components MUST be at the top level.
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
