import React, { useState, useEffect } from "react";
import logo from "./assets/cipla-logo.png";
import api from "./api";

const APP_VERSION = process.env.REACT_APP_VERSION || "0.1.0";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [showForgot, setShowForgot]           = useState(false);
  const [forgotUsername, setForgotUsername]   = useState("");
  const [forgotLoading, setForgotLoading]     = useState(false);
  const [forgotSuccess, setForgotSuccess]     = useState(false);
  const [forgotError, setForgotError]         = useState("");

  const openForgot = () => {
    setForgotUsername("");
    setForgotError("");
    setForgotSuccess(false);
    setShowForgot(true);
  };

  const submitForgot = async () => {
    if (!forgotUsername.trim()) { setForgotError("Enter your username ❌"); return; }
    setForgotLoading(true);
    setForgotError("");
    try {
      await api.post("/forgot-password", { username: forgotUsername.trim() });
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(err.response?.data?.detail || "Request failed ❌");
    } finally {
      setForgotLoading(false);
    }
  };

  const [loginError, setLoginError]         = useState("");
  const [sessionNotice, setSessionNotice]   = useState("");
  const [showSessionWarn, setShowSessionWarn] = useState(false);
  const [loginLoading, setLoginLoading]     = useState(false);

  useEffect(() => {
    const notice = sessionStorage.getItem("login_notice");
    if (notice === "duplicate_session") {
      setSessionNotice("You were signed out because your account was accessed from another session.");
      sessionStorage.removeItem("login_notice");
    }
  }, []);

  const doLogin = async (force = false) => {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await api.post("/login", { username, password, force });
      localStorage.setItem("auth_token", res.data.token);
      onLogin(username, res.data.role, res.data.force_password_reset, res.data.password_expires_in_days);
    } catch (err) {
      const status = err.response?.status;
      const rawDetail = err.response?.data?.detail;
      const detail = rawDetail || "Login failed ❌";
      if (status === 409 || rawDetail === "ACTIVE_SESSION") {
        setShowSessionWarn(true);
      } else {
        setLoginError(status === 423 ? "🔒 " + detail : detail);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setLoginError("Enter username and password ❌");
      return;
    }
    doLogin(false);
  };

  const handleForceLogin = () => {
    setShowSessionWarn(false);
    doLogin(true);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <img src={logo} alt="Cipla" style={styles.logo} />

        <h2 style={styles.title}>
          Cleaning Limit Software
        </h2>

        {sessionNotice && (
          <div style={styles.sessionNotice}>
            🔒 {sessionNotice}
          </div>
        )}

        <div style={styles.fieldRow}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div style={styles.fieldRow}>
          <label style={styles.label}>Password</label>
          <div style={{ position: "relative", flex: 1 }}>
          <input
            style={{ ...styles.input, paddingRight: "42px", margin: 0, width: "100%" }}
            type={showPassword ? "text" : "password"}
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            style={styles.eyeBtn}
            tabIndex={-1}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
          </div>
        </div>

        {loginError && (
          <p style={{ color: "#dc3545", fontSize: "13px", margin: "8px 0 0", textAlign: "center" }}>
            {loginError}
          </p>
        )}

        <button style={{ ...styles.button, opacity: loginLoading ? 0.7 : 1 }}
          onClick={handleLogin} disabled={loginLoading}>
          {loginLoading ? "Signing in..." : "Login"}
        </button>

        <p style={{ margin: "10px 0 0", textAlign: "center" }}>
          <button type="button" onClick={openForgot} style={styles.forgotLink}>
            Forgot Password?
          </button>
        </p>

        <p style={styles.footnote}>
          Developed by BMSQA
        </p>

        <p style={styles.version}>
          Version {APP_VERSION}
        </p>

      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            {forgotSuccess ? (
              <>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>✅</div>
                <h3 style={{ margin: "0 0 8px", color: "#065f46", fontSize: "16px" }}>Request Submitted</h3>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555", lineHeight: "1.6" }}>
                  Your password reset request has been sent to the administrator.
                  Please contact your administrator to set a new temporary password for you.
                </p>
                <button style={styles.button} onClick={() => setShowForgot(false)}>Close</button>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 6px", color: "#004f9f", fontSize: "16px" }}>Forgot Password</h3>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#666" }}>
                  Enter your username and an administrator will be notified to reset your password.
                </p>
                <input
                  style={{ ...styles.input, margin: "0 0 8px" }}
                  placeholder="Enter your username"
                  value={forgotUsername}
                  onChange={e => setForgotUsername(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submitForgot(); }}
                  autoFocus
                />
                {forgotError && (
                  <p style={{ margin: "0 0 8px", color: "#dc3545", fontSize: "12px" }}>{forgotError}</p>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    style={{ ...styles.button, margin: 0, flex: 1, opacity: forgotLoading ? 0.7 : 1 }}
                    onClick={submitForgot}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Submitting..." : "Submit Request"}
                  </button>
                  <button
                    style={styles.cancelBtn}
                    onClick={() => setShowForgot(false)}
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active session warning modal */}
      {showSessionWarn && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⚠️</div>
            <h3 style={{ margin: "0 0 10px", color: "#856404", fontSize: "16px" }}>
              Active Session Detected
            </h3>
            <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#555", lineHeight: "1.6" }}>
              Your account is currently signed in on another browser or device.
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#555", lineHeight: "1.6" }}>
              Continuing will <strong>immediately sign out the other session</strong>.
              Any unsaved work there will be lost.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleForceLogin}
                disabled={loginLoading}
                style={{ flex: 1, padding: "10px", background: "#dc3545", color: "white",
                  border: "none", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "bold", fontSize: "13px",
                  opacity: loginLoading ? 0.7 : 1 }}
              >
                {loginLoading ? "Signing in..." : "Continue & Sign Out Other Session"}
              </button>
              <button
                onClick={() => setShowSessionWarn(false)}
                style={{ flex: 1, padding: "10px", background: "#f1f5f9", color: "#333",
                  border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "bold", fontSize: "13px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    position: "relative",
  },
  card: {
    background: "white",
    padding: "24px 32px",
    width: "360px",
    borderRadius: "10px",
    boxShadow: "0px 6px 15px rgba(0,0,0,0.1)",
    textAlign: "center"
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    margin: "8px 0",
  },
  label: {
    width: "80px",
    minWidth: "80px",
    textAlign: "right",
    marginRight: "10px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#333",
  },
  logo: {
    width: "90px",
    marginBottom: "8px"
  },
  title: {
    color: "#004f9f",
    marginBottom: "14px",
    fontSize: "17px"
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
    fontSize: "13px"
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#004f9f",
    color: "white",
    fontWeight: "bold",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
    fontSize: "14px"
  },
  footnote: {
    marginTop: "14px",
    marginBottom: 0,
    textAlign: "center",
    fontSize: "11px",
    color: "#004f9f",
    fontWeight: "bold",
    borderTop: "1px solid #f0f4f8",
    paddingTop: "10px",
    letterSpacing: "0.2px",
  },
  version: {
    margin: "4px 0 0",
    textAlign: "center",
    fontSize: "10px",
    color: "#94a3b8",
    letterSpacing: "0.3px",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#888",
    padding: "2px",
    display: "flex",
    alignItems: "center"
  },
  forgotLink: {
    background: "none",
    border: "none",
    color: "#004f9f",
    cursor: "pointer",
    fontSize: "13px",
    textDecoration: "underline",
    padding: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalBox: {
    background: "white",
    borderRadius: "12px",
    padding: "28px",
    width: "380px",
    maxWidth: "90vw",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  cancelBtn: {
    flex: 1,
    padding: "12px",
    background: "#f1f5f9",
    color: "#333",
    border: "1px solid #ccc",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },
  sessionNotice: {
    background: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: "6px",
    padding: "10px 12px",
    fontSize: "12px",
    color: "#856404",
    marginBottom: "12px",
    textAlign: "left",
    lineHeight: "1.5",
  },
};

export default LoginPage;