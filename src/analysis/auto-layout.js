/**
 * Compute a smart default widget layout based on available fields and session count.
 *
 * Returns an ordered array of { key, span } objects.
 * - span: 'half' (1 grid column) or 'full' (2 grid columns)
 * - Max 5 widgets for single, 5 for multi (including attachments at bottom)
 */
export function autoLayout(allFields, commonFields, sessionCount) {
  const mode = sessionCount <= 1 ? "single" : "multi";
  const fields = mode === "single" ? allFields : commonFields;
  const fieldKeys = new Set(fields.map((f) => f.key));
  const hasXY = fieldKeys.has("x") && fieldKeys.has("y");
  const hasFps = fieldKeys.has("fps");
  const yesnoFields = fields.filter((f) => f.type === "yesno");

  // Default: only shot table. User adds more via "+ Add Widget".
  return [{ key: "shotTable", span: "full" }];
}

/**
 * Compute the union of fields across all sessions.
 */
export function unionFields(resolvedSessions) {
  const seen = new Set();
  const result = [];
  for (const r of resolvedSessions) {
    for (const f of r.fields) {
      if (!seen.has(f.key)) {
        seen.add(f.key);
        result.push(f);
      }
    }
  }
  return result;
}

/**
 * Compute the intersection of fields across all sessions.
 */
export function intersectFields(resolvedSessions) {
  if (!resolvedSessions.length) return [];
  const first = resolvedSessions[0].fields;
  return first.filter((f) =>
    resolvedSessions.every((r) => r.fields.some((rf) => rf.key === f.key))
  );
}

/**
 * Resolve selected session slots against the log.
 * Returns an array of { session, shots, stats, color, fields } objects.
 */
export function resolveSlots(slots, log, globalFields, calcStatsFn) {
  return slots
    .map((sl) => {
      const session = log.find((s) => s.id === sl.id);
      if (!session) return null;
      const fields = session.config?.fields || globalFields;
      const sf = fields;
      const reqNum = sf.filter((f) => f.required && f.type === "number").map((f) => f.key);
      const shots = session.shots.filter((sh) => {
        const d = sh.data || sh;
        return reqNum.every((k) => !(k in d) || (d[k] !== null && d[k] !== undefined && !isNaN(d[k])));
      });
      const stats = calcStatsFn(shots, fields);
      return { session, shots, stats, color: sl.color, fields };
    })
    .filter(Boolean);
}
