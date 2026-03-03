import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

const EMPTY_FORM = { title: "", date: "", recurringYearly: false };

function AdminCalendarPage() {
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHolidays = async () => {
    const res = await api.get("/admin/calendar/holidays");
    setHolidays(res?.data?.data || []);
  };

  useEffect(() => {
    loadHolidays().catch(() => setHolidays([]));
  }, []);

  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))),
    [holidays]
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
  };

  const saveHoliday = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) {
      setError("Title and date are required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        date: form.date,
        recurringYearly: Boolean(form.recurringYearly)
      };
      if (editingId) {
        await api.put(`/admin/calendar/holidays/${editingId}`, payload);
      } else {
        await api.post("/admin/calendar/holidays", payload);
      }
      await loadHolidays();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to save holiday.");
    } finally {
      setLoading(false);
    }
  };

  const editHoliday = (holiday) => {
    setEditingId(holiday.id);
    setForm({
      title: holiday.title || "",
      date: holiday.date || "",
      recurringYearly: Boolean(holiday.recurringYearly || holiday.isRecurringYearly)
    });
    setError("");
  };

  const deleteHoliday = async (holiday) => {
    if (holiday.isSystemDefault || holiday.nonDeletable || holiday.type === "SUNDAY") return;
    setLoading(true);
    setError("");
    try {
      await api.delete(`/admin/calendar/holidays/${holiday.id}`);
      await loadHolidays();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to delete holiday.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Holiday Calendar</h2>
      </div>

      <form className="calendar-form" onSubmit={saveHoliday}>
        <input
          type="text"
          placeholder="Holiday title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
        />
        <label className="calendar-checkbox">
          <input
            type="checkbox"
            checked={form.recurringYearly}
            onChange={(e) => setForm((prev) => ({ ...prev, recurringYearly: e.target.checked }))}
          />
          Recurring yearly
        </label>
        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Saving..." : editingId ? "Update Holiday" : "Add Holiday"}
        </button>
        {editingId ? (
          <button type="button" className="ghost-btn" onClick={resetForm}>
            Cancel Edit
          </button>
        ) : null}
      </form>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Recurring</th>
              <th>Type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedHolidays.map((holiday) => {
              const isLocked = holiday.isSystemDefault || holiday.nonDeletable || holiday.type === "SUNDAY";
              return (
                <tr key={holiday.id || `${holiday.date}-${holiday.title}`}>
                  <td>{holiday.title || "Sunday"}</td>
                  <td>{holiday.date || "-"}</td>
                  <td>{holiday.recurringYearly || holiday.isRecurringYearly ? "Yes" : "No"}</td>
                  <td>{isLocked ? "Default" : "Custom"}</td>
                  <td>
                    {isLocked ? (
                      <span className="small-note">System controlled</span>
                    ) : (
                      <div className="row-actions">
                        <button type="button" className="table-action-btn" onClick={() => editHoliday(holiday)}>Edit</button>
                        <button type="button" className="ghost-btn" onClick={() => deleteHoliday(holiday)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sortedHolidays.length ? (
              <tr>
                <td colSpan={5} className="attendance-empty-row">No holidays configured.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminCalendarPage;
