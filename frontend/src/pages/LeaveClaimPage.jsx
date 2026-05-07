import { useEffect, useState } from "react";
import api from "../lib/api";

function LeaveClaimPage() {
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const loadRequests = async () => {
    const res = await api.get("/admin/leave");
    setRequests(res?.data?.data || []);
  };

  useEffect(() => {
    loadRequests().catch(() => {
      setRequests([]);
      setError("Unable to load leave requests.");
    });
  }, []);

  const updateStatus = async (id, status) => {
    setLoadingId(id);
    setError("");
    try {
      await api.patch(`/admin/leave/${id}`, {
        status,
        adminNote: notes[id] || ""
      });
      await loadRequests();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update leave request.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Leave Requests</h2>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Code</th>
              <th>Date</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Admin Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.full_name || request.username}</td>
                <td>{request.employee_code || "-"}</td>
                <td>{request.leave_date}</td>
                <td>{request.leave_type}</td>
                <td>{request.reason}</td>
                <td>{request.status}</td>
                <td>
                  {request.status === "PENDING" ? (
                    <textarea
                      rows={2}
                      value={notes[request.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                      placeholder="Optional admin note"
                    />
                  ) : (
                    request.admin_note || "-"
                  )}
                </td>
                <td>
                  {request.status === "PENDING" ? (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={() => updateStatus(request.id, "APPROVED")}
                        disabled={loadingId === request.id}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => updateStatus(request.id, "REJECTED")}
                        disabled={loadingId === request.id}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="small-note">Reviewed</span>
                  )}
                </td>
              </tr>
            ))}
            {!requests.length ? (
              <tr>
                <td colSpan={8} className="attendance-empty-row">No leave requests found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeaveClaimPage;
