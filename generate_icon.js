const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0);
  const cv = Buffer.alloc(4); cv.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([lb, tb, data, cv]);
}
function makePNG(w, h, pixels) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * (1 + w * 4) + 1 + x * 4;
      raw[di] = pixels[si]; raw[di+1] = pixels[si+1];
      raw[di+2] = pixels[si+2]; raw[di+3] = pixels[si+3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function setPixel(pixels, w, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w || y >= w) return;
  const i = (y * w + x) * 4;
  const sa = a / 255, da = pixels[i+3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  pixels[i]   = Math.round((r * sa + pixels[i]   * da * (1-sa)) / oa);
  pixels[i+1] = Math.round((g * sa + pixels[i+1] * da * (1-sa)) / oa);
  pixels[i+2] = Math.round((b * sa + pixels[i+2] * da * (1-sa)) / oa);
  pixels[i+3] = Math.round(oa * 255);
}

function fillCircle(pixels, w, cx, cy, r, R, G, B, A) {
  for (let y = Math.max(0,Math.floor(cy-r)); y <= Math.min(w-1,Math.ceil(cy+r)); y++) {
    for (let x = Math.max(0,Math.floor(cx-r)); x <= Math.min(w-1,Math.ceil(cx+r)); x++) {
      const dist = Math.sqrt((x-cx)**2+(y-cy)**2);
      if (dist <= r) {
        const alpha = dist > r-1 ? Math.round((r-dist)*A) : A;
        setPixel(pixels, w, x, y, R, G, B, alpha);
      }
    }
  }
}

function fillRoundRect(pixels, w, x0, y0, x1, y1, rx, R, G, B, A) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Corner rounding
      let inside = true;
      if (x < x0+rx && y < y0+rx) inside = Math.sqrt((x-x0-rx)**2+(y-y0-rx)**2) <= rx;
      else if (x > x1-rx && y < y0+rx) inside = Math.sqrt((x-x1+rx)**2+(y-y0-rx)**2) <= rx;
      else if (x < x0+rx && y > y1-rx) inside = Math.sqrt((x-x0-rx)**2+(y-y1+rx)**2) <= rx;
      else if (x > x1-rx && y > y1-rx) inside = Math.sqrt((x-x1+rx)**2+(y-y1+rx)**2) <= rx;
      if (inside) setPixel(pixels, w, x, y, R, G, B, A);
    }
  }
}

function fillDroplet(pixels, w, cx, cy, size, R, G, B, A) {
  const cr = size * 0.52;
  const bcy = cy + size * 0.12;
  fillCircle(pixels, w, cx, bcy, cr, R, G, B, A);
  const tipY = cy - size * 0.85;
  for (let y = Math.floor(tipY); y <= Math.ceil(bcy - cr * 0.65); y++) {
    const t = (y - tipY) / (bcy - cr * 0.65 - tipY);
    const hw = cr * t * 1.05;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const edge = Math.min(cx + hw - x, x - (cx - hw), 1);
      setPixel(pixels, w, x, y, R, G, B, Math.round(edge * A));
    }
  }
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;

  // Dark background: #0F0A1A = 15,10,26
  for (let i = 0; i < size * size; i++) {
    pixels[i*4]=15; pixels[i*4+1]=10; pixels[i*4+2]=26; pixels[i*4+3]=255;
  }

  // Subtle radial gradient lighter center
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x-cx, dy = y-cy;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const fade = Math.max(0, 1 - dist/(size*0.6));
      const boost = Math.round(fade * 20);
      const i = (y*size+x)*4;
      pixels[i]   = Math.min(255, pixels[i]+boost);
      pixels[i+1] = Math.min(255, pixels[i+1]+boost);
      pixels[i+2] = Math.min(255, pixels[i+2]+boost+boost);
    }
  }

  // Outer ring: #3B2A65 = 59,42,101
  const outerR = size * 0.46;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x-cx)**2+(y-cy)**2);
      if (dist >= outerR-1 && dist <= outerR+1) {
        const a = Math.round(Math.min(dist-outerR+1, outerR+1-dist, 1) * 120);
        setPixel(pixels, size, x, y, 59, 42, 101, a);
      }
    }
  }

  // Inner circle bg: #211640 = 33,22,64
  fillCircle(pixels, size, cx, cy, size*0.41, 33, 22, 64, 255);

  // Second ring inside: #3B2A65
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x-cx)**2+(y-cy)**2);
      const r = size*0.41;
      if (dist >= r-1.5 && dist <= r) {
        setPixel(pixels, size, x, y, 59, 42, 101, 180);
      }
    }
  }

  // Main droplet: bright purple #8B5CF6 = 139,92,246
  fillDroplet(pixels, size, cx, cy * 0.95, size * 0.27, 139, 92, 246, 255);

  // Two accent droplets: lighter #A78BFA = 167,139,250
  fillDroplet(pixels, size, cx - size*0.155, cy + size*0.09, size*0.12, 167, 139, 250, 200);
  fillDroplet(pixels, size, cx + size*0.155, cy + size*0.09, size*0.12, 167, 139, 250, 200);

  // Shine on main droplet: white glow
  fillCircle(pixels, size, cx - size*0.05, cy - size*0.14, size*0.045, 255, 255, 255, 160);

  // Small star dots (sparkle effect) — top right of droplet
  const sd = size * 0.06;
  fillCircle(pixels, size, cx + size*0.15, cy - size*0.3, sd*0.4, 196, 181, 253, 220);
  fillCircle(pixels, size, cx + size*0.22, cy - size*0.18, sd*0.25, 196, 181, 253, 180);
  fillCircle(pixels, size, cx + size*0.10, cy - size*0.22, sd*0.2, 255, 255, 255, 140);

  return makePNG(size, size, pixels);
}

const sizes = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

const resDir = 'C:\\stp\\android\\app\\src\\main\\res';
for (const [dir, size] of Object.entries(sizes)) {
  const data = generateIcon(size);
  fs.writeFileSync(path.join(resDir, dir, 'ic_launcher.png'), data);
  fs.writeFileSync(path.join(resDir, dir, 'ic_launcher_round.png'), data);
  console.log(`✓ ${dir}: ${size}x${size}`);
}
console.log('Done!');
