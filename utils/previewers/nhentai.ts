import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { createErrorCard } from "../ui_factory.ts";

export const NHENTAI_REGEX = /https?:\/\/(?:www\.)?nhentai\.net\/g\/(\d+)\/?/;

interface NHentaiImages {
  pages: { t: "j" | "p" | "g" | "w"; w: number; h: number }[];
  cover: { t: "j" | "p" | "g" | "w"; w: number; h: number };
  thumbnail: { t: "j" | "p" | "g" | "w"; w: number; h: number };
}

interface NHentaiTag {
  id: number;
  type: string;
  name: string;
  count: number;
}

interface NHentaiGallery {
  id: number;
  media_id: string;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  images: NHentaiImages;
  tags: NHentaiTag[];
  num_pages: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36";

const EXT_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

/**
 * Fetches nhentai gallery data via API.
 */
async function fetchNHentaiGallery(id: string): Promise<NHentaiGallery> {
  const url = `https://nhentai.net/api/gallery/${id}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.status === 403) {
      throw new Error(
        "Access Denied (403). nHentai might be behind Cloudflare verification.",
      );
    }
    if (res.status === 404) {
      throw new Error("Gallery not found (404).");
    }
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    logger.error("nHentai API Error: {id} - {error}", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function getImageUrl(
  mediaId: string,
  index: number,
  type: string,
  isThumb = false,
): string {
  // Use i1.nhentai.net or t1.nhentai.net to attempt to bypass Discord proxy issues with main domain
  const host = isThumb ? "t1.nhentai.net" : "i1.nhentai.net";
  const ext = EXT_MAP[type] || "jpg";
  return `https://${host}/galleries/${mediaId}/${index}.${ext}`;
}

export async function getNHentaiPreview(content: string) {
  const match = content.match(NHENTAI_REGEX);
  if (!match) return null;

  const id = match[1];

  try {
    const gallery = await fetchNHentaiGallery(id);
    const mediaId = gallery.media_id;
    // Cover usually uses thumb server
    const coverUrl = `https://t1.nhentai.net/galleries/${mediaId}/cover.${
      EXT_MAP[gallery.images.cover.t] || "jpg"
    }`;

    const tags = gallery.tags
      .filter((t) => t.type === "tag")
      .map((t) => t.name)
      .slice(0, 15);

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: coverUrl }, spoiler: true }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${
          gallery.title.pretty || gallery.title.english
        }](https://nhentai.net/g/${gallery.id}/)\n**${gallery.num_pages}P** • ID: \`${gallery.id}\``,
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `🏷️ ${
          tags.map((t) => `\`#${t.replace(/\s+/g, "")}\``).join(" ")
        }`.substring(0, 1000),
      },
      {
        type: ComponentV2Type.ActionRow,
        components: [{
          type: ComponentV2Type.Button,
          style: 1,
          label: "📂 View in Discord",
          custom_id: `nhentai_v_${gallery.id}_1_0_0`,
        }],
      },
    ];

    return { color: 0xED2553, components };
  } catch (error) {
    return {
      color: 0xED2553,
      components: [
        createErrorCard(
          error instanceof Error
            ? error.message
            : "Failed to fetch nHentai data.",
        ),
      ],
    };
  }
}

export async function getNHentaiFullViewer(id: string, page: number) {
  try {
    const gallery = await fetchNHentaiGallery(id);
    const pageCount = gallery.num_pages;
    const clampedPage = Math.max(1, Math.min(page, pageCount));

    const pageImage = gallery.images.pages[clampedPage - 1];
    const imageUrl = getImageUrl(gallery.media_id, clampedPage, pageImage.t);

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: imageUrl }, spoiler: true }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${
          gallery.title.pretty || gallery.title.english
        }](https://nhentai.net/g/${gallery.id}/)\nPage **${clampedPage}** / **${pageCount}**`,
      },
    ];

    if (pageCount > 1) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏪",
            custom_id: `nhentai_v_${id}_1_${clampedPage}_f`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⬅️",
            custom_id: `nhentai_v_${id}_${clampedPage - 1}_${clampedPage}_v`,
            disabled: clampedPage === 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${clampedPage} / ${pageCount}`,
            custom_id: `nhentai_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "➡️",
            custom_id: `nhentai_v_${id}_${clampedPage + 1}_${clampedPage}_n`,
            disabled: clampedPage === pageCount,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: "⏩",
            custom_id: `nhentai_v_${id}_${pageCount}_${clampedPage}_l`,
            disabled: clampedPage === pageCount,
          },
        ],
      });
    }

    return { color: 0xED2553, components };
  } catch (error) {
    return {
      color: 0xED2553,
      components: [
        createErrorCard(
          error instanceof Error ? error.message : "Failed to load image.",
        ),
      ],
    };
  }
}
