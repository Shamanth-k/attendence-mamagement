import { useEffect, useState } from "react";
import api, { authApi } from "../../lib/api";

function AdminEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployeeId, setLoadingEmployeeId] = useState(null);
  const [resultById, setResultById] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/master/employees")
      .then((res) => setEmployees(res?.data?.data || []))
      .catch(() => setEmployees([]));
  }, []);

  const generateResetLink = async (employeeId) => {
    setError("");
    setLoadingEmployeeId(employeeId);
    try {
      const res = await authApi.post(`/auth/generate-reset/${employeeId}`);
      const link = res?.data?.data?.resetLink || res?.data?.data?.url || "Reset link generated and sent.";
      setResultById((prev) => ({ ...prev, [employeeId]: link }));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to generate reset link.");
    } finally {
      setLoadingEmployeeId(null);
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Employee Password Reset</h2>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee Code</th>
              <th>Full Name</th>
              <th>Department</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.id}</td>
                <td>{employee.employee_code}</td>
                <td>{employee.full_name}</td>
                <td>{employee.department_name || "-"}</td>
                <td>
                  <button
                    type="button"
                    className="table-action-btn"
                    onClick={() => generateResetLink(employee.id)}
                    disabled={loadingEmployeeId === employee.id}
                  >
                    {loadingEmployeeId === employee.id ? "Generating..." : "Generate Reset Link"}
                  </button>
                  {resultById[employee.id] ? <p className="small-note">{resultById[employee.id]}</p> : null}
                </td>
              </tr>
            ))}
            {!employees.length ? (
              <tr>
                <td colSpan={5} className="attendance-empty-row">No employees found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminEmployeesPage;

