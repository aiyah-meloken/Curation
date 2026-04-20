import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runSync, openDbFromKeychain, initDbWithLogin, setCacheAuthToken } from "../lib/cache";
import { getWsBase, getAuthToken } from "../lib/api";

export function useInitCache(isLoggedIn: boolean, userId: string | null) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !userId || initialized.current) return;

    async function init() {
      const token = getAuthToken();
      if (!token) return;

      const opened = await openDbFromKeychain().catch(() => false);
      if (opened) {
        await setCacheAuthToken(token);
      } else {
        await initDbWithLogin(token, userId!);
      }
      initialized.current = true;
    }

    init().catch(console.error);
  }, [isLoggedIn, userId]);

  return initialized;
}

export function useSyncManager(isLoggedIn: boolean) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const lastMessageTime = useRef(Date.now());
  const syncInProgress = useRef(false);

  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      const changedKeys = await runSync();
      for (const key of changedKeys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch (e) {
      console.error("[sync] failed:", e);
    } finally {
      syncInProgress.current = false;
    }
  }, [queryClient]);

  // WebSocket connection
  useEffect(() => {
    if (!isLoggedIn) return;
    const token = getAuthToken();
    if (!token) return;

    const wsBase = getWsBase();
    const ws = new WebSocket(`${wsBase}/ws/sync?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      lastMessageTime.current = Date.now();
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "sync_available") {
          triggerSync();
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      // Will reconnect on next effect cycle
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isLoggedIn, triggerSync]);

  // Heartbeat: sync every 5 min if no WS messages
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      if (Date.now() - lastMessageTime.current > 5 * 60 * 1000) {
        triggerSync();
        lastMessageTime.current = Date.now();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [isLoggedIn, triggerSync]);

  // Initial sync on mount
  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(triggerSync, 1000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, triggerSync]);

  return { triggerSync };
}
