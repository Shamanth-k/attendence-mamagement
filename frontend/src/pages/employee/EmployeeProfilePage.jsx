import { useState } from "react";
import { authApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function EmployeeProfilePage() {
  const { auth } = useAuth();
  const [usernameInput, setUsernameInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const updateName = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setNameError("Username is required.");
      return;
    }
    setSavingName(true);
    setNameError("");
    try {
      await authApi.patch("/auth/profile/name", { username: usernameInput.trim() });
      setUsernameInput("");
    } catch (error) {
      setNameError(error?.response?.data?.message || "Failed to update username.");
    } finally {
      setSavingName(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
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
      await authApi.patch("/auth/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error?.response?.data?.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="screen-card profile-page">
      <section className="profile-hero-panel">
        <div className="profile-identity">
          <div className="profile-avatar">{String(auth?.role || "E").slice(0, 2)}</div>
          <div>
            <p className="profile-eyebrow">Account Center</p>
            <h2 className="profile-title">Employee #{auth?.id}</h2>
            <p className="profile-subtitle">Manage your account details and security settings.</p>
          </div>
        </div>
        <div className="profile-hero-actions">
          <span className="profile-status-chip ok">Authenticated</span>
        </div>
      </section>

      <div className="profile-form-grid">
        <form className="profile-form-card" onSubmit={updateName}>
          <h3>Update Username</h3>
          <label htmlFor="profile-username">Username</label>
          <input
            id="profile-username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Enter new username"
          />
          {nameError ? <p className="form-error">{nameError}</p> : null}
          <button type="submit" className="primary-btn" disabled={savingName}>
            {savingName ? "Saving..." : "Update Name"}
          </button>
        </form>

        <form className="profile-form-card" onSubmit={updatePassword}>
          <h3>Update Password</h3>
          <label htmlFor="profile-current-password">Current Password</label>
          <input
            id="profile-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label htmlFor="profile-new-password">New Password</label>
          <input
            id="profile-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <label htmlFor="profile-confirm-password">Confirm Password</label>
          <input
            id="profile-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          <button type="submit" className="primary-btn" disabled={savingPassword}>
            {savingPassword ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EmployeeProfilePage;

