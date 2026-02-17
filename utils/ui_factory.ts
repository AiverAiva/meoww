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
 * Creates a "No Supported Links Found" information card.
 */
export function createNoLinksFoundCard(supportedPlatforms: string[]) {
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
        content: `**Supported Platforms:**\n${
          supportedPlatforms.map((p) => `• ${p}`).join("\n")
        }`,
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
