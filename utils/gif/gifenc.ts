// Port of gifenc.js to TypeScript for Deno

/** 
 * A simple GIF encoder for Deno/Node.js
 * Source: https://github.com/mattdesl/gifenc (modified for TypeScript/Deno)
 */

export interface GIFEncoderOptions {
  initialCapacity?: number;
  auto?: boolean;
}

export interface WriteFrameOptions {
  transparent?: boolean;
  transparentIndex?: number;
  delay?: number;
  palette?: number[][];
  repeat?: number;
  colorDepth?: number;
  dispose?: number;
  first?: boolean;
}

const CONSTANTS = {
  signature: "GIF",
  version: "89a",
  trailer: 0x3b,
  extensionIntroducer: 0x21,
  applicationExtensionLabel: 0xff,
  graphicControlExtensionLabel: 0xf9,
  imageSeparator: 0x2c,
  signatureSize: 3,
  versionSize: 3,
  globalColorTableFlagMask: 0x80,
  colorResolutionMask: 0x70,
  sortFlagMask: 0x08,
  globalColorTableSizeMask: 0x07,
  applicationIdentifierSize: 8,
  applicationAuthCodeSize: 3,
  disposalMethodMask: 0x1c,
  userInputFlagMask: 0x02,
  transparentColorFlagMask: 0x01,
  localColorTableFlagMask: 0x80,
  interlaceFlagMask: 0x40,
  idSortFlagMask: 0x20,
  localColorTableSizeMask: 0x07
};

function createStream(initialCapacity = 256) {
  let cursor = 0;
  let contents = new Uint8Array(initialCapacity);
  return {
    get buffer() {
      return contents.buffer;
    },
    reset() {
      cursor = 0;
    },
    bytesView() {
      return contents.subarray(0, cursor);
    },
    bytes() {
      return contents.slice(0, cursor);
    },
    writeByte(byte: number) {
      expand(cursor + 1);
      contents[cursor] = byte;
      cursor++;
    },
    writeBytes(data: number[] | Uint8Array, offset = 0, byteLength = data.length) {
      expand(cursor + byteLength);
      for (let i = 0; i < byteLength; i++) {
        contents[cursor++] = data[i + offset];
      }
    },
    writeBytesView(data: Uint8Array, offset = 0, byteLength = data.byteLength) {
      expand(cursor + byteLength);
      contents.set(data.subarray(offset, offset + byteLength), cursor);
      cursor += byteLength;
    }
  };

  function expand(newCapacity: number) {
    const prevCapacity = contents.length;
    if (prevCapacity >= newCapacity) return;
    const CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
    if (prevCapacity !== 0) newCapacity = Math.max(newCapacity, 256);
    const oldContents = contents;
    contents = new Uint8Array(newCapacity);
    if (cursor > 0) contents.set(oldContents.subarray(0, cursor), 0);
  }
}

const BITS = 12;
const DEFAULT_HSIZE = 5003;
const MASKS = [
  0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535
];

