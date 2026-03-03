const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("report-service"));

const getCurrentMonthRange = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-31` };
};

const toHuman = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

const toHumanLong = (minutesValue) => {
  const totalSeconds = Math.round(Number(minutesValue || 0) * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min`;
  return `${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
};

const average = (arr) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0);

const stdDev = (arr) => {
  if (arr.length < 2) return 0;
  const mean = average(arr);
  const variance = arr.reduce((sum, value) => sum + (value - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
};

const linearSlope = (arr) => {
  if (arr.length < 2) return 0;
  const n = arr.length;
  const xMean = (n - 1) / 2;
  const yMean = average(arr);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xMean) * (arr[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

app.get("/api/report/chart/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const fallback = getCurrentMonthRange();
  const from = req.query.from || fallback.from;
  const to = req.query.to || fallback.to;

  const [rows] = await db.query(
    `SELECT DAY(attendance_date) AS day, COALESCE(work_minutes, 0) AS work_minutes
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );

  const points = rows.map((r) => ({
    day: r.day,
    hours: Number((r.work_minutes / 60).toFixed(2))
  }));

  const totalMinutes = rows.reduce((sum, r) => sum + r.work_minutes, 0);

  res.json({
    data: {
      points,
      total: toHuman(totalMinutes)
    }
  });
});

app.get("/api/report/url-usage/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const fallback = getCurrentMonthRange();
  const from = req.query.from || fallback.from;
  const to = req.query.to || fallback.to;

  const [rows] = await db.query(
    `SELECT app_name, ROUND(SUM(duration_minutes), 2) AS total_minutes
     FROM app_usage_logs
     WHERE employee_id = ? AND usage_date BETWEEN ? AND ?
     GROUP BY app_name
     ORDER BY total_minutes DESC, app_name ASC`,
    [employeeId, from, to]
  );

  const totalMinutes = rows.reduce((sum, row) => sum + Number(row.total_minutes || 0), 0);
  const topApp = rows[0]?.app_name || "-";

  res.json({
    data: {
      from,
      to,
      totalUsageMinutes: Number(totalMinutes.toFixed(2)),
      totalUsageLabel: toHumanLong(totalMinutes),
      topApp,
      apps: rows.map((r) => ({
        appName: r.app_name,
        totalMinutes: Number(r.total_minutes || 0),
        totalLabel: toHumanLong(r.total_minutes)
      }))
    }
  });
});

app.get("/api/report/predictive/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const fallback = getCurrentMonthRange();
  const from = req.query.from || fallback.from;
  const to = req.query.to || fallback.to;

  const [rows] = await db.query(
    `SELECT attendance_date, status, in_time, out_time
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );

  const totalDays = rows.length || 1;
  const absentDays = rows.filter((r) => r.status === "ABSENT").length;
  const presentDays = rows.filter((r) => r.status === "PRESENT").length;
  const lateDays = rows.filter((r) => r.status === "PRESENT" && r.in_time && r.in_time > "09:15").length;
  const missingPunchDays = rows.filter((r) => r.status === "PRESENT" && (!r.in_time || !r.out_time)).length;

  const absentRate = absentDays / totalDays;
  const lateRate = lateDays / totalDays;
  const missingRate = missingPunchDays / totalDays;
  const riskScore = Math.min(100, Math.round(absentRate * 60 * 100 + lateRate * 25 * 100 + missingRate * 15 * 100));
  const attendanceSeries = rows.map((r) => (r.status === "PRESENT" ? 1 : 0));
  const trendSlope = Number(linearSlope(attendanceSeries).toFixed(4));

  res.json({
    data: {
      from,
      to,
      totalDays: rows.length,
      presentDays,
      absentDays,
      lateDays,
      missingPunchDays,
      riskScore,
      riskBand: riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW",
      trendSlope,
      trendDirection: trendSlope < -0.03 ? "DECLINING" : trendSlope > 0.03 ? "IMPROVING" : "STABLE",
      forecast: {
        next30DaysExpectedAbsences: Number((absentRate * 30).toFixed(1)),
        next30DaysExpectedLateArrivals: Number((lateRate * 30).toFixed(1))
      }
    }
  });
});

app.get("/api/report/anomalies/:employeeId", async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const fallback = getCurrentMonthRange();
  const from = req.query.from || fallback.from;
  const to = req.query.to || fallback.to;

  const [rows] = await db.query(
    `SELECT attendance_date, work_minutes, idle_minutes, status
     FROM attendance_logs
     WHERE employee_id = ? AND attendance_date BETWEEN ? AND ? AND status = 'PRESENT'
     ORDER BY attendance_date`,
    [employeeId, from, to]
  );

  const work = rows.map((r) => Number(r.work_minutes || 0));
  const idle = rows.map((r) => Number(r.idle_minutes || 0));
  const workMean = average(work);
  const idleMean = average(idle);
  const workStd = stdDev(work);
  const idleStd = stdDev(idle);

  const anomalies = rows
    .map((r) => {
      const workZ = workStd ? (Number(r.work_minutes || 0) - workMean) / workStd : 0;
      const idleZ = idleStd ? (Number(r.idle_minutes || 0) - idleMean) / idleStd : 0;
      if (Math.abs(workZ) < 2 && Math.abs(idleZ) < 2) return null;
      return {
        date: r.attendance_date,
        workMinutes: Number(r.work_minutes || 0),
        idleMinutes: Number(r.idle_minutes || 0),
        workZ: Number(workZ.toFixed(2)),
        idleZ: Number(idleZ.toFixed(2)),
        reason:
          Math.abs(workZ) >= 2 && Math.abs(idleZ) >= 2
            ? "Work and idle both deviate from normal pattern"
            : Math.abs(workZ) >= 2
              ? "Work duration anomaly"
              : "Idle duration anomaly"
      };
    })
    .filter(Boolean);

  res.json({
    data: {
      from,
      to,
      baseline: {
        workMean: Number(workMean.toFixed(2)),
        workStd: Number(workStd.toFixed(2)),
        idleMean: Number(idleMean.toFixed(2)),
        idleStd: Number(idleStd.toFixed(2))
      },
      anomalies
    }
  });
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "report" }));

const PORT = process.env.REPORT_SERVICE_PORT || 5003;
app.listen(PORT, () => {
  console.log(`Report service running on ${PORT}`);
});
