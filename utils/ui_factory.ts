import { ComponentV2Type } from "./components_v2.ts";

/**
 * Standard colors used across the application UI.
 */
export const UI_COLORS = {
  ERROR: 0xFF4B4B,
  INFO: 0x3B82F6,
  SUCCESS: 0x10B981,
  TWITTER: 0x1DA1F2,
  PORNHUB: 0xFFA31A,
};

/**
 * Creates a standard Error Card component.
 */
export function createErrorCard(message: string) {
  return {
    type: ComponentV2Type.Container,
    accent_color: UI_COLORS.ERROR,
    components: [
      {
        type: ComponentV2Type.TextDisplay,
        content: `### ❌ Error\n${message}`,
      },
    ],
  };
}

/**
 * Creates a "No Supported Links Found" information card with categorized sections.
 */
export function createNoLinksFoundCard() {
  return {
    type: ComponentV2Type.Container,
    accent_color: UI_COLORS.INFO,
    components: [
      {
        type: ComponentV2Type.TextDisplay,
        content:
          "### 🔍 No Previewable Links Found\nI couldn't find any supported links in that message.",
      },
      {
        type: ComponentV2Type.Separator,
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: `**🌐 Previewable Links**\n• Twitter / X\n• Pixiv Artworks`,
      },
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `**🔞 NSFW Limited Links**\n• Twitter / X (Adult content)\n• Pixiv Artworks (Adult content)\n• nHentai\n• WNACG (Manga/Doujin)\n• 18Comic (JM)\n• Hanime1.me (Videos)\n• Pornhub Videos & Models`,
      },
    ],
  };
}

/**
 * Creates a source selection card when a 6-digit ID is detected.
 */
export function createSourceSelectionCard(id: string) {
  return {
    type: ComponentV2Type.Container,
    accent_color: UI_COLORS.INFO,
    components: [
      {
        type: ComponentV2Type.TextDisplay,
        content:
          `### 📚 Select Source\nWhich source do you want to preview \`${id}\` from?`,
      },
      {
        type: ComponentV2Type.ActionRow,
        components: [
          {
            type: ComponentV2Type.Button,
            style: 1, // Primary
            label: "nHentai",
            custom_id: `id_preview:nhentai:${id}`,
          },
          {
            type: ComponentV2Type.Button,
            style: 1, // Primary
            label: "WNACG",
            custom_id: `id_preview:wnacg:${id}`,
          },
          // {
          //   type: ComponentV2Type.Button,
          //   style: 1, // Primary
          //   label: "18Comic",
          //   custom_id: `id_preview:jmcomic:${id}`,
          // },
        ],
      },
    ],
  };
}

/**
 * Generic container helper.
 */
// deno-lint-ignore no-explicit-any
export function createContainer(components: any[], accentColor?: number) {
  return {
    type: ComponentV2Type.Container,
    accent_color: accentColor,
    components,
  };
}
/**
 * Creates options for a jump-to-page dropdown.
 */
export function createPageJumpOptions(currentPage: number, totalPages: number) {
  const pagesToInclude = new Set<number>();
  pagesToInclude.add(1);
  if (totalPages > 0) pagesToInclude.add(totalPages);

  // Decimals/Intervals
  if (totalPages > 20) {
    for (let i = 1; i <= 10; i++) {
      const p = Math.floor((totalPages * i) / 10);
      if (p >= 1 && p <= totalPages) pagesToInclude.add(p);
    }
  } else {
    for (let i = 1; i <= totalPages; i++) pagesToInclude.add(i);
  }

  // Neighborhood
  for (let i = currentPage - 5; i <= currentPage + 5; i++) {
    if (i >= 1 && i <= (totalPages || 9999)) pagesToInclude.add(i);
  }

  const sortedPages = Array.from(pagesToInclude).sort((a, b) => a - b);
  return sortedPages.slice(0, 25).map((p) => ({
    label: `Page ${p}`,
    value: p.toString(),
    default: p === currentPage,
  }));
}
