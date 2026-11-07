import { useSyncExternalStore } from "react";

const TICK_MS = 15_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
    listener();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current time on the client; null during server render so markup never mismatches. */
export function useNow(): Date | null {
  const value = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
  return value === null ? null : new Date(value);
}
