import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import * as d3 from "d3";
import * as db from "../lib/db.js";
import { G, PALETTE, OC, CHART_BG, GRID_CLR, AXIS_CLR, TICK_CLR, ALL_METRICS, LOWER_BETTER, METRIC_INFO, DEFAULT_FIELDS } from "./constants.js";
import { mean, std, rad, calcStats, countOverlaps } from "./stats.js";
import { exportMasterCsv } from "./csv-export.js";
import { buildWidgetRegistry, getAvailableWidgets, categorizeWidgets } from "./widget-registry.js";
import { autoLayout, unionFields, intersectFields, resolveSlots } from "./auto-layout.js";
import SessionPicker from "./SessionPicker.jsx";
import WidgetGrid from "./WidgetGrid.jsx";
import { AttachmentWidget, ShotCarousel } from "../components/AttachmentWidget.jsx";
import { Paperclip } from "lucide-react";

// ─── Shared UI primitives (kept minimal, imported patterns from App.jsx) ──────

function AutoSizeChart({ render: renderFn }) {
  const ref = useRef();
  const [dims, setDims] = useState(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="w-full h-full min-h-[160px]">{dims ? renderFn(dims.w, dims.h) : null}</div>;
}

function ChartTooltip({ tip }) {
  if (!tip) return null;
  return (
    <div style={{
      position: "fixed", left: tip.x + 14, top: tip.y - 10,
      pointerEvents: "none", zIndex: 100,
      background: "#1b1b22", border: `1px solid ${tip.color ? tip.color + "40" : "rgba(255,255,255,0.13)"}`,
      borderRadius: 8, padding: "7px 11px", fontSize: 11, lineHeight: 1.7,
      color: "#ededf2", whiteSpace: "nowrap",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      {tip.lines.map((l, i) => (
        <div key={i} style={i === 0 && tip.color ? { color: tip.color, fontWeight: 600 } : undefined}>{l}</div>
      ))}
    </div>
  );
}

function Toggle({ label, on, onToggle, color }) {
  return (
    <button onClick={onToggle} className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
      "border cursor-pointer transition-all duration-150",
      on
        ? "bg-primary/10 text-primary border-primary/25"
        : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border/60"
    )}
    style={on && color ? { background: color + "18", color, borderColor: color + "40" } : undefined}>
      <span className="size-1.5 rounded-full transition-colors"
        style={{ background: on ? (color || "var(--color-primary)") : "rgba(255,255,255,0.25)" }} />
      {label}
    </button>
  );
}

function MetricTip({ label, children }) {
  const info = METRIC_INFO[label];
  const [tip, setTip] = useState(null);
  if (!info) return <>{children}</>;
  return (
    <span className="cursor-help"
      onMouseEnter={(ev) => setTip({ x: ev.clientX, y: ev.clientY })}
      onMouseMove={(ev) => setTip({ x: ev.clientX, y: ev.clientY })}
      onMouseLeave={() => setTip(null)}>
      {children}
      {tip && (
        <div style={{
          position: "fixed", left: tip.x + 14, top: tip.y - 10,
          pointerEvents: "none", zIndex: 300,
          background: "#111118", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 2, padding: "10px 13px", fontSize: 11, lineHeight: 1.7,
          color: "#f0f0f8", maxWidth: 270,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}>
          <div style={{ color: G, fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ color: "#6b6b7e", marginBottom: 8, whiteSpace: "normal" }}>{info.desc}</div>
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 7,
            fontFamily: "monospace", color: "rgba(255,255,255,0.5)", fontSize: 10, whiteSpace: "pre",
          }}>{info.formula}</div>
        </div>
      )}
    </span>
  );
}

function SB({ label, value, gold, accentColor, onClick, active }) {
  const linked = !!onClick;
  const ac = linked ? (active ? accentColor : null) : accentColor || (gold ? G : null);
  return (
    <div
      className={cn(
        "relative rounded-lg p-4 transition-all duration-200 overflow-hidden",
        linked ? "cursor-pointer select-none" : "",
        linked && !active && "opacity-35 hover:opacity-65",
      )}
      style={{
        background: linked && active && accentColor ? accentColor + "12" : "var(--color-secondary)",
        border: "1px solid",
        borderColor: ac ? ac + "30" : "var(--color-border)",
        borderTop: `2px solid ${ac || "rgba(255,255,255,0.08)"}`,
      }}
      onClick={onClick}>
      {linked && (
        <span className="absolute top-3 right-3 size-1.5 rounded-full transition-all duration-200"
          style={{ background: active ? accentColor : "rgba(255,255,255,0.12)" }} />
      )}
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2.5"
        style={{ color: ac || "var(--color-muted-foreground)" }}>
        <MetricTip label={label}>{label}</MetricTip>
      </div>
      <div className="text-[22px] font-bold font-mono leading-none tabular-nums" style={{ color: ac || "var(--color-foreground)" }}>
        {value}
      </div>
    </div>
  );
}

// ─── D3 Chart helpers (inlined to avoid cross-file coupling for now) ──────────

function drawShots(g, shots, sc, color) {
  const ov = countOverlaps(shots), dr = {};
  shots.forEach((s) => {
    const k = `${s.x},${s.y}`, cnt = ov[k], ad = dr[k] || 0; dr[k] = ad + 1;
    if (cnt > 1 && ad === 0) {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5)
        .attr("fill", color).attr("fill-opacity", 0.9).attr("stroke", "rgba(255,255,255,0.35)").attr("stroke-width", 0.5);
      g.append("text").attr("x", sc(s.x) + 7).attr("y", sc(-s.y) + 3).text("\u00d7" + cnt)
        .attr("fill", TICK_CLR).attr("font-size", 8).attr("font-weight", "500");
    } else if (cnt > 1) {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5 + ad * 3)
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", 1).attr("stroke-opacity", 0.45);
    } else {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5)
        .attr("fill", color).attr("fill-opacity", 0.88).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 0.5);
    }
  });
}

