import { GIFEncoder, quantize, applyPalette } from "./gifenc.ts";
import { Jimp } from "jimp";
import { join } from "node:path";
import { Buffer } from "node:buffer";

const ASSET_COUNT = 10;
const CANVAS_SIZE = 256;
const FRAMES = 10;
const FRAME_DURATION_MS = 20;

/**
 * Generates a patpat GIF from an avatar buffer.
 * @param avatarBuffer The avatar image buffer (PNG/JPG)
 * @param assetDir Path to the directory containing pet0.gif...pet9.gif
 * @returns The generated GIF as a Uint8Array
 */
export async function generatePatpatGif(avatarBuffer: Uint8Array, assetDir: string): Promise<Uint8Array> {
  // Load target avatar
  const avatar = await Jimp.read(Buffer.from(avatarBuffer));
  avatar.resize({ w: CANVAS_SIZE, h: CANVAS_SIZE });

  // Load hand frames
  const handFrames: (InstanceType<typeof Jimp>)[] = [];
  for (let i = 0; i < ASSET_COUNT; i++) {
    const p = join(assetDir, `pet${i}.gif`);
    const hand = await Jimp.read(p);
    if (hand.bitmap.width !== CANVAS_SIZE || hand.bitmap.height !== CANVAS_SIZE) {
      hand.resize({ w: CANVAS_SIZE, h: CANVAS_SIZE });
    }
    handFrames.push(hand as InstanceType<typeof Jimp>);
  }

  const encoder = GIFEncoder();

  const frames: InstanceType<typeof Jimp>[] = [];

  for (let i = 0; i < FRAMES; i++) {
    const j = i < FRAMES / 2 ? i : FRAMES - i;
    const width = 0.8 + j * 0.02;
    const height = 0.8 - j * 0.05;

    const newW = Math.round(CANVAS_SIZE * width);
    const newH = Math.round(CANVAS_SIZE * height);

    const offsetX = Math.round((1 - width) * 0.5 * CANVAS_SIZE + 0.1 * CANVAS_SIZE);
    const offsetY = Math.round((1 - height) * CANVAS_SIZE - 0.08 * CANVAS_SIZE);

    const canvas = new Jimp({ width: CANVAS_SIZE, height: CANVAS_SIZE, color: 0x00000000 });
    
    // Resize avatar for this frame
    const avatarResized = avatar.clone().resize({ w: newW, h: newH });
    
    // Composite avatar onto canvas
    canvas.composite(avatarResized, offsetX, offsetY);
    
    // Composite hand onto canvas
    const hand = handFrames[i % handFrames.length];
    canvas.composite(hand, 0, 0);

    frames.push(canvas);
  }

  // Encode frames
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    // Convert Jimp to RGBA Uint8Array
    const rgba = new Uint8Array(frame.bitmap.data.buffer);
    
    // Quantize and apply palette for GIF
    const palette = quantize(rgba, 256, {
      clearAlpha: true,
      oneBitAlpha: true
    });
    const index = applyPalette(rgba, palette);

    encoder.writeFrame(index, CANVAS_SIZE, CANVAS_SIZE, {
      palette,
      delay: FRAME_DURATION_MS,
      transparent: true,
      transparentIndex: 0,
      dispose: 2,
      repeat: 0,
    });
  }

  encoder.finish();
  return encoder.bytes();
}
