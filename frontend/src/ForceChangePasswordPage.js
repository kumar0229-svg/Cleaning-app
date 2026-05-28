import React, { useState } from "react";
import logo from "./assets/falcon-logo.svg";
import api from "./api";

function ForceChangePasswordPage({ currentUser, onPasswordChanged, onLogout }) {
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");

  const handleSubmit = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/users/change-password", {
        new_password: newPassword,
      });
      onPasswordChanged();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src={logo} alt="Falcon" style={styles.logo} />
        <h2 style={styles.title}>Set New Password</h2>
        <p style={styles.subtitle}>
          Welcome, <strong>{currentUser}</strong>. You must set a new password before continuing.
        </p>

        <div style={{ position: "relative", marginTop: "12px" }}>
          <input
            type={showNew ? "text" : "password"}
            placeholder="New Password (min 6 characters)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={{ ...styles.input, paddingRight: "42px" }}
          />
          <button type="button" onClick={() => setShowNew(p => !p)} style={styles.eyeBtn} tabIndex={-1}>
            {showNew ? "🙈" : "👁"}
          </button>
        </div>

        <div style={{ position: "relative", marginTop: "4px" }}>
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            style={{ ...styles.input, paddingRight: "42px" }}
          />
          <button type="button" onClick={() => setShowConfirm(p => !p)} style={styles.eyeBtn} tabIndex={-1}>
            {showConfirm ? "🙈" : "👁"}
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={loading ? styles.btnDisabled : styles.btn}
        >
          {loading ? "Saving..." : "Set Password & Continue"}
        </button>

        <button onClick={onLogout} style={styles.logoutBtn}>
          Cancel & Logout
        </button>
      </div>
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
  },
  card: {
    background: "white",
    padding: "40px",
    width: "380px",
    borderRadius: "12px",
    boxShadow: "0px 6px 20px rgba(0,0,0,0.15)",
    textAlign: "center",
  },
  logo: { width: "100px", marginBottom: "10px" },
  title: { color: "#004f9f", margin: "0 0 6px" },
  subtitle: { fontSize: "13px", color: "#555", margin: "0 0 4px" },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
    fontSize: "14px",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
  },
  error: { color: "#dc3545", fontSize: "13px", margin: "8px 0 0" },
  btn: {
    marginTop: "16px",
    width: "100%",
    padding: "12px",
    background: "#004f9f",
    color: "white",
    fontWeight: "bold",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnDisabled: {
    marginTop: "16px",
    width: "100%",
    padding: "12px",
    background: "#aaa",
    color: "white",
    fontWeight: "bold",
    border: "none",
    borderRadius: "6px",
    cursor: "not-allowed",
    fontSize: "14px",
  },
  logoutBtn: {
    marginTop: "10px",
    width: "100%",
    padding: "9px",
    background: "none",
    color: "#888",
    border: "1px solid #ccc",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
};

export default ForceChangePasswordPage;