function drawOverlays(g, stats, sc, _color, opts) {
  if (stats.cep <= 0) return;
  const cx = sc(stats.mpiX), cy = sc(-stats.mpiY);
  if (opts.showCep) {
    const rp = Math.abs(sc(stats.cep) - sc(0));
    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", rp).attr("fill", "none")
      .attr("stroke", OC.cep).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
    g.append("text").attr("x", cx + rp + 4).attr("y", cy - 4).text("CEP")
      .attr("fill", OC.cep).attr("font-size", 9).attr("font-weight", "600");
  }
  if (opts.showR90) {
    const rp = Math.abs(sc(stats.r90) - sc(0));
    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", rp).attr("fill", "none")
      .attr("stroke", OC.r90).attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("stroke-opacity", 0.65);
    g.append("text").attr("x", cx + rp + 4).attr("y", cy + 10).text("R90")
      .attr("fill", OC.r90).attr("font-size", 9).attr("font-weight", "600");
  }
  if (opts.showEllipse && stats.covEllipse) {
    const { rx, ry, angle } = stats.covEllipse;
    g.append("ellipse").attr("cx", cx).attr("cy", cy)
      .attr("rx", Math.abs(sc(rx) - sc(0))).attr("ry", Math.abs(sc(ry) - sc(0)))
      .attr("transform", `rotate(${-angle},${cx},${cy})`).attr("fill", "none")
      .attr("stroke", OC.ellipse).attr("stroke-width", 1).attr("stroke-opacity", 0.5);
  }
  if (opts.showMpi) {
    g.append("line").attr("x1", cx - 6).attr("x2", cx + 6).attr("y1", cy).attr("y2", cy).attr("stroke", OC.mpi).attr("stroke-width", 1.5);
    g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", cy - 6).attr("y2", cy + 6).attr("stroke", OC.mpi).attr("stroke-width", 1.5);
  }
}

function drawAxes(svg, sc, size, m, w) {
  const g = svg.select("g");
  sc.ticks(6).filter((t) => t !== 0).forEach((t) => {
    g.append("text").attr("x", sc(t)).attr("y", w + 14).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 9).text(t);
    g.append("text").attr("x", -14).attr("y", sc(-t) + 3).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 9).text(t);
  });
  svg.append("text").attr("x", size / 2).attr("y", size - 3).attr("text-anchor", "middle")
    .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("X (in)");
  svg.append("text").attr("transform", `translate(11,${size / 2}) rotate(-90)`).attr("text-anchor", "middle")
    .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Y (in)");
}

// ─── Chart Components ─────────────────────────────────────────────────────────

function DispersionChart({ shots, stats, size = 380, opts = {}, color = G }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!ref.current || !shots.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = 44, w = size - 2 * m;
    const maxR = Math.max(...shots.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y))), stats.r90 || 1, 1) * 1.4;
    const sc = d3.scaleLinear().domain([-maxR, maxR]).range([0, w]);
    const g = svg.append("g").attr("transform", `translate(${m},${m})`);
    if (opts.showGrid !== false) sc.ticks(8).forEach((t) => {
      g.append("line").attr("x1", sc(t)).attr("x2", sc(t)).attr("y1", 0).attr("y2", w).attr("stroke", GRID_CLR);
      g.append("line").attr("y1", sc(t)).attr("y2", sc(t)).attr("x1", 0).attr("x2", w).attr("stroke", GRID_CLR);
    });
    g.append("line").attr("x1", sc(0)).attr("x2", sc(0)).attr("y1", 0).attr("y2", w).attr("stroke", AXIS_CLR);
    g.append("line").attr("y1", sc(0)).attr("y2", sc(0)).attr("x1", 0).attr("x2", w).attr("stroke", AXIS_CLR);
    const chX = g.append("line").attr("y1", 0).attr("y2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    const chY = g.append("line").attr("x1", 0).attr("x2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    drawOverlays(g, stats, sc, color, opts);
    drawShots(g, shots, sc, color);
    drawAxes(svg, sc, size, m, w);
    const mpiX = stats.mpiX || 0, mpiY = stats.mpiY || 0;
    shots.forEach((s) => {
      const cx = sc(s.x), cy = sc(-s.y);
      g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 10).attr("fill", "transparent").attr("cursor", "crosshair")
        .on("mouseenter", (ev) => {
          const r = rad(s.x - mpiX, s.y - mpiY);
          chX.attr("x1", cx).attr("x2", cx).style("display", null);
          chY.attr("y1", cy).attr("y2", cy).style("display", null);
          setTip({ x: ev.clientX, y: ev.clientY, lines: [
            `\u2116\u00a0${s.shotNum}  ${s.serial || ""}`,
            `X\u00a0${s.x}  Y\u00a0${s.y}`,
            `Radial\u00a0${r.toFixed(3)}\u00a0in`,
          ]});
        })
        .on("mousemove", (ev) => setTip((t) => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
        .on("mouseleave", () => { chX.style("display", "none"); chY.style("display", "none"); setTip(null); });
    });
  }, [shots, stats, size, opts, color]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }} onMouseLeave={() => setTip(null)} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function DispersionMulti({ sessions, size = 440, opts = {} }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!ref.current || !sessions.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const all = sessions.flatMap((d) => d.shots); if (!all.length) return;
    const m = 44, w = size - 2 * m;
    const maxR = Math.max(...all.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y))), 1) * 1.4;
    const sc = d3.scaleLinear().domain([-maxR, maxR]).range([0, w]);
    const g = svg.append("g").attr("transform", `translate(${m},${m})`);
    sc.ticks(8).forEach((t) => {
      g.append("line").attr("x1", sc(t)).attr("x2", sc(t)).attr("y1", 0).attr("y2", w).attr("stroke", GRID_CLR);
      g.append("line").attr("y1", sc(t)).attr("y2", sc(t)).attr("x1", 0).attr("x2", w).attr("stroke", GRID_CLR);
    });
    g.append("line").attr("x1", sc(0)).attr("x2", sc(0)).attr("y1", 0).attr("y2", w).attr("stroke", AXIS_CLR);
    g.append("line").attr("y1", sc(0)).attr("y2", sc(0)).attr("x1", 0).attr("x2", w).attr("stroke", AXIS_CLR);
    const chX = g.append("line").attr("y1", 0).attr("y2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    const chY = g.append("line").attr("x1", 0).attr("x2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    sessions.forEach((d) => { drawOverlays(g, d.stats, sc, d.color, opts); drawShots(g, d.shots, sc, d.color); });
    drawAxes(svg, sc, size, m, w);
    sessions.forEach((d) => {
      const mpiX = d.stats.mpiX || 0, mpiY = d.stats.mpiY || 0;
      const sessionName = d.session?.config?.sessionName || "Session";
      d.shots.forEach((s) => {
        const cx = sc(s.x), cy = sc(-s.y);
        g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 10).attr("fill", "transparent").attr("cursor", "crosshair")
          .on("mouseenter", (ev) => {
            const r = rad(s.x - mpiX, s.y - mpiY);
            chX.attr("x1", cx).attr("x2", cx).style("display", null);
            chY.attr("y1", cy).attr("y2", cy).style("display", null);
            setTip({ x: ev.clientX, y: ev.clientY, color: d.color, lines: [
              sessionName, `\u2116\u00a0${s.shotNum}  ${s.serial || ""}`,
              `X\u00a0${s.x}  Y\u00a0${s.y}`, `Radial\u00a0${r.toFixed(3)}\u00a0in`,
            ]});
          })
          .on("mousemove", (ev) => setTip((t) => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
          .on("mouseleave", () => { chX.style("display", "none"); chY.style("display", "none"); setTip(null); });
      });
    });
  }, [sessions, size, opts]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }} onMouseLeave={() => setTip(null)} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function DonutChart({ yesCount, noCount, total, label, width = 360, color = G }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || total === 0) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const size = Math.min(width, 180), radius = size / 2 - 10, innerRadius = radius * 0.55;
    const gg = svg.append("g").attr("transform", `translate(${width / 2},${90})`);
    const data = [
      { label: "Yes", value: yesCount, color: color },
      { label: "No", value: noCount, color: "rgba(255,255,255,0.15)" },
    ].filter((d) => d.value > 0);
    const pie = d3.pie().value((d) => d.value).sort(null).padAngle(0.03);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    gg.selectAll("path").data(pie(data)).join("path").attr("d", arc).attr("fill", (d) => d.data.color).attr("stroke", "rgba(0,0,0,0.3)").attr("stroke-width", 1);
    const pct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
    gg.append("text").attr("text-anchor", "middle").attr("dy", "-0.1em").attr("fill", "#fff").attr("font-size", 22).attr("font-weight", "700").text(`${pct}%`);
    gg.append("text").attr("text-anchor", "middle").attr("dy", "1.3em").attr("fill", TICK_CLR).attr("font-size", 10).text("Yes");
    const legend = svg.append("g").attr("transform", `translate(${width / 2 - 60},${175})`);
    [{ label: `Yes: ${yesCount}`, color }, { label: `No: ${noCount}`, color: "rgba(255,255,255,0.15)" }].forEach((item, i) => {
      const g = legend.append("g").attr("transform", `translate(${i * 80},0)`);
      g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", item.color);
      g.append("text").attr("x", 14).attr("y", 9).attr("fill", TICK_CLR).attr("font-size", 10).text(item.label);
    });
  }, [yesCount, noCount, total, width, color]);
  return <svg ref={ref} width={width} height={200} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function VelHist({ shots, width = 360, color = G }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 20, r: 15, b: 34, l: 38 }, w = width - m.l - m.r, h = 145 - m.t - m.b;
    const vs = shots.map((s) => s.fps || (s.data || s).fps).filter((v) => v != null && !isNaN(v));
    if (vs.length < 2) return;
    const x = d3.scaleLinear().domain([Math.min(...vs) - 15, Math.max(...vs) + 15]).range([0, w]);
    const bins = d3.bin().domain(x.domain()).thresholds(Math.min(vs.length, 14))(vs);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (d) => d.length)]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.selectAll("rect").data(bins).join("rect")
      .attr("x", (d) => x(d.x0) + 1).attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2)).attr("height", (d) => h - y(d.length))
      .attr("fill", color).attr("fill-opacity", 0.7).attr("rx", 2);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    const bw = std(vs) * 0.6 || 5;
    const kde = x.ticks(50).map((t) => [t, vs.reduce((s2, vi) => s2 + Math.exp(-0.5 * ((t - vi) / bw) ** 2), 0) / (vs.length * bw * Math.sqrt(2 * Math.PI))]);
    const yK = d3.scaleLinear().domain([0, d3.max(kde, (d) => d[1])]).range([h, 0]);
    gg.append("path").datum(kde).attr("fill", "none").attr("stroke", "rgba(255,255,255,0.45)").attr("stroke-width", 1.5)
      .attr("d", d3.line().x((d) => x(d[0])).y((d) => yK(d[1])).curve(d3.curveBasis));
    svg.append("text").attr("x", width / 2).attr("y", 142).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Velocity (fps)");
  }, [shots, width, color]);
  return <svg ref={ref} width={width} height={145} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

