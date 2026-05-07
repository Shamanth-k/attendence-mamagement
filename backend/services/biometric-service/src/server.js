const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");
const { requireDateRange, requirePositiveIntParam } = require("../../../shared/src/validation");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("biometric-service"));

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "";

const getKeyBuffer = () => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) return null;
  return Buffer.from(ENCRYPTION_KEY, "hex");
};

const encryptJson = (payload) => {
  const key = getKeyBuffer();
  if (!key) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload || {}), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
};

const normalizeEvent = (item, fallback) => ({
  employee_code: item.employee_code || fallback.employee_code,
  scanner_id: item.scanner_id || fallback.scanner_id || null,
  punch_type: item.punch_type || fallback.punch_type || "VERIFY",
  device_timestamp: item.device_timestamp || fallback.device_timestamp,
  payload: item.payload || fallback.payload || {},
  source_type: item.source_type || fallback.source_type || "biometric",
  source_ref: item.source_ref || fallback.source_ref || null,
  ingested_by: item.ingested_by || fallback.ingested_by || "system"
});

const expandHolidayRows = (rows, from, to) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const expanded = [];

  rows.forEach((row) => {
    const holidayType = row.holiday_type || "DATE";
    if (holidayType === "DATE" && row.holiday_date) {
      let dateValue = String(row.holiday_date);
      if (row.recurring_yearly) {
        const monthDay = dateValue.slice(5, 10);
        for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
          const candidate = `${year}-${monthDay}`;
          if (candidate >= from && candidate <= to) {
            expanded.push({
              id: row.id,
              title: row.title,
              date: candidate,
              recurringYearly: Boolean(row.recurring_yearly),
              isSystemDefault: Boolean(row.is_system_default),
              nonDeletable: Boolean(row.is_system_default),
              type: row.is_system_default ? "SYSTEM" : "DATE"
            });
          }
        }
      } else if (dateValue >= from && dateValue <= to) {
        expanded.push({
          id: row.id,
          title: row.title,
          date: dateValue,
          recurringYearly: false,
          isSystemDefault: Boolean(row.is_system_default),
          nonDeletable: Boolean(row.is_system_default),
          type: row.is_system_default ? "SYSTEM" : "DATE"
        });
      }
      return;
    }

    if (holidayType === "WEEKDAY" && row.weekday) {
      for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const mysqlWeekday = cursor.getDay() + 1;
        if (mysqlWeekday === Number(row.weekday)) {
          expanded.push({
            id: row.id,
            title: row.title,
            date: cursor.toISOString().slice(0, 10),
            recurringYearly: Boolean(row.recurring_yearly),
            isSystemDefault: Boolean(row.is_system_default),
            nonDeletable: Boolean(row.is_system_default),
            type: row.title === "Sunday" ? "SUNDAY" : "WEEKDAY"
          });
        }
      }
    }
  });

  return expanded.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
};

const formatHolidayAdminRow = (row) => ({
  id: row.id,
  title: row.title,
  date: row.holiday_date,
  recurringYearly: Boolean(row.recurring_yearly),
  isRecurringYearly: Boolean(row.recurring_yearly),
  isSystemDefault: Boolean(row.is_system_default),
  nonDeletable: Boolean(row.is_system_default),
  type: row.title === "Sunday" ? "SUNDAY" : row.holiday_type
});

const sendCsv = (res, filename, headers, rows) => {
  const escapeValue = (value) => {
    const normalized = value == null ? "" : String(value);
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, "\"\"")}"`;
    }
    return normalized;
  };

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.write(`${headers.map(escapeValue).join(",")}\n`);
  rows.forEach((row) => {
    res.write(`${row.map(escapeValue).join(",")}\n`);
  });
  res.end();
};

const loadHolidayDefinitions = async () => {
  const [rows] = await db.query(
    `SELECT id, title, holiday_date, holiday_type, weekday, recurring_yearly, is_system_default
     FROM holidays
     WHERE is_active = 1
     ORDER BY holiday_type ASC, holiday_date ASC, weekday ASC, title ASC`
  );
  return rows;
};

app.post("/api/biometric/ingest", async (req, res) => {
  const sourceType = req.body.source_type || "api";
  const items = Array.isArray(req.body.records) ? req.body.records : [req.body];
  const ingestedBy = req.headers["x-user-name"] || req.body.ingested_by || "system";
  const normalized = items.map((item) =>
    normalizeEvent(item, { source_type: sourceType, ingested_by: ingestedBy })
  );

  for (const item of normalized) {
    if (!item.employee_code || !item.device_timestamp) {
      return res.status(400).json({ message: "employee_code and device_timestamp are required for all records" });
    }
  }

  const values = normalized.map((item) => [
    item.employee_code,
    item.scanner_id,
    item.punch_type,
    item.device_timestamp,
    JSON.stringify(item.payload || {}),
    encryptJson(item.payload || {}),
    item.source_type,
    item.source_ref,
    item.ingested_by
  ]);

  await db.query(
    `INSERT INTO biometric_events(
       employee_code, scanner_id, punch_type, device_timestamp, payload, payload_encrypted,
       source_type, source_ref, ingested_by
     ) VALUES ?`,
    [values]
  );

  res.status(201).json({ message: "records captured", count: normalized.length });
});

