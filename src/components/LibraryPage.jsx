import { useState, useEffect, useMemo, useRef } from 'react';
import { getAttachments, deleteAttachment, replaceAttachment } from '../lib/db.js';
import { FilterBar } from './FilterBar.jsx';

function fileIconChar(fileType) {
  const kind = (fileType || '').split('/')[0];
  if (kind === 'video') return '▶';
  if (kind === 'application') return '📄';
  return '📎';
}

function LibraryCard({ att, isImage, isVideo, readOnly, onView, onDelete, onReplace }) {
  const replaceRef = useRef();
  return (
    <div onClick={onView}
      className="group relative bg-secondary border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/30 transition-colors">
      <div className="aspect-square flex items-center justify-center bg-card/50">
        {isImage ? (
          <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-3xl">{isVideo ? '▶' : fileIconChar(att.file_type)}</span>
        )}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-2xl">▶</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="export-hide text-[11px] text-foreground truncate font-medium">{att.file_name}</p>
        <p className="export-hide text-[10px] text-muted-foreground">{att.serial} · {new Date(att.created_at).toLocaleDateString()}</p>
      </div>
      {!readOnly && (
        <>
          <button
            onClick={e => { e.stopPropagation(); replaceRef.current?.click(); }}
            className="export-hide absolute top-1.5 left-1.5 h-6 px-2 rounded bg-black/70 text-white text-[10px] font-semibold tracking-wide flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-[#FFDF00] hover:text-black">
            <span aria-hidden>↺</span>
            <span>Replace</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="export-hide absolute top-1.5 right-1.5 h-6 px-2 rounded bg-black/70 text-white text-[10px] font-semibold tracking-wide flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-destructive">
            <span aria-hidden>✕</span>
            <span>Delete</span>
          </button>
          <input
            ref={replaceRef}
            type="file"
            accept="image/*,video/*,.pdf"
            className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={e => { const f = e.target.files?.[0]; if (f) { onReplace(f); e.target.value = ''; } }}
          />
        </>
      )}
    </div>
  );
}

