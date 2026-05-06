import { useState } from "react";
import { authApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function ProfilePage() {
  const { auth, updateUsername } = useAuth();
  const [usernameInput, setUsernameInput] = useState(() => auth?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameMessage, setNameMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const updateName = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setNameError("Username is required.");
      setNameMessage("");
      return;
    }
    setSavingName(true);
    setNameError("");
    setNameMessage("");
    try {
      const response = await authApi.patch("/auth/profile/name", { username: usernameInput.trim() });
      const updatedUser = response?.data?.data?.user || null;
      if (updatedUser) {
        updateUsername(updatedUser.username || usernameInput.trim());
        setUsernameInput(updatedUser.username || "");
      }
      setNameMessage("");
      setShowNameModal(false);
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
      setPasswordMessage("");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      setPasswordMessage("");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      setPasswordMessage("");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await authApi.patch("/auth/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("");
      setShowPasswordModal(false);
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
          <div className="profile-avatar">{(auth?.username || "U").slice(0, 2).toUpperCase()}</div>
          <div>
            <p className="profile-eyebrow">Account Center</p>
            <h2 className="profile-title">{auth?.username || "Unknown User"}</h2>
            <p className="profile-subtitle">Manage your account details and security settings.</p>
          </div>
        </div>
        <div className="profile-hero-actions">
          <span className={`profile-status-chip ${auth ? "ok" : "warn"}`}>
            {auth ? "Authenticated" : "Not Authenticated"}
          </span>
            <button
              type="button"
              className="ghost-btn profile-action-btn"
              onClick={() => {
              setShowPasswordModal(true);
              setPasswordError("");
              setPasswordMessage("");
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
            }}
          >
            Change Password
          </button>
        </div>
      </section>

      <div className="profile-layout-grid">
        <section className="profile-panel">
          <div className="profile-panel-head">
            <h3>Identity</h3>
            <button
              type="button"
              className="profile-icon-btn"
              onClick={() => {
                setShowNameModal(true);
                setUsernameInput(auth?.username || "");
                setNameError("");
                setNameMessage("");
              }}
              aria-label="Edit username"
              title="Edit username"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
          <div className="profile-kv-list">
            <div className="profile-kv-item">
              <span>Username</span>
              <strong>{auth?.username || "-"}</strong>
            </div>
            <div className="profile-kv-item">
              <span>Role</span>
              <strong>{auth?.role || "-"}</strong>
            </div>
            <div className="profile-kv-item">
              <span>Session</span>
              <strong>{auth ? "Active" : "Inactive"}</strong>
            </div>
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-head">
            <h3>Security</h3>
          </div>
          <div className="profile-security-list">
            <div className="profile-security-item">
              <span>Password</span>
              <p>Use a strong password and update it regularly.</p>
            </div>
            <div className="profile-security-item">
              <span>Account Access</span>
              <p>Only authenticated sessions can access protected modules.</p>
            </div>
          </div>
        </section>
      </div>

      {showNameModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Update Username</h3>
            <form className="profile-form-card profile-inline-form" onSubmit={updateName}>
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter new username"
              />
              {nameError ? <p className="form-error">{nameError}</p> : null}
              {nameMessage ? <p className="form-success">{nameMessage}</p> : null}
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={savingName}>
                  {savingName ? "Saving..." : "Update Name"}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setShowNameModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Update Password</h3>
            <form className="profile-form-card profile-inline-form" onSubmit={updatePassword}>
              <label htmlFor="profile-current-password">Current Password</label>
              <input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
              <label htmlFor="profile-new-password">New Password</label>
              <input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
              <label htmlFor="profile-confirm-password">Confirm Password</label>
              <input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              {passwordMessage ? <p className="form-success">{passwordMessage}</p> : null}
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={savingPassword}>
                  {savingPassword ? "Saving..." : "Update Password"}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProfilePage;
