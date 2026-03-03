import { useState } from "react";
import { authApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function AdminSettingsPage() {
  const { auth } = useAuth();
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const updateName = async (event) => {
    event.preventDefault();
    if (!username.trim()) {
      setNameError("Username is required.");
      return;
    }
    setNameSaving(true);
    setNameError("");
    try {
      await authApi.patch("/auth/profile/name", { username: username.trim() });
      setUsername("");
    } catch (err) {
      setNameError(err?.response?.data?.message || "Unable to update username.");
    } finally {
      setNameSaving(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError("Current and new password are required.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError("");
    try {
      await authApi.patch("/auth/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err?.response?.data?.message || "Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>Admin Settings</h2>
      </div>
      <p className="small-note">Role: {auth?.role} | User ID: {auth?.id}</p>

      <div className="profile-form-grid">
        <form className="profile-form-card" onSubmit={updateName}>
          <h3>Update Username</h3>
          <label htmlFor="admin-username">New username</label>
          <input
            id="admin-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter new username"
          />
          {nameError ? <p className="form-error">{nameError}</p> : null}
          <button type="submit" className="primary-btn" disabled={nameSaving}>
            {nameSaving ? "Saving..." : "Update Name"}
          </button>
        </form>

        <form className="profile-form-card" onSubmit={updatePassword}>
          <h3>Change Password</h3>
          <label htmlFor="admin-current-password">Current password</label>
          <input
            id="admin-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label htmlFor="admin-new-password">New password</label>
          <input
            id="admin-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          <button type="submit" className="primary-btn" disabled={passwordSaving}>
            {passwordSaving ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminSettingsPage;

