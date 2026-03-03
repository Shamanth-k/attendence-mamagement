import { createContext, useContext, useMemo, useState } from "react";
import { authApi, setApiAuthToken } from "../lib/api";
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "../common/authStorage";

const AuthContext = createContext(null);

function normalizeLoginPayload(payload) {
  const user = payload?.user || {};
  const token = payload?.token || "";
  const role = String(payload?.role || user?.role || "").toUpperCase();
  const id = payload?.id || user?.id || user?.employeeId || user?.employee_id;
  const isFirstLogin = Boolean(
    payload?.isFirstLogin ?? user?.isFirstLogin ?? user?.is_first_login
  );

  if (!token || !role || !id) return null;
  return { token, role, id, isFirstLogin };
}

function roleHome(role) {
  return role === "ADMIN" ? "/admin/dashboard" : "/employee/dashboard";
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());
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

  const login = async (credentials) => {
    const res = await authApi.post("/auth/login", credentials);
    const normalized = normalizeLoginPayload(res?.data?.data || {});
    if (!normalized) throw new Error("Invalid login response.");
    applyAuth(normalized);
    return normalized;
  };

  const logout = () => applyAuth(null);

  const resolveHome = () => {
    if (!auth) return "/login";
    return roleHome(auth.role);
  };

  const markFirstLoginComplete = () => {
    if (!auth) return;
    applyAuth({ ...auth, isFirstLogin: false });
  };

  const value = useMemo(
    () => ({
      auth,
      isAuthenticated,
      login,
      logout,
      resolveHome,
      markFirstLoginComplete
    }),
    [auth, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider.");
  return ctx;
}

export { AuthProvider, useAuth, roleHome };
