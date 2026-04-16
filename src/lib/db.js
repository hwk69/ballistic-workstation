import { supabase } from './supabase.js';

// Helper: coerce value to a number or null (Postgres double precision columns reject "")
const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();
  return data || { opts: null, vars: null, layout: null, fields: null, custom_presets: null };
}

export async function saveSettings(patch) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, ...patch }, { onConflict: 'id' });
  if (error) throw error;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Returns sessions in the same shape App.jsx expects:
// { id, date, config, shots: [{ id, fps, x, y, weight, serial, shotNum, timestamp }] }
// App.jsx adds stats via calcStats(session.shots)
export async function getSessions() {
  const [{ data: sessions, error: se }, { data: shots, error: she }] = await Promise.all([
    supabase.from('sessions').select('*').order('created_at', { ascending: false }),
    supabase.from('shots').select('*'),
  ]);
  if (se) throw se;
  if (she) throw she;

  return (sessions || []).map(s => ({
    id: s.id,
    date: s.created_at,
    config: s.config,
    shots: (shots || [])
      .filter(sh => sh.session_id === s.id)
      .sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0))
      .map(sh => ({
        id: sh.id,
        fps: sh.fps,
        x: sh.x,
        y: sh.y,
        weight: sh.weight,
        serial: sh.serial,
        shotNum: sh.shot_num,
        timestamp: sh.timestamp,
        data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
      })),
  }));
}

// Inserts a new session + its shots. Returns the saved session in App.jsx shape.
export async function saveSession({ config, shots: shotData }) {
  const { data: session, error: se } = await supabase
    .from('sessions')
    .insert({ name: config.sessionName || '', config })
    .select()
    .single();
  if (se) throw se;

  const shotsToInsert = shotData.map(sh => ({
    session_id: session.id,
    serial: sh.serial,
    x: toNum(sh.x),
    y: toNum(sh.y),
    fps: toNum(sh.fps),
    weight: toNum(sh.weight),
    shot_num: sh.shotNum,
    timestamp: sh.timestamp,
    data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
  }));

  const { data: savedShots, error: she } = await supabase
    .from('shots')
    .insert(shotsToInsert)
    .select();
  if (she) throw she;

  return {
    id: session.id,
    date: session.created_at,
    config: session.config,
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
      data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
    })),
  };
}

// Updates session config + replaces all shots (delete old, insert new).
export async function updateSession(id, { config, shots: shotData }) {
  const { error: ue } = await supabase
    .from('sessions')
    .update({ name: config.sessionName || '', config })
    .eq('id', id);
  if (ue) throw ue;

  // Preserve existing shot IDs so attachment foreign keys stay valid.
  // Shots that already have an id are updated in place; new shots are inserted;
  // shots removed from the list are deleted.
  const existing = shotData.filter(sh => sh.id);
  const toInsert = shotData.filter(sh => !sh.id);

  // Fetch current shot ids to find any that were deleted
  const { data: currentShots } = await supabase.from('shots').select('id').eq('session_id', id);
  const existingIds = new Set(existing.map(sh => sh.id));
  const toDelete = (currentShots || []).map(sh => sh.id).filter(sid => !existingIds.has(sid));

  if (toDelete.length) {
    const { error: de } = await supabase.from('shots').delete().in('id', toDelete);
    if (de) throw de;
  }

  const updateResults = await Promise.all(existing.map(sh =>
    supabase.from('shots')
      .update({ serial: sh.serial, x: toNum(sh.x), y: toNum(sh.y), fps: toNum(sh.fps), weight: toNum(sh.weight), shot_num: sh.shotNum, timestamp: sh.timestamp, data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight } })
      .eq('id', sh.id)
      .select()
      .single()
  ));
  for (const r of updateResults) if (r.error) throw r.error;

  let insertedShots = [];
  if (toInsert.length) {
    const { data: ins, error: she } = await supabase
      .from('shots')
      .insert(toInsert.map(sh => ({
        session_id: id,
        serial: sh.serial,
        x: toNum(sh.x), y: toNum(sh.y), fps: toNum(sh.fps), weight: toNum(sh.weight),
        shot_num: sh.shotNum, timestamp: sh.timestamp,
        data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
      })))
      .select();
    if (she) throw she;
    insertedShots = ins || [];
  }

  const updatedShots = [
    ...updateResults.map(r => r.data),
    ...insertedShots,
  ].sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0));

  const { data: session, error: se } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (se) throw se;

  return {
    id: session.id,
    date: session.created_at,
    config: session.config,
    shots: updatedShots.map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
      data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
    })),
  };
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Comparisons ──────────────────────────────────────────────────────────────
export async function getComparisons() {
  const { data, error } = await supabase
    .from('comparisons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    name: c.title || 'Comparison',
    title: c.title,
    ...(c.data || {}),
  }));
}

export async function saveComparison({ title, slots, filters, by, metrics, widgets }) {
  const { data, error } = await supabase
    .from('comparisons')
    .insert({ title, data: { slots, filters, by, metrics, widgets } })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: title || 'Comparison', title, slots, filters, by, metrics, widgets };
}

export async function deleteComparison(id) {
  const { error } = await supabase.from('comparisons').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sharing ─────────────────────────────────────────────────────────────────
export async function generateShareToken(comparisonId) {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('comparisons')
    .update({ share_token: token })
    .eq('id', comparisonId)
    .select('share_token')
    .single();
  if (error) throw error;
  return data.share_token;
}

export async function getSharedData(token) {
  const { data, error } = await supabase.rpc('get_shared_data', { token });
  if (error) throw error;
  return data;
}

// ─── Attachments (Phase 2) ────────────────────────────────────────────────────
export async function uploadAttachment(file, shotId, sessionId) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`;
  const storagePath = `${sessionId}/${shotId}/${uniqueName}`;

  const { error: ue } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, { upsert: false });
  if (ue) throw ue;

  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      shot_id: shotId,
      session_id: sessionId,
      storage_path: storagePath,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAttachments(filters = {}) {
  let query = supabase.from('attachments').select('*').order('created_at', { ascending: false });
  if (filters.sessionId)  query = query.eq('session_id', filters.sessionId);
  if (filters.sessionIds) query = query.in('session_id', filters.sessionIds);
  if (filters.shotId)     query = query.eq('shot_id', filters.shotId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteAttachment(id, storagePath) {
  await supabase.storage.from('attachments').remove([storagePath]);
  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) throw error;
}

// Replace an existing attachment with a new file, keeping the same DB record association
export async function replaceAttachment(existingId, existingStoragePath, newFile, shotId, sessionId) {
  // 1. Upload new file
  const ext = newFile.name.includes('.') ? newFile.name.split('.').pop() : '';
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`;
  const newPath = `${sessionId}/${shotId}/${uniqueName}`;

  const { error: ue } = await supabase.storage
    .from('attachments')
    .upload(newPath, newFile, { upsert: false });
  if (ue) throw ue;

  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(newPath);

  // 2. Update DB record with new file info
  const { data, error } = await supabase
    .from('attachments')
    .update({
      storage_path: newPath,
      file_name: newFile.name,
      file_url: urlData.publicUrl,
      file_type: newFile.type,
      file_size: newFile.size,
    })
    .eq('id', existingId)
    .select()
    .single();
  if (error) throw error;

  // 3. Delete old file from storage (best-effort)
  await supabase.storage.from('attachments').remove([existingStoragePath]).catch(() => {});

  return data;
}
