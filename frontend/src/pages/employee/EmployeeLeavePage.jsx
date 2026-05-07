import { useEffect, useState } from "react";
import api from "../../lib/api";

const EMPTY_FORM = {
  leaveDate: "",
  leaveType: "CASUAL",
  reason: ""
};

function EmployeeLeavePage() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadRequests = async () => {
    const res = await api.get("/leave/me");
    setRequests(res?.data?.data || []);
  };

  useEffect(() => {
    loadRequests().catch(() => setRequests([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.leaveDate || !form.reason.trim()) {
      setError("Leave date and reason are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/leave/me", {
        leaveDate: form.leaveDate,
        leaveType: form.leaveType,
        reason: form.reason.trim()
      });
      setForm(EMPTY_FORM);
      setSuccess("Leave request submitted.");
      await loadRequests();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to submit leave request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Leave</h2>
      </div>

      <form className="leave-form-card" onSubmit={submit}>
        <div className="leave-form-grid">
          <label>
            Leave Date
            <input
              type="date"
              value={form.leaveDate}
              onChange={(e) => setForm((prev) => ({ ...prev, leaveDate: e.target.value }))}
            />
          </label>
          <label>
            Leave Type
            <select
              value={form.leaveType}
              onChange={(e) => setForm((prev) => ({ ...prev, leaveType: e.target.value }))}
            >
              <option value="CASUAL">Casual</option>
              <option value="SICK">Sick</option>
              <option value="EARNED">Earned</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>
        <label>
          Reason
          <textarea
            rows={4}
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Explain why you need leave"
          />
        </label>
        <div className="row-actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Submitting..." : "Submit Leave Request"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}
      </form>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Admin Note</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.leave_date}</td>
                <td>{request.leave_type}</td>
                <td>{request.reason}</td>
                <td>{request.status}</td>
                <td>{request.admin_note || "-"}</td>
              </tr>
            ))}
            {!requests.length ? (
              <tr>
                <td colSpan={5} className="attendance-empty-row">No leave requests submitted yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EmployeeLeavePage;