function lzwEncode(
  _width: number,
  _height: number,
  pixels: Uint8Array,
  colorDepth: number,
  outStream = createStream(512),
  accum = new Uint8Array(256),
  htab = new Int32Array(DEFAULT_HSIZE),
  codetab = new Int32Array(DEFAULT_HSIZE)
) {
  const hsize = htab.length;
  const initCodeSize = Math.max(2, colorDepth);
  accum.fill(0);
  codetab.fill(0);
  htab.fill(-1);

  let cur_accum = 0;
  let cur_bits = 0;
  const init_bits = initCodeSize + 1;
  const g_init_bits = init_bits;
  let clear_flg = false;
  let n_bits = g_init_bits;
  let maxcode = (1 << n_bits) - 1;
  const ClearCode = 1 << (init_bits - 1);
  const EOFCode = ClearCode + 1;
  let free_ent = ClearCode + 2;
  let a_count = 0;
  let ent = pixels[0];
  let hshift = 0;

  for (let fcode = hsize; fcode < 65536; fcode *= 2) {
    ++hshift;
  }
  hshift = 8 - hshift;

  outStream.writeByte(initCodeSize);
  output(ClearCode);

  const length = pixels.length;
  for (let idx = 1; idx < length; idx++) {
    const c = pixels[idx];
    const fcode = (c << BITS) + ent;
    let i = (c << hshift) ^ ent;

    if (htab[i] === fcode) {
      ent = codetab[i];
      continue;
    }

    const disp = i === 0 ? 1 : hsize - i;
    while (htab[i] >= 0) {
      i -= disp;
      if (i < 0) i += hsize;
      if (htab[i] === fcode) {
        ent = codetab[i];
        goto_next_block();
        break;
      }
    }

    if (htab[i] !== fcode) {
      output(ent);
      ent = c;
      if (free_ent < (1 << BITS)) {
        codetab[i] = free_ent++;
        htab[i] = fcode;
      } else {
        htab.fill(-1);
        free_ent = ClearCode + 2;
        clear_flg = true;
        output(ClearCode);
      }
    }

    function goto_next_block() {}
  }

  output(ent);
  output(EOFCode);
  outStream.writeByte(0);
  return outStream.bytesView();

  function output(code: number) {
    cur_accum &= MASKS[cur_bits];
    if (cur_bits > 0) cur_accum |= code << cur_bits;
    else cur_accum = code;
    cur_bits += n_bits;

    while (cur_bits >= 8) {
      accum[a_count++] = cur_accum & 255;
      if (a_count >= 254) {
        outStream.writeByte(a_count);
        outStream.writeBytesView(accum, 0, a_count);
        a_count = 0;
      }
      cur_accum >>= 8;
      cur_bits -= 8;
    }

    if (free_ent > maxcode || clear_flg) {
      if (clear_flg) {
        n_bits = g_init_bits;
        maxcode = (1 << n_bits) - 1;
        clear_flg = false;
      } else {
        ++n_bits;
        maxcode = n_bits === BITS ? (1 << n_bits) : ((1 << n_bits) - 1);
      }
    }

    if (code === EOFCode) {
      while (cur_bits > 0) {
        accum[a_count++] = cur_accum & 255;
        if (a_count >= 254) {
          outStream.writeByte(a_count);
          outStream.writeBytesView(accum, 0, a_count);
          a_count = 0;
        }
        cur_accum >>= 8;
        cur_bits -= 8;
      }
      if (a_count > 0) {
        outStream.writeByte(a_count);
        outStream.writeBytesView(accum, 0, a_count);
        a_count = 0;
      }
    }
  }
}

function writeUInt16(stream: ReturnType<typeof createStream>, value: number) {
  stream.writeByte(value & 0xff);
  stream.writeByte((value >> 8) & 0xff);
}

function writeUTFBytes(stream: ReturnType<typeof createStream>, string: string) {
  for (let i = 0; i < string.length; i++) {
    stream.writeByte(string.charCodeAt(i));
  }
}

function colorTableSize(length: number) {
  return Math.max(1, Math.ceil(Math.log2(length)));
}

