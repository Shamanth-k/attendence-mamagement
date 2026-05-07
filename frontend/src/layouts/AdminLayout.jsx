import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import api from "../lib/api";
import { useEmployee } from "../context/EmployeeContext";
import { useAuth } from "../context/AuthContext";

function AdminLayout() {
  const { logout } = useAuth();
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const { employees, setEmployees, selectedEmployeeId, setSelectedEmployeeId } = useEmployee();

  useEffect(() => {
    api
      .get("/master/employees")
      .then((res) => {
        const loaded = res?.data?.data || [];
        setEmployees(loaded);
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [setEmployees]);

  const departmentOptions = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      if (!employee.department_id) return;
      map.set(employee.department_id, employee.department_name || `Department ${employee.department_id}`);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id: String(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const byDepartment = departmentFilter === "all"
      ? employees
      : employees.filter((employee) => String(employee.department_id) === departmentFilter);
    const liveSearch = searchInput.trim().toLowerCase();
    if (!liveSearch) return byDepartment;
    return byDepartment.filter((employee) => {
      const fullName = String(employee.full_name || "").toLowerCase();
      const code = String(employee.employee_code || "").toLowerCase();
      return fullName.includes(liveSearch) || code.includes(liveSearch);
    });
  }, [employees, departmentFilter, searchInput]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      if (selectedEmployeeId) setSelectedEmployeeId(null);
      return;
    }
    const selectedVisible = filteredEmployees.some((employee) => employee.id === selectedEmployeeId);
    if (!selectedVisible) {
      setSelectedEmployeeId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, selectedEmployeeId, setSelectedEmployeeId]);

  return (
    <div className="layout-root">
      <aside className="icon-rail">
        <div className="app-logo">A</div>
        <NavLink title="Dashboard" to="/admin/dashboard" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>D</NavLink>
        <NavLink title="Masters" to="/admin/masters" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>M</NavLink>
        <NavLink title="Employees" to="/admin/employees" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>E</NavLink>
        <NavLink title="Calendar" to="/admin/calendar" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>C</NavLink>
        <NavLink title="Attendance" to="/admin/attendance" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>At</NavLink>
        <NavLink title="Report" to="/admin/report" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>R</NavLink>
        <NavLink title="Biometric" to="/admin/biometric" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>B</NavLink>
        <NavLink title="Leave" to="/admin/leave" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>L</NavLink>
        <div className="rail-spacer" />
        <NavLink title="Profile" to="/admin/profile" className={({ isActive }) => `rail-icon rail-icon-filled ${isActive ? "active" : ""}`}>P</NavLink>
      </aside>

      <aside className="team-panel">
        <h2>Employees</h2>
        <div className="team-filter-wrap">
          <label htmlFor="admin-department-filter" className="team-filter-label">Department</label>
          <select
            id="admin-department-filter"
            className="team-filter-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>
        <div className="team-search-wrap">
          <label htmlFor="admin-employee-search" className="team-filter-label">Search</label>
          <input
            id="admin-employee-search"
            className="team-search-input"
            type="text"
            placeholder="Name or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="team-list">
          {filteredEmployees.map((employee) => (
            <button
              key={employee.id}
              className={`team-item ${selectedEmployeeId === employee.id ? "active" : ""}`}
              onClick={() => setSelectedEmployeeId(employee.id)}
              type="button"
            >
              {employee.full_name}
            </button>
          ))}
        </div>
      </aside>

      <main className="main-area">
        <header className="top-nav">
          <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Dashboard</NavLink>
          <NavLink to="/admin/masters" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Master Data</NavLink>
          <NavLink to="/admin/employees" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Employees</NavLink>
          <NavLink to="/admin/calendar" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Calendar</NavLink>
          <NavLink to="/admin/attendance" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Attendance</NavLink>
          <NavLink to="/admin/report" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Report</NavLink>
          <NavLink to="/admin/biometric" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Biometric</NavLink>
          <NavLink to="/admin/leave" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Leave</NavLink>
          <NavLink to="/admin/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Profile</NavLink>
          <button type="button" className="top-logout-btn" onClick={logout}>Logout</button>
        </header>
        <section className="content-wrap">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AdminLayout;
