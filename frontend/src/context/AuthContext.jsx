import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setApiAuthToken } from "../lib/api";
import { AUTH_STORAGE_EVENT, clearStoredAuth, getStoredAuth, setStoredAuth } from "../common/authStorage";

const AuthContext = createContext(null);

function normalizeLoginPayload(payload) {
  const user = payload?.user || {};
  const token = payload?.token || "";
  const role = String(payload?.role || user?.role || "").toUpperCase();
  const id = payload?.id || user?.id || user?.employeeId || user?.employee_id;
  const username = payload?.username || user?.username || "";
  const isFirstLogin = Boolean(
    payload?.isFirstLogin ?? user?.isFirstLogin ?? user?.is_first_login
  );

  if (!token || !role || !id) return null;
  return { token, role, id, username, isFirstLogin };
}

function roleHome(role) {
  return role === "ADMIN" ? "/admin/dashboard" : "/employee/dashboard";
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = Boolean(auth?.token);

  const applyAuth = (nextAuth) => {
    setAuth(nextAuth);
    if (nextAuth?.token) {
      setStoredAuth(nextAuth);
      setApiAuthToken(nextAuth.token);
    } else {
      clearStoredAuth();
      setApiAuthToken("");
    }
  };

  useEffect(() => {
    const syncStoredAuth = () => {
      const storedAuth = getStoredAuth();
      setAuth(storedAuth);
      setApiAuthToken(storedAuth?.token || "");
    };

    window.addEventListener("storage", syncStoredAuth);
    window.addEventListener(AUTH_STORAGE_EVENT, syncStoredAuth);
    return () => {
      window.removeEventListener("storage", syncStoredAuth);
      window.removeEventListener(AUTH_STORAGE_EVENT, syncStoredAuth);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyStoredSession = async () => {
      setIsReady(false);

      if (!auth?.token) {
        if (!cancelled) setIsReady(true);
        return;
      }

      try {
        const res = await authApi.get("/auth/session");
        if (cancelled) return;
        const payload = res?.data?.data || {};
        applyAuth({
          ...auth,
          id: payload.id || auth.id,
          username: payload.username || payload.user?.username || auth.username || "",
          role: String(payload.role || payload.user?.role || auth.role).toUpperCase(),
          isFirstLogin: Boolean(payload.isFirstLogin ?? payload.user?.isFirstLogin ?? auth.isFirstLogin)
        });
      } catch {
        if (!cancelled) applyAuth(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    verifyStoredSession();
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  const login = async (credentials) => {
    const res = await authApi.post("/auth/login", credentials);
    const normalized = normalizeLoginPayload(res?.data?.data || {});
    if (!normalized) throw new Error("Invalid login response.");
    applyAuth(normalized);
    return normalized;
  };

  const logout = async () => {
    try {
      if (auth?.token) {
        await authApi.post("/auth/logout");
      }
    } catch {
      // Local logout should still happen if the server has already invalidated the session.
    } finally {
      applyAuth(null);
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
  };

  const resolveHome = () => {
    if (!auth) return "/login";
    return roleHome(auth.role);
  };

  const markFirstLoginComplete = () => {
    if (!auth) return;
    applyAuth({ ...auth, isFirstLogin: false });
  };

  const updateUsername = (username) => {
    if (!auth) return;
    applyAuth({ ...auth, username });
  };

  const value = useMemo(
    () => ({
      auth,
      isAuthChecking: !isReady,
      isAuthenticated,
      isReady,
      login,
      logout,
      resolveHome,
      markFirstLoginComplete,
      updateUsername
    }),
    [auth, isAuthenticated, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider.");
  return ctx;
}

export { AuthProvider, useAuth, roleHome };
