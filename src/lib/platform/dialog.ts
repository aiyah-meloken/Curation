import * as tauriImpl from "./dialog.tauri";
import * as webImpl from "./dialog.web";
import { isTauriRuntime } from "./env";

const impl = isTauriRuntime() ? tauriImpl : webImpl;

export const openFolderPicker = impl.openFolderPicker;
