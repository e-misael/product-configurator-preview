// Generates the synthetic demonstration PNGs under src/demo/public/catalog (D-036).
//
// The images are deliberately NOT photographs: flat colors, hatched borders,
// an outlined text area, and a "DEMO" stamp. They exist only to exercise the
// preview with deterministic geometry (square, rectangle, circle, frame back
// and front layers). Dimensions and boxes below must match
// src/demo/demo-catalog.ts; tests/unit/demo checks that they do.
//
// Run: npm run generate:demo-assets   (output is committed)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = 'src/demo/public/catalog';
const TRANSPARENT = [0, 0, 0, 0];

/** Fractions of the image, as in the catalog's NormalizedBox. */
const OBJECT_BOUNDS = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
const SQUARE_TEXT_AREA = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 };
const CIRCLE_TEXT_AREA = { x: 0.25, y: 0.35, width: 0.5, height: 0.3 };

const NUDE = {
  base: [226, 208, 186],
  hatch: [
    [190, 168, 142],
    [206, 186, 160],
  ],
};
const COLORED = {
  base: [112, 152, 196],
  hatch: [
    [78, 116, 160],
    [96, 134, 178],
  ],
};
const GREEN = {
  base: [132, 176, 120],
  hatch: [
    [96, 140, 84],
    [114, 158, 102],
  ],
};
const WOOD_LIGHT = {
  hatch: [
    [150, 118, 84],
    [132, 102, 70],
  ],
};
const WOOD_DARK = {
  hatch: [
    [88, 70, 56],
    [72, 56, 44],
  ],
};
const BACKING = [236, 236, 232];
const RIM = [60, 40, 24];
const OUTLINE = [70, 70, 70];
const STAMP = [90, 90, 90];

// 5x7 glyphs for the only letters needed.
const GLYPHS = {
  D: ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
  E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
  M: ['1...1', '11.11', '1.1.1', '1...1', '1...1', '1...1', '1...1'],
  O: ['.111.', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
};
const STAMP_SCALE = 3;
const STAMP_WIDTH = (4 * 5 + 3) * STAMP_SCALE;

/** Whether (x, y) is inside the "DEMO" stamp whose top-left is (left, top). */
function inStamp(x, y, left, top) {
  const gx = Math.floor((x - left) / STAMP_SCALE);
  const gy = Math.floor((y - top) / STAMP_SCALE);
  if (gx < 0 || gy < 0 || gy >= 7 || gx >= 23) return false;
  const glyph = 'DEMO'[Math.floor(gx / 6)];
  const col = gx % 6;
  return col < 5 && GLYPHS[glyph][gy][col] === '1';
}

function inBox(x, y, box, w, h) {
  return (
    x >= box.x * w && x < (box.x + box.width) * w && y >= box.y * h && y < (box.y + box.height) * h
  );
}

function onOutline(x, y, box, w, h, thickness = 2) {
  const outer = inBox(x, y, box, w, h);
  const inner = inBox(
    x,
    y,
    {
      x: box.x + thickness / w,
      y: box.y + thickness / h,
      width: box.width - (2 * thickness) / w,
      height: box.height - (2 * thickness) / h,
    },
    w,
    h,
  );
  return outer && !inner;
}

const hatchColor = (palette, x, y) => palette.hatch[((x + y) >> 3) & 1];

function plateImage({ width, height, shape, palette, textArea }) {
  const cx = width / 2;
  const cy = height / 2;
  const stampLeft = Math.round((width - STAMP_WIDTH) / 2);
  const stampTop = Math.round(OBJECT_BOUNDS.y * height + 24);
  return paintImage(width, height, (x, y) => {
    let inside;
    let edgeDistance;
    if (shape === 'circle') {
      const radius = (OBJECT_BOUNDS.width * width) / 2;
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      inside = distance <= radius;
      edgeDistance = radius - distance;
    } else {
      inside = inBox(x, y, OBJECT_BOUNDS, width, height);
      const left = x - OBJECT_BOUNDS.x * width;
      const top = y - OBJECT_BOUNDS.y * height;
      edgeDistance = Math.min(
        left,
        top,
        (OBJECT_BOUNDS.x + OBJECT_BOUNDS.width) * width - 1 - x,
        (OBJECT_BOUNDS.y + OBJECT_BOUNDS.height) * height - 1 - y,
      );
    }
    if (!inside) return TRANSPARENT;
    if (inStamp(x, y, stampLeft, stampTop)) return STAMP;
    if (onOutline(x, y, textArea, width, height)) return OUTLINE;
    if (edgeDistance < 8) return hatchColor(palette, x, y);
    return palette.base;
  });
}

function frameBack({ width, height, placement, palette }) {
  const stampLeft = Math.round((width - STAMP_WIDTH) / 2);
  const stampTop = 14;
  return paintImage(width, height, (x, y) => {
    if (inStamp(x, y, stampLeft, stampTop)) return STAMP;
    return inBox(x, y, placement, width, height) ? BACKING : hatchColor(palette, x, y);
  });
}

/** Opaque rim just inside the opening, drawn above the plate; transparent elsewhere. */
function frameFront({ width, height, placement }) {
  const rim = 10;
  const inner = {
    x: placement.x + rim / width,
    y: placement.y + rim / height,
    width: placement.width - (2 * rim) / width,
    height: placement.height - (2 * rim) / height,
  };
  return paintImage(width, height, (x, y) =>
    inBox(x, y, placement, width, height) && !inBox(x, y, inner, width, height) ? RIM : TRANSPARENT,
  );
}

function paintImage(width, height, paint) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      pixels.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, pixels };
}

