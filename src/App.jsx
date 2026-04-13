import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useScroll } from "@/components/use-scroll";
import { useSortable } from '@dnd-kit/sortable';
import { CSS as dndCSS } from '@dnd-kit/utilities';
import { Crosshair, BarChart2, History, X, Plus, Paperclip } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen.jsx';
import { AttachmentWidget } from './components/AttachmentWidget.jsx';
import { LibraryPage } from './components/LibraryPage.jsx';
import { VelRankingWidget } from './components/VelRankingWidget.jsx';
import { AccuracyRankingWidget } from './components/AccuracyRankingWidget.jsx';
import * as db from './lib/db.js';
import { toPng } from 'html-to-image';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const G    = "#FFDF00";
const BG   = "#f7f7fa";
const SURF = "#ffffff";
const SURF2= "#f0f0f4";
const BD   = "rgba(0,0,0,0.09)";
const BD_HI= "rgba(0,0,0,0.16)";
const TX   = "#111118";
const TX2  = "#6b6b7e";
const FONT = "'Inter Variable', system-ui, sans-serif";
// Chart-specific — charts stay dark for contrast
const CHART_BG = "#0f0f14";
const GRID_CLR = "rgba(255,255,255,0.10)";
const AXIS_CLR = "rgba(255,255,255,0.40)";
const TICK_CLR = "rgba(255,255,255,0.85)";

// ─── Widget zone defaults ────────────────────────────────────────────────────
const DEFAULT_ZONE = {
  overlay:  'full',
  rankings: 'full',
  metrics:  'full',
  velCompare: 'full',
  shotLog:  'full',
  attachments: 'full',
};
const DEFAULT_CMP_LAYOUT = [
  { i: 'overlay',  zone: 'full' },
  { i: 'rankings', zone: 'full' },
  { i: 'metrics',  zone: 'full' },
];
const DEFAULT_CMP_SPLIT = '2/3';

// Migrate old velRanking/accuracyRanking entries to combined rankings widget
function migrateLayout(items) {
  const hasOld = items.some(item => item.i === 'velRanking' || item.i === 'accuracyRanking');
  if (!hasOld) return items;
  const zone = (items.find(item => item.i === 'velRanking') ?? items.find(item => item.i === 'accuracyRanking'))?.zone ?? 'sidebar';
  const out = items.filter(item => item.i !== 'velRanking' && item.i !== 'accuracyRanking');
  if (!out.some(item => item.i === 'rankings')) out.splice(1, 0, { i: 'rankings', zone });
  return out;
}

// ─── Data constants ───────────────────────────────────────────────────────────
const PALETTE=["#FFDF00","#3b82f6","#ef4444","#22c55e","#a855f7","#f97316","#06b6d4","#ec4899","#84cc16","#f43f5e"];
const DEF_OPTS={rifleRate:["1-6","1-8","1-10","1-12","1-14","1-16","1-18"],sleeveType:["Slotted PLA","Not Slotted PLA","ABS","Ribbed","TPU","Delrin + O ring","Brass (14.65)","Brass (14.75)","Brass (14.80)","Brass (14.65) Reused","Brass (14.75) Reused","S-13 14.80 od","S-16 14.80 od","S-16 14.80 od (Reused)","S-17 14.85 od","S-21 14.90 od"],tailType:["Straight","Tapered","Steep Taper","Round","Biridge","Triridge","Indented"],combustionChamber:["Short (1.5)","Long (1.5)"],load22:["Red","Purple"]};
const DEF_VARS=[{key:"rifleRate",label:"Rifle Rate",core:true},{key:"sleeveType",label:"Sleeve Type",core:true},{key:"tailType",label:"Tail Type",core:true},{key:"combustionChamber",label:"Combustion Chamber",core:true},{key:"load22",label:".22 Load",core:true}];
const DEFAULT_FIELDS = [
  { key: "fps", label: "FPS", type: "number", required: true, options: [], unit: "fps" },
  { key: "x", label: "X", type: "number", required: true, options: [], unit: "in" },
  { key: "y", label: "Y", type: "number", required: true, options: [], unit: "in" },
  { key: "weight", label: "Weight", type: "number", required: false, options: [], unit: "g" },
];
const ALL_METRICS=[["CEP (50%)","cep",3,true],["R90","r90",3,true],["Mean Radius","mr",3,true],["Ext. Spread","es",3,true],["SD X","sdX",3,true],["SD Y","sdY",3,true],["SD Radial","sdR",3,false],["MPI X","mpiX",3,false],["MPI Y","mpiY",3,false],["Mean FPS","meanV",1,true],["SD FPS","sdV",1,true],["ES FPS","esV",1,true]];
const LOWER_BETTER=["CEP (50%)","R90","Mean Radius","Ext. Spread","SD X","SD Y","SD Radial","SD FPS","ES FPS"];
const OC = { cep: "#3b82f6", r90: "#a855f7", ellipse: "#06b6d4", mpi: "#22c55e" }; // overlay colors

// ─── Metric descriptions & formulas (for hover tooltips) ──────────────────────
const METRIC_INFO = {
  "CEP":         { desc: "Radius of a circle centered on the MPI that contains 50% of shots. The primary precision metric — lower is tighter.", formula: "Sort radii from MPI → 50th percentile value" },
  "CEP (50%)":   { desc: "Radius of a circle centered on the MPI that contains 50% of shots. The primary precision metric — lower is tighter.", formula: "Sort radii from MPI → 50th percentile value" },
  "R90":         { desc: "Radius containing 90% of shots around the MPI. Measures worst-case spread, excluding extreme outliers.", formula: "Sort radii from MPI → 90th percentile value" },
  "Mean Radius": { desc: "Average radial distance of all shots from the MPI. More sensitive to outliers than CEP.", formula: "Mean( √((x − MPI_x)² + (y − MPI_y)²) )" },
  "Mean Rad":    { desc: "Average radial distance of all shots from the MPI. More sensitive to outliers than CEP.", formula: "Mean( √((x − MPI_x)² + (y − MPI_y)²) )" },
  "Ext. Spread": { desc: "Diameter of the smallest circle enclosing all shots. Absolute worst-to-worst spread.", formula: "2 × max( radii from MPI )" },
  "Ext Spread":  { desc: "Diameter of the smallest circle enclosing all shots. Absolute worst-to-worst spread.", formula: "2 × max( radii from MPI )" },
  "SD X":        { desc: "Standard deviation of horizontal (X) shot positions. High SD X means the group is stretched left-right.", formula: "√( Σ(x − x̄)² / (n−1) )" },
  "SD Y":        { desc: "Standard deviation of vertical (Y) shot positions. High SD Y means the group is stretched up-down.", formula: "√( Σ(y − ȳ)² / (n−1) )" },
  "SD Radial":   { desc: "Standard deviation of radial distances from the MPI. Measures how consistent the group size is shot-to-shot.", formula: "√( Σ(r − r̄)² / (n−1) )" },
  "MPI X":       { desc: "Horizontal mean point of impact. Non-zero means the group center is offset left or right from bore sight.", formula: "Σx / n" },
  "MPI Y":       { desc: "Vertical mean point of impact. Non-zero means the group center is offset up or down from bore sight.", formula: "Σy / n" },
  "MPI X/Y":     { desc: "Mean point of impact — average center of all shots. Offset from (0, 0) reveals sight alignment error independent of precision.", formula: "MPI_x = Σx / n,   MPI_y = Σy / n" },
  "Mean FPS":    { desc: "Average muzzle velocity across all shots.", formula: "Σfps / n" },
  "SD FPS":      { desc: "Shot-to-shot velocity consistency. Lower = more uniform propellant burn. High SD FPS causes vertical stringing.", formula: "√( Σ(fps − fps̄)² / (n−1) )" },
  "ES FPS":      { desc: "Extreme velocity spread — fastest minus slowest shot. Full range of velocity variation.", formula: "max(fps) − min(fps)" },
};

// ─── Math helpers ─────────────────────────────────────────────────────────────
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
const rad=(x,y)=>Math.sqrt(x*x+y*y);
function calcStats(shots, sessionFields) {
  // Legacy accuracy stats — only when x + y fields present
  const hasXY = !sessionFields || (sessionFields.some(f => f.key === "x") && sessionFields.some(f => f.key === "y"));
  const hasFps = !sessionFields || sessionFields.some(f => f.key === "fps");
  const v = hasXY
    ? shots.filter(s => { const d = s.data || s; return !isNaN(d.x) && !isNaN(d.y); })
    : shots;
  let cep=0,r90=0,mpiX=0,mpiY=0,mr=0,es=0,sdR=0,covEllipse=null,sdX=0,sdY=0;
  if (hasXY && v.length >= 2) {
    const xs=v.map(s=>(s.data||s).x),ys=v.map(s=>(s.data||s).y);
    mpiX=mean(xs); mpiY=mean(ys);
    const radii=v.map(s=>rad((s.data||s).x-mpiX,(s.data||s).y-mpiY)),sorted=[...radii].sort((a,b)=>a-b);
    cep=sorted[Math.floor(sorted.length*.5)]||0;
    r90=sorted[Math.min(Math.floor(sorted.length*.9),sorted.length-1)]||0;
    mr=mean(radii); es=Math.max(...radii)*2; sdR=std(radii); sdX=std(xs); sdY=std(ys);
    if(v.length>=3){const cx=xs.map(q=>q-mpiX),cy=ys.map(q=>q-mpiY),n=cx.length,sxx=cx.reduce((s2,q)=>s2+q*q,0)/(n-1),syy=cy.reduce((s2,q)=>s2+q*q,0)/(n-1),sxy=cx.reduce((s2,q,i)=>s2+q*cy[i],0)/(n-1),t=Math.atan2(2*sxy,sxx-syy)/2,k=2.146,a2=(sxx+syy)/2+Math.sqrt(((sxx-syy)/2)**2+sxy**2),b2=(sxx+syy)/2-Math.sqrt(((sxx-syy)/2)**2+sxy**2);covEllipse={rx:Math.sqrt(Math.max(a2,.001)*k),ry:Math.sqrt(Math.max(b2,.001)*k),angle:t*180/Math.PI};}
  }
  // Velocity stats — only when fps field present
  let sdV=0,meanV=0,esV=0;
  if (hasFps) {
    const vs=shots.map(s=>(s.data||s).fps).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    if(vs.length>=2){sdV=std(vs);meanV=mean(vs);esV=Math.max(...vs)-Math.min(...vs);}
    else if(vs.length===1){meanV=vs[0];}
  }
  // Dynamic per-field stats
  const fieldStats = {};
  if (sessionFields) {
    for (const f of sessionFields) {
      if (f.type === "number" && !["x","y","fps"].includes(f.key)) {
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
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
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
        const yesCount = vals.filter(v => v === true).length;
        fieldStats[f.key] = {
          type: "yesno", label: f.label,
          yes: yesCount, no: vals.length - yesCount, total: vals.length,
          pct: vals.length > 0 ? Math.round(yesCount / vals.length * 100) : 0,
        };
      } else if (f.type === "dropdown") {
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
        const counts = {};
        for (const v of vals) counts[v] = (counts[v] || 0) + 1;
        fieldStats[f.key] = { type: "dropdown", label: f.label, counts, total: vals.length };
      }
      // text fields: no stats
    }
  }
  return { cep, r90, mpiX, mpiY, mr, es, sdR, sdV, meanV, esV, covEllipse, n: v.length, sdX, sdY, fieldStats, hasXY, hasFps };
}
function makeSerial(cfg,num,offset){return`SP1-03 ${cfg.rifleRate||""}RR ${String(offset+num).padStart(2,"0")}`;}
function esc(v){const s=String(v??"");return s.includes(",")||s.includes('"')||s.includes("\n")?'"'+s.replace(/"/g,'""')+'"':s;}
function rowC(a){return a.map(esc).join(",");}
function dl(t,fn,m){const b=new Blob([t],{type:m}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
function exportMasterCsv(log,vars){const h=["Serial #",...vars.map(v=>v.label),"X (in)","Y (in)","Chrono FPS","Weight (g)","Time Stamp","Date","Notes"];const rows=[rowC(h)];log.forEach(s=>{s.shots.forEach(sh=>{rows.push(rowC([sh.serial,...vars.map(v=>s.config[v.key]||""),sh.x,sh.y,sh.fps,sh.weight||"",sh.timestamp||"",s.config.date||"",s.config.notes||""]));});});dl(rows.join("\n"),"Ballistic_Master.csv","text/csv");}
function exportJson(log){dl(JSON.stringify(log,null,2),"Ballistic_All.json","application/json");}
function countOverlaps(shots){const m={};shots.forEach(s=>{const k=`${s.x},${s.y}`;m[k]=(m[k]||0)+1;});return m;}

// ─── Style helpers ────────────────────────────────────────────────────────────
const inp = "w-full border border-input bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none transition-colors rounded-none";
// card: still used for inline overrides (borderColor, etc.)
const card = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 2 };

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Btn({ children, onClick, v = "primary", disabled, cls = "" }) {
  const variant = v === "primary" ? "default" : v === "secondary" ? "outline" : "destructive";
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick}
      className={cn("h-auto py-2 px-4 text-sm font-semibold cursor-pointer", cls)}>
      {children}
    </Button>
  );
}

function MetricTip({ label, children }) {
  const info = METRIC_INFO[label];
  const [tip, setTip] = useState(null);
  if (!info) return <>{children}</>;
  return (
    <span
      className="cursor-help"
      onMouseEnter={ev => setTip({ x: ev.clientX, y: ev.clientY })}
      onMouseMove={ev => setTip({ x: ev.clientX, y: ev.clientY })}
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
          <div style={{ color: TX2, marginBottom: 8, whiteSpace: "normal" }}>{info.desc}</div>
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 7,
            fontFamily: "monospace", color: "rgba(255,255,255,0.5)", fontSize: 10,
            whiteSpace: "pre",
          }}>{info.formula}</div>
        </div>
      )}
    </span>
  );
}

