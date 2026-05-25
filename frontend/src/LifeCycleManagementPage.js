import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import ContinuousCleaningVerificationPage from "./ContinuousCleaningVerificationPage";

// ── Helper ────────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return s; }
};

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4,
          transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 10, color: "#6b7280", minWidth: 30, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function LifeCycleManagementPage({ goHome, currentUser, role }) {
  const [activeTab, setActiveTab] = useState("schedule");

  // Schedule state
  const [schedData,    setSchedData]    = useState(null);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedError,   setSchedError]   = useState("");


  // Inline completion entry state
  const [rowDate,       setRowDate]       = useState({});
  const [savingRow,     setSavingRow]     = useState(null);
  const [pendingRow,    setPendingRow]    = useState(null);  // row awaiting password confirm
  const [modalPassword, setModalPassword] = useState("");

  const loadSchedule = useCallback(async () => {
    setSchedLoading(true);
    setSchedError("");
    try {
      const res = await api.get("/ccv/schedule");
      setSchedData(res.data);
    } catch (e) {
      const d = e.response?.data?.detail;
      setSchedError(typeof d === "string" ? d : "Failed to load schedule.");
    } finally {
      setSchedLoading(false);
    }
  }, []);

  const openVerifyModal = (row) => {
    const date = rowDate[row.product_id];
    if (!date) { alert("Select a completion date first ❌"); return; }
    setPendingRow(row);
    setModalPassword("");
  };

  const confirmVerification = async () => {
    if (!modalPassword) { alert("Enter your password ❌"); return; }
    const row = pendingRow;
    setSavingRow(row.product_id);
    setPendingRow(null);
    try {
      await api.post("/lifecycle/verification", {
        product_id:      row.product_id,
        report_id:       row.report_id,
        completion_date: rowDate[row.product_id],
        password:        modalPassword,
      });
      setRowDate(prev => { const n = { ...prev }; delete n[row.product_id]; return n; });
      setModalPassword("");
      setSchedData(null);
      loadSchedule();
      alert("Verification completion recorded ✅");
    } catch (e) {
      const d = e.response?.data?.detail;
      alert(typeof d === "string" ? d : "Save failed ❌");
    } finally {
      setSavingRow(null);
    }
  };

  useEffect(() => {
    if (activeTab === "schedule" && !schedData) loadSchedule();
  }, [activeTab, schedData, loadSchedule]);

  const th = { background: "#004f9f", color: "white", padding: "8px 10px",
    textAlign: "left", fontSize: 11, fontWeight: "bold", border: "1px solid #0044a0" };
  const td = { border: "1px solid #e2e8f0", padding: "8px 10px",
    verticalAlign: "top", fontSize: 12 };

  return (
    <div style={{ padding: 20, fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #004f9f 0%, #0066cc 100%)",
        padding: "12px 16px", borderRadius: 10, marginBottom: 20, color: "white",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Life Cycle Management</h2>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            Cleaning Validation — Site Overview &amp; Verification Schedule
          </div>
        </div>
        <button onClick={goHome} style={{
          padding: "8px 14px", borderRadius: 6, border: "none",
          background: "white", color: "#004f9f", fontWeight: "bold",
          cursor: "pointer", fontSize: 13,
        }}>
          Back to Home
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { id: "schedule",  label: "Schedule" },
          { id: "ccv",       label: "Continuous Cleaning Verification" },
          { id: "cvpr-protocol", label: "Periodic Cleaning Verification Protocol" },
          { id: "cvpr-report",   label: "Periodic Cleaning Verification Report" },
          { id: "deht",          label: "Dirty Equipment Hold Time Study" },
          { id: "ceht",          label: "Clean Equipment Hold Time Study" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "10px 18px", border: "none", background: "transparent",
            cursor: "pointer", fontSize: 13,
            fontWeight: activeTab === t.id ? "bold" : "normal",
            color: activeTab === t.id ? "#004f9f" : "#666",
            borderBottom: activeTab === t.id ? "3px solid #004f9f" : "3px solid transparent",
            borderRadius: "4px 4px 0 0", transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: "white", borderRadius: "0 0 10px 10px", padding: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>

        {/* ── CCV TAB ── */}
        {activeTab === "ccv" && (
          <ContinuousCleaningVerificationPage
            noHeader
            currentUser={currentUser}
            role={role}
            goHome={goHome}
          />
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === "schedule" && (
          <div>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#004f9f", fontSize: 18 }}>
                Cleaning Verification Schedule
              </h3>
              <button onClick={() => { setSchedData(null); loadSchedule(); }}
                disabled={schedLoading} style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                  background: "#f8fafc", color: "#374151", cursor: "pointer", fontSize: 12,
                }}>
                {schedLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {schedLoading && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#004f9f" }}>Loading…</div>
            )}

            {schedError && !schedLoading && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8,
                padding: "12px 16px", color: "#b91c1c" }}>
                {schedError}
              </div>
            )}

            {schedData && !schedLoading && (() => {
              const upcoming  = schedData.filter(r => !r.completion_date);
              const completed = schedData.filter(r =>  r.completion_date);
              return (
                <>
                  {/* Upcoming verifications */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontWeight: "bold", fontSize: 15, color: "#004f9f" }}>Upcoming Verifications</span>
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 11,
                        fontWeight: "bold", borderRadius: 10, padding: "2px 10px" }}>{upcoming.length}</span>
                    </div>
                    {upcoming.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 0", color: "#94a3b8", fontSize: 13,
                        background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        No upcoming verifications — all validations have recorded completions.
                      </div>
                    ) : (
                      <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%" }}>
                          <thead>
                            <tr>
                              <th style={th}>Facility</th>
                              <th style={th}>Product</th>
                              <th style={th}>Cleaning Validation Completed</th>
                              <th style={th}>Verification Due</th>
                              <th style={{ ...th, minWidth: 320 }}>Enter Completion Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcoming.map((row, i) => (
                              <tr key={row.product_id}
                                style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                                <td style={td}>{row.facility_name}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{row.product_name}</td>
                                <td style={td}>{fmtDate(row.validation_date)}</td>
                                <td style={td}>{fmtDate(row.next_due_date)}</td>
                                <td style={td}>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <input
                                      type="date"
                                      value={rowDate[row.product_id] || ""}
                                      onChange={e => setRowDate(prev => ({ ...prev, [row.product_id]: e.target.value }))}
                                      style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #ccc",
                                        fontSize: 12, cursor: "pointer" }}
                                    />
                                    <button
                                      onClick={() => openVerifyModal(row)}
                                      disabled={savingRow === row.product_id}
                                      style={{
                                        padding: "5px 12px", borderRadius: 5, border: "none",
                                        background: savingRow === row.product_id ? "#94a3b8" : "#22c55e",
                                        color: "white", fontWeight: "bold", fontSize: 12,
                                        cursor: savingRow === row.product_id ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                      }}>
                                      {savingRow === row.product_id ? "Saving…" : "Mark Done"}
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

                  {/* Completed verifications */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontWeight: "bold", fontSize: 15, color: "#15803d" }}>Completed Verifications</span>
                      <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11,
                        fontWeight: "bold", borderRadius: 10, padding: "2px 10px" }}>{completed.length}</span>
                    </div>
                    {completed.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 0", color: "#94a3b8", fontSize: 13,
                        background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        No completions recorded yet.
                      </div>
                    ) : (
                      <div style={{ borderRadius: 8, border: "1px solid #bbf7d0", overflow: "hidden" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%" }}>
                          <thead>
                            <tr>
                              <th style={{ ...th, background: "#15803d" }}>Facility</th>
                              <th style={{ ...th, background: "#15803d" }}>Product</th>
                              <th style={{ ...th, background: "#15803d" }}>Completion Date</th>
                              <th style={{ ...th, background: "#15803d" }}>Next Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completed.map((row, i) => (
                              <tr key={row.product_id}
                                style={{ background: i % 2 === 0 ? "#f0fdf4" : "white" }}>
                                <td style={td}>{row.facility_name}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{row.product_name}</td>
                                <td style={{ ...td, color: "#15803d", fontWeight: 600 }}>{fmtDate(row.completion_date)}</td>
                                <td style={td}>{fmtDate(row.next_due_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {schedData.length === 0 && (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 13 }}>
                      No approved validation reports found.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── PERIODIC CLEANING VERIFICATION PROTOCOL TAB ── */}
        {activeTab === "cvpr-protocol" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h3 style={{ margin: "0 0 8px", color: "#004f9f", fontSize: 18 }}>
              Periodic Cleaning Verification Protocol
            </h3>
            <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#94a3b8",
              maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
              The protocol overview — approved protocols, status, and completion progress
              by facility and product — is available in the <strong>Dashboard</strong>.
            </p>
          </div>
        )}

        {/* ── PERIODIC CLEANING VERIFICATION REPORT TAB ── */}
        {activeTab === "cvpr-report" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <h3 style={{ margin: "0 0 8px", color: "#004f9f", fontSize: 18 }}>
              Periodic Cleaning Verification Report
            </h3>
            <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#94a3b8",
              maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
              The verification report log — completion entries, dates, and recorded-by — is
              available in the <strong>Dashboard</strong>.
            </p>
          </div>
        )}

        {/* ── DIRTY EQUIPMENT HOLD TIME STUDY TAB ── */}
        {activeTab === "deht" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏱️</div>
            <h3 style={{ margin: "0 0 8px", color: "#004f9f", fontSize: 18 }}>
              Dirty Equipment Hold Time Study
            </h3>
            <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#94a3b8",
              maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              This section will capture hold time studies for dirty equipment — recording
              the maximum allowable time between end of production and start of cleaning.
            </p>
            <div style={{ marginTop: 24, display: "inline-block", padding: "8px 20px",
              background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8,
              fontSize: 12, color: "#c2410c", fontWeight: 600 }}>
              Coming Soon — Under Development
            </div>
          </div>
        )}

        {/* ── CLEAN EQUIPMENT HOLD TIME STUDY TAB ── */}
        {activeTab === "ceht" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ margin: "0 0 8px", color: "#004f9f", fontSize: 18 }}>
              Clean Equipment Hold Time Study
            </h3>
            <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#94a3b8",
              maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              This section will capture hold time studies for clean equipment — recording
              the maximum allowable time between cleaning completion and next use.
            </p>
            <div style={{ marginTop: 24, display: "inline-block", padding: "8px 20px",
              background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
              fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              Coming Soon — Under Development
            </div>
          </div>
        )}
      </div>

            {/* Verification password modal */}
      {pendingRow && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 28,
            width: 400, maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Confirm Verification Completion</h3>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#555" }}>
              Recording completion for:
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: "bold", color: "#004f9f" }}>
              {pendingRow.product_name}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#555" }}>
              Completion date: <strong>{fmtDate(rowDate[pendingRow.product_id])}</strong>
            </p>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#555",
              textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
              Your Password
            </label>
            <input
              type="password"
              value={modalPassword}
              onChange={e => setModalPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmVerification(); }}
              placeholder="Enter your login password"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6,
                border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={confirmVerification}
                style={{ flex: 1, padding: 9, background: "#22c55e", color: "white",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  fontWeight: "bold", fontSize: 13 }}>
                Confirm
              </button>
              <button
                onClick={() => { setPendingRow(null); setModalPassword(""); }}
                style={{ flex: 1, padding: 9, background: "#f1f5f9", color: "#333",
                  border: "1px solid #ccc", borderRadius: 6, cursor: "pointer",
                  fontWeight: "bold", fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
