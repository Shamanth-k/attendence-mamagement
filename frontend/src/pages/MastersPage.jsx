import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

const EMPTY_FORM_BY_TAB = {
  department: { name: "", description: "" },
  section: { name: "", departmentId: "", description: "" }
};

function MastersPage() {
  const [tab, setTab] = useState("department");
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM_BY_TAB.department);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    const [deptRes, sectionRes] = await Promise.all([
      api.get("/master/departments"),
      api.get("/master/sections")
    ]);
    const loadedDepartments = deptRes.data.data || [];
    const loadedSections = sectionRes.data.data || [];
    setDepartments(loadedDepartments);
    setSections(loadedSections);
  };

  useEffect(() => {
    fetchData().catch(console.error);
  }, []);

  useEffect(() => {
    setShowModal(false);
    setIsEditMode(false);
    setEditingId(null);
    setForm(EMPTY_FORM_BY_TAB[tab]);
    setFormError("");
    setSearchQuery("");
  }, [tab]);

  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const filteredDepartments = useMemo(() => {
    if (!normalizedSearch) return departments;
    return departments.filter((d) =>
      String(d.id).includes(normalizedSearch)
      || String(d.name || "").toLowerCase().includes(normalizedSearch)
      || String(d.description || "").toLowerCase().includes(normalizedSearch)
    );
  }, [departments, normalizedSearch]);

  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return sections;
    return sections.filter((s) =>
      String(s.id).includes(normalizedSearch)
      || String(s.name || "").toLowerCase().includes(normalizedSearch)
      || String(s.department_name || "").toLowerCase().includes(normalizedSearch)
      || String(s.description || "").toLowerCase().includes(normalizedSearch)
    );
  }, [sections, normalizedSearch]);

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setForm(EMPTY_FORM_BY_TAB[tab]);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (row) => {
    setIsEditMode(true);
    setEditingId(row.id);
    setFormError("");
    if (tab === "department") {
      setForm({ name: row.name || "", description: row.description || "" });
    } else {
      setForm({
        name: row.name || "",
        departmentId: row.department_id ? String(row.department_id) : "",
        description: row.description || ""
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setEditingId(null);
    setForm(EMPTY_FORM_BY_TAB[tab]);
    setFormError("");
  };

  const submit = async () => {
    if (isSubmitting) return;
    if (tab === "department" && !form.name.trim()) {
      setFormError("Department name is required.");
      return;
    }
    if (tab === "section" && (!form.name.trim() || !form.departmentId)) {
      setFormError("Section name and department are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      if (tab === "department") {
        const payload = {
          name: form.name.trim(),
          description: form.description?.trim() || ""
        };
        if (isEditMode) {
          await api.put(`/master/departments/${editingId}`, payload);
        } else {
          await api.post("/master/departments", payload);
        }
      } else if (tab === "section") {
        const payload = {
          name: form.name.trim(),
          department_id: Number(form.departmentId),
          description: form.description?.trim() || ""
        };
        if (isEditMode) {
          await api.put(`/master/sections/${editingId}`, payload);
        } else {
          await api.post("/master/sections", payload);
        }
      }
      await fetchData();
      closeModal();
    } catch (error) {
      setFormError(error?.response?.data?.message || "Unable to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTable = () => {
    if (tab === "department") {
      return (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Department Name</th><th>Description</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filteredDepartments.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.name}</td>
                  <td>{d.description || "-"}</td>
                  <td>
                    <button type="button" className="table-action-btn" onClick={() => openEditModal(d)}>Edit</button>
                  </td>
                </tr>
              ))}
              {!filteredDepartments.length ? (
                <tr>
                  <td colSpan={4} className="attendance-empty-row">No departments found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      );
    }

    if (tab === "section") {
      return (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Section ID</th><th>Section Name</th><th>Department</th><th>Description</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filteredSections.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.department_name}</td>
                  <td>{s.description || "-"}</td>
                  <td>
                    <button type="button" className="table-action-btn" onClick={() => openEditModal(s)}>Edit</button>
                  </td>
                </tr>
              ))}
              {!filteredSections.length ? (
                <tr>
                  <td colSpan={5} className="attendance-empty-row">No sections found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      );
    }

  };

  const modalTitle = `${isEditMode ? "Edit" : "Add"} ${tab === "department" ? "Department" : "Section"}`;

  const renderForm = () => {
    if (tab === "department") {
      return (
        <>
          <label>Department Name:</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label>Description:</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
        </>
      );
    }

    if (tab === "section") {
      return (
        <>
          <label>Section Name:</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label>Department:</label>
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Description:</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
        </>
      );
    }

  };

  return (
    <div className="screen-card">
      <div className="tab-row">
        <button className={`tab-btn ${tab === "department" ? "active" : ""}`} onClick={() => setTab("department")}>DEPARTMENT</button>
        <button className={`tab-btn ${tab === "section" ? "active" : ""}`} onClick={() => setTab("section")}>SECTION</button>
      </div>

      <div className="section-head">
        <h2>{tab === "department" ? "Departments" : "Sections"}</h2>
        <div className="section-head-actions">
          <input
            className="master-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tab}...`}
          />
          <button className="primary-btn" onClick={openAddModal}>
            + ADD {tab === "department" ? "DEPARTMENT" : "SECTION"}
          </button>
        </div>
      </div>

      {renderTable()}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>{modalTitle}</h3>
            {renderForm()}
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="modal-actions">
              <button className="primary-btn" onClick={submit} disabled={isSubmitting}>
                {isSubmitting ? "SAVING..." : isEditMode ? "UPDATE" : "ADD"}
              </button>
              <button className="ghost-btn" onClick={closeModal}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MastersPage;
