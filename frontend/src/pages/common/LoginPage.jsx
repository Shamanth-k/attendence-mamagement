import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!credentials.username || !credentials.password) {
      setError("Username and password are required.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const auth = await login(credentials);
      if (auth.isFirstLogin && auth.role === "ADMIN") {
        navigate("/force-change-password", { replace: true });
      } else {
        navigate(auth.role === "ADMIN" ? "/admin/dashboard" : "/employee/dashboard", { replace: true });
      }
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      if (status === 401) {
        setError(message || "Invalid username or password.");
      } else {
        setError(message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-screen-card" onSubmit={submit}>
        <h1>Attendance Login</h1>
        <p>Sign in with your secure account.</p>
        <input
          type="text"
          placeholder="Username"
          value={credentials.username}
          onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
          autoComplete="username"
        />
        <div className="password-field-row">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={credentials.password}
            onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button type="submit" className="panel-auth-btn" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        {error ? <p className="panel-auth-error">{error}</p> : null}
      </form>
    </div>
  );
}

export default LoginPage;
