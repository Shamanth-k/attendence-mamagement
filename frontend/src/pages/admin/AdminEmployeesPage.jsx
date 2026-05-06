import { useEffect, useMemo, useState } from "react";
import api, { authApi } from "../../lib/api";

const PAGE_SIZE = 50;

function AdminEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingEmployeeId, setLoadingEmployeeId] = useState(null);
  const [resultById, setResultById] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeCode: "",
    fullName: "",
    departmentId: "",
    sectionId: ""
  });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchReferenceData().catch(() => {
      setDepartments([]);
      setSections([]);
    });
  }, []);

  useEffect(() => {
    fetchEmployees(page).catch(() => {
      setEmployees([]);
      setTotalEmployees(0);
    });
  }, [page]);

  const fetchEmployees = async (targetPage = page) => {
    const offset = (targetPage - 1) * PAGE_SIZE;
    const employeesRes = await api.get("/master/employees", {
      params: { limit: PAGE_SIZE, offset }
    });
    setEmployees(employeesRes?.data?.data || []);
    setTotalEmployees(Number(employeesRes?.data?.meta?.total || 0));
  };

  const fetchReferenceData = async () => {
    const [departmentsRes, sectionsRes] = await Promise.all([
      api.get("/master/departments"),
      api.get("/master/sections")
    ]);
    setDepartments(departmentsRes?.data?.data || []);
    setSections(sectionsRes?.data?.data || []);
  };

  const availableSections = useMemo(
    () => sections.filter((section) => String(section.department_id) === String(form.departmentId)),
    [sections, form.departmentId]
  );
  const totalPages = Math.max(Math.ceil(totalEmployees / PAGE_SIZE), 1);

  const resetForm = () => {
    setForm({
      employeeCode: "",
      fullName: "",
      departmentId: "",
      sectionId: ""
    });
    setFormError("");
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (employee) => {
    setIsEditMode(true);
    setEditingId(employee.id);
    setForm({
      employeeCode: employee.employee_code || "",
      fullName: employee.full_name || "",
      departmentId: employee.department_id ? String(employee.department_id) : "",
      sectionId: employee.section_id ? String(employee.section_id) : ""
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const submitEmployee = async () => {
    if (isSubmitting) return;
    if (!form.employeeCode.trim() || !form.fullName.trim()) {
      setFormError("Employee code and full name are required.");
      return;
    }
    if (!form.departmentId || !form.sectionId) {
      setFormError("Department and section are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setError("");
    try {
      const payload = {
        employee_code: form.employeeCode.trim(),
        full_name: form.fullName.trim(),
        section_id: Number(form.sectionId)
      };

      if (isEditMode) {
        const res = await api.put(`/master/employees/${editingId}`, payload);
        const updatedEmployee = res?.data?.data;
        if (updatedEmployee?.id) {
          setEmployees((prev) =>
            prev.map((employee) => (employee.id === updatedEmployee.id ? updatedEmployee : employee))
          );
        }
        closeModal();
      } else {
        await api.post("/master/employees", payload);
        await fetchEmployees(page);
        closeModal();
      }
    } catch (err) {
      if (err?.code === "ECONNABORTED") {
        setFormError("Request timed out. Check that gateway/master service is running.");
      } else {
        setFormError(err?.response?.data?.message || "Unable to save employee.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h2>Employees</h2>
        <button type="button" className="primary-btn" onClick={openAddModal}>
          + ADD EMPLOYEE
        </button>
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
              <th>Section</th>
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
                <td>{employee.section_name || "-"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="table-action-btn"
                      onClick={() => openEditModal(employee)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-action-btn"
                      onClick={() => generateResetLink(employee.id)}
                      disabled={loadingEmployeeId === employee.id}
                    >
                      {loadingEmployeeId === employee.id ? "Generating..." : "Generate Reset Link"}
                    </button>
                  </div>
                  {resultById[employee.id] ? <p className="small-note">{resultById[employee.id]}</p> : null}
                </td>
              </tr>
            ))}
            {!employees.length ? (
              <tr>
                <td colSpan={6} className="attendance-empty-row">No employees found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="section-head">
        <p className="small-note">
          Showing page {page} of {totalPages} ({totalEmployees} employees)
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="table-action-btn"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="table-action-btn"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {showModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>{isEditMode ? "Edit Employee" : "Add Employee"}</h3>

            <label>Employee Code:</label>
            <input
              value={form.employeeCode}
              onChange={(e) => setForm((prev) => ({ ...prev, employeeCode: e.target.value }))}
            />

            <label>Full Name:</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />

            <label>Department:</label>
            <select
              value={form.departmentId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  departmentId: e.target.value,
                  sectionId: ""
                }))
              }
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>

            <label>Section:</label>
            <select
              value={form.sectionId}
              onChange={(e) => setForm((prev) => ({ ...prev, sectionId: e.target.value }))}
              disabled={!form.departmentId}
            >
              <option value="">Select section</option>
              {availableSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>

            {formError ? <p className="form-error">{formError}</p> : null}

            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={submitEmployee} disabled={isSubmitting}>
                {isSubmitting ? "SAVING..." : isEditMode ? "UPDATE" : "ADD"}
              </button>
              <button type="button" className="ghost-btn" onClick={closeModal}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminEmployeesPage;

