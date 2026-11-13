// src/engineer.js
// The engineer's view: fold lines, glue tabs and mechanism names drawn over the picture on a 2D canvas.
// Valley folds are dashed, mountain folds dash-dot, glue lines dotted (the usual paper-engineering marks).

const STYLE = {
  valley: { colour: '#1668c7', dash: [9, 6], width: 2 },
  mountain: { colour: '#d2372b', dash: [12, 5, 2, 5], width: 2 },
  glue: { colour: '#0d8f86', dash: [2, 5], width: 2 },
};

export function createEngineer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  function resize(cssW, cssH, ratio) {
    w = cssW; h = cssH; dpr = ratio;
    canvas.width = Math.round(cssW * ratio); canvas.height = Math.round(cssH * ratio);
  }

  // World point to CSS pixels, or null if behind the camera.
  function project(m, p) {
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const q = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (q <= 0.01) return null;
    return [(x / q * 0.5 + 0.5) * w, (0.5 - y / q * 0.5) * h];
  }

  // book: from createBook. viewProj: the camera matrix. amount: 0..1 fade.
  function draw(book, viewProj, amount) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (amount <= 0.01) return;
    ctx.globalAlpha = amount;
    ctx.lineCap = 'round';
    for (let k = 1; k < book.spreads.length; k++) {
      if (book.opening(k) < 0.35) continue;
      const s = book.spreads[k];
      for (const t of s.tabs) {
        const pts = t.shape.map(([x, y]) => project(viewProj, t.frame.point(x, y, t.z)));
        if (pts.some((p) => !p)) continue;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fillStyle = 'rgba(20, 150, 170, 0.28)';
        ctx.fill();
      }
      // the spine itself is a valley fold
      const g = book.folds[k];
      const lines = [{ frame: g.A, a: [0, 0, 0.01], b: [0, 30, 0.01], kind: 'valley' }, ...s.creases.map((c) => ({ ...c, kind: book.creaseKind(c) }))];
      for (const c of lines) {
        const a = project(viewProj, c.frame.point(...c.a)), b = project(viewProj, c.frame.point(...c.b));
        if (!a || !b) continue;
        const st = STYLE[c.kind];
        ctx.setLineDash(st.dash);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = st.width + 2.5;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.strokeStyle = st.colour; ctx.lineWidth = st.width;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = '600 13px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      for (const l of s.labels) {
        const p = project(viewProj, l.frame.point(...l.p));
        if (!p) continue;
        const tw = ctx.measureText(l.text).width;
        const x = p[0] + 14, y = p[1] - 18;
        ctx.strokeStyle = '#16212b'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fillStyle = '#16212b'; ctx.fill();
        ctx.fillStyle = 'rgba(250, 248, 240, 0.94)';
        ctx.beginPath(); ctx.roundRect(x - 2, y - 11, tw + 16, 22, 5); ctx.fill();
        ctx.fillStyle = '#16212b';
        ctx.fillText(l.text, x + 6, y + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  return { resize, draw, project: (m, p) => project(m, p) };
}
