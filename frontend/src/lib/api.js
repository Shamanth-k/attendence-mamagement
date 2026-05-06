import axios from "axios";
import { clearStoredAuth, getStoredAuth } from "../common/authStorage";

const configuredBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
const authBaseURL = configuredBase.replace(/\/api\/?$/, "");

const REQUEST_TIMEOUT_MS = 15000;
const api = axios.create({ baseURL: configuredBase, timeout: REQUEST_TIMEOUT_MS });
const authApi = axios.create({ baseURL: authBaseURL, timeout: REQUEST_TIMEOUT_MS });

function setApiAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    authApi.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
    delete authApi.defaults.headers.common.Authorization;
  }
}

const storedAuth = getStoredAuth();
if (storedAuth?.token) {
  setApiAuthToken(storedAuth.token);
}

const handleAuthError = (error) => {
  if (error?.response?.status === 401) {
    clearStoredAuth();
    setApiAuthToken("");
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }
  return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handleAuthError);
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearStoredAuth();
      setApiAuthToken("");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export { setApiAuthToken, authApi, authBaseURL };
export default api;
