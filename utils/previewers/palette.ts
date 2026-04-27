import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

const FONT_FAMILY = "SpaceGrotesk";
const FONT_REGISTERED = (() => {
  try {
    const fontPath = Deno.cwd() + "/assets/fonts/SpaceGrotesk.woff";
    const result = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
    if (!result) {
      logger.warn("Failed to register Space Grotesk font");
    }
    return !!result;
  } catch (e) {
    logger.warn("Failed to register Space Grotesk font: {e}", { e });
    return false;
  }
})();

function normalizeHex(hex: string): string {
  const clean = hex.replace("#", "").toUpperCase();
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  return `#${clean}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function hasHexColors(content: string): boolean {
  return HEX_COLOR_REGEX.test(content);
}

export function extractColors(content: string): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];

  let match: RegExpExecArray | null;
  const regex = new RegExp(HEX_COLOR_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    const normalized = normalizeHex(match[0]);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    colors.push(normalized);
  }

  return colors;
}

const CANVAS_WIDTH = 800;
const ROW_HEIGHT = 100;
const SCALE = 2;

export function generatePaletteImage(colors: string[]): Uint8Array {
  if (colors.length === 0) throw new Error("No colors to render");

  const canvasHeight = colors.length * ROW_HEIGHT;
  const canvas = createCanvas(CANVAS_WIDTH, canvasHeight);
  const ctx = canvas.getContext("2d");

  ctx.scale(SCALE, SCALE);

  const fontFamily = FONT_REGISTERED ? FONT_FAMILY : "sans-serif";
  const logicalWidth = CANVAS_WIDTH / SCALE;
  const logicalRowHeight = ROW_HEIGHT / SCALE;

  for (let i = 0; i < colors.length; i++) {
    const hex = colors[i];
    const rowY = i * logicalRowHeight;

    ctx.fillStyle = hex;
    ctx.fillRect(0, rowY, logicalWidth, logicalRowHeight);

    const { r, g, b } = hexToRgb(hex);
    const lum = relativeLuminance(r, g, b);
    const textColor = lum < 0.4 ? "#FFFFFF" : "#000000";

    ctx.fillStyle = textColor;
    ctx.font = `16px ${fontFamily}`;
    ctx.fillText(hex, 12, rowY + 31);
  }

  const buf = canvas.toBuffer("image/png");
  return new Uint8Array(buf);
}

export interface PalettePreviewResult {
  // deno-lint-ignore no-explicit-any
  components: any[];
  file: { blob: Blob; name: string };
  color: number;
}

export function getPalettePreview(
  content: string,
): PalettePreviewResult | null {
  try {
    const colors = extractColors(content);
    if (colors.length === 0) return null;

    const imageData = generatePaletteImage(colors);
    const fileName = "palette.png";

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: `attachment://${fileName}` } }],
      },
      {
        type: ComponentV2Type.TextDisplay,
        content: colors.map((c) => `\`${c}\``).join(" "),
      },
    ];

    return {
      components,
      file: {
        blob: new Blob([imageData as unknown as BlobPart], {
          type: "image/png",
        }),
        name: fileName,
      },
      color: 0x5865F2,
    };
  } catch (error) {
    logger.error("Palette generation error: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
