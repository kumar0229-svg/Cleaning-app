import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

// ── Solubility / risk metadata ───────────────────────────────────────
const USP_LABELS = {
  1: "Very Soluble", 2: "Freely Soluble", 3: "Soluble",
  4: "Sparingly Soluble", 5: "Slightly Soluble",
  6: "Very Slightly Soluble", 7: "Practically Insoluble",
};

const RISK_META = {
  1: { label: "Very Low",   color: "#155724", bg: "#d4edda", border: "#b1dfbb" },
  2: { label: "Low",        color: "#155724", bg: "#d4edda", border: "#b1dfbb" },
  3: { label: "Low-Medium", color: "#533f03", bg: "#fff3cd", border: "#ffc107" },
  4: { label: "Medium",     color: "#856404", bg: "#fff3cd", border: "#ffc107" },
  5: { label: "High",       color: "#721c24", bg: "#f8d7da", border: "#f5c6cb" },
  6: { label: "Very High",  color: "#721c24", bg: "#f8d7da", border: "#f5c6cb" },
  7: { label: "Critical",   color: "white",   bg: "#721c24", border: "#491217" },
};

function RiskBadge({ usp }) {
  if (!usp) return (
    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#e9ecef",
      color: "#6c757d", fontSize: 11, fontWeight: "bold" }}>Unknown</span>
  );
  const m = RISK_META[usp] || { label: "Unknown", color: "#666", bg: "#eee", border: "#ccc" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 10, background: m.bg,
      color: m.color, fontSize: 11, fontWeight: "bold", border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

function SolubilityBar({ usp }) {
  if (!usp) return <span style={{ color: "#aaa", fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{
            width: 8, height: 12, borderRadius: 2,
            background: i <= usp
              ? (usp <= 2 ? "#28a745" : usp <= 4 ? "#ffc107" : usp <= 5 ? "#fd7e14" : "#dc3545")
              : "#e2e8f0",
          }}/>
        ))}
      </div>
      <span style={{ fontSize: 11, color: "#555" }}>{USP_LABELS[usp]}</span>
    </div>
  );
}

// ── Dashboard charts ──────────────────────────────────────────────────

function KpiCard({ value, label, color, bg, icon }) {
  return (
    <div style={{
      background: bg || "white", border: `1px solid ${color}33`,
      borderRadius: 10, padding: "16px 18px", textAlign: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)", flex: 1, minWidth: 120,
    }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 30, fontWeight: "bold", color, lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
    </div>
  );
}

