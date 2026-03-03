const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config({ path: "../../.env" });
const db = require("../../shared/src/db");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const AUTH_REQUIRED = (process.env.AUTH_REQUIRED || "false").toLowerCase() === "true";
const SCRYPT_KEYLEN = 64;

const rolePermissions = {
  admin: [{ method: "*", path: "/api/" }],
  hr: [
    { method: "*", path: "/api/master/" },
    { method: "*", path: "/api/attendance/" },
    { method: "*", path: "/api/report/" },
    { method: "*", path: "/api/biometric/" }
  ],
  manager: [
    { method: "GET", path: "/api/master/" },
    { method: "GET", path: "/api/attendance/" },
    { method: "GET", path: "/api/report/" }
  ],
  viewer: [
    { method: "GET", path: "/api/attendance/" },
    { method: "GET", path: "/api/report/" }
  ]
};

const isPublicPath = (path) =>
  path === "/health" ||
  path === "/auth/login" ||
  path === "/auth/bootstrap" ||
  path.startsWith("/api/biometric/punch") ||
  path.startsWith("/api/biometric/ingest");

const canAccess = (role, method, path) => {
  const permissions = rolePermissions[role] || [];
  return permissions.some((permission) => {
    const methodAllowed = permission.method === "*" || permission.method === method;
    const pathAllowed = path.startsWith(permission.path);
    return methodAllowed && pathAllowed;
  });
};

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");

const getBearerToken = (authHeader = "") =>
  authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

const requireBearerAuth = (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || "");
  if (!token) return res.status(401).json({ message: "missing bearer token" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "invalid or expired token" });
  }
};

app.post("/auth/bootstrap", async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const [existing] = await db.query("SELECT COUNT(*) AS count FROM users");
  if (existing[0].count > 0) {
    return res.status(409).json({ message: "bootstrap is disabled once users exist" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const userRole = role || "admin";

  await db.query(
    "INSERT INTO users(username, role, password_salt, password_hash, is_active) VALUES (?, ?, ?, ?, 1)",
    [username, userRole, salt, passwordHash]
  );

  return res.status(201).json({ message: "bootstrap user created" });
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  const [rows] = await db.query(
    "SELECT id, username, role, password_salt, password_hash, is_active, is_first_login FROM users WHERE username = ? LIMIT 1",
    [username]
  );

  if (!rows.length || !rows[0].is_active) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const user = rows[0];
  const candidate = hashPassword(password, user.password_salt);
  if (candidate !== user.password_hash) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({
    data: {
      token,
      expiresIn: JWT_EXPIRES_IN,
      role: user.role,
      id: user.id,
      isFirstLogin: Boolean(user.is_first_login),
      user: { id: user.id, username: user.username, role: user.role, isFirstLogin: Boolean(user.is_first_login) }
    }
  });
});

app.patch("/auth/profile/name", requireBearerAuth, async (req, res) => {
  const { username } = req.body;
  const normalized = String(username || "").trim();
  if (!normalized) return res.status(400).json({ message: "username is required" });

  try {
    const [result] = await db.query("UPDATE users SET username = ? WHERE id = ?", [
      normalized,
      Number(req.auth.sub)
    ]);
    if (!result.affectedRows) return res.status(404).json({ message: "user not found" });

    const [rows] = await db.query("SELECT id, username, role FROM users WHERE id = ? LIMIT 1", [Number(req.auth.sub)]);
    if (!rows.length) return res.status(404).json({ message: "user not found" });
    return res.json({ data: { user: rows[0] } });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "username already exists" });
    }
    return res.status(500).json({ message: "failed to update username" });
  }
});

app.patch("/auth/profile/password", requireBearerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "new password must be at least 6 characters" });
  }

  const [rows] = await db.query(
    "SELECT id, password_salt, password_hash, is_active FROM users WHERE id = ? LIMIT 1",
    [Number(req.auth.sub)]
  );
  if (!rows.length || !rows[0].is_active) {
    return res.status(404).json({ message: "user not found" });
  }

  const user = rows[0];
  const candidate = hashPassword(currentPassword, user.password_salt);
  if (candidate !== user.password_hash) {
    return res.status(401).json({ message: "current password is incorrect" });
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, newSalt);
  await db.query("UPDATE users SET password_salt = ?, password_hash = ?, is_first_login = 0 WHERE id = ?", [
    newSalt,
    newHash,
    Number(req.auth.sub)
  ]);
  return res.json({ message: "password updated" });
});

app.post("/auth/force-change-password", requireBearerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "new password must be at least 6 characters" });
  }

  const [rows] = await db.query(
    "SELECT id, password_salt, password_hash, is_active FROM users WHERE id = ? LIMIT 1",
    [Number(req.auth.sub)]
  );
  if (!rows.length || !rows[0].is_active) {
    return res.status(404).json({ message: "user not found" });
  }

  const user = rows[0];
  const candidate = hashPassword(currentPassword, user.password_salt);
  if (candidate !== user.password_hash) {
    return res.status(401).json({ message: "current password is incorrect" });
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, newSalt);
  await db.query("UPDATE users SET password_salt = ?, password_hash = ?, is_first_login = 0 WHERE id = ?", [
    newSalt,
    newHash,
    Number(req.auth.sub)
  ]);

  return res.json({ message: "password updated", isFirstLogin: false });
});

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);

  if (!AUTH_REQUIRED) return next();
  if (isPublicPath(req.path)) return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "missing bearer token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
  } catch (err) {
    return res.status(401).json({ message: "invalid or expired token" });
  }

  const role = req.auth.role || "viewer";
  if (!canAccess(role, req.method, req.path)) {
    return res.status(403).json({ message: "insufficient role permission" });
  }

  return next();
});

const targets = {
  "/api/master": "http://localhost:5001",
  "/api/attendance": "http://localhost:5002",
  "/api/report": "http://localhost:5003",
  "/api/biometric": "http://localhost:5004"
};

Object.entries(targets).forEach(([path, target]) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (requestPath) => `${path}${requestPath}`,
      on: {
        proxyReq: (proxyReq, req) => {
          proxyReq.setHeader("x-request-id", req.requestId || "");
          proxyReq.setHeader("x-user-id", req.auth?.sub || "");
          proxyReq.setHeader("x-user-role", req.auth?.role || "");
          proxyReq.setHeader("x-user-name", req.auth?.username || "");
        }
      }
    })
  );
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "gateway" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
