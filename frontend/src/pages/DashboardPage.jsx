import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import api from "../lib/api";
import { useEmployee } from "../context/EmployeeContext";
import DateRangeFilterBar from "../components/DateRangeFilterBar";

const COLORS = ["#1c4bcf", "#f14646", "#25bc5a"];

const toHHMM = (mins = 0) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const formatDate = (date) => date.toISOString().slice(0, 10);

function DashboardPage() {
  const { selectedEmployee, selectedEmployeeId } = useEmployee();
  const [filterDate, setFilterDate] = useState(formatDate(new Date()));
  const [summary, setSummary] = useState({
    totalWorkMinutes: 0,
    totalIdleMinutes: 0,
    totalSpanMinutes: 0
  });
  const [attendanceRows, setAttendanceRows] = useState([]);

  const range = useMemo(() => {
    const base = new Date(`${filterDate}T00:00:00`);
    const from = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
    const to = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-31`;
    return { from, to };
  }, [filterDate]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    Promise.all([
      api.get(`/admin/attendance/summary-range/${selectedEmployeeId}?from=${range.from}&to=${range.to}`)
        .catch(() => api.get(`/attendance/summary-range/${selectedEmployeeId}?from=${range.from}&to=${range.to}`)),
      api.get(`/admin/attendance/range/${selectedEmployeeId}?from=${range.from}&to=${range.to}`)
        .catch(() => api.get(`/attendance/range/${selectedEmployeeId}?from=${range.from}&to=${range.to}`))
    ])
      .then(([sumRes, rowsRes]) => {
        setSummary(sumRes.data.data || {});
        setAttendanceRows(rowsRes.data.data || []);
      })
      .catch(console.error);
  }, [range.from, range.to, selectedEmployeeId]);

  const recentRows = useMemo(() => attendanceRows.slice(-7).reverse(), [attendanceRows]);
  const presentDays = useMemo(
    () => attendanceRows.filter((r) => r.status === "PRESENT").length,
    [attendanceRows]
  );
  const absentDays = useMemo(
    () => attendanceRows.filter((r) => r.status === "ABSENT").length,
    [attendanceRows]
  );

  const pieData = useMemo(() => {
    const work = Number(summary.totalWorkMinutes || 0);
    const idle = Number(summary.totalIdleMinutes || 0);
    const other = Math.max(0, Number(summary.totalSpanMinutes || 0) - work - idle);
    const rows = [
      { name: "Work", value: work },
      { name: "Idle", value: idle },
      { name: "Other", value: other }
    ];
    return rows.filter((r) => r.value > 0);
  }, [summary.totalIdleMinutes, summary.totalSpanMinutes, summary.totalWorkMinutes]);

  return (
    <div className="screen-card">
      <div className="dashboard-shell">
        <div className="section-head">
          <h2>Dashboard</h2>
        </div>

        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Attendance Analytics</p>
            <h3>{selectedEmployee?.full_name || "Select Team Member"}</h3>
            <p>Monthly performance snapshot with work, idle, and presence insights.</p>
          </div>
        </div>
        <DateRangeFilterBar
          rangeLabel={new Date(`${filterDate}T00:00:00`).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric"
          })}
          anchorDate={filterDate}
          onAnchorDateChange={setFilterDate}
          anchorLabel="Select Date"
        />

        <div className="dashboard-kpi-grid">
          <div className="dashboard-kpi">
            <span>Working Time</span>
            <strong>{toHHMM(summary.totalWorkMinutes)}</strong>
          </div>
          <div className="dashboard-kpi">
            <span>Idle Time</span>
            <strong>{toHHMM(summary.totalIdleMinutes)}</strong>
          </div>
          <div className="dashboard-kpi">
            <span>Total Span</span>
            <strong>{toHHMM(summary.totalSpanMinutes)}</strong>
          </div>
          <div className="dashboard-kpi">
            <span>Present / Absent Days</span>
            <strong>
              {presentDays} / {absentDays}
            </strong>
          </div>
        </div>

        <div className="dashboard-content-grid">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-title">Time Distribution</div>
            <div className="dashboard-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${toHHMM(Number(value))} h`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-recent-card">
            <div className="dashboard-chart-title">Recent Attendance</div>
            <div className="table-scroll">
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Work</th>
                    <th>Idle</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date_label}</td>
                      <td>{row.status}</td>
                      <td>{row.in_time || "-"}</td>
                      <td>{row.out_time || "-"}</td>
                      <td>{row.status === "ABSENT" ? "-" : toHHMM(row.work_minutes)}</td>
                      <td>{row.status === "ABSENT" ? "-" : toHHMM(row.idle_minutes)}</td>
                    </tr>
                  ))}
                  {!recentRows.length && (
                    <tr>
                      <td colSpan={6}>No attendance data for selected month.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
