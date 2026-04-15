/**
 * Build the widget registry for the Analysis page.
 *
 * Each widget: { key, label, category, requires(fields) -> bool, defaultSpan, render }
 * The render function is NOT defined here — it's mapped in AnalysisPage.jsx
 * so that this module stays free of JSX imports.
 *
 * Instead, each entry provides metadata; the AnalysisPage maps key -> component.
 */

/**
 * Build the full list of available widget definitions based on fields.
 *
 * @param {Array} allFields - Union of fields across all sessions
 * @param {Array} commonFields - Intersection of fields
 * @param {string} mode - 'single' or 'multi'
 * @returns {Object} registry keyed by widget key
 */
export function buildWidgetRegistry(allFields, commonFields, mode) {
  const registry = {};
  const fields = mode === "single" ? allFields : commonFields;

  // ─── Static widgets ──────────────────────────────────────────────────────────
  registry.dispersion = {
    key: "dispersion",
    label: "Shot Dispersion",
    category: "accuracy",
    requires: (f) => f.some((ff) => ff.key === "x") && f.some((ff) => ff.key === "y"),
    defaultSpan: "half",
  };

  registry.metricsSummary = {
    key: "metricsSummary",
    label: "Metrics Summary",
    category: "general",
    requires: () => true,
    defaultSpan: "half",
  };

  registry.customRankings = {
    key: "customRankings",
    label: "Custom Rankings",
    category: "general",
    requires: () => true,
    defaultSpan: "full",
  };

  registry.shotTable = {
    key: "shotTable",
    label: "Shot Table",
    category: "general",
    requires: () => true,
    defaultSpan: "full",
  };

  registry.attachments = {
    key: "attachments",
    label: "Attachments",
    category: "general",
    requires: () => true,
    defaultSpan: "full",
  };

  registry.correlationScatter = {
    key: "correlationScatter",
    label: "Correlation Scatter",
    category: "general",
    requires: (f) => f.filter((ff) => ff.type === "number").length >= 2,
    defaultSpan: "half",
  };

  // ─── Dynamic: single-metric ranking widgets ─────────────────────────────────
  const rankMetrics = [];
  const hasXY = fields.some((f) => f.key === "x") && fields.some((f) => f.key === "y");
  const hasFps = fields.some((f) => f.key === "fps");
  if (hasXY) {
    rankMetrics.push({ key: "cep", label: "CEP (50%)", dir: "lower" });
    rankMetrics.push({ key: "r90", label: "R90", dir: "lower" });
    rankMetrics.push({ key: "es", label: "Ext. Spread", dir: "lower" });
  }
  if (hasFps) {
    rankMetrics.push({ key: "meanV", label: "Mean FPS", dir: "higher" });
    rankMetrics.push({ key: "sdV", label: "SD FPS", dir: "lower" });
  }
  for (const f of fields) {
    if (f.type === "yesno") rankMetrics.push({ key: `yesno:${f.key}`, label: `${f.label} %`, dir: "higher" });
    if (f.type === "number" && !["x", "y", "fps"].includes(f.key)) rankMetrics.push({ key: `fieldMean:${f.key}`, label: `Mean ${f.label}`, dir: "higher" });
  }
  for (const m of rankMetrics) {
    const wKey = `singleRanking:${m.key}`;
    registry[wKey] = {
      key: wKey,
      label: `${m.label} Ranking`,
      category: "general",
      requires: () => true,
      defaultSpan: "half",
      metricKey: m.key,
      metricLabel: m.label,
      direction: m.dir,
    };
  }

  // ─── Dynamic: one attainment widget per yes/no field ─────────────────────────
  for (const f of fields) {
    if (f.type === "yesno") {
      const key = `attainment:${f.key}`;
      registry[key] = {
        key,
        label: `${f.label} Rate`,
        category: "general",
        requires: (flds) => flds.some((ff) => ff.key === f.key && ff.type === "yesno"),
        defaultSpan: "half",
        fieldKey: f.key,
        fieldLabel: f.label,
      };
    }

    // Dynamic: one distribution widget per number field (excluding x, y)
    if (f.type === "number" && !["x", "y"].includes(f.key)) {
      const key = `distribution:${f.key}`;
      registry[key] = {
        key,
        label: `${f.label} Distribution`,
        category: f.key === "fps" ? "velocity" : "custom",
        requires: (flds) => flds.some((ff) => ff.key === f.key && ff.type === "number"),
        defaultSpan: "half",
        fieldKey: f.key,
        fieldLabel: f.label,
        fieldUnit: f.unit || "",
      };
    }
  }

  return registry;
}

/**
 * Get available widgets that can be added (not already in layout, and requirements met).
 */
export function getAvailableWidgets(registry, currentLayout, fields) {
  const inLayout = new Set(currentLayout.map((item) => item.key));
  return Object.values(registry).filter(
    (w) => !inLayout.has(w.key) && w.requires(fields)
  );
}

/**
 * Categorize widgets for the "Add Widget" dropdown.
 */
export function categorizeWidgets(widgets) {
  const categories = {
    accuracy: { label: "Accuracy", items: [] },
    velocity: { label: "Velocity", items: [] },
    custom: { label: "Custom Fields", items: [] },
    general: { label: "General", items: [] },
  };
  for (const w of widgets) {
    const cat = categories[w.category] || categories.general;
    cat.items.push(w);
  }
  return Object.values(categories).filter((c) => c.items.length > 0);
}
