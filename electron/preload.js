const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script — exposes a safe, minimal API to the renderer process.
 *
 * The renderer (React app) can call these via `window.electronAPI.*`.
 * This follows Electron's recommended security pattern:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - sandbox: true
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** Returns the app version from package.json */
  getVersion: () => ipcRenderer.invoke("app:version"),

  /** Returns true if the app is running from a packaged build */
  isPackaged: () => ipcRenderer.invoke("app:isPackaged"),

  /** Platform identifier (win32, darwin, linux) */
  platform: process.platform
});
