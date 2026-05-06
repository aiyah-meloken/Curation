export async function invoke<T = unknown>(command: string): Promise<T> {
  throw new Error(`Tauri command "${command}" is not available in the web build`);
}