app.post("/api/biometric/punch", async (req, res) => {
  const { employee_code, scanner_id, punch_type, device_timestamp, payload } = req.body;

  if (!employee_code || !device_timestamp) {
    return res.status(400).json({ message: "employee_code and device_timestamp are required" });
  }

  await db.query(
    `INSERT INTO biometric_events(
       employee_code, scanner_id, punch_type, device_timestamp, payload, payload_encrypted,
       source_type, source_ref, ingested_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_code,
      scanner_id || null,
      punch_type || "VERIFY",
      device_timestamp,
      JSON.stringify(payload || {}),
      encryptJson(payload || {}),
      "biometric",
      null,
      req.headers["x-user-name"] || "scanner"
    ]
  );

  res.status(201).json({ message: "punch captured" });
});

app.get("/api/calendar/holidays", async (req, res) => {
  const range = requireDateRange(req, res);
  if (!range) return;

  const rows = await loadHolidayDefinitions();
  const data = expandHolidayRows(rows, range.from, range.to);
  res.json({ data, meta: range });
});

app.get("/api/admin/calendar/holidays", async (_req, res) => {
  const rows = await loadHolidayDefinitions();
  res.json({ data: rows.map(formatHolidayAdminRow) });
});

app.post("/api/admin/calendar/holidays", async (req, res) => {
  const { title, date, recurringYearly } = req.body || {};
  const normalizedTitle = String(title || "").trim();
  const normalizedDate = String(date || "").trim();
  if (!normalizedTitle || !normalizedDate) {
    return res.status(400).json({ message: "title and date are required" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO holidays(title, holiday_date, holiday_type, weekday, recurring_yearly, is_system_default, created_by_user_id, is_active)
       VALUES (?, ?, 'DATE', NULL, ?, 0, ?, 1)`,
      [normalizedTitle, normalizedDate, recurringYearly ? 1 : 0, req.headers["x-user-id"] || null]
    );
    const [rows] = await db.query(
      `SELECT id, title, holiday_date, holiday_type, weekday, recurring_yearly, is_system_default
       FROM holidays
       WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({ message: "holiday created", data: formatHolidayAdminRow(rows[0]) });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "holiday already exists for that date/title" });
    }
    throw error;
  }
});

app.put("/api/admin/calendar/holidays/:id", async (req, res) => {
  const holidayId = requirePositiveIntParam(req, res, "id");
  if (!holidayId) return;
  const { title, date, recurringYearly } = req.body || {};
  const normalizedTitle = String(title || "").trim();
  const normalizedDate = String(date || "").trim();
  if (!normalizedTitle || !normalizedDate) {
    return res.status(400).json({ message: "title and date are required" });
  }

  try {
    const [result] = await db.query(
      `UPDATE holidays
       SET title = ?, holiday_date = ?, recurring_yearly = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [normalizedTitle, normalizedDate, recurringYearly ? 1 : 0, holidayId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "holiday not found" });
    }
    const [rows] = await db.query(
      `SELECT id, title, holiday_date, holiday_type, weekday, recurring_yearly, is_system_default
       FROM holidays
       WHERE id = ?`,
      [holidayId]
    );
    res.json({ message: "holiday updated", data: formatHolidayAdminRow(rows[0]) });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "holiday already exists for that date/title" });
    }
    if (error?.sqlState === "45000") {
      return res.status(400).json({ message: error.message || "system holiday cannot be modified" });
    }
    throw error;
  }
});

app.delete("/api/admin/calendar/holidays/:id", async (req, res) => {
  const holidayId = requirePositiveIntParam(req, res, "id");
  if (!holidayId) return;

  try {
    const [result] = await db.query("DELETE FROM holidays WHERE id = ?", [holidayId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "holiday not found" });
    }
    res.json({ message: "holiday deleted" });
  } catch (error) {
    if (error?.sqlState === "45000") {
      return res.status(400).json({ message: error.message || "system holiday cannot be deleted" });
    }
    throw error;
  }
});

