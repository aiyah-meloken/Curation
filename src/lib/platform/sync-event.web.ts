// Web build has no Tauri event bus; sync push happens over WebSocket (see useSync.ts).
// This is a no-op listener that returns an empty unlisten fn.
export type UnlistenFn = () => void;

export function listen<T = unknown>(
  _event: string,
  _handler: (ev: { payload: T }) => void,
): Promise<UnlistenFn> {
  return Promise.resolve(() => {});
}
