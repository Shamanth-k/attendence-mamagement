const express = require("express");
const cors = require("cors");
const { createProxyMiddleware, fixRequestBody } = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config({ path: "../../.env" });
const db = require("../../shared/src/db");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const AUTH_REQUIRED = (process.env.AUTH_REQUIRED || "true").toLowerCase() === "true";
const SCRYPT_KEYLEN = 64;
const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 60);

const rolePermissions = {
  ADMIN: [{ method: "*", path: "/api/" }],
  EMPLOYEE: [
    { method: "GET", path: "/api/master/" },
    { method: "GET", path: "/api/attendance/" },
    { method: "GET", path: "/api/report/" }
  ],
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
  path === "/auth/reset-password" ||
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

const requireIsoDateRange = (req, res) => {
  const { from, to } = req.query;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(String(from || "")) || !dateRe.test(String(to || ""))) {
    res.status(400).json({ message: "from and to must be valid YYYY-MM-DD dates" });
    return null;
  }
  if (from > to) {
    res.status(400).json({ message: "from must be before or equal to to" });
    return null;
  }
  return { from, to };
};

const toHuman = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

const toMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const mapAttendanceRow = (r) => {
  const workStart = toMinutes(r.in_time);
  const breakStart = toMinutes(r.break_start);
  const breakEnd = toMinutes(r.break_end);
  const out = toMinutes(r.out_time);
  const dayStart = 7 * 60;
  const dayRange = 22 * 60;
  const pct = (value) => (value == null ? 0 : ((value - dayStart) / dayRange) * 100);

  const hasBreakWindow =
    workStart != null &&
    out != null &&
    breakStart != null &&
    breakEnd != null &&
    breakStart >= workStart &&
    breakEnd >= breakStart &&
    out >= breakEnd;

  const firstSpan = hasBreakWindow
    ? Math.max(0, pct(breakStart) - pct(workStart))
    : Math.max(0, pct(out) - pct(workStart));

  return {
    date: r.attendance_date,
    date_label: new Date(r.attendance_date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      weekday: "short"
    }),
    in_time: r.in_time,
    out_time: r.out_time,
    work_minutes: Number(r.work_minutes || 0),
    idle_minutes: Number(r.idle_minutes || 0),
    status: r.status,
    work_start_pct: pct(workStart),
    work_first_span_pct: firstSpan,
    idle_start_pct: hasBreakWindow ? pct(breakStart) : 0,
    idle_span_pct: hasBreakWindow ? Math.max(0, pct(breakEnd) - pct(breakStart)) : 0,
    work_second_start_pct: hasBreakWindow ? pct(breakEnd) : 0,
    work_second_span_pct: hasBreakWindow ? Math.max(0, pct(out) - pct(breakEnd)) : 0
  };
};

const resolveEmployeeContext = async (userId) => {
  const [rows] = await db.query(
    `SELECT u.id AS user_id, u.username, u.role, u.employee_id, e.employee_code, e.full_name
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = ?
     LIMIT 1`,
    [Number(userId)]
  );
  return rows[0] || null;
};

const ensureLegacyEmployeeUser = async (username) => {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return null;

  const [employees] = await db.query(
    `SELECT e.id, e.employee_code
     FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     WHERE e.employee_code = ? AND u.id IS NULL
     LIMIT 1`,
    [normalizedUsername]
  );

  if (!employees.length) return null;

  const employee = employees[0];
  const defaultPassword = `${employee.employee_code}@123`;
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(defaultPassword, salt);

  await db.query(
    `INSERT INTO users(employee_id, username, role, password_salt, password_hash, is_first_login, is_active)
     VALUES (?, ?, 'EMPLOYEE', ?, ?, 1, 1)`,
    [employee.id, employee.employee_code, salt, passwordHash]
  );

  const [users] = await db.query(
    "SELECT id, username, role, password_salt, password_hash, is_active, is_first_login FROM users WHERE username = ? LIMIT 1",
    [normalizedUsername]
  );
  return users[0] || null;
};

const ensureSessionTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_sessions_token_id (token_id),
      INDEX idx_user_sessions_user_active (user_id, revoked_at, expires_at)
    )`
  );
};

const ensureLeaveTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      employee_id INT NULL,
      leave_date DATE NOT NULL,
      leave_type VARCHAR(50) NOT NULL DEFAULT 'CASUAL',
      reason VARCHAR(500) NOT NULL,
      status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
      admin_note VARCHAR(500) NULL,
      reviewed_by_user_id INT NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_leave_user_date (user_id, leave_date),
      INDEX idx_leave_status_date (status, leave_date),
      CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(id),
      CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
      CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
    )`
  );
};

const createSession = async (userId, tokenId, expiresAtSeconds) => {
  await ensureSessionTable();
  await db.query(
    "INSERT INTO user_sessions(user_id, token_id, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))",
    [userId, tokenId, expiresAtSeconds]
  );
};

const revokeSession = async (tokenId) => {
  if (!tokenId) return;
  await ensureSessionTable();
  await db.query(
    "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_id = ? AND revoked_at IS NULL",
    [tokenId]
  );
};