app.get("/api/admin/reports/attendance-export", async (req, res) => {
  const hasCustomRange = req.query.from || req.query.to;
  const range = hasCustomRange ? requireDateRange(req, res) : null;
  if (hasCustomRange && !range) return;
  const employeeCode = String(req.query.employeeCode || "").trim();

  const params = [];
  let where = "WHERE 1=1";
  if (range) {
    where += " AND al.attendance_date BETWEEN ? AND ?";
    params.push(range.from, range.to);
  }
  if (employeeCode) {
    where += " AND e.employee_code = ?";
    params.push(employeeCode);
  }

  const [rows] = await db.query(
    `SELECT
       e.employee_code,
       e.full_name,
       d.name AS department_name,
       s.name AS section_name,
       al.attendance_date,
       al.in_time,
       al.out_time,
       al.break_start,
       al.break_end,
       al.work_minutes,
       al.idle_minutes,
       al.status
     FROM attendance_logs al
     INNER JOIN employees e ON e.id = al.employee_id
     LEFT JOIN sections s ON s.id = e.section_id
     LEFT JOIN departments d ON d.id = s.department_id
     ${where}
     ORDER BY al.attendance_date DESC, e.employee_code ASC`,
    params
  );

  sendCsv(
    res,
    "attendance-export.csv",
    ["Employee Code", "Full Name", "Department", "Section", "Date", "In Time", "Out Time", "Break Start", "Break End", "Work Minutes", "Idle Minutes", "Status"],
    rows.map((row) => [
      row.employee_code,
      row.full_name,
      row.department_name,
      row.section_name,
      row.attendance_date,
      row.in_time,
      row.out_time,
      row.break_start,
      row.break_end,
      row.work_minutes,
      row.idle_minutes,
      row.status
    ])
  );
});

app.get("/api/admin/biometric/logs", async (req, res) => {
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const employeeCode = String(req.query.employeeCode || "").trim();
  const format = String(req.query.format || "json").toLowerCase();
  const params = [];
  let where = "WHERE 1=1";

  if (from && to) {
    where += " AND DATE(be.device_timestamp) BETWEEN ? AND ?";
    params.push(from, to);
  }
  if (employeeCode) {
    where += " AND be.employee_code = ?";
    params.push(employeeCode);
  }

  const [rows] = await db.query(
    `SELECT
       be.id,
       be.employee_code,
       e.full_name,
       d.name AS department_name,
       s.name AS section_name,
       be.scanner_id,
       be.punch_type,
       be.device_timestamp,
       be.source_type,
       be.source_ref,
       be.ingested_by,
       be.payload,
       be.received_at
     FROM biometric_events be
     LEFT JOIN employees e ON e.employee_code = be.employee_code
     LEFT JOIN sections s ON s.id = e.section_id
     LEFT JOIN departments d ON d.id = s.department_id
     ${where}
     ORDER BY be.device_timestamp DESC, be.id DESC
     LIMIT 5000`,
    params
  );

  if (format === "csv") {
    return sendCsv(
      res,
      "biometric-logs.csv",
      ["ID", "Employee Code", "Full Name", "Department", "Section", "Scanner ID", "Punch Type", "Device Timestamp", "Source Type", "Source Ref", "Ingested By", "Payload", "Received At"],
      rows.map((row) => [
        row.id,
        row.employee_code,
        row.full_name,
        row.department_name,
        row.section_name,
        row.scanner_id,
        row.punch_type,
        row.device_timestamp,
        row.source_type,
        row.source_ref,
        row.ingested_by,
        typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload || {}),
        row.received_at
      ])
    );
  }

  res.json({
    data: rows.map((row) => ({
      id: row.id,
      employeeCode: row.employee_code,
      fullName: row.full_name || null,
      departmentName: row.department_name || null,
      sectionName: row.section_name || null,
      scannerId: row.scanner_id || null,
      punchType: row.punch_type || null,
      deviceTimestamp: row.device_timestamp,
      sourceType: row.source_type || null,
      sourceRef: row.source_ref || null,
      ingestedBy: row.ingested_by || null,
      payload: row.payload || {},
      receivedAt: row.received_at
    })),
    meta: {
      count: rows.length,
      filters: { from: from || null, to: to || null, employeeCode: employeeCode || null }
    }
  });
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "biometric" }));

app.use((err, req, res, _next) => {
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "duplicate record" });
  }
  if (err?.sqlState === "45000") {
    return res.status(400).json({ message: err.message || "request rejected by business rule" });
  }
  return res.status(500).json({
    message: "internal server error",
    detail: String(err?.message || "unknown error"),
    requestId: req.headers["x-request-id"] || null
  });
});

const PORT = process.env.BIOMETRIC_SERVICE_PORT || 5004;
app.listen(PORT, () => {
  console.log(`Biometric service running on ${PORT}`);
});
