// ─── Math helpers ─────────────────────────────────────────────────────────────
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export const rad = (x, y) => Math.sqrt(x * x + y * y);

export function countOverlaps(shots) {
  const m = {};
  shots.forEach((s) => {
    const k = `${s.x},${s.y}`;
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}

export function calcStats(shots, sessionFields) {
  // Legacy accuracy stats — only when x + y fields present
  const hasXY = !sessionFields || (sessionFields.some((f) => f.key === "x") && sessionFields.some((f) => f.key === "y"));
  const hasFps = !sessionFields || sessionFields.some((f) => f.key === "fps");
  const v = hasXY
    ? shots.filter((s) => { const d = s.data || s; return !isNaN(d.x) && !isNaN(d.y); })
    : shots;

  let cep = 0, r90 = 0, mpiX = 0, mpiY = 0, mr = 0, es = 0, sdR = 0, covEllipse = null, sdX = 0, sdY = 0;

  if (hasXY && v.length >= 2) {
    const xs = v.map((s) => (s.data || s).x);
    const ys = v.map((s) => (s.data || s).y);
    mpiX = mean(xs);
    mpiY = mean(ys);
    const radii = v.map((s) => rad((s.data || s).x - mpiX, (s.data || s).y - mpiY));
    const sorted = [...radii].sort((a, b) => a - b);
    cep = sorted[Math.floor(sorted.length * 0.5)] || 0;
    r90 = sorted[Math.min(Math.floor(sorted.length * 0.9), sorted.length - 1)] || 0;
    mr = mean(radii);
    es = Math.max(...radii) * 2;
    sdR = std(radii);
    sdX = std(xs);
    sdY = std(ys);

    if (v.length >= 3) {
      const cx = xs.map((q) => q - mpiX);
      const cy = ys.map((q) => q - mpiY);
      const n = cx.length;
      const sxx = cx.reduce((s2, q) => s2 + q * q, 0) / (n - 1);
      const syy = cy.reduce((s2, q) => s2 + q * q, 0) / (n - 1);
      const sxy = cx.reduce((s2, q, i) => s2 + q * cy[i], 0) / (n - 1);
      const t = Math.atan2(2 * sxy, sxx - syy) / 2;
      const k = 2.146;
      const a2 = (sxx + syy) / 2 + Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
      const b2 = (sxx + syy) / 2 - Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
      covEllipse = {
        rx: Math.sqrt(Math.max(a2, 0.001) * k),
        ry: Math.sqrt(Math.max(b2, 0.001) * k),
        angle: (t * 180) / Math.PI,
      };
    }
  }

  // Velocity stats — only when fps field present
  let sdV = 0, meanV = 0, esV = 0;
  if (hasFps) {
    const vs = shots.map((s) => (s.data || s).fps).filter((val) => val !== null && val !== undefined && !isNaN(val));
    if (vs.length >= 2) { sdV = std(vs); meanV = mean(vs); esV = Math.max(...vs) - Math.min(...vs); }
    else if (vs.length === 1) { meanV = vs[0]; }
  }

  // Dynamic per-field stats
  const fieldStats = {};
  if (sessionFields) {
    for (const f of sessionFields) {
      if (f.type === "number" && !["x", "y", "fps"].includes(f.key)) {
        const vals = shots.map((s) => (s.data || s)[f.key]).filter((val) => val !== null && val !== undefined && !isNaN(val));
        fieldStats[f.key] = {
          type: "number", label: f.label, unit: f.unit || "",
          mean: vals.length >= 1 ? mean(vals) : null,
          sd: vals.length >= 2 ? std(vals) : null,
          es: vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null,
          min: vals.length >= 1 ? Math.min(...vals) : null,
          max: vals.length >= 1 ? Math.max(...vals) : null,
          n: vals.length,
        };
      } else if (f.type === "yesno") {
        const vals = shots.map((s) => (s.data || s)[f.key]).filter((val) => val !== null && val !== undefined);
        const yesCount = vals.filter((val) => val === true).length;
        fieldStats[f.key] = {
          type: "yesno", label: f.label,
          yes: yesCount, no: vals.length - yesCount, total: vals.length,
          pct: vals.length > 0 ? Math.round((yesCount / vals.length) * 100) : 0,
        };
      } else if (f.type === "dropdown") {
        const vals = shots.map((s) => (s.data || s)[f.key]).filter((val) => val !== null && val !== undefined);
        const counts = {};
        for (const val of vals) counts[val] = (counts[val] || 0) + 1;
        fieldStats[f.key] = { type: "dropdown", label: f.label, counts, total: vals.length };
      }
    }
  }

  return { cep, r90, mpiX, mpiY, mr, es, sdR, sdV, meanV, esV, covEllipse, n: v.length, sdX, sdY, fieldStats, hasXY, hasFps };
}

export function makeSerial(cfg, num, offset) {
  const prefix = cfg.serialPrefix || `SP1-03 ${cfg.rifleRate || ""}RR`;
  return `${prefix} ${String(offset + num).padStart(2, "0")}`;
}
