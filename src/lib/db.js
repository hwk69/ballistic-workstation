import { supabase } from './supabase.js';

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
  return data || { opts: null, vars: null, layout: null };
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
    x: sh.x,
    y: sh.y,
    fps: sh.fps,
    weight: sh.weight,
    shot_num: sh.shotNum,
    timestamp: sh.timestamp,
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

  // Delete old shots (cascade doesn't help here — we need to replace)
  const { error: de } = await supabase.from('shots').delete().eq('session_id', id);
  if (de) throw de;

  const shotsToInsert = shotData.map(sh => ({
    session_id: id,
    serial: sh.serial,
    x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight,
    shot_num: sh.shotNum, timestamp: sh.timestamp,
  }));

  const { data: savedShots, error: she } = await supabase
    .from('shots')
    .insert(shotsToInsert)
    .select();
  if (she) throw she;

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
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
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

// ─── Attachments (Phase 2) ────────────────────────────────────────────────────
export async function uploadAttachment(file, shotId, sessionId) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const uniqueName = `${Date.now()}${ext ? '.' + ext : ''}`;
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
