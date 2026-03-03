import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useEmployee } from "../context/EmployeeContext";

const EMPTY_FORM_BY_TAB = {
  department: { name: "", description: "" },
  section: { name: "", departmentId: "", description: "" },
  employee: { employeeCode: "", fullName: "", sectionId: "" }
};

function MastersPage() {
  const [tab, setTab] = useState("department");
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [masterEmployees, setMasterEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM_BY_TAB.department);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { setEmployees, selectedEmployeeId, setSelectedEmployeeId } = useEmployee();

  const fetchData = async () => {
    const [deptRes, sectionRes, employeeRes] = await Promise.all([
      api.get("/master/departments"),
      api.get("/master/sections"),
      api.get("/master/employees")
    ]);
    const loadedDepartments = deptRes.data.data || [];
    const loadedSections = sectionRes.data.data || [];
    const loadedEmployees = employeeRes.data.data || [];
    setDepartments(loadedDepartments);
    setSections(loadedSections);
    setMasterEmployees(loadedEmployees);
    setEmployees(loadedEmployees);
    if (selectedEmployeeId && !loadedEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(loadedEmployees[0]?.id || null);
    }
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

  const filteredMasterEmployees = useMemo(() => {
    if (!normalizedSearch) return masterEmployees;
    return masterEmployees.filter((employee) =>
      String(employee.id).includes(normalizedSearch)
      || String(employee.employee_code || "").toLowerCase().includes(normalizedSearch)
      || String(employee.full_name || "").toLowerCase().includes(normalizedSearch)
      || String(employee.department_name || "").toLowerCase().includes(normalizedSearch)
      || String(employee.section_name || "").toLowerCase().includes(normalizedSearch)
    );
  }, [masterEmployees, normalizedSearch]);

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
    } else if (tab === "section") {
      setForm({
        name: row.name || "",
        departmentId: row.department_id ? String(row.department_id) : "",
        description: row.description || ""
      });
    } else {
      setForm({
        employeeCode: row.employee_code || "",
        fullName: row.full_name || "",
        sectionId: row.section_id ? String(row.section_id) : ""
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
    if (tab === "employee" && (!form.employeeCode.trim() || !form.fullName.trim() || !form.sectionId)) {
      setFormError("Employee code, full name and section are required.");
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
      } else {
        const payload = {
          employee_code: form.employeeCode.trim(),
          full_name: form.fullName.trim(),
          section_id: Number(form.sectionId)
        };
        if (isEditMode) {
          await api.put(`/master/employees/${editingId}`, payload);
        } else {
          await api.post("/master/employees", payload);
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

    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Employee Code</th><th>Full Name</th><th>Department</th><th>Section</th><th>Action</th></tr>
          </thead>
          <tbody>
            {filteredMasterEmployees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.id}</td>
                <td>{employee.employee_code}</td>
                <td>{employee.full_name}</td>
                <td>{employee.department_name || "-"}</td>
                <td>{employee.section_name || "-"}</td>
                <td>
                  <button type="button" className="table-action-btn" onClick={() => openEditModal(employee)}>Edit</button>
                </td>
              </tr>
            ))}
            {!filteredMasterEmployees.length ? (
              <tr>
                <td colSpan={6} className="attendance-empty-row">No employees found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  };

  const modalTitle = `${isEditMode ? "Edit" : "Add"} ${tab === "department" ? "Department" : tab === "section" ? "Section" : "Employee"}`;

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

    return (
      <>
        <label>Employee Code:</label>
        <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
        <label>Full Name:</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <label>Section:</label>
        <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
          <option value="">Select section</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.department_name})</option>)}
        </select>
      </>
    );
  };

  return (
    <div className="screen-card">
      <div className="tab-row">
        <button className={`tab-btn ${tab === "department" ? "active" : ""}`} onClick={() => setTab("department")}>DEPARTMENT</button>
        <button className={`tab-btn ${tab === "section" ? "active" : ""}`} onClick={() => setTab("section")}>SECTION</button>
        <button className={`tab-btn ${tab === "employee" ? "active" : ""}`} onClick={() => setTab("employee")}>EMPLOYEE</button>
      </div>

      <div className="section-head">
        <h2>{tab === "department" ? "Departments" : tab === "section" ? "Sections" : "Employees"}</h2>
        <div className="section-head-actions">
          <input
            className="master-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tab}...`}
          />
          <button className="primary-btn" onClick={openAddModal}>+ ADD {tab.toUpperCase()}</button>
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
