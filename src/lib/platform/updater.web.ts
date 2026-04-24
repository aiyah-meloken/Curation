// Web stubs for Tauri updater APIs. Callers must gate with __IS_WEB__ or
// <TauriOnly> before invoking; these throw to fail loud on misuse.
export function check(): Promise<null> {
  return Promise.resolve(null);
}

export function relaunch(): Promise<void> {
  window.location.reload();
  return Promise.resolve();
}

export function getVersion(): Promise<string> {
  return Promise.resolve("web");
}
