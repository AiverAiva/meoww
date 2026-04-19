import { ComponentV2Type } from "../components_v2.ts";
import { logger } from "../logger.ts";
import { Jimp } from "jimp";
import { Buffer } from "node:buffer";

const LATEX_PADDING = 40;

const ALL_LATEX_COMMANDS = [
  "frac", "dfrac", "tfrac", "sqrt",
  "sum", "int", "prod", "lim", "oint", "iint", "iiint",
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma",
  "tau", "upsilon", "phi", "chi", "psi", "omega",
  "sin", "cos", "tan", "log", "ln", "exp", "max", "min",
  "begin", "end",
  "left", "right",
  "hat", "bar", "vec", "dot", "ddot", "tilde",
  "overline", "underline", "overrightarrow",
  "mathbb", "mathcal", "mathbf", "mathrm", "mathit", "mathsf",
  "infty", "partial", "nabla",
  "cdot", "times", "div",
  "leq", "geq", "neq", "approx", "equiv", "sim",
  "rightarrow", "leftarrow", "Rightarrow", "Leftarrow",
  "cup", "cap", "subset", "supset", "subseteq", "supseteq",
  "forall", "exists",
  "text", "textbf", "textit", "textrm",
  "binom", "boxed", "cancel",
  "matrix", "pmatrix", "bmatrix", "vmatrix",
  "substack", "cases",
  "underset", "overset", "stackrel",
  "color",
];

const BARE_LATEX_REGEX = new RegExp(
  `\\\\(?:${ALL_LATEX_COMMANDS.join("|")})\\b`,
);

function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
}

export function hasLatex(content: string): boolean {
  const stripped = stripCodeBlocks(content);

  if (/\$\$[\s\S]*?\$\$/.test(stripped)) return true;
  if (/\\\[.*?\\\]/.test(stripped)) return true;
  if (/\\\(.*?\\\)/.test(stripped)) return true;

  const inlineMatch = /(?<!\$)\$(?!\$)([^\$]+?)(?<!\$)\$(?!\$)/.exec(stripped);
  if (inlineMatch && BARE_LATEX_REGEX.test(inlineMatch[1])) return true;

  if (BARE_LATEX_REGEX.test(stripped)) return true;

  return false;
}

export function extractLatex(content: string): string[] {
  const stripped = stripCodeBlocks(content);
  const expressions: string[] = [];
  let match: RegExpExecArray | null;

  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  while ((match = blockRegex.exec(stripped)) !== null) {
    const expr = match[1].trim();
    if (expr) expressions.push(expr);
  }
  if (expressions.length > 0) return expressions;

  const displayRegex = /\\\[([\s\S]*?)\\\]/g;
  while ((match = displayRegex.exec(stripped)) !== null) {
    const expr = match[1].trim();
    if (expr) expressions.push(expr);
  }
  if (expressions.length > 0) return expressions;

  const inlineLatexRegex = /\\\(([\s\S]*?)\\\)/g;
  while ((match = inlineLatexRegex.exec(stripped)) !== null) {
    const expr = match[1].trim();
    if (expr) expressions.push(expr);
  }
  if (expressions.length > 0) return expressions;

  const dollarInlineRegex = /(?<!\$)\$(?!\$)([^\$]+?)(?<!\$)\$(?!\$)/g;
  while ((match = dollarInlineRegex.exec(stripped)) !== null) {
    const expr = match[1].trim();
    if (expr && BARE_LATEX_REGEX.test(expr)) {
      expressions.push(expr);
    }
  }
  if (expressions.length > 0) return expressions;

  if (BARE_LATEX_REGEX.test(stripped)) {
    const lines = stripped.split("\n");
    const latexLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && BARE_LATEX_REGEX.test(trimmed)) {
        latexLines.push(trimmed);
      }
    }
    if (latexLines.length > 0) {
      expressions.push(latexLines.join(" "));
    }
  }

  return expressions;
}

const MAX_LATEX_LENGTH = 2000;

async function addPadding(imageData: Uint8Array, padding: number): Promise<Uint8Array> {
  const image = await Jimp.read(Buffer.from(imageData));
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const padded = new Jimp({ width: w + padding * 2, height: h + padding * 2, color: 0xFFFFFFFF });
  padded.composite(image, padding, padding);
  const buf = await padded.getBuffer("image/png");
  return new Uint8Array(buf);
}

async function renderLatexToImage(latex: string): Promise<Uint8Array> {
  const clampedLatex = latex.substring(0, MAX_LATEX_LENGTH);
  const encodedLatex = `\\dpi{300}\\bg_white ${clampedLatex}`;
  const url = `https://latex.codecogs.com/png.latex?${encodeURIComponent(encodedLatex)}`;

  logger.debug("Rendering LaTeX via CodeCogs: {url}", { url });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CodeCogs API returned status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text") || contentType.includes("html")) {
    throw new Error("CodeCogs returned non-image response, possibly invalid LaTeX");
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export interface LatexPreviewResult {
  // deno-lint-ignore no-explicit-any
  components: any[];
  file: { blob: Blob; name: string };
  color: number;
}

export async function getLatexPreview(
  latex: string,
): Promise<LatexPreviewResult | null> {
  try {
    const imageData = await renderLatexToImage(latex);
    const paddedData = await addPadding(imageData, LATEX_PADDING);
    const fileName = "latex.png";

    // deno-lint-ignore no-explicit-any
    const components: any[] = [
      {
        type: ComponentV2Type.MediaGallery,
        items: [{ media: { url: `attachment://${fileName}` } }],
      },
    ];

    return {
      components,
      file: {
        blob: new Blob([paddedData as unknown as BlobPart], { type: "image/png" }),
        name: fileName,
      },
      color: 0x5865F2,
    };
  } catch (error) {
    logger.error("LaTeX rendering error: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
