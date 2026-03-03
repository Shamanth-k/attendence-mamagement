import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authApi } from "../../lib/api";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await authApi.post("/auth/reset-password", { token, newPassword });
      setSuccess("Password reset successful. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-screen-card" onSubmit={submit}>
        <h1>Reset Password</h1>
        <p>Set a new password for your account.</p>
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
          {loading ? "Submitting..." : "Reset Password"}
        </button>
        {error ? <p className="panel-auth-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}
      </form>
    </div>
  );
}

export default ResetPasswordPage;

