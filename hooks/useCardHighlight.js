"use client";

import { useEffect, useState } from "react";

/**
 * Scrolls the card with DOM id `card-${highlightId}` into view and briefly
 * flashes it, once its data is `ready`. Returns the id currently flashing so
 * callers can apply a temporary ring to the matching card.
 */
export function useCardHighlight(highlightId, ready = true) {
  const [flashId, setFlashId] = useState(null);

  useEffect(() => {
    if (!highlightId || !ready) return;
    const el = document.getElementById(`card-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(highlightId);
    const t = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId, ready]);

  return flashId;
}
