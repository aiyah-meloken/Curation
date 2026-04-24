import * as tauriImpl from "./sync-event.tauri";
import * as webImpl from "./sync-event.web";

const impl = __IS_WEB__ ? webImpl : tauriImpl;

export type { UnlistenFn } from "./sync-event.tauri";
export const listen = impl.listen;
