// A lightweight re-render tick every `intervalMs`, so a relative-time string
// (e.g. "última sincronização há 3 min") keeps advancing on screen without
// requiring any user action. Intentionally dumb: it only returns a timestamp
// for the caller to diff against — it holds no business/domain logic of its
// own, and nothing here reads or writes any persisted state.
import { useEffect, useState } from "react";

export function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
