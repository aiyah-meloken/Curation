import * as tauriImpl from "./url-opener.tauri";
import * as webImpl from "./url-opener.web";
import { isTauriRuntime } from "./env";

const impl = isTauriRuntime() ? tauriImpl : webImpl;

export const openExternal = impl.openExternal;
