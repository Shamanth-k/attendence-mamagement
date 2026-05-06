const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");
const {
  optionalMonth,
  requireDateRange,
  requirePositiveIntParam
} = require("../../../shared/src/validation");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("attendance-service"));

const LATE_AFTER_MINUTES = Number(process.env.LATE_AFTER_MINUTES || 9 * 60 + 15);
const ABSENTEEISM_THRESHOLD = Number(process.env.ABSENTEEISM_THRESHOLD || 3);

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const toMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const mapRow = (r) => {
  const workStart = toMinutes(r.in_time);
  const breakStart = toMinutes(r.break_start);
  const breakEnd = toMinutes(r.break_end);
  const out = toMinutes(r.out_time);
  const dayStart = 7 * 60;
  const dayRange = 22 * 60;
  const pct = (v) => (v == null ? 0 : ((v - dayStart) / dayRange) * 100);

  const hasBreakWindow =
    workStart != null &&
    out != null &&
    breakStart != null &&
    breakEnd != null &&
    breakStart >= workStart &&
    breakEnd >= breakStart &&
    out >= breakEnd;

  const firstSpan = hasBreakWindow ? Math.max(0, pct(breakStart) - pct(workStart)) : Math.max(0, pct(out) - pct(workStart));
  const idleStart = hasBreakWindow ? pct(breakStart) : 0;
  const idleSpan = hasBreakWindow ? Math.max(0, pct(breakEnd) - pct(breakStart)) : 0;
  const secondStart = hasBreakWindow ? pct(breakEnd) : 0;
  const secondSpan = hasBreakWindow ? Math.max(0, pct(out) - pct(breakEnd)) : 0;

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
    work_minutes: r.work_minutes,
    idle_minutes: r.idle_minutes,
    status: r.status,
    work_start_pct: pct(workStart),
    work_first_span_pct: firstSpan,
    idle_start_pct: idleStart,
    idle_span_pct: idleSpan,
    work_second_start_pct: secondStart,
    work_second_span_pct: secondSpan
  };
};

const buildAlerts = (rows) => {
  const alerts = [];
  let absentStreak = 0;
  let monthlyAbsent = 0;

  rows.forEach((row) => {
    const date = row.attendance_date;
    const inMinutes = toMinutes(row.in_time);

    if (row.status === "ABSENT") {
      absentStreak += 1;
      monthlyAbsent += 1;
    } else {
      absentStreak = 0;
    }

    if (row.status === "PRESENT" && inMinutes != null && inMinutes > LATE_AFTER_MINUTES) {
      alerts.push({
        employee_id: row.employee_id,
        alert_date: date,
        alert_type: "LATE_ARRIVAL",
        severity: "MEDIUM",
        detail: `Arrival at ${row.in_time} crossed threshold`
      });
    }

    if (row.status === "PRESENT" && (!row.in_time || !row.out_time)) {
      alerts.push({
        employee_id: row.employee_id,
        alert_date: date,
        alert_type: "MISSING_PUNCH",
        severity: "HIGH",
        detail: "IN/OUT punch is incomplete"
      });
    }

    if (absentStreak >= 2) {
      alerts.push({
        employee_id: row.employee_id,
        alert_date: date,
        alert_type: "ABSENCE_STREAK",
        severity: absentStreak >= 3 ? "HIGH" : "MEDIUM",
        detail: `Absent ${absentStreak} consecutive day(s)`
      });
    }
  });

  if (monthlyAbsent >= ABSENTEEISM_THRESHOLD && rows.length) {
    const latestDate = rows[rows.length - 1].attendance_date;
    alerts.push({
      employee_id: rows[rows.length - 1].employee_id,
      alert_date: latestDate,
      alert_type: "ABSENTEEISM_THRESHOLD",
      severity: "HIGH",
      detail: `${monthlyAbsent} absent day(s) in selected range`
    });
  }

  return alerts;
};

async function fetchAttendanceRows(employeeId, from, to) {
  const [rows] = await db.query(
    `SELECT attendance_date, in_time, out_time, work_minutes, idle_minutes, status, break_start, break_end
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );
  return rows.map(mapRow);
}

async function fetchSummary(employeeId, from, to) {
  const [rows] = await db.query(
    `SELECT
      COALESCE(SUM(work_minutes), 0) AS totalWorkMinutes,
      COALESCE(SUM(idle_minutes), 0) AS totalIdleMinutes,
      COALESCE(SUM(work_minutes + idle_minutes), 0) AS totalSpanMinutes
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ? AND status = 'PRESENT'`,
    [employeeId, from, to]
  );
  return rows[0];
}

app.get("/api/attendance/monthly/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const month = optionalMonth(req.query.month, getCurrentMonthKey());
  const from = `${month}-01`;
  const to = `${month}-31`;
  const data = await fetchAttendanceRows(employeeId, from, to);
  res.json({ data });
});

app.get("/api/attendance/summary/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const month = optionalMonth(req.query.month, getCurrentMonthKey());
  const from = `${month}-01`;
  const to = `${month}-31`;
  const data = await fetchSummary(employeeId, from, to);
  res.json({ data });
});

app.get("/api/attendance/range/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const range = requireDateRange(req, res);
  if (!range) return;
  const { from, to } = range;
  const data = await fetchAttendanceRows(employeeId, from, to);
  res.json({ data });
});

app.get("/api/attendance/summary-range/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const range = requireDateRange(req, res);
  if (!range) return;
  const { from, to } = range;
  const data = await fetchSummary(employeeId, from, to);
  res.json({ data });
});

app.get("/api/attendance/alerts/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const range = requireDateRange(req, res);
  if (!range) return;
  const { from, to } = range;

  const [rows] = await db.query(
    `SELECT employee_id, attendance_date, in_time, out_time, status
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );

  const data = buildAlerts(rows);
  res.json({ data, meta: { from, to, lateAfterMinutes: LATE_AFTER_MINUTES } });
});

app.post("/api/attendance/alerts/run/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const range = requireDateRange(req, res);
  if (!range) return;
  const { from, to } = range;

  const [rows] = await db.query(
    `SELECT employee_id, attendance_date, in_time, out_time, status
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );

  const alerts = buildAlerts(rows);
  if (alerts.length) {
    const values = alerts.map((a) => [a.employee_id, a.alert_date, a.alert_type, a.severity, a.detail]);
    await db.query(
      `INSERT INTO attendance_alerts(employee_id, alert_date, alert_type, severity, detail)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         severity = VALUES(severity),
         detail = VALUES(detail),
         updated_at = CURRENT_TIMESTAMP`,
      [values]
    );
  }

  res.json({ message: "alert rules evaluated", insertedOrUpdated: alerts.length, data: alerts });
});

app.get("/api/attendance/alerts-stored/:employeeId", async (req, res) => {
  const employeeId = requirePositiveIntParam(req, res, "employeeId");
  if (!employeeId) return;
  const range = requireDateRange(req, res);
  if (!range) return;
  const { from, to } = range;

  const [rows] = await db.query(
    `SELECT id, employee_id, alert_date, alert_type, severity, detail, created_at, updated_at
     FROM attendance_alerts
     WHERE employee_id = ? AND alert_date BETWEEN ? AND ?
     ORDER BY alert_date DESC, id DESC`,
    [employeeId, from, to]
  );

  res.json({ data: rows });
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "attendance" }));

const PORT = process.env.ATTENDANCE_SERVICE_PORT || 5002;
app.listen(PORT, () => {
  console.log(`Attendance service running on ${PORT}`);
});
