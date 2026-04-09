import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK="bw-vB",OK="bw-opts-vB",CVK="bw-cvars-vB",LK="bw-layout-vB";
async function ld(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch{return null;}}
async function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.error(e);}}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const G    = "#FFDF00";
const BG   = "#0b0b0f";
const SURF = "#131318";
const SURF2= "#1b1b22";
const BD   = "rgba(255,255,255,0.07)";
const BD_HI= "rgba(255,255,255,0.13)";
const TX   = "#ededf2";
const TX2  = "#8a8a9e";
const FONT = "'DM Sans', system-ui, sans-serif";
// Chart-specific
const CHART_BG = "#0f0f14";
const GRID_CLR = "rgba(255,255,255,0.04)";
const AXIS_CLR = "rgba(255,255,255,0.13)";
const TICK_CLR = "#66667a";

// ─── Data constants ───────────────────────────────────────────────────────────
const PALETTE=["#FFDF00","#3b82f6","#ef4444","#22c55e","#a855f7","#f97316","#06b6d4","#ec4899","#84cc16","#f43f5e"];
const DEF_OPTS={rifleRate:["1-6","1-8","1-10","1-12","1-14","1-16","1-18"],sleeveType:["Slotted PLA","Not Slotted PLA","ABS","Ribbed","TPU","Delrin + O ring","Brass (14.65)","Brass (14.75)","Brass (14.80)","Brass (14.65) Reused","Brass (14.75) Reused","S-13 14.80 od","S-16 14.80 od","S-16 14.80 od (Reused)","S-17 14.85 od","S-21 14.90 od"],tailType:["Straight","Tapered","Steep Taper","Round","Biridge","Triridge","Indented"],combustionChamber:["Short (1.5)","Long (1.5)"],load22:["Red","Purple"]};
const DEF_VARS=[{key:"rifleRate",label:"Rifle Rate",core:true},{key:"sleeveType",label:"Sleeve Type",core:true},{key:"tailType",label:"Tail Type",core:true},{key:"combustionChamber",label:"Combustion Chamber",core:true},{key:"load22",label:".22 Load",core:true}];
const ALL_METRICS=[["CEP (50%)","cep",3,true],["R90","r90",3,true],["Mean Radius","mr",3,true],["Ext. Spread","es",3,true],["SD X","sdX",3,true],["SD Y","sdY",3,true],["SD Radial","sdR",3,false],["MPI X","mpiX",3,false],["MPI Y","mpiY",3,false],["Mean FPS","meanV",1,true],["SD FPS","sdV",1,true],["ES FPS","esV",1,true]];
const LOWER_BETTER=["CEP (50%)","R90","Mean Radius","Ext. Spread","SD X","SD Y","SD Radial","SD FPS","ES FPS"];

// ─── Math helpers ─────────────────────────────────────────────────────────────
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
const rad=(x,y)=>Math.sqrt(x*x+y*y);
function calcStats(shots){
  const v=shots.filter(s=>!isNaN(s.fps)&&!isNaN(s.x)&&!isNaN(s.y));
  if(v.length<2)return{cep:0,r90:0,mpiX:0,mpiY:0,mr:0,es:0,sdR:0,sdV:0,meanV:0,esV:0,covEllipse:null,n:v.length,sdX:0,sdY:0};
  const xs=v.map(s=>s.x),ys=v.map(s=>s.y),vs=v.map(s=>s.fps),mpiX=mean(xs),mpiY=mean(ys);
  const radii=v.map(s=>rad(s.x-mpiX,s.y-mpiY)),sorted=[...radii].sort((a,b)=>a-b);
  const cep=sorted[Math.floor(sorted.length*.5)]||0,r90=sorted[Math.min(Math.floor(sorted.length*.9),sorted.length-1)]||0;
  const mr=mean(radii),es=Math.max(...radii)*2,sdR=std(radii),sdV=std(vs),meanV=mean(vs),esV=vs.length?Math.max(...vs)-Math.min(...vs):0,sdX=std(xs),sdY=std(ys);
  let covEllipse=null;
  if(v.length>=3){const cx=xs.map(q=>q-mpiX),cy=ys.map(q=>q-mpiY),n=cx.length,sxx=cx.reduce((s2,q)=>s2+q*q,0)/(n-1),syy=cy.reduce((s2,q)=>s2+q*q,0)/(n-1),sxy=cx.reduce((s2,q,i)=>s2+q*cy[i],0)/(n-1),t=Math.atan2(2*sxy,sxx-syy)/2,k=2.146,a2=(sxx+syy)/2+Math.sqrt(((sxx-syy)/2)**2+sxy**2),b2=(sxx+syy)/2-Math.sqrt(((sxx-syy)/2)**2+sxy**2);covEllipse={rx:Math.sqrt(Math.max(a2,.001)*k),ry:Math.sqrt(Math.max(b2,.001)*k),angle:t*180/Math.PI};}
  return{cep,r90,mpiX,mpiY,mr,es,sdR,sdV,meanV,esV,covEllipse,n:v.length,sdX,sdY};
}
function makeSerial(cfg,num,offset){return`SP1-03 ${cfg.rifleRate||""}RR ${String(offset+num).padStart(2,"0")}`;}
function esc(v){const s=String(v??"");return s.includes(",")||s.includes('"')||s.includes("\n")?'"'+s.replace(/"/g,'""')+'"':s;}
function rowC(a){return a.map(esc).join(",");}
function dl(t,fn,m){const b=new Blob([t],{type:m}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
function exportMasterCsv(log,vars){const h=["Serial #",...vars.map(v=>v.label),"X (in)","Y (in)","Chrono FPS","Weight (g)","Time Stamp","Date","Notes"];const rows=[rowC(h)];log.forEach(s=>{s.shots.forEach(sh=>{rows.push(rowC([sh.serial,...vars.map(v=>s.config[v.key]||""),sh.x,sh.y,sh.fps,sh.weight||"",sh.timestamp||"",s.config.date||"",s.config.notes||""]));});});dl(rows.join("\n"),"Ballistic_Master.csv","text/csv");}
function exportJson(log){dl(JSON.stringify(log,null,2),"Ballistic_All.json","application/json");}
function countOverlaps(shots){const m={};shots.forEach(s=>{const k=`${s.x},${s.y}`;m[k]=(m[k]||0)+1;});return m;}

// ─── Style helpers ────────────────────────────────────────────────────────────
const inp = "bg-[#0f0f14] border border-white/[.08] rounded-lg px-3 py-2.5 text-sm text-white/90 focus:border-yellow-400/50 focus:outline-none w-full placeholder-white/20 transition-colors";
const card = { background: SURF, border: `1px solid ${BD}`, borderRadius: 12 };

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Btn({ children, onClick, v = "primary", disabled, cls = "" }) {
  const styles = {
    primary:   { background: G,    color: "#000", border: "none" },
    secondary: { background: "transparent", color: TX2, border: `1px solid ${BD_HI}` },
    danger:    { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.22)" },
  };
  const s = styles[v] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...s, borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
        opacity: disabled ? 0.4 : 1, fontFamily: FONT, whiteSpace: "nowrap" }}
      className={`hover:brightness-110 ${cls}`}
    >{children}</button>
  );
}

function SB({ label, value, gold }) {
  return (
    <div style={{ background: SURF2, border: `1px solid ${BD}`, borderRadius: 10,
      padding: "14px 16px", borderLeft: gold ? `3px solid ${G}` : `3px solid rgba(255,255,255,0.1)` }}>
      <div style={{ color: TX2, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
      <div style={{ color: gold ? G : TX, fontWeight: 600, fontSize: 15,
        fontFamily: "'Courier New', monospace" }}>{value}</div>
    </div>
  );
}

function Toggle({ label, on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 7,
      background: on ? `${G}18` : "rgba(255,255,255,0.04)",
      color: on ? G : TX2,
      border: `1px solid ${on ? `${G}28` : BD}`,
      fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", fontFamily: FONT,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3,
        background: on ? G : "rgba(255,255,255,0.2)", flexShrink: 0, transition: "background 0.15s" }}/>
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
      <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{label}</label>
      {adding ? (
        <div className="flex gap-1">
          <input value={nv} onChange={e => setNv(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }}
            placeholder="New option…" className={inp} autoFocus />
          <button onClick={add} style={{ color: G, fontSize: 12, fontWeight: 700, padding: "0 10px", flexShrink: 0, cursor: "pointer", background: "none", border: "none" }}>Add</button>
          <button onClick={() => setAdding(false)} style={{ color: TX2, fontSize: 12, padding: "0 6px", flexShrink: 0, cursor: "pointer", background: "none", border: "none" }}>✕</button>
        </div>
      ) : (
        <div className="flex gap-1">
          <select value={value} onChange={e => onChange(e.target.value)} className={inp}>
            <option value="">—</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={() => setAdding(true)} title="Add option"
            style={{ color: G, fontSize: 20, padding: "0 10px", flexShrink: 0, cursor: "pointer",
              fontWeight: 300, lineHeight: 1, background: "none", border: "none" }}>+</button>
        </div>
      )}
    </div>
  );
}

function ColorPicker({ color, onChange }) {
  const names = ["Gold","Blue","Red","Green","Purple","Orange","Cyan","Pink","Lime","Rose"];
  return (
    <select value={color} onChange={e => onChange(e.target.value)}
      style={{ background: SURF2, color, border: `1px solid ${color}40`, borderRadius: 7,
        padding: "6px 10px", fontSize: 12, fontWeight: 600, minWidth: 88, cursor: "pointer" }}>
      {PALETTE.map((c, i) => <option key={c} value={c} style={{ color: c, background: "#111" }}>{names[i]}</option>)}
    </select>
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

function drawOverlays(g, stats, sc, color, opts) {
  if (stats.cep <= 0) return;
  const cx = sc(stats.mpiX), cy = sc(-stats.mpiY);
  if (opts.showCep) {
    const rp = Math.abs(sc(stats.cep) - sc(0));
    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", rp).attr("fill", "none")
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "6,4");
    g.append("text").attr("x", cx + rp + 4).attr("y", cy - 4).text("CEP")
      .attr("fill", color).attr("font-size", 9).attr("font-weight", "600");
  }
  if (opts.showR90) {
    const rp = Math.abs(sc(stats.r90) - sc(0));
    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", rp).attr("fill", "none")
      .attr("stroke", color).attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("stroke-opacity", .45);
  }
  if (opts.showEllipse && stats.covEllipse) {
    const { rx, ry, angle } = stats.covEllipse;
    g.append("ellipse").attr("cx", cx).attr("cy", cy)
      .attr("rx", Math.abs(sc(rx) - sc(0))).attr("ry", Math.abs(sc(ry) - sc(0)))
      .attr("transform", `rotate(${-angle},${cx},${cy})`).attr("fill", "none")
      .attr("stroke", color).attr("stroke-width", .7).attr("stroke-opacity", .3);
  }
  if (opts.showMpi) {
    g.append("line").attr("x1", cx - 6).attr("x2", cx + 6).attr("y1", cy).attr("y2", cy).attr("stroke", color).attr("stroke-width", 1.5);
    g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", cy - 6).attr("y2", cy + 6).attr("stroke", color).attr("stroke-width", 1.5);
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

// ─── Chart components ─────────────────────────────────────────────────────────
function DispersionChart({ shots, stats, size = 380, opts = { showCep: true, showR90: true, showEllipse: true, showMpi: true, showGrid: true }, color = G }) {
  const ref = useRef();
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
    drawOverlays(g, stats, sc, color, opts);
    drawShots(g, shots, sc, color);
    drawAxes(svg, sc, size, m, w);
  }, [shots, stats, size, opts, color]);
  return <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function DispersionMulti({ sessions, size = 440, opts = { showCep: true, showR90: true, showEllipse: true, showMpi: true } }) {
  const ref = useRef();
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
    sessions.forEach(d => { drawOverlays(g, d.stats, sc, d.color, opts); drawShots(g, d.shots, sc, d.color); });
    drawAxes(svg, sc, size, m, w);
  }, [sessions, size, opts]);
  return <svg ref={ref} width={size} height={size} style={{ background: CHART_BG, borderRadius: 10 }} />;
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
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 34, l: 42 }, w = width - m.l - m.r, h = 145 - m.t - m.b;
    const data = shots.map(s => ({ v: s.fps, r: rad(s.x, s.y) }));
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.v)).nice().range([0, w]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.r) * 1.2]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.v)).attr("cy", d => y(d.r)).attr("r", 4)
      .attr("fill", G).attr("fill-opacity", .8).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .5);
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
  return <svg ref={ref} width={width} height={145} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function RadialTrack({ shots, width = 360 }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
    const data = shots.map((s, i) => ({ i: i + 1, r: rad(s.x, s.y) }));
    const x = d3.scaleLinear().domain([1, shots.length]).range([0, w]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.r) * 1.2]).nice().range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(shots.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    gg.append("path").datum(data).attr("fill", "none").attr("stroke", G).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.r)).curve(d3.curveMonotoneX));
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.i)).attr("cy", d => y(d.r)).attr("r", 3)
      .attr("fill", G).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .4);
    svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Shot # → Radial (in)");
  }, [shots, width]);
  return <svg ref={ref} width={width} height={125} style={{ background: CHART_BG, borderRadius: 10 }} />;
}

