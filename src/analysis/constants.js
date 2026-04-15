// ─── Design Tokens ────────────────────────────────────────────────────────────
export const G = "#FFDF00";
export const BG = "#f7f7fa";
export const SURF = "#ffffff";
export const SURF2 = "#f0f0f4";
export const BD = "rgba(0,0,0,0.09)";
export const BD_HI = "rgba(0,0,0,0.16)";
export const TX = "#111118";
export const TX2 = "#6b6b7e";
export const FONT = "'Inter Variable', system-ui, sans-serif";

// Chart-specific — charts stay dark for contrast
export const CHART_BG = "#0f0f14";
export const GRID_CLR = "rgba(255,255,255,0.10)";
export const AXIS_CLR = "rgba(255,255,255,0.40)";
export const TICK_CLR = "rgba(255,255,255,0.85)";

// Overlay colors
export const OC = { cep: "#3b82f6", r90: "#a855f7", ellipse: "#06b6d4", mpi: "#22c55e" };

// Session palette
export const PALETTE = [
  "#FFDF00", "#3b82f6", "#ef4444", "#22c55e", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#f43f5e",
];

// Default options for session variables
export const DEF_OPTS = {
  rifleRate: ["1-6", "1-8", "1-10", "1-12", "1-14", "1-16", "1-18"],
  sleeveType: [
    "Slotted PLA", "Not Slotted PLA", "ABS", "Ribbed", "TPU",
    "Delrin + O ring", "Brass (14.65)", "Brass (14.75)", "Brass (14.80)",
    "Brass (14.65) Reused", "Brass (14.75) Reused",
    "S-13 14.80 od", "S-16 14.80 od", "S-16 14.80 od (Reused)",
    "S-17 14.85 od", "S-21 14.90 od",
  ],
  tailType: ["Straight", "Tapered", "Steep Taper", "Round", "Biridge", "Triridge", "Indented"],
  combustionChamber: ["Short (1.5)", "Long (1.5)"],
  load22: ["Red", "Purple"],
};

export const DEF_VARS = [
  { key: "rifleRate", label: "Rifle Rate", core: true },
  { key: "sleeveType", label: "Sleeve Type", core: true },
  { key: "tailType", label: "Tail Type", core: true },
  { key: "combustionChamber", label: "Combustion Chamber", core: true },
  { key: "load22", label: ".22 Load", core: true },
];

export const DEFAULT_FIELDS = [
  { key: "fps", label: "FPS", type: "number", required: true, options: [], unit: "fps" },
  { key: "x", label: "X", type: "number", required: true, options: [], unit: "in" },
  { key: "y", label: "Y", type: "number", required: true, options: [], unit: "in" },
  { key: "weight", label: "Weight", type: "number", required: false, options: [], unit: "g" },
];

// ─── Metrics ──────────────────────────────────────────────────────────────────
// Format: [label, statsKey, decimalPlaces, defaultInCompare]
export const ALL_METRICS = [
  ["CEP (50%)", "cep", 3, true],
  ["R90", "r90", 3, true],
  ["Mean Radius", "mr", 3, true],
  ["Ext. Spread", "es", 3, true],
  ["SD X", "sdX", 3, true],
  ["SD Y", "sdY", 3, true],
  ["SD Radial", "sdR", 3, false],
  ["MPI X", "mpiX", 3, false],
  ["MPI Y", "mpiY", 3, false],
  ["Mean FPS", "meanV", 1, true],
  ["SD FPS", "sdV", 1, true],
  ["ES FPS", "esV", 1, true],
];

export const LOWER_BETTER = [
  "CEP (50%)", "R90", "Mean Radius", "Ext. Spread",
  "SD X", "SD Y", "SD Radial", "SD FPS", "ES FPS",
];

// ─── Metric descriptions & formulas (for hover tooltips) ──────────────────────
export const METRIC_INFO = {
  "CEP":         { desc: "Radius of a circle centered on the MPI that contains 50% of shots. The primary precision metric \u2014 lower is tighter.", formula: "Sort radii from MPI \u2192 50th percentile value" },
  "CEP (50%)":   { desc: "Radius of a circle centered on the MPI that contains 50% of shots. The primary precision metric \u2014 lower is tighter.", formula: "Sort radii from MPI \u2192 50th percentile value" },
  "R90":         { desc: "Radius containing 90% of shots around the MPI. Measures worst-case spread, excluding extreme outliers.", formula: "Sort radii from MPI \u2192 90th percentile value" },
  "Mean Radius": { desc: "Average radial distance of all shots from the MPI. More sensitive to outliers than CEP.", formula: "Mean( \u221a((x \u2212 MPI_x)\u00b2 + (y \u2212 MPI_y)\u00b2) )" },
  "Mean Rad":    { desc: "Average radial distance of all shots from the MPI. More sensitive to outliers than CEP.", formula: "Mean( \u221a((x \u2212 MPI_x)\u00b2 + (y \u2212 MPI_y)\u00b2) )" },
  "Ext. Spread": { desc: "Diameter of the smallest circle enclosing all shots. Absolute worst-to-worst spread.", formula: "2 \u00d7 max( radii from MPI )" },
  "Ext Spread":  { desc: "Diameter of the smallest circle enclosing all shots. Absolute worst-to-worst spread.", formula: "2 \u00d7 max( radii from MPI )" },
  "SD X":        { desc: "Standard deviation of horizontal (X) shot positions. High SD X means the group is stretched left-right.", formula: "\u221a( \u03a3(x \u2212 x\u0304)\u00b2 / (n\u22121) )" },
  "SD Y":        { desc: "Standard deviation of vertical (Y) shot positions. High SD Y means the group is stretched up-down.", formula: "\u221a( \u03a3(y \u2212 \u0233)\u00b2 / (n\u22121) )" },
  "SD Radial":   { desc: "Standard deviation of radial distances from the MPI. Measures how consistent the group size is shot-to-shot.", formula: "\u221a( \u03a3(r \u2212 r\u0304)\u00b2 / (n\u22121) )" },
  "MPI X":       { desc: "Horizontal mean point of impact. Non-zero means the group center is offset left or right from bore sight.", formula: "\u03a3x / n" },
  "MPI Y":       { desc: "Vertical mean point of impact. Non-zero means the group center is offset up or down from bore sight.", formula: "\u03a3y / n" },
  "MPI X/Y":     { desc: "Mean point of impact \u2014 average center of all shots. Offset from (0, 0) reveals sight alignment error independent of precision.", formula: "MPI_x = \u03a3x / n,   MPI_y = \u03a3y / n" },
  "Mean FPS":    { desc: "Average muzzle velocity across all shots.", formula: "\u03a3fps / n" },
  "SD FPS":      { desc: "Shot-to-shot velocity consistency. Lower = more uniform propellant burn. High SD FPS causes vertical stringing.", formula: "\u221a( \u03a3(fps \u2212 fps\u0304)\u00b2 / (n\u22121) )" },
  "ES FPS":      { desc: "Extreme velocity spread \u2014 fastest minus slowest shot. Full range of velocity variation.", formula: "max(fps) \u2212 min(fps)" },
};
