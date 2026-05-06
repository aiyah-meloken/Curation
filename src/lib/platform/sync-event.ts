import * as tauriImpl from "./sync-event.tauri";
import * as webImpl from "./sync-event.web";
import { isTauriRuntime } from "./env";

const impl = isTauriRuntime() ? tauriImpl : webImpl;

export type { UnlistenFn } from "./sync-event.tauri";
export const listen = impl.listen;
