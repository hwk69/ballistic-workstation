import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadAttachment, getAttachments, deleteAttachment } from '../lib/db.js';

function fileIconChar(fileType) {
  const kind = (fileType || '').split('/')[0];
  if (kind === 'video') return '▶';
  if (kind === 'application') return '📄';
  return '📎';
}

function AttachmentCard({ att, onDelete, onClick }) {
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${att.file_name}?`)) return;
    setDeleting(true);
    await onDelete(att.id, att.storage_path);
  };

  return (
    <div
      onClick={onClick}
      className="relative group size-14 sm:size-16 rounded-md overflow-hidden cursor-pointer border border-border hover:border-primary/30 transition-colors shrink-0">
      {isImage ? (
        <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-secondary">
          <span className="text-lg select-none">{fileIconChar(att.file_type)}</span>
        </div>
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-white text-sm">▶</span>
        </div>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-0.5 right-0.5 size-4 rounded bg-black/60 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-destructive/80">
        ✕
      </button>
    </div>
  );
}

function MediaViewer({ att, onClose }) {
  if (!att) return null;
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer border-none text-lg hover:bg-white/20">
        ✕
      </button>
      <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
        {isImage && <img src={att.file_url} alt={att.file_name} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />}
        {isVideo && <video src={att.file_url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />}
        {!isImage && !isVideo && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-4xl mb-4">{fileIconChar(att.file_type)}</p>
            <p className="text-foreground font-medium mb-4">{att.file_name}</p>
            <a href={att.file_url} target="_blank" rel="noreferrer"
              className="text-primary text-sm underline">Open file ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shot Carousel Lightbox ──────────────────────────────────────────────────
// Opens as a full-screen overlay showing all attachments for one shot
// with left/right navigation, thumbnail strip, and keyboard support.
export function ShotCarousel({ attachments, serial, onClose }) {
  const [idx, setIdx] = useState(0);
  const thumbRef = useRef(null);

  const count = attachments?.length || 0;
  const current = attachments?.[idx];

  // Keyboard navigation
  useEffect(() => {
    if (!count) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(p => (p - 1 + count) % count);
      if (e.key === 'ArrowRight') setIdx(p => (p + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  // Keep active thumbnail in view
  useEffect(() => {
    if (!thumbRef.current) return;
    const active = thumbRef.current.children[idx];
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [idx]);

  if (!count || !current) return null;

  const isImage = current.file_type?.startsWith('image/');
  const isVideo = current.file_type?.startsWith('video/');

  const navBtn = "absolute top-1/2 -translate-y-1/2 z-20 size-10 rounded-full flex items-center justify-center cursor-pointer border-none transition-all duration-200";

  return (
    <div className="fixed inset-0 z-[600] flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/92 backdrop-blur-sm" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] font-bold text-white/90 tracking-wide">{serial}</span>
          <span className="text-[11px] text-white/40 font-medium">{idx + 1} / {count}</span>
        </div>
        <button
          onClick={onClose}
          className="size-8 rounded-full bg-white/8 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center cursor-pointer border-none transition-all duration-200"
          aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Main viewer area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-16 min-h-0" onClick={e => e.stopPropagation()}>
        {/* Left arrow */}
        {count > 1 && (
          <button
            onClick={() => setIdx(p => (p - 1 + count) % count)}
            className={`${navBtn} left-3 bg-white/8 hover:bg-white/15 text-white/60 hover:text-white`}
            aria-label="Previous">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4L6 9l5 5" />
            </svg>
          </button>
        )}

        {/* Media display */}
        <div className="flex items-center justify-center w-full h-full max-h-[calc(100vh-180px)]">
          {isImage && (
            <img
              key={current.id}
              src={current.file_url}
              alt={current.file_name}
              className="max-w-full max-h-full object-contain rounded-lg select-none animate-[fadeScale_200ms_ease-out]"
              draggable={false}
            />
          )}
          {isVideo && (
            <video
              key={current.id}
              src={current.file_url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg"
            />
          )}
          {!isImage && !isVideo && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center max-w-sm">
              <p className="text-4xl mb-3">{fileIconChar(current.file_type)}</p>
              <p className="text-white/80 font-medium text-sm mb-1">{current.file_name}</p>
              <a href={current.file_url} target="_blank" rel="noreferrer"
                className="text-[#FFDF00] text-xs hover:underline">Download ↗</a>
            </div>
          )}
        </div>

        {/* Right arrow */}
        {count > 1 && (
          <button
            onClick={() => setIdx(p => (p + 1) % count)}
            className={`${navBtn} right-3 bg-white/8 hover:bg-white/15 text-white/60 hover:text-white`}
            aria-label="Next">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4l5 5-5 5" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div className="relative z-10 px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
          <div ref={thumbRef} className="flex gap-2 justify-center overflow-x-auto py-1 scrollbar-none">
            {attachments.map((att, i) => {
              const isImg = att.file_type?.startsWith('image/');
              const active = i === idx;
              return (
                <button
                  key={att.id}
                  onClick={() => setIdx(i)}
                  className={`shrink-0 size-12 sm:size-14 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 p-0 bg-transparent ${
                    active
                      ? 'border-[#FFDF00] ring-1 ring-[#FFDF00]/40 scale-105'
                      : 'border-white/10 hover:border-white/30 opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`View ${att.file_name}`}>
                  {isImg ? (
                    <img src={att.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <span className="text-sm select-none">{fileIconChar(att.file_type)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CSS animation for image transitions */}
      <style>{`
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .scrollbar-none { scrollbar-width: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

export function AttachmentWidget({ session, onError }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    if (!session?.id) return;
    getAttachments({ sessionId: session.id })
      .then(setAttachments)
      .catch(err => onError?.('Failed to load attachments: ' + err.message));
  }, [session?.id]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const large = files.find(f => f.size > 500 * 1024 * 1024);
    if (large && !confirm(`${large.name} is over 500MB. Upload anyway?`)) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const shotId = session.shots?.[0]?.id || session.id;
      const saved = await Promise.all(files.map(f => uploadAttachment(f, shotId, session.id)));
      setAttachments(p => [...saved, ...p]);
    } catch (err) {
      onError?.('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id, storagePath) => {
    try {
      await deleteAttachment(id, storagePath);
      setAttachments(p => p.filter(a => a.id !== id));
    } catch (err) {
      onError?.('Delete failed: ' + err.message);
    }
  };

  const grouped = attachments.reduce((acc, att) => {
    const key = att.shot_id || 'session';
    if (!acc[key]) acc[key] = [];
    acc[key].push(att);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading…' : '+ Add Files'}
        </button>
        <span className="text-[11px] text-muted-foreground">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No attachments yet. Add photos or videos of the shots.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {Object.entries(grouped).map(([shotId, atts]) => {
            const shotRef = session.shots?.find(s => s.id === shotId);
            return (
              <div key={shotId} className="flex flex-col items-start">
                <span className="text-[9px] text-muted-foreground font-mono font-bold uppercase tracking-wider mb-1">
                  {shotRef?.serial || 'Files'}
                </span>
                <div className="flex gap-1 overflow-x-auto max-w-[200px] pb-0.5">
                  {atts.map(att => (
                    <AttachmentCard key={att.id} att={att} onDelete={handleDelete} onClick={() => setViewer(att)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MediaViewer att={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