const isSessionActive = async (decoded) => {
  if (!decoded?.jti || !decoded?.sub) return false;
  await ensureSessionTable();
  const [rows] = await db.query(
    `SELECT id
     FROM user_sessions
     WHERE token_id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [decoded.jti, Number(decoded.sub)]
  );
  return rows.length > 0;
};

const verifyAuthToken = async (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  const active = await isSessionActive(decoded);
  if (!active) {
    const error = new Error("inactive session");
    error.name = "InactiveSessionError";
    throw error;
  }
  return decoded;
};

const requireBearerAuth = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || "");
  if (!token) return res.status(401).json({ message: "missing bearer token" });
  try {
    req.auth = await verifyAuthToken(token);
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

  let user = rows[0] || null;
  if (!user) {
    user = await ensureLegacyEmployeeUser(username);
  }

  if (!user || !user.is_active) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const candidate = hashPassword(password, user.password_salt);
  if (candidate !== user.password_hash) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const tokenId = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: tokenId }
  );
  const decoded = jwt.decode(token);
  await createSession(user.id, tokenId, decoded.exp);

  return res.json({
    data: {
      token,
      expiresIn: JWT_EXPIRES_IN,
      role: user.role,
      id: user.id,
      username: user.username,
      isFirstLogin: Boolean(user.is_first_login),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        isFirstLogin: Boolean(user.is_first_login)
      }
    }
  });
});

app.post("/auth/logout", requireBearerAuth, async (req, res) => {
  await revokeSession(req.auth.jti);
  return res.json({ message: "logged out" });
});

app.get("/auth/session", requireBearerAuth, async (req, res) => {
  const [rows] = await db.query(
    "SELECT id, username, role, is_active, is_first_login FROM users WHERE id = ? LIMIT 1",
    [Number(req.auth.sub)]
  );

  if (!rows.length || !rows[0].is_active) {
    return res.status(401).json({ message: "invalid or expired token" });
  }

  const user = rows[0];
  return res.json({
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      isFirstLogin: Boolean(user.is_first_login),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        isFirstLogin: Boolean(user.is_first_login)
      }
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

app.post("/auth/generate-reset/:employeeId", requireBearerAuth, async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: "employeeId must be a positive integer" });
  }

  const requesterRole = String(req.auth?.role || "").toUpperCase();
  if (requesterRole !== "ADMIN") {
    return res.status(403).json({ message: "only admins can generate reset links" });
  }

  const [users] = await db.query(
    `SELECT u.id, u.username, u.employee_id
     FROM users u
     WHERE u.employee_id = ?
     LIMIT 1`,
    [employeeId]
  );

  if (!users.length) {
    return res.status(404).json({ message: "user for employee not found" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  await db.query(
    `INSERT INTO password_reset_tokens(user_id, token_hash, expires_at, generated_by_user_id)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
    [users[0].id, tokenHash, RESET_TOKEN_TTL_MINUTES, Number(req.auth.sub)]
  );

  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
  return res.json({
    data: {
      token: resetToken,
      resetLink,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      userId: users[0].id,
      employeeId
    }
  });
});

app.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: "token and newPassword are required" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "new password must be at least 6 characters" });
  }

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const [rows] = await db.query(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) {
    return res.status(400).json({ message: "invalid or expired reset token" });
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, newSalt);
  await db.query(
    "UPDATE users SET password_salt = ?, password_hash = ?, is_first_login = 0 WHERE id = ?",
    [newSalt, newHash, rows[0].user_id]
  );
  await db.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
    [rows[0].id]
  );

  return res.json({ message: "password reset successful" });
});

app.get("/api/attendance/me/range", requireBearerAuth, async (req, res) => {
  const range = requireIsoDateRange(req, res);
  if (!range) return;
  const user = await resolveEmployeeContext(req.auth.sub);
  if (!user?.employee_id) {
    return res.status(404).json({ message: "employee profile is not linked to this user" });
  }

  const [rows] = await db.query(
    `SELECT attendance_date, in_time, out_time, work_minutes, idle_minutes, status, break_start, break_end
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [user.employee_id, range.from, range.to]
  );

  return res.json({ data: rows.map(mapAttendanceRow) });
});

app.get("/api/attendance/me/summary-range", requireBearerAuth, async (req, res) => {
  const range = requireIsoDateRange(req, res);
  if (!range) return;
  const user = await resolveEmployeeContext(req.auth.sub);
  if (!user?.employee_id) {
    return res.status(404).json({ message: "employee profile is not linked to this user" });
  }

  const [rows] = await db.query(
    `SELECT
      COALESCE(SUM(work_minutes), 0) AS totalWorkMinutes,
      COALESCE(SUM(idle_minutes), 0) AS totalIdleMinutes,
      COALESCE(SUM(work_minutes + idle_minutes), 0) AS totalSpanMinutes
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ? AND status = 'PRESENT'`,
    [user.employee_id, range.from, range.to]
  );

  return res.json({ data: rows[0] || { totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 } });
});

app.get("/api/report/me/chart", requireBearerAuth, async (req, res) => {
  const range = requireIsoDateRange(req, res);
  if (!range) return;
  const user = await resolveEmployeeContext(req.auth.sub);
  if (!user?.employee_id) {
    return res.status(404).json({ message: "employee profile is not linked to this user" });
  }

  const [rows] = await db.query(
    `SELECT DAY(attendance_date) AS day, COALESCE(work_minutes, 0) AS work_minutes
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [user.employee_id, range.from, range.to]
  );

  const totalMinutes = rows.reduce((sum, row) => sum + Number(row.work_minutes || 0), 0);
  return res.json({
    data: {
      points: rows.map((row) => ({
        day: row.day,
        hours: Number((Number(row.work_minutes || 0) / 60).toFixed(2))
      })),
      total: toHuman(totalMinutes)
    }
  });
});

