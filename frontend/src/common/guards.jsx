import { Navigate, Outlet } from "react-router-dom";
import { useAuth, roleHome } from "../context/AuthContext";

function RequireAuth() {
  const { isAuthenticated, isAuthChecking } = useAuth();
  if (isAuthChecking) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { isAuthenticated, isAuthChecking, resolveHome } = useAuth();
  if (isAuthChecking) return null;
  if (isAuthenticated) return <Navigate to={resolveHome()} replace />;
  return <Outlet />;
}

function RequireRole({ role }) {
  const { auth, isAuthChecking } = useAuth();
  if (isAuthChecking) return null;
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.role !== role) return <Navigate to={roleHome(auth.role)} replace />;
  return <Outlet />;
}

function RequireFirstLogin() {
  const { auth, isAuthChecking } = useAuth();
  if (isAuthChecking) return null;
  if (!auth) return <Navigate to="/login" replace />;
  if (!auth.isFirstLogin) return <Navigate to={roleHome(auth.role)} replace />;
  return <Outlet />;
}

function BlockIfFirstLogin() {
  const { auth, isAuthChecking } = useAuth();
  if (isAuthChecking) return null;
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.isFirstLogin) return <Navigate to="/force-change-password" replace />;
  return <Outlet />;
}

export { RequireAuth, PublicOnly, RequireRole, RequireFirstLogin, BlockIfFirstLogin };
