const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("master-service"));

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const EMPLOYEE_LIST_DEFAULT_LIMIT = 50;
const EMPLOYEE_LIST_MAX_LIMIT = 200;

const loadEmployeeById = async (employeeId) => {
  const [rows] = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.section_id, s.name AS section_name, d.id AS department_id, d.name AS department_name
     FROM employees e
     LEFT JOIN sections s ON s.id = e.section_id
     LEFT JOIN departments d ON d.id = s.department_id
     WHERE e.id = ?
     LIMIT 1`,
    [Number(employeeId)]
  );
  return rows[0] || null;
};

app.get("/api/master/departments", asyncHandler(async (_, res) => {
  const [rows] = await db.query("SELECT id, name, description FROM departments ORDER BY id");
  res.json({ data: rows });
}));

app.post("/api/master/departments", asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  await db.query("INSERT INTO departments(name, description) VALUES (?, ?)", [name, description || null]);
  res.status(201).json({ message: "department added" });
}));

app.put("/api/master/departments/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  const [result] = await db.query(
    "UPDATE departments SET name = ?, description = ? WHERE id = ?",
    [name, description || null, Number(id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "department not found" });
  res.json({ message: "department updated" });
}));

app.get("/api/master/sections", asyncHandler(async (_, res) => {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.description, d.name AS department_name, s.department_id
     FROM sections s JOIN departments d ON s.department_id = d.id ORDER BY s.id`
  );
  res.json({ data: rows });
}));

app.get("/api/master/employees", asyncHandler(async (req, res) => {
  const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
  const requestedLimit = Number(req.query.limit);
  const requestedOffset = Number(req.query.offset);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), EMPLOYEE_LIST_MAX_LIMIT)
    : EMPLOYEE_LIST_DEFAULT_LIMIT;
  const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;
  let rows = [];
  if (hasPagination) {
    [rows] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.section_id, s.name AS section_name, d.id AS department_id, d.name AS department_name
       FROM employees e
       LEFT JOIN sections s ON s.id = e.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       ORDER BY e.id
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  } else {
    [rows] = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.section_id, s.name AS section_name, d.id AS department_id, d.name AS department_name
       FROM employees e
       LEFT JOIN sections s ON s.id = e.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       ORDER BY e.id`
    );
  }

  let total = rows.length;
  if (hasPagination) {
    const [countRows] = await db.query("SELECT COUNT(*) AS total FROM employees");
    total = Number(countRows?.[0]?.total || 0);
  }

  res.json({
    data: rows,
    meta: {
      total,
      limit: hasPagination ? limit : rows.length,
      offset: hasPagination ? offset : 0,
      hasMore: hasPagination ? offset + rows.length < total : false
    }
  });
}));

app.post("/api/master/sections", asyncHandler(async (req, res) => {
  const { name, department_id, description } = req.body;
  if (!name || !department_id) return res.status(400).json({ message: "name and department_id are required" });
  await db.query("INSERT INTO sections(name, department_id, description) VALUES (?, ?, ?)", [name, department_id, description || null]);
  res.status(201).json({ message: "section added" });
}));

app.put("/api/master/sections/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, department_id, description } = req.body;
  if (!name || !department_id) return res.status(400).json({ message: "name and department_id are required" });
  const [result] = await db.query(
    "UPDATE sections SET name = ?, department_id = ?, description = ? WHERE id = ?",
    [name, Number(department_id), description || null, Number(id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "section not found" });
  res.json({ message: "section updated" });
}));

app.post("/api/master/employees", asyncHandler(async (req, res) => {
  const { employee_code, full_name, section_id } = req.body;
  if (!employee_code || !full_name) {
    return res.status(400).json({ message: "employee_code and full_name are required" });
  }
  try {
    const [result] = await db.query(
      "INSERT INTO employees(employee_code, full_name, section_id) VALUES (?, ?, ?)",
      [employee_code, full_name, section_id ? Number(section_id) : null]
    );
    const created = await loadEmployeeById(result.insertId);
    res.status(201).json({ message: "employee added", data: created });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "employee_code already exists" });
    }
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "invalid section_id" });
    }
    throw error;
  }
}));

app.put("/api/master/employees/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { employee_code, full_name, section_id } = req.body;
  if (!employee_code || !full_name) {
    return res.status(400).json({ message: "employee_code and full_name are required" });
  }
  try {
    const [result] = await db.query(
      "UPDATE employees SET employee_code = ?, full_name = ?, section_id = ? WHERE id = ?",
      [employee_code, full_name, section_id ? Number(section_id) : null, Number(id)]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "employee not found" });
    const updated = await loadEmployeeById(id);
    res.json({ message: "employee updated", data: updated });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "employee_code already exists" });
    }
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "invalid section_id" });
    }
    throw error;
  }
}));

app.get("/health", (_, res) => res.json({ status: "ok", service: "master" }));

app.use((err, req, res, _next) => {
  const requestId = req.headers["x-request-id"] || null;
  const errorCode = err?.code || "";
  const errorMessage = String(err?.message || "internal server error");

  if (errorCode === "ER_ACCESS_DENIED_ERROR") {
    return res.status(503).json({
      message: "database authentication failed",
      code: errorCode,
      requestId
    });
  }

  if (errorCode === "ECONNREFUSED" || errorCode === "PROTOCOL_CONNECTION_LOST") {
    return res.status(503).json({
      message: "database unavailable",
      code: errorCode,
      requestId
    });
  }

  if (errorCode.startsWith("ER_")) {
    return res.status(500).json({
      message: "database query failed",
      code: errorCode,
      requestId
    });
  }

  return res.status(500).json({
    message: "internal server error",
    detail: errorMessage,
    requestId
  });
});

const PORT = process.env.MASTER_SERVICE_PORT || 5001;
app.listen(PORT, () => {
  console.log(`Master service running on ${PORT}`);
});
