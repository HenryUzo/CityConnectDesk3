import type { AppErrorInput } from "@/lib/errorPresentation";

type AppErrorListener = (payload: AppErrorInput | null) => void;

const listeners = new Set<AppErrorListener>();
let currentPayload: AppErrorInput | null = null;

export function showAppError(payload: AppErrorInput) {
  currentPayload = payload;
  listeners.forEach((listener) => listener(currentPayload));
}

export function dismissAppError() {
  currentPayload = null;
  listeners.forEach((listener) => listener(null));
}

export function subscribeToAppError(listener: AppErrorListener) {
  listeners.add(listener);
  listener(currentPayload);

  return () => {
    listeners.delete(listener);
  };
}
