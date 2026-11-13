// engine/atlas.js
// A print atlas: many small drawings (one per printed card part) packed into one canvas.
// Each drawing is made with the Canvas 2D API in the part's own units (cm, y up), so the same
// outline points serve for cutting the card and for printing on it.

const PAD = 3;   // pixels of bleed round every rectangle, so neighbours never show at a mip level

// Shelf packing: tallest first, left to right, new shelf when a row is full. Sets x, y on each item.
export function packShelves(items, W, H) {
  const order = items.slice().sort((a, b) => b.h - a.h);
  let x = 0, y = 0, shelf = 0;
  for (const it of order) {
    if (it.w > W) return false;
    if (x + it.w > W) { x = 0; y += shelf; shelf = 0; }
    if (y + it.h > H) return false;
    it.x = x; it.y = y;
    x += it.w;
    shelf = Math.max(shelf, it.h);
  }
  return true;
}

// prints: [{ box: [x0, y0, x1, y1] in cm, base: css colour, draw(ctx, density) }]
// Returns { canvas, density, uv: [fn(x, y) -> [u, v]] } with one uv function per print, in order.
// density (pixels per cm) starts at maxDensity and comes down until everything fits.
export function buildAtlas(prints, size, maxDensity, background = '#f1ece0') {
  let density = maxDensity;
  let items;
  for (let tries = 0; tries < 60; tries++) {
    items = prints.map((p) => ({
      w: Math.ceil((p.box[2] - p.box[0]) * density) + PAD * 2,
      h: Math.ceil((p.box[3] - p.box[1]) * density) + PAD * 2,
    }));
    if (packShelves(items, size, size)) break;
    density *= 0.94;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const uv = [];
  prints.forEach((p, i) => {
    const it = items[i];
    const [x0, , , y1] = p.box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(it.x, it.y, it.w, it.h);
    ctx.clip();
    ctx.fillStyle = p.base;
    ctx.fillRect(it.x, it.y, it.w, it.h);
    // cm, y up, origin at the box's top left corner plus the bleed
    ctx.translate(it.x + PAD - x0 * density, it.y + PAD + y1 * density);
    ctx.scale(density, -density);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    p.draw(ctx, density);
    ctx.restore();
    const ox = it.x + PAD, oy = it.y + PAD;
    uv.push((x, y) => [(ox + (x - x0) * density) / size, (oy + (y1 - y) * density) / size]);
  });
  return { canvas, density, uv };
}