app.get("/api/leave/me", requireBearerAuth, async (req, res) => {
  await ensureLeaveTable();
  const [rows] = await db.query(
    `SELECT id, leave_date, leave_type, reason, status, admin_note, reviewed_at, created_at
     FROM leave_requests
     WHERE user_id = ?
     ORDER BY leave_date DESC, id DESC`,
    [Number(req.auth.sub)]
  );
  return res.json({ data: rows });
});

app.post("/api/leave/me", requireBearerAuth, async (req, res) => {
  await ensureLeaveTable();
  const employee = await resolveEmployeeContext(req.auth.sub);
  const { leaveDate, leaveType, reason } = req.body || {};
  const normalizedDate = String(leaveDate || "").trim();
  const normalizedType = String(leaveType || "CASUAL").trim().toUpperCase();
  const normalizedReason = String(reason || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return res.status(400).json({ message: "leaveDate must be a valid YYYY-MM-DD date" });
  }
  if (!normalizedReason) {
    return res.status(400).json({ message: "reason is required" });
  }

  const [result] = await db.query(
    `INSERT INTO leave_requests(user_id, employee_id, leave_date, leave_type, reason, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [Number(req.auth.sub), employee?.employee_id || null, normalizedDate, normalizedType, normalizedReason]
  );

  const [rows] = await db.query(
    `SELECT id, leave_date, leave_type, reason, status, admin_note, reviewed_at, created_at
     FROM leave_requests
     WHERE id = ?`,
    [result.insertId]
  );
  return res.status(201).json({ message: "leave request submitted", data: rows[0] });
});

app.get("/api/admin/leave", requireBearerAuth, async (req, res) => {
  const role = String(req.auth?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ message: "only admins can view leave requests" });
  }

  await ensureLeaveTable();
  const [rows] = await db.query(
    `SELECT
       lr.id,
       lr.leave_date,
       lr.leave_type,
       lr.reason,
       lr.status,
       lr.admin_note,
       lr.reviewed_at,
       lr.created_at,
       u.username,
       e.employee_code,
       e.full_name
     FROM leave_requests lr
     INNER JOIN users u ON u.id = lr.user_id
     LEFT JOIN employees e ON e.id = lr.employee_id
     ORDER BY
       FIELD(lr.status, 'PENDING', 'APPROVED', 'REJECTED'),
       lr.leave_date DESC,
       lr.id DESC`
  );
  return res.json({ data: rows });
});

app.patch("/api/admin/leave/:id", requireBearerAuth, async (req, res) => {
  const role = String(req.auth?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ message: "only admins can update leave requests" });
  }

  await ensureLeaveTable();
  const leaveId = Number(req.params.id);
  const status = String(req.body?.status || "").trim().toUpperCase();
  const adminNote = String(req.body?.adminNote || "").trim();
  if (!Number.isInteger(leaveId) || leaveId <= 0) {
    return res.status(400).json({ message: "id must be a positive integer" });
  }
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
  }

  const [result] = await db.query(
    `UPDATE leave_requests
     SET status = ?, admin_note = ?, reviewed_by_user_id = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, adminNote || null, Number(req.auth.sub), leaveId]
  );
  if (!result.affectedRows) {
    return res.status(404).json({ message: "leave request not found" });
  }

  const [rows] = await db.query(
    `SELECT
       lr.id,
       lr.leave_date,
       lr.leave_type,
       lr.reason,
       lr.status,
       lr.admin_note,
       lr.reviewed_at,
       lr.created_at,
       u.username,
       e.employee_code,
       e.full_name
     FROM leave_requests lr
     INNER JOIN users u ON u.id = lr.user_id
     LEFT JOIN employees e ON e.id = lr.employee_id
     WHERE lr.id = ?
     LIMIT 1`,
    [leaveId]
  );
  return res.json({ message: "leave request updated", data: rows[0] || null });
});

app.use(async (req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);

  if (!AUTH_REQUIRED) return next();
  if (isPublicPath(req.path)) return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "missing bearer token" });

  try {
    const decoded = await verifyAuthToken(token);
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
  "/api/biometric": "http://localhost:5004",
  "/api/calendar": "http://localhost:5004",
  "/api/admin/calendar": "http://localhost:5004",
  "/api/admin/reports": "http://localhost:5004",
  "/api/admin/biometric": "http://localhost:5004"
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
          fixRequestBody(proxyReq, req);
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
