import { useEffect, useRef, useState } from 'react';

// Shared filter bar used by Library and History.
// Each page passes its own state — filter selections are independent per page.
//
// Props:
//   searchValue          — current search string
//   onSearchChange(v)    — search input callback
//   searchPlaceholder    — input placeholder text
//   sort                 — current sort value (e.g. "newest")
//   onSortChange(v)      — sort toggle callback (optional; if omitted no sort button shown)
//   sortOptions          — [{ value, label }] — the full cycle of sort states
//   filters              — { [filterKey]: value } — active filters
//   onFiltersChange(obj) — commits new filters object
//   filterDefs           — [{ key, label, options: [string...] }]
//   rightSlot            — optional ReactNode shown on the right of row 1
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  sort,
  onSortChange,
  sortOptions,
  filters,
  onFiltersChange,
  filterDefs = [],
  rightSlot,
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  const btnRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const activeFilterDefs = filterDefs.filter(def => def.options && def.options.length > 0);
  const activeEntries = Object.entries(filters || {}).filter(([, v]) => v);
  const activeCount = activeEntries.length;

  const setFilter = (key, value) => {
    const next = { ...(filters || {}) };
    if (value) next[key] = value;
    else delete next[key];
    onFiltersChange(next);
  };

  const clearAll = () => {
    onFiltersChange({});
    if (onSearchChange) onSearchChange('');
  };

  const cycleSort = () => {
    if (!onSortChange || !sortOptions || !sortOptions.length) return;
    const idx = sortOptions.findIndex(o => o.value === sort);
    const next = sortOptions[(idx + 1) % sortOptions.length];
    onSortChange(next.value);
  };

  const currentSortLabel = sortOptions?.find(o => o.value === sort)?.label;

  return (
    <div className="mb-5">
      {/* Row 1 — search + sort + filters button */}
      <div className="flex gap-2 items-center">
        {onSearchChange && (
          <input
            value={searchValue || ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
        )}
        {onSortChange && sortOptions && (
          <button
            onClick={cycleSort}
            className="text-[11px] font-semibold px-3 py-2 rounded cursor-pointer transition-all duration-100 shrink-0 bg-[#111118] text-[#FFDF00] border border-[#111118]">
            {currentSortLabel || 'Sort'}
          </button>
        )}
        {activeFilterDefs.length > 0 && (
          <div className="relative shrink-0">
            <button
              ref={btnRef}
              onClick={() => setOpen(o => !o)}
              className={`text-[11px] font-semibold px-3 py-2 rounded cursor-pointer transition-colors border inline-flex items-center gap-1.5 ${
                open || activeCount > 0
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
              }`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            {open && (
              <div
                ref={popRef}
                className="absolute right-0 top-full mt-1.5 z-30 w-72 max-w-[90vw] rounded-lg border border-border bg-card shadow-lg p-3">
                <div className="flex flex-col gap-3">
                  {activeFilterDefs.map(def => (
                    <div key={def.key} className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{def.label}</label>
                      <select
                        value={filters?.[def.key] || ''}
                        onChange={e => setFilter(def.key, e.target.value)}
                        className="rounded-md bg-secondary border border-border px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary">
                        <option value="">All</option>
                        {def.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => onFiltersChange({})}
                    disabled={activeCount === 0}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none disabled:opacity-40 disabled:cursor-not-allowed">
                    Clear filters
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-semibold text-primary cursor-pointer bg-transparent border-none">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {rightSlot}
      </div>

      {/* Row 2 — active filter chips (visible even when popover closed) */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {activeEntries.map(([k, v]) => {
            const def = filterDefs.find(d => d.key === k);
            return (
              <button
                key={k}
                onClick={() => setFilter(k, '')}
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors">
                <span className="font-semibold">{def?.label || k}:</span>
                <span>{v}</span>
                <span aria-hidden className="text-[10px]">✕</span>
              </button>
            );
          })}
          <button
            onClick={clearAll}
            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
