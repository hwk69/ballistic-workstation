import { useState, useCallback } from "react";
import { Link2, Check } from "lucide-react";
import * as db from "../lib/db.js";

export function ShareButton({ comparisonId, existingToken, onTokenGenerated, onError }) {
  const [status, setStatus] = useState(null); // null | "generating" | "copied"

  const handleShare = useCallback(async () => {
    if (!comparisonId) {
      onError?.("Save first before sharing");
      return;
    }
    try {
      setStatus("generating");
      let token = existingToken;
      if (!token) {
        token = await db.generateShareToken(comparisonId);
        onTokenGenerated?.(comparisonId, token);
      }
      const url = `${window.location.origin}${window.location.pathname}?share=${token}`;
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      onError?.("Share failed: " + err.message);
      setStatus(null);
    }
  }, [comparisonId, existingToken, onTokenGenerated, onError]);

  return (
    <button
      onClick={handleShare}
      disabled={status === "generating" || !comparisonId}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-bold cursor-pointer hover:bg-accent/40 transition-colors disabled:opacity-50">
      {status === "copied" ? <Check size={13} className="text-green-600" /> : <Link2 size={13} />}
      {status === "copied" ? "Link Copied!" : status === "generating" ? "Generating..." : "Share"}
    </button>
  );
}