// ─── Widget Renderers ─────────────────────────────────────────────────────────

function DispersionWidget({ resolved, mode, opts, toggleOpt }) {
  if (mode === "single") {
    const { shots, stats, color } = resolved[0];
    return (
      <>
        <div className="flex gap-1.5 mb-2.5 flex-wrap items-center">
          {[["showEllipse", "Ellipse", OC.ellipse], ["showGrid", "Grid"]].map(([k, l, c]) => (
            <Toggle key={k} label={l} on={opts[k]} onToggle={() => toggleOpt(k)} color={c} />
          ))}
        </div>
        <AutoSizeChart render={(w, h) => <DispersionChart shots={shots} stats={stats} size={Math.min(w, h) - 12} opts={opts} color={color || G} />} />
      </>
    );
  }
  // Multi-session overlay
  const sessions = resolved.map((r) => ({ shots: r.shots, stats: r.stats, color: r.color, session: r.session }));
  return (
    <>
      <div className="flex gap-1.5 mb-2.5 flex-wrap items-center">
        {[["showEllipse", "Ellipse", OC.ellipse]].map(([k, l, c]) => (
          <Toggle key={k} label={l} on={opts[k]} onToggle={() => toggleOpt(k)} color={c} />
        ))}
      </div>
      <AutoSizeChart render={(w, h) => <DispersionMulti sessions={sessions} size={Math.min(w, h) - 12} opts={opts} />} />
      <div className="flex gap-3 mt-2 flex-wrap">
        {resolved.map((r) => (
          <span key={r.session.id} className="inline-flex items-center gap-1.5 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: r.color }} />
            <span style={{ color: r.color }}>{r.session.config.sessionName || "Unnamed"}</span>
            <span className="text-muted-foreground">({r.shots.length})</span>
          </span>
        ))}
      </div>
    </>
  );
}

