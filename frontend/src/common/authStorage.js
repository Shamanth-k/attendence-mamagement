const AUTH_STORAGE_KEY = "auth_payload";

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStoredAuth() {
  const parsed = safeParse(localStorage.getItem(AUTH_STORAGE_KEY));
  if (!parsed?.token || !parsed?.role || !parsed?.id) return null;
  return {
    token: parsed.token,
    role: String(parsed.role).toUpperCase(),
    id: parsed.id,
    isFirstLogin: Boolean(parsed.isFirstLogin)
  };
}

function setStoredAuth(auth) {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: auth.token,
      role: String(auth.role).toUpperCase(),
      id: auth.id,
      isFirstLogin: Boolean(auth.isFirstLogin)
    })
  );
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export { AUTH_STORAGE_KEY, getStoredAuth, setStoredAuth, clearStoredAuth };