function DonutChart({ completed, pending, size = 180 }) {
  const cx = size / 2, cy = size / 2;
  const r = 62;
  const C = 2 * Math.PI * r;
  const total = completed + pending;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={26} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#94a3b8">No data</text>
      </svg>
    );
  }

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
  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 200, color: "#94a3b8", fontSize: 13 }}>No facility data</div>
    );
  }

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

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* Grid lines + Y labels */}
        {yTicks.map(pct => {
          const y = iH - pct * iH;
          const val = Math.round(pct * maxVal);
          return (
            <g key={pct}>
              <line x1={0} x2={iW} y1={y} y2={y}
                stroke={pct === 0 ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={pct === 0 ? 1.5 : 1}
                strokeDasharray={pct === 0 ? "0" : "3,3"} />
              <text x={-6} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((fac, fi) => {
          const gx = fi * groupW + groupPad;
          const labelX = fi * groupW + groupW / 2;
          const name = fac.facility_name.length > 14
            ? fac.facility_name.slice(0, 13) + "…"
            : fac.facility_name;
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
                        textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">
                        {val}
                      </text>
                    )}
                    {val > 0 && bh <= 14 && (
                      <text x={bx + (barW - 1) / 2} y={by - 3}
                        textAnchor="middle" fontSize={8} fill="#475569" fontWeight="bold">
                        {val}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Facility label */}
              <text x={labelX} y={iH + 16} textAnchor="middle" fontSize={9} fill="#374151"
                fontWeight="600">
                {name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ── Progress bar row ──────────────────────────────────────────────────
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

const sectionStyle = {
  background: "#f8fafc", border: "1px solid #e2e8f0",
  borderRadius: 8, padding: "12px 14px", marginBottom: 12,
};

export default function ValidationMasterPlanPage({ goHome, currentUser }) {
  const activeTab = "dashboard"; // single-view page; dead tab blocks evaluate false

  // ── Dashboard state ──────────────────────────────────────────────
  const [dashData,    setDashData]    = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError,   setDashError]   = useState("");
  const [expandedFac, setExpandedFac] = useState(new Set());
  const [dashLastAt,  setDashLastAt]  = useState(null);
  const [dashView,    setDashView]    = useState("both"); // "chart" | "table" | "both"

  // ── Strategy tab state ───────────────────────────────────────────
  const [facilities,   setFacilities]   = useState([]);
  const [stratFacility,setStratFacility]= useState("");
  const [strategy,     setStrategy]     = useState("all");
  const [planData,     setPlanData]     = useState(null);
  const [planLoading,  setPlanLoading]  = useState(false);
  const [search,       setSearch]       = useState("");
  const printRef = useRef();

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

  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(console.log);
  }, []);

  useEffect(() => {
    if (!dashData) loadDashboard();
  }, [dashData, loadDashboard]);

  const toggleFacility = (fid) => {
    setExpandedFac(prev => {
      const next = new Set(prev);
      next.has(fid) ? next.delete(fid) : next.add(fid);
      return next;
    });
  };

  // ── Strategy plan ────────────────────────────────────────────────
  const generatePlan = async () => {
    setPlanLoading(true); setPlanData(null); setSearch("");
    try {
      const url = stratFacility
        ? `/validation/strategy-data?facility_id=${stratFacility}`
        : "/validation/strategy-data";
      const res = await api.get(url);
      setPlanData(res.data);
    } catch (e) {
      alert(e.response?.data?.detail || "Error generating plan ❌");
    } finally { setPlanLoading(false); }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Validation Master Plan — ${strategy === "all" ? "All Products" : "Worst Case"}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 20px; }
  h2 { color: #004f9f; border-bottom: 2px solid #004f9f; padding-bottom: 6px; }
  h3 { color: #004f9f; margin: 16px 0 8px; font-size: 13pt; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; }
  th { background: #004f9f; color: white; padding: 6px 8px; text-align: left; border: 1px solid #ccc; }
  td { border: 1px solid #ddd; padding: 5px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 9pt; }
  .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #888;
    display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>Validation Master Plan — ${strategy === "all" ? "All Products" : "Worst Case"}</h2>
<p style="color:#666;font-size:10pt;">Generated: ${new Date().toLocaleString("en-IN")} &nbsp;|&nbsp; By: ${currentUser}</p>
${printRef.current.innerHTML}
<div class="footer">
  <span>Confidential — Validation Master Plan</span>
  <span>Printed by: ${currentUser}</span>
</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const filteredAll = planData?.all_products?.filter(p =>
    !search || p.product_name.toLowerCase().includes(search.toLowerCase())
      || p.facility_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredWC = planData?.worst_case?.filter(e =>
    !search || e.equipment_name.toLowerCase().includes(search.toLowerCase())
      || e.category_name.toLowerCase().includes(search.toLowerCase())
      || (e.worst_case_product?.product_name || "").toLowerCase().includes(search.toLowerCase())
  ) || [];

  const riskClass = (usp) => {
    if (!usp) return "risk-unknown";
    if (usp === 7) return "risk-critical";
    if (usp >= 5) return "risk-high";
    if (usp >= 3) return "risk-medium";
    return "risk-low";
  };

  const td = { border: "1px solid #e2e8f0", padding: "8px 10px", verticalAlign: "top", fontSize: 12 };
  const th = { background: "#004f9f", color: "white", padding: "8px 10px", textAlign: "left",
    fontSize: 11, fontWeight: "bold", border: "1px solid #0044a0" };


  const fmtDate = (s) => {
    if (!s) return "—";
    try { return new Date(s).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }); }
    catch { return s; }
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #004f9f 0%, #0066cc 100%)",
        padding: "12px 16px", borderRadius: 10, marginBottom: 20, color: "white" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Dashboard</h2>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            Cleaning Validation — Site Overview
          </div>
        </div>
        <button style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "white",
          color: "#004f9f", fontWeight: "bold", cursor: "pointer", fontSize: 13 }} onClick={goHome}>
          Back to Home
        </button>
      </div>


      {/* Content */}
      <div style={{ background: "white", borderRadius: "0 0 10px 10px", padding: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>

        {/* ─────────────────────────────────────────────────────────
            DASHBOARD
            ───────────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: "#004f9f", fontSize: 18 }}>
                  Site Validation Status
                </h3>
                {dashLastAt && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                    Last refreshed: {dashLastAt.toLocaleTimeString("en-IN")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["both","chart","table"].map(v => (
                  <button key={v}
                    onClick={() => setDashView(v)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0",
                      background: dashView === v ? "#004f9f" : "white",
                      color: dashView === v ? "white" : "#555",
                      cursor: "pointer", fontSize: 12, fontWeight: dashView === v ? "bold" : "normal" }}>
                    {v === "both" ? "Both" : v === "chart" ? "Chart" : "Table"}
                  </button>
                ))}
                <button onClick={loadDashboard} disabled={dashLoading}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                    background: "#f8fafc", color: "#374151", cursor: "pointer", fontSize: 12 }}>
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
              const byFac = dashData.by_facility || [];
              const byProd = dashData.by_product || [];

              return (
                <>
                  {/* ── KPI Cards ── */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    <KpiCard value={t.facilities}         label="Facilities"          color="#004f9f" bg="#eff6ff" />
                    <KpiCard value={t.products}           label="Active Products"     color="#0891b2" bg="#ecfeff" />
                    <KpiCard value={t.approved_protocols} label="Approved Protocols"  color="#7c3aed" bg="#f5f3ff" />
                    <KpiCard value={t.completed_reports}  label="Reports Completed"   color="#16a34a" bg="#f0fdf4" />
                    <KpiCard value={t.pending_reports}    label="Pending Reports"     color="#ea580c" bg="#fff7ed" />
                  </div>

                  {/* ── Charts + Donut ── */}
                  {(dashView === "both" || dashView === "chart") && (
                    <div style={{ display: "grid",
                      gridTemplateColumns: byFac.length > 0 ? "1fr 260px" : "1fr",
                      gap: 20, marginBottom: 24, alignItems: "start" }}>

                      {/* Bar chart */}
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontWeight: "bold", fontSize: 13, color: "#1e293b" }}>
                            Validation Progress by Facility
                          </div>
                        </div>
                        <FacilityBarChart data={byFac} />
                        {/* Legend */}
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap",
                          marginTop: 8, justifyContent: "center" }}>
                          {[
                            { color: "#60a5fa", label: "Products" },
                            { color: "#818cf8", label: "Approved Protocols" },
                            { color: "#34d399", label: "Reports Done" },
                            { color: "#fb923c", label: "Pending" },
                          ].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 2,
                                background: l.color }} />
                              <span style={{ fontSize: 11, color: "#475569" }}>{l.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Donut chart */}
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#1e293b",
                          marginBottom: 12 }}>
                          Protocol Completion
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <DonutChart completed={t.completed_reports} pending={t.pending_reports} />
                        </div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column",
                          gap: 6 }}>
                          {[
                            { color: "#22c55e", label: "Reports Completed", val: t.completed_reports },
                            { color: "#f97316", label: "Pending",           val: t.pending_reports },
                          ].map(l => (
                            <div key={l.label} style={{ display: "flex", alignItems: "center",
                              gap: 8, justifyContent: "center" }}>
                              <div style={{ width: 12, height: 12, borderRadius: 2,
                                background: l.color }} />
                              <span style={{ fontSize: 11, color: "#475569" }}>{l.label}</span>
                              <span style={{ fontSize: 12, fontWeight: "bold",
                                color: "#1e293b" }}>{l.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Facility + Product Table ── */}
                  {(dashView === "both" || dashView === "table") && (
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 14, color: "#1e293b",
                        marginBottom: 10 }}>
                        Breakdown by Facility & Product
                      </div>

                      {byFac.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                          No facilities found.
                        </div>
                      ) : (
                        <div style={{ borderRadius: 10, border: "1px solid #e2e8f0",
                          overflow: "hidden" }}>
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
                                const facProds = byProd.filter(p =>
                                  p.facility_id === fac.facility_id);
                                const isExpanded = expandedFac.has(fac.facility_id);
                                const rowBg = fi % 2 === 0 ? "white" : "#f8fafc";
                                return (
                                  <React.Fragment key={fac.facility_id}>
                                    {/* Facility row */}
                                    <tr style={{ background: rowBg, cursor: "pointer" }}
                                      onClick={() => toggleFacility(fac.facility_id)}>
                                      <td style={{ ...td, textAlign: "center", color: "#004f9f",
                                        fontSize: 16, fontWeight: "bold" }}>
                                        {isExpanded ? "▾" : "▸"}
                                      </td>
                                      <td style={{ ...td, fontWeight: "bold", color: "#1e293b",
                                        fontSize: 13 }}>
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
                                        <ProgressBar
                                          value={fac.report_count}
                                          max={fac.protocol_count || 1}
                                          color="#22c55e" />
                                      </td>
                                    </tr>

                                    {/* Expanded product rows */}
                                    {isExpanded && facProds.map((prod, pi) => (
                                      <tr key={prod.product_id}
                                        style={{ background: pi % 2 === 0 ? "#fafbff" : "#f0f4ff" }}>
                                        <td style={{ ...td, borderLeft: "4px solid #818cf8" }}></td>
                                        <td style={{ ...td, paddingLeft: 28, color: "#374151",
                                          fontSize: 12 }}>
                                          <div style={{ fontWeight: 600 }}>{prod.product_name}</div>
                                          {prod.latest_protocol_at && (
                                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                                              Last protocol: {fmtDate(prod.latest_protocol_at)}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>—</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.protocol_count > 0 ? (
                                            <span style={{ background: "#ede9fe", color: "#6d28d9",
                                              borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                              fontWeight: "bold" }}>{prod.protocol_count}</span>
                                          ) : (
                                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                                          )}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.protocol_count > 0 ? (
                                            <span style={{ background: "#dcfce7", color: "#15803d",
                                              borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                              fontWeight: "bold" }}>{prod.report_count}</span>
                                          ) : (
                                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                                          )}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                          {prod.pending_count > 0 ? (
                                            <span style={{ background: "#ffedd5", color: "#c2410c",
                                              borderRadius: 10, padding: "2px 8px", fontSize: 12,
                                              fontWeight: "bold" }}>{prod.pending_count}</span>
                                          ) : prod.protocol_count > 0 ? (
                                            <span style={{ background: "#f0fdf4", color: "#16a34a",
                                              borderRadius: 10, padding: "2px 8px", fontSize: 12 }}>
                                              ✓ Done
                                            </span>
                                          ) : (
                                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                                          )}
                                        </td>
                                        <td style={td}>
                                          {prod.protocol_count > 0 ? (
                                            <ProgressBar
                                              value={prod.report_count}
                                              max={prod.protocol_count}
                                              color="#818cf8" />
                                          ) : (
                                            <span style={{ fontSize: 11, color: "#cbd5e1",
                                              fontStyle: "italic" }}>No protocol yet</span>
                                          )}
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
                            {/* Totals footer */}
                            <tfoot>
                              <tr style={{ background: "#eff6ff", fontWeight: "bold" }}>
                                <td style={td}></td>
                                <td style={{ ...td, color: "#004f9f" }}>Total</td>
                                <td style={{ ...td, textAlign: "center", color: "#1d4ed8" }}>
                                  {t.products}
                                </td>
                                <td style={{ ...td, textAlign: "center", color: "#6d28d9" }}>
                                  {t.approved_protocols}
                                </td>
                                <td style={{ ...td, textAlign: "center", color: "#15803d" }}>
                                  {t.completed_reports}
                                </td>
                                <td style={{ ...td, textAlign: "center",
                                  color: t.pending_reports > 0 ? "#c2410c" : "#94a3b8" }}>
                                  {t.pending_reports}
                                </td>
                                <td style={td}>
                                  <ProgressBar
                                    value={t.completed_reports}
                                    max={t.approved_protocols || 1}
                                    color="#004f9f" />
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Status key */}
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

        {/* ── VALIDATION STRATEGY TAB ────────────────────────────── */}
        {activeTab === "strategy" && (
          <div>
            <h3 style={{ margin: "0 0 6px", color: "#004f9f", fontSize: 18,
              borderBottom: "2px solid #e2e8f0", paddingBottom: 10 }}>
              Cleaning Validation Strategy
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#555" }}>
              Select a validation approach to generate the cleaning validation execution plan.
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
              padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
                <div>
                  <label style={S.configLabel}>Facility</label>
                  <select value={stratFacility} onChange={e => setStratFacility(e.target.value)}
                    style={S.configSelect}>
                    <option value="">All Facilities</option>
                    {facilities.map(f => (
                      <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={S.configLabel}>Validation Strategy</label>
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    {[
                      { val: "all",   label: "All Products Validation",
                        desc: "All products validated — min. 3 runs each" },
                      { val: "worst", label: "Worst Case Validation",
                        desc: "Worst-case product per equipment based on solubility risk" },
                    ].map(opt => (
                      <label key={opt.val} style={{
                        display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                        background: strategy === opt.val ? "#dbeafe" : "white",
                        border: `2px solid ${strategy === opt.val ? "#004f9f" : "#d1d5db"}`,
                        borderRadius: 8, padding: "10px 14px", minWidth: 210, transition: "all 0.15s",
                      }}>
                        <input type="radio" value={opt.val} checked={strategy === opt.val}
                          onChange={() => setStrategy(opt.val)}
                          style={{ marginTop: 2, accentColor: "#004f9f" }} />
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: 13,
                            color: strategy === opt.val ? "#004f9f" : "#333" }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={generatePlan} disabled={planLoading}
                  style={{ padding: "10px 22px", background: planLoading ? "#aaa" : "#004f9f",
                    color: "white", border: "none", borderRadius: 7,
                    cursor: planLoading ? "not-allowed" : "pointer",
                    fontWeight: "bold", fontSize: 13, alignSelf: "flex-end", height: 40 }}>
                  {planLoading ? "Generating…" : "Generate Plan"}
                </button>
              </div>

              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 7, fontSize: 12,
                background: strategy === "all" ? "#eff6ff" : "#fff7ed",
                border: `1px solid ${strategy === "all" ? "#bfdbfe" : "#fed7aa"}`,
                color: strategy === "all" ? "#1e40af" : "#92400e" }}>
                {strategy === "all" ? (
                  <>
                    <strong>All Products Validation:</strong> Each product is individually validated
                    on all equipment it uses. A minimum of <strong>3 consecutive successful cleaning
                    runs</strong> per product are required.
                  </>
                ) : (
                  <>
                    <strong>Worst Case Validation:</strong> For each piece of equipment, the product
                    with the <strong>lowest solubility (highest cleaning challenge)</strong> is
                    selected as the worst case. USP rating 7 (Practically Insoluble) = highest risk.
                  </>
                )}
              </div>
            </div>

            {planLoading && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#004f9f" }}>
                Generating validation plan…
              </div>
            )}

            {planData && !planLoading && (
              <div>
                <div style={{ display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))",
                  gap: 12, marginBottom: 18 }}>
                  {strategy === "all" ? [
                    { val: planData.summary.total_products, lbl: "Products", color: "#004f9f" },
                    { val: planData.summary.total_runs_all, lbl: "Total Runs Required", color: "#065f46" },
                    { val: planData.summary.products_missing_solubility,
                      lbl: "Missing Solubility Data",
                      color: planData.summary.products_missing_solubility > 0 ? "#856404" : "#6b7280" },
                  ] : [
                    { val: planData.summary.total_equipment, lbl: "Equipment Items", color: "#004f9f" },
                    { val: planData.summary.unique_worst_case_products,
                      lbl: "Unique Worst-Case Products", color: "#065f46" },
                    { val: planData.summary.total_runs_worst, lbl: "Min. Runs Required", color: "#7c3aed" },
                    { val: planData.summary.equipment_no_products,
                      lbl: "Equipment — No Products",
                      color: planData.summary.equipment_no_products > 0 ? "#856404" : "#6b7280" },
                  ].map(c => (
                    <div key={c.lbl} style={{ background: "white", border: "1px solid #e2e8f0",
                      borderRadius: 8, padding: "12px 14px", textAlign: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontSize: 26, fontWeight: "bold", color: c.color }}>{c.val}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.lbl}</div>
                    </div>
                  ))}
                </div>

                {planData.summary.products_missing_solubility > 0 && (
                  <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 7,
                    padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#856404" }}>
                    <strong>⚠ {planData.summary.products_missing_solubility} product(s)</strong> have
                    no solubility data entered. Update solubility in Product Master to improve accuracy.
                  </div>
                )}
                {strategy === "worst" && planData.summary.equipment_no_products > 0 && (
                  <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 7,
                    padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#856404" }}>
                    <strong>⚠ {planData.summary.equipment_no_products} equipment item(s)</strong> have
                    no products assigned.
                  </div>
                )}

                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between",
                  alignItems: "center" }}>
                  <input
                    placeholder={strategy === "all"
                      ? "Search product / facility…"
                      : "Search equipment / category / product…"}
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6,
                      fontSize: 13, minWidth: 280 }} />
                  <button onClick={handlePrint}
                    style={{ padding: "8px 16px", background: "#28a745", color: "white",
                      border: "none", borderRadius: 6, cursor: "pointer",
                      fontWeight: "bold", fontSize: 13 }}>
                    Print / Export PDF
                  </button>
                </div>

                {/* All products table */}
                {strategy === "all" && (
                  <div ref={printRef}>
                    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["#","Product Name","Facility","Solubility","Soluble Solvent",
                              "Risk Level","Min. Runs"].map(h => (
                              <th key={h} style={{ ...th, textAlign: h === "Min. Runs" ? "center" : "left" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAll.length === 0 ? (
                            <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#888",
                              padding: "32px" }}>No products found.</td></tr>
                          ) : filteredAll.map((p, i) => (
                            <tr key={p.product_id} style={{
                              background: i % 2 === 0 ? "white" : "#f8fafc",
                              borderLeft: p.solubility_usp >= 5
                                ? `4px solid ${RISK_META[p.solubility_usp]?.bg || "#eee"}`
                                : "4px solid transparent",
                            }}>
                              <td style={{ ...td, color: "#888", width: 40 }}>{i + 1}</td>
                              <td style={{ ...td, fontWeight: 600 }}>{p.product_name}</td>
                              <td style={td}>{p.facility_name}</td>
                              <td style={td}><SolubilityBar usp={p.solubility_usp} /></td>
                              <td style={td}>{p.soluble_solvent}</td>
                              <td style={td}>
                                <RiskBadge usp={p.solubility_usp} />
                                {!p.solubility_usp && (
                                  <span style={{ fontSize: 10, color: "#856404", marginLeft: 6 }}>
                                    ⚠ update product
                                  </span>
                                )}
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <span style={{ background: "#dbeafe", color: "#004f9f",
                                  fontWeight: "bold", fontSize: 12, padding: "3px 12px",
                                  borderRadius: 10 }}>3</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#f0f4ff" }}>
                            <td colSpan={6} style={{ ...td, fontWeight: "bold", color: "#004f9f" }}>
                              Total minimum runs required
                            </td>
                            <td style={{ ...td, textAlign: "center", fontWeight: "bold",
                              color: "#004f9f", fontSize: 14 }}>
                              {filteredAll.length * 3}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p style={{ fontSize: 11, color: "#888", marginTop: 8, fontStyle: "italic" }}>
                      Per ICH Q7 and FDA guidance, a minimum of 3 consecutive successful cleaning
                      runs are required for each product.
                    </p>
                  </div>
                )}

                {/* Worst case table */}
                {strategy === "worst" && (
                  <div ref={printRef}>
                    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["Risk Rank","Equipment","Category","Facility","Worst Case Product",
                              "Solubility","Risk Level","Other Products on Equipment","Min. Runs"]
                              .map(h => <th key={h} style={th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredWC.length === 0 ? (
                            <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#888",
                              padding: "32px" }}>No equipment found.</td></tr>
                          ) : filteredWC.map((eq, i) => {
                            const wc = eq.worst_case_product;
                            const others = eq.products.filter(p => !p.is_worst_case);
                            return (
                              <tr key={eq.equipment_id} style={{
                                background: i % 2 === 0 ? "white" : "#f8fafc",
                                borderLeft: `4px solid ${wc ? (RISK_META[wc.solubility_usp]?.bg || "#e2e8f0") : "#e2e8f0"}`,
                              }}>
                                <td style={{ ...td, textAlign: "center", fontWeight: "bold",
                                  color: "#004f9f", fontSize: 13 }}>{i + 1}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{eq.equipment_name}</td>
                                <td style={td}>
                                  <span style={{ background: "#dbeafe", color: "#004f9f",
                                    fontSize: 11, padding: "2px 7px", borderRadius: 8,
                                    fontWeight: "bold" }}>{eq.category_name}</span>
                                </td>
                                <td style={td}>{eq.facility_name}</td>
                                <td style={td}>
                                  {wc ? (
                                    <div>
                                      <div style={{ fontWeight: "bold" }}>{wc.product_name}</div>
                                      {wc.soluble_solvent && wc.soluble_solvent !== "—" && (
                                        <div style={{ fontSize: 10, color: "#6b7280" }}>
                                          Solvent: {wc.soluble_solvent}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: "#aaa", fontStyle: "italic" }}>
                                      No products assigned
                                    </span>
                                  )}
                                </td>
                                <td style={td}>
                                  {wc ? <SolubilityBar usp={wc.solubility_usp} /> : "—"}
                                </td>
                                <td style={td}>
                                  {wc ? <RiskBadge usp={wc.solubility_usp} /> :
                                    <span style={{ color: "#aaa", fontSize: 11 }}>—</span>}
                                  {wc && !wc.solubility_usp && (
                                    <span style={{ fontSize: 10, color: "#856404", marginLeft: 6 }}>
                                      ⚠ update product
                                    </span>
                                  )}
                                </td>
                                <td style={td}>
                                  {others.length === 0 ? (
                                    <span style={{ color: "#aaa", fontSize: 11 }}>—</span>
                                  ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {others.map(p => (
                                        <span key={p.product_id} style={{
                                          fontSize: 11, background: "#f1f5f9",
                                          border: "1px solid #e2e8f0", borderRadius: 4,
                                          padding: "1px 6px", color: "#444",
                                        }}>
                                          {p.product_name}
                                          {p.solubility_usp && (
                                            <span style={{ marginLeft: 3, color: "#6b7280" }}>
                                              (USP {p.solubility_usp})
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td style={{ ...td, textAlign: "center" }}>
                                  {wc ? (
                                    <span style={{ background: "#dbeafe", color: "#004f9f",
                                      fontWeight: "bold", fontSize: 12, padding: "3px 12px",
                                      borderRadius: 10 }}>3</span>
                                  ) : (
                                    <span style={{ color: "#dc3545", fontSize: 11 }}>N/A</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#f0f4ff" }}>
                            <td colSpan={8} style={{ ...td, fontWeight: "bold", color: "#004f9f" }}>
                              Total minimum runs (equipment with assigned products only)
                            </td>
                            <td style={{ ...td, textAlign: "center", fontWeight: "bold",
                              color: "#004f9f", fontSize: 14 }}>
                              {filteredWC.filter(e => e.worst_case_product).length * 3}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p style={{ fontSize: 11, color: "#888", marginTop: 8, fontStyle: "italic" }}>
                      The product with the highest USP solubility rating (lowest solubility / hardest
                      to clean) is selected as the worst case per equipment.
                    </p>
                    <div style={{ marginTop: 12, padding: "12px 14px", background: "#f8fafc",
                      border: "1px solid #e2e8f0", borderRadius: 8 }}>
                      <div style={{ fontWeight: "bold", fontSize: 11, color: "#555",
                        textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>
                        Solubility Risk Scale
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[1,2,3,4,5,6,7].map(usp => (
                          <div key={usp} style={{ display: "flex", alignItems: "center", gap: 5,
                            fontSize: 11, padding: "4px 10px",
                            background: RISK_META[usp].bg, color: RISK_META[usp].color,
                            border: `1px solid ${RISK_META[usp].border}`, borderRadius: 6 }}>
                            <strong>USP {usp}:</strong> {USP_LABELS[usp]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: "#004f9f",
              borderBottom: "2px solid #e2e8f0", paddingBottom: 10, fontSize: 18 }}>Overview</h3>
            <div style={sectionStyle}>
              <p><strong>Document Number:</strong> VMP-2024-001 [Placeholder]</p>
              <p><strong>Version:</strong> 1.0 [Placeholder]</p>
              <p><strong>Created:</strong> {new Date().toLocaleDateString()} [Placeholder]</p>
              <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()} [Placeholder]</p>
            </div>
            <p>The Validation Master Plan (VMP) outlines the strategy and approach for equipment and
              process validation in the pharmaceutical manufacturing facility.</p>
            <div style={sectionStyle}>
              <p style={{ fontStyle: "italic", color: "#666" }}>[Placeholder: Add overview content here]</p>
            </div>
          </div>
        )}

        {/* ── REQUIREMENTS TAB ─────────────────────────────────────── */}
        {activeTab === "requirements" && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: "#004f9f",
              borderBottom: "2px solid #e2e8f0", paddingBottom: 10, fontSize: 18 }}>
              Regulatory Requirements
            </h3>
            <ul>
              <li>FDA CFR Title 21, Part 211 — cGMP for Finished Pharmaceuticals</li>
              <li>ICH Q7 — Good Manufacturing Practice for Active Pharmaceutical Ingredients</li>
              <li>ICH Q10 — Pharmaceutical Quality System</li>
              <li>EMA Guideline on cleaning validation (EMA/CHMP/CVMP/SWP/169430/2012)</li>
              <li>ISPE Baseline Guide Vol. 7 — Risk-Based Manufacture of Pharmaceutical Products</li>
            </ul>
            <div style={sectionStyle}>
              <p style={{ fontStyle: "italic", color: "#666" }}>
                [Placeholder: Add additional regulatory requirements]
              </p>
            </div>
          </div>
        )}

        {/* ── SCOPE TAB ────────────────────────────────────────────── */}
        {activeTab === "scope" && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: "#004f9f",
              borderBottom: "2px solid #e2e8f0", paddingBottom: 10, fontSize: 18 }}>
              Scope & Objectives
            </h3>
            <h4 style={{ margin: "16px 0 8px", color: "#333", fontSize: 15 }}>Scope</h4>
            <ul>
              <li>Equipment cleaning validation at [Facility Name — Placeholder]</li>
              <li>Cleaning validation for shared manufacturing equipment</li>
              <li>MACO limit calculations for all product pairs sharing equipment</li>
              <li>Documentation and record keeping procedures</li>
            </ul>
            <h4 style={{ margin: "16px 0 8px", color: "#333", fontSize: 15 }}>Objectives</h4>
            <ul>
              <li>Ensure regulatory compliance with FDA, EMA, and ICH guidelines</li>
              <li>Establish validated cleaning procedures for all shared manufacturing equipment</li>
              <li>Define and document MACO limits for all source–target product pairs</li>
              <li>Maintain a complete audit trail for all validation activities</li>
            </ul>
            <div style={sectionStyle}>
              <p style={{ fontStyle: "italic", color: "#666" }}>
                [Placeholder: Add detailed scope and objectives]
              </p>
            </div>
          </div>
        )}


        {/* ── RESOURCES TAB ────────────────────────────────────────── */}
        {activeTab === "resources" && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: "#004f9f",
              borderBottom: "2px solid #e2e8f0", paddingBottom: 10, fontSize: 18 }}>
              Resources & Personnel
            </h3>
            <h4 style={{ margin: "16px 0 8px", color: "#333", fontSize: 15 }}>Personnel</h4>
            <ul>
              <li><strong>Validation Manager:</strong> [Placeholder]</li>
              <li><strong>QA Lead:</strong> [Placeholder]</li>
              <li><strong>Equipment Specialists:</strong> [Placeholder]</li>
              <li><strong>Operations Team:</strong> [Placeholder]</li>
            </ul>
            <h4 style={{ margin: "16px 0 8px", color: "#333", fontSize: 15 }}>Equipment & Tools</h4>
            <ul>
              <li>Testing instruments and calibration equipment</li>
              <li>Documentation management system</li>
              <li>Cleaning Limit Software (MACO calculation)</li>
              <li>Validation protocol templates</li>
            </ul>
            <div style={sectionStyle}>
              <p style={{ fontStyle: "italic", color: "#666" }}>
                [Placeholder: Add resource allocation details]
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  configLabel: {
    display: "block", fontSize: 11, fontWeight: 600, color: "#555",
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4,
  },
  configSelect: {
    padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db",
    fontSize: 13, minWidth: 180, cursor: "pointer",
  },
};
