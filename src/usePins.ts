import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'homies.pins';
const listeners = new Set<() => void>();

/* Every card on a grid calls this hook, so the pinned set is one module-level
   value with a subscription rather than per-component state. Pinning on one
   card has to repaint the same product's card on the detail page behind it,
   and useState in each card cannot do that. */
let snapshot: Set<string> = read();

function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function write(next: Set<string>) {
  snapshot = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* private mode; pins stay in memory */ }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function usePins() {
  const pinned = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const toggle = useCallback((id: string) => {
    const next = new Set(snapshot);
    if (!next.delete(id)) next.add(id);
    write(next);
  }, []);
  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);
  return { pinned, isPinned, toggle };
}

// Test-only reset: the module-level `snapshot` above is initialised once at
// import time, so clearing localStorage in a test's beforeEach does not put
// the hook back to empty. Without this, suite correctness would depend on
// test order. Keep it — it is not dead code.
export const __resetPinsForTest = () => write(new Set());