function FpsTrack({ shots, width = 360 }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || shots.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
    const data = shots.map((s, i) => ({ i: i + 1, v: s.fps }));
    const x = d3.scaleLinear().domain([1, shots.length]).range([0, w]);
    const y = d3.scaleLinear().domain([d3.min(data, d => d.v) - 10, d3.max(data, d => d.v) + 10]).range([h, 0]);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(shots.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
    const mv = mean(data.map(d => d.v));
    gg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(mv)).attr("y2", y(mv))
      .attr("stroke", G).attr("stroke-width", 1).attr("stroke-dasharray", "4,3").attr("stroke-opacity", .45);
    gg.append("path").datum(data).attr("fill", "none").attr("stroke", G).attr("stroke-width", 1.5)
      .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX));
    gg.selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.i)).attr("cy", d => y(d.v)).attr("r", 3)
      .attr("fill", G).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .4);
    svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
      .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text("Shot # → FPS");
  }, [shots, width]);
  return <svg ref={ref} width={width} height={125} style={{ background: CHART_BG, borderRadius: 10 }} />;
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
  const right = ["FPS","X","Y","Rad"];
  return (
    <div className="overflow-auto max-h-52">
      <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BD}` }}>
            {hdrs.map(h => (
              <th key={h} style={{ color: TX2, fontWeight: 600, textTransform: "uppercase", fontSize: 10,
                letterSpacing: "0.06em", padding: "6px 10px", textAlign: right.includes(h) ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${BD}` }}>
              <td style={{ color: TX2, padding: "7px 10px" }}>{s.shotNum}</td>
              <td style={{ color: TX2, padding: "7px 10px", fontFamily: "monospace", fontSize: 11 }}>{s.serial}</td>
              <td style={{ color: TX, padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{s.fps}</td>
              <td style={{ color: TX, padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{s.x}</td>
              <td style={{ color: TX, padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{s.y}</td>
              <td style={{ color: TX2, padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{s.weight || "—"}</td>
              <td style={{ color: TX2, padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{rad(s.x, s.y).toFixed(1)}</td>
              <td style={{ color: TX2, padding: "7px 10px" }}>{s.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Calculations panel ───────────────────────────────────────────────────────
function CalcPanel({ shots, stats }) {
  const vs = shots.filter(s => !isNaN(s.fps) && !isNaN(s.x) && !isNaN(s.y));
  if (vs.length < 2) return <p style={{ color: TX2 }}>Need at least 2 shots for calculations.</p>;
  const xs = vs.map(s => s.x), ys = vs.map(s => s.y), fps = vs.map(s => s.fps);
  const mpiX = mean(xs), mpiY = mean(ys);
  const radii = vs.map(s => rad(s.x - mpiX, s.y - mpiY));
  const sortedR = [...radii].sort((a, b) => a - b);

  const defs = [
    { name: "Mean Point of Impact (MPI)", value: `X: ${mpiX.toFixed(3)}, Y: ${mpiY.toFixed(3)}`, desc: "The average center of all your shots. If your sights were perfect, this would be (0, 0). The offset tells you how far your group center is from the bore sight.", calc: `MPI X = (${xs.map(x => x).join(" + ")}) / ${vs.length} = ${mpiX.toFixed(3)}\nMPI Y = (${ys.map(y => y).join(" + ")}) / ${vs.length} = ${mpiY.toFixed(3)}` },
    { name: "MPI Offset", value: `${rad(mpiX, mpiY).toFixed(3)} in`, desc: "The straight-line distance from bore sight (0,0) to the MPI.", calc: `Offset = sqrt(MPI_X² + MPI_Y²) = sqrt(${mpiX.toFixed(3)}² + ${mpiY.toFixed(3)}²) = ${rad(mpiX, mpiY).toFixed(3)}` },
    { name: "CEP (Circular Error Probable)", value: `${stats.cep.toFixed(3)} in`, desc: "The radius of a circle centered on the MPI that contains 50% of your shots. The primary precision metric — lower is tighter.", calc: `Radial distances from MPI (sorted): [${sortedR.map(r => r.toFixed(2)).join(", ")}]\n50th percentile index: floor(${vs.length} × 0.5) = ${Math.floor(vs.length * 0.5)}\nCEP = ${stats.cep.toFixed(3)} in` },
    { name: "R90 (90th Percentile Radius)", value: `${stats.r90.toFixed(3)} in`, desc: "The radius of a circle centered on the MPI that contains 90% of your shots.", calc: `90th percentile index: floor(${vs.length} × 0.9) = ${Math.min(Math.floor(vs.length * 0.9), vs.length - 1)}\nR90 = ${stats.r90.toFixed(3)} in` },
    { name: "Mean Radius", value: `${stats.mr.toFixed(3)} in`, desc: "Average distance of all shots from the MPI. More sensitive to outliers than CEP.", calc: `Radii: [${radii.map(r => r.toFixed(2)).join(", ")}]\nMean Radius = ${stats.mr.toFixed(3)} in` },
    { name: "Extreme Spread (ES)", value: `${stats.es.toFixed(3)} in`, desc: "Diameter of the smallest circle that encloses all shots. Absolute worst-to-worst spread.", calc: `Max radial = ${Math.max(...radii).toFixed(3)}\nES = max × 2 = ${stats.es.toFixed(3)} in` },
    { name: "SD X", value: `${stats.sdX.toFixed(3)} in`, desc: "Horizontal spread standard deviation. If SD X >> SD Y, group is elongated horizontally.", calc: `X: [${xs.join(", ")}]\nSD X = ${stats.sdX.toFixed(3)} in` },
    { name: "SD Y", value: `${stats.sdY.toFixed(3)} in`, desc: "Vertical spread standard deviation.", calc: `Y: [${ys.join(", ")}]\nSD Y = ${stats.sdY.toFixed(3)} in` },
    { name: "SD Radial", value: `${stats.sdR.toFixed(3)} in`, desc: "Standard deviation of radial distances from MPI.", calc: `Radii: [${radii.map(r => r.toFixed(2)).join(", ")}]\nSD Radial = ${stats.sdR.toFixed(3)} in` },
    { name: "Mean FPS", value: `${stats.meanV.toFixed(1)} fps`, desc: "Average velocity across all shots.", calc: `FPS: [${fps.join(", ")}]\nMean = ${stats.meanV.toFixed(1)} fps` },
    { name: "SD FPS", value: `${stats.sdV.toFixed(1)} fps`, desc: "Shot-to-shot velocity consistency — lower means more uniform propellant burn.", calc: `SD = ${stats.sdV.toFixed(1)} fps` },
    { name: "ES FPS", value: `${stats.esV.toFixed(1)} fps`, desc: "Fastest minus slowest shot. Full velocity range.", calc: `Max = ${Math.max(...fps)}, Min = ${Math.min(...fps)}\nES = ${stats.esV.toFixed(1)} fps` },
    { name: "90% Covariance Ellipse", value: stats.covEllipse ? `${stats.covEllipse.rx.toFixed(2)} × ${stats.covEllipse.ry.toFixed(2)} in, ${stats.covEllipse.angle.toFixed(1)}°` : "N/A", desc: "Reveals the true shape and tilt of dispersion. If nearly circular, spread is uniform in all directions.", calc: stats.covEllipse ? `Semi-major: ${stats.covEllipse.rx.toFixed(3)} in\nSemi-minor: ${stats.covEllipse.ry.toFixed(3)} in\nRotation: ${stats.covEllipse.angle.toFixed(1)}°` : "Requires 3+ shots" },
  ];

  return (
    <div className="space-y-3">
      <div style={{ background: SURF2, border: `1px solid ${BD}`, borderRadius: 10, padding: 16 }}>
        <div style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>How to read this</div>
        <p style={{ color: TX2, fontSize: 12, lineHeight: 1.6, margin: 0 }}>Each metric shows its value, what it means, and the calculation using your shot data. Distance metrics are in inches. All dispersion metrics are calculated relative to the MPI — isolating precision from accuracy.</p>
      </div>
      {defs.map(d => (
        <div key={d.name} style={{ background: SURF2, border: `1px solid ${BD}`, borderRadius: 10, padding: 16 }}>
          <div className="flex items-baseline justify-between flex-wrap gap-2" style={{ marginBottom: 6 }}>
            <h4 style={{ color: TX, fontSize: 13, fontWeight: 600, margin: 0 }}>{d.name}</h4>
            <span style={{ color: G, fontFamily: "monospace", fontWeight: 600, fontSize: 13 }}>{d.value}</span>
          </div>
          <p style={{ color: TX2, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{d.desc}</p>
          <pre style={{ color: TX2, background: CHART_BG, padding: "10px 12px", borderRadius: 7, fontSize: 10, overflowX: "auto", whiteSpace: "pre-wrap", margin: 0, border: `1px solid ${BD}` }}>{d.calc}</pre>
        </div>
      ))}
    </div>
  );
}

// ─── Widget registry ──────────────────────────────────────────────────────────
const WIDGETS = {
  dispersion: { label: "Shot Dispersion", default: true, render: (s, vs, st, opts) => <DispersionChart shots={vs} stats={st} size={380} opts={opts} /> },
  velHist:    { label: "Velocity Distribution", default: true, render: (s, vs) => <VelHist shots={vs} /> },
  velRad:     { label: "FPS vs Radial", default: true, render: (s, vs) => <VelRad shots={vs} /> },
  metrics:    { label: "Key Metrics", default: true, render: (s, vs, st) => (
    <div className="grid grid-cols-2 gap-2">
      {[["CEP",st.cep.toFixed(2)+" in",1],["R90",st.r90.toFixed(2)+" in"],["SD X",st.sdX.toFixed(2)],["SD Y",st.sdY.toFixed(2)],["Mean FPS",st.meanV.toFixed(1),1],["SD FPS",st.sdV.toFixed(1)],["ES FPS",st.esV.toFixed(1)],["Mean Rad",st.mr.toFixed(2)],["MPI X/Y",st.mpiX.toFixed(1)+"/"+st.mpiY.toFixed(1)],["Ext Spread",st.es.toFixed(2)]].map(([k,v,g]) => <SB key={k} label={k} value={v} gold={g} />)}
    </div>
  )},
  calculations: { label: "Calculations & Legend", default: false, render: (s, vs, st) => <CalcPanel shots={vs} stats={st} /> },
  radTrack:   { label: "Radial Tracking", default: false, render: (s, vs) => <RadialTrack shots={vs} /> },
  fpsTrack:   { label: "FPS Tracking", default: false, render: (s, vs) => <FpsTrack shots={vs} /> },
  xyTrack:    { label: "X/Y Deviation", default: false, render: (s, vs) => <XYTrack shots={vs} /> },
  shotTable:  { label: "Shot Table", default: false, render: (s, vs) => <ShotTable shots={vs} /> },
};
const DEF_LAYOUT = Object.keys(WIDGETS).filter(k => WIDGETS[k].default);
const DEF_DISP = { showCep: true, showR90: true, showEllipse: true, showMpi: true, showGrid: true };
const DEF_CMP_METRICS = ALL_METRICS.filter(m => m[3]).map(m => m[0]);
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, VARS: 4, CMP: 5, EDIT: 6 };

// ─── Shared layout helpers ────────────────────────────────────────────────────
function SecLabel({ children }) {
  return <div style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{children}</div>;
}
function CardSection({ title, children, style = {} }) {
  return (
    <div style={{ ...card, padding: 24, ...style }}>
      {title && (
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${BD}` }}>
          <SecLabel>{title}</SecLabel>
        </div>
      )}
      {children}
    </div>
  );
}
function Empty({ children }) {
  return <p style={{ color: TX2, textAlign: "center", padding: "40px 0", fontSize: 13, margin: 0 }}>{children}</p>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]   = useState(P.SETUP);
  const [log, setLog]       = useState([]);
  const [opts, setOpts]     = useState(DEF_OPTS);
  const [vars, setVars]     = useState(DEF_VARS);
  const [viewId, setViewId] = useState(null);
  const [editSessionId, setEditSessionId] = useState(null);
  const fileRef = useRef(); const fpsRef = useRef();
  const [newVarName, setNewVarName] = useState("");
  const [cfg, setCfg] = useState({ rifleRate: "", sleeveType: "", tailType: "", combustionChamber: "", load22: "", shotCount: "10", notes: "", sessionName: "", date: new Date().toISOString().split("T")[0] });
  const up = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const [shots, setShots]   = useState([]);
  const [cur, setCur]       = useState({ fps: "", x: "", y: "", weight: "" });
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [esCfg, setEsCfg]   = useState({});
  const [esShots, setEsShots] = useState([]);
  const [esNewShot, setEsNewShot] = useState({ fps: "", x: "", y: "", weight: "" });
  const [esShotEdit, setEsShotEdit]   = useState(null);
  const [esShotEditVal, setEsShotEditVal] = useState({});
  const [layout, setLayout] = useState(DEF_LAYOUT);
  const [dispOpts, setDispOpts] = useState(DEF_DISP);
  const [showPanel, setShowPanel] = useState(false);
  const [cmpSlots, setCmpSlots] = useState([{ id: null, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]);
  const [cmpDispOpts, setCmpDispOpts] = useState(DEF_DISP);
  const [cmpShowPanel, setCmpShowPanel] = useState(false);
  const [cmpMetrics, setCmpMetrics] = useState(DEF_CMP_METRICS);
  const [cmpWidgets, setCmpWidgets] = useState(["overlay","metrics"]);
  const [cmpTitle, setCmpTitle] = useState("");

  const existingCount = useMemo(() => log.reduce((c, s) => s.config.rifleRate === cfg.rifleRate ? c + s.shots.length : c, 0), [log, cfg.rifleRate]);
  useEffect(() => {
    (async () => {
      const l = await ld(SK); if (l) setLog(l);
      const o = await ld(OK); if (o) setOpts(p => ({ ...p, ...o }));
      const cv = await ld(CVK); if (cv) setVars(cv);
      const ly = await ld(LK); if (ly) { if (ly.layout) setLayout(ly.layout); if (ly.dispOpts) setDispOpts(ly.dispOpts); if (ly.cmpMetrics) setCmpMetrics(ly.cmpMetrics); if (ly.cmpWidgets) setCmpWidgets(ly.cmpWidgets); }
    })();
  }, []);

  const saveLayoutAll = useCallback(async upd => { const c = { layout, dispOpts, cmpMetrics, cmpWidgets, ...upd }; await sv(LK, c); }, [layout, dispOpts, cmpMetrics, cmpWidgets]);
  const toggleWidget = k => { setLayout(p => { const n = p.includes(k) ? p.filter(x => x !== k) : [...p, k]; saveLayoutAll({ layout: n }); return n; }); };
  const moveWidget = (k, dir) => { setLayout(p => { const i = p.indexOf(k); if (i < 0) return p; const ni = i + dir; if (ni < 0 || ni >= p.length) return p; const n = [...p]; [n[i], n[ni]] = [n[ni], n[i]]; saveLayoutAll({ layout: n }); return n; }); };
  const toggleDisp = k => { setDispOpts(p => { const n = { ...p, [k]: !p[k] }; saveLayoutAll({ dispOpts: n }); return n; }); };
  const toggleCmpMetric = label => { setCmpMetrics(p => { const n = p.includes(label) ? p.filter(x => x !== label) : [...p, label]; saveLayoutAll({ cmpMetrics: n }); return n; }); };
  const toggleCmpWidget = k => { setCmpWidgets(p => { const n = p.includes(k) ? p.filter(x => x !== k) : [...p, k]; saveLayoutAll({ cmpWidgets: n }); return n; }); };
  const moveCmpWidget = (k, dir) => { setCmpWidgets(p => { const i = p.indexOf(k); if (i < 0) return p; const ni = i + dir; if (ni < 0 || ni >= p.length) return p; const n = [...p]; [n[i], n[ni]] = [n[ni], n[i]]; saveLayoutAll({ cmpWidgets: n }); return n; }); };

  const total = parseInt(cfg.shotCount) || 0;
  const validShots = useMemo(() => shots.filter(s => !isNaN(s.fps) && !isNaN(s.x) && !isNaN(s.y)), [shots]);
  const stats = useMemo(() => calcStats(shots), [shots]);
  const addOption = useCallback(async (key, val) => { setOpts(p => { const n = { ...p, [key]: [...(p[key] || []), val] }; sv(OK, n); return n; }); }, []);
  const addVar = async () => { if (!newVarName.trim()) return; const key = newVarName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"); if (vars.find(v => v.key === key)) return; const nv = [...vars, { key, label: newVarName.trim(), core: false }]; setVars(nv); await sv(CVK, nv); setOpts(p => { const n = { ...p, [key]: [] }; sv(OK, n); return n; }); setNewVarName(""); };
  const removeVar = async key => { setVars(p => { const n = p.filter(v => v.key !== key); sv(CVK, n); return n; }); };
  const updateLog = async nl => { setLog(nl); await sv(SK, nl); };
  const addShot = useCallback(() => { const fps = parseFloat(cur.fps), x = parseFloat(cur.x), y = parseFloat(cur.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setShots(p => [...p, { fps, x, y, weight: cur.weight, serial: makeSerial(cfg, p.length + 1, existingCount), shotNum: p.length + 1, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setCur(p => ({ fps: "", x: "", y: "", weight: p.weight })); setTimeout(() => fpsRef.current?.focus(), 50); }, [cur, shots, cfg, existingCount]);
  const handleKey = useCallback(e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addShot(); } }, [addShot]);
  const startEdit = i => { setEditIdx(i); setEditVal({ ...shots[i] }); };
  const saveEdit = () => { if (editIdx === null) return; const fps = parseFloat(editVal.fps), x = parseFloat(editVal.x), y = parseFloat(editVal.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setShots(p => p.map((s, i) => i === editIdx ? { ...s, ...editVal, fps, x, y } : s)); setEditIdx(null); };
  const delShot = i => setShots(p => p.filter((_, j) => j !== i).map((s, j) => ({ ...s, shotNum: j + 1 })));
  const finishSession = async () => { const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | "); const id = Date.now(); await updateLog([...log, { id, date: new Date().toISOString(), config: { ...cfg, sessionName: name }, shots: [...shots], stats: { ...stats } }]); setViewId(id); setPhase(P.RESULTS); };
  const newSession = () => { setPhase(P.SETUP); setShots([]); setCur({ fps: "", x: "", y: "", weight: "" }); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
  const delSession = async id => updateLog(log.filter(s => s.id !== id));
  const handleImport = async e => { const file = e.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (Array.isArray(data) && data.length) { await updateLog([...log, ...data]); alert("Imported " + data.length); } else alert("No sessions."); } catch (err) { alert("Error: " + err.message); } e.target.value = ""; };
  const openEditSession = id => { const s = log.find(x => x.id === id); if (!s) return; setEditSessionId(id); setEsCfg({ ...s.config }); setEsShots(s.shots.map(sh => ({ ...sh }))); setEsNewShot({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" }); setEsShotEdit(null); setPhase(P.EDIT); };
  const saveEditSession = async () => { const st = calcStats(esShots); const name = esCfg.sessionName || vars.map(v => esCfg[v.key]).filter(Boolean).join(" | "); await updateLog(log.map(s => s.id === editSessionId ? { ...s, config: { ...esCfg, sessionName: name }, shots: [...esShots], stats: st } : s)); setViewId(editSessionId); setPhase(P.RESULTS); };
  const esAddShot = () => { const fps = parseFloat(esNewShot.fps), x = parseFloat(esNewShot.x), y = parseFloat(esNewShot.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setEsShots(p => [...p, { fps, x, y, weight: esNewShot.weight, serial: makeSerial(esCfg, p.length + 1, 0), shotNum: p.length + 1, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setEsNewShot(p => ({ fps: "", x: "", y: "", weight: p.weight })); };
  const esDelShot = i => setEsShots(p => p.filter((_, j) => j !== i).map((s, j) => ({ ...s, shotNum: j + 1 })));
  const esStartEdit = i => { setEsShotEdit(i); setEsShotEditVal({ ...esShots[i] }); };
  const esSaveEdit = () => { if (esShotEdit === null) return; const fps = parseFloat(esShotEditVal.fps), x = parseFloat(esShotEditVal.x), y = parseFloat(esShotEditVal.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setEsShots(p => p.map((s, i) => i === esShotEdit ? { ...s, ...esShotEditVal, fps, x, y } : s)); setEsShotEdit(null); };
  const continueSession = id => { const s = log.find(x => x.id === id); if (!s) return; setCfg({ ...s.config }); setShots(s.shots.map(sh => ({ ...sh }))); setCur({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" }); updateLog(log.filter(x => x.id !== id)); setPhase(P.FIRE); setTimeout(() => fpsRef.current?.focus(), 100); };
  const viewed = log.find(s => s.id === viewId);
  const esStats = useMemo(() => calcStats(esShots), [esShots]);

  // ─── Persistent top nav ─────────────────────────────────────────────────────
  const NavBar = () => {
    const navItems = [
      { label: "Setup",     ph: P.SETUP,   onClick: newSession },
      { label: "Fire",      ph: P.FIRE,    disabled: phase !== P.FIRE },
      { label: "Results",   ph: P.RESULTS, disabled: !viewId, onClick: () => setPhase(P.RESULTS) },
      { label: "History",   ph: P.HISTORY, onClick: () => setPhase(P.HISTORY) },
      { label: "Compare",   ph: P.CMP,     disabled: log.length < 2, onClick: () => { setCmpSlots(log.slice(-2).map((s, i) => ({ id: s.id, color: PALETTE[i] }))); setPhase(P.CMP); } },
      { label: "Variables", ph: P.VARS,    onClick: () => setPhase(P.VARS) },
    ];
    return (
      <header style={{ background: SURF, borderBottom: `1px solid ${BD}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", height: 54, gap: 28 }}>
          <div style={{ color: G, fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>
            Ballistic WS
          </div>
          <nav style={{ display: "flex", gap: 2, flex: 1 }}>
            {navItems.map(item => (
              <button key={item.label} disabled={item.disabled}
                onClick={item.disabled ? undefined : (item.onClick || (() => setPhase(item.ph)))}
                style={{
                  padding: "5px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                  background: phase === item.ph ? `${G}18` : "transparent",
                  color: phase === item.ph ? G : TX2,
                  border: `1px solid ${phase === item.ph ? `${G}28` : "transparent"}`,
                  cursor: item.disabled ? "default" : "pointer",
                  opacity: item.disabled ? 0.35 : 1,
                  transition: "all 0.15s", fontFamily: FONT,
                }}
              >{item.label}</button>
            ))}
          </nav>
          <span style={{ color: TX2, fontSize: 12, flexShrink: 0 }}>{log.length} session{log.length !== 1 ? "s" : ""}</span>
        </div>
      </header>
    );
  };

  // Page shell — wraps all phase content
  const Shell = ({ children, maxW = "1060px" }) => (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: FONT, color: TX }}>
      <NavBar />
      <main style={{ maxWidth: maxW, margin: "0 auto", padding: "40px 28px 60px" }}>
        {children}
      </main>
    </div>
  );

  // Page-level heading block
  const PageHead = ({ title, sub }) => (
    <div style={{ marginBottom: 32 }}>
      <h1 style={{ color: TX, fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{title}</h1>
      {sub && <p style={{ color: TX2, fontSize: 13, margin: 0 }}>{sub}</p>}
    </div>
  );

  // Inline table edit input
  const TblInput = ({ value, onChange }) => (
    <input type="number" value={value ?? ""} onChange={onChange}
      style={{ width: 60, background: SURF2, border: `1px solid ${BD_HI}`, borderRadius: 5,
        padding: "3px 6px", textAlign: "right", fontSize: 12, color: TX, fontFamily: "monospace" }} />
  );

  // ─── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === P.SETUP) return (
    <Shell maxW="720px">
      <PageHead title="New Session" sub="Configure variables, then fire and analyze" />

      <CardSection title="Configuration" style={{ marginBottom: 16 }}>
        <div className="grid grid-cols-2 gap-4">
          {vars.map(vr => (
            <SmartSelect key={vr.key} label={vr.label} value={cfg[vr.key] || ""} onChange={v => up(vr.key, v)} options={opts[vr.key] || []} onAddOption={v => addOption(vr.key, v)} />
          ))}
          <div className="flex flex-col">
            <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Shot Count</label>
            <input type="number" min="1" value={cfg.shotCount} onChange={e => up("shotCount", e.target.value)} className={inp} />
          </div>
        </div>
      </CardSection>

      <CardSection title="Session Details" style={{ marginBottom: 16 }}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Session Name</label>
            <input value={cfg.sessionName} onChange={e => up("sessionName", e.target.value)} placeholder="Auto-generated if blank" className={inp} />
          </div>
          <div className="flex flex-col">
            <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Date</label>
            <input type="date" value={cfg.date} onChange={e => up("date", e.target.value)} className={inp} />
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Notes</label>
          <input value={cfg.notes} onChange={e => up("notes", e.target.value)} placeholder="Optional" className={inp} />
        </div>
      </CardSection>

      {cfg.rifleRate && (
        <p style={{ color: TX2, fontSize: 12, marginBottom: 24, padding: "0 2px" }}>
          Serial range: <span style={{ color: G, fontFamily: "monospace" }}>{makeSerial(cfg, 1, existingCount)}</span>
          {" → "}
          <span style={{ color: G, fontFamily: "monospace" }}>{makeSerial(cfg, total || 1, existingCount)}</span>
        </p>
      )}

      <Btn onClick={() => { setPhase(P.FIRE); setTimeout(() => fpsRef.current?.focus(), 100); }}
        disabled={!cfg.rifleRate || !cfg.sleeveType || !total} cls="w-full py-3 text-base">
        Begin Firing Session
      </Btn>

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BD}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <Btn v="secondary" onClick={() => fileRef.current?.click()}>Import JSON</Btn>
        {log.length > 0 && (<>
          <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
          <Btn v="secondary" onClick={() => exportJson(log)}>Export JSON</Btn>
        </>)}
      </div>
    </Shell>
  );

  // ─── VARS ───────────────────────────────────────────────────────────────────
  if (phase === P.VARS) return (
    <Shell maxW="640px">
      <PageHead title="Variables" sub="Manage session configuration variables" />
      <CardSection title="Current Variables" style={{ marginBottom: 16 }}>
        <div className="space-y-2">
          {vars.map(v => (
            <div key={v.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: SURF2, border: `1px solid ${BD}`, borderRadius: 8, padding: "10px 14px" }}>
              <div>
                <span style={{ color: TX, fontSize: 14, fontWeight: 500 }}>{v.label}</span>
                {v.core && <span style={{ color: TX2, fontSize: 11, marginLeft: 8 }}>default</span>}
              </div>
              {!v.core && (
                <button onClick={() => removeVar(v.key)} style={{ color: "#f87171", fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </CardSection>
      <CardSection title="Add Variable">
        <div className="flex gap-3 items-end">
          <div className="flex-1 flex flex-col">
            <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Name</label>
            <input value={newVarName} onChange={e => setNewVarName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addVar(); }} placeholder="e.g. Barrel Length" className={inp} />
          </div>
          <Btn onClick={addVar} disabled={!newVarName.trim()}>Add</Btn>
        </div>
      </CardSection>
    </Shell>
  );

  // ─── FIRE ───────────────────────────────────────────────────────────────────
  if (phase === P.FIRE) return (
    <Shell maxW="1040px">
      {/* Session header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 24 }}>
        <div>
          <h1 style={{ color: TX, fontSize: 18, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {cfg.sessionName || [cfg.rifleRate, cfg.sleeveType].filter(Boolean).join(" · ")}
          </h1>
          <p style={{ color: TX2, fontSize: 12, margin: 0 }}>
            {[cfg.tailType, cfg.combustionChamber, cfg.load22].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
            <span style={{ color: G }}>{shots.length}</span>
            <span style={{ color: TX2, fontSize: 18, fontWeight: 400 }}> / {total}</span>
          </div>
          <div style={{ color: TX2, fontSize: 11, marginTop: 5, fontFamily: "monospace" }}>
            Next: {makeSerial(cfg, shots.length + 1, existingCount)}
          </div>
        </div>
      </div>

      {/* Shot entry */}
      <div style={{ ...card, padding: 24, borderColor: `${G}22`, marginBottom: 20 }} onKeyDown={handleKey}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ color: TX, fontSize: 14, fontWeight: 600 }}>Shot #{shots.length + 1}</span>
          <span style={{ color: TX2, fontSize: 12 }}>— press Enter to record</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[["FPS *", "fps", "188"], ["X (in) *", "x", "−2"], ["Y (in) *", "y", "−8"], ["Weight (g)", "weight", "117.5"]].map(([lb, k, ph], i) => (
            <div key={k} className="flex flex-col">
              <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{lb}</label>
              <input ref={i === 0 ? fpsRef : null} type="number" step={k === "weight" ? "0.01" : "0.5"} value={cur[k]} onChange={e => setCur(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} className={inp} autoFocus={i === 0} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={addShot} disabled={!cur.fps || cur.x === "" || cur.y === "" || shots.length >= total}>Record</Btn>
          <Btn v="secondary" onClick={finishSession} disabled={shots.length < 2}>Finish Session</Btn>
          <Btn v="danger" onClick={() => { if (confirm("Abort this session?")) newSession(); }}>Abort</Btn>
        </div>
      </div>

      {/* Live charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CardSection title="Live Dispersion">
          {validShots.length
            ? <DispersionChart shots={validShots} stats={stats} size={350} />
            : <Empty>Waiting for shots…</Empty>}
        </CardSection>
        <CardSection title="Running Stats">
          {validShots.length >= 2
            ? <div className="grid grid-cols-2 gap-2">
                {[["CEP", stats.cep.toFixed(2), 1], ["R90", stats.r90.toFixed(2)], ["SD X", stats.sdX.toFixed(2)], ["SD Y", stats.sdY.toFixed(2)], ["Mean FPS", stats.meanV.toFixed(1), 1], ["SD FPS", stats.sdV.toFixed(1)], ["ES FPS", stats.esV.toFixed(1)], ["MPI", `${stats.mpiX.toFixed(1)}, ${stats.mpiY.toFixed(1)}`]].map(([k, v, g]) => <SB key={k} label={k} value={v} gold={g} />)}
              </div>
            : <Empty>Need 2+ shots</Empty>}
        </CardSection>

        {/* Shot log */}
        <div style={{ ...card, padding: 24 }} className="lg:col-span-2">
          <SecLabel>Shot Log</SecLabel>
          {shots.length
            ? <div className="overflow-auto max-h-52">
                <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BD}` }}>
                      {["#","Serial","FPS","X","Y","Rad","Time",""].map(h => (
                        <th key={h} style={{ color: TX2, fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em", padding: "6px 8px", textAlign: ["FPS","X","Y","Rad"].includes(h) ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shots.map((s, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${BD}` }}>
                        {editIdx === i ? (
                          <>
                            <td style={{ color: TX2, padding: "6px 8px" }}>{s.shotNum}</td>
                            <td style={{ color: TX2, padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{s.serial}</td>
                            {["fps","x","y"].map(k => (
                              <td key={k} style={{ padding: "4px 6px" }}>
                                <TblInput value={editVal[k]} onChange={e => setEditVal(p => ({ ...p, [k]: e.target.value }))} />
                              </td>
                            ))}
                            <td /><td />
                            <td style={{ padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <button onClick={saveEdit} style={{ color: G, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>Save</button>
                              <button onClick={() => setEditIdx(null)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ color: TX2, padding: "6px 8px" }}>{s.shotNum}</td>
                            <td style={{ color: TX2, padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{s.serial}</td>
                            <td style={{ color: TX, padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{s.fps}</td>
                            <td style={{ color: TX, padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{s.x}</td>
                            <td style={{ color: TX, padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{s.y}</td>
                            <td style={{ color: TX2, padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>{rad(s.x, s.y).toFixed(1)}</td>
                            <td style={{ color: TX2, padding: "6px 8px" }}>{s.timestamp}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <button onClick={() => startEdit(i)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>Edit</button>
                              <button onClick={() => delShot(i)} style={{ color: "#f87171", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Del</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <Empty>No shots recorded yet</Empty>}
        </div>
      </div>
    </Shell>
  );

  // ─── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === P.RESULTS && viewed) {
    const s = viewed;
    const vs = s.shots.filter(sh => !isNaN(sh.fps) && !isNaN(sh.x) && !isNaN(sh.y));
    const st = s.stats;
    const cfgLine = vars.map(v => s.config[v.key]).filter(Boolean).join("  ·  ");
    return (
      <Shell maxW="1100px">
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
          <div className="flex gap-2 flex-wrap">
            <Btn v={showPanel ? "primary" : "secondary"} onClick={() => setShowPanel(p => !p)}>
              {showPanel ? "Close" : "Customize"}
            </Btn>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn v="secondary" onClick={() => openEditSession(s.id)}>Edit</Btn>
            <Btn v="secondary" onClick={() => continueSession(s.id)}>+ Shots</Btn>
            {log.length >= 2 && (
              <Btn v="secondary" onClick={() => { setCmpSlots([{ id: s.id, color: PALETTE[0] }, { id: log.find(x => x.id !== s.id)?.id, color: PALETTE[1] }]); setPhase(P.CMP); }}>Compare</Btn>
            )}
            <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
          </div>
        </div>

        {/* Customize panel */}
        {showPanel && (
          <div style={{ ...card, padding: 20, borderColor: `${G}22`, marginBottom: 20 }}>
            <div className="flex flex-wrap gap-6">
              <div>
                <SecLabel>Widgets</SecLabel>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(WIDGETS).map(k => (
                    <div key={k} className="flex items-center gap-1">
                      <Toggle label={WIDGETS[k].label} on={layout.includes(k)} onToggle={() => toggleWidget(k)} />
                      {layout.includes(k) && (
                        <>
                          <button onClick={() => moveWidget(k, -1)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>↑</button>
                          <button onClick={() => moveWidget(k, 1)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>↓</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SecLabel>Dispersion Overlays</SecLabel>
                <div className="flex flex-wrap gap-2">
                  {[["showCep","CEP"],["showR90","R90"],["showEllipse","Ellipse"],["showMpi","MPI"],["showGrid","Grid"]].map(([k, l]) => (
                    <Toggle key={k} label={l} on={dispOpts[k]} onToggle={() => toggleDisp(k)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results card */}
        <div style={{ ...card, overflow: "hidden" }}>
          {/* Session header */}
          <div style={{ background: G, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ color: "#000", fontSize: 18, fontWeight: 700, margin: "0 0 3px", letterSpacing: "-0.01em" }}>{s.config.sessionName || "Session"}</h1>
              <p style={{ color: "rgba(0,0,0,0.5)", fontSize: 12, margin: 0, fontWeight: 500 }}>{cfgLine}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.config.date}</div>
              <div style={{ color: "#000", fontSize: 15, fontWeight: 700, marginTop: 2 }}>{vs.length} shots</div>
            </div>
          </div>

          {/* Widget grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {layout.map((key, idx) => {
              const wg = WIDGETS[key]; if (!wg) return null;
              const fullWidth = key === "calculations" || key === "shotTable";
              return (
                <div key={key} className={`p-5 ${fullWidth ? "lg:col-span-2" : ""}`}
                  style={{ borderBottom: `1px solid ${BD}`, borderRight: (!fullWidth && idx % 2 === 0) ? `1px solid ${BD}` : "" }}>
                  <SecLabel>{wg.label}</SecLabel>
                  {wg.render(s, vs, st, dispOpts)}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ background: SURF2, borderTop: `1px solid ${BD}`, padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: TX2, fontSize: 11 }}>SP1-03 Projectile Test Program</span>
            <span style={{ color: TX2, fontSize: 11, fontFamily: "monospace" }}>{s.shots[0]?.serial} → {s.shots[s.shots.length - 1]?.serial}</span>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── EDIT ────────────────────────────────────────────────────────────────────
  if (phase === P.EDIT) {
    const esValid = esShots.filter(s => !isNaN(s.fps) && !isNaN(s.x) && !isNaN(s.y));
    return (
      <Shell maxW="960px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <PageHead title="Edit Session" />
          <div className="flex gap-2">
            <Btn onClick={saveEditSession}>Save Changes</Btn>
            <Btn v="secondary" onClick={() => setPhase(P.HISTORY)}>Cancel</Btn>
          </div>
        </div>

        <CardSection title="Configuration" style={{ marginBottom: 16 }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {vars.map(vr => (
              <SmartSelect key={vr.key} label={vr.label} value={esCfg[vr.key] || ""} onChange={v => setEsCfg(p => ({ ...p, [vr.key]: v }))} options={opts[vr.key] || []} onAddOption={v => addOption(vr.key, v)} />
            ))}
            {[["Session Name","sessionName","text"],["Date","date","date"],["Notes","notes","text"]].map(([lb,k,t]) => (
              <div key={k} className="flex flex-col">
                <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{lb}</label>
                <input type={t} value={esCfg[k] || ""} onChange={e => setEsCfg(p => ({ ...p, [k]: e.target.value }))} className={inp} />
              </div>
            ))}
          </div>
        </CardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <CardSection title="Preview">
            {esValid.length >= 2
              ? <DispersionChart shots={esValid} stats={esStats} size={320} />
              : <Empty>Need 2+ shots</Empty>}
          </CardSection>
          <CardSection title={`Stats (${esValid.length} shots)`}>
            {esValid.length >= 2
              ? <div className="grid grid-cols-2 gap-2">
                  {[["CEP", esStats.cep.toFixed(2), 1],["R90",esStats.r90.toFixed(2)],["SD X",esStats.sdX.toFixed(2)],["SD Y",esStats.sdY.toFixed(2)],["Mean FPS",esStats.meanV.toFixed(1),1],["SD FPS",esStats.sdV.toFixed(1)]].map(([k,v,g]) => <SB key={k} label={k} value={v} gold={g} />)}
                </div>
              : <Empty>Need 2+ shots</Empty>}
          </CardSection>
        </div>

        <CardSection title={`Shots (${esShots.length})`} style={{ marginBottom: 16 }}>
          <div className="overflow-auto max-h-64">
            <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BD}` }}>
                  {["#","Serial","FPS","X","Y","Wt",""].map(h => (
                    <th key={h} style={{ color: TX2, fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em", padding: "6px 8px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esShots.map((ss, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BD}` }}>
                    {esShotEdit === i ? (
                      <>
                        <td style={{ color: TX2, padding: "6px 8px" }}>{ss.shotNum}</td>
                        <td style={{ color: TX2, padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{ss.serial}</td>
                        {["fps","x","y","weight"].map(k => (
                          <td key={k} style={{ padding: "4px 6px" }}>
                            <TblInput value={esShotEditVal[k]} onChange={e => setEsShotEditVal(p => ({ ...p, [k]: e.target.value }))} />
                          </td>
                        ))}
                        <td style={{ padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={esSaveEdit} style={{ color: G, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>Save</button>
                          <button onClick={() => setEsShotEdit(null)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ color: TX2, padding: "6px 8px" }}>{ss.shotNum}</td>
                        <td style={{ color: TX2, padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{ss.serial}</td>
                        <td style={{ color: TX, padding: "6px 8px", fontFamily: "monospace" }}>{ss.fps}</td>
                        <td style={{ color: TX, padding: "6px 8px", fontFamily: "monospace" }}>{ss.x}</td>
                        <td style={{ color: TX, padding: "6px 8px", fontFamily: "monospace" }}>{ss.y}</td>
                        <td style={{ color: TX2, padding: "6px 8px", fontFamily: "monospace" }}>{ss.weight || "—"}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => esStartEdit(i)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>Edit</button>
                          <button onClick={() => esDelShot(i)} style={{ color: "#f87171", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Del</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardSection>

        <CardSection title="Add Shot" style={{ borderColor: `${G}22` }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[["FPS","fps"],["X (in)","x"],["Y (in)","y"],["Weight","weight"]].map(([lb, k]) => (
              <div key={k} className="flex flex-col">
                <label style={{ color: TX2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>{lb}</label>
                <input type="number" step={k === "weight" ? "0.01" : "0.5"} value={esNewShot[k]} onChange={e => setEsNewShot(p => ({ ...p, [k]: e.target.value }))} className={inp} />
              </div>
            ))}
          </div>
          <Btn onClick={esAddShot} disabled={!esNewShot.fps || esNewShot.x === "" || esNewShot.y === ""}>Add Shot</Btn>
        </CardSection>
      </Shell>
    );
  }

  // ─── COMPARE ─────────────────────────────────────────────────────────────────
  if (phase === P.CMP) {
    const resolved = cmpSlots.map(sl => {
      const s = log.find(x => x.id === sl.id); if (!s) return null;
      const vs = s.shots.filter(sh => !isNaN(sh.fps) && !isNaN(sh.x) && !isNaN(sh.y));
      return { ...sl, session: s, shots: vs, stats: s.stats };
    }).filter(Boolean);
    const activeMetrics = ALL_METRICS.filter(m => cmpMetrics.includes(m[0]));
    const CMP_WIDGET_DEFS = { overlay: { label: "Dispersion Overlay" }, metrics: { label: "Metrics Table" }, velCompare: { label: "Velocity Comparison" } };

    return (
      <Shell maxW="1100px">
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
          <Btn v={cmpShowPanel ? "primary" : "secondary"} onClick={() => setCmpShowPanel(p => !p)}>
            {cmpShowPanel ? "Close" : "Customize"}
          </Btn>
          <Btn onClick={newSession}>+ New Session</Btn>
        </div>

        {/* Customize panel */}
        {cmpShowPanel && (
          <div style={{ ...card, padding: 20, borderColor: `${G}22`, marginBottom: 20 }}>
            <div style={{ marginBottom: 18 }}>
              <SecLabel>Comparison Title</SecLabel>
              <input value={cmpTitle} onChange={e => setCmpTitle(e.target.value)} placeholder="e.g. Short vs Long Comparison" className={inp} style={{ maxWidth: 420 }} />
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <SecLabel>Widgets</SecLabel>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(CMP_WIDGET_DEFS).map(k => (
                    <div key={k} className="flex items-center gap-1">
                      <Toggle label={CMP_WIDGET_DEFS[k].label} on={cmpWidgets.includes(k)} onToggle={() => toggleCmpWidget(k)} />
                      {cmpWidgets.includes(k) && (
                        <>
                          <button onClick={() => moveCmpWidget(k, -1)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>↑</button>
                          <button onClick={() => moveCmpWidget(k, 1)} style={{ color: TX2, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>↓</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SecLabel>Overlays</SecLabel>
                <div className="flex flex-wrap gap-2">
                  {[["showCep","CEP"],["showR90","R90"],["showEllipse","Ellipse"],["showMpi","MPI"]].map(([k, l]) => (
                    <Toggle key={k} label={l} on={cmpDispOpts[k]} onToggle={() => setCmpDispOpts(p => ({ ...p, [k]: !p[k] }))} />
                  ))}
                </div>
              </div>
              <div>
                <SecLabel>Metrics</SecLabel>
                <div className="flex flex-wrap gap-2">
                  {ALL_METRICS.map(([label]) => (
                    <Toggle key={label} label={label} on={cmpMetrics.includes(label)} onToggle={() => toggleCmpMetric(label)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main compare card */}
        <div style={{ ...card, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ background: G, padding: "16px 24px", textAlign: "center" }}>
            <h1 style={{ color: "#000", fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {cmpTitle || "Session Comparison"}
            </h1>
            {cmpTitle && <p style={{ color: "rgba(0,0,0,0.45)", fontSize: 11, margin: "3px 0 0", fontWeight: 500 }}>{resolved.length} sessions</p>}
          </div>

          {/* Session slots */}
          <div style={{ background: SURF2, borderBottom: `1px solid ${BD}`, padding: "16px 24px" }}>
            <div className="space-y-3">
              {cmpSlots.map((sl, idx) => (
                <div key={idx} className="flex items-center gap-3 flex-wrap">
                  <div style={{ width: 12, height: 12, borderRadius: 6, background: sl.color, flexShrink: 0 }} />
                  <select value={sl.id || ""} onChange={e => { const nid = parseInt(e.target.value) || null; setCmpSlots(p => p.map((s, i) => i === idx ? { ...s, id: nid } : s)); }} className={inp} style={{ maxWidth: 320 }}>
                    <option value="">— select session —</option>
                    {log.map(ss => <option key={ss.id} value={ss.id}>{ss.config.sessionName || "Session"} ({ss.config.date})</option>)}
                  </select>
                  <ColorPicker color={sl.color} onChange={c => setCmpSlots(p => p.map((s, i) => i === idx ? { ...s, color: c } : s))} />
                  {cmpSlots.length > 2 && (
                    <button onClick={() => setCmpSlots(p => p.filter((_, i) => i !== idx))} style={{ color: "#f87171", fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setCmpSlots(p => [...p, { id: null, color: PALETTE[p.length % PALETTE.length] }])}
              style={{ color: G, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", marginTop: 12, padding: 0 }}>+ Add Session</button>
          </div>

          {resolved.length >= 2 ? (
            <>
              {cmpWidgets.map(key => {
                if (key === "overlay") return (
                  <div key={key} style={{ padding: "24px", borderBottom: `1px solid ${BD}` }}>
                    <SecLabel>Dispersion Overlay — {resolved.length} sessions</SecLabel>
                    <div className="flex justify-center">
                      <DispersionMulti sessions={resolved.map(r => ({ shots: r.shots, stats: r.stats, color: r.color }))} size={Math.min(440, 400 + resolved.length * 10)} opts={cmpDispOpts} />
                    </div>
                    <div className="flex justify-center gap-5 mt-3 flex-wrap">
                      {resolved.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div style={{ width: 10, height: 10, borderRadius: 5, background: r.color }} />
                          <span style={{ color: TX, fontSize: 12, fontWeight: 500 }}>{r.session.config.sessionName}</span>
                          <span style={{ color: TX2, fontSize: 11 }}>({r.stats.n})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                if (key === "metrics" && activeMetrics.length) return (
                  <div key={key} style={{ padding: "24px", borderBottom: `1px solid ${BD}` }}>
                    <SecLabel>Metrics Comparison</SecLabel>
                    <div className="overflow-auto">
                      <table className="w-full" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${BD}` }}>
                            <th style={{ color: TX2, textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Metric</th>
                            {resolved.map((r, i) => (
                              <th key={i} style={{ color: r.color, textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.session.config.sessionName}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeMetrics.map(([label, key2, dec]) => {
                            const vals = resolved.map(r => r.stats[key2]);
                            const isLb = LOWER_BETTER.includes(label);
                            const best = isLb ? Math.min(...vals) : Math.max(...vals);
                            return (
                              <tr key={label} style={{ borderBottom: `1px solid ${BD}` }}>
                                <td style={{ color: TX, padding: "9px 10px", fontSize: 13 }}>{label}</td>
                                {resolved.map((r, i) => {
                                  const v = r.stats[key2];
                                  const isBest = v === best && vals.filter(x => x === best).length === 1;
                                  return <td key={i} style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: isBest ? r.color : TX }}>{v.toFixed(dec)}{isBest ? " ✦" : ""}</td>;
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
                if (key === "velCompare") return (
                  <div key={key} style={{ padding: "24px", borderBottom: `1px solid ${BD}` }}>
                    <SecLabel>Velocity Comparison</SecLabel>
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
                      {resolved.map((r, i) => (
                        <div key={i}>
                          <div style={{ color: r.color, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{r.session.config.sessionName}</div>
                          <VelHist shots={r.shots} width={280} color={r.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
                return null;
              })}
              <div style={{ background: SURF2, borderTop: `1px solid ${BD}`, padding: "10px 24px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: TX2, fontSize: 11 }}>✦ best in category</span>
                <span style={{ color: TX2, fontSize: 11 }}>SP1-03 Test Program</span>
              </div>
            </>
          ) : (
            <Empty>Select at least 2 sessions to compare</Empty>
          )}
        </div>
      </Shell>
    );
  }

  // ─── HISTORY ─────────────────────────────────────────────────────────────────
  if (phase === P.HISTORY) return (
    <Shell maxW="840px">
      <PageHead title="Session History" sub={`${log.length} session${log.length !== 1 ? "s" : ""} recorded`} />
      {!log.length ? <Empty>No sessions yet. Start one from Setup.</Empty> : (
        <div className="space-y-3">
          {[...log].reverse().map(s => (
            <div key={s.id} style={{ ...card, padding: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TX, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{s.config.sessionName || "Session"}</div>
                <div style={{ color: TX2, fontSize: 12, marginBottom: 3 }}>{vars.map(v => s.config[v.key]).filter(Boolean).join(" · ")}</div>
                <div style={{ color: TX2, fontSize: 11 }}>{s.config.date} · {s.stats.n} shots</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  CEP <span style={{ color: G, fontWeight: 600, fontFamily: "monospace" }}>{s.stats.cep.toFixed(2)}</span>
                  <span style={{ color: BD_HI }}> · </span>
                  SD <span style={{ color: TX, fontWeight: 600, fontFamily: "monospace" }}>{s.stats.sdV.toFixed(1)}</span>
                </div>
                <div className="flex gap-3 justify-end flex-wrap">
                  <button onClick={() => { setViewId(s.id); setPhase(P.RESULTS); }} style={{ color: G, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View</button>
                  <button onClick={() => openEditSession(s.id)} style={{ color: TX2, fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Edit</button>
                  <button onClick={() => continueSession(s.id)} style={{ color: TX2, fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>+ Shots</button>
                  <button onClick={() => { setCmpSlots([{ id: s.id, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]); setPhase(P.CMP); }} style={{ color: TX2, fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Compare</button>
                  <button onClick={() => { if (confirm("Delete this session?")) delSession(s.id); }} style={{ color: "#f87171", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BD}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <Btn v="secondary" onClick={() => fileRef.current?.click()}>Import JSON</Btn>
        {log.length > 0 && (<>
          <Btn v="secondary" onClick={() => exportMasterCsv(log, vars)}>Export CSV</Btn>
          <Btn v="secondary" onClick={() => exportJson(log)}>Export JSON</Btn>
        </>)}
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <Btn onClick={newSession}>Start New Session</Btn>
      </div>
    </Shell>
  );
}
