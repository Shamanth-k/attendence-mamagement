const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("master-service"));

app.get("/api/master/departments", async (_, res) => {
  const [rows] = await db.query("SELECT id, name, description FROM departments ORDER BY id");
  res.json({ data: rows });
});

app.post("/api/master/departments", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  await db.query("INSERT INTO departments(name, description) VALUES (?, ?)", [name, description || null]);
  res.status(201).json({ message: "department added" });
});

app.put("/api/master/departments/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  const [result] = await db.query(
    "UPDATE departments SET name = ?, description = ? WHERE id = ?",
    [name, description || null, Number(id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "department not found" });
  res.json({ message: "department updated" });
});

app.get("/api/master/sections", async (_, res) => {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.description, d.name AS department_name, s.department_id
     FROM sections s JOIN departments d ON s.department_id = d.id ORDER BY s.id`
  );
  res.json({ data: rows });
});

app.get("/api/master/employees", async (_, res) => {
  const [rows] = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.section_id, s.name AS section_name, d.id AS department_id, d.name AS department_name
     FROM employees e
     LEFT JOIN sections s ON s.id = e.section_id
     LEFT JOIN departments d ON d.id = s.department_id
     ORDER BY e.id`
  );
  res.json({ data: rows });
});

app.post("/api/master/sections", async (req, res) => {
  const { name, department_id, description } = req.body;
  if (!name || !department_id) return res.status(400).json({ message: "name and department_id are required" });
  await db.query("INSERT INTO sections(name, department_id, description) VALUES (?, ?, ?)", [name, department_id, description || null]);
  res.status(201).json({ message: "section added" });
});

app.put("/api/master/sections/:id", async (req, res) => {
  const { id } = req.params;
  const { name, department_id, description } = req.body;
  if (!name || !department_id) return res.status(400).json({ message: "name and department_id are required" });
  const [result] = await db.query(
    "UPDATE sections SET name = ?, department_id = ?, description = ? WHERE id = ?",
    [name, Number(department_id), description || null, Number(id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "section not found" });
  res.json({ message: "section updated" });
});

app.post("/api/master/employees", async (req, res) => {
  const { employee_code, full_name, section_id } = req.body;
  if (!employee_code || !full_name) {
    return res.status(400).json({ message: "employee_code and full_name are required" });
  }
  await db.query(
    "INSERT INTO employees(employee_code, full_name, section_id) VALUES (?, ?, ?)",
    [employee_code, full_name, section_id ? Number(section_id) : null]
  );
  res.status(201).json({ message: "employee added" });
});

app.put("/api/master/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { employee_code, full_name, section_id } = req.body;
  if (!employee_code || !full_name) {
    return res.status(400).json({ message: "employee_code and full_name are required" });
  }
  const [result] = await db.query(
    "UPDATE employees SET employee_code = ?, full_name = ?, section_id = ? WHERE id = ?",
    [employee_code, full_name, section_id ? Number(section_id) : null, Number(id)]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "employee not found" });
  res.json({ message: "employee updated" });
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "master" }));

const PORT = process.env.MASTER_SERVICE_PORT || 5001;
app.listen(PORT, () => {
  console.log(`Master service running on ${PORT}`);
});