function SB({ label, value, gold, accentColor, onClick, active }) {
  const linked = !!onClick;
  const ac = linked
    ? (active ? accentColor : null)
    : accentColor || (gold ? G : null);
  return (
    <div
      className={cn(
        "relative rounded-lg p-4 transition-all duration-200 overflow-hidden",
        linked ? "cursor-pointer select-none" : "",
        linked && active  && "",
        linked && !active && "opacity-35 hover:opacity-65",
      )}
      style={{
        background: linked && active && accentColor
          ? accentColor + "12"
          : "var(--color-secondary)",
        border: "1px solid",
        borderColor: ac
          ? ac + "30"
          : "var(--color-border)",
        borderTop: `2px solid ${ac || "rgba(255,255,255,0.08)"}`,
      }}
      onClick={onClick}>
      {linked && (
        <span
          className="absolute top-3 right-3 size-1.5 rounded-full transition-all duration-200"
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

function SmartSelect({ label, value, onChange, options, onAddOption }) {
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState("");
  const add = () => { if (!nv.trim()) return; onAddOption(nv.trim()); onChange(nv.trim()); setNv(""); setAdding(false); };
  return (
    <div className="flex flex-col">
      <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {adding ? (
        <div className="flex gap-1">
          <input value={nv} onChange={e => setNv(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }}
            placeholder="New option…" className={inp} autoFocus />
          <button onClick={add} className="px-2.5 text-xs font-bold text-primary cursor-pointer bg-transparent border-none shrink-0">Add</button>
          <button onClick={() => setAdding(false)} className="px-1.5 text-xs text-muted-foreground cursor-pointer bg-transparent border-none shrink-0">✕</button>
        </div>
      ) : (
        <div className="flex gap-1">
          <select value={value} onChange={e => onChange(e.target.value)} className={inp}>
            <option value="">—</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={() => setAdding(true)} title="Add option"
            className="px-2.5 text-lg font-light text-primary cursor-pointer bg-transparent border-none shrink-0 leading-none">+</button>
        </div>
      )}
    </div>
  );
}

function WidgetAdder({ available, labels, onAdd }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef();

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!available.length) return null;

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < 220) {
        setPos({ bottom: window.innerHeight - r.top + 6, top: null, left: r.left });
      } else {
        setPos({ top: r.bottom + 6, bottom: null, left: r.left });
      }
    }
    setOpen(o => !o);
  };

  return (
    <div ref={btnRef}>
      <button
        onClick={handleOpen}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all duration-150",
          open
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
        )}>
        <Plus size={12} />
        Add Widget
      </button>
      {open && (
        <div style={{ position: "fixed", top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, left: pos.left, zIndex: 200 }}
          className="bg-card border border-border rounded-lg p-1.5 shadow-xl flex flex-col min-w-[170px]">
          {available.map(k => (
            <button key={k} onClick={() => { onAdd(k); setOpen(false); }}
              className="text-left text-sm text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary cursor-pointer bg-transparent border-none transition-colors">
              {labels[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ color, onChange }) {
  const names = ["Gold","Blue","Red","Green","Purple","Orange","Cyan","Pink","Lime","Rose"];
  return (
    <select value={color} onChange={e => onChange(e.target.value)}
      style={{ background: "var(--color-secondary)", color, border: `1px solid ${color}40`, borderRadius: 8,
        padding: "6px 10px", fontSize: 12, fontWeight: 600, minWidth: 88, cursor: "pointer" }}>
      {PALETTE.map((c, i) => <option key={c} value={c} style={{ color: c, background: "#111" }}>{names[i]}</option>)}
    </select>
  );
}

function ShotAttachBtn({ shotId, sessionId, serial, pendingCount = 0, onQueue, onError }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const total = pendingCount + doneCount;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = '';
    if (onQueue) { onQueue(serial, files); return; }
    setUploading(true);
    try {
      for (const file of files) await db.uploadAttachment(file, shotId, sessionId);
      setDoneCount(c => c + files.length);
    } catch (err) {
      onError?.('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf" onChange={handleFiles} style={{ display: 'none' }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading || (!onQueue && !shotId)}
        title={`Attach file to ${serial}`}
        className="inline-flex items-center gap-1 cursor-pointer bg-transparent border-none disabled:opacity-30 transition-colors"
        style={{ color: total > 0 ? G : '#aaa' }}
        onMouseEnter={e => { if (!uploading) e.currentTarget.style.color = '#111'; }}
        onMouseLeave={e => { e.currentTarget.style.color = total > 0 ? G : '#aaa'; }}>
        {uploading ? <span className="text-[10px] font-bold">…</span> : <Paperclip size={11} strokeWidth={2} />}
        {total > 0 && <span className="text-[9px] font-black">{total}</span>}
      </button>
    </span>
  );
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
function drawShots(g, shots, sc, color) {
  const ov = countOverlaps(shots), dr = {};
  shots.forEach(s => {
    const k = `${s.x},${s.y}`, cnt = ov[k], ad = dr[k] || 0; dr[k] = ad + 1;
    if (cnt > 1 && ad === 0) {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5)
        .attr("fill", color).attr("fill-opacity", .9).attr("stroke", "rgba(255,255,255,0.35)").attr("stroke-width", .5);
      g.append("text").attr("x", sc(s.x) + 7).attr("y", sc(-s.y) + 3).text("×" + cnt)
        .attr("fill", TICK_CLR).attr("font-size", 8).attr("font-weight", "500");
    } else if (cnt > 1) {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5 + ad * 3)
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", 1).attr("stroke-opacity", .45);
    } else {
      g.append("circle").attr("cx", sc(s.x)).attr("cy", sc(-s.y)).attr("r", 4.5)
        .attr("fill", color).attr("fill-opacity", .88).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .5);
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
      .attr("stroke", OC.r90).attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("stroke-opacity", .65);
    g.append("text").attr("x", cx + rp + 4).attr("y", cy + 10).text("R90")
      .attr("fill", OC.r90).attr("font-size", 9).attr("font-weight", "600");
  }
  if (opts.showEllipse && stats.covEllipse) {
    const { rx, ry, angle } = stats.covEllipse;
    g.append("ellipse").attr("cx", cx).attr("cy", cy)
      .attr("rx", Math.abs(sc(rx) - sc(0))).attr("ry", Math.abs(sc(ry) - sc(0)))
      .attr("transform", `rotate(${-angle},${cx},${cy})`).attr("fill", "none")
      .attr("stroke", OC.ellipse).attr("stroke-width", 1).attr("stroke-opacity", .5);
  }
  if (opts.showMpi) {
    g.append("line").attr("x1", cx - 6).attr("x2", cx + 6).attr("y1", cy).attr("y2", cy).attr("stroke", OC.mpi).attr("stroke-width", 1.5);
    g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", cy - 6).attr("y2", cy + 6).attr("stroke", OC.mpi).attr("stroke-width", 1.5);
  }
}

function drawAxes(svg, sc, size, m, w) {
  const g = svg.select("g");
  sc.ticks(6).filter(t => t !== 0).forEach(t => {
    g.append("text").attr("x", sc(t)).attr("y", w + 14).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 9).text(t);
    g.append("text").attr("x", -14).attr("y", sc(-t) + 3).attr("text-anchor", "middle").attr("fill", TICK_CLR).attr("font-size", 9).text(t);
  });
  svg.append("text").attr("x", size / 2).attr("y", size - 3).attr("text-anchor", "middle")
    .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("X (in)");
  svg.append("text").attr("transform", `translate(11,${size / 2}) rotate(-90)`).attr("text-anchor", "middle")
    .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Y (in)");
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ tip }) {
  if (!tip) return null;
  const style = {
    position: "fixed", left: tip.x + 14, top: tip.y - 10,
    pointerEvents: "none", zIndex: 100,
    background: "#1b1b22", border: `1px solid ${tip.color ? tip.color + "40" : "rgba(255,255,255,0.13)"}`,
    borderRadius: 8, padding: "7px 11px", fontSize: 11, lineHeight: 1.7,
    color: "#ededf2", whiteSpace: "nowrap",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  };
  return (
    <div style={style}>
      {tip.lines.map((l, i) => (
        <div key={i} style={i === 0 && tip.color ? { color: tip.color, fontWeight: 600 } : undefined}>{l}</div>
      ))}
    </div>
  );
}

// ─── Chart components ─────────────────────────────────────────────────────────
function DispersionChart({ shots, stats, size = 380, opts = { showCep: true, showR90: true, showEllipse: true, showMpi: true, showGrid: true }, color = G }) {
  const ref = useRef();
  const wrapRef = useRef();
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!ref.current || !shots.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = 44, w = size - 2 * m, maxR = Math.max(...shots.map(s => Math.max(Math.abs(s.x), Math.abs(s.y))), stats.r90 || 1, 1) * 1.4;
    const sc = d3.scaleLinear().domain([-maxR, maxR]).range([0, w]);
    const g = svg.append("g").attr("transform", `translate(${m},${m})`);

    if (opts.showGrid) sc.ticks(8).forEach(t => {
      g.append("line").attr("x1", sc(t)).attr("x2", sc(t)).attr("y1", 0).attr("y2", w).attr("stroke", GRID_CLR);
      g.append("line").attr("y1", sc(t)).attr("y2", sc(t)).attr("x1", 0).attr("x2", w).attr("stroke", GRID_CLR);
    });
    g.append("line").attr("x1", sc(0)).attr("x2", sc(0)).attr("y1", 0).attr("y2", w).attr("stroke", AXIS_CLR);
    g.append("line").attr("y1", sc(0)).attr("y2", sc(0)).attr("x1", 0).attr("x2", w).attr("stroke", AXIS_CLR);

    // Crosshair lines (hidden by default)
    const chX = g.append("line").attr("y1", 0).attr("y2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    const chY = g.append("line").attr("x1", 0).attr("x2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");

    drawOverlays(g, stats, sc, color, opts);
    drawShots(g, shots, sc, color);
    drawAxes(svg, sc, size, m, w);

    // Hit-test overlay — transparent circles on each shot for hover detection
    const mpiX = stats.mpiX || 0, mpiY = stats.mpiY || 0;
    shots.forEach(s => {
      const cx = sc(s.x), cy = sc(-s.y);
      g.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", 10)
        .attr("fill", "transparent").attr("cursor", "crosshair")
        .on("mouseenter", (ev) => {
          const r = rad(s.x - mpiX, s.y - mpiY);
          chX.attr("x1", cx).attr("x2", cx).style("display", null);
          chY.attr("y1", cy).attr("y2", cy).style("display", null);
          setTip({
            x: ev.clientX, y: ev.clientY,
            lines: [
              `\u2116\u00a0${s.shotNum}  ${s.serial || ""}`,
              `FPS\u00a0${s.fps}  Wt\u00a0${s.weight || "—"}`,
              `X\u00a0${s.x}  Y\u00a0${s.y}`,
              `Radial\u00a0${r.toFixed(3)}\u00a0in`,
            ],
          });
        })
        .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
        .on("mouseleave", () => { chX.style("display", "none"); chY.style("display", "none"); setTip(null); });
    });
  }, [shots, stats, size, opts, color]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }}
        onMouseLeave={() => setTip(null)} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function DispersionMulti({ sessions, size = 440, opts = { showCep: true, showR90: true, showEllipse: true, showMpi: true } }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!ref.current || !sessions.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const all = sessions.flatMap(d => d.shots); if (!all.length) return;
    const m = 44, w = size - 2 * m, maxR = Math.max(...all.map(s => Math.max(Math.abs(s.x), Math.abs(s.y))), 1) * 1.4;
    const sc = d3.scaleLinear().domain([-maxR, maxR]).range([0, w]);
    const g = svg.append("g").attr("transform", `translate(${m},${m})`);
    sc.ticks(8).forEach(t => {
      g.append("line").attr("x1", sc(t)).attr("x2", sc(t)).attr("y1", 0).attr("y2", w).attr("stroke", GRID_CLR);
      g.append("line").attr("y1", sc(t)).attr("y2", sc(t)).attr("x1", 0).attr("x2", w).attr("stroke", GRID_CLR);
    });
    g.append("line").attr("x1", sc(0)).attr("x2", sc(0)).attr("y1", 0).attr("y2", w).attr("stroke", AXIS_CLR);
    g.append("line").attr("y1", sc(0)).attr("y2", sc(0)).attr("x1", 0).attr("x2", w).attr("stroke", AXIS_CLR);

    // Crosshair lines
    const chX = g.append("line").attr("y1", 0).attr("y2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");
    const chY = g.append("line").attr("x1", 0).attr("x2", w).attr("stroke", "rgba(255,255,255,0.18)").attr("stroke-width", 1).attr("pointer-events", "none").style("display", "none");

    sessions.forEach(d => { drawOverlays(g, d.stats, sc, d.color, opts); drawShots(g, d.shots, sc, d.color); });
    drawAxes(svg, sc, size, m, w);

    // Hit-test overlay per session so tooltip includes session name + color
    sessions.forEach(d => {
      const mpiX = d.stats.mpiX || 0, mpiY = d.stats.mpiY || 0;
      const sessionName = d.session?.config?.sessionName || "Session";
      d.shots.forEach(s => {
        const cx = sc(s.x), cy = sc(-s.y);
        const r = rad(s.x - mpiX, s.y - mpiY);
        g.append("circle")
          .attr("cx", cx).attr("cy", cy).attr("r", 10)
          .attr("fill", "transparent").attr("cursor", "crosshair")
          .on("mouseenter", (ev) => {
            chX.attr("x1", cx).attr("x2", cx).style("display", null);
            chY.attr("y1", cy).attr("y2", cy).style("display", null);
            setTip({
              x: ev.clientX, y: ev.clientY,
              lines: [
                sessionName,
                `\u2116\u00a0${s.shotNum}  ${s.serial || ""}`,
                `FPS\u00a0${s.fps}  Wt\u00a0${s.weight || "—"}`,
                `X\u00a0${s.x}  Y\u00a0${s.y}`,
                `Radial\u00a0${r.toFixed(3)}\u00a0in`,
              ],
              color: d.color,
            });
          })
          .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
          .on("mouseleave", () => { chX.style("display", "none"); chY.style("display", "none"); setTip(null); });
      });
    });
  }, [sessions, size, opts]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }}
        onMouseLeave={() => setTip(null)} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function VelHist({ shots, width = 360, color = G }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 20, r: 15, b: 34, l: 38 }, w = width - m.l - m.r, h = 145 - m.t - m.b;
    const vs = shots.map(s => s.fps);
    const x = d3.scaleLinear().domain([Math.min(...vs) - 15, Math.max(...vs) + 15]).range([0, w]);
    const bins = d3.bin().domain(x.domain()).thresholds(Math.min(shots.length, 14))(vs);
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.selectAll("rect").data(bins).join("rect")
      .attr("x", d => x(d.x0) + 1).attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2)).attr("height", d => h - y(d.length))
      .attr("fill", color).attr("fill-opacity", .7).attr("rx", 2);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    const bw = std(vs) * .6 || 5;
    const kde = x.ticks(50).map(t => [t, vs.reduce((s2, vi) => s2 + Math.exp(-.5 * ((t - vi) / bw) ** 2), 0) / (vs.length * bw * Math.sqrt(2 * Math.PI))]);
    const yK = d3.scaleLinear().domain([0, d3.max(kde, d => d[1])]).range([h, 0]);
    gg.append("path").datum(kde).attr("fill", "none").attr("stroke", "rgba(255,255,255,0.45)").attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d[0])).y(d => yK(d[1])).curve(d3.curveBasis));
    svg.append("text").attr("x", width / 2).attr("y", 142).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Velocity (fps)");
  }, [shots, width, color]);
  return <svg ref={ref} width={width} height={145} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function VelRad({ shots, width = 360 }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 34, l: 42 }, w = width - m.l - m.r, h = 145 - m.t - m.b;
    const data = shots.map((s, i) => ({ v: s.fps, r: rad(s.x, s.y), shotNum: s.shotNum || i + 1 }));
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.v)).nice().range([0, w]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.r) * 1.2]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.v)).attr("cy", d => y(d.r)).attr("r", 5)
      .attr("fill", G).attr("fill-opacity", .8).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .5)
      .attr("cursor", "crosshair")
      .on("mouseenter", function(ev, d) {
        d3.select(this).attr("r", 7).attr("fill-opacity", 1);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [`Shot\u00a0#${d.shotNum}`, `FPS\u00a0${d.v}`, `Radial\u00a0${d.r.toFixed(3)}\u00a0in`] });
      })
      .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
      .on("mouseleave", function() { d3.select(this).attr("r", 5).attr("fill-opacity", .8); setTip(null); });
    const mx = mean(data.map(d => d.v)), my = mean(data.map(d => d.r));
    const num = data.reduce((s2, d) => s2 + (d.v - mx) * (d.r - my), 0), den = data.reduce((s2, d) => s2 + (d.v - mx) ** 2, 0);
    if (den) {
      const sl = num / den, b = my - sl * mx; const [x0, x1] = x.domain();
      gg.append("line").attr("x1", x(x0)).attr("y1", y(sl * x0 + b)).attr("x2", x(x1)).attr("y2", y(sl * x1 + b))
        .attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
    }
    svg.append("text").attr("x", width / 2).attr("y", 142).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("FPS vs Radial (in)");
  }, [shots, width]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={width} height={145} style={{ background: CHART_BG, borderRadius: 10 }} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function RadialTrack({ shots, width = 360, color = G }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
    const data = shots.map((s, i) => ({ i: i + 1, r: rad(s.x, s.y), fps: s.fps }));
    const x = d3.scaleLinear().domain([1, shots.length]).range([0, w]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.r) * 1.2]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(shots.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.r)).curve(d3.curveMonotoneX));
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.i)).attr("cy", d => y(d.r)).attr("r", 4)
      .attr("fill", color).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .4)
      .attr("cursor", "crosshair")
      .on("mouseenter", function(ev, d) {
        d3.select(this).attr("r", 6);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [`Shot\u00a0#${d.i}`, `Radial\u00a0${d.r.toFixed(3)}\u00a0in`, `FPS\u00a0${d.fps}`] });
      })
      .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
      .on("mouseleave", function() { d3.select(this).attr("r", 4); setTip(null); });
    svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Shot # → Radial (in)");
  }, [shots, width]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={width} height={125} style={{ background: CHART_BG, borderRadius: 10 }} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function FpsTrack({ shots, width = 360, color = G }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
    const data = shots.map((s, i) => ({ i: i + 1, v: s.fps, r: rad(s.x, s.y) }));
    const x = d3.scaleLinear().domain([1, shots.length]).range([0, w]);
    const y = d3.scaleLinear().domain([d3.min(data, d => d.v) - 10, d3.max(data, d => d.v) + 10]).range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(shots.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    const mv = mean(data.map(d => d.v));
    gg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(mv)).attr("y2", y(mv))
      .attr("stroke", color).attr("stroke-width", 1).attr("stroke-dasharray", "4,3").attr("stroke-opacity", .45);
    gg.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX));
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.i)).attr("cy", d => y(d.v)).attr("r", 4)
      .attr("fill", color).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .4)
      .attr("cursor", "crosshair")
      .on("mouseenter", function(ev, d) {
        d3.select(this).attr("r", 6);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [`Shot\u00a0#${d.i}`, `FPS\u00a0${d.v}`, `Radial\u00a0${d.r.toFixed(3)}\u00a0in`] });
      })
      .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
      .on("mouseleave", function() { d3.select(this).attr("r", 4); setTip(null); });
    svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Shot # → FPS");
  }, [shots, width]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={width} height={125} style={{ background: CHART_BG, borderRadius: 10 }} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function XYTrack({ shots, width = 360 }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
    const x = d3.scaleLinear().domain([1, shots.length]).range([0, w]);
    const allV = [...shots.map(s => s.x), ...shots.map(s => s.y)];
    const y = d3.scaleLinear().domain([d3.min(allV) - 1, d3.max(allV) + 1]).range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(shots.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "rgba(255,255,255,0.1)").attr("stroke-dasharray", "3,3");
    const dX = shots.map((s, i) => ({ i: i + 1, v: s.x })), dY = shots.map((s, i) => ({ i: i + 1, v: s.y }));
    gg.append("path").datum(dX).attr("fill", "none").attr("stroke", G).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX));
    gg.append("path").datum(dY).attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX));
    gg.append("text").attr("x", w - 2).attr("y", y(dX[dX.length - 1]?.v || 0) - 8).text("X").attr("fill", G).attr("font-size", 10).attr("font-weight", "600").attr("text-anchor", "end");
    gg.append("text").attr("x", w - 2).attr("y", y(dY[dY.length - 1]?.v || 0) - 8).text("Y").attr("fill", "#3b82f6").attr("font-size", 10).attr("font-weight", "600").attr("text-anchor", "end");
    svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Shot # → X/Y (in)");
  }, [shots, width]);
  return <svg ref={ref} width={width} height={125} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function ShotTable({ shots }) {
  const hdrs = ["#","Serial","FPS","X","Y","Wt","Rad","Time"];
  const right = ["FPS","X","Y","Wt","Rad"];
  return (
    <div className="overflow-auto max-h-52">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {hdrs.map(h => (
              <th key={h} className={cn(
                "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                right.includes(h) ? "text-right" : "text-left"
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={i} className="border-b border-border transition-colors duration-150 hover:bg-accent/40">
              <td className="text-muted-foreground px-2.5 py-1.5">{s.shotNum}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[11px]">{s.serial}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.fps}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.x}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.y}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 text-right font-mono">{s.weight || "—"}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 text-right font-mono">{rad(s.x, s.y).toFixed(1)}</td>
              <td className="text-muted-foreground px-2.5 py-1.5">{s.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AutoSizeChart — fills its container and passes px dims to render fn ──────
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

// ─── SortableWidget — drag-to-reorder handle + corner resize ─────────────────
function SortableWidget({ id, children, size, onResize, fullWidth }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const nodeRef = useRef(null);
  const startRef = useRef(null);
  const setRefs = useCallback((n) => { setNodeRef(n); nodeRef.current = n; }, [setNodeRef]);

  const onResizeDown = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;
    startRef.current = { w: rect.width, h: rect.height, mx: e.clientX, my: e.clientY };
    const onMove = (e) => {
      const { w, h, mx, my } = startRef.current;
      onResize({ w: Math.max(280, w + e.clientX - mx), h: Math.max(200, h + e.clientY - my) });
    };
    const onUp = () => { startRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onResize]);

  return (
    <div
      ref={setRefs}
      style={{
        transform: dndCSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        ...(size ? { width: size.w, height: size.h } : {}),
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      className={cn("relative flex flex-col", !size && (fullWidth ? "w-full" : "w-full lg:w-1/2"))}
    >
      {children}
      {/* Resize handle */}
      <div onMouseDown={onResizeDown}
        className="absolute bottom-2 right-2 z-10 cursor-se-resize text-muted-foreground/25 hover:text-muted-foreground/70 transition-colors select-none hidden sm:block"
        title="Drag to resize">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M10 1L1 10M7.5 1L1 7.5M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Widget registry ──────────────────────────────────────────────────────────
const WIDGETS = {
  dispersion: { label: "Shot Dispersion", default: true, requires: ["x", "y"], render: (s, vs, st, opts, toggle, setOpt) => (
    <>
      <div className="flex gap-1.5 mb-2.5 flex-wrap items-center">
        {[["showEllipse","Ellipse",OC.ellipse],["showGrid","Grid"]].map(([k,l,c]) => (
          <Toggle key={k} label={l} on={opts[k]} onToggle={() => toggle(k)} color={c} />
        ))}
        <ColorPicker color={opts.color || G} onChange={c => setOpt("color", c)} />
      </div>
      <AutoSizeChart render={(w, h) => <DispersionChart shots={vs} stats={st} size={Math.min(w, h) - 12} opts={opts} color={opts.color || G} />} />
    </>
  )},
  velHist:    { label: "Velocity Distribution", default: true, requires: ["fps"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <VelHist shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  velRad:     { label: "FPS vs Radial", default: true, requires: ["fps", "x", "y"], render: (s, vs) => (
    <AutoSizeChart render={(w) => <VelRad shots={vs} width={w - 8} />} />
  )},
  metrics:    { label: "Key Metrics", default: true, requires: [], render: (s, vs, st, opts, toggle) => {
    const sb = (k, v, g, ac, onClick, active) => <SB key={k} label={k} value={v} gold={g} accentColor={ac} onClick={onClick} active={active} />;
    return (
      <>
      {st.hasXY && <p className="text-[11px] text-muted-foreground/60 mb-2 mt-0">Click CEP, R90, or MPI to toggle overlays on the chart.</p>}
      <div className="grid grid-cols-2 gap-2">
        {st.hasXY && <>
          {sb("CEP", st.cep.toFixed(2)+" in", 0, OC.cep, toggle ? () => toggle("showCep") : undefined, opts.showCep)}
          {sb("R90", st.r90.toFixed(2)+" in", 0, OC.r90, toggle ? () => toggle("showR90") : undefined, opts.showR90)}
          {sb("SD X", st.sdX.toFixed(2))}
          {sb("SD Y", st.sdY.toFixed(2))}
          {sb("MPI X/Y", st.mpiX.toFixed(1)+"/"+st.mpiY.toFixed(1), 0, OC.mpi, toggle ? () => toggle("showMpi") : undefined, opts.showMpi)}
          {sb("Mean Rad", st.mr.toFixed(2))}
          {sb("Ext Spread", st.es.toFixed(2))}
        </>}
        {st.hasFps && <>
          {sb("Mean FPS", st.meanV.toFixed(1), 0, opts.color || G)}
          {sb("SD FPS", st.sdV.toFixed(1))}
          {sb("ES FPS", st.esV.toFixed(1))}
        </>}
        {st.fieldStats && Object.entries(st.fieldStats).flatMap(([key, fs]) => {
          if (fs.type === "number") return [
            fs.mean !== null ? sb(`Mean ${fs.label}`, `${fs.mean.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
            fs.sd !== null ? sb(`SD ${fs.label}`, `${fs.sd.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
            fs.es !== null ? sb(`ES ${fs.label}`, `${fs.es.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
          ].filter(Boolean);
          if (fs.type === "yesno") return [sb(fs.label, `${fs.yes}/${fs.total} (${fs.pct}%)`)];
          if (fs.type === "dropdown") return Object.entries(fs.counts).map(([opt, cnt]) =>
            sb(`${fs.label}: ${opt}`, `${cnt}/${fs.total}`)
          );
          return [];
        })}
      </div>
      </>
    );
  }},
  radTrack:   { label: "Radial Tracking", default: false, requires: ["x", "y"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <RadialTrack shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  fpsTrack:   { label: "FPS Tracking", default: false, requires: ["fps"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <FpsTrack shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  xyTrack:    { label: "X/Y Deviation", default: false, requires: ["x", "y"], render: (s, vs) => (
    <AutoSizeChart render={(w) => <XYTrack shots={vs} width={w - 8} />} />
  )},
  shotTable:   { label: "Shot Table", default: false, requires: [], render: (s, vs) => <ShotTable shots={vs} session={s} /> },
  attachments: { label: "Attachments", default: false, requires: [], render: (s, _vs, _st, _opts, _toggle, _setOpt, onError) => (
    <AttachmentWidget session={s} onError={onError} />
  )},
  velRanking: { label: "Best Velocity", default: false, requires: ["fps"], render: (s, _vs, st) => (
    <VelRankingWidget sessions={[{ name: s.config.sessionName || 'This Session', color: '#FFDF00', stats: st }]} />
  )},
  accuracyRanking: { label: "Best Accuracy", default: false, requires: ["x", "y"], render: (s, _vs, st) => (
    <AccuracyRankingWidget sessions={[{ name: s.config.sessionName || 'This Session', color: '#FFDF00', stats: st }]} />
  )},
};
const DEF_LAYOUT = Object.keys(WIDGETS).filter(k => WIDGETS[k].default);
const DEF_DISP = { showCep: false, showR90: false, showEllipse: false, showMpi: false, showGrid: true };
const DEF_CMP_METRICS = ALL_METRICS.filter(m => m[3]).map(m => m[0]);
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5, LIBRARY: 6 };

// ─── Shared layout helpers ────────────────────────────────────────────────────
function SecLabel({ children, className = "" }) {
  return <div className={cn("text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70", className)}>{children}</div>;
}
function CardSection({ title, children, style = {}, className = "" }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)} style={style}>
      {title && (
        <div className="mb-5 pb-3.5 border-b border-border flex items-center gap-2">
          <span className="w-1 h-3.5 shrink-0" style={{ background: G }} />
          <SecLabel>{title}</SecLabel>
        </div>
      )}
      {children}
    </div>
  );
}
function Empty({ children, icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      {icon && (
        <div className="size-9 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground/50">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed m-0">{children}</p>
      {action && action}
    </div>
  );
}

// ─── Stable layout components (defined at module scope to avoid remount on re-render) ──
function PageHead({ title, sub }) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="w-[3px] self-stretch shrink-0" style={{ background: G, minHeight: 36 }} />
      <div>
        <h1 className="text-[30px] font-bold tracking-tight text-foreground mb-1 leading-tight">{title}</h1>
        {sub && <p className="text-[13px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function TblInput({ value, onChange }) {
  return (
    <input type="number" value={value ?? ""} onChange={onChange}
      className="w-full rounded bg-secondary border border-border px-1.5 py-0.5 text-right text-xs text-foreground font-mono" />
  );
}

// ─── Measurement Fields Card ────────────────────────────────────────────────
function MeasurementFieldsCard({ fields, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState({ name: "", type: "number", required: false, unit: "", options: [] });
  const [newOption, setNewOption] = useState("");

  const typeLabels = { number: "Number", yesno: "Yes / No", text: "Text", dropdown: "Dropdown" };

  const addField = () => {
    const name = newField.name.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (fields.find(f => f.key === key)) return;
    const field = {
      key,
      label: name,
      type: newField.type,
      required: newField.required,
      options: newField.type === "dropdown" ? newField.options : [],
      unit: newField.type === "number" ? newField.unit.trim() : "",
    };
    onUpdate([...fields, field]);
    setNewField({ name: "", type: "number", required: false, unit: "", options: [] });
    setNewOption("");
    setAdding(false);
  };

  const removeField = (key) => {
    onUpdate(fields.filter(f => f.key !== key));
  };

  const addDropdownOption = () => {
    const opt = newOption.trim();
    if (!opt || newField.options.includes(opt)) return;
    setNewField(p => ({ ...p, options: [...p.options, opt] }));
    setNewOption("");
  };

  const removeDropdownOption = (opt) => {
    setNewField(p => ({ ...p, options: p.options.filter(o => o !== opt) }));
  };

  return (
    <CardSection title="Measurement Fields" className="mb-4">
      <p className="text-xs text-muted-foreground mb-3">
        Define what data gets recorded per shot. These fields appear on the Fire page.
      </p>

      {/* Field list */}
      {fields.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-foreground flex-1">{f.label}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
                {typeLabels[f.type] || f.type}
              </span>
              {f.unit && (
                <span className="text-[10px] text-muted-foreground">{f.unit}</span>
              )}
              {f.required && (
                <span className="text-[10px] font-bold text-primary">REQ</span>
              )}
              <button
                onClick={() => removeField(f.key)}
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer bg-transparent border-none leading-none text-base ml-1"
                aria-label={`Remove ${f.label}`}>×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/60 italic mb-4 py-3 text-center border border-dashed border-border rounded-lg">
          No measurement fields configured. Add at least one field before starting a session.
        </div>
      )}

      {/* Add field form */}
      {adding ? (
        <div className="bg-background border border-border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Field Name</label>
              <input
                value={newField.name}
                onChange={e => setNewField(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addField(); if (e.key === "Escape") { setAdding(false); setNewField({ name: "", type: "number", required: false, unit: "", options: [] }); } }}
                placeholder="e.g. Hole Size"
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                autoFocus />
            </div>
            <div className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
              <select
                value={newField.type}
                onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary">
                <option value="number">Number</option>
                <option value="yesno">Yes / No</option>
                <option value="text">Text</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
          </div>

          {/* Number-specific: unit */}
          {newField.type === "number" && (
            <div className="flex flex-col mb-3">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit (optional)</label>
              <input
                value={newField.unit}
                onChange={e => setNewField(p => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. mm, in, fps"
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary max-w-[200px]" />
            </div>
          )}

          {/* Dropdown-specific: options */}
          {newField.type === "dropdown" && (
            <div className="flex flex-col mb-3">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Options</label>
              {newField.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newField.options.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1 bg-secondary border border-border rounded px-2 py-0.5 text-xs">
                      {opt}
                      <button onClick={() => removeDropdownOption(opt)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-none text-xs leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }}
                  placeholder="Add an option…"
                  className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary max-w-[220px]" />
                <button onClick={addDropdownOption}
                  disabled={!newOption.trim()}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border-none",
                    newOption.trim() ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
                  )}>Add</button>
              </div>
            </div>
          )}

          {/* Required checkbox */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))}
              className="rounded border-border" />
            <span className="text-xs text-muted-foreground">Required field</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={addField}
              disabled={!newField.name.trim() || (newField.type === "dropdown" && newField.options.length === 0)}
              className={cn("px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-none",
                newField.name.trim() && !(newField.type === "dropdown" && newField.options.length === 0)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
              )}>Add Field</button>
            <button onClick={() => { setAdding(false); setNewField({ name: "", type: "number", required: false, unit: "", options: [] }); setNewOption(""); }}
              className="text-muted-foreground text-sm cursor-pointer bg-transparent border-none">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-xs font-bold cursor-pointer bg-transparent border-none p-0 transition-colors uppercase tracking-wider"
          style={{ color: "#6b6b7e" }}
          onMouseEnter={e => e.target.style.color = "#111118"}
          onMouseLeave={e => e.target.style.color = "#6b6b7e"}>
          + Add Field
        </button>
      )}
    </CardSection>
  );
}

function AppNavBar({ phase, navItems, sessionCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: "#111118", borderBottom: "1px solid #222230" }}>
      <nav className="mx-auto flex h-[52px] w-full max-w-6xl items-stretch justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <div className="flex items-center gap-3 shrink-0 pr-4 sm:pr-6" style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "#FFDF00" }} className="shrink-0">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[11px] font-black tracking-[0.22em] uppercase px-1.5 py-0.5" style={{ background: "#FFDF00", color: "#000" }}>AXON</span>
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase hidden sm:inline" style={{ color: "rgba(255,255,255,0.55)" }}>BALLISTIC</span>
          </div>
        </div>
        {/* Nav items — desktop */}
        <div className="hidden md:flex items-stretch flex-1 pl-2">
          {navItems.map(item => {
            const isActive = phase === item.ph;
            return (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={item.disabled ? undefined : item.onClick}
                className={cn(
                  "relative px-3.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                  "bg-transparent border-0 outline-none",
                  item.disabled && "opacity-20 cursor-not-allowed pointer-events-none"
                )}
                style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.38)" }}>
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px]" style={{ background: "#FFDF00" }} />
                )}
              </button>
            );
          })}
        </div>
        {/* Session count — desktop */}
        <div className="hidden md:flex items-center shrink-0 pl-5" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
            {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
          </span>
        </div>
        {/* Hamburger — mobile */}
        <button
          className="md:hidden flex items-center ml-auto bg-transparent border-none cursor-pointer p-2"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {menuOpen
              ? <path d="M5 5L15 15M15 5L5 15" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              : <path d="M3 5h14M3 10h14M3 15h14" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>}
          </svg>
        </button>
      </nav>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5" style={{ background: "#111118" }}>
          <div className="flex flex-col px-4 py-2">
            {navItems.map(item => {
              const isActive = phase === item.ph;
              return (
                <button
                  key={item.label}
                  disabled={item.disabled}
                  onClick={() => { if (!item.disabled) { item.onClick(); setMenuOpen(false); } }}
                  className={cn(
                    "text-left px-2 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                    "bg-transparent border-0 outline-none rounded",
                    item.disabled && "opacity-20 cursor-not-allowed pointer-events-none"
                  )}
                  style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.38)" }}>
                  {item.label}
                  {isActive && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full ml-2 align-middle" style={{ background: "#FFDF00" }} />
                  )}
                </button>
              );
            })}
            <div className="border-t border-white/5 mt-1 pt-2 pb-1 px-2">
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
                {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function AppShell({ phase, navItems, sessionCount, maxW = "1060px", children, dbError, onDismissError }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNavBar phase={phase} navItems={navItems} sessionCount={sessionCount} />
      <main className="px-4 pt-5 pb-10 sm:px-7 sm:pt-10 sm:pb-15" style={{ maxWidth: maxW, margin: "0 auto" }}>
        {children}
      </main>
      {dbError && (
        <div className="fixed bottom-4 right-4 z-[400] bg-destructive text-white text-sm px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <span>{dbError}</span>
          <button onClick={onDismissError} className="font-bold opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none text-white">✕</button>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]   = useState(P.SETUP);
  const [log, setLog]       = useState([]);
  const [opts, setOpts]     = useState(DEF_OPTS);
  const [vars, setVars]     = useState(DEF_VARS);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [viewId, setViewId] = useState(null);
  const [editSessionId, setEditSessionId] = useState(null);
  const fileRef = useRef(); const fpsRef = useRef(); const exportRef = useRef(null);
  const [newVarName, setNewVarName] = useState("");
  const [adding, setAdding] = useState(false);
  const [cfg, setCfg] = useState({ rifleRate: "", sleeveType: "", tailType: "", combustionChamber: "", load22: "", shotCount: "10", notes: "", sessionName: "", date: new Date().toISOString().split("T")[0] });
  const up = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const [shots, setShots]   = useState([]);
  const [cur, setCur]       = useState(() => Object.fromEntries(fields.map(f => [f.key, ""])));
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [esCfg, setEsCfg]   = useState({});
  const [esShots, setEsShots] = useState([]);
  const [esNewShot, setEsNewShot] = useState({ fps: "", x: "", y: "", weight: "" });
  const [esShotEdit, setEsShotEdit]   = useState(null);
  const [esShotEditVal, setEsShotEditVal] = useState({});
  const [layout, setLayout] = useState(DEF_LAYOUT);
  const [dispOpts, setDispOpts] = useState(DEF_DISP);
  const [cmpSlots, setCmpSlots] = useState([{ id: null, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]);
  const [cmpDispOpts, setCmpDispOpts] = useState(DEF_DISP);
  const [cmpMetricsOpen, setCmpMetricsOpen] = useState(false);
  const [cmpPickerOpen, setCmpPickerOpen] = useState(true);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [cmpMetrics, setCmpMetrics] = useState(DEF_CMP_METRICS);
  const [cmpLayout, setCmpLayout] = useState(DEFAULT_CMP_LAYOUT);
  const [cmpSplit, setCmpSplit] = useState(DEFAULT_CMP_SPLIT);
  const [cmpTitle, setCmpTitle] = useState("");
  const [cmpBy, setCmpBy] = useState("");
  const [cmpFilters, setCmpFilters] = useState({});
  const [cmpHoverTip, setCmpHoverTip] = useState(null);
  const [histFilters, setHistFilters] = useState({});
  const [histSearch, setHistSearch] = useState("");
  const [histSort, setHistSort] = useState("newest");
  const [widgetSizes, setWidgetSizes] = useState({});
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [libraryFilterSessionIds, setLibraryFilterSessionIds] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState({}); // { serial: File[] }
  const queueAttachment = useCallback((serial, files) => {
    setPendingAttachments(p => ({ ...p, [serial]: [...(p[serial] || []), ...files] }));
  }, []);
  const [hasAttachments, setHasAttachments] = useState(false);

  // Auto-deselect sessions that no longer match active filters
  useEffect(() => {
    setCmpSlots(p => p.filter(sl => {
      const s = log.find(x => x.id === sl.id);
      if (!s) return false;
      return Object.entries(cmpFilters).every(([k, v]) => !v || s.config[k] === v);
    }));
  }, [cmpFilters]);

  const existingCount = useMemo(() => log.reduce((c, s) => s.config.rifleRate === cfg.rifleRate ? c + s.shots.length : c, 0), [log, cfg.rifleRate]);
  const loadAllData = async () => {
    try {
      const [settings, sessions, comparisons, allAtts] = await Promise.all([
        db.getSettings(),
        db.getSessions(),
        db.getComparisons(),
        db.getAttachments(),
      ]);
      if (settings.opts && Object.keys(settings.opts).length) {
        setOpts(p => {
          const merged = { ...p };
          Object.entries(settings.opts).forEach(([k, v]) => {
            if (Array.isArray(v) && v.length) merged[k] = v;
          });
          return merged;
        });
      }
      if (settings.vars?.length) setVars(settings.vars);
      if (settings.fields?.length) setFields(settings.fields);
      if (settings.layout) {
        if (settings.layout.layout)     setLayout(settings.layout.layout);
        if (settings.layout.dispOpts)   setDispOpts(settings.layout.dispOpts);
        if (settings.layout.cmpMetrics) setCmpMetrics(settings.layout.cmpMetrics);
        if (settings.layout.cmpLayout) {
          const raw = settings.layout.cmpLayout;
          if (Array.isArray(raw) && raw.length > 0) {
            if (typeof raw[0] === 'string') {
              setCmpLayout(migrateLayout(raw.map(k => ({ i: k, zone: DEFAULT_ZONE[k] ?? 'full' }))));
            } else if (raw[0].x !== undefined) {
              setCmpLayout(migrateLayout(raw.map(item => ({ i: item.i, zone: DEFAULT_ZONE[item.i] ?? 'full' }))));
            } else {
              setCmpLayout(migrateLayout(raw));
            }
          }
        } else if (settings.layout.cmpWidgets) {
          setCmpLayout(migrateLayout(settings.layout.cmpWidgets.map(k => ({ i: k, zone: DEFAULT_ZONE[k] ?? 'full' }))));
        }
        if (settings.layout.cmpSplit) setCmpSplit(settings.layout.cmpSplit);
      }
      setLog(sessions.map(s => ({
        ...s,
        config: { ...s.config, fields: s.config.fields || DEFAULT_FIELDS },
        stats: calcStats(s.shots, s.config.fields),
      })));
      setSavedComparisons(comparisons);
      setHasAttachments(allAtts.length > 0);
    } catch (err) {
      setDbError('Failed to load data: ' + err.message);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const session = await db.getSession();
        if (session) {
          setAuthed(true);
          await loadAllData();
        }
      } catch (err) {
        setDbError('Connection error: ' + err.message);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => { if (phase === P.CMP) { setCmpDispOpts(DEF_DISP); setCmpTitle(""); } }, [phase]);

  const saveLayoutAll = useCallback(async upd => {
    const c = { layout, dispOpts, cmpMetrics, cmpLayout, cmpSplit, ...upd };
    try { await db.saveSettings({ layout: c }); } catch (err) { setDbError('Settings save failed: ' + err.message); }
  }, [layout, dispOpts, cmpMetrics, cmpLayout, cmpSplit]);

  const saveComparison = useCallback(async (title, slots, filters, by, metrics, widgets) => {
    try {
      const saved = await db.saveComparison({ title, slots, filters, by, metrics, widgets });
      setSavedComparisons(p => [saved, ...p]);
    } catch (err) {
      setDbError('Failed to save comparison: ' + err.message);
    }
  }, []);

  const deleteComparison = useCallback(async (id) => {
    try {
      await db.deleteComparison(id);
      setSavedComparisons(p => p.filter(c => c.id !== id));
    } catch (err) {
      setDbError('Failed to delete comparison: ' + err.message);
    }
  }, []);

  const loadComparison = useCallback((c) => {
    setCmpTitle(c.title || "");
    setCmpSlots(c.slots.filter(sl => !sl.id || log.some(s => s.id === sl.id)));
    setCmpFilters(c.filters || {});
    setCmpBy(c.by || "");
    setCmpMetrics(c.metrics || DEF_CMP_METRICS);
    const raw = c.layout ?? c.widgets;
    if (Array.isArray(raw) && raw.length > 0) {
      if (typeof raw[0] === 'string') {
        setCmpLayout(migrateLayout(raw.map(k => ({ i: k, zone: DEFAULT_ZONE[k] ?? 'full' }))));
      } else if (raw[0].x !== undefined) {
        setCmpLayout(migrateLayout(raw.map(item => ({ i: item.i, zone: DEFAULT_ZONE[item.i] ?? 'full' }))));
      } else if (raw[0].zone !== undefined) {
        setCmpLayout(migrateLayout(raw));
      } else {
        setCmpLayout(DEFAULT_CMP_LAYOUT);
      }
    } else {
      setCmpLayout(DEFAULT_CMP_LAYOUT);
    }
  }, [log]);
  const toggleWidget = k => { setLayout(p => { const n = p.includes(k) ? p.filter(x => x !== k) : [...p, k]; saveLayoutAll({ layout: n }); return n; }); };
  const toggleDisp = k => { setDispOpts(p => { const n = { ...p, [k]: !p[k] }; saveLayoutAll({ dispOpts: n }); return n; }); };
  const setDispOpt = (k, v) => { setDispOpts(p => { const n = { ...p, [k]: v }; saveLayoutAll({ dispOpts: n }); return n; }); };
  const toggleCmpMetric = label => { setCmpMetrics(p => { const n = p.includes(label) ? p.filter(x => x !== label) : [...p, label]; saveLayoutAll({ cmpMetrics: n }); return n; }); };
  const addWidget = useCallback(k => {
    setCmpLayout(prev => {
      const next = [...prev, { i: k, zone: DEFAULT_ZONE[k] ?? 'full' }];
      saveLayoutAll({ cmpLayout: next });
      return next;
    });
  }, [saveLayoutAll]);

  const removeWidget = useCallback(k => {
    setCmpLayout(prev => {
      const next = prev.filter(item => item.i !== k);
      saveLayoutAll({ cmpLayout: next });
      return next;
    });
  }, [saveLayoutAll]);

  const cycleZone = useCallback(k => {
    const order = ['main', 'sidebar', 'full'];
    setCmpLayout(prev => {
      const next = prev.map(item =>
        item.i === k
          ? { ...item, zone: order[(order.indexOf(item.zone) + 1) % order.length] }
          : item
      );
      saveLayoutAll({ cmpLayout: next });
      return next;
    });
  }, [saveLayoutAll]);


  const total = parseInt(cfg.shotCount) || 0;
  const validShots = useMemo(() => {
    const sessionFields = cfg.fields || fields;
    const requiredNumeric = sessionFields.filter(f => f.required && f.type === "number").map(f => f.key);
    if (requiredNumeric.length === 0) return shots;
    return shots.filter(s => {
      const d = s.data || s;
      return requiredNumeric.every(k => d[k] !== null && d[k] !== undefined && !isNaN(d[k]));
    });
  }, [shots, cfg.fields, fields]);
  const stats = useMemo(() => calcStats(shots, cfg.fields || fields), [shots, cfg.fields, fields]);
  const addOption = useCallback(async (key, val) => {
    setOpts(p => {
      const n = { ...p, [key]: [...(p[key] || []), val] };
      db.saveSettings({ opts: n }).catch(err => setDbError('Options save failed: ' + err.message));
      return n;
    });
  }, []);
  const addVar = async () => { if (!newVarName.trim()) return; const key = newVarName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"); if (vars.find(v => v.key === key)) return; const nv = [...vars, { key, label: newVarName.trim(), core: false }]; setVars(nv); await db.saveSettings({ vars: nv }); setOpts(p => { const n = { ...p, [key]: [] }; db.saveSettings({ opts: n }).catch(err => setDbError('Options save failed: ' + err.message)); return n; }); setNewVarName(""); setAdding(false); };
  const removeVar = async key => { setVars(p => { const n = p.filter(v => v.key !== key); db.saveSettings({ vars: n }).catch(err => setDbError('Var save failed: ' + err.message)); return n; }); };
  const updateFields = useCallback(async (newFields) => {
    setFields(newFields);
    try { await db.saveSettings({ fields: newFields }); } catch (err) { setDbError('Fields save failed: ' + err.message); }
  }, []);
  const addShot = useCallback(() => {
    // Validate required fields
    const sessionFields = cfg.fields || fields;
    for (const f of sessionFields) {
      if (f.required) {
        if (f.type === "number" && isNaN(parseFloat(cur[f.key]))) return;
        if (f.type !== "number" && !cur[f.key] && cur[f.key] !== false) return;
      }
    }
    // Build data object
    const data = {};
    for (const f of sessionFields) {
      const v = cur[f.key];
      if (f.type === "number") {
        data[f.key] = v !== "" ? parseFloat(v) : null;
      } else if (f.type === "yesno") {
        data[f.key] = v === "yes" ? true : v === "no" ? false : null;
      } else {
        data[f.key] = v || null;
      }
    }
    // Build shot with legacy fields for backwards compat
    const shot = {
      fps: data.fps ?? null,
      x: data.x ?? null,
      y: data.y ?? null,
      weight: data.weight ?? cur.weight ?? null,
      data,
      serial: makeSerial(cfg, shots.length + 1, existingCount),
      shotNum: shots.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setShots(p => [...p, shot]);
    // Clear fields — keep number field values for repeat entry
    setCur(prev => {
      const next = {};
      for (const f of sessionFields) {
        next[f.key] = f.type === "number" ? prev[f.key] : "";
      }
      return next;
    });
    setTimeout(() => fpsRef.current?.focus(), 50);
  }, [cur, shots, cfg, existingCount, fields]);
  const handleKey = useCallback(e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addShot(); } }, [addShot]);
  const startEdit = i => { setEditIdx(i); setEditVal({ ...shots[i] }); };
  const saveEdit = () => { if (editIdx === null) return; const fps = parseFloat(editVal.fps), x = parseFloat(editVal.x), y = parseFloat(editVal.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setShots(p => p.map((s, i) => i === editIdx ? { ...s, ...editVal, fps, x, y } : s)); setEditIdx(null); };
  const delShot = i => setShots(p => p.filter((_, j) => j !== i).map((s, j) => ({ ...s, shotNum: j + 1 })));
  const finishSession = async () => {
    const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | ");
    try {
      const saved = await db.saveSession({ config: { ...cfg, sessionName: name, fields }, shots: [...shots] });
      // Upload any queued attachments, matching by serial number
      const pending = Object.entries(pendingAttachments);
      if (pending.length > 0) {
        await Promise.allSettled(
          pending.flatMap(([serial, files]) => {
            const shot = saved.shots.find(sh => sh.serial === serial);
            return files.map(file => db.uploadAttachment(file, shot?.id ?? null, saved.id));
          })
        );
      }
      const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields || fields) };
      setLog(p => [entry, ...p]);
      setViewId(saved.id);
      setPendingAttachments({});
      setPhase(P.RESULTS);
    } catch (err) {
      setDbError('Failed to save session: ' + err.message);
    }
  };
  const newSession = () => { setPhase(P.SETUP); setShots([]); setCur(Object.fromEntries(fields.map(f => [f.key, ""]))); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
  const delSession = async id => {
    try {
      await db.deleteSession(id);
      setLog(p => p.filter(s => s.id !== id));
    } catch (err) {
      setDbError('Failed to delete session: ' + err.message);
    }
  };
  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.length) { setDbError('No sessions found in file.'); return; }
      const saved = await Promise.all(data.map(s => db.saveSession({ config: s.config, shots: s.shots || [] })));
      const entries = saved.map(s => ({ ...s, stats: calcStats(s.shots, s.config.fields) }));
      setLog(p => [...entries, ...p]);
    } catch (err) {
      setDbError('Import failed: ' + err.message);
    }
    e.target.value = "";
  };
  const openEditSession = id => { const s = log.find(x => x.id === id); if (!s) return; setEditSessionId(id); setEsCfg({ ...s.config }); setEsShots(s.shots.map(sh => ({ ...sh }))); const sf = s.config.fields || fields; setEsNewShot(Object.fromEntries(sf.map(f => [f.key, ""]))); setEsShotEdit(null); setPhase(P.EDIT); };
  const saveEditSession = async () => {
    const name = esCfg.sessionName || vars.map(v => esCfg[v.key]).filter(Boolean).join(" | ");
    try {
      const saved = await db.updateSession(editSessionId, { config: { ...esCfg, sessionName: name }, shots: [...esShots] });
      const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields || fields) };
      setLog(p => p.map(s => s.id === editSessionId ? entry : s));
      setViewId(editSessionId);
      setPhase(P.RESULTS);
    } catch (err) {
      setDbError('Failed to update session: ' + err.message);
    }
  };
  const esAddShot = () => {
    const sf = esCfg.fields || fields;
    for (const f of sf) {
      if (f.required) {
        if (f.type === "number" && isNaN(parseFloat(esNewShot[f.key]))) return;
        if (f.type !== "number" && !esNewShot[f.key] && esNewShot[f.key] !== false) return;
      }
    }
    const data = {};
    for (const f of sf) {
      const v = esNewShot[f.key];
      if (f.type === "number") data[f.key] = v !== "" ? parseFloat(v) : null;
      else if (f.type === "yesno") data[f.key] = v === "yes" ? true : v === "no" ? false : null;
      else data[f.key] = v || null;
    }
    setEsShots(p => [...p, {
      fps: data.fps ?? null, x: data.x ?? null, y: data.y ?? null, weight: data.weight ?? null,
      data,
      serial: makeSerial(esCfg, p.length + 1, 0),
      shotNum: p.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    setEsNewShot(prev => {
      const next = {};
      for (const f of sf) { next[f.key] = f.type === "number" ? prev[f.key] : ""; }
      return next;
    });
  };
  const esDelShot = i => setEsShots(p => p.filter((_, j) => j !== i).map((s, j) => ({ ...s, shotNum: j + 1 })));
  const esStartEdit = i => { setEsShotEdit(i); setEsShotEditVal({ ...esShots[i] }); };
  const esSaveEdit = () => { if (esShotEdit === null) return; const fps = parseFloat(esShotEditVal.fps), x = parseFloat(esShotEditVal.x), y = parseFloat(esShotEditVal.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setEsShots(p => p.map((s, i) => i === esShotEdit ? { ...s, ...esShotEditVal, fps, x, y } : s)); setEsShotEdit(null); };
  const continueSession = async id => {
    const s = log.find(x => x.id === id);
    if (!s) return;
    setCfg({ ...s.config });
    setShots(s.shots.map(sh => ({ ...sh })));
    const sessionFields = s.config.fields || fields;
    setCur(Object.fromEntries(sessionFields.map(f => [f.key, ""])));
    try {
      await db.deleteSession(id);
      setLog(p => p.filter(x => x.id !== id));
    } catch (err) {
      setDbError('Failed to continue session: ' + err.message);
    }
    setPhase(P.FIRE);
    setTimeout(() => fpsRef.current?.focus(), 100);
  };
  const viewed = log.find(s => s.id === viewId);
  const esStats = useMemo(() => calcStats(esShots, esCfg.fields || fields), [esShots, esCfg.fields, fields]);

  // ─── Nav items (constructed here so callbacks close over current state) ────
  const navItems = [
    { label: "Setup",   ph: P.SETUP,   onClick: newSession },
    { label: "Fire",    ph: P.FIRE,    disabled: phase !== P.FIRE },
    { label: "Results", ph: P.RESULTS, disabled: !viewId,        onClick: () => setPhase(P.RESULTS) },
    { label: "History", ph: P.HISTORY, onClick: () => setPhase(P.HISTORY) },
    { label: "Compare", ph: P.CMP,     disabled: log.length < 2, onClick: () => { setCmpSlots([]); setPhase(P.CMP); } },
    { label: "Library", ph: P.LIBRARY, onClick: () => { setLibraryFilterSessionIds(null); setPhase(P.LIBRARY); } },
  ];


  if (!authChecked) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <span className="text-foreground/50 text-sm">Loading…</span>
    </div>
  );

  if (!authed) return (
    <LoginScreen onLogin={() => { setAuthed(true); loadAllData(); }} />
  );

  // ─── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === P.SETUP) return (
    <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="720px">
      <PageHead title="New Session" sub="Configure variables, then fire and analyze" />

      <CardSection title="Configuration" className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vars.map(vr => (
            <SmartSelect key={vr.key} label={vr.label} value={cfg[vr.key] || ""} onChange={v => up(vr.key, v)} options={opts[vr.key] || []} onAddOption={v => addOption(vr.key, v)} />
          ))}
          <div className="flex flex-col">
            <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shot Count</label>
            <input type="number" min="1" value={cfg.shotCount} onChange={e => up("shotCount", e.target.value)} className={inp} />
          </div>
        </div>

        {/* ── Variable management ── */}
        <div className="mt-5 pt-4 border-t border-border">
          {vars.filter(v => !v.core).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {vars.filter(v => !v.core).map(v => (
                <div key={v.key} className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-lg pl-3 pr-2 py-1.5 text-xs">
                  <span className="text-foreground font-medium">{v.label}</span>
                  <button onClick={() => removeVar(v.key)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer bg-transparent border-none leading-none text-base"
                    aria-label={`Remove ${v.label}`}>×</button>
                </div>
              ))}
            </div>
          )}
          {adding
            ? <div className="flex gap-2 items-center">
                <input value={newVarName} onChange={e => setNewVarName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addVar(); if (e.key === "Escape") { setAdding(false); setNewVarName(""); } }}
                  placeholder="Variable name…" className={`${inp} max-w-[220px]`} autoFocus />
                <Btn onClick={addVar} disabled={!newVarName.trim()}>Add</Btn>
                <button onClick={() => { setAdding(false); setNewVarName(""); }}
                  className="text-muted-foreground text-sm cursor-pointer bg-transparent border-none">Cancel</button>
              </div>
            : <button onClick={() => setAdding(true)}
                className="text-xs font-bold cursor-pointer bg-transparent border-none p-0 transition-colors uppercase tracking-wider"
                style={{ color: TX2 }}
                onMouseEnter={e => e.target.style.color = TX}
                onMouseLeave={e => e.target.style.color = TX2}>
                + Add Variable
              </button>
          }
        </div>
      </CardSection>

      <MeasurementFieldsCard fields={fields} onUpdate={updateFields} />

      <CardSection title="Session Details" className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session Name</label>
            <input value={cfg.sessionName} onChange={e => up("sessionName", e.target.value)} placeholder="Auto-generated if blank" className={inp} />
          </div>
          <div className="flex flex-col">
            <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
            <input type="date" value={cfg.date} onChange={e => up("date", e.target.value)} className={inp} />
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
          <input value={cfg.notes} onChange={e => up("notes", e.target.value)} placeholder="Optional" className={inp} />
        </div>
      </CardSection>

      {cfg.rifleRate && (
        <p className="text-xs text-muted-foreground mb-6 px-0.5">
          Serial range: <span className="text-primary font-mono">{makeSerial(cfg, 1, existingCount)}</span>
          {" → "}
          <span className="text-primary font-mono">{makeSerial(cfg, total || 1, existingCount)}</span>
        </p>
      )}

      <Btn onClick={() => { setPhase(P.FIRE); setTimeout(() => fpsRef.current?.focus(), 100); }}
        disabled={!cfg.rifleRate || !cfg.sleeveType || !total || fields.length === 0} cls="w-full py-3 text-base">
        Begin Firing Session
      </Btn>

      <div className="mt-6 pt-5 border-t border-border flex gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <Btn v="secondary" onClick={() => fileRef.current?.click()}>Import JSON</Btn>
        {log.length > 0 && (<>
          <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
          <Btn v="secondary" onClick={() => exportJson(log)}>Export JSON</Btn>
        </>)}
      </div>
    </AppShell>
  );

  // ─── FIRE ───────────────────────────────────────────────────────────────────
  if (phase === P.FIRE) return (
    <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1040px">
      {/* Session header row */}
      <div className="flex items-start justify-between mb-7 gap-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground mb-1">
            {cfg.sessionName || [cfg.rifleRate, cfg.sleeveType].filter(Boolean).join(" · ")}
          </h1>
          <p className="text-xs text-muted-foreground m-0">
            {[cfg.tailType, cfg.combustionChamber, cfg.load22].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[26px] font-bold leading-none tracking-tight">
            <span className="text-primary">{shots.length}</span>
            <span className="text-lg font-normal text-muted-foreground"> / {total}</span>
          </div>
          <div className="text-muted-foreground text-[11px] mt-1.5 font-mono">
            Next: {makeSerial(cfg, shots.length + 1, existingCount)}
          </div>
        </div>
      </div>

      {/* Shot entry */}
      <div className="bg-card border border-primary/[0.13] rounded-xl p-6 mb-5" onKeyDown={handleKey}>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-sm font-semibold text-foreground">Shot #{shots.length + 1}</span>
          <span className="text-xs text-muted-foreground">— press Enter to record</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {(cfg.fields || fields).map((f, i) => (
            <div key={f.key} className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}
              </label>
              {f.type === "number" && (
                <input ref={i === 0 ? fpsRef : null} type="number" inputMode="decimal" step="any"
                  value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp} autoFocus={i === 0} />
              )}
              {f.type === "yesno" && (
                <select value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              )}
              {f.type === "text" && (
                <input ref={i === 0 ? fpsRef : null} type="text"
                  value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp} autoFocus={i === 0} />
              )}
              {f.type === "dropdown" && (
                <select value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp}>
                  <option value="">—</option>
                  {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={addShot} disabled={shots.length >= total || (cfg.fields || fields).some(f => f.required && (cur[f.key] === "" || cur[f.key] === undefined || cur[f.key] === null))}>Record</Btn>
          <Btn v="secondary" onClick={finishSession} disabled={shots.length < 2}>Finish Session</Btn>
          <Btn v="danger" onClick={() => { if (confirm("Abort this session?")) newSession(); }}>Abort</Btn>
        </div>
      </div>

      {/* Live charts & shot log */}
      {(() => {
        const sf = cfg.fields || fields;
        const hasX = sf.some(f => f.key === "x");
        const hasY = sf.some(f => f.key === "y");
        const hasXY = hasX && hasY;
        const hasFps = sf.some(f => f.key === "fps");
        return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {hasXY && (
        <CardSection title="Live Dispersion">
          {validShots.length
            ? <AutoSizeChart render={(w, h) => <DispersionChart shots={validShots} stats={stats} size={Math.min(w, h) - 12} />} />
            : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
        </CardSection>
        )}
        <CardSection title="Running Stats">
          {validShots.length >= 2
            ? <div className="grid grid-cols-2 gap-2">
                {hasXY && <>
                  <SB label="CEP" value={stats.cep.toFixed(2)} accentColor={OC.cep} />
                  <SB label="R90" value={stats.r90.toFixed(2)} accentColor={OC.r90} />
                  <SB label="SD X" value={stats.sdX.toFixed(2)} />
                  <SB label="SD Y" value={stats.sdY.toFixed(2)} />
                  <SB label="MPI" value={`${stats.mpiX.toFixed(1)}, ${stats.mpiY.toFixed(1)}`} accentColor={OC.mpi} />
                </>}
                {hasFps && <>
                  <SB label="Mean FPS" value={stats.meanV.toFixed(1)} gold={1} />
                  <SB label="SD FPS" value={stats.sdV.toFixed(1)} />
                  <SB label="ES FPS" value={stats.esV.toFixed(1)} />
                </>}
                {sf.filter(f => f.type === "number" && !["x", "y", "fps"].includes(f.key)).map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
                  if (vals.length < 2) return null;
                  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
                  return <SB key={f.key} label={`Mean ${f.label}`} value={`${m.toFixed(1)}${f.unit ? " " + f.unit : ""}`} />;
                })}
                {sf.filter(f => f.type === "yesno").map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
                  const yesCount = vals.filter(v => v === true).length;
                  return <SB key={f.key} label={f.label} value={`${yesCount}/${vals.length} (${vals.length ? Math.round(yesCount / vals.length * 100) : 0}%)`} />;
                })}
              </div>
            : <Empty icon={<BarChart2 size={18} />}>Need 2 or more shots for statistics</Empty>}
        </CardSection>

        {/* Shot log */}
        <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
          <SecLabel>Shot Log</SecLabel>
          {shots.length
            ? <div className="overflow-auto max-h-52 mt-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">#</th>
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">Serial</th>
                      {sf.map(f => (
                        <th key={f.key} className={cn(
                          "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5",
                          f.type === "number" ? "text-right" : "text-left"
                        )}>{f.label}</th>
                      ))}
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">Time</th>
                      <th className="px-2 py-1.5" />
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {shots.map((s, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="text-muted-foreground px-2 py-1.5">{s.shotNum}</td>
                        <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{s.serial}</td>
                        {sf.map(f => {
                          const val = (s.data || s)[f.key];
                          let display = "";
                          if (val === true) display = "Yes";
                          else if (val === false) display = "No";
                          else if (val !== null && val !== undefined) display = String(val);
                          return (
                            <td key={f.key} className={cn(
                              "px-2 py-1.5",
                              f.type === "number" ? "text-foreground text-right font-mono" : "text-foreground"
                            )}>{display}</td>
                          );
                        })}
                        <td className="text-muted-foreground px-2 py-1.5">{s.timestamp}</td>
                        <td className="px-2 py-1.5">
                          <ShotAttachBtn
                            serial={s.serial}
                            pendingCount={(pendingAttachments[s.serial] || []).length}
                            onQueue={queueAttachment}
                            onError={setDbError} />
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => delShot(i)} className="text-destructive text-xs bg-transparent border-none cursor-pointer">Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <Empty>No shots recorded yet</Empty>}
        </div>
      </div>
        );
      })()}
    </AppShell>
  );

  // ─── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === P.RESULTS && viewed) {
    const s = viewed;
    const sf = s.config.fields || fields;
    const sfKeys = new Set(sf.map(f => f.key));
    const availableWidgets = Object.keys(WIDGETS).filter(k => WIDGETS[k].requires.every(r => sfKeys.has(r)));
    const activeLayout = layout.filter(k => availableWidgets.includes(k));
    const vs = s.shots.filter(sh => {
      const d = sh.data || sh;
      const reqNum = sf.filter(f => f.required && f.type === "number").map(f => f.key);
      return reqNum.every(k => d[k] !== null && d[k] !== undefined && !isNaN(d[k]));
    });
    const st = s.stats;
    const cfgLine = vars.map(v => s.config[v.key]).filter(Boolean).join("  ·  ");
    return (
      <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1100px">
        {/* Toolbar */}
        <div className="flex justify-end items-center mb-6 flex-wrap gap-2">
          <Btn v="secondary" onClick={() => openEditSession(s.id)}>Edit</Btn>
          <Btn v="secondary" onClick={() => continueSession(s.id)}>+ Shots</Btn>
          {log.length >= 2 && (
            <Btn v="secondary" onClick={() => { setCmpSlots([{ id: s.id, color: PALETTE[0] }, { id: log.find(x => x.id !== s.id)?.id, color: PALETTE[1] }]); setPhase(P.CMP); }}>Compare</Btn>
          )}
          <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
          <Btn v="secondary" onClick={() => { setLibraryFilterSessionIds([s.id]); setPhase(P.LIBRARY); }}>Library →</Btn>
        </div>

        {/* Results card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Session header */}
          <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#111118", borderTop: `3px solid ${G}` }}>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Session Results</div>
              <h1 className="text-[18px] font-bold leading-tight" style={{ color: "#ffffff" }}>{s.config.sessionName || "Session"}</h1>
              {cfgLine && <p className="text-[11px] mt-0.5 m-0" style={{ color: "rgba(255,255,255,0.4)" }}>{cfgLine}</p>}
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.config.date}</div>
              <div className="text-[32px] font-black leading-none tabular-nums" style={{ color: G }}>{vs.length}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>shots</div>
            </div>
          </div>

          {/* Widget grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {activeLayout.map((key, idx) => {
              const wg = WIDGETS[key]; if (!wg) return null;
              const fullWidth = key === "shotTable" || key === "attachments";
              return (
                <div key={key} className={cn(
                  "p-5 border-b border-border",
                  fullWidth ? "lg:col-span-2" : null,
                  (!fullWidth && idx % 2 === 0) ? "border-r border-border" : null
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{wg.label}</span>
                    <button onClick={() => toggleWidget(key)} title="Remove widget"
                      className="flex items-center justify-center size-5 rounded text-muted-foreground/30 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                      <X size={12} />
                    </button>
                  </div>
                  {wg.render(s, vs, st, dispOpts, toggleDisp, setDispOpt, setDbError)}
                </div>
              );
            })}
            {availableWidgets.some(k => !activeLayout.includes(k)) && (
              <div className="p-5 border-b border-border lg:col-span-2 flex justify-center">
                <WidgetAdder
                  available={availableWidgets.filter(k => !activeLayout.includes(k))}
                  labels={Object.fromEntries(availableWidgets.map(k => [k, WIDGETS[k].label]))}
                  onAdd={toggleWidget} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-3 flex justify-between items-center bg-secondary">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">SP1-03 · Axon Ballistic</span>
            <span className="text-[10px] text-muted-foreground/50" style={{ fontFamily: "ui-monospace, monospace" }}>{s.shots[0]?.serial} → {s.shots[s.shots.length - 1]?.serial}</span>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── EDIT ────────────────────────────────────────────────────────────────────
  if (phase === P.EDIT) {
    const esValid = esShots.filter(s => !isNaN(s.fps) && !isNaN(s.x) && !isNaN(s.y));
    return (
      <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="960px">
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Edit Session</h1>
          <div className="flex gap-2">
            <Btn onClick={saveEditSession}>Save Changes</Btn>
            <Btn v="secondary" onClick={() => setPhase(P.HISTORY)}>Cancel</Btn>
          </div>
        </div>

        <CardSection title="Configuration" className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {vars.map(vr => (
              <SmartSelect key={vr.key} label={vr.label} value={esCfg[vr.key] || ""} onChange={v => setEsCfg(p => ({ ...p, [vr.key]: v }))} options={opts[vr.key] || []} onAddOption={v => addOption(vr.key, v)} />
            ))}
            {[["Session Name","sessionName","text"],["Date","date","date"],["Notes","notes","text"]].map(([lb,k,t]) => (
              <div key={k} className="flex flex-col">
                <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lb}</label>
                <input type={t} value={esCfg[k] || ""} onChange={e => setEsCfg(p => ({ ...p, [k]: e.target.value }))} className={inp} />
              </div>
            ))}
          </div>
        </CardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <CardSection title="Preview">
            {esValid.length >= 2
              ? <DispersionChart shots={esValid} stats={esStats} size={320} />
              : <Empty icon={<Crosshair size={18} />}>Need 2 or more valid shots for preview</Empty>}
          </CardSection>
          <CardSection title={`Stats (${esValid.length} shots)`}>
            {esValid.length >= 2
              ? <div className="grid grid-cols-2 gap-2">
                  {[["CEP", esStats.cep.toFixed(2), 0, OC.cep],["R90",esStats.r90.toFixed(2), 0, OC.r90],["SD X",esStats.sdX.toFixed(2)],["SD Y",esStats.sdY.toFixed(2)],["Mean FPS",esStats.meanV.toFixed(1),1],["SD FPS",esStats.sdV.toFixed(1)]].map(([k,v,g,ac]) => <SB key={k} label={k} value={v} gold={g} accentColor={ac} />)}
                </div>
              : <Empty icon={<BarChart2 size={18} />}>Need 2 or more valid shots</Empty>}
          </CardSection>
        </div>

        <CardSection title={`Shots (${esShots.length})`} className="mb-4">
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {["#","Serial","FPS","X","Y","Wt","",""].map(h => (
                    <th key={h} className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esShots.map((ss, i) => (
                  <tr key={i} className="border-b border-border">
                    {esShotEdit === i ? (
                      <>
                        <td className="text-muted-foreground px-2 py-1.5">{ss.shotNum}</td>
                        <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{ss.serial}</td>
                        {["fps","x","y","weight"].map(k => (
                          <td key={k} className="px-1.5 py-1">
                            <TblInput value={esShotEditVal[k]} onChange={e => setEsShotEditVal(p => ({ ...p, [k]: e.target.value }))} />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <button onClick={esSaveEdit} className="text-primary text-xs font-semibold bg-transparent border-none cursor-pointer mr-2">Save</button>
                          <button onClick={() => setEsShotEdit(null)} className="text-muted-foreground text-xs bg-transparent border-none cursor-pointer">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-muted-foreground px-2 py-1.5">{ss.shotNum}</td>
                        <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{ss.serial}</td>
                        <td className="text-foreground px-2 py-1.5 font-mono">{ss.fps}</td>
                        <td className="text-foreground px-2 py-1.5 font-mono">{ss.x}</td>
                        <td className="text-foreground px-2 py-1.5 font-mono">{ss.y}</td>
                        <td className="text-muted-foreground px-2 py-1.5 font-mono">{ss.weight || "—"}</td>
                        <td className="px-2 py-1.5 text-center">
                          <ShotAttachBtn shotId={ss.id} sessionId={editSessionId} serial={ss.serial} onError={setDbError} />
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => esStartEdit(i)} className="text-muted-foreground text-xs bg-transparent border-none cursor-pointer mr-2">Edit</button>
                          <button onClick={() => esDelShot(i)} className="text-destructive text-xs bg-transparent border-none cursor-pointer">Del</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardSection>

        <CardSection title="Add Shot" className="border-primary/[0.13]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[["FPS","fps"],["X (in)","x"],["Y (in)","y"],["Weight","weight"]].map(([lb, k]) => (
              <div key={k} className="flex flex-col">
                <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lb}</label>
                <input type="number" step={k === "weight" ? "0.01" : "0.5"} value={esNewShot[k]} onChange={e => setEsNewShot(p => ({ ...p, [k]: e.target.value }))} className={inp} />
              </div>
            ))}
          </div>
          <Btn onClick={esAddShot} disabled={!esNewShot.fps || esNewShot.x === "" || esNewShot.y === ""}>Add Shot</Btn>
        </CardSection>
      </AppShell>
    );
  }

  // ─── COMPARE ─────────────────────────────────────────────────────────────────
  if (phase === P.CMP) {
    const resolved = cmpSlots.map(sl => {
      const s = log.find(x => x.id === sl.id);
      if (!s) return null;
      const vs = s.shots.filter(sh => !isNaN(sh.fps) && !isNaN(sh.x) && !isNaN(sh.y));
      return { ...sl, session: s, shots: vs, stats: s.stats };
    }).filter(Boolean);
    const activeMetrics = ALL_METRICS.filter(m => cmpMetrics.includes(m[0]));
    const CMP_WIDGET_DEFS = { overlay: { label: "Dispersion Overlay" }, metrics: { label: "Metrics Table" }, velCompare: { label: "Velocity Comparison" }, shotLog: { label: "Shot Log" }, attachments: { label: "Attachments" }, rankings: { label: "Rankings" } };
    const mainItems    = cmpLayout.filter(item => item.zone === 'main');
    const sidebarItems = cmpLayout.filter(item => item.zone === 'sidebar');
    const fullItems    = cmpLayout.filter(item => item.zone === 'full');
    const splitMap     = { '1/2': '50%', '2/3': '67%', '3/4': '75%' };
    const mainWidth    = splitMap[cmpSplit];
    const zoneLabel    = { main: 'M', sidebar: 'S', full: 'F' };

    function renderWidget(item) {
      const key = item.i;
      const def = CMP_WIDGET_DEFS[key];
      if (!def) return null;
      return (
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              {def.label}
            </span>
            <button
              className="rgl-remove-btn flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none"
              onClick={() => removeWidget(key)}
              title="Remove widget">
              <X size={13} />
            </button>
          </div>
          <div className={key === 'rankings' ? '' : 'p-4'}>
            {renderWidgetContent(key)}
          </div>
        </div>
      );
    }

    const cmpSessions = resolved.map(r => ({
      name: r.session.config.sessionName || 'This Session',
      color: r.color,
      stats: r.stats,
    }));

    const exportDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const sessionNames = resolved.map(r => r.session.config.sessionName || 'Session').join(' · ');

    async function handleExport() {
      const el = exportRef.current;
      if (!el) return;
      el.classList.add('export-mode');
      try {
        const dataUrl = await toPng(el, { backgroundColor: '#f7f7fa', pixelRatio: 2 });
        const a = document.createElement('a');
        a.download = `compare-${Date.now()}.png`;
        a.href = dataUrl;
        a.click();
      } finally {
        el.classList.remove('export-mode');
      }
    }

    function renderWidgetContent(key) {
      if (key === 'overlay') return (
        <>
          <div className="export-hide flex gap-1.5 mb-3 flex-wrap">
            {[["showCep","CEP",OC.cep],["showR90","R90",OC.r90],["showEllipse","Ellipse",OC.ellipse],["showMpi","MPI",OC.mpi]].map(([k,l,c]) => (
              <Toggle key={k} label={l} on={cmpDispOpts[k]} onToggle={() => setCmpDispOpts(p => ({ ...p, [k]: !p[k] }))} color={c} />
            ))}
          </div>
          <div className="flex justify-center">
            <DispersionMulti sessions={resolved.map(r => ({ shots: r.shots, stats: r.stats, color: r.color }))} size={Math.min(440, 400 + resolved.length * 10)} opts={cmpDispOpts} />
          </div>
          <div className="flex justify-center gap-5 mt-3 flex-wrap">
            {resolved.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ background: r.color }} />
                <span className="text-sm font-medium text-foreground">{r.session.config.sessionName}</span>
                <span className="text-[11px] text-muted-foreground">({r.stats.n})</span>
              </div>
            ))}
          </div>
        </>
      );
      if (key === 'metrics' && activeMetrics.length) return (
        <>
          <div className="export-hide flex justify-end mb-2">
            <button onClick={() => setCmpMetricsOpen(o => !o)}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
              {cmpMetricsOpen ? "Done" : "Edit metrics"}
            </button>
          </div>
          {cmpMetricsOpen && (
            <div className="export-hide flex flex-wrap gap-1.5 mb-4 p-3 bg-secondary rounded-lg border border-border">
              {ALL_METRICS.map(([label]) => (
                <Toggle key={label} label={label} on={cmpMetrics.includes(label)} onToggle={() => toggleCmpMetric(label)} />
              ))}
            </div>
          )}
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted-foreground text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide">Metric</th>
                  {resolved.map((r, i) => (
                    <th key={i} className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: r.color }}>{r.session.config.sessionName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMetrics.map(([label, key2, dec]) => {
                  const vals = resolved.map(r => r.stats[key2]);
                  const isLb = LOWER_BETTER.includes(label);
                  const best = isLb ? Math.min(...vals) : Math.max(...vals);
                  return (
                    <tr key={label} className="border-b border-border odd:bg-secondary/30">
                      <td className="px-2.5 py-2.5 text-sm" style={{ color: ({cep:OC.cep,r90:OC.r90,mpiX:OC.mpi,mpiY:OC.mpi}[key2]) || "var(--color-foreground)" }}>
                        <MetricTip label={label}>{label}</MetricTip>
                      </td>
                      {resolved.map((r, i) => {
                        const v = r.stats[key2];
                        const isBest = v === best && vals.filter(x => x === best).length === 1;
                        return <td key={i} className={cn("px-2.5 py-2.5 text-right font-mono font-semibold text-sm", !isBest && "text-foreground")} style={isBest ? { color: r.color } : undefined}>{v.toFixed(dec)}{isBest ? " ✦" : ""}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
      if (key === 'velCompare') return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
          {resolved.map((r, i) => (
            <div key={i}>
              <div className="text-xs font-semibold mb-2" style={{ color: r.color }}>{r.session.config.sessionName}</div>
              <VelHist shots={r.shots} width={280} color={r.color} />
            </div>
          ))}
        </div>
      );
      if (key === 'shotLog') {
        const allShots = resolved.flatMap(r =>
          [...r.shots]
            .sort((a, b) => (a.shotNum || 0) - (b.shotNum || 0))
            .map(s => ({ ...s, sessionName: r.session.config.sessionName, sessionColor: r.color, mpiX: r.stats.mpiX, mpiY: r.stats.mpiY }))
        );
        const hdrs = ["Session","#","Serial","FPS","X","Y","Wt","Rad"];
        const rightAlign = ["FPS","X","Y","Wt","Rad"];
        return (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  {hdrs.map(h => (
                    <th key={h} className={cn(
                      "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                      rightAlign.includes(h) ? "text-right" : "text-left"
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allShots.map((s, i) => {
                  const r = rad(s.x - (s.mpiX || 0), s.y - (s.mpiY || 0));
                  return (
                    <tr key={i} className="border-b transition-colors"
                      style={{ background: s.sessionColor + "18", borderColor: s.sessionColor + "30" }}>
                      <td className="px-2.5 py-1.5 font-semibold" style={{ color: s.sessionColor }}>{s.sessionName}</td>
                      <td className="px-2.5 py-1.5" style={{ color: s.sessionColor + "99" }}>{s.shotNum}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px]" style={{ color: s.sessionColor + "99" }}>{s.serial}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.fps}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.x}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.y}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{s.weight || "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{r.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      if (key === 'attachments') return (
        <LibraryPage
          log={log}
          vars={vars}
          preFilterSessionIds={resolved.map(r => r.session.id)}
          onError={setDbError} />
      );
      if (key === 'rankings') return (
        <div className="flex">
          <div className="flex-1 min-w-0 border-r border-border"><VelRankingWidget sessions={cmpSessions} /></div>
          <div className="flex-1 min-w-0"><AccuracyRankingWidget sessions={cmpSessions} /></div>
        </div>
      );
      return null;
    }

    return (
      <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1100px">
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {savedComparisons.length > 0 && savedComparisons.map(c => (
              <div key={c.id} className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden">
                <button onClick={() => loadComparison(c)}
                  className="text-xs text-foreground px-3 py-1.5 hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                  {c.name}
                </button>
                <button onClick={() => deleteComparison(c.id)}
                  className="px-2 py-1.5 text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer bg-transparent border-none border-l border-border">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Btn v="secondary" onClick={() => saveComparison(cmpTitle, cmpSlots, cmpFilters, cmpBy, cmpMetrics, cmpLayout)}>
              Save Comparison
            </Btn>
            <Btn v="secondary" onClick={handleExport} disabled={resolved.length < 2}>
              Export Image
            </Btn>
            <Btn onClick={newSession}>+ New Session</Btn>
          </div>
        </div>
        {savedComparisons.length === 0 && <div className="mb-4" />}

        {/* Main compare card */}
        <div ref={exportRef} className="export-root bg-card border border-border rounded-xl overflow-hidden">
          {/* Export header — hidden normally, shown during export */}
          <div className="export-header px-6 py-3 border-b border-border bg-card">
            <div className="text-sm font-bold text-foreground">{sessionNames}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Session Comparison · {exportDate}</div>
          </div>
          {/* Header */}
          <div className="px-6 py-4 text-center" style={{ background: '#111118', borderTop: `3px solid ${G}` }}>
            <input
              value={cmpTitle}
              onChange={e => setCmpTitle(e.target.value)}
              placeholder="Session Comparison"
              className="bg-transparent text-base font-black tracking-[0.08em] uppercase text-center outline-none border-none w-full cursor-text"
              style={{ color: '#ffffff', caretColor: G }}
              onFocus={e => e.target.style.color = '#fff'}
            />
            <p className="text-[10px] mt-0.5 font-medium m-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {resolved.length > 0 ? `${resolved.length} session${resolved.length !== 1 ? "s" : ""}` : ""}
              <span className="export-hide">{resolved.length > 0 ? "  ·  " : ""}click to edit title</span>
            </p>
          </div>

          {/* Session picker */}
          <div className="export-hide bg-secondary border-b border-border">
            <button
              onClick={() => setCmpPickerOpen(o => !o)}
              className="w-full flex items-center justify-between px-6 py-3 cursor-pointer bg-transparent border-none hover:bg-accent/20 transition-colors">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sessions{cmpSlots.length > 0 ? ` — ${cmpSlots.length} selected` : ""}
              </span>
              <svg className={cn("size-3.5 text-muted-foreground transition-transform duration-200", cmpPickerOpen ? "" : "-rotate-90")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          <div className={cn("px-6 overflow-hidden transition-all duration-300", cmpPickerOpen ? "pb-5 max-h-[600px]" : "max-h-0 pb-0 pointer-events-none")}>

            {/* Row 1: Comparing by */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Comparing</span>
              <select
                value={cmpBy}
                onChange={e => { setCmpBy(e.target.value); setCmpFilters({}); }}
                className={`${inp} w-auto text-xs`}>
                <option value="">— all sessions —</option>
                {vars.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
              {cmpBy && (
                <button onClick={() => { setCmpBy(""); setCmpFilters({}); }}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
                  Clear
                </button>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                {(() => { const n = log.filter(s => Object.entries(cmpFilters).every(([k, v]) => !v || s.config[k] === v)).length; return `${n} of ${log.length} sessions`; })()}
              </span>
            </div>

            {/* Row 2: Filter chips for other variables */}
            {cmpBy && (() => {
              const filterVars = vars.filter(v => v.key !== cmpBy);
              const hasFilters = filterVars.some(v => {
                const vals = [...new Set(log.map(s => s.config[v.key]).filter(Boolean))];
                return vals.length >= 2;
              });
              if (!hasFilters) return null;
              return (
                <div className="flex flex-wrap gap-x-5 gap-y-2.5 mb-4 pb-4 border-b border-border">
                  {filterVars.map(v => {
                    const vals = [...new Set(log.map(s => s.config[v.key]).filter(Boolean))];
                    if (vals.length < 2) return null;
                    return (
                      <div key={v.key} className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/50 mr-1">{v.label}</span>
                        {vals.map(val => {
                          const active = cmpFilters[v.key] === val;
                          return (
                            <button key={val}
                              onClick={() => setCmpFilters(p => { const n = { ...p }; if (n[v.key] === val) delete n[v.key]; else n[v.key] = val; return n; })}
                              className="text-[11px] font-semibold px-2.5 py-1 border cursor-pointer transition-all duration-100"
                              style={{
                                background: active ? '#111118' : '#fff',
                                color: active ? G : '#6b6b7e',
                                borderColor: active ? '#111118' : '#e2e2e8',
                              }}>
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Session chips */}
            {(() => {
              const filtered = log.filter(s =>
                Object.entries(cmpFilters).every(([k, v]) => !v || s.config[k] === v)
              );
              if (!filtered.length) return (
                <p className="text-sm text-muted-foreground py-4">No sessions match these filters.</p>
              );
              return (
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map(s => {
                    const slot = cmpSlots.find(sl => sl.id === s.id);
                    const isSelected = !!slot;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (isSelected) {
                            setCmpSlots(p => p.filter(sl => sl.id !== s.id));
                          } else {
                            setCmpSlots(p => [...p, { id: s.id, color: PALETTE[p.length % PALETTE.length] }]);
                          }
                        }}
                        onMouseEnter={ev => setCmpHoverTip({ x: ev.clientX, y: ev.clientY, session: s })}
                        onMouseMove={ev => setCmpHoverTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t)}
                        onMouseLeave={() => setCmpHoverTip(null)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all duration-150 cursor-pointer",
                          isSelected
                            ? "border-primary/30 bg-primary/10 text-foreground"
                            : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80"
                        )}>
                        <span
                          className="size-2 rounded-full shrink-0 transition-colors"
                          style={{ background: isSelected ? slot.color : "rgba(255,255,255,0.15)" }} />
                        {s.config.sessionName || "Session"}
                        {isSelected && <span className="text-primary font-bold leading-none ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Selected strip — color pickers */}
            {cmpSlots.length > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-3.5 border-t border-border flex-wrap">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider shrink-0">
                  {cmpSlots.length} selected
                </span>
                {cmpSlots.map(sl => {
                  const s = log.find(x => x.id === sl.id);
                  if (!s) return null;
                  return (
                    <div key={sl.id} className="flex items-center gap-1.5">
                      <ColorPicker color={sl.color} onChange={c => setCmpSlots(p => p.map(x => x.id === sl.id ? { ...x, color: c } : x))} />
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {s.config.sessionName || "Session"}
                      </span>
                    </div>
                  );
                })}
                <button onClick={() => setCmpSlots([])}
                  className="text-xs text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-none transition-colors ml-auto">
                  Clear all
                </button>
              </div>
            )}
          </div>{/* end collapsible content */}
          </div>{/* end session picker */}

          {resolved.length >= 2 ? (
              <>
                {/* Main + Sidebar row */}
                {(mainItems.length > 0 || sidebarItems.length > 0) && (
                  <div className="flex flex-col md:flex-row md:items-stretch">
                    {mainItems.length > 0 && (
                      <div className="md:shrink-0" style={{ width: sidebarItems.length > 0 ? mainWidth : '100%', maxWidth: '100%' }}>
                        {mainItems.map(item => renderWidget(item))}
                      </div>
                    )}
                    {sidebarItems.length > 0 && (
                      <div className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-border min-w-0">
                        {sidebarItems.map(item => (
                          <div key={item.i} className="flex-1 flex flex-col">
                            {renderWidget(item)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Full-width zone */}
                {fullItems.map(item => renderWidget(item))}
                {/* Add widget bar */}
                {Object.keys(CMP_WIDGET_DEFS).some(k => !cmpLayout.some(item => item.i === k)) && (
                  <div className="widget-add-bar p-5 border-t border-border flex justify-center">
                    <WidgetAdder
                      available={Object.keys(CMP_WIDGET_DEFS).filter(k => !cmpLayout.some(item => item.i === k))}
                      labels={Object.fromEntries(Object.keys(CMP_WIDGET_DEFS).map(k => [k, CMP_WIDGET_DEFS[k].label]))}
                      onAdd={addWidget} />
                  </div>
                )}
                <div className="bg-secondary border-t border-border px-6 py-2.5 flex justify-between">
                  <span className="text-muted-foreground text-[11px]">✦ best in category</span>
                  <span className="text-muted-foreground text-[11px]">SP1-03 Test Program</span>
                </div>
              </>
            ) : (
              <Empty icon={<Crosshair size={18} />}>Select 2 or more sessions above to compare</Empty>
            )}
        </div>

        {/* Session chip hover tooltip */}
        {cmpHoverTip && (() => {
          const s = cmpHoverTip.session;
          const st = s.stats;
          const lines = [
            s.config.sessionName || "Session",
            ...vars.map(v => s.config[v.key] ? `${v.label}: ${s.config[v.key]}` : null).filter(Boolean),
            "─",
            `Shots: ${st.n}`,
            `CEP: ${st.cep.toFixed(3)}"`,
            `R90: ${st.r90.toFixed(3)}"`,
            `Mean FPS: ${st.meanV.toFixed(1)}`,
            `SD FPS: ${st.sdV.toFixed(1)}`,
            ...(s.config.date ? [`Date: ${s.config.date}`] : []),
          ];
          const style = {
            position: "fixed", left: cmpHoverTip.x + 14, top: cmpHoverTip.y - 10,
            pointerEvents: "none", zIndex: 200,
            background: "#1b1b22", border: `1px solid ${G}40`,
            borderRadius: 8, padding: "8px 12px", fontSize: 11, lineHeight: 1.75,
            color: "#ededf2", whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          };
          return (
            <div style={style}>
              {lines.map((l, i) =>
                l === "─"
                  ? <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />
                  : <div key={i} style={i === 0 ? { color: G, fontWeight: 600, marginBottom: 2 } : undefined}>{l}</div>
              )}
            </div>
          );
        })()}
      </AppShell>
    );
  }

  // ─── LIBRARY ─────────────────────────────────────────────────────────────────
  if (phase === P.LIBRARY) return (
    <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1200px">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-1">Attachment Library</h1>
          <p className="text-sm text-muted-foreground">
            {libraryFilterSessionIds ? `Filtered to ${libraryFilterSessionIds.length} session${libraryFilterSessionIds.length !== 1 ? 's' : ''}` : 'All attachments'}
            {libraryFilterSessionIds && (
              <button onClick={() => setLibraryFilterSessionIds(null)} className="ml-2 text-primary text-xs cursor-pointer bg-transparent border-none hover:underline">Show all</button>
            )}
          </p>
        </div>
      </div>
      <LibraryPage
        log={log}
        vars={vars}
        preFilterSessionIds={libraryFilterSessionIds}
        onError={setDbError} />
    </AppShell>
  );

  // ─── HISTORY ─────────────────────────────────────────────────────────────────
  if (phase === P.HISTORY) {
    const hasFilters = Object.keys(histFilters).length > 0 || histSearch.trim();
    const histFiltered = [...log]
      .sort((a, b) => histSort === "newest"
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date))
      .filter(s => {
        if (histSearch.trim() && !(s.config.sessionName || "").toLowerCase().includes(histSearch.trim().toLowerCase())) return false;
        return Object.entries(histFilters).every(([k, v]) => s.config[k] === v);
      });

    return (
      <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="840px">
        <PageHead title="Session History" sub={`${log.length} session${log.length !== 1 ? "s" : ""} recorded`} />
        {!log.length ? (
          <Empty
            icon={<History size={18} />}
            action={<Btn onClick={newSession}>Start First Session</Btn>}>
            No sessions recorded yet. Configure your variables and start firing.
          </Empty>
        ) : (
          <>
            {/* Filter bar */}
            <div className="mb-5">
              <div className="flex gap-2 mb-3">
                <input
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  placeholder="Search by session name…"
                  className={cn(inp, "text-sm flex-1")}
                />
                <button
                  onClick={() => setHistSort(s => s === "newest" ? "oldest" : "newest")}
                  className="text-[11px] font-semibold px-3 py-1 border cursor-pointer transition-all duration-100 shrink-0"
                  style={{ background: '#111118', color: G, borderColor: '#111118' }}>
                  {histSort === "newest" ? "Newest ↓" : "Oldest ↑"}
                </button>
              </div>
              {vars.length > 0 && (
                <div className="flex flex-wrap gap-y-2 gap-x-5">
                  {vars.map(v => {
                    const options = [...new Set(log.map(s => s.config[v.key]).filter(Boolean))];
                    if (!options.length) return null;
                    return (
                      <div key={v.key} className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/50 mr-1">{v.label}</span>
                        {options.map(opt => {
                          const active = histFilters[v.key] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => setHistFilters(f => f[v.key] === opt ? (({ [v.key]: _, ...rest }) => rest)(f) : { ...f, [v.key]: opt })}
                              className="text-[11px] font-semibold px-2.5 py-1 border cursor-pointer transition-all duration-100"
                              style={{
                                background: active ? '#111118' : '#fff',
                                color: active ? G : '#6b6b7e',
                                borderColor: active ? '#111118' : '#e2e2e8',
                              }}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {hasFilters && (
                    <button
                      onClick={() => { setHistFilters({}); setHistSearch(""); }}
                      className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors self-center">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {histFiltered.length === 0 ? (
              <Empty icon={<History size={18} />}>No sessions match the current filters.</Empty>
            ) : (
              <div className="flex flex-col gap-px border border-border">
                {histFiltered.map(s => (
                  <div key={s.id}
                    className="bg-card flex items-center gap-0 transition-all duration-100 hover:bg-secondary/40 group"
                    style={{ borderLeft: `3px solid ${G}` }}>
                    {/* Name + date + shots */}
                    <div className="flex-1 min-w-0 px-4 py-3">
                      <div className="font-bold text-[13px] text-foreground leading-tight truncate">{s.config.sessionName || "Unnamed Session"}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{s.config.date} · {s.stats.n} shot{s.stats.n !== 1 ? "s" : ""}</div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center shrink-0 border-l border-border h-full">
                      <button onClick={() => { setViewId(s.id); setPhase(P.RESULTS); }} className="h-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] cursor-pointer border-none transition-colors" style={{ background: 'transparent', color: '#111118' }} onMouseEnter={e => e.target.style.color=G} onMouseLeave={e => e.target.style.color='#111118'}>View ↗</button>
                      <button onClick={() => openEditSession(s.id)} className="h-full px-3 py-3 text-[11px] font-medium cursor-pointer border-none border-l border-border transition-colors bg-transparent text-muted-foreground hover:text-foreground">Edit</button>
                      <button onClick={() => continueSession(s.id)} className="h-full px-3 py-3 text-[11px] font-medium cursor-pointer border-none border-l border-border transition-colors bg-transparent text-muted-foreground hover:text-foreground">+&nbsp;Shots</button>
                      <button onClick={() => { setCmpSlots([{ id: s.id, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]); setPhase(P.CMP); }} className="h-full px-3 py-3 text-[11px] font-medium cursor-pointer border-none border-l border-border transition-colors bg-transparent text-muted-foreground hover:text-foreground">Cmp</button>
                      <button onClick={() => { if (confirm("Delete this session?")) delSession(s.id); }} className="h-full px-3 py-3 text-[11px] cursor-pointer border-none border-l border-border transition-colors bg-transparent text-destructive/40 hover:text-destructive">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-6 pt-5 border-t border-border flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Btn v="secondary" onClick={() => fileRef.current?.click()}>Import JSON</Btn>
          {log.length > 0 && (<>
            <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
            <Btn v="secondary" onClick={() => exportJson(log)}>Export JSON</Btn>
          </>)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Btn onClick={newSession}>Start New Session</Btn>
      </div>
    </AppShell>
  );
}
