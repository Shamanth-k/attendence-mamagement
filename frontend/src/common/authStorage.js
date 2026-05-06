const AUTH_STORAGE_KEY = "auth_payload";
const AUTH_STORAGE_EVENT = "auth-storage-changed";
const LEGACY_AUTH_TOKEN_KEY = "auth_token";
const LEGACY_AUTH_USER_KEY = "auth_user";

function notifyAuthStorageChanged() {
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

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
    username: parsed.username || "",
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
      username: auth.username || "",
      isFirstLogin: Boolean(auth.isFirstLogin)
    })
  );
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_AUTH_USER_KEY);
  notifyAuthStorageChanged();
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_AUTH_USER_KEY);
  notifyAuthStorageChanged();
}

export { AUTH_STORAGE_EVENT, AUTH_STORAGE_KEY, getStoredAuth, setStoredAuth, clearStoredAuth };
