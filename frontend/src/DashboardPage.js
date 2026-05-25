import React, { useState, useEffect, useCallback } from "react";
import api from "./api";

// ── Helpers ───────────────────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
};

function KpiCard({ value, label, color, bg }) {
  return (
    <div style={{ background: bg || "white", border: `1px solid ${color}33`, borderRadius: 10,
      padding: "16px 18px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 30, fontWeight: "bold", color, lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
    </div>
  );
}

function DonutChart({ completed, pending, size = 170 }) {
  const cx = size / 2, cy = size / 2, r = 58;
  const C = 2 * Math.PI * r;
  const total = completed + pending;
  if (total === 0) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={24} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={11} fill="#94a3b8">No data</text>
    </svg>
  );
  const completedLen = (completed / total) * C;
  const pendingLen   = (pending   / total) * C;
  const pct = Math.round((completed / total) * 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={24} />
      {completedLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth={24}
          strokeDasharray={`${completedLen} ${C - completedLen}`}
          transform={`rotate(-90, ${cx}, ${cy})`} />
      )}
      {pendingLen > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth={24}
          strokeDasharray={`${pendingLen} ${C - pendingLen}`}
          transform={`rotate(${-90 + (completedLen / C) * 360}, ${cx}, ${cy})`} />
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={26} fontWeight="bold" fill="#1e293b">{pct}%</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10} fill="#64748b">Completed</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={9} fill="#94a3b8">{completed}/{total} protocols</text>
    </svg>
  );
}

function FacilityBarChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: 180, color: "#94a3b8", fontSize: 13 }}>No facility data</div>
  );
  const W = 560, H = 220;
  const pad = { top: 22, right: 14, bottom: 60, left: 40 };
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...data.map(d =>
    Math.max(d.product_count, d.protocol_count, d.report_count + d.pending_count)));
  const barGroups = [
    { key: "product_count",  color: "#60a5fa", label: "Products" },
    { key: "protocol_count", color: "#818cf8", label: "Approved Protocols" },
    { key: "report_count",   color: "#34d399", label: "Reports Done" },
    { key: "pending_count",  color: "#fb923c", label: "Pending" },
  ];
  const groupW   = iW / data.length;
  const barW     = Math.min(16, (groupW - 14) / barGroups.length);
  const groupPad = (groupW - barW * barGroups.length) / 2;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = iH - pct * iH;
          return (
            <g key={pct}>
              <line x1={0} x2={iW} y1={y} y2={y}
                stroke={pct === 0 ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={pct === 0 ? 1.5 : 1}
                strokeDasharray={pct === 0 ? "0" : "3,3"} />
              <text x={-5} y={y + 4} textAnchor="end" fontSize={8} fill="#94a3b8">
                {Math.round(pct * maxVal)}
              </text>
            </g>
          );
        })}
        {data.map((fac, fi) => {
          const gx = fi * groupW + groupPad;
          const name = fac.facility_name.length > 13 ? fac.facility_name.slice(0, 12) + "…" : fac.facility_name;
          return (
            <g key={fac.facility_id}>
              {barGroups.map((bg, bi) => {
                const val = fac[bg.key] || 0;
                const bh  = (val / maxVal) * iH;
                const bx  = gx + bi * barW;
                const by  = iH - bh;
                return (
                  <g key={bg.key}>
                    <rect x={bx} y={by} width={barW - 1} height={bh} fill={bg.color} rx={2} opacity={0.9} />
                    {val > 0 && bh > 13 && (
                      <text x={bx + (barW - 1) / 2} y={by + 10}
                        textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">{val}</text>
                    )}
                    {val > 0 && bh <= 13 && (
                      <text x={bx + (barW - 1) / 2} y={by - 3}
                        textAnchor="middle" fontSize={7} fill="#475569" fontWeight="bold">{val}</text>
                    )}
                  </g>
                );
              })}
              <text x={fi * groupW + groupW / 2} y={iH + 15} textAnchor="middle"
                fontSize={8} fill="#374151" fontWeight="600">{name}</text>
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
export default function DashboardPage({ goHome, currentUser }) {
  // Dashboard state
  const [dashData,    setDashData]    = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError,   setDashError]   = useState("");
  const [dashLastAt,  setDashLastAt]  = useState(null);
  const [dashView,    setDashView]    = useState("both");
  const [expandedFac, setExpandedFac] = useState(new Set());

  // Verification log state
  const [verifData,    setVerifData]    = useState(null);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifError,   setVerifError]   = useState("");

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

  const loadVerifications = useCallback(async () => {
    setVerifLoading(true);
    setVerifError("");
    try {
      const res = await api.get("/lifecycle/verifications");
      setVerifData(res.data);
    } catch (e) {
      const d = e.response?.data?.detail;
      setVerifError(typeof d === "string" ? d : "Failed to load verification log.");
    } finally {
      setVerifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadVerifications();
  }, [loadDashboard, loadVerifications]);

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
        padding: "12px 16px", borderRadius: 10, marginBottom: 24, color: "white",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Dashboard</h2>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            Site Validation Status &bull; Periodic Cleaning Verification Protocol &amp; Report
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

      {/* ══════════════════════════════════════════════════
          SECTION 1 — SITE VALIDATION DASHBOARD
      ══════════════════════════════════════════════════ */}
      <div style={{ background: "white", borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 24, marginBottom: 24 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, color: "#004f9f", fontSize: 17, fontWeight: "bold" }}>
              Site Validation Status
            </h3>
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

        {dashLoading && !dashData && (
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

        {dashData && (() => {
          const t     = dashData.totals;
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
                  gridTemplateColumns: byFac.length > 0 ? "1fr 250px" : "1fr",
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
                          <div style={{ width: 11, height: 11, borderRadius: 2, background: l.color }} />
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
                          <div style={{ width: 11, height: 11, borderRadius: 2, background: l.color }} />
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
                          <tr>
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
                            const facProds   = byProd.filter(p => p.facility_id === fac.facility_id);
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

      {/* ══════════════════════════════════════════════════
          SECTION 2 — PERIODIC CLEANING VERIFICATION PROTOCOL
      ══════════════════════════════════════════════════ */}
      <div style={{ background: "white", borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 24, marginBottom: 24 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, color: "#004f9f", fontSize: 17, fontWeight: "bold" }}>
              Periodic Cleaning Verification Protocol
            </h3>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
              Protocol overview by facility &amp; product — approved protocols and completion status
            </div>
          </div>
          <button
            onClick={loadDashboard}
            disabled={dashLoading}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
              background: "#f8fafc", color: "#374151", cursor: "pointer", fontSize: 12 }}>
            {dashLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* KPI summary */}
        {dashData && (() => {
          const t = dashData.totals;
          return (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <KpiCard value={t.facilities}         label="Facilities"         color="#004f9f" bg="#eff6ff" />
              <KpiCard value={t.products}           label="Active Products"    color="#0891b2" bg="#ecfeff" />
              <KpiCard value={t.approved_protocols} label="Approved Protocols" color="#7c3aed" bg="#f5f3ff" />
              <KpiCard value={t.completed_reports}  label="Reports Completed"  color="#16a34a" bg="#f0fdf4" />
              <KpiCard value={t.pending_reports}    label="Pending Reports"    color="#ea580c" bg="#fff7ed" />
            </div>
          );
        })()}

        {/* Protocol overview table */}
        {dashData && (() => {
          const thG = { ...th };
          const tdG = { ...td };
          return (
            <div>
              <div style={{ fontWeight: "bold", fontSize: 14, color: "#1e293b",
                marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
                Protocol Overview by Facility &amp; Product
              </div>
              {dashData.by_facility.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "#94a3b8", fontSize: 13,
                  background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  No facilities or products found.
                </div>
              ) : (
                <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={thG}>Facility</th>
                        <th style={thG}>Product</th>
                        <th style={{ ...thG, textAlign: "center", width: 130 }}>Approved Protocols</th>
                        <th style={{ ...thG, textAlign: "center", width: 120 }}>Reports Completed</th>
                        <th style={{ ...thG, textAlign: "center", width: 100 }}>Pending</th>
                        <th style={{ ...thG, textAlign: "center", width: 120 }}>Protocol Status</th>
                        <th style={{ ...thG, minWidth: 160 }}>Completion Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashData.by_facility.map((fac) => {
                        const facProds = dashData.by_product.filter(p => p.facility_id === fac.facility_id);
                        if (facProds.length === 0) {
                          return (
                            <tr key={fac.facility_id} style={{ background: "#f8fafc" }}>
                              <td style={{ ...tdG, fontWeight: "bold", color: "#1e293b" }} colSpan={2}>
                                {fac.facility_name}
                                <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 8, fontWeight: "normal" }}>
                                  No active products
                                </span>
                              </td>
                              <td colSpan={5} style={{ ...tdG, color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>
                                No products registered for this facility.
                              </td>
                            </tr>
                          );
                        }
                        return facProds.map((prod, pi) => {
                          const allDone    = prod.protocol_count > 0 && prod.pending_count === 0;
                          const noProto    = prod.protocol_count === 0;
                          const statusLabel = noProto ? "No Protocol" : allDone ? "Completed" : "In Progress";
                          const statusColor = noProto ? "#94a3b8" : allDone ? "#16a34a" : "#ea580c";
                          const statusBg    = noProto ? "#f1f5f9"  : allDone ? "#dcfce7"  : "#fff7ed";
                          return (
                            <tr key={prod.product_id}
                              style={{ background: pi % 2 === 0 ? "white" : "#f8fafc" }}>
                              {pi === 0 && (
                                <td style={{ ...tdG, fontWeight: "bold", color: "#1e293b", verticalAlign: "middle" }}
                                  rowSpan={facProds.length}>
                                  {fac.facility_name}
                                </td>
                              )}
                              <td style={{ ...tdG, fontWeight: 600, color: "#374151" }}>{prod.product_name}</td>
                              <td style={{ ...tdG, textAlign: "center" }}>
                                {prod.protocol_count > 0
                                  ? <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 10,
                                      padding: "2px 10px", fontWeight: "bold", fontSize: 12 }}>
                                      {prod.protocol_count}
                                    </span>
                                  : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                              </td>
                              <td style={{ ...tdG, textAlign: "center" }}>
                                {prod.protocol_count > 0
                                  ? <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 10,
                                      padding: "2px 10px", fontWeight: "bold", fontSize: 12 }}>
                                      {prod.report_count}
                                    </span>
                                  : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>}
                              </td>
                              <td style={{ ...tdG, textAlign: "center" }}>
                                {prod.pending_count > 0
                                  ? <span style={{ background: "#ffedd5", color: "#c2410c", borderRadius: 10,
                                      padding: "2px 10px", fontWeight: "bold", fontSize: 12 }}>
                                      {prod.pending_count}
                                    </span>
                                  : <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>}
                              </td>
                              <td style={{ ...tdG, textAlign: "center" }}>
                                <span style={{ background: statusBg, color: statusColor, borderRadius: 10,
                                  padding: "3px 10px", fontWeight: "bold", fontSize: 11 }}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td style={tdG}>
                                {prod.protocol_count > 0
                                  ? <ProgressBar value={prod.report_count}
                                      max={prod.protocol_count} color={allDone ? "#16a34a" : "#7c3aed"} />
                                  : <span style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>
                                      No protocol yet
                                    </span>}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#eff6ff", fontWeight: "bold" }}>
                        <td style={{ ...tdG, color: "#004f9f" }} colSpan={2}>Total</td>
                        <td style={{ ...tdG, textAlign: "center", color: "#6d28d9" }}>
                          {dashData.totals.approved_protocols}
                        </td>
                        <td style={{ ...tdG, textAlign: "center", color: "#15803d" }}>
                          {dashData.totals.completed_reports}
                        </td>
                        <td style={{ ...tdG, textAlign: "center",
                          color: dashData.totals.pending_reports > 0 ? "#c2410c" : "#94a3b8" }}>
                          {dashData.totals.pending_reports}
                        </td>
                        <td style={tdG}></td>
                        <td style={tdG}>
                          <ProgressBar value={dashData.totals.completed_reports}
                            max={dashData.totals.approved_protocols || 1} color="#004f9f" />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — PERIODIC CLEANING VERIFICATION REPORT
      ══════════════════════════════════════════════════ */}
      <div style={{ background: "white", borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: 24, marginBottom: 24 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, color: "#004f9f", fontSize: 17, fontWeight: "bold" }}>
              Periodic Cleaning Verification Report
            </h3>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
              Life cycle verification completion log — recorded entries with dates and reviewers
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {verifData && (
              <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11,
                fontWeight: "bold", borderRadius: 10, padding: "3px 12px" }}>
                {verifData.length} {verifData.length === 1 ? "entry" : "entries"}
              </span>
            )}
            <button
              onClick={() => { setVerifData(null); loadVerifications(); }}
              disabled={verifLoading}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                background: "#f8fafc", color: "#374151", cursor: "pointer", fontSize: 12 }}>
              {verifLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* KPI summary */}
        {dashData && (() => {
          const t = dashData.totals;
          return (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <KpiCard value={t.approved_protocols}               label="Approved Protocols"  color="#7c3aed" bg="#f5f3ff" />
              <KpiCard value={t.completed_reports}                label="Reports Completed"   color="#16a34a" bg="#f0fdf4" />
              <KpiCard value={t.pending_reports}                  label="Pending Reports"     color="#ea580c" bg="#fff7ed" />
              <KpiCard value={verifData ? verifData.length : "—"} label="Verification Entries" color="#0891b2" bg="#ecfeff" />
            </div>
          );
        })()}

        {verifLoading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#004f9f" }}>
            Loading verification records…
          </div>
        )}

        {verifError && !verifLoading && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "12px 16px", color: "#b91c1c", marginBottom: 16 }}>
            {verifError}
          </div>
        )}

        {verifData && !verifLoading && (
          verifData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#94a3b8", fontSize: 13,
              background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              No verification completions have been recorded yet.
            </div>
          ) : (
            <>
              <div style={{ borderRadius: 8, border: "1px solid #bbf7d0", overflow: "hidden" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, background: "#15803d", width: 50, textAlign: "center" }}>#</th>
                      <th style={{ ...th, background: "#15803d" }}>Facility</th>
                      <th style={{ ...th, background: "#15803d" }}>Product</th>
                      <th style={{ ...th, background: "#15803d", textAlign: "center", width: 90 }}>Report ID</th>
                      <th style={{ ...th, background: "#15803d", width: 130 }}>Completion Date</th>
                      <th style={{ ...th, background: "#15803d" }}>Recorded By</th>
                      <th style={{ ...th, background: "#15803d", width: 160 }}>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifData.map((row, i) => (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? "#f0fdf4" : "white" }}>
                        <td style={{ ...td, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{row.id}</td>
                        <td style={td}>{row.facility_name}</td>
                        <td style={{ ...td, fontWeight: 600, color: "#1e293b" }}>{row.product_name}</td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 8,
                            padding: "2px 8px", fontWeight: "bold", fontSize: 11 }}>
                            #{row.report_id}
                          </span>
                        </td>
                        <td style={{ ...td, color: "#15803d", fontWeight: 600 }}>
                          {fmtDate(row.completion_date)}
                        </td>
                        <td style={{ ...td, color: "#374151" }}>{row.created_by}</td>
                        <td style={{ ...td, color: "#64748b", fontSize: 11 }}>
                          {row.created_at ? new Date(row.created_at).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", padding: "8px 12px",
                background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <strong style={{ color: "#374151" }}>Note:</strong> Each entry represents a recorded
                life cycle cleaning verification completion. Use the{" "}
                <strong>Life Cycle Management → Schedule</strong> tab to record new completions.
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
