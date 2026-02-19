import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";

export const PIXIV_REGEX =
  /https?:\/\/(?:www\.)?pixiv\.net\/(?:[a-zA-Z0-9_-]+\/)?artworks\/(\d+)/;

interface PixivInfo {
  title: string;
  author: string;
  authorId: string;
  imageUrls: string[];
  url: string;
  description: string;
  tags: string[];
  xRestrict: number;
}

export async function getPixivPreview(content: string, pageIndex = 0) {
  const match = content.match(PIXIV_REGEX);
  if (!match) return null;

  const artworkId = match[1];
  const url = `https://www.pixiv.net/artworks/${artworkId}`;

  try {
    const res = await fetch(`https://www.phixiv.net/api/info?id=${artworkId}`);

    if (!res.ok) {
      logger.warn("Phixiv API failed for Pixiv ID {id}", { id: artworkId });
      return null;
    }

    const data = await res.json();
    logger.debug("Pixiv API Data: {id}, x_restrict: {restrict}", {
      id: artworkId,
      restrict: data.x_restrict,
    });

    let imageUrls: string[] = data.image_proxy_urls ||
      [`https://pixiv.cat/${artworkId}.jpg`];

    // Handle ugoira / animations: if there's an animation URL, it's often followed by a static thumbnail.
    // We only want the animation.
    const animationUrl = imageUrls.find((url) =>
      url.includes("/ugoira/") || url.endsWith(".mp4") || url.endsWith(".gif")
    );
    if (animationUrl) {
      imageUrls = [animationUrl];
    }

    const info: PixivInfo = {
      title: data.title || "Untitled",
      author: data.author_name || "Unknown Artist",
      authorId: data.author_id || "",
      imageUrls,
      url: url,
      description: data.description || "",
      tags: data.tags || [],
      xRestrict: data.x_restrict || 0,
    };

    const isNSFW = info.xRestrict > 0;
    const pageCount = info.imageUrls.length;
    const safePageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
    const currentImage = info.imageUrls[safePageIndex];

    const decodedTitle = decodeHtmlEntities(info.title);
    const decodedAuthor = decodeHtmlEntities(info.author);
    const decodedDescription = decodeHtmlEntities(info.description)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>?/gm, "")
      .trim()
      .substring(0, 200);

    // Format tags with each tag in its own backticks block as requested.
    const tagBlock = info.tags
      .map((t) => {
        const clean = t.replace(/\s+/g, "");
        const withHash = clean.startsWith("#") ? clean : `#${clean}`;
        return `\`${withHash}\``;
      })
      .join(" ");

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [
          {
            media: {
              url: currentImage,
            },
            spoiler: false,
          },
        ],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `### [${decodedTitle}](${info.url})\nby **${decodedAuthor}**`,
      },
      ...(decodedDescription
        ? [{
          type: ComponentV2Type.TextDisplay,
          content: decodedDescription,
        }]
        : []),
      {
        type: ComponentV2Type.TextDisplay,
        content: `🏷️ ${tagBlock}`.substring(0, 1000), // Larger limit for tags
      },
      {
        type: ComponentV2Type.TextDisplay,
        content:
          "-# Adult content detection is based on platform metadata. If NSFW content is incorrectly displayed in a non-NSFW channel, please delete it manually.",
      },
    ];

    // Add Pagination Buttons if more than 1 page
    if (pageCount > 1) {
      components.push({
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 2, // Secondary
            label: "⏪",
            custom_id: `pixiv_v_${artworkId}_0_${safePageIndex}_f`,
            disabled: safePageIndex === 0,
          },
          {
            type: ComponentV2Type.Button,
            style: 2, // Secondary
            label: "⬅️",
            custom_id: `pixiv_v_${artworkId}_${
              safePageIndex - 1
            }_${safePageIndex}_v`,
            disabled: safePageIndex === 0,
          },
          {
            type: ComponentV2Type.Button,
            style: 2,
            label: `${safePageIndex + 1} / ${pageCount}`,
            custom_id: `pixiv_info`,
            disabled: true,
          },
          {
            type: ComponentV2Type.Button,
            style: 2, // Secondary
            label: "➡️",
            custom_id: `pixiv_v_${artworkId}_${
              safePageIndex + 1
            }_${safePageIndex}_n`,
            disabled: safePageIndex === pageCount - 1,
          },
          {
            type: ComponentV2Type.Button,
            style: 2, // Secondary
            label: "⏩",
            custom_id: `pixiv_v_${artworkId}_${
              pageCount - 1
            }_${safePageIndex}_l`,
            disabled: safePageIndex === pageCount - 1,
          },
        ],
      });
    }

    return {
      color: 0x0096FA,
      components,
      isNSFW,
    };
  } catch (error) {
    logger.error("Failed to fetch Pixiv info: {error}", { error });
    return {
      color: 0x0096FA,
      components: [
        {
          type: ComponentV2Type.MediaGallery,
          items: [
            {
              media: {
                url: `https://pixiv.cat/${artworkId}.jpg`,
              },
              spoiler: false,
            },
          ],
        },
        {
          type: ComponentV2Type.TextDisplay,
          content:
            `### [Artwork ${artworkId}](${url})\n(Metadata fetch failed, showing preview from pixiv.cat)`,
        },
      ],
    };
  }
}
