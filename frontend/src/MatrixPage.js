import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/cipla-logo.png";
import { exportCsv } from "./exportCsv";

function MatrixPage({ goHome, currentUser, role }) {
  const [products, setProducts] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runHistory, setRunHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ✅ Summary state
  const [activeTab, setActiveTab] = useState("detailed"); // "detailed" or "summary"
  const [selectedFacility, setSelectedFacility] = useState("");
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const printRef = useRef();
  const summaryPrintRef = useRef();

  useEffect(() => {
    fetchProducts();
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const res = await api.get("/facility/all");
      setFacilities(res.data);
    } catch (err) { console.log(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/product/all");
      setProducts(res.data);
    } catch (err) { console.log(err); }
  };

  const runMatrix = async () => {
    if (!selectedProduct) { alert("Select a product ❌"); return; }
    setLoading(true);
    setResult(null);
    setShowHistory(false);
    try {
      const res = await api.post(
        "/maco/matrix",
        { source_product_id: parseInt(selectedProduct) }
      );
      setResult(res.data);
      // Refresh run history after a new run
      const histRes = await api.get(`/maco/runs/${selectedProduct}`);
      setRunHistory(histRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Error running matrix ❌");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (productId) => {
    if (!productId) return;
    try {
      const res = await api.get(`/maco/runs/${productId}`);
      setRunHistory(res.data);
    } catch (err) { console.log(err); }
  };

  // ✅ Run summary for all products in facility
  const runSummary = async () => {
    if (!selectedFacility) { alert("Select a facility ❌"); return; }
    setSummaryLoading(true);
    setSummaryData([]);

    try {
      const facilityProducts = products.filter(
        p => String(p.facility_id) === String(selectedFacility)
      );

      if (facilityProducts.length === 0) {
        alert("No products found in this facility ❌");
        setSummaryLoading(false);
        return;
      }

      const summaryRows = [];

      for (const p of facilityProducts) {
        try {
          const res = await api.post(
            "/maco/matrix",
            { source_product_id: p.product_id }
          );

          const data = res.data;

          if (!data.data || data.data.length === 0) {
            summaryRows.push({
              source: p.product_name,
              limiting_target: "—",
              governing_maco: "—",
              governing_method: "—",
              rinse_pde: "—", rinse_dose: "—", rinse_10ppm: "—", rinse_final: "—",
              swab_pde: "—", swab_dose: "—", swab_10ppm: "—", swab_final: "—",
              rinse_status_pde: "—", rinse_status_dose: "—", rinse_status_10ppm: "—", rinse_status_final: "—",
              swab_status_pde: "—", swab_status_dose: "—", swab_status_10ppm: "—", swab_status_final: "—",
              loq: data.loq_ppm || 0,
            });
            continue;
          }

          const scenario = data.scenario || "maco_3method";

          if (scenario === "fixed_10ppm") {
            const firstRow = data.data[0];
            summaryRows.push({
              source: p.product_name,
              scenario: "fixed_10ppm",
              limiting_target: "All targets (Fixed 10 ppm)",
              governing_maco: "N/A",
              governing_method: "Fixed 10 ppm",
              rinse_pde: "—", rinse_dose: "—", rinse_10ppm: "—",
              rinse_final: firstRow?.rinse_limit_final ?? 10,
              swab_pde: "—", swab_dose: "—", swab_10ppm: "—",
              swab_final: firstRow?.swab_limit_final ?? 10,
              rinse_status_pde: "—", rinse_status_dose: "—", rinse_status_10ppm: "—",
              rinse_status_final: firstRow?.rinse_status_final || "—",
              swab_status_pde: "—", swab_status_dose: "—", swab_status_10ppm: "—",
              swab_status_final: firstRow?.swab_status_final || "—",
              loq: data.loq_ppm || 0,
            });
          } else {
            // ✅ Find the row with the lowest governing MACO
            const governingRow = data.data.reduce((min, row) => {
              if (!row.governing_maco_pair) return min;
              if (!min.governing_maco_pair) return row;
              return row.governing_maco_pair < min.governing_maco_pair ? row : min;
            }, data.data[0]);

            // ✅ Determine which method gave governing MACO
            let governingMethod = "—";
            if (governingRow.governing_maco_pair) {
              const vals = [
                { method: "PDE", val: governingRow.maco_pde },
                { method: "Dose", val: governingRow.maco_dose },
                { method: "10ppm", val: governingRow.maco_10ppm }
              ].filter(v => v.val !== null && v.val !== undefined);

              const minVal = Math.min(...vals.map(v => v.val));
              const match = vals.find(v => Math.abs(v.val - minVal) < 0.0001);
              if (match) governingMethod = match.method;
            }

            summaryRows.push({
              source: p.product_name,
              scenario: "maco_3method",
              limiting_target: governingRow.target_product || "—",
              governing_maco: data.governing_maco ?? "—",
              governing_method: governingMethod,
              rinse_pde: governingRow.rinse_limit_pde ?? "—",
              rinse_pde_raw: governingRow.rinse_limit_pde_raw ?? null,
              rinse_dose: governingRow.rinse_limit_dose ?? "—",
              rinse_dose_raw: governingRow.rinse_limit_dose_raw ?? null,
              rinse_10ppm: governingRow.rinse_limit_10ppm ?? "—",
              rinse_10ppm_raw: governingRow.rinse_limit_10ppm_raw ?? null,
              rinse_final: governingRow.rinse_limit_final ?? "—",
              swab_pde: governingRow.swab_limit_pde ?? "—",
              swab_pde_raw: governingRow.swab_limit_pde_raw ?? null,
              swab_dose: governingRow.swab_limit_dose ?? "—",
              swab_dose_raw: governingRow.swab_limit_dose_raw ?? null,
              swab_10ppm: governingRow.swab_limit_10ppm ?? "—",
              swab_10ppm_raw: governingRow.swab_limit_10ppm_raw ?? null,
              swab_final: governingRow.swab_limit_final ?? "—",
              rinse_status_pde: governingRow.rinse_status_pde || "—",
              rinse_status_dose: governingRow.rinse_status_dose || "—",
              rinse_status_10ppm: governingRow.rinse_status_10ppm || "—",
              rinse_status_final: governingRow.rinse_status_final || "—",
              swab_status_pde: governingRow.swab_status_pde || "—",
              swab_status_dose: governingRow.swab_status_dose || "—",
              swab_status_10ppm: governingRow.swab_status_10ppm || "—",
              swab_status_final: governingRow.swab_status_final || "—",
              loq: data.loq_ppm || 0,
            });
          }

        } catch (err) {
          const reason = err?.response?.data?.detail || err?.message || "Calculation failed";
          summaryRows.push({
            source: p.product_name,
            limiting_target: "Error",
            error_reason: reason,
            governing_maco: "—",
            governing_method: "—",
            rinse_pde: "—", rinse_dose: "—", rinse_10ppm: "—", rinse_final: "—",
            swab_pde: "—", swab_dose: "—", swab_10ppm: "—", swab_final: "—",
            rinse_status_pde: "—", rinse_status_dose: "—", rinse_status_10ppm: "—", rinse_status_final: "—",
            swab_status_pde: "—", swab_status_dose: "—", swab_status_10ppm: "—", swab_status_final: "—",
            loq: 0,
          });
        }
      }

      setSummaryData(summaryRows);

    } catch (err) {
      console.log(err);
      alert("Error running summary ❌");
    } finally {
      setSummaryLoading(false);
    }
  };

  const exportDetailedCsv = () => {
    if (!result || result.data.length === 0) { alert("Run matrix first ❌"); return; }
    const cols = [
      "Target Product","Shared Equipment","MACO PDE (mg)","MACO Dose (mg)","MACO 10ppm (mg)","Governing MACO (mg)",
      "Rinse Vol (L)","Chain Area (in²)","Swab Area (in²)",
      "Rinse PDE (ppm)","Rinse Dose (ppm)","Rinse 10ppm (ppm)","Final Rinse Limit (ppm)",
      "Swab PDE (ppm)","Swab Dose (ppm)","Swab 10ppm (ppm)","Final Swab Limit (ppm)",
      "LOQ (ppm)",
      "Rinse Status PDE","Rinse Status Dose","Rinse Status 10ppm","Final Rinse Status",
      "Swab Status PDE","Swab Status Dose","Swab Status 10ppm","Final Swab Status"
    ];
    const rows = [];
    result.data.forEach(r => {
      rows.push([
        r.target_product, r.shared_equipment.map(e => e.name).join("; "),
        r.maco_pde ?? "", r.maco_dose ?? "", r.maco_10ppm, r.governing_maco_pair ?? "",
        r.total_rinse_vol_L, r.total_area_in2, r.swab_area_sqin ?? "",
        r.rinse_limit_pde ?? "", r.rinse_limit_dose ?? "", r.rinse_limit_10ppm ?? "", r.rinse_limit_final ?? "",
        r.swab_limit_pde ?? "", r.swab_limit_dose ?? "", r.swab_limit_10ppm ?? "", r.swab_limit_final ?? "",
        r.loq_ppm,
        r.rinse_status_pde ?? "", r.rinse_status_dose ?? "", r.rinse_status_10ppm ?? "", r.rinse_status_final ?? "",
        r.swab_status_pde ?? "", r.swab_status_dose ?? "", r.swab_status_10ppm ?? "", r.swab_status_final ?? ""
      ]);
      (r.step_matrix_rows || []).forEach(smr => {
        const isMaco = smr.scenario === "maco";
        const srcLabel = smr.source_step === 0
          ? "Final Step"
          : `Step ${smr.source_step}${smr.source_step_compound ? ` (${smr.source_step_compound})` : ""}`;
        const tgtLabel = smr.target_step === 0
          ? "Final Step"
          : `Step ${smr.target_step}${smr.target_step_compound ? ` (${smr.target_step_compound})` : ""}`;
        rows.push([
          `${r.target_product} [${srcLabel} → ${tgtLabel}] [${isMaco ? "MACO" : "10 ppm"}]`,
          (smr.shared_equipment || []).map(e => e.name).join("; "),
          isMaco ? (smr.maco_pde ?? "") : "",
          isMaco ? (smr.maco_dose ?? "") : "",
          isMaco ? (smr.maco_10ppm ?? "") : "",
          "", smr.total_rinse_vol_L ?? "", smr.total_area_in2 ?? "", "",
          "", "", "", smr.rinse_limit_final ?? "",
          "", "", "", smr.swab_limit_final ?? "",
          smr.loq_ppm,
          "", "", "", smr.rinse_status_final ?? "",
          "", "", "", smr.swab_status_final ?? ""
        ]);
      });
    });
    exportCsv(`MACO_${result.source}_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" })}.csv`, cols, rows);
  };

  const exportSummaryCsv = () => {
    if (summaryData.length === 0) { alert("Run summary first ❌"); return; }
    const cols = [
      "Source Product","Limiting Target","Governing MACO (mg)","Governing Method",
      "Rinse PDE (ppm)","Rinse Dose (ppm)","Rinse 10ppm (ppm)","Final Rinse Limit (ppm)",
      "Swab PDE (ppm)","Swab Dose (ppm)","Swab 10ppm (ppm)","Final Swab Limit (ppm)",
      "LOQ (ppm)",
      "Rinse Status PDE","Rinse Status Dose","Rinse Status 10ppm","Final Rinse Status",
      "Swab Status PDE","Swab Status Dose","Swab Status 10ppm","Final Swab Status"
    ];
    const rows = summaryData.map(r => [
      r.source, r.limiting_target, r.governing_maco, r.governing_method,
      r.rinse_pde, r.rinse_dose, r.rinse_10ppm, r.rinse_final,
      r.swab_pde, r.swab_dose, r.swab_10ppm, r.swab_final,
      r.loq,
      r.rinse_status_pde, r.rinse_status_dose, r.rinse_status_10ppm, r.rinse_status_final,
      r.swab_status_pde, r.swab_status_dose, r.swab_status_10ppm, r.swab_status_final
    ]);
    exportCsv(`MACO_Summary_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" })}.csv`, cols, rows);
  };

  const handlePrintDetailed = () => {
    if (!result || result.data.length === 0) { alert("Run matrix first ❌"); return; }
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>MACO Matrix Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
        .header { display: flex; align-items: center; border-bottom: 2px solid #004f9f; padding-bottom: 10px; margin-bottom: 20px; }
        .header img { width: 80px; margin-right: 20px; }
        .header-text h2 { margin: 0; color: #004f9f; font-size: 18px; }
        .header-text p { margin: 4px 0 0 0; color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #004f9f; color: white; padding: 6px; text-align: center; font-size: 10px; }
        td { border: 1px solid #ddd; padding: 5px; text-align: center; font-size: 10px; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logo}" alt="Cipla" />
          <div class="header-text">
            <h2>Cleaning Limit Software</h2>
            <p>MACO Cleaning Limit Matrix Report</p>
            <p>Source Product: <strong>${result.source}</strong></p>
            <p>Analytical Method: ${result.analytical_method || "—"} | LOD: ${result.lod_ppm} ppm | LOQ: ${result.loq_ppm} ppm</p>
            <p>Governing MACO: <strong>${result.governing_maco} mg</strong></p>
            <p>Calculation Policy: <strong>${result.policy_label || result.policy || "—"}</strong></p>
            <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
        ${printContent}
        <div class="footer">
          <span>Falcon — Confidential</span>
          <span>Printed by: ${currentUser || "Unknown"}</span>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handlePrintSummary = () => {
    if (summaryData.length === 0) { alert("Run summary first ❌"); return; }
    const facilityName = facilities.find(f => String(f.facility_id) === String(selectedFacility))?.facility_name || "Unknown";
    const printContent = summaryPrintRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Cleaning Limit Summary Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
        .header { display: flex; align-items: center; border-bottom: 2px solid #004f9f; padding-bottom: 10px; margin-bottom: 20px; }
        .header img { width: 80px; margin-right: 20px; }
        .header-text h2 { margin: 0; color: #004f9f; font-size: 18px; }
        .header-text p { margin: 4px 0 0 0; color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #004f9f; color: white; padding: 6px; text-align: center; font-size: 10px; }
        td { border: 1px solid #ddd; padding: 5px; text-align: center; font-size: 10px; }
        tr:nth-child(even) { background: #f8fafc; }
        .pass { color: #155724; font-weight: bold; }
        .fail { color: #721c24; font-weight: bold; }
        .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logo}" alt="Cipla" />
          <div class="header-text">
            <h2>Cleaning Limit Software</h2>
            <p>Cleaning Limit Summary Report</p>
            <p>Facility: <strong>${facilityName}</strong></p>
            <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
        ${printContent}
        <div class="footer">
          <span>Falcon — Confidential</span>
          <span>Total Products: ${summaryData.length}</span>
          <span>Printed by: ${currentUser || "Unknown"}</span>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const fmtLimit = (capped, raw) => {
    if (capped == null) return "—";
    if (raw != null && raw > 10) return `10 (${raw})`;
    return String(capped);
  };

  const statusBadge = (status) => {
    if (status === "PASS") return (
      <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "12px",
        fontWeight: "bold", background: "#d4edda", color: "#155724" }}>PASS</span>
    );
    if (status === "FAIL") return (
      <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "12px",
        fontWeight: "bold", background: "#f8d7da", color: "#721c24" }}>FAIL</span>
    );
    return <span>—</span>;
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>📊 MACO Cleaning Limit Matrix</h2>
        <button onClick={goHome} style={styles.backBtn}>⬅ Back to Home</button>
      </div>

      {/* ✅ Tab Buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("detailed")}
          style={{
            padding: "10px 20px",
            background: activeTab === "detailed" ? "#004f9f" : "#e2e8f0",
            color: activeTab === "detailed" ? "white" : "#333",
            border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
          }}
        >
          🔍 Detailed Matrix
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          style={{
            padding: "10px 20px",
            background: activeTab === "summary" ? "#004f9f" : "#e2e8f0",
            color: activeTab === "summary" ? "white" : "#333",
            border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
          }}
        >
          📋 Facility Summary
        </button>
      </div>

      {/* ===== DETAILED MATRIX TAB ===== */}
      {activeTab === "detailed" && (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                const p = products.find(p => p.product_id === parseInt(e.target.value));
                setSelectedProductName(p ? p.product_name : "");
              }}
              style={styles.select}>
              <option value="">Select Source Product</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
              ))}
            </select>
            {role === "VIEWER" ? (
              <span style={styles.viewerNote}>View-only — QA/ADMIN role required to run calculations</span>
            ) : (
              <button onClick={runMatrix} style={styles.runBtn} disabled={loading}>
                {loading ? "Calculating..." : "Run Matrix"}
              </button>
            )}
            <button onClick={handlePrintDetailed} style={styles.printBtn}>Print PDF</button>
            <button onClick={exportDetailedCsv} style={styles.csvBtn}>Export CSV</button>
          </div>

          {/* Run History toggle — shown when a product is selected */}
          {selectedProduct && (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => { setShowHistory(h => !h); if (!showHistory) loadHistory(selectedProduct); }}
                style={styles.historyBtn}
              >
                {showHistory ? "Hide Run History" : "Show Run History"}
              </button>
              {showHistory && (
                <div style={{ marginTop: "10px", overflowX: "auto" }}>
                  {runHistory.length === 0 ? (
                    <p style={{ color: "#888", fontSize: "13px" }}>No previous runs for this product.</p>
                  ) : (
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#6c757d", color: "white" }}>
                          <th style={cell}>Run #</th>
                          <th style={cell}>Run At</th>
                          <th style={cell}>Run By</th>
                          <th style={cell}>PDE at run time (mg/day)</th>
                          <th style={cell}>Min Dose at run time (mg)</th>
                          <th style={cell}>LOQ at run time (ppm)</th>
                          <th style={cell}>Governing MACO (mg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runHistory.map((r, i) => (
                          <tr key={r.run_id} style={{ background: i % 2 === 0 ? "#f8f9fa" : "white" }}>
                            <td style={cell}>{r.run_id}</td>
                            <td style={cell}>{new Date(r.run_at).toLocaleString("en-IN")}</td>
                            <td style={cell}>{r.run_by}</td>
                            <td style={cell}>{r.source_pde}</td>
                            <td style={cell}>{r.source_min_dose}</td>
                            <td style={cell}>{r.source_loq}</td>
                            <td style={{ ...cell, fontWeight: "bold", color: "#004f9f" }}>{r.governing_maco ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          <hr />

          {result && (
            <div>
              <div style={styles.summaryBox}>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Source Product</span>
                  <span style={styles.summaryValue}>{result.source}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Analytical Method</span>
                  <span style={styles.summaryValue}>{result.analytical_method || "—"}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>LOD</span>
                  <span style={styles.summaryValue}>{result.lod_ppm} ppm</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>LOQ</span>
                  <span style={styles.summaryValue}>{result.loq_ppm} ppm</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Governing MACO</span>
                  <span style={{ ...styles.summaryValue, color: "#004f9f", fontWeight: "bold" }}>
                    {result.governing_maco != null ? `${result.governing_maco} mg` : "N/A"}
                  </span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Calculation Scenario</span>
                  <span style={{ ...styles.summaryValue, fontSize: "12px" }}>
                    {result.scenario === "fixed_10ppm" ? (
                      <span style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffc107", borderRadius: "4px", padding: "2px 10px", fontWeight: "bold" }}>
                        Fixed 10 ppm — {result.source_category} Source
                      </span>
                    ) : (
                      <span style={{ background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: "4px", padding: "2px 10px", fontWeight: "bold" }}>
                        MACO 3-Method Calculation — API Source
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ ...styles.summaryItem, gridColumn: "1 / -1" }}>
                  <span style={styles.summaryLabel}>Calculation Policy</span>
                  <span style={{ ...styles.summaryValue, fontSize: "11px" }}>
                    <span style={{ background: "#eef4ff", color: "#004f9f", border: "1px solid #c7d9f7", borderRadius: "4px", padding: "2px 8px", fontWeight: "bold" }}>
                      {result.policy_label || result.policy || "—"}
                    </span>
                  </span>
                </div>
              </div>

              {result.scenario === "fixed_10ppm" && (
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", padding: "12px 16px", marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>⚠️</span>
                  <div>
                    <strong style={{ color: "#856404" }}>Fixed 10 ppm Criterion Applied</strong>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#856404" }}>
                      Source product is categorized as <strong>{result.source_category}</strong>. Per cleaning policy, Intermediate/KSM sources use a fixed limit of <strong>10 ppm</strong> for both rinse and swab — MACO calculation is not applicable.
                    </p>
                  </div>
                </div>
              )}

              {result.data.length === 0 ? (
                <p>No target products found in the same facility.</p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: "16px" }}>
                  <div ref={printRef}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#004f9f", color: "white" }}>
                          <th style={cell}>Target Product</th>
                          <th style={cell}>Shared Equipment</th>
                          <th style={cell}>MACO PDE (mg)</th>
                          <th style={cell}>MACO Dose (mg)</th>
                          <th style={cell}>MACO 10ppm (mg)</th>
                          <th style={cell}>Governing MACO (mg)</th>
                          <th style={cell}>Rinse Vol (L)</th>
                          <th style={cell}>Chain Area (in²)</th>
                          <th style={cell}>Swab Area (in²)</th>
                          <th style={cell}>Rinse PDE (ppm)</th>
                          <th style={cell}>Rinse Dose (ppm)</th>
                          <th style={cell}>Rinse 10ppm (ppm)</th>
                          <th style={{ ...cell, background: "#003080" }}>Final Rinse Limit (ppm)</th>
                          <th style={cell}>Swab PDE (ppm)</th>
                          <th style={cell}>Swab Dose (ppm)</th>
                          <th style={cell}>Swab 10ppm (ppm)</th>
                          <th style={{ ...cell, background: "#003080" }}>Final Swab Limit (ppm)</th>
                          <th style={cell}>LOQ (ppm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((row, index) => (
                          <React.Fragment key={index}>
                            <tr style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                              <td style={cell}>{row.target_product}</td>
                              <td style={cell}>{row.shared_equipment.map(e => e.name).join(", ") || "—"}</td>
                              <td style={cell}>{row.maco_pde ?? "—"}</td>
                              <td style={cell}>{row.maco_dose ?? "—"}</td>
                              <td style={cell}>{row.maco_10ppm}</td>
                              <td style={{ ...cell, fontWeight: "bold", color: "#004f9f" }}>
                                {row.governing_maco_pair ?? "—"}
                              </td>
                              <td style={cell}>{row.total_rinse_vol_L}</td>
                              <td style={cell}>{row.total_area_in2}</td>
                              <td style={cell}>{row.swab_area_sqin ?? "—"}</td>
                              <td style={cell}>
                                {fmtLimit(row.rinse_limit_pde, row.rinse_limit_pde_raw)}
                                {" "}{statusBadge(row.rinse_status_pde)}
                              </td>
                              <td style={cell}>
                                {fmtLimit(row.rinse_limit_dose, row.rinse_limit_dose_raw)}
                                {" "}{statusBadge(row.rinse_status_dose)}
                              </td>
                              <td style={cell}>
                                {fmtLimit(row.rinse_limit_10ppm, row.rinse_limit_10ppm_raw)}
                                {" "}{statusBadge(row.rinse_status_10ppm)}
                              </td>
                              <td style={{ ...cell, fontWeight: "bold", background: index % 2 === 0 ? "#e8f0fe" : "#dce8fd" }}>
                                {row.rinse_limit_final != null ? row.rinse_limit_final : "—"}
                                {" "}{statusBadge(row.rinse_status_final)}
                              </td>
                              <td style={cell}>
                                {fmtLimit(row.swab_limit_pde, row.swab_limit_pde_raw)}
                                {" "}{statusBadge(row.swab_status_pde)}
                              </td>
                              <td style={cell}>
                                {fmtLimit(row.swab_limit_dose, row.swab_limit_dose_raw)}
                                {" "}{statusBadge(row.swab_status_dose)}
                              </td>
                              <td style={cell}>
                                {fmtLimit(row.swab_limit_10ppm, row.swab_limit_10ppm_raw)}
                                {" "}{statusBadge(row.swab_status_10ppm)}
                              </td>
                              <td style={{ ...cell, fontWeight: "bold", background: index % 2 === 0 ? "#e8f0fe" : "#dce8fd" }}>
                                {row.swab_limit_final != null ? row.swab_limit_final : "—"}
                                {" "}{statusBadge(row.swab_status_final)}
                              </td>
                              <td style={cell}>{row.loq_ppm}</td>
                            </tr>
                            {(row.step_matrix_rows || []).map((smr, si) => {
                              const isMaco = smr.scenario === "maco";
                              const rowBg = isMaco ? "#e0f7fa" : "#fff7ed";
                              const labelColor = isMaco ? "#006064" : "#92400e";
                              const scenarioLabel = isMaco ? "MACO" : "Fixed 10 ppm";
                              const srcLabel = smr.source_step === 0
                                ? "Src: Final Step"
                                : `Src: Step ${smr.source_step}${smr.source_step_compound ? ` (${smr.source_step_compound})` : ""}`;
                              const tgtLabel = smr.target_step === 0
                                ? "→ Final Step"
                                : `→ Step ${smr.target_step}${smr.target_step_compound ? ` (${smr.target_step_compound})` : ""}`;
                              const highlightBg = isMaco
                                ? (index % 2 === 0 ? "#b2ebf2" : "#80deea")
                                : "#fed7aa";
                              return (
                                <tr key={`smr-${index}-${si}`} style={{ background: rowBg }}>
                                  <td style={{ ...cell, textAlign: "left" }}>
                                    <div style={{ fontWeight: "bold", fontSize: "12px", color: labelColor }}>
                                      {row.target_product}
                                    </div>
                                    <div style={{ fontSize: "11px", color: labelColor, marginTop: "2px" }}>
                                      {tgtLabel}
                                    </div>
                                    <div style={{ fontSize: "10px", color: labelColor, opacity: 0.8 }}>
                                      {srcLabel} · {scenarioLabel}
                                    </div>
                                  </td>
                                  <td style={cell}>{(smr.shared_equipment || []).map(e => e.name).join(", ") || "—"}</td>
                                  <td style={cell}>{isMaco ? (smr.maco_pde ?? "—") : "—"}</td>
                                  <td style={cell}>{isMaco ? (smr.maco_dose ?? "—") : "—"}</td>
                                  <td style={cell}>{isMaco ? (smr.maco_10ppm ?? "—") : "—"}</td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>{smr.total_rinse_vol_L ?? "—"}</td>
                                  <td style={cell}>{smr.total_area_in2 ?? "—"}</td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>—</td>
                                  <td style={{ ...cell, fontWeight: "bold", background: highlightBg }}>
                                    {smr.rinse_limit_final != null ? smr.rinse_limit_final : "—"}
                                    {" "}{statusBadge(smr.rinse_status_final)}
                                  </td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>—</td>
                                  <td style={cell}>—</td>
                                  <td style={{ ...cell, fontWeight: "bold", background: highlightBg }}>
                                    {smr.swab_limit_final != null ? smr.swab_limit_final : "—"}
                                    {" "}{statusBadge(smr.swab_status_final)}
                                  </td>
                                  <td style={cell}>{smr.loq_ppm}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== FACILITY SUMMARY TAB ===== */}
      {activeTab === "summary" && (
        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              style={styles.select}>
              <option value="">Select Facility</option>
              {facilities.map((f) => (
                <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
              ))}
            </select>
            {role === "VIEWER" ? (
              <span style={styles.viewerNote}>View-only — QA/ADMIN role required to run calculations</span>
            ) : (
              <button onClick={runSummary} style={styles.runBtn} disabled={summaryLoading}>
                {summaryLoading ? "Calculating..." : "Run Summary"}
              </button>
            )}
            <button onClick={handlePrintSummary} style={styles.printBtn}>Print PDF</button>
            <button onClick={exportSummaryCsv} style={styles.csvBtn}>Export CSV</button>
          </div>

          <hr />

          {summaryLoading && (
            <p style={{ color: "#004f9f" }}>⏳ Calculating limits for all products...</p>
          )}

          {summaryData.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "16px" }}>
              <div ref={summaryPrintRef}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#004f9f", color: "white" }}>
                      <th style={cell}>Source Product</th>
                      <th style={cell}>Limiting Target Product</th>
                      <th style={cell}>Governing MACO (mg)</th>
                      <th style={cell}>Governing Method</th>
                      <th style={cell}>Rinse PDE (ppm)</th>
                      <th style={cell}>Rinse Dose (ppm)</th>
                      <th style={cell}>Rinse 10ppm (ppm)</th>
                      <th style={{ ...cell, background: "#003080" }}>Final Rinse Limit (ppm)</th>
                      <th style={cell}>Swab PDE (ppm)</th>
                      <th style={cell}>Swab Dose (ppm)</th>
                      <th style={cell}>Swab 10ppm (ppm)</th>
                      <th style={{ ...cell, background: "#003080" }}>Final Swab Limit (ppm)</th>
                      <th style={cell}>LOQ (ppm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, index) => (
                      <tr key={index}
                        style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                        <td style={{ ...cell, fontWeight: "bold" }}>{row.source}</td>
                        <td style={cell}>
                          {row.limiting_target === "Error"
                            ? <span title={row.error_reason}
                                style={{ color: "#dc3545", fontWeight: "bold", cursor: "help",
                                  display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                ⚠ Error
                                <span style={{ fontSize: "10px", color: "#6c757d", fontWeight: "normal",
                                  maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap", display: "inline-block" }}>
                                  — {row.error_reason}
                                </span>
                              </span>
                            : row.limiting_target}
                        </td>
                        <td style={{ ...cell, color: "#004f9f", fontWeight: "bold" }}>
                          {row.governing_maco}
                        </td>
                        <td style={cell}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "4px", fontSize: "12px",
                            fontWeight: "bold",
                            background: row.governing_method === "Fixed 10 ppm" ? "#fff3cd" :
                                        row.governing_method === "PDE" ? "#cce5ff" :
                                        row.governing_method === "Dose" ? "#ffe8d6" : "#d4edda",
                            color: row.governing_method === "Fixed 10 ppm" ? "#856404" :
                                   row.governing_method === "PDE" ? "#004085" :
                                   row.governing_method === "Dose" ? "#7c3c00" : "#155724"
                          }}>
                            {row.governing_method}
                          </span>
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.rinse_pde !== "—" ? row.rinse_pde : null, row.rinse_pde_raw)}
                          {row.rinse_pde !== "—" && <> {statusBadge(row.rinse_status_pde)}</>}
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.rinse_dose !== "—" ? row.rinse_dose : null, row.rinse_dose_raw)}
                          {row.rinse_dose !== "—" && <> {statusBadge(row.rinse_status_dose)}</>}
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.rinse_10ppm !== "—" ? row.rinse_10ppm : null, row.rinse_10ppm_raw)}
                          {row.rinse_10ppm !== "—" && <> {statusBadge(row.rinse_status_10ppm)}</>}
                        </td>
                        <td style={{ ...cell, fontWeight: "bold", background: index % 2 === 0 ? "#e8f0fe" : "#dce8fd" }}>
                          {row.rinse_final !== "—" ? row.rinse_final : "—"}
                          {row.rinse_final !== "—" && <> {statusBadge(row.rinse_status_final)}</>}
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.swab_pde !== "—" ? row.swab_pde : null, row.swab_pde_raw)}
                          {row.swab_pde !== "—" && <> {statusBadge(row.swab_status_pde)}</>}
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.swab_dose !== "—" ? row.swab_dose : null, row.swab_dose_raw)}
                          {row.swab_dose !== "—" && <> {statusBadge(row.swab_status_dose)}</>}
                        </td>
                        <td style={cell}>
                          {fmtLimit(row.swab_10ppm !== "—" ? row.swab_10ppm : null, row.swab_10ppm_raw)}
                          {row.swab_10ppm !== "—" && <> {statusBadge(row.swab_status_10ppm)}</>}
                        </td>
                        <td style={{ ...cell, fontWeight: "bold", background: index % 2 === 0 ? "#e8f0fe" : "#dce8fd" }}>
                          {row.swab_final !== "—" ? row.swab_final : "—"}
                          {row.swab_final !== "—" && <> {statusBadge(row.swab_status_final)}</>}
                        </td>
                        <td style={cell}>{row.loq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <br />
              <p style={{ color: "#888", fontSize: "13px" }}>
                Total Products: {summaryData.length}
              </p>
            </div>
          )}
        </div>
      )}

      <br />
    </div>
  );
}

const cell = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "center",
  whiteSpace: "nowrap"
};

const styles = {
  select: { padding: "10px", width: "280px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" },
  viewerNote: { fontSize: "12px", color: "#856404", background: "#fff3cd", padding: "6px 12px", borderRadius: "6px", border: "1px solid #ffc107" },
  runBtn: { padding: "10px 20px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  printBtn: { padding: "10px 20px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  pageHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn: { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  summaryBox: { display: "flex", gap: "20px", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #ddd", borderRadius: "10px", padding: "16px", marginTop: "10px" },
  summaryItem: { display: "flex", flexDirection: "column", gap: "4px" },
  summaryLabel: { fontSize: "11px", color: "#888" },
  summaryValue: { fontSize: "14px", fontWeight: "500" },
  historyBtn: { padding: "6px 14px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" },
  csvBtn: { padding: "10px 20px", background: "#17a2b8", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
};

export default MatrixPage;