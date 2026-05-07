const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

/* ──────────────────────────────────────────────
 * Configuration
 * ────────────────────────────────────────────── */
const DEV_SERVER_URL = "http://localhost:5173";
const GATEWAY_URL = "http://localhost:8080";
const isDev = !app.isPackaged;

/* ──────────────────────────────────────────────
 * Child process management
 * ────────────────────────────────────────────── */
const childProcesses = [];

function spawnService(command, args, cwd, label) {
  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: "pipe",
    env: { ...process.env }
  });

  child.stdout?.on("data", (data) => {
    console.log(`[${label}] ${data.toString().trim()}`);
  });

  child.stderr?.on("data", (data) => {
    console.error(`[${label}] ${data.toString().trim()}`);
  });

  child.on("error", (err) => {
    console.error(`[${label}] Failed to start: ${err.message}`);
  });

  child.on("exit", (code) => {
    console.log(`[${label}] Exited with code ${code}`);
  });

  childProcesses.push(child);
  return child;
}

function killAllChildren() {
  childProcesses.forEach((child) => {
    if (!child.killed) {
      try {
        // On Windows, we need to kill the process tree
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { shell: true });
        } else {
          child.kill("SIGTERM");
        }
      } catch (_) {
        // Process may have already exited
      }
    }
  });
}

/* ──────────────────────────────────────────────
 * Wait for a URL to become available
 * ────────────────────────────────────────────── */
function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const lib = url.startsWith("https") ? require("https") : require("http");
      const req = lib.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

/* ──────────────────────────────────────────────
 * Splash window (shown while services boot)
 * ────────────────────────────────────────────── */
function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

/* ──────────────────────────────────────────────
 * Main application window
 * ────────────────────────────────────────────── */
let mainWindow = null;
let isBooting = true; // Guard: prevent window-all-closed from quitting during boot

function createMainWindow(splashToDestroy) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: "Attendance Management",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#0a0e1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  // Show the main window and destroy the splash AFTER content is ready
  mainWindow.once("ready-to-show", () => {
    if (splashToDestroy && !splashToDestroy.isDestroyed()) {
      splashToDestroy.destroy();
    }
    mainWindow.show();
    mainWindow.focus();
    isBooting = false;
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

/* ──────────────────────────────────────────────
 * Application menu
 * ────────────────────────────────────────────── */
function buildAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reload()
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev
          ? [
              { type: "separator" },
              { role: "toggleDevTools" }
            ]
          : [])
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ──────────────────────────────────────────────
 * IPC handlers
 * ────────────────────────────────────────────── */
function registerIpcHandlers() {
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:isPackaged", () => app.isPackaged);
}

/* ──────────────────────────────────────────────
 * Boot sequence
 * ────────────────────────────────────────────── */
async function boot() {
  registerIpcHandlers();
  buildAppMenu();

  const projectRoot = path.resolve(__dirname, "..");

  if (isDev) {
    // ── Dev mode: start backend + frontend dev servers ──
    const splash = createSplashWindow();

    console.log("[Electron] Starting backend services...");
    spawnService("npx", ["nodemon", "src/server.js"], path.join(projectRoot, "backend", "services", "master-service"), "master");
    spawnService("npx", ["nodemon", "src/server.js"], path.join(projectRoot, "backend", "services", "attendance-service"), "attendance");
    spawnService("npx", ["nodemon", "src/server.js"], path.join(projectRoot, "backend", "services", "report-service"), "report");
    spawnService("npx", ["nodemon", "src/server.js"], path.join(projectRoot, "backend", "services", "biometric-service"), "biometric");
    spawnService("npx", ["nodemon", "src/server.js"], path.join(projectRoot, "backend", "gateway"), "gateway");

    console.log("[Electron] Starting Vite dev server...");
    spawnService("npx", ["vite", "--port", "5173"], path.join(projectRoot, "frontend"), "vite");

    console.log("[Electron] Waiting for services to be ready...");
    try {
      await Promise.all([
        waitForUrl(`${GATEWAY_URL}/health`, 45000),
        waitForUrl(DEV_SERVER_URL, 45000)
      ]);
    } catch (err) {
      console.error("[Electron] Service startup failed:", err.message);
    }

    // Create the main window BEFORE destroying splash to avoid zero-window quit
    const win = createMainWindow(splash);
    win.loadURL(DEV_SERVER_URL);
  } else {
    // ── Production mode: start backend, load built frontend ──
    const splash = createSplashWindow();

    console.log("[Electron] Starting backend services...");
    spawnService("node", ["src/server.js"], path.join(projectRoot, "backend", "services", "master-service"), "master");
    spawnService("node", ["src/server.js"], path.join(projectRoot, "backend", "services", "attendance-service"), "attendance");
    spawnService("node", ["src/server.js"], path.join(projectRoot, "backend", "services", "report-service"), "report");
    spawnService("node", ["src/server.js"], path.join(projectRoot, "backend", "services", "biometric-service"), "biometric");
    spawnService("node", ["src/server.js"], path.join(projectRoot, "backend", "gateway"), "gateway");

    console.log("[Electron] Waiting for gateway...");
    try {
      await waitForUrl(`${GATEWAY_URL}/health`, 45000);
    } catch (err) {
      console.error("[Electron] Gateway startup failed:", err.message);
    }

    // Create the main window BEFORE destroying splash to avoid zero-window quit
    const win = createMainWindow(splash);
    win.loadFile(path.join(projectRoot, "frontend", "dist", "index.html"));
  }
}

/* ──────────────────────────────────────────────
 * App lifecycle
 * ────────────────────────────────────────────── */
app.whenReady().then(boot);

app.on("activate", () => {
  // macOS: re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    boot();
  }
});

app.on("window-all-closed", () => {
  // Don't quit during boot — the splash is destroyed before the main window is fully visible
  if (isBooting) return;
  killAllChildren();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killAllChildren();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
