/** Minimal toast singleton — call toast(message) from anywhere, <Toast/> renders it. */

type Listener = (message: string) => void;
let listener: Listener | null = null;

export function toast(message: string) {
  listener?.(message);
}

export function subscribeToast(fn: Listener) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
