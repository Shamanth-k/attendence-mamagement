import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import DateRangeFilterBar from "../../components/DateRangeFilterBar";

const RANGE_OPTIONS = ["day", "week", "month", "date-range"];
const DISPLAY_LABEL = {
  day: "Today",
  week: "This Week",
  month: "This Month",
  "date-range": "Custom Range"
};

const toHHMM = (mins = 0) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const formatDate = (date) => date.toISOString().slice(0, 10);
const monthKey = (date) => date.toISOString().slice(0, 7);
const todayString = () => formatDate(new Date());
const monthStart = (dateStr) => `${dateStr.slice(0, 7)}-01`;
const monthEnd = (dateStr) => `${dateStr.slice(0, 7)}-31`;
const prettyDate = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

function getRange(period, anchorDate, customFrom, customTo) {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  if (period === "day") {
    const d = formatDate(anchor);
    return { from: d, to: d, label: prettyDate(d) };
  }
  if (period === "week") {
    const d = new Date(anchor);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    const start = new Date(d);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const from = formatDate(start);
    const to = formatDate(end);
    return { from, to, label: `${prettyDate(from)} - ${prettyDate(to)}` };
  }
  if (period === "month") {
    return {
      from: `${monthKey(anchor)}-01`,
      to: `${monthKey(anchor)}-31`,
      label: anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    };
  }
  const safeFrom = customFrom || anchorDate;
  const safeTo = customTo || anchorDate;
  const from = safeFrom <= safeTo ? safeFrom : safeTo;
  const to = safeFrom <= safeTo ? safeTo : safeFrom;
  return { from, to, label: `${prettyDate(from)} - ${prettyDate(to)}` };
}

function EmployeeAttendancePage() {
  const today = todayString();
  const [period, setPeriod] = useState("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [customFrom, setCustomFrom] = useState(monthStart(today));
  const [customTo, setCustomTo] = useState(monthEnd(today));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 });

  const range = useMemo(
    () => getRange(period, anchorDate, customFrom, customTo),
    [period, anchorDate, customFrom, customTo]
  );
  const headerHours = useMemo(
    () => ["7 AM", "9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM", "9 PM", "11 PM", "1 AM", "3 AM", "5 AM"],
    []
  );

  useEffect(() => {
    Promise.all([
      api.get(`/attendance/me/range?from=${range.from}&to=${range.to}`),
      api.get(`/attendance/me/summary-range?from=${range.from}&to=${range.to}`)
    ])
      .then(([r, s]) => {
        setRows(r?.data?.data || []);
        setSummary(s?.data?.data || { totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 });
      })
      .catch(() => {
        setRows([]);
        setSummary({ totalWorkMinutes: 0, totalIdleMinutes: 0, totalSpanMinutes: 0 });
      });
  }, [range.from, range.to]);

  return (
    <div className="screen-card attendance-page">
      <div className="attendance-hero">
        <div>
          <p className="attendance-eyebrow">Attendance Overview</p>
          <h2 className="attendance-title">My Attendance</h2>
        </div>
        <div className="attendance-period-chip">{range.label}</div>
      </div>

      <div className="attendance-filter-card">
        <DateRangeFilterBar
          period={period}
          rangeOptions={RANGE_OPTIONS}
          labels={DISPLAY_LABEL}
          onPeriodChange={setPeriod}
          rangeLabel={range.label}
          anchorDate={anchorDate}
          onAnchorDateChange={setAnchorDate}
          showDateRange={period === "date-range"}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <div className="attendance-kpi-grid">
        <div className="attendance-kpi-card">
          <p>Total Working Time</p>
          <h3>{toHHMM(summary.totalWorkMinutes)}</h3>
        </div>
        <div className="attendance-kpi-card">
          <p>Total Time Span</p>
          <h3>{toHHMM(summary.totalSpanMinutes)}</h3>
        </div>
        <div className="attendance-kpi-card">
          <p>Idle Time</p>
          <h3>{toHHMM(summary.totalIdleMinutes)}</h3>
        </div>
      </div>

      <div className="attendance-table-card">
        <div className="attendance-table-head">
          <p>Daily Timeline</p>
          <span>{rows.length} day(s)</span>
        </div>
        <div className="table-scroll">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>In Time</th>
                <th>Finish</th>
                <th>Work</th>
                <th>Idle</th>
                {headerHours.map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="attendance-empty-row">No attendance records found for this period.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date_label}</td>
                    <td>{r.in_time || "-"}</td>
                    <td>{r.out_time || "-"}</td>
                    <td>{r.status === "ABSENT" ? "-" : toHHMM(r.work_minutes)}</td>
                    <td>{r.status === "ABSENT" ? "-" : toHHMM(r.idle_minutes)}</td>
                    <td colSpan={12}>
                      {r.status === "ABSENT" ? (
                        <span className="absent">Absent</span>
                      ) : (
                        <div className="timeline-row">
                          <div className="line-bg" />
                          <div className="line-work" style={{ left: `${r.work_start_pct}%`, width: `${r.work_first_span_pct}%` }} />
                          <div className="line-idle" style={{ left: `${r.idle_start_pct}%`, width: `${r.idle_span_pct}%` }} />
                          <div className="line-work" style={{ left: `${r.work_second_start_pct}%`, width: `${r.work_second_span_pct}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EmployeeAttendancePage;
