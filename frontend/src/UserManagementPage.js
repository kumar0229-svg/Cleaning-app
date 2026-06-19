import React, { useEffect, useState } from "react";
import api from "./api";

const ROLES_META = [
  { key: "ADMIN",              label: "ADMIN",          color: "#004f9f", bg: "#dbeafe" },
  { key: "HEAD_QA",            label: "HEAD QA",        color: "#065f46", bg: "#d1fae5" },
  { key: "QA",                 label: "QA",             color: "#1e40af", bg: "#eff6ff" },
  { key: "QC",                 label: "QC",             color: "#78350f", bg: "#fef3c7" },
  { key: "HEAD_QC",            label: "HEAD QC",        color: "#78350f", bg: "#fef3c7" },
  { key: "USER_DEPARTMENT",    label: "User Dept",      color: "#6b7280", bg: "#f3f4f6" },
  { key: "HOD_USER_DEPARTMENT",label: "HOD User Dept",  color: "#6b7280", bg: "#f3f4f6" },
];

const MATRIX_GROUPS = [
  {
    group: "Master Data (Facilities / Equipment / Products)",
    rows: [
      { cap: "View records",                                     ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
      { cap: "Add / Edit / Delete records",                      ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "Manage Equipment Categories",                      ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "MACO Calculation & Protocol",
    rows: [
      { cap: "Run MACO / Generate Protocol",                     ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "View & Print Protocol",                            ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
      { cap: "Save Protocol to Archive",                         ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "Delete Protocol Archive",                          ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "Sampling Plan",
    rows: [
      { cap: "View sampling plan",                               ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
      { cap: "Add / Edit / Delete sample locations",             ADMIN:1, HEAD_QA:0, QA:1, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "Calculation Policy",
    rows: [
      { cap: "View active policy",                               ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
      { cap: "Change calculation policy",                        ADMIN:1, HEAD_QA:1, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "Audit Log",
    rows: [
      { cap: "View audit trail",                                 ADMIN:1, HEAD_QA:1, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "User Management",
    rows: [
      { cap: "View active & archived users",                     ADMIN:1, HEAD_QA:1, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "Create new user",                                  ADMIN:1, HEAD_QA:1, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "Reset user password",                              ADMIN:1, HEAD_QA:0, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
      { cap: "Archive / Restore user account",                   ADMIN:1, HEAD_QA:0, QA:0, QC:0, HEAD_QC:0, USER_DEPARTMENT:0, HOD_USER_DEPARTMENT:0 },
    ],
  },
  {
    group: "NLP Query Assistant",
    rows: [
      { cap: "Ask AI questions about data",                      ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
    ],
  },
  {
    group: "Validation Master Plan",
    rows: [
      { cap: "View / Print Validation Master Plan",              ADMIN:1, HEAD_QA:1, QA:1, QC:1, HEAD_QC:1, USER_DEPARTMENT:1, HOD_USER_DEPARTMENT:1 },
    ],
  },
];

function PrivilegeMatrix() {
  const ALLOW = { background: "#d1fae5", color: "#065f46", fontWeight: "bold", fontSize: "14px" };
  const DENY  = { background: "#f9fafb", color: "#d1d5db", fontSize: "13px" };

  return (
    <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", minWidth: "780px" }}>
        <thead>
          <tr>
            <th style={{ background: "#1e293b", color: "white", padding: "10px 14px", textAlign: "left",
              borderRight: "1px solid #334155", width: "220px", fontWeight: "bold" }}>
              Capability / Module
            </th>
            {ROLES_META.map(r => (
              <th key={r.key} style={{ background: r.bg, color: r.color, padding: "8px 6px",
                textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "bold",
                fontSize: "11px", letterSpacing: "0.2px", minWidth: "80px" }}>
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_GROUPS.map((grp, gi) => (
            <React.Fragment key={gi}>
              <tr>
                <td colSpan={8} style={{ background: "#1e293b", color: "#94a3b8",
                  padding: "6px 14px", fontSize: "10px", fontWeight: "bold",
                  textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  {grp.group}
                </td>
              </tr>
              {grp.rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 14px", color: "#374151", borderRight: "1px solid #e2e8f0",
                    background: ri % 2 === 0 ? "white" : "#f8fafc" }}>
                    {row.cap}
                  </td>
                  {ROLES_META.map(r => (
                    <td key={r.key} style={{ textAlign: "center", padding: "8px 4px",
                      background: ri % 2 === 0 ? "white" : "#f8fafc",
                      border: "1px solid #f1f5f9" }}>
                      {row[r.key]
                        ? <span style={{ ...ALLOW, padding: "2px 10px", borderRadius: "10px",
                            background: "#d1fae5", display: "inline-block" }}>✓</span>
                        : <span style={{ ...DENY }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "10px 14px", background: "#f8fafc", borderTop: "1px solid #e2e8f0",
        fontSize: "11px", color: "#6b7280", display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <span><span style={{ background: "#d1fae5", color: "#065f46", fontWeight: "bold",
          padding: "1px 8px", borderRadius: "8px" }}>✓</span> &nbsp;Permitted</span>
        <span><span style={{ color: "#d1d5db" }}>—</span> &nbsp;Not permitted</span>
        <span style={{ marginLeft: "auto", color: "#9ca3af", fontStyle: "italic" }}>
          Permissions enforced by the backend API on every request
        </span>
      </div>
    </div>
  );
}

function UserManagementPage({ goHome, currentUser }) {
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [role, setRole]             = useState("QA");
  const [users, setUsers]           = useState([]);
  const [showMatrix, setShowMatrix] = useState(false);

  // Add user modal
  const [showAddModal, setShowAddModal]       = useState(false);
  const [adminPassword, setAdminPassword]     = useState("");
  const [addLoading, setAddLoading]           = useState(false);

  // Archive modal
  const [archiveModal, setArchiveModal]       = useState(null); // { username }
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveReason, setArchiveReason]     = useState("");
  const [archiveLoading, setArchiveLoading]   = useState(false);

  // Archived users section
  const [archivedUsers, setArchivedUsers]     = useState([]);
  const [showArchived, setShowArchived]       = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  // Restore modal
  const [restoreModal, setRestoreModal]       = useState(null); // { username }
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreReason, setRestoreReason]     = useState("");
  const [restoreLoading, setRestoreLoading]   = useState(false);

  // Reset password modal (direct admin reset)
  const [resetModal, setResetModal]           = useState(null); // { username }
  const [resetNewPwd, setResetNewPwd]         = useState("");
  const [resetAdminPwd, setResetAdminPwd]     = useState("");
  const [resetLoading, setResetLoading]       = useState(false);

  // Security policy
  const [secPolicy, setSecPolicy]   = useState(null);
  const [secEdit, setSecEdit]       = useState(false);
  const [secForm, setSecForm]       = useState({ password_expiry_days: 45, max_login_attempts: 5, lockout_duration_hours: 8 });
  const [secLoading, setSecLoading] = useState(false);

  const loadSecPolicy = async () => {
    try {
      const res = await api.get("/admin/security-policy");
      setSecPolicy(res.data);
      setSecForm({
        password_expiry_days:   parseInt(res.data.password_expiry_days)   || 45,
        max_login_attempts:     parseInt(res.data.max_login_attempts)     || 5,
        lockout_duration_hours: parseInt(res.data.lockout_duration_hours) || 8,
      });
    } catch { /* non-admin roles get 403 — silently ignore */ }
  };

  const saveSecPolicy = async () => {
    setSecLoading(true);
    try {
      await api.post("/admin/security-policy", secForm);
      await loadSecPolicy();
      setSecEdit(false);
      alert("Security policy saved ✅");
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed ❌");
    } finally { setSecLoading(false); }
  };

  const unlockUser = async (uname) => {
    try {
      await api.post(`/users/unlock/${uname}`);
      alert(`User "${uname}" unlocked ✅`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Unlock failed ❌");
    }
  };

  // Forgot-password requests
  const [resetRequests, setResetRequests]         = useState([]);
  const [resetReqLoading, setResetReqLoading]     = useState(false);
  const [approveModal, setApproveModal]           = useState(null); // { id, username }
  const [approvePwd, setApprovePwd]               = useState("");
  const [approveAdminPwd, setApproveAdminPwd]     = useState("");
  const [approveLoading, setApproveLoading]       = useState(false);
  const [rejectModal, setRejectModal]             = useState(null); // { id, username }
  const [rejectAdminPwd, setRejectAdminPwd]       = useState("");
  const [rejectLoading, setRejectLoading]         = useState(false);

  const loadResetRequests = async () => {
    setResetReqLoading(true);
    try {
      const res = await api.get("/users/reset-requests");
      setResetRequests(res.data);
    } catch (err) { console.log(err); }
    finally { setResetReqLoading(false); }
  };

  const confirmApprove = async () => {
    if (!approvePwd.trim() || approvePwd.length < 6) { alert("New password must be at least 6 characters ❌"); return; }
    if (!approveAdminPwd) { alert("Enter your admin password ❌"); return; }
    setApproveLoading(true);
    try {
      await api.post(`/users/reset-requests/${approveModal.id}/approve`, {
        new_password: approvePwd,
        admin_password: approveAdminPwd,
      });
      setApproveModal(null);
      alert(`Password reset for "${approveModal.username}" ✅\nUser will be prompted to change it on next login.`);
      loadResetRequests();
    } catch (err) {
      alert(err.response?.data?.detail || "Approve failed ❌");
    } finally {
      setApproveLoading(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectAdminPwd) { alert("Enter your admin password ❌"); return; }
    setRejectLoading(true);
    try {
      await api.post(`/users/reset-requests/${rejectModal.id}/reject`, {
        admin_password: rejectAdminPwd,
      });
      setRejectModal(null);
      alert(`Reset request for "${rejectModal.username}" rejected.`);
      loadResetRequests();
    } catch (err) {
      alert(err.response?.data?.detail || "Reject failed ❌");
    } finally {
      setRejectLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get("/users/all");
      setUsers(res.data);
    } catch (err) {
      console.log("Error loading users:", err);
    }
  };

  useEffect(() => { loadUsers(); loadResetRequests(); loadSecPolicy(); }, []);

  const addUser = () => {
    if (!username.trim() || !password.trim()) {
      alert("Fill all fields ❌");
      return;
    }
    setAdminPassword("");
    setShowAddModal(true);
  };

  const confirmAddUser = async () => {
    if (!adminPassword) { alert("Enter your password ❌"); return; }
    setAddLoading(true);
    try {
      await api.post("/users/add", { username, password, role, admin_password: adminPassword });
      alert("User Created ✅");
      setUsername("");
      setPassword("");
      setRole("QA");
      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Error creating user ❌");
    } finally {
      setAddLoading(false);
    }
  };

  const openArchiveModal = (uname) => {
    setArchiveModal({ username: uname });
    setArchivePassword("");
    setArchiveReason("");
  };

  const closeArchiveModal = () => {
    setArchiveModal(null);
    setArchivePassword("");
    setArchiveReason("");
  };

  const confirmArchive = async () => {
    if (!archivePassword) { alert("Enter your password ❌"); return; }
    if (!archiveReason.trim()) { alert("Enter a reason ❌"); return; }
    setArchiveLoading(true);
    try {
      await api.post(`/users/archive/${archiveModal.username}`, {
        password: archivePassword,
        reason: archiveReason,
      });
      setUsers(prev => prev.filter(u => u.username !== archiveModal.username));
      if (showArchived) fetchArchivedUsers();
      closeArchiveModal();
      alert(`User "${archiveModal.username}" archived ✅`);
    } catch (err) {
      alert(err.response?.data?.detail || "Archive failed ❌");
    } finally {
      setArchiveLoading(false);
    }
  };

  const fetchArchivedUsers = async () => {
    setArchivedLoading(true);
    try {
      const res = await api.get("/users/archived");
      setArchivedUsers(res.data);
    } catch (err) { console.log(err); }
    finally { setArchivedLoading(false); }
  };

  const openRestoreModal = (uname) => {
    setRestoreModal({ username: uname });
    setRestorePassword("");
    setRestoreReason("");
  };

  const confirmRestore = async () => {
    if (!restorePassword) { alert("Enter your password ❌"); return; }
    if (!restoreReason.trim()) { alert("Enter a reason ❌"); return; }
    setRestoreLoading(true);
    try {
      await api.post(`/users/restore/${restoreModal.username}`, {
        password: restorePassword,
        reason: restoreReason,
      });
      setArchivedUsers(prev => prev.filter(u => u.username !== restoreModal.username));
      setRestoreModal(null);
      alert(`User "${restoreModal.username}" restored ✅`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Restore failed ❌");
    } finally {
      setRestoreLoading(false);
    }
  };

  const confirmResetPassword = async () => {
    if (!resetNewPwd.trim()) { alert("Enter new password ❌"); return; }
    if (resetNewPwd.length < 6) { alert("Password must be at least 6 characters ❌"); return; }
    if (!resetAdminPwd) { alert("Enter your admin password ❌"); return; }
    setResetLoading(true);
    try {
      await api.post(`/users/reset-password/${resetModal.username}`, {
        new_password: resetNewPwd,
        admin_password: resetAdminPwd,
      });
      setResetModal(null);
      alert(`Password reset for "${resetModal.username}" ✅\nUser will be forced to change it on next login.`);
    } catch (err) {
      alert(err.response?.data?.detail || "Reset failed ❌");
    } finally {
      setResetLoading(false);
    }
  };

  const toggleArchived = () => {
    if (!showArchived) fetchArchivedUsers();
    setShowArchived(prev => !prev);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <button onClick={goHome} style={styles.backBtn}>Back to Home</button>
      </div>

      {/* Security Policy Panel */}
      {secPolicy && (
        <div style={{ ...styles.section, marginBottom: "20px", maxWidth: "500px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#004f9f" }}>Security Policy</h3>
            {!secEdit && (
              <button onClick={() => setSecEdit(true)} style={{ ...styles.refreshBtn, color: "#004f9f" }}>
                Edit
              </button>
            )}
          </div>

          {secEdit ? (
            <div>
              {[
                { key: "password_expiry_days",   label: "Password Expiry (days)", min: 1, max: 365 },
                { key: "max_login_attempts",     label: "Max Failed Attempts",    min: 1, max: 20  },
                { key: "lockout_duration_hours", label: "Lockout Duration (hrs)", min: 1, max: 720 },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "10px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#555", display: "block", marginBottom: "3px" }}>
                    {f.label}
                  </label>
                  <input
                    type="number" min={f.min} max={f.max}
                    value={secForm[f.key]}
                    onChange={e => setSecForm(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || f.min }))}
                    style={{ ...styles.input, margin: 0, width: "120px" }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={saveSecPolicy} disabled={secLoading}
                  style={{ padding: "7px 18px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                  {secLoading ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setSecEdit(false); setSecForm({ password_expiry_days: parseInt(secPolicy.password_expiry_days), max_login_attempts: parseInt(secPolicy.max_login_attempts), lockout_duration_hours: parseInt(secPolicy.lockout_duration_hours) }); }}
                  style={{ padding: "7px 14px", background: "#f1f5f9", color: "#333", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <table style={{ fontSize: "13px", borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {[
                  ["Password Expiry",      `${secPolicy.password_expiry_days} days`],
                  ["Max Failed Attempts",  secPolicy.max_login_attempts],
                  ["Lockout Duration",     `${secPolicy.lockout_duration_hours} hours`],
                ].map(([label, val]) => (
                  <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 0", color: "#555", width: "60%" }}>{label}</td>
                    <td style={{ padding: "6px 0", fontWeight: "bold", color: "#1e293b" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create User Form */}
      <div style={styles.formBox}>
        <h3 style={{ margin: "0 0 14px", color: "#004f9f", fontSize: "15px" }}>Create New User</h3>

        <input style={styles.input} placeholder="Username"
          value={username} onChange={e => setUsername(e.target.value)} />

        <div style={{ position: "relative" }}>
          <input
            style={{ ...styles.input, paddingRight: "40px" }}
            type={showNewPwd ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShowNewPwd(p => !p)} style={styles.eyeBtn} tabIndex={-1}>
            {showNewPwd ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        <select style={styles.input} value={role} onChange={e => setRole(e.target.value)}>
          <optgroup label="Admin">
            <option value="ADMIN">ADMIN — Full system administrator</option>
            <option value="HEAD_QA">HEAD_QA — Head of Quality Assurance (Admin equivalent)</option>
          </optgroup>
          <optgroup label="Read/Write Access">
            <option value="QA">QA — Quality Assurance (read/write)</option>
          </optgroup>
          <optgroup label="View-Only Access">
            <option value="USER_DEPARTMENT">USER_DEPARTMENT — View-only access</option>
            <option value="HOD_USER_DEPARTMENT">HOD_USER_DEPARTMENT — Head of Department (view-only)</option>
            <option value="QC">QC — Quality Control (view-only)</option>
            <option value="HEAD_QC">HEAD_QC — Head of QC (view-only)</option>
          </optgroup>
        </select>

        <button style={styles.addBtn} onClick={addUser}>Add User</button>
      </div>

      {/* Active Users Table */}
      <div style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "#004f9f" }}>
            Active Users ({users.length})
          </h3>
          <button onClick={loadUsers} style={styles.refreshBtn}>Refresh</button>
        </div>

        {users.length === 0 ? (
          <p style={{ color: "#888" }}>No active users.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#004f9f", color: "white" }}>
                  <th style={cell}>ID</th>
                  <th style={cell}>Username</th>
                  <th style={cell}>Role</th>
                  <th style={cell}>Status</th>
                  <th style={cell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr key={u.user_id} style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                    <td style={cell}>{u.user_id}</td>
                    <td style={cell}>{u.username}</td>
                    <td style={cell}>
                      <span style={{
                        padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold",
                        background: u.role === "ADMIN" ? "#cce5ff" : u.role === "QA" ? "#d4edda" : "#f8f9fa",
                        color:      u.role === "ADMIN" ? "#004085" : u.role === "QA" ? "#155724" : "#555",
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={cell}>
                      {u.is_locked ? (
                        <span style={{ color: "#dc3545", fontSize: "11px", fontWeight: "bold" }}>
                          🔒 Locked
                        </span>
                      ) : u.failed_attempts > 0 ? (
                        <span style={{ color: "#e67e22", fontSize: "11px" }}>
                          ⚠ {u.failed_attempts} fail{u.failed_attempts !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span style={{ color: "#28a745", fontSize: "11px" }}>Active</span>
                      )}
                    </td>
                    <td style={cell}>
                      {u.username !== currentUser ? (
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                          {u.is_locked && (
                            <button onClick={() => unlockUser(u.username)}
                              style={{ ...styles.resetBtn, background: "#28a745" }}>
                              Unlock
                            </button>
                          )}
                          <button
                            onClick={() => { setResetModal({ username: u.username }); setResetNewPwd(""); setResetAdminPwd(""); }}
                            style={styles.resetBtn}
                          >
                            Reset Pwd
                          </button>
                          <button onClick={() => openArchiveModal(u.username)} style={styles.archiveBtn}>
                            Archive
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#aaa", fontSize: "11px" }}>Current user</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roles & Privileges Matrix */}
      <div style={{ marginTop: "20px" }}>
        <button onClick={() => setShowMatrix(p => !p)}
          style={{ padding: "8px 18px", background: showMatrix ? "#1e293b" : "#334155",
            color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
            fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{showMatrix ? "▾" : "▸"}</span>
          Roles &amp; Privileges Matrix
        </button>

        {showMatrix && (
          <div style={{ marginTop: "12px", background: "white", borderRadius: "10px",
            padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ marginBottom: "14px" }}>
              <h3 style={{ margin: "0 0 4px", color: "#1e293b", fontSize: "15px" }}>
                Roles &amp; Privileges Matrix
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                Effective access rights for each role across all modules — enforced server-side on every API call.
              </p>
            </div>

            {/* Role summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px", marginBottom: "18px" }}>
              {[
                { role: "ADMIN",               label: "Administrator",             desc: "Full access to all modules including user management and password resets.", tier: "admin" },
                { role: "HEAD_QA",             label: "Head of Quality Assurance", desc: "Manage users & policy; view audit log. Cannot modify equipment/products or run MACO.", tier: "admin" },
                { role: "QA",                  label: "Quality Assurance",         desc: "Full read/write on data, MACO, protocols & sampling plan. Cannot manage users or change policy.", tier: "edit" },
                { role: "HEAD_QC",             label: "Head of Quality Control",   desc: "View-only access across all modules.", tier: "view" },
                { role: "QC",                  label: "Quality Control",           desc: "View-only access across all modules.", tier: "view" },
                { role: "HOD_USER_DEPARTMENT", label: "HOD — User Department",     desc: "View-only access across all modules.", tier: "view" },
                { role: "USER_DEPARTMENT",     label: "User Department",           desc: "View-only access across all modules.", tier: "view" },
              ].map(r => {
                const tierStyle = r.tier === "admin"
                  ? { borderColor: "#004f9f", titleBg: "#dbeafe", titleColor: "#004f9f" }
                  : r.tier === "edit"
                  ? { borderColor: "#065f46", titleBg: "#d1fae5", titleColor: "#065f46" }
                  : { borderColor: "#d1d5db", titleBg: "#f3f4f6", titleColor: "#6b7280" };
                return (
                  <div key={r.role} style={{ border: `1.5px solid ${tierStyle.borderColor}`,
                    borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ background: tierStyle.titleBg, padding: "6px 10px",
                      borderBottom: `1px solid ${tierStyle.borderColor}` }}>
                      <div style={{ fontWeight: "bold", fontSize: "11px", color: tierStyle.titleColor,
                        textTransform: "uppercase", letterSpacing: "0.3px" }}>{r.role}</div>
                      <div style={{ fontSize: "10px", color: tierStyle.titleColor, opacity: 0.8 }}>{r.label}</div>
                    </div>
                    <div style={{ padding: "8px 10px", fontSize: "11px", color: "#555", lineHeight: "1.5" }}>
                      {r.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            <PrivilegeMatrix />
          </div>
        )}
      </div>

      {/* Password Reset Requests */}
      <div style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "#004f9f" }}>
            Password Reset Requests
          </h3>
          {resetRequests.length > 0 && (
            <span style={{ background: "#dc3545", color: "white", borderRadius: "12px",
              padding: "2px 8px", fontSize: "11px", fontWeight: "bold" }}>
              {resetRequests.length} pending
            </span>
          )}
          <button onClick={loadResetRequests} style={styles.refreshBtn}>Refresh</button>
        </div>

        {resetReqLoading ? (
          <p style={{ color: "#888", fontSize: "13px" }}>Loading...</p>
        ) : resetRequests.length === 0 ? (
          <p style={{ color: "#888", fontSize: "13px" }}>No pending password reset requests.</p>
        ) : (
          <div style={{ overflowX: "auto", background: "white", borderRadius: "10px",
            border: "1px solid #ffc107", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "10px 14px", background: "#fff3cd", borderRadius: "10px 10px 0 0",
              borderBottom: "1px solid #ffc107", fontSize: "13px", fontWeight: "bold", color: "#856404" }}>
              The following users have requested a password reset
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#856404", color: "white" }}>
                  <th style={cell}>#</th>
                  <th style={cell}>Username</th>
                  <th style={cell}>Requested At</th>
                  <th style={cell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resetRequests.map((r, index) => (
                  <tr key={r.id} style={{ background: index % 2 === 0 ? "#fffbeb" : "white" }}>
                    <td style={cell}>{r.id}</td>
                    <td style={{ ...cell, fontWeight: "bold" }}>{r.username}</td>
                    <td style={cell}>
                      {r.requested_at ? new Date(r.requested_at).toLocaleString("en-IN") : "—"}
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        <button
                          onClick={() => { setApproveModal({ id: r.id, username: r.username }); setApprovePwd(""); setApproveAdminPwd(""); }}
                          style={{ ...styles.resetBtn, background: "#28a745" }}
                        >
                          Approve & Reset
                        </button>
                        <button
                          onClick={() => { setRejectModal({ id: r.id, username: r.username }); setRejectAdminPwd(""); }}
                          style={{ ...styles.resetBtn, background: "#dc3545" }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Reset Request Modal */}
      {approveModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Approve Password Reset</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Set a temporary password for <strong>"{approveModal.username}"</strong>.<br />
              They will be forced to change it on their next login.
            </p>
            <label style={styles.modalLabel}>New Temporary Password</label>
            <input
              type="password"
              value={approvePwd}
              onChange={e => setApprovePwd(e.target.value)}
              placeholder="Min 6 characters"
              style={styles.modalInput}
              autoFocus
            />
            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Your Admin Password</label>
            <input
              type="password"
              value={approveAdminPwd}
              onChange={e => setApproveAdminPwd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmApprove(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={confirmApprove}
                disabled={approveLoading}
                style={approveLoading ? styles.confirmBtnDisabled : { ...styles.confirmBtn, background: "#28a745" }}
              >
                {approveLoading ? "Approving..." : "Confirm & Reset"}
              </button>
              <button onClick={() => setApproveModal(null)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reset Request Modal */}
      {rejectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Reject Reset Request</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Reject the password reset request for <strong>"{rejectModal.username}"</strong>?<br />
              Their password will not be changed.
            </p>
            <label style={styles.modalLabel}>Your Admin Password</label>
            <input
              type="password"
              value={rejectAdminPwd}
              onChange={e => setRejectAdminPwd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmReject(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={confirmReject}
                disabled={rejectLoading}
                style={rejectLoading ? styles.confirmBtnDisabled : styles.confirmBtn}
              >
                {rejectLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
              <button onClick={() => setRejectModal(null)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Users Toggle */}
      <div style={{ marginTop: "20px" }}>
        <button onClick={toggleArchived} style={styles.archivedToggleBtn}>
          {showArchived ? "Hide Archived Users" : "Show Archived Users"}
        </button>

        {showArchived && (
          <div style={{ marginTop: "12px" }}>
            {archivedLoading ? (
              <p style={{ color: "#888" }}>Loading archived users...</p>
            ) : archivedUsers.length === 0 ? (
              <p style={{ color: "#888", fontSize: "13px" }}>No archived users.</p>
            ) : (
              <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", border: "1px solid #f5c6cb", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ padding: "10px 14px", background: "#fff3cd", borderRadius: "10px 10px 0 0", borderBottom: "1px solid #ffc107" }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px", color: "#856404" }}>
                    Archived Users — {archivedUsers.length} record{archivedUsers.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: "11px", color: "#aaa", marginLeft: "10px" }}>
                    These accounts cannot log in
                  </span>
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#6c757d", color: "white" }}>
                      <th style={cell}>ID</th>
                      <th style={cell}>Username</th>
                      <th style={cell}>Role</th>
                      <th style={cell}>Archived By</th>
                      <th style={cell}>Archived At</th>
                      <th style={cell}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedUsers.map((u, index) => (
                      <tr key={u.user_id} style={{ background: index % 2 === 0 ? "#f8f9fa" : "white", color: "#777" }}>
                        <td style={cell}>{u.user_id}</td>
                        <td style={{ ...cell, textDecoration: "line-through" }}>{u.username}</td>
                        <td style={cell}>{u.role}</td>
                        <td style={cell}>{u.archived_by || "—"}</td>
                        <td style={cell}>
                          {u.archived_at ? new Date(u.archived_at).toLocaleString("en-IN") : "—"}
                        </td>
                        <td style={cell}>
                          <button onClick={() => openRestoreModal(u.username)} style={styles.restoreBtn}>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Restore User Modal */}
      {restoreModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Restore User</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Restoring <strong>"{restoreModal.username}"</strong> will allow them to log in again.
            </p>
            <label style={styles.modalLabel}>Your Password</label>
            <input type="password" value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              placeholder="Enter your login password" style={styles.modalInput} autoFocus />
            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Reason</label>
            <input type="text" value={restoreReason}
              onChange={e => setRestoreReason(e.target.value)}
              placeholder="e.g. Rejoined organisation" style={styles.modalInput} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmRestore} disabled={restoreLoading}
                style={restoreLoading ? styles.confirmBtnDisabled : { ...styles.confirmBtn, background: "#28a745" }}>
                {restoreLoading ? "Restoring..." : "Confirm Restore"}
              </button>
              <button onClick={() => setRestoreModal(null)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Confirm Modal */}
      {showAddModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Confirm Create User</h3>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#555" }}>
              Creating user: <strong>"{username}"</strong> with role <strong>{role}</strong>
            </p>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#888" }}>
              Enter your own password to authorise this action.
            </p>

            <label style={styles.modalLabel}>Your Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmAddUser(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
              autoFocus
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={confirmAddUser}
                disabled={addLoading}
                style={addLoading ? styles.confirmBtnDisabled : { ...styles.confirmBtn, background: "#004f9f" }}
              >
                {addLoading ? "Creating..." : "Confirm Create"}
              </button>
              <button onClick={() => setShowAddModal(false)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Reset Password</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Set a temporary password for <strong>"{resetModal.username}"</strong>.<br />
              They will be forced to change it on their next login.
            </p>
            <label style={styles.modalLabel}>New Temporary Password</label>
            <input
              type="password"
              value={resetNewPwd}
              onChange={e => setResetNewPwd(e.target.value)}
              placeholder="Min 6 characters"
              style={styles.modalInput}
              autoFocus
            />
            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Your Admin Password</label>
            <input
              type="password"
              value={resetAdminPwd}
              onChange={e => setResetAdminPwd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmResetPassword(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={confirmResetPassword}
                disabled={resetLoading}
                style={resetLoading ? styles.confirmBtnDisabled : { ...styles.confirmBtn, background: "#e67e22" }}
              >
                {resetLoading ? "Resetting..." : "Reset Password"}
              </button>
              <button onClick={() => setResetModal(null)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {archiveModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#333" }}>Archive User</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              You are about to archive <strong>"{archiveModal.username}"</strong>.<br />
              This account will be disabled and cannot log in.
            </p>

            <label style={styles.modalLabel}>Your Password</label>
            <input
              type="password"
              value={archivePassword}
              onChange={e => setArchivePassword(e.target.value)}
              placeholder="Enter your login password"
              style={styles.modalInput}
              autoFocus
            />

            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Reason</label>
            <input
              type="text"
              value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              placeholder="e.g. Employee left organisation"
              style={styles.modalInput}
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={confirmArchive}
                disabled={archiveLoading}
                style={archiveLoading ? styles.confirmBtnDisabled : styles.confirmBtn}
              >
                {archiveLoading ? "Archiving..." : "Confirm Archive"}
              </button>
              <button onClick={closeArchiveModal} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const cell = { border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap" };

const styles = {
  pageHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" },
  backBtn:      { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  formBox:      { background: "white", padding: "20px", borderRadius: "10px", width: "340px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "20px" },
  input:        { width: "100%", padding: "9px 10px", margin: "5px 0", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "13px" },
  addBtn:       { width: "100%", padding: "10px", background: "#004f9f", color: "white", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer", marginTop: "6px" },
  section:      { background: "white", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  refreshBtn:   { padding: "6px 12px", background: "#f1f5f9", color: "#555", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  resetBtn:     { padding: "4px 10px", background: "#e67e22", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  archiveBtn:   { padding: "4px 10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  archivedToggleBtn: { padding: "7px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  eyeBtn:       { position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888", padding: "2px", display: "flex", alignItems: "center" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox:     { background: "white", borderRadius: "12px", padding: "28px", width: "400px", maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalLabel:   { display: "block", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  modalInput:   { width: "100%", padding: "9px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", boxSizing: "border-box" },
  restoreBtn:        { padding: "4px 10px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  confirmBtn:        { flex: 1, padding: "9px", background: "#dc3545", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  confirmBtnDisabled:{ flex: 1, padding: "9px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "13px" },
  cancelBtn:         { flex: 1, padding: "9px", background: "#f1f5f9",  color: "#333",  border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
};

export default UserManagementPage;
