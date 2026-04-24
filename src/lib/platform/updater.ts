import * as tauriImpl from "./updater.tauri";
import * as webImpl from "./updater.web";

const impl = __IS_WEB__ ? webImpl : tauriImpl;

export const check = impl.check;
export const relaunch = impl.relaunch;
export const getVersion = impl.getVersion;
