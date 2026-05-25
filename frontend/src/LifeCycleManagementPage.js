import React, { useState, useEffect, useCallback } from "react";
import api from "./api";

// ── Helper ────────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return s; }
};

// ── Dashboard sub-components ──────────────────────────────────────────
function KpiCard({ value, label, color, bg }) {
  return (
    <div style={{
      background: bg || "white", border: `1px solid ${color}33`,
      borderRadius: 10, padding: "16px 18px", textAlign: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)", flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 30, fontWeight: "bold", color, lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
    </div>
  );
}

function DonutChart({ completed, pending, size = 180 }) {
  const cx = size / 2, cy = size / 2, r = 62;
  const C = 2 * Math.PI * r;
  const total = completed + pending;
  if (total === 0) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={26} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#94a3b8">No data</text>
    </svg>
  );
  const completedLen = (completed / total) * C;
  const pendingLen   = (pending   / total) * C;
  const pct = Math.round((completed / total) * 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={26} />
      {completedLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth={26}
          strokeDasharray={`${completedLen} ${C - completedLen}`}
          transform={`rotate(-90, ${cx}, ${cy})`} />
      )}
      {pendingLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth={26}
          strokeDasharray={`${pendingLen} ${C - pendingLen}`}
          transform={`rotate(${-90 + (completedLen / C) * 360}, ${cx}, ${cy})`} />
      )}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={28} fontWeight="bold" fill="#1e293b">
        {pct}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#64748b">Completed</text>
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={9} fill="#94a3b8">
        {completed}/{total} protocols
      </text>
    </svg>
  );
}

function FacilityBarChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: 200, color: "#94a3b8", fontSize: 13 }}>No facility data</div>
  );
  const W = 580, H = 230;
  const pad = { top: 24, right: 16, bottom: 64, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...data.map(d =>
    Math.max(d.product_count, d.protocol_count, d.report_count + d.pending_count)));
  const barGroups = [
    { key: "product_count",  color: "#60a5fa", label: "Products" },
    { key: "protocol_count", color: "#818cf8", label: "Approved Protocols" },
    { key: "report_count",   color: "#34d399", label: "Reports Done" },
    { key: "pending_count",  color: "#fb923c", label: "Pending" },
  ];
  const groupW   = iW / data.length;
  const barW     = Math.min(18, (groupW - 16) / barGroups.length);
  const groupPad = (groupW - barW * barGroups.length) / 2;
  const yTicks   = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {yTicks.map(pct => {
          const y = iH - pct * iH;
          return (
            <g key={pct}>
              <line x1={0} x2={iW} y1={y} y2={y}
                stroke={pct === 0 ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={pct === 0 ? 1.5 : 1}
                strokeDasharray={pct === 0 ? "0" : "3,3"} />
              <text x={-6} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                {Math.round(pct * maxVal)}
              </text>
            </g>
          );
        })}
        {data.map((fac, fi) => {
          const gx = fi * groupW + groupPad;
          const labelX = fi * groupW + groupW / 2;
          const name = fac.facility_name.length > 14
            ? fac.facility_name.slice(0, 13) + "…" : fac.facility_name;
          return (
            <g key={fac.facility_id}>
              {barGroups.map((bg, bi) => {
                const val = fac[bg.key] || 0;
                const bh  = (val / maxVal) * iH;
                const bx  = gx + bi * barW;
                const by  = iH - bh;
                return (
                  <g key={bg.key}>
                    <rect x={bx} y={by} width={barW - 1} height={bh}
                      fill={bg.color} rx={2} opacity={0.9} />
                    {val > 0 && bh > 14 && (
                      <text x={bx + (barW - 1) / 2} y={by + 11}
                        textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">{val}</text>
                    )}
                    {val > 0 && bh <= 14 && (
                      <text x={bx + (barW - 1) / 2} y={by - 3}
                        textAnchor="middle" fontSize={8} fill="#475569" fontWeight="bold">{val}</text>
                    )}
                  </g>
                );
              })}
              <text x={labelX} y={iH + 16} textAnchor="middle" fontSize={9} fill="#374151"
                fontWeight="600">{name}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

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
export default function LifeCycleManagementPage({ goHome, currentUser }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Dashboard state
  const [dashData,    setDashData]    = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError,   setDashError]   = useState("");
  const [expandedFac, setExpandedFac] = useState(new Set());
  const [dashLastAt,  setDashLastAt]  = useState(null);
  const [dashView,    setDashView]    = useState("both");

  // Schedule state
  const [schedData,    setSchedData]    = useState(null);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedError,   setSchedError]   = useState("");

  // Inline completion entry state
  const [rowDate,       setRowDate]       = useState({});
  const [savingRow,     setSavingRow]     = useState(null);
  const [pendingRow,    setPendingRow]    = useState(null);  // row awaiting password confirm
  const [modalPassword, setModalPassword] = useState("");

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError("");
    try {
      const res = await api.get("/dashboard/summary");
      setDashData(res.data);
      setDashLastAt(new Date());
    } catch (e) {
      setDashError(e.response?.data?.detail || "Failed to load dashboard.");
    } finally {
      setDashLoading(false);
    }
  }, []);

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

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === "schedule" && !schedData) loadSchedule();
  }, [activeTab, schedData, loadSchedule]);

  const toggleFacility = (fid) => {
    setExpandedFac(prev => {
      const next = new Set(prev);
      next.has(fid) ? next.delete(fid) : next.add(fid);
      return next;
    });
  };

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
          { id: "dashboard", label: "Dashboard" },
          { id: "schedule",  label: "Schedule" },
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

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: "#004f9f", fontSize: 18 }}>Site Validation Status</h3>
                {dashLastAt && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                    Last refreshed: {dashLastAt.toLocaleTimeString("en-IN")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["both", "chart", "table"].map(v => (
                  <button key={v} onClick={() => setDashView(v)} style={{
                    padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
                    background: dashView === v ? "#004f9f" : "white",
                    color: dashView === v ? "white" : "#555",
                    cursor: "pointer", fontSize: 12, fontWeight: dashView === v ? "bold" : "normal",
                  }}>
                    {v === "both" ? "Both" : v === "chart" ? "Chart" : "Table"}
                  </button>
                ))}
                <button onClick={loadDashboard} disabled={dashLoading} style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                  background: "#f8fafc", color: "#374151", cursor: "pointer", fontSize: 12,
                }}>
                  {dashLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {dashLoading && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#004f9f" }}>
                Loading dashboard…
              </div>
            )}

            {dashError && !dashLoading && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8,
                padding: "14px 18px", color: "#b91c1c", marginBottom: 16 }}>
                {dashError}
              </div>
            )}

            {dashData && !dashLoading && (() => {
              const t = dashData.totals;
              const byFac  = dashData.by_facility || [];
              const byProd = dashData.by_product  || [];
              return (
                <>
                  {/* KPI cards */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    <KpiCard value={t.facilities}         label="Facilities"         color="#004f9f" bg="#eff6ff" />
                    <KpiCard value={t.products}           label="Active Products"    color="#0891b2" bg="#ecfeff" />
                    <KpiCard value={t.approved_protocols} label="Approved Protocols" color="#7c3aed" bg="#f5f3ff" />
                    <KpiCard value={t.completed_reports}  label="Reports Completed"  color="#16a34a" bg="#f0fdf4" />
                    <KpiCard value={t.pending_reports}    label="Pending Reports"    color="#ea580c" bg="#fff7ed" />
                  </div>

                  {/* Charts */}
                  {(dashView === "both" || dashView === "chart") && (
                    <div style={{ display: "grid",
                      gridTemplateColumns: byFac.length > 0 ? "1fr 260px" : "1fr",
                      gap: 20, marginBottom: 24, alignItems: "start" }}>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: "16px 20px" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#1e293b",
                          marginBottom: 12 }}>Validation Progress by Facility</div>
                        <FacilityBarChart data={byFac} />
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap",
                          marginTop: 8, justifyContent: "center" }}>
                          {[
                            { color: "#60a5fa", label: "Products" },
                            { color: "#818cf8", label: "Approved Protocols" },
                            { color: "#34d399", label: "Reports Done" },
                            { color: "#fb923c", label: "Pending" },
                          ].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
                              <span style={{ fontSize: 11, color: "#475569" }}>{l.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#1e293b",
                          marginBottom: 12 }}>Protocol Completion</div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <DonutChart completed={t.completed_reports} pending={t.pending_reports} />
                        </div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { color: "#22c55e", label: "Reports Completed", val: t.completed_reports },
                            { color: "#f97316", label: "Pending",           val: t.pending_reports },
                          ].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center",
                              gap: 8, justifyContent: "center" }}>
                              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
                              <span style={{ fontSize: 11, color: "#475569" }}>{l.label}</span>
                              <span style={{ fontSize: 12, fontWeight: "bold", color: "#1e293b" }}>{l.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Facility / product table */}
                  {(dashView === "both" || dashView === "table") && (
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 14, color: "#1e293b", marginBottom: 10 }}>
                        Breakdown by Facility &amp; Product
                      </div>
                      {byFac.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                          No facilities found.
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: "#004f9f", color: "white" }}>
                                <th style={{ ...th, width: 32 }}></th>
                                <th style={th}>Facility / Product</th>
                                <th style={{ ...th, textAlign: "center", width: 90 }}>Products</th>
                                <th style={{ ...th, textAlign: "center", width: 120 }}>Approved Protocols</th>
                                <th style={{ ...th, textAlign: "center", width: 110 }}>Reports Done</th>
                                <th style={{ ...th, textAlign: "center", width: 90 }}>Pending</th>
                                <th style={{ ...th, minWidth: 160 }}>Progress</th>
                              </tr>
                            </thead>
                            <tbody>
                              {byFac.map((fac, fi) => {
                                const facProds  = byProd.filter(p => p.facility_id === fac.facility_id);
                                const isExpanded = expandedFac.has(fac.facility_id);
                                const rowBg = fi % 2 === 0 ? "white" : "#f8fafc";
                                return (
                                  <React.Fragment key={fac.facility_id}>
                                    <tr style={{ background: rowBg, cursor: "pointer" }}
                                      onClick={() => toggleFacility(fac.facility_id)}>
                                      <td style={{ ...td, textAlign: "center", color: "#004f9f",
                                        fontSize: 16, fontWeight: "bold" }}>
                                        {isExpanded ? "▾" : "▸"}
                                      </td>
                                      <td style={{ ...td, fontWeight: "bold", color: "#1e293b", fontSize: 13 }}>
                                        {fac.facility_name}
                                        {facProds.length > 0 && (
                                          <span style={{ fontSize: 10, color: "#94a3b8",
                                            marginLeft: 8, fontWeight: "normal" }}>
                                            {facProds.length} product{facProds.length !== 1 ? "s" : ""}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ ...td, textAlign: "center" }}>
                                        <span style={{ background: "#dbeafe", color: "#1d4ed8",
                                          borderRadius: 10, padding: "2px 10px", fontWeight: "bold",
                                          fontSize: 13 }}>{fac.product_count}</span>
                                      </td>
                                      <td style={{ ...td, textAlign: "center" }}>
                                        <span style={{ background: "#ede9fe", color: "#6d28d9",
                                          borderRadius: 10, padding: "2px 10px", fontWeight: "bold",
                                          fontSize: 13 }}>{fac.protocol_count}</span>
                                      </td>
                                      <td style={{ ...td, textAlign: "center" }}>
                                        <span style={{ background: "#dcfce7", color: "#15803d",
                                          borderRadius: 10, padding: "2px 10px", fontWeight: "bold",
                                          fontSize: 13 }}>{fac.report_count}</span>
                                      </td>
                                      <td style={{ ...td, textAlign: "center" }}>
                                        <span style={{
                                          background: fac.pending_count > 0 ? "#ffedd5" : "#f1f5f9",
                                          color: fac.pending_count > 0 ? "#c2410c" : "#94a3b8",
                                          borderRadius: 10, padding: "2px 10px", fontWeight: "bold",
                                          fontSize: 13,
                                        }}>{fac.pending_count}</span>
                                      </td>
                                      <td style={td}>
                                        <ProgressBar value={fac.report_count}
                                          max={fac.protocol_count || 1} color="#22c55e" />
                                      </td>
                                    </tr>
                                    {isExpanded && facProds.map((prod, pi) => (
                                      <tr key={prod.product_id}
                                        style={{ background: pi % 2 === 0 ? "#fafbff" : "#f0f4ff" }}>
                                        <td style={{ ...td, borderLeft: "4px solid #818cf8" }}></td>
                                        <td style={{ ...td, paddingLeft: 28, color: "#374151", fontSize: 12 }}>
                                          <div style={{ fontWeight: 600 }}>{prod.product_name}</div>
                                          {prod.latest_protocol_at && (
                                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                                              Last protocol: {fmtDate(prod.latest_protocol_at)}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>—</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.protocol_count > 0
                                            ? <span style={{ background: "#ede9fe", color: "#6d28d9",
                                                borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                                fontWeight: "bold" }}>{prod.protocol_count}</span>
                                            : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.protocol_count > 0
                                            ? <span style={{ background: "#dcfce7", color: "#15803d",
                                                borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                                fontWeight: "bold" }}>{prod.report_count}</span>
                                            : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.pending_count > 0
                                            ? <span style={{ background: "#ffedd5", color: "#c2410c",
                                                borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                                fontWeight: "bold" }}>{prod.pending_count}</span>
                                            : prod.protocol_count > 0
                                              ? <span style={{ background: "#f0fdf4", color: "#16a34a",
                                                  borderRadius: 10, padding: "2px 8px", fontSize: 12 }}>
                                                  ✓ Done
                                                </span>
                                              : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                                        </td>
                                        <td style={td}>
                                          {prod.protocol_count > 0
                                            ? <ProgressBar value={prod.report_count}
                                                max={prod.protocol_count} color="#818cf8" />
                                            : <span style={{ fontSize: 11, color: "#cbd5e1",
                                                fontStyle: "italic" }}>No protocol yet</span>}
                                        </td>
                                      </tr>
                                    ))}
                                    {isExpanded && facProds.length === 0 && (
                                      <tr>
                                        <td />
                                        <td colSpan={6} style={{ ...td, paddingLeft: 28,
                                          color: "#94a3b8", fontStyle: "italic", fontSize: 12 }}>
                                          No active products in this facility.
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#eff6ff", fontWeight: "bold" }}>
                                <td style={td}></td>
                                <td style={{ ...td, color: "#004f9f" }}>Total</td>
                                <td style={{ ...td, textAlign: "center", color: "#1d4ed8" }}>{t.products}</td>
                                <td style={{ ...td, textAlign: "center", color: "#6d28d9" }}>{t.approved_protocols}</td>
                                <td style={{ ...td, textAlign: "center", color: "#15803d" }}>{t.completed_reports}</td>
                                <td style={{ ...td, textAlign: "center",
                                  color: t.pending_reports > 0 ? "#c2410c" : "#94a3b8" }}>{t.pending_reports}</td>
                                <td style={td}>
                                  <ProgressBar value={t.completed_reports}
                                    max={t.approved_protocols || 1} color="#004f9f" />
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap",
                        fontSize: 11, color: "#64748b", padding: "8px 12px", background: "#f8fafc",
                        borderRadius: 6, border: "1px solid #e2e8f0" }}>
                        <strong style={{ color: "#374151" }}>Key:</strong>
                        <span><span style={{ color: "#6d28d9", fontWeight: "bold" }}>Approved Protocols</span> — Final-status protocol archives</span>
                        <span><span style={{ color: "#15803d", fontWeight: "bold" }}>Reports Done</span> — Completed cleaning validation reports</span>
                        <span><span style={{ color: "#c2410c", fontWeight: "bold" }}>Pending</span> — Approved protocols without a completed report</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
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
