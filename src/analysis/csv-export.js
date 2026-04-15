import { DEFAULT_FIELDS } from "./constants.js";

export function esc(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

export function rowC(a) {
  return a.map(esc).join(",");
}

export function dl(t, fn, m) {
  const b = new Blob([t], { type: m });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = fn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(u);
}

export function exportMasterCsv(log, vars) {
  const allFieldKeys = [];
  const allFieldLabels = {};
  log.forEach((s) => {
    const sf = s.config.fields || DEFAULT_FIELDS;
    sf.forEach((f) => {
      if (!allFieldKeys.includes(f.key)) {
        allFieldKeys.push(f.key);
        allFieldLabels[f.key] = f.unit ? `${f.label} (${f.unit})` : f.label;
      }
    });
  });
  const h = ["Serial #", ...vars.map((v) => v.label), ...allFieldKeys.map((k) => allFieldLabels[k]), "Time Stamp", "Date", "Notes"];
  const rows = [rowC(h)];
  log.forEach((s) => {
    s.shots.forEach((sh) => {
      const d = sh.data || sh;
      rows.push(
        rowC([
          sh.serial,
          ...vars.map((v) => s.config[v.key] || ""),
          ...allFieldKeys.map((k) => {
            const val = d[k];
            if (val === true) return "Yes";
            if (val === false) return "No";
            return val ?? "";
          }),
          sh.timestamp || "", s.config.date || "", s.config.notes || "",
        ])
      );
    });
  });
  dl(rows.join("\n"), "Ballistic_Master.csv", "text/csv");
}

export function exportJson(log) {
  dl(JSON.stringify(log, null, 2), "Ballistic_All.json", "application/json");
}
