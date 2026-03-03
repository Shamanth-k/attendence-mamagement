import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../../lib/api";
import DateRangeFilterBar from "../../components/DateRangeFilterBar";

const RANGE_OPTIONS = ["day", "week", "month", "date-range"];
const DISPLAY_LABEL = {
  day: "Today",
  week: "This Week",
  month: "This Month",
  "date-range": "Custom Range"
};

const formatDate = (date) => date.toISOString().slice(0, 10);
const todayString = () => formatDate(new Date());
const monthStart = (dateStr) => `${dateStr.slice(0, 7)}-01`;
const monthEnd = (dateStr) => `${dateStr.slice(0, 7)}-31`;
const dayLabel = (date) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function getRange(period, anchorDate, customFrom, customTo) {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  if (period === "day") return { from: formatDate(anchor), to: formatDate(anchor), label: dayLabel(anchor) };
  if (period === "week") {
    const d = new Date(anchor);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    const start = new Date(d);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return { from: formatDate(start), to: formatDate(end), label: `${dayLabel(start)} - ${dayLabel(end)}` };
  }
  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: formatDate(start), to: formatDate(end), label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
  }
  const safeFrom = customFrom || anchorDate;
  const safeTo = customTo || anchorDate;
  const from = safeFrom <= safeTo ? safeFrom : safeTo;
  const to = safeFrom <= safeTo ? safeTo : safeFrom;
  return { from, to, label: `${dayLabel(new Date(`${from}T00:00:00`))} - ${dayLabel(new Date(`${to}T00:00:00`))}` };
}

function EmployeeReportPage() {
  const today = todayString();
  const [period, setPeriod] = useState("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [customFrom, setCustomFrom] = useState(monthStart(today));
  const [customTo, setCustomTo] = useState(monthEnd(today));
  const [data, setData] = useState([]);
  const [total, setTotal] = useState("00h 00m");

  const range = useMemo(
    () => getRange(period, anchorDate, customFrom, customTo),
    [period, anchorDate, customFrom, customTo]
  );

  useEffect(() => {
    api
      .get(`/report/me/chart?from=${range.from}&to=${range.to}`)
      .then((res) => {
        setData(res?.data?.data?.points || []);
        setTotal(res?.data?.data?.total || "00h 00m");
      })
      .catch(() => {
        setData([]);
        setTotal("00h 00m");
      });
  }, [range.from, range.to]);

  const formatted = useMemo(
    () => data.map((d) => ({ ...d, label: String(d.day).padStart(2, "0") })),
    [data]
  );
  const activeDays = useMemo(
    () => formatted.filter((d) => Number(d.hours || 0) > 0).length,
    [formatted]
  );
  const averageHours = useMemo(() => {
    if (!formatted.length) return 0;
    const sum = formatted.reduce((acc, item) => acc + Number(item.hours || 0), 0);
    return sum / formatted.length;
  }, [formatted]);

  return (
    <div className="screen-card report-page">
      <div className="report-header">
        <div>
          <p className="report-eyebrow">Productivity Report</p>
          <h2 className="report-title">My Report</h2>
        </div>
        <div className="report-period-chip">{range.label}</div>
      </div>

      <div className="report-filter-card">
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

      <div className="report-kpi-grid">
        <div className="report-kpi-card"><span>Total Work</span><strong>{total}</strong></div>
        <div className="report-kpi-card"><span>Tracked Days</span><strong>{formatted.length}</strong></div>
        <div className="report-kpi-card"><span>Active Days</span><strong>{activeDays}</strong></div>
        <div className="report-kpi-card"><span>Avg Hours / Day</span><strong>{averageHours.toFixed(2)}h</strong></div>
      </div>

      <div className="report-chart-card">
        <div className="report-chart-head">
          <p>Daily Working Hours</p>
          <span>Hours</span>
        </div>
        {formatted.length === 0 ? (
          <div className="report-empty-state">No report data found for this period.</div>
        ) : (
          <div className="report-chart-wrap">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={formatted} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8ebf0" vertical={false} />
                <XAxis dataKey="label" stroke="#5b6f96" />
                <YAxis stroke="#7d8aa3" />
                <Tooltip cursor={{ fill: "rgba(41, 89, 211, 0.08)" }} contentStyle={{ borderRadius: 10, border: "1px solid #d4dff4" }} />
                <Bar dataKey="hours" fill="#2b57d6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeReportPage;
