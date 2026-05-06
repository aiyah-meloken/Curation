export function isTauriRuntime(): boolean {
  if (__IS_WEB__) return false;
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

