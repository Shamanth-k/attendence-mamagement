/**
 * electron-builder configuration
 * https://www.electron.build/configuration
 */
module.exports = {
  appId: "com.attendance.management",
  productName: "Attendance Management",
  copyright: "Copyright © 2026",

  directories: {
    output: "release",
    buildResources: "electron"
  },

  files: [
    "electron/**/*",
    "backend/**/*",
    "frontend/dist/**/*",
    "!**/node_modules/.cache",
    "!**/.git"
  ],

  extraResources: [
    {
      from: "backend",
      to: "backend",
      filter: [
        "**/*",
        "!**/node_modules/.cache/**"
      ]
    }
  ],

  /* ── Windows ── */
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    icon: "electron/icon.png"
  },

  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: "electron/icon.png",
    uninstallerIcon: "electron/icon.png",
    installerHeaderIcon: "electron/icon.png",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Attendance Management"
  },

  /* ── macOS ── */
  mac: {
    target: ["dmg"],
    category: "public.app-category.business",
    icon: "electron/icon.png"
  },

  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" }
    ]
  },

  /* ── Linux ── */
  linux: {
    target: ["AppImage", "deb"],
    category: "Office",
    icon: "electron/icon.png"
  }
};
