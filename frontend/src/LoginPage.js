import React, { useState } from "react";
import logo from "./assets/cipla-logo.png";
import api from "./api";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Enter username and password ❌");
      return;
    }
    try {
      const res = await api.post("/login", { username, password });
      localStorage.setItem("auth_token", res.data.token);
      onLogin(username, res.data.role, res.data.force_password_reset);
    } catch (err) {
      alert(err.response?.data?.detail || "Login failed ❌");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <img src={logo} alt="Cipla" style={styles.logo} />

        <h2 style={styles.title}>
          Cleaning Limit Software
        </h2>

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

        <button style={styles.button} onClick={handleLogin}>
          Login
        </button>

        <p style={styles.footnote}>
          Developed by Cipla Bommasandra Quality Team
        </p>

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
    position: "relative",
  },
  card: {
    background: "white",
    padding: "40px",
    width: "380px",
    borderRadius: "10px",
    boxShadow: "0px 6px 15px rgba(0,0,0,0.1)",
    textAlign: "center"
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    margin: "10px 0",
  },
  label: {
    width: "80px",
    minWidth: "80px",
    textAlign: "right",
    marginRight: "10px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#333",
  },
  logo: {
    width: "120px",
    marginBottom: "10px"
  },
  title: {
    color: "#004f9f",
    marginBottom: "20px"
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    boxSizing: "border-box"
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#004f9f",
    color: "white",
    fontWeight: "bold",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px"
  },
  footnote: {
    marginTop: "20px",
    marginBottom: 0,
    textAlign: "center",
    fontSize: "11px",
    color: "#004f9f",
    fontWeight: "bold",
    borderTop: "1px solid #f0f4f8",
    paddingTop: "14px",
    letterSpacing: "0.2px",
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
  }
};

export default LoginPage;