function MetricsSummaryWidget({ resolved, mode, opts, toggleOpt, hiddenMetrics, onToggleMetric }) {
  const [editMode, setEditMode] = useState(false);

  if (mode === "single") {
    const { stats } = resolved[0];
    const sb = (k, v, ac, onClick, active) => (
      <SB key={k} label={k} value={v} accentColor={ac} onClick={onClick} active={active} />
    );

    // Build all available metrics
    const allCards = [];
    if (stats.hasXY) {
      allCards.push({ id: "CEP", el: sb("CEP", stats.cep.toFixed(2) + " in", OC.cep, () => toggleOpt("showCep"), opts.showCep) });
      allCards.push({ id: "R90", el: sb("R90", stats.r90.toFixed(2) + " in", OC.r90, () => toggleOpt("showR90"), opts.showR90) });
      allCards.push({ id: "SD X", el: sb("SD X", stats.sdX.toFixed(2)) });
      allCards.push({ id: "SD Y", el: sb("SD Y", stats.sdY.toFixed(2)) });
      allCards.push({ id: "MPI X/Y", el: sb("MPI X/Y", stats.mpiX.toFixed(1) + "/" + stats.mpiY.toFixed(1), OC.mpi, () => toggleOpt("showMpi"), opts.showMpi) });
      allCards.push({ id: "Mean Rad", el: sb("Mean Rad", stats.mr.toFixed(2)) });
      allCards.push({ id: "Ext Spread", el: sb("Ext Spread", stats.es.toFixed(2)) });
    }
    if (stats.hasFps) {
      allCards.push({ id: "Mean FPS", el: sb("Mean FPS", stats.meanV.toFixed(1), opts.color || G) });
      allCards.push({ id: "SD FPS", el: sb("SD FPS", stats.sdV.toFixed(1)) });
      allCards.push({ id: "ES FPS", el: sb("ES FPS", stats.esV.toFixed(1)) });
    }
    if (stats.fieldStats) {
      Object.entries(stats.fieldStats).forEach(([key, fs]) => {
        if (fs.type === "number") {
          if (fs.mean !== null) allCards.push({ id: `Mean ${fs.label}`, el: sb(`Mean ${fs.label}`, `${fs.mean.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) });
          if (fs.sd !== null) allCards.push({ id: `SD ${fs.label}`, el: sb(`SD ${fs.label}`, `${fs.sd.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) });
        }
        if (fs.type === "yesno") {
          allCards.push({ id: fs.label, el: sb(fs.label, `${fs.yes}/${fs.total} (${fs.pct}%)`) });
        }
      });
    }

    const visible = allCards.filter((c) => !hiddenMetrics.has(c.id));

    return (
      <>
        <div className="flex items-center gap-2 mb-2">
          {stats.hasXY && <p className="text-[10px] text-muted-foreground/50 flex-1">Click CEP, R90, or MPI to toggle overlays</p>}
          <button onClick={() => setEditMode((e) => !e)}
            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
            {editMode ? "Done" : "Edit metrics"}
          </button>
        </div>
        {editMode && (
          <div className="flex gap-1 flex-wrap mb-3">
            {allCards.map((c) => (
              <button key={c.id} onClick={() => onToggleMetric(c.id)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] border cursor-pointer transition-all",
                  hiddenMetrics.has(c.id)
                    ? "opacity-40 bg-secondary border-border text-muted-foreground"
                    : "bg-primary/10 border-primary/25 text-primary"
                )}>
                {c.id}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">{visible.map((c) => <div key={c.id}>{c.el}</div>)}</div>
      </>
    );
  }

  // ─── Multi-session: comparison table ───────────────────────────────────────
  const metrics = ALL_METRICS.filter((m) => {
    if (m[1] === "cep" || m[1] === "r90" || m[1] === "mr" || m[1] === "es" || m[1] === "sdX" || m[1] === "sdY" || m[1] === "sdR" || m[1] === "mpiX" || m[1] === "mpiY") {
      return resolved.every((r) => r.stats.hasXY);
    }
    if (m[1] === "meanV" || m[1] === "sdV" || m[1] === "esV") {
      return resolved.every((r) => r.stats.hasFps);
    }
    return true;
  });
  const visibleMetrics = metrics.filter((m) => !hiddenMetrics.has(m[0]));

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-muted-foreground/50 flex-1" />
        <button onClick={() => setEditMode((e) => !e)}
          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
          {editMode ? "Done" : "Edit metrics"}
        </button>
      </div>
      {editMode && (
        <div className="flex gap-1 flex-wrap mb-3">
          {metrics.map((m) => (
            <button key={m[0]} onClick={() => onToggleMetric(m[0])}
              className={cn(
                "px-2 py-1 rounded text-[10px] border cursor-pointer transition-all",
                hiddenMetrics.has(m[0])
                  ? "opacity-40 bg-secondary border-border text-muted-foreground"
                  : "bg-primary/10 border-primary/25 text-primary"
              )}>
              {m[0]}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground text-[10px] uppercase tracking-wide px-2 py-1.5">Metric</th>
              {resolved.map((r) => (
                <th key={r.session.id} className="text-right text-[10px] uppercase tracking-wide px-2 py-1.5" style={{ color: r.color }}>
                  {r.session.config.sessionName || "Unnamed"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMetrics.map((m) => {
              const values = resolved.map((r) => r.stats[m[1]]);
              const valid = values.filter((v) => v != null && !isNaN(v));
              const isLower = LOWER_BETTER.includes(m[0]);
              const best = valid.length > 0 ? (isLower ? Math.min(...valid) : Math.max(...valid)) : null;
              return (
                <tr key={m[0]} className="border-b border-border">
                  <td className="text-muted-foreground px-2 py-1.5">
                    <MetricTip label={m[0]}>{m[0]}</MetricTip>
                  </td>
                  {resolved.map((r, i) => {
                    const val = r.stats[m[1]];
                    const isBest = val === best && valid.length > 1;
                    return (
                      <td key={r.session.id} className="text-right px-2 py-1.5 font-mono tabular-nums"
                        style={{ color: isBest ? r.color : "var(--color-foreground)", fontWeight: isBest ? 700 : 400 }}>
                        {val != null ? val.toFixed(m[2]) : "\u2014"}
                        {isBest && " \u2726"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AttainmentRateWidget({ resolved, mode, fieldKey, fieldLabel }) {
  if (mode === "single") {
    const { stats, color } = resolved[0];
    const fs = stats.fieldStats?.[fieldKey];
    if (!fs || fs.type !== "yesno") return <div className="text-muted-foreground text-sm">No data</div>;
    return (
      <AutoSizeChart render={(w) => (
        <DonutChart yesCount={fs.yes} noCount={fs.no} total={fs.total} label={fieldLabel} width={w - 8} color={color || G} />
      )} />
    );
  }
  // Multi: side-by-side donuts
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
      {resolved.map((r) => {
        const fs = r.stats.fieldStats?.[fieldKey];
        if (!fs || fs.type !== "yesno") return null;
        return (
          <div key={r.session.id} className="text-center">
            <DonutChart yesCount={fs.yes} noCount={fs.no} total={fs.total} label={fieldLabel} width={200} color={r.color} />
            <div className="text-xs mt-1" style={{ color: r.color }}>{r.session.config.sessionName || "Unnamed"}</div>
          </div>
        );
      })}
    </div>
  );
}

function ShotTableWidget({ resolved, mode, commonFields }) {
  const [attachments, setAttachments] = useState([]);
  const [carousel, setCarousel] = useState(null);

  const sessionIds = resolved.map((r) => r.session.id);
  useEffect(() => {
    if (!sessionIds.length) return;
    db.getAttachments({ sessionIds }).then(setAttachments).catch(() => {});
  }, [sessionIds.join(",")]);

  const attByShotId = useMemo(() => {
    const m = {};
    for (const a of attachments) { const k = a.shot_id || "none"; (m[k] || (m[k] = [])).push(a); }
    return m;
  }, [attachments]);

  const sf = mode === "single" ? (resolved[0]?.fields || DEFAULT_FIELDS) : commonFields;

  const allShots = useMemo(() =>
    resolved.flatMap((r) =>
      [...r.shots].sort((a, b) => (a.shotNum || 0) - (b.shotNum || 0)).map((s) => ({
        ...s, sessionName: r.session.config.sessionName || "Unnamed", sessionColor: r.color, sessionId: r.session.id,
      }))
    ), [resolved]);

  return (
    <>
      <div className="overflow-auto max-h-80">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              {mode === "multi" && <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Session</th>}
              <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">#</th>
              <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Serial</th>
              {sf.map((f) => (
                <th key={f.key} className={cn("text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5", f.type === "number" ? "text-right" : "text-left")}>{f.label}</th>
              ))}
              <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Time</th>
              <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-center w-10">
                <Paperclip size={11} className="inline-block" />
              </th>
            </tr>
          </thead>
          <tbody>
            {allShots.map((s, i) => {
              const shotAtts = attByShotId[s.id] || [];
              const bgStyle = mode === "multi" ? { background: s.sessionColor + "18", borderColor: s.sessionColor + "30" } : {};
              return (
                <tr key={i} className="border-b border-border transition-colors duration-150 hover:bg-accent/40" style={bgStyle}>
                  {mode === "multi" && <td className="px-2.5 py-1.5 font-semibold" style={{ color: s.sessionColor }}>{s.sessionName}</td>}
                  <td className="text-muted-foreground px-2.5 py-1.5">{s.shotNum}</td>
                  <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[11px]">{s.serial}</td>
                  {sf.map((f) => {
                    const val = (s.data || s)[f.key];
                    let display = "";
                    if (val === true) display = "Yes";
                    else if (val === false) display = "No";
                    else if (val !== null && val !== undefined) display = String(val);
                    return <td key={f.key} className={cn("px-2.5 py-1.5", f.type === "number" ? "text-foreground text-right font-mono" : "text-foreground")}>{display || "\u2014"}</td>;
                  })}
                  <td className="text-muted-foreground px-2.5 py-1.5">{s.timestamp}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    {shotAtts.length > 0 ? (
                      <button onClick={() => setCarousel({ shotId: s.id, serial: s.serial, atts: shotAtts })}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/8 hover:bg-primary/15 text-primary cursor-pointer border-none transition-colors"
                        title={`${shotAtts.length} attachment${shotAtts.length > 1 ? "s" : ""}`}>
                        <Paperclip size={10} />
                        <span className="text-[10px] font-bold">{shotAtts.length}</span>
                      </button>
                    ) : <span className="text-muted-foreground/30">\u2014</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {carousel && <ShotCarousel attachments={carousel.atts} serial={carousel.serial} onClose={() => setCarousel(null)} />}
    </>
  );
}

function AttachmentsWidget({ resolved, mode, onError }) {
  const [attachments, setAttachments] = useState([]);
  const [carousel, setCarousel] = useState(null);

  const sessionIds = resolved.map((r) => r.session.id);
  useEffect(() => {
    if (!sessionIds.length) return;
    db.getAttachments({ sessionIds }).then(setAttachments).catch(() => {});
  }, [sessionIds.join(",")]);

  // Group by session + shot, with clear labeling
  const groups = useMemo(() => {
    const shotMap = {};
    for (const r of resolved) {
      for (const s of r.shots) {
        shotMap[s.id] = { serial: s.serial, shotNum: s.shotNum, sessionName: r.session.config.sessionName || "Unnamed", sessionColor: r.color };
      }
    }
    const grouped = {};
    for (const a of attachments) {
      const shot = shotMap[a.shot_id];
      const key = shot ? `${shot.sessionName} — ${shot.serial}` : "Unlinked";
      if (!grouped[key]) grouped[key] = { label: key, color: shot?.sessionColor || "#888", items: [] };
      grouped[key].items.push(a);
    }
    return Object.values(grouped);
  }, [attachments, resolved]);

  if (!attachments.length) {
    return <div className="text-muted-foreground text-sm py-4 text-center">No attachments</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: group.color }}>{group.label}</div>
            <div className="flex gap-2 flex-wrap">
              {group.items.map((a) => {
                const isImage = a.content_type?.startsWith("image/");
                const isVideo = a.content_type?.startsWith("video/");
                return (
                  <button key={a.id}
                    onClick={() => setCarousel({ shotId: a.shot_id, serial: group.label, atts: group.items })}
                    className="w-16 h-16 rounded-md overflow-hidden border border-border hover:border-primary/40 cursor-pointer bg-secondary transition-colors p-0">
                    {isImage && <img src={a.url} alt="" className="w-full h-full object-cover" />}
                    {isVideo && <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">\u25b6</div>}
                    {!isImage && !isVideo && <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[9px]">PDF</div>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {carousel && <ShotCarousel attachments={carousel.atts} serial={carousel.serial} onClose={() => setCarousel(null)} />}
    </>
  );
}

function CustomRankingsWidget({ resolved, mode }) {
  const [config, setConfig] = useState([]);
  const [editing, setEditing] = useState(false);

  // Build available metrics from the data
  const availableMetrics = useMemo(() => {
    const metrics = [];
    const anyHasXY = resolved.some((r) => r.stats.hasXY);
    const anyHasFps = resolved.some((r) => r.stats.hasFps);
    if (anyHasXY) {
      metrics.push({ key: "cep", label: "CEP (50%)", defaultDir: "lower" });
      metrics.push({ key: "r90", label: "R90", defaultDir: "lower" });
      metrics.push({ key: "sdX", label: "SD X", defaultDir: "lower" });
      metrics.push({ key: "sdY", label: "SD Y", defaultDir: "lower" });
      metrics.push({ key: "mr", label: "Mean Radius", defaultDir: "lower" });
      metrics.push({ key: "es", label: "Ext. Spread", defaultDir: "lower" });
    }
    if (anyHasFps) {
      metrics.push({ key: "meanV", label: "Mean FPS", defaultDir: "higher" });
      metrics.push({ key: "sdV", label: "SD FPS", defaultDir: "lower" });
      metrics.push({ key: "esV", label: "ES FPS", defaultDir: "lower" });
    }
    // Dynamic: yes/no fields → attainment rate
    const fieldStatsKeys = new Set();
    for (const r of resolved) {
      if (r.stats.fieldStats) {
        for (const [key, fs] of Object.entries(r.stats.fieldStats)) {
          if (!fieldStatsKeys.has(key)) {
            fieldStatsKeys.add(key);
            if (fs.type === "yesno") {
              metrics.push({ key: `yesno:${key}`, label: `${fs.label} %`, defaultDir: "higher" });
            }
            if (fs.type === "number") {
              metrics.push({ key: `fieldMean:${key}`, label: `Mean ${fs.label}`, defaultDir: "higher" });
            }
          }
        }
      }
    }
    return metrics;
  }, [resolved]);

  // Auto-initialize config if empty
  useEffect(() => {
    if (config.length === 0 && availableMetrics.length > 0) {
      setConfig(availableMetrics.slice(0, 3).map((m) => ({ key: m.key, label: m.label, direction: m.defaultDir, enabled: true })));
    }
  }, [availableMetrics]);

  const toggleMetric = (key) => {
    setConfig((prev) => {
      const exists = prev.find((c) => c.key === key);
      if (exists) return prev.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c));
      const meta = availableMetrics.find((m) => m.key === key);
      return [...prev, { key, label: meta?.label || key, direction: meta?.defaultDir || "lower", enabled: true }];
    });
  };

  const toggleDirection = (key) => {
    setConfig((prev) => prev.map((c) => (c.key === key ? { ...c, direction: c.direction === "lower" ? "higher" : "lower" } : c)));
  };

  const getMetricValue = (r, metricKey) => {
    if (metricKey.startsWith("yesno:")) {
      const fk = metricKey.slice(6);
      return r.stats.fieldStats?.[fk]?.pct ?? null;
    }
    if (metricKey.startsWith("fieldMean:")) {
      const fk = metricKey.slice(10);
      return r.stats.fieldStats?.[fk]?.mean ?? null;
    }
    return r.stats[metricKey] ?? null;
  };

  const enabledConfig = config.filter((c) => c.enabled);

  // Compute rankings
  const rankings = useMemo(() => {
    if (enabledConfig.length === 0 || resolved.length < 1) return [];
    return resolved.map((r) => {
      const scores = enabledConfig.map((c) => {
        const values = resolved.map((rr) => getMetricValue(rr, c.key)).filter((v) => v != null);
        const val = getMetricValue(r, c.key);
        if (val == null || values.length < 2) return null;
        const min = Math.min(...values), max = Math.max(...values);
        if (max === min) return 0.5;
        const norm = (val - min) / (max - min);
        return c.direction === "lower" ? norm : 1 - norm;
      }).filter((s) => s !== null);
      const composite = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
      return { session: r.session, color: r.color, composite, resolved: r };
    }).sort((a, b) => a.composite - b.composite);
  }, [resolved, enabledConfig]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-muted-foreground/50 flex-1">
          {resolved.length < 2 ? "Add sessions to compare rankings" : `${rankings.length} sessions ranked`}
        </span>
        <button onClick={() => setEditing((e) => !e)}
          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
          {editing ? "Done" : "Configure"}
        </button>
      </div>

      {editing && (
        <div className="mb-4 p-3 bg-secondary/50 rounded-lg border border-border">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Rank by:</div>
          <div className="space-y-1.5">
            {availableMetrics.map((m) => {
              const c = config.find((cc) => cc.key === m.key);
              const enabled = c?.enabled ?? false;
              const direction = c?.direction || m.defaultDir;
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <button onClick={() => toggleMetric(m.key)}
                    className={cn("px-2 py-1 rounded text-[10px] border cursor-pointer transition-all flex-1 text-left",
                      enabled ? "bg-primary/10 border-primary/25 text-primary" : "opacity-40 bg-secondary border-border text-muted-foreground"
                    )}>{m.label}</button>
                  {enabled && (
                    <button onClick={() => toggleDirection(m.key)}
                      className="text-[9px] px-2 py-1 rounded border border-border bg-secondary text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      {direction === "lower" ? "\u2193 Lower" : "\u2191 Higher"} = better
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rankings.length >= 2 && (
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-[10px] uppercase tracking-wide px-2 py-1.5 w-8">#</th>
                <th className="text-left text-muted-foreground text-[10px] uppercase tracking-wide px-2 py-1.5">Session</th>
                {enabledConfig.map((c) => (
                  <th key={c.key} className="text-right text-muted-foreground text-[10px] uppercase tracking-wide px-2 py-1.5">
                    {c.label} {c.direction === "lower" ? "\u2193" : "\u2191"}
                  </th>
                ))}
                <th className="text-right text-muted-foreground text-[10px] uppercase tracking-wide px-2 py-1.5">Score</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((rank, i) => (
                <tr key={rank.session.id} className="border-b border-border" style={i === 0 ? { background: rank.color + "12" } : {}}>
                  <td className="px-2 py-1.5 font-bold" style={{ color: i === 0 ? rank.color : "var(--color-muted-foreground)" }}>{i + 1}</td>
                  <td className="px-2 py-1.5 font-semibold" style={{ color: rank.color }}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: rank.color }} />
                      {rank.session.config.sessionName || "Unnamed"}
                    </span>
                  </td>
                  {enabledConfig.map((c) => {
                    const val = getMetricValue(rank.resolved, c.key);
                    return (
                      <td key={c.key} className="text-right px-2 py-1.5 font-mono tabular-nums">
                        {val != null ? (Number.isInteger(val) ? val : val.toFixed(2)) : "\u2014"}
                      </td>
                    );
                  })}
                  <td className="text-right px-2 py-1.5 font-mono tabular-nums font-bold" style={{ color: i === 0 ? rank.color : undefined }}>
                    {(1 - rank.composite).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rankings.length < 2 && !editing && (
        <div className="text-center text-muted-foreground text-sm py-6">
          {resolved.length < 2 ? "Add another session to see rankings" : "Configure ranking metrics above"}
        </div>
      )}
    </div>
  );
}

function CorrelationScatterWidget({ resolved, mode, allFields }) {
  const numberFields = useMemo(() => allFields.filter((f) => f.type === "number"), [allFields]);
  const [xField, setXField] = useState(numberFields[0]?.key || "");
  const [yField, setYField] = useState(numberFields[1]?.key || numberFields[0]?.key || "");
  const [showTrend, setShowTrend] = useState(true);
  const ref = useRef();
  const [tip, setTip] = useState(null);

  const data = useMemo(() =>
    resolved.flatMap((r) =>
      r.shots.map((s) => {
        const d = s.data || s;
        return { x: parseFloat(d[xField]), y: parseFloat(d[yField]), color: r.color, serial: s.serial, sessionName: r.session.config.sessionName || "Unnamed" };
      }).filter((d) => !isNaN(d.x) && !isNaN(d.y))
    ), [resolved, xField, yField]);

  const width = 360;
  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 34, l: 42 }, w = width - m.l - m.r, h = 200 - m.t - m.b;
    const xScale = d3.scaleLinear().domain(d3.extent(data, (d) => d.x)).nice().range([0, w]);
    const yScale = d3.scaleLinear().domain(d3.extent(data, (d) => d.y)).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(yScale).ticks(4)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.selectAll("circle.dot").data(data).join("circle").attr("class", "dot")
      .attr("cx", (d) => xScale(d.x)).attr("cy", (d) => yScale(d.y)).attr("r", 5)
      .attr("fill", (d) => d.color).attr("fill-opacity", 0.8).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 0.5)
      .attr("cursor", "crosshair")
      .on("mouseenter", function (ev, d) {
        d3.select(this).attr("r", 7).attr("fill-opacity", 1);
        setTip({ x: ev.clientX, y: ev.clientY, color: d.color, lines: [d.sessionName, d.serial, `${xField}: ${d.x}`, `${yField}: ${d.y}`] });
      })
      .on("mousemove", (ev) => setTip((t) => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
      .on("mouseleave", function () { d3.select(this).attr("r", 5).attr("fill-opacity", 0.8); setTip(null); });
    if (showTrend && data.length >= 3) {
      const mx = mean(data.map((d) => d.x)), my = mean(data.map((d) => d.y));
      const num = data.reduce((s, d) => s + (d.x - mx) * (d.y - my), 0);
      const den = data.reduce((s, d) => s + (d.x - mx) ** 2, 0);
      if (den) {
        const sl = num / den, b = my - sl * mx;
        const [x0, x1] = xScale.domain();
        gg.append("line").attr("x1", xScale(x0)).attr("y1", yScale(sl * x0 + b)).attr("x2", xScale(x1)).attr("y2", yScale(sl * x1 + b))
          .attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
      }
    }
    const xLabel = allFields.find((f) => f.key === xField)?.label || xField;
    const yLabel = allFields.find((f) => f.key === yField)?.label || yField;
    svg.append("text").attr("x", width / 2).attr("y", 197).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 10).text(`${xLabel} vs ${yLabel}`);
  }, [data, width, showTrend, xField, yField, allFields]);

  return (
    <div>
      <div className="flex gap-2 mb-2 items-center flex-wrap">
        <select value={xField} onChange={(e) => setXField(e.target.value)}
          className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
          {numberFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <span className="text-muted-foreground text-xs">vs</span>
        <select value={yField} onChange={(e) => setYField(e.target.value)}
          className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
          {numberFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <Toggle label="Trend" on={showTrend} onToggle={() => setShowTrend((s) => !s)} />
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <AutoSizeChart render={(w) => {
          // Use a fixed-width approach for now
          return <svg ref={ref} width={w - 8} height={200} style={{ background: CHART_BG, borderRadius: 10 }} />;
        }} />
        <ChartTooltip tip={tip} />
      </div>
    </div>
  );
}

function FieldDistributionWidget({ resolved, mode, fieldKey, fieldLabel, fieldUnit }) {
  if (mode === "single") {
    const { shots, color } = resolved[0];
    return (
      <AutoSizeChart render={(w) => {
        const fpsShots = shots.map((s) => ({ fps: (s.data || s)[fieldKey] })).filter((s) => s.fps != null && !isNaN(s.fps));
        return <VelHist shots={fpsShots} width={w - 8} color={color || G} />;
      }} />
    );
  }
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
      {resolved.map((r) => {
        const fpsShots = r.shots.map((s) => ({ fps: (s.data || s)[fieldKey] })).filter((s) => s.fps != null && !isNaN(s.fps));
        return (
          <div key={r.session.id} className="text-center">
            <VelHist shots={fpsShots} width={260} color={r.color} />
            <div className="text-xs mt-1" style={{ color: r.color }}>{r.session.config.sessionName || "Unnamed"}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Widget Dropdown ──────────────────────────────────────────────────────

function AddWidgetDropdown({ available, registry, onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!available.length) return null;

  const categories = categorizeWidgets(available);

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all duration-150",
          open ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
        )}>
        <Plus size={12} /> Add Widget
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg p-2 shadow-xl min-w-[200px]">
          {categories.map((cat) => (
            <div key={cat.label}>
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/50 px-3 py-1">{cat.label}</div>
              {cat.items.map((w) => (
                <button key={w.key} onClick={() => { onAdd(w.key, w.defaultSpan); setOpen(false); }}
                  className="w-full text-left text-sm text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary cursor-pointer bg-transparent border-none transition-colors">
                  {w.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN ANALYSIS PAGE ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function AnalysisPage({ log, vars, fields, viewId, savedComparisons, onContinueSession, onError, onExportCsv }) {
  // ─── Session selection state ────────────────────────────────────────────────
  const [slots, setSlots] = useState(() => {
    if (viewId) return [{ id: viewId, color: PALETTE[0] }];
    return [];
  });

  // Update slots when viewId changes from outside
  useEffect(() => {
    if (viewId && !slots.some((s) => s.id === viewId)) {
      setSlots([{ id: viewId, color: PALETTE[0] }]);
    }
  }, [viewId]);

  // ─── Layout state ──────────────────────────────────────────────────────────
  const [layoutItems, setLayoutItems] = useState(null); // null = auto
  const [widgetOpts, setWidgetOpts] = useState({ showGrid: true });
  const [hiddenMetrics, setHiddenMetrics] = useState(new Set());

  // ─── Derived data ──────────────────────────────────────────────────────────
  const resolved = useMemo(
    () => resolveSlots(slots, log, fields, calcStats),
    [slots, log, fields]
  );
  const mode = resolved.length <= 1 ? "single" : "multi";
  const allFields = useMemo(() => unionFields(resolved), [resolved]);
  const commonFields = useMemo(() => intersectFields(resolved), [resolved]);
  const registry = useMemo(() => buildWidgetRegistry(allFields, commonFields, mode), [allFields, commonFields, mode]);

  const activeLayout = useMemo(() => {
    if (layoutItems) {
      // Filter out widgets whose requirements are no longer met
      return layoutItems.filter((item) => {
        const def = registry[item.key];
        return def && def.requires(mode === "single" ? allFields : commonFields);
      });
    }
    return autoLayout(allFields, commonFields, resolved.length);
  }, [layoutItems, registry, allFields, commonFields, mode, resolved.length]);

  const available = useMemo(
    () => getAvailableWidgets(registry, activeLayout, mode === "single" ? allFields : commonFields),
    [registry, activeLayout, allFields, commonFields, mode]
  );

  // ─── Layout actions ────────────────────────────────────────────────────────
  const handleReorder = useCallback((newItems) => setLayoutItems(newItems), []);
  const handleRemove = useCallback((key) => {
    setLayoutItems((prev) => (prev || activeLayout).filter((item) => item.key !== key));
  }, [activeLayout]);
  const handleToggleSpan = useCallback((key) => {
    setLayoutItems((prev) => {
      const items = prev || activeLayout;
      return items.map((item) => (item.key === key ? { ...item, span: item.span === "full" ? "half" : "full" } : item));
    });
  }, [activeLayout]);
  const handleAddWidget = useCallback((key, defaultSpan) => {
    setLayoutItems((prev) => {
      const items = prev || [...activeLayout];
      return [...items, { key, span: defaultSpan || "half" }];
    });
  }, [activeLayout]);
  const handleResetLayout = useCallback(() => setLayoutItems(null), []);

  const toggleOpt = useCallback((key) => {
    setWidgetOpts((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const setOpt = useCallback((key, value) => {
    setWidgetOpts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleHiddenMetric = useCallback((id) => {
    setHiddenMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ─── Widget renderer ───────────────────────────────────────────────────────
  const renderWidget = useCallback((key) => {
    if (!resolved.length) return <div className="text-muted-foreground text-sm">No sessions selected</div>;

    if (key === "dispersion") return <DispersionWidget resolved={resolved} mode={mode} opts={widgetOpts} toggleOpt={toggleOpt} />;
    if (key === "metricsSummary") return <MetricsSummaryWidget resolved={resolved} mode={mode} opts={widgetOpts} toggleOpt={toggleOpt} hiddenMetrics={hiddenMetrics} onToggleMetric={toggleHiddenMetric} />;
    if (key === "shotTable") return <ShotTableWidget resolved={resolved} mode={mode} commonFields={commonFields} />;
    if (key === "attachments") return <AttachmentsWidget resolved={resolved} mode={mode} onError={onError} />;
    if (key === "customRankings") return <CustomRankingsWidget resolved={resolved} mode={mode} />;
    if (key === "correlationScatter") return <CorrelationScatterWidget resolved={resolved} mode={mode} allFields={allFields} />;

    // Dynamic attainment widgets
    if (key.startsWith("attainment:")) {
      const def = registry[key];
      return <AttainmentRateWidget resolved={resolved} mode={mode} fieldKey={def.fieldKey} fieldLabel={def.fieldLabel} />;
    }

    // Dynamic distribution widgets
    if (key.startsWith("distribution:")) {
      const def = registry[key];
      return <FieldDistributionWidget resolved={resolved} mode={mode} fieldKey={def.fieldKey} fieldLabel={def.fieldLabel} fieldUnit={def.fieldUnit} />;
    }

    return <div className="text-muted-foreground text-sm">Unknown widget: {key}</div>;
  }, [resolved, mode, widgetOpts, toggleOpt, hiddenMetrics, toggleHiddenMetric, commonFields, allFields, registry, onError]);

  // ─── Session header info ───────────────────────────────────────────────────
  const primarySession = resolved[0]?.session;
  const cfgLine = primarySession ? vars.map((v) => primarySession.config[v.key]).filter(Boolean).join("  \u00b7  ") : "";

  if (!resolved.length) {
    return (
      <div className="text-center py-16">
        <div className="text-muted-foreground text-lg mb-4">Select a session to analyze</div>
        <SessionPicker slots={slots} setSlots={setSlots} log={log} vars={vars} />
      </div>
    );
  }

  return (
    <div>
      {/* Session header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: "#111118", borderTop: `3px solid ${G}` }}>
          <div>
            <div className="text-lg font-bold text-foreground">
              {mode === "multi" ? "Comparison" : primarySession.config.sessionName || "Unnamed Session"}
            </div>
            {cfgLine && <div className="text-xs text-muted-foreground mt-1">{cfgLine}</div>}
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums" style={{ color: G }}>
              {resolved.reduce((sum, r) => sum + r.shots.length, 0)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">shots</div>
          </div>
        </div>
      </div>

      {/* Session picker */}
      <SessionPicker slots={slots} setSlots={setSlots} log={log} vars={vars} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {mode === "single" && primarySession && (
          <button onClick={() => onContinueSession?.(primarySession.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground text-xs font-medium cursor-pointer hover:text-foreground transition-colors">
            Edit Session
          </button>
        )}
        <button onClick={() => onExportCsv?.()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground text-xs font-medium cursor-pointer hover:text-foreground transition-colors">
          Export CSV
        </button>
        <div className="flex-1" />
        <AddWidgetDropdown available={available} registry={registry} onAdd={handleAddWidget} />
        {layoutItems && (
          <button onClick={handleResetLayout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground text-xs font-medium cursor-pointer hover:text-foreground transition-colors">
            <RotateCcw size={11} /> Reset Layout
          </button>
        )}
      </div>

      {/* Widget grid */}
      <WidgetGrid
        items={activeLayout}
        onReorder={handleReorder}
        onRemove={handleRemove}
        onToggleSpan={handleToggleSpan}
        registry={registry}
        renderWidget={renderWidget}
      />
    </div>
  );
}
