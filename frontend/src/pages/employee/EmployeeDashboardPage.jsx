import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import api from "../../lib/api";

const COLORS = ["#1c4bcf", "#f14646", "#25bc5a"];
const STATUS_COLORS = {
  PRESENT: "#25bc5a",
  ABSENT: "#f14646",
  HOLIDAY: "#f1c24a",
  FUTURE: "#c5ccd9"
};

const toHHMM = (mins = 0) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const monthDateRange = (dateStr) => {
  const base = new Date(`${dateStr}T00:00:00`);
  const from = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const to = formatDate(end);
  return { from, to };
};

function buildMonthDays(anchorDate) {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const prefix = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < prefix; i += 1) days.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) {
    days.push(new Date(anchor.getFullYear(), anchor.getMonth(), d));
  }
  return days;
}

function EmployeeDashboardPage() {
  const today = formatDate(new Date());
  const [anchorDate, setAnchorDate] = useState(today);
  const [summary, setSummary] = useState({ totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 });
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const range = useMemo(() => monthDateRange(anchorDate), [anchorDate]);

  useEffect(() => {
    Promise.all([
      api.get(`/attendance/me/summary-range?from=${range.from}&to=${range.to}`),
      api.get(`/attendance/me/range?from=${range.from}&to=${range.to}`),
      api.get(`/calendar/holidays?from=${range.from}&to=${range.to}`)
    ])
      .then(([sumRes, rowsRes, holidayRes]) => {
        setSummary(sumRes?.data?.data || {});
        setAttendanceRows(rowsRes?.data?.data || []);
        setHolidays(holidayRes?.data?.data || []);
      })
      .catch(() => {
        setSummary({ totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 });
        setAttendanceRows([]);
        setHolidays([]);
      });
  }, [range.from, range.to]);

  const pieData = useMemo(() => {
    const work = Number(summary.totalWorkMinutes || 0);
    const idle = Number(summary.totalIdleMinutes || 0);
    const other = Math.max(0, Number(summary.totalSpanMinutes || 0) - work - idle);
    return [
      { name: "Work", value: work },
      { name: "Idle", value: idle },
      { name: "Other", value: other }
    ].filter((r) => r.value > 0);
  }, [summary.totalWorkMinutes, summary.totalIdleMinutes, summary.totalSpanMinutes]);

  const dayStatusMap = useMemo(() => {
    const map = new Map();
    attendanceRows.forEach((row) => {
      map.set(row.date, row.status);
    });
    return map;
  }, [attendanceRows]);

  const holidayMap = useMemo(() => {
    const map = new Map();
    holidays.forEach((holiday) => {
      if (holiday.date) map.set(holiday.date, holiday.title || "Holiday");
    });
    return map;
  }, [holidays]);

  const calendarDays = useMemo(() => buildMonthDays(anchorDate), [anchorDate]);

  const resolveStatus = (dateStr) => {
    if (dateStr > today) return "FUTURE";
    if (holidayMap.has(dateStr)) return "HOLIDAY";
    const status = dayStatusMap.get(dateStr);
    if (status === "PRESENT") return "PRESENT";
    if (status === "ABSENT") return "ABSENT";
    return "ABSENT";
  };

  return (
    <div className="screen-card">
      <div className="dashboard-shell">
        <div className="section-head">
          <h2>My Dashboard</h2>
          <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </div>
        <div className="dashboard-kpi-grid">
          <div className="dashboard-kpi"><span>Working Time</span><strong>{toHHMM(summary.totalWorkMinutes)}</strong></div>
          <div className="dashboard-kpi"><span>Idle Time</span><strong>{toHHMM(summary.totalIdleMinutes)}</strong></div>
          <div className="dashboard-kpi"><span>Total Span</span><strong>{toHHMM(summary.totalSpanMinutes)}</strong></div>
          <div className="dashboard-kpi"><span>Month</span><strong>{new Date(`${anchorDate}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong></div>
        </div>

        <div className="dashboard-content-grid">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-title">Time Distribution</div>
            <div className="dashboard-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={95} label>
                    {pieData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `${toHHMM(Number(value))} h`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-recent-card">
            <div className="dashboard-chart-title">Attendance Calendar</div>
            <div className="legend-row">
              <span><i style={{ background: STATUS_COLORS.PRESENT }} />Present</span>
              <span><i style={{ background: STATUS_COLORS.ABSENT }} />Absent</span>
              <span><i style={{ background: STATUS_COLORS.HOLIDAY }} />Holiday</span>
              <span><i style={{ background: STATUS_COLORS.FUTURE }} />Future</span>
            </div>
            <div className="calendar-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="calendar-head">{day}</div>
              ))}
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={`blank-${idx}`} className="calendar-cell empty" />;
                const dateStr = formatDate(date);
                const status = resolveStatus(dateStr);
                return (
                  <div
                    key={dateStr}
                    className="calendar-cell"
                    style={{ background: `${STATUS_COLORS[status]}22`, borderColor: STATUS_COLORS[status] }}
                    title={`${dateStr} - ${holidayMap.get(dateStr) || status}`}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboardPage;
