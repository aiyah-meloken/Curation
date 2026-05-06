export type UnlistenFn = () => void;

export function listen<T = unknown>(
  event: string,
  handler: (ev: { payload: T }) => void,
): Promise<UnlistenFn> {
  const listener = (ev: Event) => {
    handler({ payload: (ev as CustomEvent<T>).detail });
  };
  window.addEventListener(event, listener);
  return Promise.resolve(() => window.removeEventListener(event, listener));
}