// --- Minimal deterministic PNG encoder (RGBA, 8-bit) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width * 4 + 1);
    rows[offset] = 0; // filter: none
    rows.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), offset + 1);
  }
  const text = Buffer.from(
    'Comment\0Synthetic demonstration image - not a Taavi product photograph',
    'latin1',
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('tEXt', text),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Asset list ---

const SQUARE = { width: 400, height: 400, shape: 'square', textArea: SQUARE_TEXT_AREA };
const RECTANGLE = { width: 600, height: 400, shape: 'rectangle', textArea: SQUARE_TEXT_AREA };
const CIRCLE = { width: 400, height: 400, shape: 'circle', textArea: CIRCLE_TEXT_AREA };
const SQUARE_FRAME = { width: 500, height: 500, placement: OBJECT_BOUNDS };
const RECTANGLE_FRAME = { width: 600, height: 400, placement: OBJECT_BOUNDS };

const assets = {
  'plates/demo-placa-quadrada/nude.png': plateImage({ ...SQUARE, palette: NUDE }),
  'plates/demo-placa-quadrada/colored.png': plateImage({ ...SQUARE, palette: COLORED }),
  'plates/demo-placa-quadrada/demo-cor-colorida.png': plateImage({ ...SQUARE, palette: GREEN }),
  'plates/demo-placa-retangular/nude.png': plateImage({ ...RECTANGLE, palette: NUDE }),
  'plates/demo-placa-retangular/colored.png': plateImage({ ...RECTANGLE, palette: COLORED }),
  'plates/demo-placa-redonda/nude.png': plateImage({ ...CIRCLE, palette: NUDE }),
  'frames/demo-quadro-universal/quadrada-back.png': frameBack({
    ...SQUARE_FRAME,
    palette: WOOD_LIGHT,
  }),
  'frames/demo-quadro-universal/quadrada-front.png': frameFront(SQUARE_FRAME),
  'frames/demo-quadro-universal/retangular-back.png': frameBack({
    ...RECTANGLE_FRAME,
    palette: WOOD_LIGHT,
  }),
  'frames/demo-quadro-universal/retangular-front.png': frameFront(RECTANGLE_FRAME),
  'frames/demo-quadro-quadrado/quadrada-back.png': frameBack({
    ...SQUARE_FRAME,
    palette: WOOD_DARK,
  }),
  'frames/demo-quadro-quadrado/quadrada-front.png': frameFront(SQUARE_FRAME),
};

for (const [path, image] of Object.entries(assets)) {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(image));
  console.log(`${file} (${image.width}x${image.height})`);
}
