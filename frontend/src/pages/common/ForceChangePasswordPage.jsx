import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../lib/api";
import { useAuth, roleHome } from "../../context/AuthContext";

function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { auth, markFirstLoginComplete } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    setError("");
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
      navigate(roleHome(auth?.role || "EMPLOYEE"), { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-screen-card" onSubmit={submit}>
        <h1>First Login Password Update</h1>
        <p>Password change is required before continuing.</p>
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="submit" className="panel-auth-btn" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
        {error ? <p className="panel-auth-error">{error}</p> : null}
      </form>
    </div>
  );
}

export default ForceChangePasswordPage;


