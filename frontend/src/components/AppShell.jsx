import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import api from "../lib/api";
import { useEmployee } from "../context/EmployeeContext";

const DashboardIcon = () => (
  <svg className="rail-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="10" width="8" height="11" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

const AttendanceIcon = () => (
  <svg className="rail-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <line x1="7" y1="11" x2="17" y2="11" />
    <line x1="7" y1="15" x2="13" y2="15" />
  </svg>
);

const ReportIcon = () => (
  <svg className="rail-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20V10" />
    <path d="M10 20V6" />
    <path d="M16 20V13" />
    <path d="M22 20H2" />
  </svg>
);

const MasterDataIcon = () => (
  <svg className="rail-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6.5h18" />
    <path d="M3 12h18" />
    <path d="M3 17.5h18" />
    <path d="M6 4v4" />
    <path d="M12 9.5v4" />
    <path d="M18 15v4" />
  </svg>
);

const ProfileIcon = () => (
  <svg className="rail-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 19a7 7 0 0 1 14 0" />
  </svg>
);

function AppShell() {
  const authBaseUrl = useMemo(() => {
    const configured = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
    return configured.replace(/\/api\/?$/, "");
  }, []);

  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [auth, setAuth] = useState(() => {
    const savedToken = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("auth_user");
    let parsedUser = null;
    try {
      parsedUser = savedUser ? JSON.parse(savedUser) : null;
    } catch {
      parsedUser = null;
    }
    return {
      token: savedToken || "",
      user: parsedUser
    };
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const isAuthenticated = Boolean(auth.token && auth.user);

  const {
    employees,
    setEmployees,
    selectedEmployeeId,
    setSelectedEmployeeId
  } = useEmployee();

  useEffect(() => {
    if (auth.token) {
      api.defaults.headers.common.Authorization = `Bearer ${auth.token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [auth.token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get("/master/employees")
      .then((res) => {
        const loaded = res.data.data || [];
        setEmployees(loaded);
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [auth.token, isAuthenticated, setEmployees]);

  useEffect(() => {
    if (!employees.length) {
      setDepartmentFilter("all");
      setSearchInput("");
    }
  }, [employees.length]);

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
      const employeeCode = String(employee.employee_code || "").toLowerCase();
      return fullName.includes(liveSearch) || employeeCode.includes(liveSearch);
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

  const login = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      setAuthError("Username and password are required.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await api.post(`${authBaseUrl}/auth/login`, credentials);
      const token = response.data?.data?.token;
      const user = response.data?.data?.user || null;
      if (!token) throw new Error("missing token");
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      setAuth({ token, user });
      setCredentials({ username: "", password: "" });
    } catch {
      setAuthError("Login failed. Check credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuth({ token: "", user: null });
    setEmployees([]);
    setSelectedEmployeeId(null);
    setAuthError("");
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <form className="auth-screen-card" onSubmit={login}>
          <h1>Attendance Login</h1>
          <p>Sign in to continue.</p>
          <input
            type="text"
            placeholder="Username"
            value={credentials.username}
            onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Password"
            value={credentials.password}
            onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
          />
          <button type="submit" className="panel-auth-btn" disabled={authLoading}>
            {authLoading ? "Signing in..." : "Login"}
          </button>
          {authError ? <p className="panel-auth-error">{authError}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="layout-root">
      <aside className="icon-rail">
        <div className="app-logo">✣</div>
        <NavLink title="Dashboard" to="/dashboard" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>
          <DashboardIcon />
        </NavLink>
        <NavLink title="Attendance" to="/attendance" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>
          <AttendanceIcon />
        </NavLink>
        <NavLink title="Report" to="/report" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>
          <ReportIcon />
        </NavLink>
        <NavLink title="Master Data" to="/masters" className={({ isActive }) => `rail-icon rail-icon-light ${isActive ? "active" : ""}`}>
          <MasterDataIcon />
        </NavLink>
        <div className="rail-spacer" />
        <NavLink title="Profile" to="/profile" className={({ isActive }) => `rail-icon rail-icon-filled ${isActive ? "active" : ""}`}>
          <ProfileIcon />
        </NavLink>
      </aside>

      <aside className="team-panel">
        <h2>Team</h2>
        <div className="team-filter-wrap">
          <label htmlFor="team-department-filter" className="team-filter-label">Department</label>
          <select
            id="team-department-filter"
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
          <label htmlFor="team-search-input" className="team-filter-label">Employee Search</label>
          <input
            id="team-search-input"
            className="team-search-input"
            type="text"
            placeholder="Type name or code..."
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
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Dashboard
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Attendance
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Reports
          </NavLink>
          <NavLink to="/masters" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Master Data
          </NavLink>
          <NavLink to="/leave-claim" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Leave Claim
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            Profile
          </NavLink>
          <button type="button" className="top-logout-btn" onClick={logout}>
            Logout
          </button>
        </header>

        <section className="content-wrap">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AppShell;