export function GIFEncoder(opt: GIFEncoderOptions = {}) {
  const { initialCapacity = 4096, auto = true } = opt;
  const stream = createStream(initialCapacity);
  const HSIZE = 5003;
  const accum = new Uint8Array(256);
  const htab = new Int32Array(HSIZE);
  const codetab = new Int32Array(HSIZE);
  let hasInit = false;

  return {
    reset() {
      stream.reset();
      hasInit = false;
    },
    finish() {
      stream.writeByte(CONSTANTS.trailer);
    },
    bytes() {
      return stream.bytes();
    },
    bytesView() {
      return stream.bytesView();
    },
    get buffer() {
      return stream.buffer;
    },
    get stream() {
      return stream;
    },
    writeHeader() {
      writeUTFBytes(stream, "GIF89a");
    },
    writeFrame(index: Uint8Array, width: number, height: number, opts: WriteFrameOptions = {}) {
      const {
        transparent = false,
        transparentIndex = 0,
        delay = 0,
        palette = null,
        repeat = 0,
        colorDepth = 8,
        dispose = -1
      } = opts;

      let first = false;
      if (auto) {
        if (!hasInit) {
          first = true;
          writeUTFBytes(stream, "GIF89a");
          hasInit = true;
        }
      } else {
        first = Boolean(opts.first);
      }

      width = Math.max(0, Math.floor(width));
      height = Math.max(0, Math.floor(height));

      if (first) {
        if (!palette) {
          throw new Error("First frame must include a { palette } option");
        }
        encodeLogicalScreenDescriptor(stream, width, height, palette, colorDepth);
        encodeColorTable(stream, palette);
        if (repeat >= 0) {
          encodeNetscapeExt(stream, repeat);
        }
      }

      const delayTime = Math.round(delay / 10);
      encodeGraphicControlExt(stream, dispose, delayTime, transparent, transparentIndex);

      const useLocalColorTable = Boolean(palette) && !first;
      encodeImageDescriptor(stream, width, height, useLocalColorTable ? palette : null);

      if (useLocalColorTable && palette) {
        encodeColorTable(stream, palette);
      }

      lzwEncode(width, height, index, colorDepth, stream, accum, htab, codetab);
    }
  };

  function encodeGraphicControlExt(stream: ReturnType<typeof createStream>, dispose: number, delay: number, transparent: boolean, transparentIndex: number) {
    stream.writeByte(0x21);
    stream.writeByte(0xf9);
    stream.writeByte(4);

    if (transparentIndex < 0) {
      transparentIndex = 0;
      transparent = false;
    }

    let transp, disp;
    if (!transparent) {
      transp = 0;
      disp = 0;
    } else {
      transp = 1;
      disp = 2;
    }

    if (dispose >= 0) {
      disp = dispose & 7;
    }
    disp <<= 2;

    const userInput = 0;
    stream.writeByte(0 | disp | userInput | transp);
    writeUInt16(stream, delay);
    stream.writeByte(transparentIndex || 0);
    stream.writeByte(0);
  }

  function encodeLogicalScreenDescriptor(stream: ReturnType<typeof createStream>, width: number, height: number, palette: number[][], colorDepth = 8) {
    const globalColorTableFlag = 1;
    const sortFlag = 0;
    const globalColorSize = colorTableSize(palette.length) - 1;
    const fields = (globalColorTableFlag << 7) | ((colorDepth - 1) << 4) | (sortFlag << 3) | globalColorSize;
    const backgroundColorIndex = 0;
    const pixelAspectRatio = 0;
    writeUInt16(stream, width);
    writeUInt16(stream, height);
    stream.writeBytes([fields, backgroundColorIndex, pixelAspectRatio]);
  }

  function encodeNetscapeExt(stream: ReturnType<typeof createStream>, repeat: number) {
    stream.writeByte(0x21);
    stream.writeByte(0xff);
    stream.writeByte(11);
    writeUTFBytes(stream, "NETSCAPE2.0");
    stream.writeByte(3);
    stream.writeByte(1);
    writeUInt16(stream, repeat);
    stream.writeByte(0);
  }

  function encodeColorTable(stream: ReturnType<typeof createStream>, palette: number[][]) {
    const tableSize = colorTableSize(palette.length);
    const colorTableLength = 1 << tableSize;
    for (let i = 0; i < colorTableLength; i++) {
      let color = [0, 0, 0];
      if (i < palette.length) {
        color = palette[i];
      }
      stream.writeByte(color[0]);
      stream.writeByte(color[1]);
      stream.writeByte(color[2]);
    }
  }

  function encodeImageDescriptor(stream: ReturnType<typeof createStream>, width: number, height: number, localPalette: number[][] | null) {
    stream.writeByte(0x2c);
    writeUInt16(stream, 0);
    writeUInt16(stream, 0);
    writeUInt16(stream, width);
    writeUInt16(stream, height);
    if (localPalette) {
      const interlace = 0;
      const sorted = 0;
      const palSize = colorTableSize(localPalette.length) - 1;
      stream.writeByte(0x80 | interlace | sorted | 0 | palSize);
    } else {
      stream.writeByte(0);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

function sqr(value: number) {
  return value * value;
}

interface Bin {
  ac: number;
  rc: number;
  gc: number;
  bc: number;
  cnt: number;
  nn: number;
  fw: number;
  bk: number;
  tm: number;
  mtm: number;
  err: number;
}

function find_nn(bins: (Bin | null)[], idx: number, hasAlpha: boolean) {
  let nn = 0;
  let err = 1e100;
  const bin1 = bins[idx]!;
  const n1 = bin1.cnt;
  const wa = bin1.ac;
  const wr = bin1.rc;
  const wg = bin1.gc;
  const wb = bin1.bc;

  for (let i = bin1.fw; i !== 0; i = bins[i]!.fw) {
    const bin = bins[i]!;
    const n2 = bin.cnt;
    const nerr2 = (n1 * n2) / (n1 + n2);
    if (nerr2 >= err) continue;

    let nerr = 0;
    if (hasAlpha) {
      nerr += nerr2 * sqr(bin.ac - wa);
      if (nerr >= err) continue;
    }
    nerr += nerr2 * sqr(bin.rc - wr);
    if (nerr >= err) continue;
    nerr += nerr2 * sqr(bin.gc - wg);
    if (nerr >= err) continue;
    nerr += nerr2 * sqr(bin.bc - wb);
    if (nerr >= err) continue;

    err = nerr;
    nn = i;
  }
  bin1.err = err;
  bin1.nn = nn;
}

function create_bin(): Bin {
  return {
    ac: 0, rc: 0, gc: 0, bc: 0, cnt: 0, nn: 0, fw: 0, bk: 0, tm: 0, mtm: 0, err: 0
  };
}

function rgb888_to_rgb565(r: number, g: number, b: number) {
  return (r << 8 & 63488) | (g << 2 & 992) | (b >> 3);
}

export interface QuantizeOptions {
  clearAlpha?: boolean;
  clearAlphaColor?: number;
  clearAlphaThreshold?: number;
  oneBitAlpha?: boolean | number;
  useSqrt?: boolean;
}

export function quantize(rgba: Uint8Array, maxColors: number, opts: QuantizeOptions = {}) {
  const {
    clearAlpha = true,
    clearAlphaColor = 0,
    clearAlphaThreshold = 0,
    oneBitAlpha = false
  } = opts;

  const data = new Uint32Array(rgba.buffer);
  let useSqrt = opts.useSqrt !== false;
  const bins: (Bin | null)[] = new Array(65536);
  
  for (let i = 0; i < data.length; ++i) {
    const color = data[i];
    const a = (color >> 24) & 255;
    const b = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const r = color & 255;
    const index = rgb888_to_rgb565(r, g, b);
    const bin = bins[index] || (bins[index] = create_bin());
    bin.rc += r;
    bin.gc += g;
    bin.bc += b;
    bin.ac += a;
    bin.cnt++;
  }

  let maxbins = 0;
  for (let i = 0; i < 65536; ++i) {
    const bin = bins[i];
    if (bin != null) {
      const d = 1 / bin.cnt;
      bin.rc *= d;
      bin.gc *= d;
      bin.bc *= d;
      bin.ac *= d;
      bins[maxbins++] = bin;
    }
  }

  if (sqr(maxColors) / maxbins < 0.022) {
    useSqrt = false;
  }

  let i = 0;
  for (; i < maxbins - 1; ++i) {
    bins[i]!.fw = i + 1;
    bins[i + 1]!.bk = i;
    if (useSqrt) bins[i]!.cnt = Math.sqrt(bins[i]!.cnt);
  }
  if (useSqrt) bins[i]!.cnt = Math.sqrt(bins[i]!.cnt);

  const heap = new Uint32Array(65536 + 1);
  for (i = 0; i < maxbins; ++i) {
    find_nn(bins, i, false);
    const err = bins[i]!.err;
    let l, l2, h;
    for (l = ++heap[0]; l > 1; l = l2) {
      l2 = l >> 1;
      if (bins[h = heap[l2]]!.err <= err) break;
      heap[l] = h;
    }
    heap[l] = i;
  }

  const extbins = maxbins - maxColors;
  for (i = 0; i < extbins; ) {
    let b1;
    let tb;
    for (;;) {
      b1 = heap[1];
      tb = bins[b1]!;
      if (tb.tm >= tb.mtm && bins[tb.nn]!.mtm <= tb.tm) break;
      if (tb.mtm === 65535) b1 = heap[1] = heap[heap[0]--];
      else {
        find_nn(bins, b1, false);
        tb.tm = i;
      }
      const err = bins[b1]!.err;
      let l, l2, h;
      for (l = 1; (l2 = l + l) <= heap[0]; l = l2) {
        if (l2 < heap[0] && bins[heap[l2]]!.err > bins[heap[l2 + 1]]!.err) l2++;
        if (err <= bins[h = heap[l2]]!.err) break;
        heap[l] = h;
      }
      heap[l] = b1;
    }
    const nb = bins[tb.nn]!;
    const n1 = tb.cnt;
    const n2 = nb.cnt;
    const d = 1 / (n1 + n2);
    tb.rc = d * (n1 * tb.rc + n2 * nb.rc);
    tb.gc = d * (n1 * tb.gc + n2 * nb.gc);
    tb.bc = d * (n1 * tb.bc + n2 * nb.bc);
    tb.ac = d * (n1 * tb.ac + n2 * nb.ac);
    tb.cnt += nb.cnt;
    tb.mtm = ++i;
    bins[nb.bk]!.fw = nb.fw;
    bins[nb.fw]!.bk = nb.bk;
    nb.mtm = 65535;
  }

  const palette: number[][] = [];
  i = 0;
  for (;;) {
    let r = clamp(Math.round(bins[i]!.rc), 0, 255);
    let g = clamp(Math.round(bins[i]!.gc), 0, 255);
    let b = clamp(Math.round(bins[i]!.bc), 0, 255);
    let a = 255;
    
    a = clamp(Math.round(bins[i]!.ac), 0, 255);
    if (oneBitAlpha) {
      const threshold = typeof oneBitAlpha === "number" ? oneBitAlpha : 127;
      a = a <= threshold ? 0 : 255;
    }
    if (clearAlpha && a <= clearAlphaThreshold) {
      r = g = b = clearAlphaColor;
      a = 0;
    }

    const color = [r, g, b, a];
    if (!palette.some(p => p[0] === r && p[1] === g && p[2] === b && p[3] === a)) {
      palette.push(color);
    }
    
    const next = bins[i]!.fw;
    if (next === 0) break;
    i = next;
  }
  return palette;
}

export function applyPalette(rgba: Uint8Array, palette: number[][]) {
  const data = new Uint32Array(rgba.buffer);
  const index = new Uint8Array(data.length);
  const cache: Record<number, number> = {};

  for (let i = 0; i < data.length; i++) {
    const color = data[i];
    const a = (color >> 24) & 255;
    const b = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const r = color & 255;
    
    const key = rgb888_to_rgb565(r, g, b) | (a << 16);
    if (key in cache) {
      index[i] = cache[key];
    } else {
      let minDist = 1e100;
      let bestIdx = 0;
      for (let j = 0; j < palette.length; j++) {
        const p = palette[j];
        const dist = sqr(r - p[0]) + sqr(g - p[1]) + sqr(b - p[2]) + sqr(a - (p[3] ?? 255));
        if (dist < minDist) {
          minDist = dist;
          bestIdx = j;
        }
      }
      cache[key] = bestIdx;
      index[i] = bestIdx;
    }
  }
  return index;
}
