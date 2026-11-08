// Generates the synthetic demonstration PNGs under src/demo/public/catalog (D-036).
//
// The images are deliberately NOT photographs: flat colors, hatched borders,
// an outlined text area, and a "DEMO" stamp. They exist only to exercise the
// preview with deterministic geometry (square and scalloped models, and the
// Quadro photographed assembled with its frame, D-046). Dimensions and boxes below must match
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
const SCALLOPED_TEXT_AREA = { x: 0.25, y: 0.35, width: 0.5, height: 0.3 };
/** The Quadro's ceramic inside its wooden frame; the frame fills the rest of OBJECT_BOUNDS. */
const QUADRO_CERAMIC = { x: 0.18, y: 0.18, width: 0.64, height: 0.64 };
const QUADRO_TEXT_AREA = { x: 0.25, y: 0.35, width: 0.5, height: 0.3 };

const BEGE = {
  base: [226, 208, 186],
  hatch: [
    [190, 168, 142],
    [206, 186, 160],
  ],
};
const WOOD = {
  hatch: [
    [150, 118, 84],
    [132, 102, 70],
  ],
};
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

/** Paint function for a ceramic object within `bounds`; transparent outside it. */
function ceramic({ width, height, shape, palette, textArea, bounds = OBJECT_BOUNDS }) {
  const cx = width / 2;
  const cy = height / 2;
  const stampLeft = Math.round((width - STAMP_WIDTH) / 2);
  const stampTop = Math.round(bounds.y * height + 24);
  return (x, y) => {
    let inside;
    let edgeDistance;
    if (shape === 'scalloped') {
      // Wavy outline: 12 gentle lobes around a circle.
      const base = (bounds.width * width) / 2;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const radius = base * (0.95 + 0.05 * Math.cos(12 * Math.atan2(dy, dx)));
      const distance = Math.hypot(dx, dy);
      inside = distance <= radius;
      edgeDistance = radius - distance;
    } else {
      inside = inBox(x, y, bounds, width, height);
      const left = x - bounds.x * width;
      const top = y - bounds.y * height;
      edgeDistance = Math.min(
        left,
        top,
        (bounds.x + bounds.width) * width - 1 - x,
        (bounds.y + bounds.height) * height - 1 - y,
      );
    }
    if (!inside) return TRANSPARENT;
    if (inStamp(x, y, stampLeft, stampTop)) return STAMP;
    if (onOutline(x, y, textArea, width, height)) return OUTLINE;
    if (edgeDistance < 8) return hatchColor(palette, x, y);
    return palette.base;
  };
}

function plateImage(spec) {
  return paintImage(spec.width, spec.height, ceramic(spec));
}

/** The Quadro as one assembled product: ceramic plate inside a wooden frame (D-046). */
function quadroImage(spec) {
  const plate = ceramic({ ...spec, bounds: QUADRO_CERAMIC });
  const rim = 4;
  const inner = {
    x: QUADRO_CERAMIC.x - rim / spec.width,
    y: QUADRO_CERAMIC.y - rim / spec.height,
    width: QUADRO_CERAMIC.width + (2 * rim) / spec.width,
    height: QUADRO_CERAMIC.height + (2 * rim) / spec.height,
  };
  return paintImage(spec.width, spec.height, (x, y) => {
    if (inBox(x, y, QUADRO_CERAMIC, spec.width, spec.height)) return plate(x, y);
    if (inBox(x, y, inner, spec.width, spec.height)) return RIM;
    if (inBox(x, y, OBJECT_BOUNDS, spec.width, spec.height)) return hatchColor(WOOD, x, y);
    return TRANSPARENT;
  });
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

const square = (size) => ({
  width: size,
  height: size,
  shape: 'square',
  textArea: SQUARE_TEXT_AREA,
});
const scalloped = (size) => ({
  width: size,
  height: size,
  shape: 'scalloped',
  textArea: SCALLOPED_TEXT_AREA,
});
const assets = {
  'plates/demo-placa-ceramica/bege.png': plateImage({ ...square(400), palette: BEGE }),
  'plates/demo-quadro/bege.png': quadroImage({
    ...square(480),
    textArea: QUADRO_TEXT_AREA,
    palette: BEGE,
  }),
  'plates/demo-bandeja-ondulada-m-8/bege.png': plateImage({ ...scalloped(320), palette: BEGE }),
  'plates/demo-bandeja-ondulada-g-11/bege.png': plateImage({ ...scalloped(440), palette: BEGE }),
};

for (const [path, image] of Object.entries(assets)) {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(image));
  console.log(`${file} (${image.width}x${image.height})`);
}
