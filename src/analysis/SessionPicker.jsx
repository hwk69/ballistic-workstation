import { useState, useRef, useEffect } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { PALETTE } from "./constants.js";

function ColorDot({ color, size = 10 }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: color }} />;
}

function ColorPicker({ color, onChange }) {
  const names = ["Gold", "Blue", "Red", "Green", "Purple", "Orange", "Cyan", "Pink", "Lime", "Rose"];
  return (
    <select
      value={color}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "var(--color-secondary)", color, border: `1px solid ${color}40`,
        borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 600, minWidth: 70, cursor: "pointer",
      }}>
      {PALETTE.map((c, i) => (
        <option key={c} value={c} style={{ color: c, background: "#111" }}>{names[i]}</option>
      ))}
    </select>
  );
}

export default function SessionPicker({ slots, setSlots, log, vars, onSlotsChange, readOnly }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef();

  useEffect(() => {
    if (!dropdownOpen) return;
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [dropdownOpen]);

  const selectedIds = new Set(slots.map((s) => s.id));
  const usedColors = new Set(slots.map((s) => s.color));
  const nextColor = PALETTE.find((c) => !usedColors.has(c)) || PALETTE[slots.length % PALETTE.length];

  const filtered = log.filter((s) => {
    if (selectedIds.has(s.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (s.config.sessionName || "").toLowerCase();
    const date = (s.config.date || "").toLowerCase();
    const varVals = vars.map((v) => (s.config[v.key] || "").toLowerCase()).join(" ");
    return name.includes(q) || date.includes(q) || varVals.includes(q);
  });

  const addSession = (id) => {
    setSlots((prev) => [...prev, { id, color: nextColor }]);
    setDropdownOpen(false);
    setSearch("");
    onSlotsChange?.();
  };

  const removeSession = (id) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
    onSlotsChange?.();
  };

  const updateColor = (id, color) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Session chips — left side */}
      {slots.map((sl) => {
        const session = log.find((s) => s.id === sl.id);
        if (!session) return null;
        const name = session.config.sessionName || "Unnamed";
        const shotCount = session.shots.length;
        return (
          <div
            key={sl.id}
            className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border text-sm font-medium"
            style={{ borderColor: sl.color + "40", background: sl.color + "12" }}>
            <ColorDot color={sl.color} />
            <span style={{ color: sl.color }}>{name}</span>
            <span className="text-muted-foreground text-xs">({shotCount})</span>
            {!readOnly && slots.length > 1 && (
              <ColorPicker color={sl.color} onChange={(c) => updateColor(sl.id, c)} />
            )}
            {!readOnly && slots.length > 1 && (
              <button
                onClick={() => removeSession(sl.id)}
                className="p-0.5 rounded hover:bg-destructive/20 cursor-pointer bg-transparent border-none transition-colors"
                style={{ color: sl.color }}>
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}

      {/* Spacer pushes right-side actions */}
      <div className="flex-1" />

      {/* Right side — Compare + Clear */}
      {!readOnly && (
      <div className="flex items-center gap-2">
        {slots.length > 0 && (
          <button
            onClick={() => { setSlots([]); onSlotsChange?.(); }}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
            Clear{slots.length > 1 ? " compare" : ""}
          </button>
        )}

        {/* Add session button + dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground text-xs font-medium cursor-pointer hover:text-foreground transition-colors">
            <Plus size={12} />
            {slots.length === 0 ? "Select Session" : "Compare"}
            <ChevronDown size={10} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-2 min-w-[260px] max-h-[320px] flex flex-col">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sessions..."
                className="w-full border border-border bg-secondary px-3 py-2 text-sm rounded-md mb-2 focus:outline-none focus:border-foreground/30"
                autoFocus
              />
              <div className="overflow-auto flex-1">
                {filtered.length === 0 && (
                  <div className="text-xs text-muted-foreground px-3 py-2">No sessions found</div>
                )}
                {filtered.map((s) => {
                  const name = s.config.sessionName || "Unnamed";
                  const date = s.config.date || "";
                  const varLine = vars.map((v) => s.config[v.key]).filter(Boolean).join(" · ");
                  return (
                    <button
                      key={s.id}
                      onClick={() => addSession(s.id)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary cursor-pointer bg-transparent border-none transition-colors">
                      <div className="text-sm font-medium text-foreground">{name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {date} · {s.shots.length} shots{varLine ? ` · ${varLine}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
