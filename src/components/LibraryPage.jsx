import { useState, useEffect } from 'react';
import { getAttachments, deleteAttachment } from '../lib/db.js';

function fileIconChar(fileType) {
  const kind = (fileType || '').split('/')[0];
  if (kind === 'video') return '▶';
  if (kind === 'application') return '📄';
  return '📎';
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
        {isVideo && <video src={att.file_url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />}
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

export function LibraryPage({ log, vars, preFilterSessionIds, onError }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [viewer, setViewer] = useState(null);

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

  const filtered = attachments.filter(att => {
    return Object.entries(filters).every(([k, v]) => {
      if (!v) return true;
      if (k === 'sessionId') return att.session_id === v;
      return att.session_config?.[k] === v;
    });
  });

  const varFilterOptions = vars.map(v => {
    const vals = [...new Set(attachments.map(a => a.session_config?.[v.key]).filter(Boolean))];
    return { ...v, vals };
  }).filter(v => v.vals.length >= 2);

  return (
    <div>
      {varFilterOptions.length > 0 && (
        <div className="export-hide flex flex-wrap gap-x-5 gap-y-2 mb-6 p-4 bg-card border border-border rounded-xl">
          {varFilterOptions.map(v => (
            <div key={v.key} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{v.label}:</span>
              <button
                onClick={() => setFilters(p => { const n = { ...p }; delete n[v.key]; return n; })}
                className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${!filters[v.key] ? 'bg-primary/15 text-primary border-primary/30 font-semibold' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                All
              </button>
              {v.vals.map(val => (
                <button key={val}
                  onClick={() => setFilters(p => ({ ...p, [v.key]: val }))}
                  className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${filters[v.key] === val ? 'bg-primary/15 text-primary border-primary/30 font-semibold' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                  {val}
                </button>
              ))}
            </div>
          ))}
          {Object.keys(filters).length > 0 && (
            <button onClick={() => setFilters({})} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none ml-auto">Clear filters</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading attachments…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No attachments found.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Add files via the Attachments widget on the Results page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(att => {
            const isImage = att.file_type?.startsWith('image/');
            const isVideo = att.file_type?.startsWith('video/');
            return (
              <div key={att.id} onClick={() => setViewer(att)}
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
                  <p className="text-[10px] text-muted-foreground truncate">{att.session_name}</p>
                  <p className="export-hide text-[10px] text-muted-foreground">{att.serial} · {new Date(att.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(att.id, att.storage_path); }}
                  className="export-hide absolute top-1.5 right-1.5 size-5 rounded bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-destructive/80">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <MediaViewer att={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