function SessionCard({ session, attCount, previewAtt, onClick }) {
  const cfg = session?.config || {};
  // Build a short chip list from the variable values defined on this session
  const chips = [];
  const varEntries = [
    ['rifleRate', 'RR'],
    ['sleeveType', 'SL'],
    ['tailType', 'TL'],
    ['combustionChamber', 'CC'],
    ['load22', 'L'],
  ];
  for (const [k] of varEntries) {
    if (cfg[k]) chips.push(cfg[k]);
  }
  const isImagePreview = previewAtt?.file_type?.startsWith('image/');
  const isVideoPreview = previewAtt?.file_type?.startsWith('video/');
  return (
    <button
      onClick={onClick}
      className="group text-left bg-secondary border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md transition-all p-0">
      <div className="aspect-video bg-card/60 relative overflow-hidden">
        {previewAtt && isImagePreview && (
          <img src={previewAtt.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
        {previewAtt && isVideoPreview && (
          <>
            <video src={previewAtt.file_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-white text-3xl">▶</span>
            </div>
          </>
        )}
        {!previewAtt && (
          <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground/50">📎</div>
        )}
        <div className="absolute top-2 right-2 rounded-full bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5">
          {attCount} file{attCount === 1 ? '' : 's'}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground truncate mb-0.5">{cfg.sessionName || 'Unnamed Session'}</p>
        <p className="text-[11px] text-muted-foreground mb-1.5">{cfg.date || '—'}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map((c, i) => (
              <span key={i} className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function VideoPlayer({ src, name }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="max-h-[90vh] max-w-[90vw] rounded-lg bg-card border border-border p-8 text-center">
        <p className="text-foreground font-medium mb-2">Video cannot be played in browser</p>
        <p className="text-muted-foreground text-xs mb-4">This file may use an unsupported codec (e.g. HEVC).</p>
        <a href={src} target="_blank" rel="noreferrer" download={name}
          className="text-primary text-sm underline">Download video ↗</a>
      </div>
    );
  }
  return (
    <video controls autoPlay playsInline onError={() => setError(true)}
      className="max-h-[90vh] max-w-[90vw] rounded-lg">
      <source src={src} type="video/mp4" />
    </video>
  );
}

function MediaViewer({ att, onClose }) {
  if (!att) return null;
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');
  return (
    <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer border-none text-lg hover:bg-white/20">✕</button>
      <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
        {isImage && <img src={att.file_url} alt={att.file_name} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />}
        {isVideo && <VideoPlayer src={att.file_url} name={att.file_name} />}
        {!isImage && !isVideo && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-foreground font-medium mb-4">{att.file_name}</p>
            <a href={att.file_url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">Open file ↗</a>
          </div>
        )}
        <p className="text-white/60 text-xs text-center mt-3">{att.session_name} · {att.serial} · {new Date(att.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

// Visual dedupe within a single shot: collapse attachments that have the same
// file_name + file_type, keeping the most recently created one. DB rows remain.
function dedupeAttachments(atts) {
  // Group by shot_id first, then dedupe within each group by (file_name, file_type)
  const byShot = new Map();
  for (const a of atts) {
    const key = a.shot_id || '__noshot__';
    if (!byShot.has(key)) byShot.set(key, []);
    byShot.get(key).push(a);
  }
  const out = [];
  for (const group of byShot.values()) {
    const seen = new Map();
    for (const a of group) {
      const sig = `${(a.file_name || '').toLowerCase()}|${a.file_type || ''}`;
      const prev = seen.get(sig);
      if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
        seen.set(sig, a);
      }
    }
    out.push(...seen.values());
  }
  // Preserve original newest-first ordering
  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function LibraryPage({ log, vars, preFilterSessionIds, onError, readOnly }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [viewer, setViewer] = useState(null);
  const [openSessionId, setOpenSessionId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const atts = await getAttachments(
          preFilterSessionIds ? { sessionIds: preFilterSessionIds } : {}
        );
        const enriched = atts.map(att => {
          const session = log.find(s => s.id === att.session_id);
          const shot = session?.shots?.find(sh => sh.id === att.shot_id);
          return {
            ...att,
            session_name: session?.config?.sessionName || 'Unknown Session',
            session_date: session?.config?.date || '',
            serial: shot?.serial || '—',
            session_config: session?.config || {},
          };
        });
        setAttachments(enriched);
      } catch (err) {
        onError?.('Failed to load library: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [preFilterSessionIds]);

  const handleDelete = async (id, storagePath) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteAttachment(id, storagePath);
      setAttachments(p => p.filter(a => a.id !== id));
    } catch (err) {
      onError?.('Delete failed: ' + err.message);
    }
  };

  const handleReplace = async (att, file) => {
    try {
      const updated = await replaceAttachment(att.id, att.storage_path, file, att.shot_id, att.session_id);
      setAttachments(p => p.map(a => a.id === att.id
        ? { ...updated, session_name: att.session_name, session_date: att.session_date, serial: att.serial, session_config: att.session_config }
        : a
      ));
    } catch (err) {
      onError?.('Replace failed: ' + err.message);
    }
  };

  // Build per-session groupings of attachments (applying search + filters to the session).
  const sessionsWithAtts = useMemo(() => {
    const sessionAttCounts = new Map();
    for (const att of attachments) {
      if (!att.session_id) continue;
      const cur = sessionAttCounts.get(att.session_id) || { atts: [], session: null };
      cur.atts.push(att);
      sessionAttCounts.set(att.session_id, cur);
    }
    const list = [];
    for (const [sessionId, { atts }] of sessionAttCounts) {
      const session = log.find(s => s.id === sessionId);
      if (!session) continue;
      const deduped = dedupeAttachments(atts);
      list.push({ session, atts: deduped });
    }
    // Newest first by session.date
    return list.sort((a, b) => new Date(b.session.date || 0) - new Date(a.session.date || 0));
  }, [attachments, log]);

  // Apply filters to session list (Level 1).
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessionsWithAtts.filter(({ session }) => {
      if (q && !(session.config?.sessionName || '').toLowerCase().includes(q)) return false;
      return Object.entries(filters).every(([k, v]) => !v || session.config?.[k] === v);
    });
  }, [sessionsWithAtts, search, filters]);

  const filterDefs = useMemo(() => {
    return vars.map(v => {
      const vals = [...new Set(sessionsWithAtts.map(({ session }) => session.config?.[v.key]).filter(Boolean))].sort();
      return { key: v.key, label: v.label, options: vals };
    }).filter(def => def.options.length >= 2);
  }, [sessionsWithAtts, vars]);

  const currentSession = openSessionId
    ? sessionsWithAtts.find(s => s.session.id === openSessionId)
    : null;

  // ─── Level 2: single session view ───────────────────────────────────────
  if (currentSession) {
    const { session, atts } = currentSession;
    // Group by shot serial
    const byShot = new Map();
    for (const att of atts) {
      const key = att.serial || '—';
      if (!byShot.has(key)) byShot.set(key, []);
      byShot.get(key).push(att);
    }
    const shotOrder = [...byShot.keys()].sort();

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setOpenSessionId(null)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none inline-flex items-center gap-1">
            ← Back to sessions
          </button>
        </div>
        <div className="mb-5 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground mb-0.5">{session.config?.sessionName || 'Unnamed Session'}</h2>
          <p className="text-xs text-muted-foreground">
            {session.config?.date || '—'} · {atts.length} file{atts.length === 1 ? '' : 's'}
          </p>
        </div>

        {atts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No attachments in this session.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {shotOrder.map(serial => (
              <div key={serial}>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2 border-b border-border pb-1.5">
                  {serial}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {byShot.get(serial).map(att => {
                    const isImage = att.file_type?.startsWith('image/');
                    const isVideo = att.file_type?.startsWith('video/');
                    return (
                      <LibraryCard
                        key={att.id}
                        att={att}
                        isImage={isImage}
                        isVideo={isVideo}
                        readOnly={readOnly}
                        onView={() => setViewer(att)}
                        onDelete={() => handleDelete(att.id, att.storage_path)}
                        onReplace={(file) => handleReplace(att, file)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <MediaViewer att={viewer} onClose={() => setViewer(null)} />
      </div>
    );
  }

  // ─── Level 1: session grid ──────────────────────────────────────────────
  return (
    <div>
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sessions by name…"
        filters={filters}
        onFiltersChange={setFilters}
        filterDefs={filterDefs}
      />

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading attachments…</p>
      ) : sessionsWithAtts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No attachments yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Add files via the Attachments widget on the Results page.</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No sessions match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(({ session, atts }) => {
            const imageAtt = atts.find(a => a.file_type?.startsWith('image/'));
            const previewAtt = imageAtt || atts.find(a => a.file_type?.startsWith('video/')) || atts[0];
            return (
              <SessionCard
                key={session.id}
                session={session}
                attCount={atts.length}
                previewAtt={previewAtt}
                onClick={() => setOpenSessionId(session.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
