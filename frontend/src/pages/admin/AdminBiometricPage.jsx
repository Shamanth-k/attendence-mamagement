import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useEmployee } from "../../context/EmployeeContext";

const formatDate = (date) => date.toISOString().slice(0, 10);

function AdminBiometricPage() {
  const today = formatDate(new Date());
  const startOfMonth = `${today.slice(0, 7)}-01`;
  const { selectedEmployee } = useEmployee();
  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const employeeCode = selectedEmployee?.employee_code || "";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (employeeCode) params.set("employeeCode", employeeCode);
    return params.toString();
  }, [employeeCode, from, to]);

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/biometric/logs?${queryString}`);
      setRows(res?.data?.data || []);
    } catch (err) {
      setRows([]);
      setError(err?.response?.data?.message || "Unable to load biometric logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs().catch(() => {});
  }, [queryString]);

  const downloadCsv = async () => {
    try {
      const res = await api.get(`/admin/biometric/logs?${queryString}&format=csv`, {
        responseType: "blob"
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "biometric-logs.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to export biometric logs.");
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Biometric Logs</h2>
        <div className="row-actions">
          <button type="button" className="table-action-btn" onClick={loadLogs} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="primary-btn" onClick={downloadCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="biometric-filter-row">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="biometric-filter-static">
          Employee
          <div>{selectedEmployee?.full_name || "All employees"}</div>
        </label>
        <label className="biometric-filter-static">
          Code
          <div>{employeeCode || "-"}</div>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-scroll">
        <table className="data-table biometric-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Employee</th>
              <th>Code</th>
              <th>Department</th>
              <th>Section</th>
              <th>Scanner</th>
              <th>Punch</th>
              <th>Source</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.deviceTimestamp).toLocaleString("en-GB")}</td>
                <td>{row.fullName || "-"}</td>
                <td>{row.employeeCode}</td>
                <td>{row.departmentName || "-"}</td>
                <td>{row.sectionName || "-"}</td>
                <td>{row.scannerId || "-"}</td>
                <td>{row.punchType || "-"}</td>
                <td>{row.sourceType || "-"}</td>
                <td>
                  <code className="payload-chip">{JSON.stringify(row.payload || {})}</code>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="attendance-empty-row">
                  No biometric logs found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminBiometricPage;
