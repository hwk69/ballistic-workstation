import { useState, useEffect, useRef } from 'react';
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
        Object.entries(grouped).map(([shotId, atts]) => {
          const shotRef = session.shots?.find(s => s.id === shotId);
          return (
            <div key={shotId} className="flex items-start gap-3 mb-2">
              {shotRef && (
                <span className="text-[10px] text-muted-foreground font-mono font-semibold tracking-wide shrink-0 pt-1 min-w-[60px]">{shotRef.serial}</span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {atts.map(att => (
                  <AttachmentCard key={att.id} att={att} onDelete={handleDelete} onClick={() => setViewer(att)} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <MediaViewer att={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
