import * as tauriImpl from "./updater.tauri";
import * as webImpl from "./updater.web";
import { isTauriRuntime } from "./env";

const impl = isTauriRuntime() ? tauriImpl : webImpl;

export const check = impl.check;
export const relaunch = impl.relaunch;
export const getVersion = impl.getVersion;
