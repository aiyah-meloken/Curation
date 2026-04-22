import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { setAuthToken, setRefreshToken } from "./api";

export interface AppUser {
  id: number;
  authing_sub?: string;
  email: string;
  username: string;
  role: "admin" | "user";
}

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AppUser; accessToken: string; refreshToken: string };

type Action =
  | { type: "LOGIN"; user: AppUser; accessToken: string; refreshToken: string }
  | { type: "LOGOUT" }
  | { type: "LOADED_UNAUTHENTICATED" };

function reducer(_state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "LOGIN":
      return {
        status: "authenticated",
        user: action.user,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
      };
    case "LOGOUT":
      return { status: "unauthenticated" };
    case "LOADED_UNAUTHENTICATED":
      return { status: "unauthenticated" };
  }
}

const SESSION_KEY = "curation_auth";

interface AuthContextValue {
  state: AuthState;
  login: (accessToken: string, refreshToken: string, user: AppUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: "loading" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          accessToken: string;
          refreshToken: string;
          user: AppUser;
        };
        if (parsed.accessToken && parsed.refreshToken && parsed.user) {
          setAuthToken(parsed.accessToken);
          setRefreshToken(parsed.refreshToken);
          dispatch({
            type: "LOGIN",
            user: parsed.user,
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken,
          });
          return;
        }
      }
    } catch {
      // fall through
    }
    dispatch({ type: "LOADED_UNAUTHENTICATED" });
  }, []);

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(SESSION_KEY);
      setAuthToken(null);
      setRefreshToken(null);
      dispatch({ type: "LOGOUT" });
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const login = useCallback(
    (accessToken: string, refreshToken: string, user: AppUser) => {
      setAuthToken(accessToken);
      setRefreshToken(refreshToken);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ accessToken, refreshToken, user }),
      );
      dispatch({ type: "LOGIN", user, accessToken, refreshToken });
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setRefreshToken(null);
    localStorage.removeItem(SESSION_KEY);
    dispatch({ type: "LOGOUT" });
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
