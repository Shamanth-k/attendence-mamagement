import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";

function EmployeeLayout() {
  const { auth, logout, markFirstLoginComplete } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const submitFirstLoginPassword = async (event) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }

    setSavingPassword(true);
    setPasswordError("");
    try {
      try {
        await authApi.post("/auth/force-change-password", { currentPassword, newPassword });
      } catch (err) {
        if (err?.response?.status === 404) {
          await authApi.patch("/auth/profile/password", { currentPassword, newPassword });
        } else {
          throw err;
        }
      }
      markFirstLoginComplete();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error?.response?.data?.message || "Unable to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="employee-layout-root">
      <header className="top-nav">
        <NavLink to="/employee/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Dashboard</NavLink>
        <NavLink to="/employee/attendance" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Attendance</NavLink>
        <NavLink to="/employee/report" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Report</NavLink>
        <NavLink to="/employee/leave" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Leave</NavLink>
        <NavLink to="/employee/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>Profile</NavLink>
        <button type="button" className="top-logout-btn" onClick={logout}>Logout</button>
      </header>
      <main className="employee-layout-content">
        <section className="content-wrap">
          <Outlet />
        </section>
      </main>

      {auth?.isFirstLogin ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Change Password</h3>
            <p className="small-note">First login detected. You must change your password to continue.</p>
            <form className="profile-form-card profile-inline-form" onSubmit={submitFirstLoginPassword}>
              <label htmlFor="first-login-current-password">Current Password</label>
              <input
                id="first-login-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
              <label htmlFor="first-login-new-password">New Password</label>
              <input
                id="first-login-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
              <label htmlFor="first-login-confirm-password">Confirm Password</label>
              <input
                id="first-login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={savingPassword}>
                  {savingPassword ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EmployeeLayout;

