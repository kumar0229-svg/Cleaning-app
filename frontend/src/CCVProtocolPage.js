import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/falcon-logo.svg";

// Safely extract a string from any FastAPI error shape (string, Pydantic array, or object)
function apiError(e, fallback = "An unexpected error occurred. Please try again.") {
  const detail = e?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join("; ");
  if (typeof detail === "object") return detail.msg || JSON.stringify(detail);
  return fallback;
}

const FORMULA_TEXT = {
  pde:   "MACO(PDE)  = [PDE_source (mg) × Min_Yield_next (kg) × 1,000,000] / Max_Daily_Dose_next (mg)",
  dose:  "MACO(Dose) = [Min_Dose_source (mg) × Min_Yield_next (kg) × 1,000,000] / [Max_Daily_Dose_next (mg) × 1000]",
  ppm:   "MACO(10ppm) = [Min_Yield_next (kg) × 1,000,000 × 10] / 1,000,000",
  rinse: "Rinse (ppm) = [MACO (mg) × Rinse_Area (in²)] / [Shared_Surface_Area (in²) × Rinse_Sample_Vol (L)]",
  swab:  "Swab Limit (ppm)  = (MACO × Swab_area_in² × 1000) / (Chain_area_in² × 10 mL)",
};

function statusBadge(status) {
  if (!status) return null;
  const pass = status === "PASS";
  return (
    <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
      background: pass ? "#d4edda" : "#f8d7da", color: pass ? "#155724" : "#721c24" }}>
      {status}
    </span>
  );
}

function fmtLimit(capped, raw) {
  if (capped == null) return "—";
  if (raw != null && raw > 10) return `10 (${raw})`;
  return String(capped);
}

function passFailBadge(val, loq) {
  if (!val || !loq) return null;
  const pass = val >= loq;
  return (
    <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
      background: pass ? "#d4edda" : "#f8d7da", color: pass ? "#155724" : "#721c24" }}>
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export default function CCVProtocolPage({ goHome, currentUser, role }) {

  // ── Core state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState("protocol");
  const [facilities, setFacilities] = useState([]);
  const [products, setProducts]     = useState([]);
  const [selectedFacility, setSelectedFacility] = useState("");
  const [selectedProduct, setSelectedProduct]   = useState("");
  const [loading, setLoading]       = useState(false);
  const printRef = useRef(null);
  const reportPrintRef = useRef(null);
  const [result, setResult]         = useState(null);
  const [sourceProduct, setSourceProduct] = useState(null);
  const [policy, setPolicy]         = useState(null);
  const [protocolSamplingPlan, setProtocolSamplingPlan] = useState([]);

  // ── Archive viewing ────────────────────────────────────────────────
  const [archiveDoc, setArchiveDoc] = useState(null);
  const [archiveList, setArchiveList]     = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus]       = useState("Draft");
  const [saveLoading, setSaveLoading]     = useState(false);
  const [showDeleteArchiveModal, setShowDeleteArchiveModal] = useState(false);
  const [selectedArchive, setSelectedArchive]   = useState(null);
  const [deleteArchivePassword, setDeleteArchivePassword] = useState("");
  const [deletingArchive, setDeletingArchive]   = useState(false);

  // ── Report management ──────────────────────────────────────────────
  const [reportFacility, setReportFacility] = useState("");
  const [reportProduct, setReportProduct]   = useState("");
  const [reportProducts, setReportProducts] = useState([]);
  const [approvedProtocols, setApprovedProtocols] = useState([]);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [protocolsNotice, setProtocolsNotice] = useState("");
  const [reportListError, setReportListError] = useState("");
  const [runResults, setRunResults] = useState([
    { run_number: 1, batch_number: "", equipment_results: [] },
  ]);
  const [trainingDetails, setTrainingDetails] = useState("");
  const [sopFollowed, setSOPFollowed] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [showSubmitReportModal, setShowSubmitReportModal] = useState(false);
  const [reportPassword, setReportPassword] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportList, setReportList] = useState([]);
  const [reportListLoading, setReportListLoading] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [editingReport, setEditingReport] = useState(false);
  const [viewReportLoading, setViewReportLoading] = useState(false);
  const [showDeleteReportModal, setShowDeleteReportModal] = useState(false);
  const [deleteReportTarget, setDeleteReportTarget] = useState(null);
  const [deleteReportPwd, setDeleteReportPwd] = useState("");
  const [deletingReport, setDeletingReport] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePwd, setApprovePwd] = useState("");
  const [approvingReport, setApprovingReport] = useState(false);
  const [existingReportForProtocol, setExistingReportForProtocol] = useState(null); // { report_id, status } | null
  const [savingDraft, setSavingDraft] = useState(false);

  // ── Derived display (live vs archived) ─────────────────────────────
  const displayResult        = archiveDoc?.result        ?? result;
  const displaySourceProduct = archiveDoc?.sourceProduct ?? sourceProduct;
  const displaySamplingPlan  = protocolSamplingPlan; // always live — never use frozen archive copy
  const displayDocNumber     = archiveDoc?.docNumber ??
    (result ? `PCV-PROTO-${String(sourceProduct?.product_id || "").padStart(4, "0")}-${new Date().getFullYear()}` : "—");
  const getFacilityName = (fid) =>
    archiveDoc ? archiveDoc.facilityName
               : (facilities.find(f => f.facility_id === fid)?.facility_name || fid);

  // ── Data loading ───────────────────────────────────────────────────
  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(console.log);
    api.get("/policy").then(r => setPolicy(r.data)).catch(console.log);
    api.get("/sampling/plan").then(r => setProtocolSamplingPlan(r.data)).catch(console.log);
  }, []);

  useEffect(() => {
    if (!selectedFacility) { setProducts([]); setSelectedProduct(""); return; }
    api.get("/product/all")
      .then(r => setProducts(r.data.filter(p => String(p.facility_id) === String(selectedFacility))))
      .catch(console.log);
  }, [selectedFacility]);

  useEffect(() => {
    if (activeTab === "archive") loadArchives();
    if (activeTab === "report") loadReportList();
  }, [activeTab]);

  const loadArchives = async () => {
    setArchiveLoading(true);
    try { const r = await api.get("/protocol/archives"); setArchiveList(r.data.filter(a => a.doc_number?.startsWith("PCV-PROTO-"))); }
    catch (e) { console.log(e); }
    finally { setArchiveLoading(false); }
  };

  // ── Protocol generation ────────────────────────────────────────────
  const generate = async () => {
    if (!selectedProduct) { alert("Select a source product ❌"); return; }
    setLoading(true); setResult(null); setArchiveDoc(null);
    try {
      const src = products.find(p => String(p.product_id) === String(selectedProduct));
      setSourceProduct(src || null);
      const [macoRes, sampRes] = await Promise.all([
        api.post("/maco/matrix", { source_product_id: parseInt(selectedProduct) }),
        api.get("/sampling/plan"),
      ]);
      setResult(macoRes.data);
      setProtocolSamplingPlan(sampRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Error generating protocol ❌");
    } finally { setLoading(false); }
  };

  // ── Archive: view ──────────────────────────────────────────────────
  const viewArchive = async (archiveId) => {
    try {
      const res = await api.get(`/protocol/archive/${archiveId}`);
      const { snapshot, doc_number, version, generated_by, generated_at, status } = res.data;
      setArchiveDoc({ ...snapshot, docNumber: doc_number,
        meta: { version, generated_by, generated_at, status, doc_number } });
      setResult(null);
      setActiveTab("protocol");
    } catch { alert("Error loading archived protocol ❌"); }
  };

  // ── Archive: save ──────────────────────────────────────────────────
  const saveToArchive = async () => {
    if (!result || !sourceProduct) return;
    setSaveLoading(true);
    try {
      const facilityName = facilities.find(f => f.facility_id === sourceProduct.facility_id)?.facility_name || "";
      const docNum = `PCV-PROTO-${String(sourceProduct.product_id).padStart(4, "0")}-${new Date().getFullYear()}`;
      const snapshot = { result, sourceProduct, facilityName, docNumber: docNum, samplingPlan: protocolSamplingPlan };
      const res = await api.post("/protocol/archive", {
        snapshot, doc_number: docNum, product_id: sourceProduct.product_id,
        product_name: sourceProduct.product_name, facility_name: facilityName, status: saveStatus,
      });
      setShowSaveModal(false);
      alert(`Saved: ${res.data.doc_number}  Version ${res.data.version} ✅`);
    } catch (e) { alert(apiError(e, "Error saving protocol.")); }
    finally { setSaveLoading(false); }
  };

  // ── Archive: delete ────────────────────────────────────────────────
  const confirmDeleteArchive = async () => {
    if (!deleteArchivePassword.trim()) { alert("Enter your password ❌"); return; }
    setDeletingArchive(true);
    try {
      await api.delete(`/protocol/archive/remove/${selectedArchive.archive_id}`,
        { data: { password: deleteArchivePassword, reason: "Protocol archive removed by user" } });
      alert("Archive deleted ✅");
      setShowDeleteArchiveModal(false);
      loadArchives();
    } catch (e) { alert(apiError(e, "Error deleting archive.")); }
    finally { setDeletingArchive(false); }
  };

  // ── Report management ──────────────────────────────────────────────
  useEffect(() => {
    if (!reportFacility) { setReportProducts([]); setReportProduct(""); setApprovedProtocols([]); return; }
    api.get("/product/all")
      .then(r => setReportProducts(r.data.filter(p => String(p.facility_id) === String(reportFacility))))
      .catch(console.log);
  }, [reportFacility]);

  useEffect(() => {
    if (!reportProduct || !reportFacility) {
      setApprovedProtocols([]); setSelectedProtocol(null); setProtocolsNotice(""); return;
    }
    setProtocolsLoading(true);
    setProtocolsNotice("");
    api.post("/report/approved-protocols", null, { params: { facility_id: parseInt(reportFacility), product_id: parseInt(reportProduct) } })
      .then(r => {
        const pcvOnly = r.data.filter(p => p.doc_number?.startsWith("PCV-PROTO-"));
        setApprovedProtocols(pcvOnly);
        if (pcvOnly.length === 0)
          setProtocolsNotice("No approved PCV protocols found for this product. Go to the Archive tab, generate a PCV protocol and set its status to Final before creating a report.");
      })
      .catch(e => setProtocolsNotice(apiError(e, "Failed to load protocols. Please try again.")))
      .finally(() => setProtocolsLoading(false));
  }, [reportProduct, reportFacility]);

  const loadProtocolEquipment = async (protocolId, existingReport = null) => {
    try {
      const [archiveRes, planRes, equipRes] = await Promise.all([
        api.get(`/protocol/archive/${protocolId}`),
        api.get("/sampling/plan"),
        api.get("/equipment/all"),
      ]);
      const snapshot = archiveRes.data.snapshot;
      const pairs = snapshot.result?.data || [];

      // Always use the live sampling plan so newly-added entries are included
      const catEntries = {};
      planRes.data.forEach(cat => { catEntries[cat.category_id] = cat.entries || []; });

      // Fallback: resolve category_id from live equipment when snapshot predates that field
      const liveEqCatMap = {};
      equipRes.data.forEach(e => { liveEqCatMap[e.equipment_name] = e.category_id; });

      // Per-equipment governing limits: minimum of eq.rinse_final / eq.swab_final across all pairs.
      // Matches Protocol Section 5 "Finalized Limits per Equipment" exactly.
      // Also keep a global fallback (govRinse/govSwab) for old snapshots that lack per-eq fields.
      let govRinse = null, govSwab = null;
      const eqLimitsMap = {};
      pairs.forEach(pair => {
        const pr = pair.rinse_limit_final ?? pair.rinse_limit_ppm;
        const ps = pair.swab_limit_final  ?? pair.swab_limit_ppm;
        if (pr != null && (govRinse === null || pr < govRinse)) govRinse = pr;
        if (ps != null && (govSwab  === null || ps < govSwab))  govSwab  = ps;
        (pair.shared_equipment || []).forEach(eq => {
          if (!eqLimitsMap[eq.name]) eqLimitsMap[eq.name] = { rinse_final: null, swab_final: null };
          const r = eq.rinse_final ?? null;
          const s = eq.swab_final  ?? null;
          if (r != null && (eqLimitsMap[eq.name].rinse_final === null || r < eqLimitsMap[eq.name].rinse_final))
            eqLimitsMap[eq.name].rinse_final = r;
          if (s != null && (eqLimitsMap[eq.name].swab_final  === null || s < eqLimitsMap[eq.name].swab_final))
            eqLimitsMap[eq.name].swab_final  = s;
        });
      });

      // Collect unique FINAL-step equipment across all pairs (MACO limits)
      const eqMap = {};
      pairs.forEach(pair => {
        (pair.shared_equipment || []).forEach(eq => {
          if (!eqMap[eq.name]) {
            // Use snapshot category_id; fall back to live equipment data for old snapshots
            const resolvedCatId = eq.category_id ?? liveEqCatMap[eq.name] ?? null;
            eqMap[eq.name] = {
              equipment_name: eq.name,
              category_id: resolvedCatId,
              category_name: eq.category_name ?? planRes.data.find(c => c.category_id === resolvedCatId)?.category_name ?? "—",
              eq_type: "maco",
            };
          }
        });
      });

      // Also add SYNTHESIS-step equipment (fixed 10 ppm limit).
      // Use top-level synthesis_steps from snapshot; fall back to per-pair synthesis_step_equipment.
      const synthSteps = snapshot.result?.synthesis_steps || [];
      const addSynthEq = (eq) => {
        if (eqMap[eq.name]) return;
        const resolvedCatId = eq.category_id ?? liveEqCatMap[eq.name] ?? null;
        eqMap[eq.name] = {
          equipment_name: eq.name,
          category_id:    resolvedCatId,
          category_name:  eq.category_name ?? planRes.data.find(c => c.category_id === resolvedCatId)?.category_name ?? "—",
          eq_type: "synthesis",
        };
      };
      if (synthSteps.length > 0) {
        synthSteps.forEach(stepGrp => (stepGrp.equipment || []).forEach(addSynthEq));
      } else {
        pairs.forEach(pair =>
          (pair.synthesis_step_equipment || []).forEach(stepGrp =>
            (stepGrp.equipment || []).forEach(addSynthEq)
          )
        );
      }

      const equipmentResults = Object.values(eqMap).map(eq => ({
        ...eq,
        rinse_limit_ppm: eq.eq_type === "synthesis" ? 10.0
          : (eqLimitsMap[eq.equipment_name]?.rinse_final ?? govRinse),
        swab_limit_ppm:  eq.eq_type === "synthesis" ? 10.0
          : (eqLimitsMap[eq.equipment_name]?.swab_final  ?? govSwab),
        rinse_result_ppm: "",
        rinse_lot_number: "",
        swab_results: (catEntries[eq.category_id] || []).map(entry => ({
          sample_number: entry.sample_number,
          location_description: entry.location_description,
          result_ppm: "",
          lot_number: "",
        })),
      }));

      // If an existing draft is provided, merge its results into the template
      if (existingReport?.status === "Draft" && existingReport.results_data?.runs) {
        const draftRuns = existingReport.results_data.runs;
        setRunResults(prev => prev.map((run, ri) => {
          const draftRun = draftRuns[ri];
          if (!draftRun) return { ...run, equipment_results: equipmentResults };
          return {
            ...draftRun,
            equipment_results: equipmentResults.map((eq, ei) => {
              const draftEq = draftRun.equipment_results?.[ei];
              if (!draftEq || draftEq.equipment_name !== eq.equipment_name) return eq;
              return {
                ...eq,
                rinse_result_ppm: draftEq.rinse_result_ppm || "",
                rinse_lot_number: draftEq.rinse_lot_number || "",
                swab_results: (eq.swab_results || []).map((swab, si) => ({
                  ...swab,
                  result_ppm: draftEq.swab_results?.[si]?.result_ppm || "",
                  lot_number: draftEq.swab_results?.[si]?.lot_number || "",
                })),
              };
            }),
          };
        }));
        if (existingReport.results_data.training_details)
          setTrainingDetails(existingReport.results_data.training_details);
        if (existingReport.results_data.sop_followed)
          setSOPFollowed(existingReport.results_data.sop_followed);
        if (existingReport.results_data.completion_date)
          setCompletionDate(existingReport.results_data.completion_date);
      } else {
        setRunResults(prev => prev.map(run => ({ ...run, equipment_results: equipmentResults })));
      }
    } catch (e) { setProtocolsNotice(apiError(e, "Failed to load protocol details. Please try again.")); }
  };

  const handleProtocolSelect = async (protocol) => {
    setSelectedProtocol(protocol);
    setCompletionDate("");
    setTrainingDetails("");
    setSOPFollowed("");
    setExistingReportForProtocol(null);
    setProtocolsNotice("");

    // Check if a report already exists for this protocol
    let existingReport = null;
    try {
      const r = await api.get(`/report/by-archive/${protocol.archive_id}`);
      if (r.data) {
        existingReport = r.data;
        // Fetch full draft data so we can restore the form
        if (r.data.status === "Draft") {
          const fullRes = await api.get(`/report/${r.data.report_id}`);
          existingReport = { ...r.data, results_data: fullRes.data.results_data };
        }
        setExistingReportForProtocol(existingReport);
      }
    } catch (_) {}

    await loadProtocolEquipment(protocol.archive_id, existingReport?.status === "Draft" ? existingReport : null);
  };

  const handleRunResultChange = (runIdx, equipIdx, field, value, swabIdx) => {
    setRunResults(prev => prev.map((run, ri) => {
      if (ri !== runIdx) return run;
      if (field === "batch_number") return { ...run, batch_number: value };
      const eqs = run.equipment_results.map((eq, ei) => {
        if (ei !== equipIdx) return eq;
        if (field === "swab_result_ppm" || field === "swab_lot_number") {
          const key = field === "swab_result_ppm" ? "result_ppm" : "lot_number";
          const swab_results = eq.swab_results.map((s, si) =>
            si === swabIdx ? { ...s, [key]: value } : s
          );
          return { ...eq, swab_results };
        }
        return { ...eq, [field]: value };
      });
      return { ...run, equipment_results: eqs };
    }));
  };

  const loadReportList = async () => {
    setReportListLoading(true);
    setReportListError("");
    try {
      const res = await api.get("/report/list", {
        params: { facility_id: reportFacility || undefined, product_id: reportProduct || undefined }
      });
      setReportList(res.data.filter(r => r.doc_number?.startsWith("PCV-PROTO-")));
    } catch (e) {
      setReportListError(apiError(e, "Failed to load reports. Please try again."));
    } finally { setReportListLoading(false); }
  };

  const viewReportDetail = async (reportId) => {
    setViewingReport({ report_id: reportId });
    setViewReportLoading(true);
    try {
      const res = await api.get(`/report/${reportId}`);
      setViewingReport(res.data);
    } catch (e) {
      alert(apiError(e, "Failed to load report."));
      setViewingReport(null);
    } finally { setViewReportLoading(false); }
  };

  const confirmApproveReport = async () => {
    if (!approvePwd.trim()) { alert("Enter your password ❌"); return; }
    setApprovingReport(true);
    try {
      await api.post(`/report/${approveTarget.report_id}/approve`,
        { password: approvePwd, reason: "Report approved" });
      alert(`Report approved ✅ — this product is now eligible for Periodic Cleaning Verification.`);
      setShowApproveModal(false);
      setApprovePwd("");
      loadReportList();
    } catch (e) { alert(apiError(e, "Error approving report.")); }
    finally { setApprovingReport(false); }
  };

  const confirmDeleteReport = async () => {
    if (!deleteReportPwd.trim()) { alert("Enter your password ❌"); return; }
    setDeletingReport(true);
    try {
      await api.delete(`/report/${deleteReportTarget.report_id}`,
        { data: { password: deleteReportPwd, reason: "Report removed by user" } });
      alert("Report deleted ✅");
      setShowDeleteReportModal(false);
      setDeleteReportPwd("");
      setViewingReport(null);
      loadReportList();
    } catch (e) { alert(apiError(e, "Error deleting report.")); }
    finally { setDeletingReport(false); }
  };

  const handleReportPrint = async () => {
    if (!reportPrintRef.current) return;
    let logoDataUrl = "";
    try {
      const res = await fetch(logo); const blob = await res.blob();
      logoDataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (_) {}
    const { product_name, facility_name, submitted_by, results_data,
            protocol_generated_at } = viewingReport;
    const rStartDate = results_data?.start_date || protocol_generated_at || "";
    const rCompletionDate = results_data?.completion_date || "";
    const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>PCV Validation Report — ${product_name}</title>
<style>
@page{size:A4 landscape;margin:18mm 12mm 15mm 12mm;@bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Arial,sans-serif;font-size:7pt;color:#666}}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.rh{position:fixed;top:0;left:0;right:0;height:15mm;background:white;border-bottom:2px solid #004f9f;display:flex;align-items:center;gap:12px;padding:0 12mm;z-index:1000}
.rh img{height:9mm}.rh-center{flex:1}.rh-title{font-size:10pt;font-weight:bold;color:#004f9f;margin:0}
.rh-sub{font-size:7.5pt;color:#666;margin:1px 0 0}.rh-meta{text-align:right;font-size:7pt;color:#777;line-height:1.5}
.rf{position:fixed;bottom:0;left:0;right:0;height:10mm;background:white;border-top:1px solid #d0d0d0;display:flex;align-items:center;justify-content:space-between;padding:0 12mm;font-size:7pt;color:#999;z-index:1000}
body{font-family:Arial,sans-serif;font-size:9pt;color:#222;margin:0;padding:17mm 0 12mm;line-height:1.4}
.doc-header{display:none!important}.doc-footer{display:none!important}
.doc-section{break-inside:avoid;page-break-inside:avoid;padding:6pt 0!important;border-left:none!important;margin-bottom:0!important}
.sig-grid-print{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16pt!important;padding:8pt 0!important;margin-top:8pt!important;break-inside:avoid}
table{width:100%!important;border-collapse:collapse;margin:3pt 0;table-layout:fixed}
th{background:#004f9f!important;color:white!important;padding:3pt 5pt!important;text-align:left;border:0.5pt solid #c0d0e8;font-size:7.5pt!important;font-weight:bold;word-break:break-word;overflow-wrap:break-word}
td{border:0.5pt solid #d8e2ef;padding:3pt 5pt!important;font-size:7.5pt!important;word-break:break-word;overflow-wrap:break-word}
tr:nth-child(even) td{background:#f5f8fc!important}
img{max-width:70pt;max-height:24pt}p{margin:0 0 5pt}
div{overflow:visible!important;max-width:100%}
.sig-box{display:flex;flex-direction:column}.sig-box p:first-child{margin-bottom:16pt!important}
.pass-badge{background:#d4edda!important;color:#155724!important;font-weight:bold;padding:1pt 4pt;border-radius:2pt;font-size:7pt}
.fail-badge{background:#f8d7da!important;color:#721c24!important;font-weight:bold;padding:1pt 4pt;border-radius:2pt;font-size:7pt}
</style></head><body>
<div class="rh">
  <img src="${logoDataUrl}" alt="Falcon"/>
  <div class="rh-center">
    <p class="rh-title">PCV Validation Report</p>
    <p class="rh-sub">Archived Report — ${product_name}</p>
  </div>
  <div class="rh-meta">
    <div><strong>${product_name}</strong> &nbsp;|&nbsp; ${facility_name}</div>
    <div>Start: ${fmt(rStartDate)} &nbsp;|&nbsp; Completed: ${fmt(rCompletionDate)}</div>
    <div>Submitted by: ${submitted_by}</div>
  </div>
</div>
<div class="rf">
  <span>Falcon &mdash; Confidential</span>
  <span>${product_name} — ${facility_name}</span>
  <span>Printed: ${new Date().toLocaleString("en-IN")}</span>
</div>
${reportPrintRef.current.innerHTML}
</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  const validateReport = () => {
    if (!reportFacility || !reportProduct || !selectedProtocol) {
      alert("Select facility, product, and protocol first ❌");
      return false;
    }
    for (let i = 0; i < runResults.length; i++) {
      if (!runResults[i].batch_number.trim()) {
        alert(`Batch number required for Run ${i + 1} ❌`);
        return false;
      }
      for (let j = 0; j < runResults[i].equipment_results.length; j++) {
        const eq = runResults[i].equipment_results[j];
        if (!eq.rinse_result_ppm) {
          alert(`Rinse result required for Run ${i + 1}, ${eq.equipment_name} ❌`);
          return false;
        }
        if (isNaN(parseFloat(eq.rinse_result_ppm))) {
          alert(`Rinse result must be numeric (Run ${i + 1}, ${eq.equipment_name}) ❌`);
          return false;
        }
        for (let k = 0; k < (eq.swab_results || []).length; k++) {
          const swab = eq.swab_results[k];
          if (!swab.result_ppm) {
            alert(`Swab result required for Run ${i + 1}, ${eq.equipment_name} — ${swab.sample_number} ❌`);
            return false;
          }
          if (isNaN(parseFloat(swab.result_ppm))) {
            alert(`Swab result must be numeric (Run ${i + 1}, ${eq.equipment_name} — ${swab.sample_number}) ❌`);
            return false;
          }
        }
      }
    }
    if (!trainingDetails.trim() || !sopFollowed.trim()) {
      alert("Training details and SOP followed are required ❌");
      return false;
    }
    if (!completionDate) {
      alert("Completion date (Run completed date) is required ❌");
      return false;
    }
    return true;
  };

  const submitReport = async () => {
    if (!validateReport()) return;
    setReportLoading(true);
    try {
      const resultsData = {
        runs: runResults,
        training_details: trainingDetails,
        sop_followed: sopFollowed,
        start_date: selectedProtocol.generated_at,
        completion_date: completionDate,
      };
      if (existingReportForProtocol?.status === "Draft") {
        // Promote existing draft to Submitted
        await api.put(`/report/${existingReportForProtocol.report_id}`, {
          results_data: resultsData,
          password: reportPassword,
          reason: "Report submitted",
          is_draft: false,
        });
      } else {
        await api.post("/report/create", {
          archive_id: selectedProtocol.archive_id,
          results_data: resultsData,
          password: reportPassword,
        });
      }
      alert("Report submitted successfully ✅");
      setShowSubmitReportModal(false);
      setReportPassword("");
      setReportFacility("");
      setReportProduct("");
      setSelectedProtocol(null);
      setTrainingDetails("");
      setSOPFollowed("");
      setCompletionDate("");
      setExistingReportForProtocol(null);
      setRunResults([
        { run_number: 1, batch_number: "", equipment_results: [] },
      ]);
      loadReportList();
    } catch (e) { alert(apiError(e, "Error submitting report.")); }
    finally { setReportLoading(false); }
  };

  const saveDraft = async () => {
    if (!reportFacility || !reportProduct || !selectedProtocol) {
      alert("Select facility, product, and protocol first ❌");
      return;
    }
    setSavingDraft(true);
    try {
      const resultsData = {
        runs: runResults || [],
        training_details: trainingDetails,
        sop_followed: sopFollowed,
        start_date: selectedProtocol?.generated_at || null,
        completion_date: completionDate || null,
      };
      if (existingReportForProtocol?.status === "Draft") {
        await api.put(`/report/${existingReportForProtocol.report_id}`, {
          results_data: resultsData,
          reason: "Draft save",
          is_draft: true,
        });
      } else {
        const res = await api.post("/report/create", {
          archive_id: selectedProtocol.archive_id,
          results_data: resultsData,
          is_draft: true,
        });
        setExistingReportForProtocol({ report_id: res.data.report_id, status: "Draft" });
      }
      alert("Draft saved ✅");
      loadReportList();
    } catch (e) { alert(apiError(e, "Error saving draft.")); }
    finally { setSavingDraft(false); }
  };

  const compareResultToLimit = (result, limit) => {
    if (!result || !limit) return null;
    const r = parseFloat(result);
    const l = parseFloat(limit);
    if (isNaN(r) || isNaN(l)) return null;
    return r <= l ? "PASS" : "FAIL";
  };

  // ── Print ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!printRef.current) return;
    let logoDataUrl = "";
    try {
      const res = await fetch(logo); const blob = await res.blob();
      logoDataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (_) {}
    const win = window.open("", "_blank");
    const versionLabel = archiveDoc ? ` — Version ${archiveDoc.meta.version}` : "";
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Periodic Cleaning Verification Protocol — ${displayDocNumber}${versionLabel}</title>
<style>
@page{size:A4 portrait;margin:22mm 14mm 18mm 14mm;@bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Arial,sans-serif;font-size:7.5pt;color:#666}}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.rh{position:fixed;top:0;left:0;right:0;height:18mm;background:white;border-bottom:2px solid #004f9f;display:flex;align-items:center;gap:12px;padding:0 14mm;z-index:1000}
.rh img{height:10mm}.rh-center{flex:1}.rh-title{font-size:11pt;font-weight:bold;color:#004f9f;margin:0}
.rh-sub{font-size:8pt;color:#666;margin:1px 0 0}.rh-meta{text-align:right;font-size:7.5pt;color:#777;line-height:1.5}
.rf{position:fixed;bottom:0;left:0;right:0;height:12mm;background:white;border-top:1px solid #d0d0d0;display:flex;align-items:center;justify-content:space-between;padding:0 14mm;font-size:7.5pt;color:#999;z-index:1000}
body{font-family:Arial,sans-serif;font-size:10pt;color:#222;margin:0;padding:20mm 0 14mm;line-height:1.5}
.doc-header{display:none!important}.doc-footer{display:none!important}.archive-banner{display:none!important}
.doc-section{break-inside:avoid;page-break-inside:avoid;padding:8pt 0!important;border-left:none!important;margin-bottom:0!important}
.pair-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:8pt!important;padding:6pt 8pt!important;background:#f8fafc;border:0.5pt solid #dde4f0;border-radius:4pt}
.formula-box{break-inside:avoid;page-break-inside:avoid;padding:6pt 10pt;background:#f8fafc;border:0.5pt solid #dde4f0;border-radius:3pt;margin-bottom:5pt;display:flex;flex-direction:column;gap:3pt}
.sig-grid-print{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid;display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:20pt!important;padding:10pt 0!important;margin-top:10pt!important}
.sampling-cat-block{break-inside:avoid;page-break-inside:avoid;margin-bottom:10pt}
table{break-inside:avoid;page-break-inside:avoid;width:100%!important;border-collapse:collapse;margin:3pt 0}
tr{break-inside:avoid;page-break-inside:avoid}
th{background:#004f9f!important;color:white!important;padding:4pt 6pt!important;text-align:left;border:0.5pt solid #c0d0e8;font-size:8.5pt!important;font-weight:bold;word-break:break-word;overflow-wrap:break-word}
td{border:0.5pt solid #d8e2ef;padding:4pt 6pt!important;font-size:8.5pt!important;word-break:break-word;overflow-wrap:break-word}
tr:nth-child(even) td{background:#f5f8fc!important}
h2{font-size:11pt;color:#004f9f;border-bottom:1pt solid #004f9f;padding-bottom:3pt;margin:14pt 0 6pt}
img{max-width:70pt;max-height:26pt}
code{font-family:'Courier New',monospace;font-size:8pt;color:#004f9f;background:#eef4ff;padding:1pt 3pt;border-radius:2pt}
p{margin:0 0 5pt}
div{overflow:visible!important;max-width:100%}
.governing-box{background:#eef4ff!important;border:0.5pt solid #c7d9f7;border-radius:4pt;padding:8pt 12pt;margin-bottom:8pt}
.sig-box{display:flex;flex-direction:column}.sig-box p:first-child{margin-bottom:18pt!important}
.policy-badge-box{margin-bottom:6pt}
.sample-num{font-family:'Courier New',monospace;font-weight:bold;color:#004f9f;font-size:8.5pt}
</style></head><body>
<div class="rh">
  <img src="${logoDataUrl}" alt="Falcon"/>
  <div class="rh-center">
    <p class="rh-title">Periodic Cleaning Verification Protocol</p>
    <p class="rh-sub">Cleaning Limit Calculation — MACO Methodology</p>
  </div>
  <div class="rh-meta">
    <div><strong>${displayDocNumber}</strong>${versionLabel}</div>
    <div>Version ${archiveDoc ? archiveDoc.meta.version : "1.0"} &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-IN")}</div>
    <div>Generated by: ${archiveDoc ? archiveDoc.meta.generated_by : currentUser}</div>
  </div>
</div>
<div class="rf">
  <span>Falcon &mdash; Confidential</span>
  <span>${displayDocNumber}${versionLabel}</span>
  <span>Printed: ${new Date().toLocaleString("en-IN")}</span>
</div>
${printRef.current.innerHTML}
</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  // ── Protocol document renderer ─────────────────────────────────────
  const renderProtocolDoc = () => {
    const r  = displayResult;
    const sp = displaySourceProduct;
    if (!r) return null;

    // Collect unique categories from shared equipment for sampling plan section
    const catMap = new Map();
    r.data?.forEach(pair => pair.shared_equipment?.forEach(eq => {
      if (eq.category_id && !catMap.has(eq.category_id))
        catMap.set(eq.category_id, eq.category_name);
    }));

    // Filter sampling plan to categories present in the protocol
    const relevantPlan = displaySamplingPlan.filter(c =>
      catMap.size === 0 || catMap.has(c.category_id)
    ).filter(c => c.entries.length > 0);

    return (
      <div ref={printRef} style={{ background: "white", boxShadow: "0 4px 28px rgba(0,0,0,0.32)", minHeight: "1123px" }}>

        {/* Archive banner — hidden in print */}
        {archiveDoc && (
          <div className="archive-banner" style={{ background: "#fff3cd", borderBottom: "2px solid #ffc107",
            padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "13px", color: "#856404" }}>
              <strong>Archived — {archiveDoc.docNumber} Version {archiveDoc.meta.version}</strong>
              <span style={{ marginLeft: "14px", fontWeight: "normal" }}>
                by {archiveDoc.meta.generated_by} · {new Date(archiveDoc.meta.generated_at).toLocaleDateString("en-IN")} · {archiveDoc.meta.status}
              </span>
            </div>
            <button onClick={() => setArchiveDoc(null)}
              style={{ padding: "4px 12px", background: "#856404", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
              ✕ Close
            </button>
          </div>
        )}

        {/* Doc header */}
        <div style={S.docHeader} className="doc-header">
          <img src={logo} alt="Falcon" style={{ width: 70 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={S.docTitle}>Periodic Cleaning Verification Protocol</h3>
                <p style={S.docSub}>Cleaning Limit Calculation — MACO Methodology</p>
              </div>
              <table style={S.metaTable}><tbody>
                <tr><td style={S.metaKey}>Document No.</td><td style={S.metaVal}>{displayDocNumber}</td></tr>
                <tr><td style={S.metaKey}>Version</td><td style={S.metaVal}>{archiveDoc ? archiveDoc.meta.version : "1.0"}</td></tr>
                <tr><td style={S.metaKey}>Date</td><td style={S.metaVal}>{new Date().toLocaleDateString("en-IN")}</td></tr>
                <tr><td style={S.metaKey}>Generated By</td><td style={S.metaVal}>{archiveDoc ? archiveDoc.meta.generated_by : currentUser}</td></tr>
              </tbody></table>
            </div>
          </div>
        </div>

        {/* § 1 Scope */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>1. Scope & Objective</p>
          <p style={S.para}>This protocol defines the Maximum Allowable Carryover (MACO) cleaning limits for
            <strong> {r.source}</strong> as a source (previous) product manufactured at <strong>{getFacilityName(sp?.facility_id)}</strong>.
            It determines the permissible residue level that may remain on shared equipment surfaces before manufacture
            of subsequent products, ensuring patient safety and product quality.</p>
          <p style={S.para}>Limits are derived using the <strong>{r.policy_label || r.policy}</strong> methodology
            in accordance with ICH Q7, EMA/CHMP/CVMP/SWP/169430/2012, and applicable site SOPs.</p>
        </div>

        {/* § 2 Source product */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>2. Source Product Information</p>
          <table style={S.dataTable}><tbody>
            <tr><td style={S.tdKey}>Product Name</td><td style={S.tdVal}><strong>{r.source}</strong></td>
                <td style={S.tdKey}>Facility</td><td style={S.tdVal}>{getFacilityName(sp?.facility_id)}</td></tr>
            <tr><td style={S.tdKey}>PDE / ADE (mg/day)</td><td style={S.tdVal}>{sp?.pde_mg_day ?? "—"}</td>
                <td style={S.tdKey}>Min Therapeutic Dose (mg)</td><td style={S.tdVal}>{sp?.min_therapeutic_dose_mg ?? "—"}</td></tr>
            <tr><td style={S.tdKey}>Max Daily Dose (mg/day)</td><td style={S.tdVal}>{sp?.max_daily_dose_mg ?? "—"}</td>
                <td style={S.tdKey}>Min Batch Size (kg)</td><td style={S.tdVal}>{sp?.min_yield_kg ?? "—"}</td></tr>
            <tr><td style={S.tdKey}>Max Batch Size (kg)</td><td style={S.tdVal}>{sp?.max_batch_size_kg ?? "—"}</td>
                <td style={S.tdKey}>Analytical Method</td><td style={S.tdVal}>{r.analytical_method || "—"}</td></tr>
            <tr><td style={S.tdKey}>LOD (ppm)</td><td style={S.tdVal}>{r.lod_ppm ?? "—"}</td>
                <td style={S.tdKey}>LOQ (ppm)</td><td style={S.tdVal}>{r.loq_ppm ?? "—"}</td></tr>
          </tbody></table>
        </div>

        {/* § 3 Methodology */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>3. Calculation Methodology</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            <span style={S.policyBadge}>{r.policy_label || r.policy}</span>
            {r.scenario === "fixed_10ppm"
              ? <span style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffc107", borderRadius: "4px", padding: "3px 10px", fontWeight: "bold", fontSize: "12px" }}>
                  Fixed 10 ppm — {r.source_category} Source
                </span>
              : <span style={{ background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: "4px", padding: "3px 10px", fontWeight: "bold", fontSize: "12px" }}>
                  MACO 3-Method Calculation — API Source
                </span>
            }
          </div>

          {r.scenario === "fixed_10ppm" ? (
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "12px 14px", marginBottom: "10px" }}>
              <p style={{ ...S.para, marginBottom: "4px" }}>
                <strong>Fixed 10 ppm Criterion Applied.</strong> The source product <strong>{r.source}</strong> is
                classified as <strong>{r.source_category}</strong>. Per cleaning policy, Intermediate/KSM sources are not
                subject to MACO calculation. A fixed limit of <strong>10 ppm</strong> applies to both rinse and swab
                acceptance criteria for all target products. All limits are additionally capped at 10 ppm.
              </p>
            </div>
          ) : (
            <>
              <p style={S.para}>The governing MACO is determined using the <strong>{r.policy_label || r.policy}</strong> approach.
                The following formulae are applied for each source–target product pair sharing common equipment.
                All final limits are capped at a maximum of 10 ppm.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(r.policy === "all_min" || r.policy === "pde_only" || r.policy === "pde_dose_min" || r.policy === "pde_10ppm_min") && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — PDE / ADE Based</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.pde}</code>
                    <span style={S.formulaNote}>PDE = Permitted Daily Exposure · BS = Min batch size of target · TDD = Max daily dose of target</span>
                  </div>
                )}
                {(r.policy === "all_min" || r.policy === "dose_only" || r.policy === "pde_dose_min") && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — Dose Based (1/1000th)</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.dose}</code>
                    <span style={S.formulaNote}>TD = Min therapeutic dose · Safety factor = 1000 · BS = Min batch size of target · TDD = Max daily dose of target</span>
                  </div>
                )}
                {(r.policy === "all_min" || r.policy === "10ppm_only" || r.policy === "pde_10ppm_min") && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — 10 ppm Criterion</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.ppm}</code>
                    <span style={S.formulaNote}>10 mg/kg × minimum batch size of target product</span>
                  </div>
                )}
                {(r.policy === "all_min" || r.policy === "pde_dose_min" || r.policy === "pde_10ppm_min") && (
                  <p style={{ ...S.para, marginTop: "4px" }}>Where multiple methods apply, the <strong>most conservative (smallest) MACO governs</strong>.</p>
                )}
              </div>
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
            <div style={S.formulaBox} className="formula-box">
              <span style={S.formulaLabel}>Rinse Limit</span>
              <code style={S.formulaCode}>{FORMULA_TEXT.rinse}</code>
              <span style={S.formulaNote}>Rinse_Area = rinse sampling area for the equipment (in²) · Shared_Surface_Area = total surface area of equipment shared between source and target product (in²) · Rinse_Sample_Vol = rinse volume of the equipment (L)</span>
            </div>
            <div style={S.formulaBox} className="formula-box">
              <span style={S.formulaLabel}>Swab Limit</span>
              <code style={S.formulaCode}>{FORMULA_TEXT.swab}</code>
              <span style={S.formulaNote}>Swab_area = swab sampling area (in²) · Chain_area = total equipment surface area (in²) · 10 mL = fixed swab extraction volume. Maximum 10 ppm.</span>
            </div>
          </div>
        </div>

        {/* § 4 Calculations */}
        <div style={S.section} className="calc-section">
          <p style={S.sectionTitle}>4. Cleaning Limit Calculations</p>
          {r.data.length === 0
            ? <p style={{ color: "#888", fontStyle: "italic" }}>No target products found sharing equipment in this facility.</p>
            : r.data.map((row, idx) => (
            <div key={idx} style={S.pairBlock} className="pair-block">
              <p style={S.pairTitle}>4.{idx + 1} &nbsp; {r.source} → {row.target_product}</p>
              <p style={S.subLabel}>Shared Equipment</p>
              {row.shared_equipment.length === 0
                ? <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No shared equipment.</p>
                : <>
                  {/* Equipment details */}
                  <table style={S.dataTable}>
                    <thead><tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Equipment</th><th style={S.th}>Category</th>
                      <th style={S.th}>Surface Area (in²)</th><th style={S.th}>Rinse Vol (L)</th>
                      <th style={S.th}>Swab Area (in²)</th><th style={S.th}>Rinse Area (in²)</th>
                    </tr></thead>
                    <tbody>
                      {row.shared_equipment.map((eq, i) => (
                        <tr key={i}>
                          <td style={S.td}>{eq.name}</td>
                          <td style={S.td}>{eq.category_name || "—"}</td>
                          <td style={{ ...S.td, textAlign: "center" }}>{eq.surface_area_in2 ?? "—"}</td>
                          <td style={{ ...S.td, textAlign: "center" }}>{eq.rinse_volume_L ?? "—"}</td>
                          <td style={{ ...S.td, textAlign: "center" }}>{eq.swab_area_sqin ?? "—"}</td>
                          <td style={{ ...S.td, textAlign: "center" }}>{eq.rinse_sample_area_sqin ?? "—"}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f0f4ff", fontWeight: "600" }}>
                        <td style={S.td} colSpan={2}>Total</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{row.total_area_in2?.toFixed(2) ?? "—"} in²</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{row.total_rinse_vol_L?.toFixed(2) ?? "—"} L</td>
                        <td style={S.td} colSpan={2}/>
                      </tr>
                    </tbody>
                  </table>

                  {row.scenario === "fixed_10ppm" ? (
                    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "10px 14px", margin: "12px 0 8px" }}>
                      <p style={{ margin: 0, fontSize: "12px", color: "#856404" }}>
                        <strong>Fixed 10 ppm criterion applied</strong> — MACO calculation not applicable for {r.source_category} source products.
                        Rinse and swab limits are set to <strong>10.0 ppm</strong> per cleaning policy.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p style={{ ...S.subLabel, marginTop: "12px" }}>MACO Derivation</p>
                      <table style={S.dataTable}>
                        <thead><tr style={{ background: "#e8f0fb" }}>
                          <th style={S.th}>Method</th><th style={S.th}>Formula</th>
                          <th style={S.th}>Result (mg)</th><th style={S.th}>Policy Active</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { label: "PDE Based", formula: FORMULA_TEXT.pde, val: row.maco_pde,
                              active: ["all_min","pde_only","pde_dose_min","pde_10ppm_min"].includes(r.policy) },
                            { label: "Dose Based (1/1000th)", formula: FORMULA_TEXT.dose, val: row.maco_dose,
                              active: ["all_min","dose_only","pde_dose_min"].includes(r.policy) },
                            { label: "10 ppm Criterion", formula: FORMULA_TEXT.ppm, val: row.maco_10ppm,
                              active: ["all_min","10ppm_only","pde_10ppm_min"].includes(r.policy) },
                          ].map(({ label, formula, val, active }) => (
                            <tr key={label} style={{ background: val && val === row.governing_maco_pair ? "#e8f5e9" : "white" }}>
                              <td style={S.td}>{label}</td>
                              <td style={{ ...S.td, fontFamily: "monospace", fontSize: "11px" }}>{formula}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{val ?? <em style={{ color: "#aaa" }}>N/A</em>}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>
                                {active ? <span style={S.activeMark}>✓</span> : <span style={S.inactiveMark}>—</span>}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: "#d4edda", fontWeight: "bold" }}>
                            <td style={S.td} colSpan={2}>Governing MACO (policy: {r.policy_label || r.policy})</td>
                            <td style={{ ...S.td, textAlign: "center", color: "#155724" }}>
                              {row.governing_maco_pair != null ? `${row.governing_maco_pair} mg` : "—"}
                            </td>
                            <td style={S.td}/>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Per-equipment limits breakdown — final product step only */}
                  {row.scenario !== "fixed_10ppm" && (
                    <>
                      <p style={{ ...S.subLabel, marginTop: "10px" }}>
                        Per-Equipment Limits (ppm) — Final Product Step
                      </p>
                      <p style={{ fontSize: "11px", color: "#64748b", margin: "-6px 0 6px 0" }}>
                        MACO limits are calculated for the final product step equipment. Synthesis intermediate
                        step equipment is governed by a fixed 10 ppm criterion (see below).
                      </p>
                      {row.shared_equipment.length > 0 ? (
                        <table style={S.dataTable}>
                          <thead>
                            <tr style={{ background: "#e8f0fb" }}>
                              <th style={S.th} rowSpan={2}>Equipment</th>
                              <th style={{ ...S.th, textAlign: "center" }} colSpan={4}>Rinse Limit (ppm)</th>
                              <th style={{ ...S.th, textAlign: "center" }} colSpan={4}>Swab Limit (ppm)</th>
                            </tr>
                            <tr style={{ background: "#eef2fb" }}>
                              <th style={S.th}>PDE</th><th style={S.th}>Dose</th><th style={S.th}>10ppm</th>
                              <th style={{ ...S.th, background: "#d0dff7" }}>Final</th>
                              <th style={S.th}>PDE</th><th style={S.th}>Dose</th><th style={S.th}>10ppm</th>
                              <th style={{ ...S.th, background: "#d0dff7" }}>Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.shared_equipment.map((eq, i) => {
                              const isGovRinse = eq.rinse_final != null && eq.rinse_final === row.rinse_limit_final;
                              const isGovSwab  = eq.swab_final  != null && eq.swab_final  === row.swab_limit_final;
                              return (
                                <tr key={i} style={{ background: (isGovRinse || isGovSwab) ? "#f0fdf4" : "white" }}>
                                  <td style={S.td}>
                                    {eq.name}
                                    {(isGovRinse || isGovSwab) && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#16a34a", fontWeight: "700" }}>★ Gov</span>}
                                  </td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.rinse_pde, eq.rinse_pde_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.rinse_dose, eq.rinse_dose_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.rinse_10ppm, eq.rinse_10ppm_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center", fontWeight: "600", background: isGovRinse ? "#d4edda" : "#e8f0fe" }}>{eq.rinse_final ?? "—"}</td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.swab_pde, eq.swab_pde_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.swab_dose, eq.swab_dose_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(eq.swab_10ppm, eq.swab_10ppm_raw)}</td>
                                  <td style={{ ...S.td, textAlign: "center", fontWeight: "600", background: isGovSwab ? "#d4edda" : "#e8f0fe" }}>{eq.swab_final ?? "—"}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ background: "#d4edda", fontWeight: "700" }}>
                              <td style={S.td}>Governing (min across equipment)</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_pde, row.rinse_limit_pde_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_dose, row.rinse_limit_dose_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_10ppm, row.rinse_limit_10ppm_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center", background: "#b7e1cd" }}>{row.rinse_limit_final ?? "—"}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_pde, row.swab_limit_pde_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_dose, row.swab_limit_dose_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_10ppm, row.swab_limit_10ppm_raw)}</td>
                              <td style={{ ...S.td, textAlign: "center", background: "#b7e1cd" }}>{row.swab_limit_final ?? "—"}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>
                          No final-product-step equipment shared with this target.
                        </p>
                      )}

                      {/* Synthesis step equipment — fixed 10 ppm, grouped by step / test compound */}
                      {(row.synthesis_step_equipment || []).length > 0 && (
                        <>
                          <p style={{ ...S.subLabel, marginTop: "12px" }}>
                            Synthesis Intermediate Steps — Fixed 10 ppm
                          </p>
                          <p style={{ fontSize: "11px", color: "#64748b", margin: "-6px 0 8px 0" }}>
                            Equipment used exclusively in synthesis intermediate steps is governed by the fixed
                            10 ppm criterion. Each step is tested for its specific intermediate compound during
                            changeover cleaning.
                          </p>
                          {row.synthesis_step_equipment.map((stepGrp, si) => (
                            <div key={si} style={{ marginBottom: "10px", border: "1px solid #fed7aa", borderRadius: "6px", overflow: "hidden" }}>
                              <div style={{ background: "#fff7ed", padding: "7px 12px", borderBottom: "1px solid #fed7aa",
                                display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontWeight: "700", fontSize: "12px", color: "#9a3412" }}>
                                  Step {stepGrp.step_number}
                                </span>
                                <span style={{ fontSize: "12px", color: "#7c3aed" }}>
                                  Test Compound: <strong>{stepGrp.test_compound || "—"}</strong>
                                </span>
                                <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9a3412", fontWeight: "600" }}>
                                  Limit: 10 ppm (Rinse &amp; Swab)
                                </span>
                              </div>
                              <table style={{ ...S.dataTable, margin: 0 }}>
                                <thead><tr style={{ background: "#fff7ed" }}>
                                  <th style={S.th}>Equipment</th>
                                  <th style={S.th}>Category</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Surface Area (in²)</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Rinse Vol (L)</th>
                                  <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Rinse Limit (ppm)</th>
                                  <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Swab Limit (ppm)</th>
                                </tr></thead>
                                <tbody>
                                  {stepGrp.equipment.map((eq, ei) => (
                                    <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#fffbf5" }}>
                                      <td style={S.td}>{eq.name}</td>
                                      <td style={S.td}>{eq.category_name || "—"}</td>
                                      <td style={{ ...S.td, textAlign: "center" }}>{eq.surface_area_in2 ?? "—"}</td>
                                      <td style={{ ...S.td, textAlign: "center" }}>{eq.rinse_volume_L ?? "—"}</td>
                                      <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#9a3412" }}>10.0</td>
                                      <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#9a3412" }}>10.0</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </>}
              <p style={{ ...S.subLabel, marginTop: "12px" }}>Acceptance Criteria (Governing — minimum across all equipment &amp; methods)</p>
              <table style={S.dataTable}>
                <thead><tr style={{ background: "#e8f0fb" }}>
                  <th style={S.th}>Criterion</th>
                  {row.scenario !== "fixed_10ppm" && <>
                    <th style={S.th}>PDE (ppm)</th>
                    <th style={S.th}>Dose (ppm)</th>
                    <th style={S.th}>10 ppm (ppm)</th>
                  </>}
                  <th style={{ ...S.th, background: "#d0dff7" }}>Final Limit (ppm)</th>
                  <th style={S.th}>LOQ (ppm)</th>
                  <th style={S.th}>Status</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={S.td}>Rinse Limit</td>
                    {row.scenario !== "fixed_10ppm" && <>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_pde, row.rinse_limit_pde_raw)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_dose, row.rinse_limit_dose_raw)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.rinse_limit_10ppm, row.rinse_limit_10ppm_raw)}</td>
                    </>}
                    <td style={{ ...S.td, textAlign: "center", fontWeight: "bold", background: "#e8f0fe" }}>{row.rinse_limit_final ?? "—"}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{row.loq_ppm ?? r.loq_ppm ?? "—"}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{passFailBadge(row.rinse_limit_final, row.loq_ppm || r.loq_ppm)}</td>
                  </tr>
                  <tr>
                    <td style={S.td}>Swab Limit</td>
                    {row.scenario !== "fixed_10ppm" && <>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_pde, row.swab_limit_pde_raw)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_dose, row.swab_limit_dose_raw)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>{fmtLimit(row.swab_limit_10ppm, row.swab_limit_10ppm_raw)}</td>
                    </>}
                    <td style={{ ...S.td, textAlign: "center", fontWeight: "bold", background: "#e8f0fe" }}>{row.swab_limit_final ?? "—"}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{row.loq_ppm ?? r.loq_ppm ?? "—"}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{passFailBadge(row.swab_limit_final, row.loq_ppm || r.loq_ppm)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* § 5 Governing limit */}
        {(() => {
          // Final-product equipment: collect unique equipment from shared_equipment across all pairs,
          // taking the minimum (most conservative) limit across all target products.
          const eqLimitsMap = {};
          (r.data || []).forEach(row => {
            (row.shared_equipment || []).forEach(eq => {
              if (!eqLimitsMap[eq.name])
                eqLimitsMap[eq.name] = { name: eq.name, category_name: eq.category_name || "—", rinse_final: null, swab_final: null };
              const eqRinse = eq.rinse_final ?? row.rinse_limit_final ?? null;
              const eqSwab  = eq.swab_final  ?? row.swab_limit_final  ?? null;
              if (eqRinse != null && (eqLimitsMap[eq.name].rinse_final === null || eqRinse < eqLimitsMap[eq.name].rinse_final))
                eqLimitsMap[eq.name].rinse_final = eqRinse;
              if (eqSwab != null && (eqLimitsMap[eq.name].swab_final === null || eqSwab < eqLimitsMap[eq.name].swab_final))
                eqLimitsMap[eq.name].swab_final = eqSwab;
            });
          });
          const finalProductLimits = Object.values(eqLimitsMap);

          // Synthesis step groups from the top-level r.synthesis_steps (all source equipment, not just shared)
          const synthSteps = r.synthesis_steps || [];

          return (
            <div style={S.section} className="doc-section">
              <p style={S.sectionTitle}>5. Governing Cleaning Limit</p>
              {r.scenario === "fixed_10ppm" ? (
                <>
                  <div style={{ background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
                      <div>
                        <p style={S.govLabel}>Criterion</p>
                        <p style={{ ...S.govValue, color: "#b45309" }}>Fixed 10 ppm</p>
                      </div>
                      <div>
                        <p style={S.govLabel}>Source Category</p>
                        <p style={{ ...S.govValue, fontSize: "13px" }}>{r.source_category || "Intermediate / KSM"}</p>
                      </div>
                      <div>
                        <p style={S.govLabel}>Analytical Method</p>
                        <p style={{ ...S.govValue, fontSize: "13px" }}>{r.analytical_method || "—"}</p>
                      </div>
                    </div>
                  </div>
                  <p style={S.para}>For <strong>{r.source_category || "Intermediate/KSM"}</strong> source products, MACO calculation is
                    not required. The governing limit is set at the fixed threshold of <strong>10 ppm</strong> for both rinse and swab
                    acceptance criteria in accordance with regulatory guideline. The limits must be detectable by the{" "}
                    <strong>{r.analytical_method || "specified"}</strong> method
                    (LOQ: {r.loq_ppm} ppm, LOD: {r.lod_ppm} ppm).</p>
                </>
              ) : (
                <>
                  <div style={S.governingBox} className="governing-box">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
                      <div><p style={S.govLabel}>Governing MACO</p><p style={S.govValue}>{r.governing_maco ?? "—"} mg</p></div>
                      <div><p style={S.govLabel}>Calculation Policy</p><p style={{ ...S.govValue, fontSize: "13px" }}>{r.policy_label || r.policy}</p></div>
                      <div><p style={S.govLabel}>Analytical Method</p><p style={{ ...S.govValue, fontSize: "13px" }}>{r.analytical_method || "—"}</p></div>
                    </div>
                  </div>
                  <p style={S.para}>The governing MACO of <strong>{r.governing_maco ?? "—"} mg</strong> represents the most
                    restrictive cleaning limit across all product pairs. This value shall be used as the acceptance criterion
                    for cleaning verification. The limits must be detectable by the <strong>{r.analytical_method || "specified"}</strong> method
                    (LOQ: {r.loq_ppm} ppm, LOD: {r.lod_ppm} ppm).</p>
                </>
              )}

              {/* Final product step equipment limits */}
              {finalProductLimits.length > 0 && (
                <>
                  <p style={{ ...S.subLabel, marginTop: "14px" }}>
                    Final Product Step — Finalized Limits per Equipment&nbsp;—&nbsp;
                    <em style={{ fontWeight: "normal", color: "#64748b" }}>
                      {r.scenario === "fixed_10ppm"
                        ? "fixed 10 ppm applied uniformly"
                        : "most conservative MACO limit across all target products"}
                    </em>
                  </p>
                  <table style={S.dataTable}>
                    <thead>
                      <tr style={{ background: "#e8f0fb" }}>
                        <th style={S.th}>Equipment</th>
                        <th style={S.th}>Category</th>
                        <th style={{ ...S.th, textAlign: "center" }}>Rinse Limit (ppm)</th>
                        <th style={{ ...S.th, textAlign: "center" }}>Swab Limit (ppm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalProductLimits.map((eq, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                          <td style={S.td}>{eq.name}</td>
                          <td style={S.td}>{eq.category_name}</td>
                          <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#1d4ed8" }}>{eq.rinse_final ?? "—"}</td>
                          <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#1d4ed8" }}>{eq.swab_final ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Synthesis intermediate step equipment — fixed 10 ppm, grouped by step / test compound */}
              {synthSteps.length > 0 && (
                <>
                  <p style={{ ...S.subLabel, marginTop: "16px" }}>
                    Synthesis Intermediate Steps — Fixed 10 ppm Cleaning Limits
                  </p>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "-6px 0 10px 0" }}>
                    Equipment used exclusively in synthesis intermediate steps is governed by the fixed 10 ppm criterion.
                    Each step must be verified against its specific intermediate compound during changeover cleaning.
                  </p>
                  {synthSteps.map((stepGrp, si) => (
                    <div key={si} style={{ marginBottom: "12px", border: "1px solid #fed7aa", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#fff7ed", padding: "8px 14px", borderBottom: "1px solid #fed7aa",
                        display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "700", fontSize: "12px", color: "#9a3412", minWidth: "56px" }}>
                          Step {stepGrp.step_number}
                        </span>
                        <span style={{ fontSize: "12px", color: "#7c3aed" }}>
                          Test Compound: <strong>{stepGrp.test_compound || "—"}</strong>
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "700",
                          background: "#fed7aa", color: "#9a3412", padding: "2px 10px", borderRadius: "4px" }}>
                          Limit: 10.0 ppm (Rinse &amp; Swab)
                        </span>
                      </div>
                      <table style={{ ...S.dataTable, margin: 0 }}>
                        <thead><tr style={{ background: "#fff7ed" }}>
                          <th style={S.th}>Equipment</th>
                          <th style={S.th}>Category</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Surface Area (in²)</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Rinse Vol (L)</th>
                          <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Rinse Limit (ppm)</th>
                          <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Swab Limit (ppm)</th>
                        </tr></thead>
                        <tbody>
                          {(stepGrp.equipment || []).map((eq, ei) => (
                            <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#fffbf5" }}>
                              <td style={S.td}>{eq.name}</td>
                              <td style={S.td}>{eq.category_name || "—"}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{eq.surface_area_in2 ?? "—"}</td>
                              <td style={{ ...S.td, textAlign: "center" }}>{eq.rinse_volume_L ?? "—"}</td>
                              <td style={{ ...S.td, textAlign: "center", fontWeight: "700", color: "#9a3412" }}>10.0</td>
                              <td style={{ ...S.td, textAlign: "center", fontWeight: "700", color: "#9a3412" }}>10.0</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })()}

        {/* § 6 Conclusion */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>6. Conclusion</p>
          {r.scenario === "fixed_10ppm" ? (
            <p style={S.para}>The cleaning limits for <strong>{r.source}</strong> ({r.source_category || "Intermediate/KSM"}) have been
              determined by applying the <strong>Fixed 10 ppm criterion</strong>, as MACO calculation is not required for
              Intermediate/KSM source products. All rinse and swab acceptance limits are set at <strong>10.0 ppm</strong>.
              {r.data.length > 0
                ? ` A total of ${r.data.length} target product(s) were evaluated across shared equipment.`
                : " No target products sharing equipment were identified in this facility."}
              {" "}The limits must be analytically detectable by the <strong>{r.analytical_method || "specified"}</strong> method
              (LOQ: {r.loq_ppm} ppm, LOD: {r.lod_ppm} ppm).</p>
          ) : (
            <p style={S.para}>The cleaning limits for <strong>{r.source}</strong> have been calculated using the
              <strong> {r.policy_label || r.policy}</strong> approach. The governing MACO is <strong>{r.governing_maco ?? "—"} mg</strong>.
              {r.data.length > 0
                ? ` A total of ${r.data.length} target product(s) were evaluated across shared equipment.`
                : " No target products sharing equipment were identified in this facility."}
              {" "}The calculated limits are analytically detectable and meet acceptance criteria as outlined in Section 4.</p>
          )}
        </div>

        {/* § 7 Sampling Plan */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>7. Swab Sampling Plan</p>
          <p style={S.para}>The following swab sampling locations are defined for each equipment category present in this
            protocol. All samples shall be collected after the cleaning procedure and before the next product manufacture.</p>
          {relevantPlan.length === 0
            ? <p style={{ color: "#888", fontStyle: "italic", fontSize: "12px" }}>
                No sampling plan configured. Configure locations in the Protocol &amp; Report page (Sampling Plan tab).
              </p>
            : relevantPlan.map(cat => (
              <div key={cat.category_id} className="sampling-cat-block"
                style={{ marginBottom: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ background: "#004f9f", color: "white", padding: "8px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px" }}>{cat.category_name}</span>
                  <span style={{ fontSize: "11px", opacity: 0.85 }}>{cat.entries.length} swab sample{cat.entries.length !== 1 ? "s" : ""}</span>
                </div>
                <table style={{ ...S.dataTable, margin: 0 }}>
                  <thead><tr style={{ background: "#e8f0fb" }}>
                    <th style={{ ...S.th, width: "120px" }}>Sample No.</th>
                    <th style={S.th}>Location / Description</th>
                  </tr></thead>
                  <tbody>
                    {cat.entries.map((entry, i) => (
                      <tr key={entry.entry_id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ ...S.td, fontFamily: "monospace", fontWeight: "bold", color: "#004f9f" }}>
                          {entry.sample_number}
                        </td>
                        <td style={S.td}>{entry.location_description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>

        {/* Signatures */}
        <div style={S.sigGrid} className="sig-grid-print">
          {["Prepared By", "Reviewed By", "Approved By"].map(lbl => (
            <div key={lbl} style={S.sigBox}>
              <p style={{ margin: "0 0 30px", fontSize: "12px", color: "#333" }}>{lbl}</p>
              <div style={{ borderBottom: "1px solid #333", marginBottom: "4px" }}/>
              <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>Name / Date / Signature</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.docFooter} className="doc-footer">
          <span>Falcon — Confidential | Periodic Cleaning Verification Protocol</span>
          <span>{displayDocNumber}{archiveDoc ? ` v${archiveDoc.meta.version}` : ""}</span>
          <span>Generated by: {archiveDoc ? archiveDoc.meta.generated_by : currentUser}</span>
        </div>
      </div>
    );
  };

  // ── Archived report renderer ───────────────────────────────────────
  const renderArchivedReport = () => {
    if (!viewingReport?.results_data) return null;
    const { results_data, product_name, facility_name, submitted_by, submitted_at,
            last_modified_by, last_modified_at,
            protocol_generated_at, doc_number } = viewingReport;
    const runs = results_data.runs || [];
    const equipmentList = runs[0]?.equipment_results || [];
    // Fall back to protocol approval date for old reports that predate the field
    const startDate = results_data.start_date || protocol_generated_at || "";
    const completionDate = results_data.completion_date || "";

    return (
      <div ref={reportPrintRef} style={{ background: "white", boxShadow: "0 4px 28px rgba(0,0,0,0.32)", minHeight: "1123px" }}>

        {/* Doc header */}
        <div style={S.docHeader} className="doc-header">
          <img src={logo} alt="Falcon" style={{ width: 70 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={S.docTitle}>PCV Validation Report</h3>
                <p style={S.docSub}>Archived Report — {product_name}</p>
              </div>
              <table style={S.metaTable}><tbody>
                <tr><td style={S.metaKey}>Product</td><td style={S.metaVal}>{product_name}</td></tr>
                <tr><td style={S.metaKey}>Facility</td><td style={S.metaVal}>{facility_name}</td></tr>
                {doc_number && <tr><td style={S.metaKey}>Protocol Ref.</td><td style={S.metaVal}>{doc_number}</td></tr>}
                <tr><td style={S.metaKey}>Submitted By</td><td style={S.metaVal}>{submitted_by}</td></tr>
                <tr><td style={S.metaKey}>Date</td><td style={S.metaVal}>{new Date(submitted_at).toLocaleDateString("en-IN")}</td></tr>
              </tbody></table>
            </div>
          </div>
        </div>

        {/* § 1 Report Details */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>1. Report Details</p>
          <table style={S.dataTable}><tbody>
            <tr>
              <td style={S.tdKey}>Product</td><td style={S.tdVal}><strong>{product_name}</strong></td>
              <td style={S.tdKey}>Facility</td><td style={S.tdVal}>{facility_name}</td>
            </tr>
            <tr>
              <td style={S.tdKey}>Validation Start Date</td>
              <td style={S.tdVal}>{startDate ? new Date(startDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}</td>
              <td style={S.tdKey}>Completion Date (Run)</td>
              <td style={S.tdVal}>{completionDate ? new Date(completionDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}</td>
            </tr>
            <tr>
              <td style={S.tdKey}>Submitted By</td><td style={S.tdVal}>{submitted_by}</td>
              <td style={S.tdKey}>Submitted At</td><td style={S.tdVal}>{new Date(submitted_at).toLocaleDateString("en-IN")}</td>
            </tr>
            {last_modified_by && (
              <tr>
                <td style={S.tdKey}>Last Modified By</td><td style={S.tdVal}>{last_modified_by}</td>
                <td style={S.tdKey}>Last Modified At</td><td style={S.tdVal}>{new Date(last_modified_at).toLocaleDateString("en-IN")}</td>
              </tr>
            )}
          </tbody></table>
        </div>

        {/* § 2 Batch Numbers */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>2. Batch Numbers</p>
          <div style={{ display: "flex", gap: "16px" }}>
            {runs.map((run, ri) => (
              <div key={ri} style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 14px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.4px" }}>Run-{run.run_number}</p>
                <p style={{ margin: "4px 0 0", fontWeight: "bold", color: "#004f9f", fontSize: "14px" }}>{run.batch_number || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* § 3 Results */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>3. Cleaning Validation Results</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#004f9f", color: "white" }}>
                  <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle", color: "white" }}>Equipment</th>
                  <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle", color: "white" }}>Sample</th>
                  <th rowSpan={2} style={{ ...sampCell, textAlign: "center", verticalAlign: "middle", color: "white" }}>Limit (ppm)</th>
                  {runs.map(run => (
                    <th key={run.run_number} colSpan={3} style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8", color: "white" }}>
                      Run-{run.run_number}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: "#1a6bbd", color: "white" }}>
                  {runs.map(run => (
                    <React.Fragment key={run.run_number}>
                      <th style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8", fontWeight: "normal", color: "white" }}>Insp. Lot No.</th>
                      <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal", color: "white" }}>Result (ppm)</th>
                      <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal", color: "white" }}>Status</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipmentList.map((eq, equipIdx) => {
                  const isSynth = eq.eq_type === "synthesis";
                  const isFirstSynth = isSynth && (equipIdx === 0 || equipmentList[equipIdx - 1]?.eq_type !== "synthesis");
                  const rowCount = 1 + (eq.swab_results?.length || 0);
                  const bg = isSynth ? "#fffbf5" : (equipIdx % 2 === 0 ? "white" : "#f8fafc");
                  return (
                    <React.Fragment key={equipIdx}>
                      {isFirstSynth && (
                        <tr>
                          <td colSpan={3 + runs.length * 3} style={{
                            padding: "6px 12px",
                            background: "#fff7ed",
                            borderTop: "2px solid #f97316",
                            borderBottom: "1px solid #fed7aa",
                            fontWeight: "700",
                            fontSize: "11px",
                            color: "#9a3412",
                            letterSpacing: "0.4px",
                          }}>
                            Synthesis Intermediate Steps — Fixed 10 ppm Criterion
                          </td>
                        </tr>
                      )}
                      <tr style={{ background: bg }}>
                        <td rowSpan={rowCount} style={{ ...sampCell, fontWeight: "600", verticalAlign: "middle", borderRight: "2px solid #c7d9f7", background: isSynth ? "#fffbf5" : undefined }}>
                          {eq.equipment_name}
                          {eq.category_name && <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>}
                          {isSynth && (
                            <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>
                              Synthesis Step — Fixed 10 ppm
                            </div>
                          )}
                        </td>
                        <td style={sampCell}>Rinse</td>
                        <td style={{ ...sampCell, textAlign: "center" }}>{eq.rinse_limit_ppm ?? "—"}</td>
                        {runs.map((run, runIdx) => {
                          const runEq = run.equipment_results[equipIdx];
                          const rinseStatus = compareResultToLimit(runEq?.rinse_result_ppm, runEq?.rinse_limit_ppm);
                          return (
                            <React.Fragment key={runIdx}>
                              <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>{runEq?.rinse_lot_number || "—"}</td>
                              <td style={{ ...sampCell, textAlign: "center" }}>{runEq?.rinse_result_ppm || "—"}</td>
                              <td style={{ ...sampCell, textAlign: "center" }}>{statusBadge(rinseStatus)}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                      {(eq.swab_results || []).map((swab, swabIdx) => (
                        <tr key={swabIdx} style={{ background: bg }}>
                          <td style={{ ...sampCell, color: isSynth ? "#7c2d12" : "#444" }}>
                            <span style={{ fontWeight: "600", color: isSynth ? "#9a3412" : "#004f9f" }}>{swab.sample_number}</span>
                            {" — "}{swab.location_description}
                          </td>
                          <td style={{ ...sampCell, textAlign: "center" }}>{eq.swab_limit_ppm ?? "—"}</td>
                          {runs.map((run, runIdx) => {
                            const runEq = run.equipment_results[equipIdx];
                            const runSwab = runEq?.swab_results?.[swabIdx];
                            const swabStatus = compareResultToLimit(runSwab?.result_ppm, runEq?.swab_limit_ppm);
                            return (
                              <React.Fragment key={runIdx}>
                                <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>{runSwab?.lot_number || "—"}</td>
                                <td style={{ ...sampCell, textAlign: "center" }}>{runSwab?.result_ppm || "—"}</td>
                                <td style={{ ...sampCell, textAlign: "center" }}>{statusBadge(swabStatus)}</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* § 4 Training & Compliance */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>4. Training &amp; Compliance</p>
          <table style={S.dataTable}><tbody>
            <tr>
              <td style={{ ...S.tdKey, width: "180px" }}>Training Details</td>
              <td style={S.tdVal}>{results_data.training_details || "—"}</td>
            </tr>
            <tr>
              <td style={S.tdKey}>SOP Followed</td>
              <td style={S.tdVal}>{results_data.sop_followed || "—"}</td>
            </tr>
          </tbody></table>
        </div>

        {/* Signatures */}
        <div style={S.sigGrid} className="sig-grid-print">
          {["Prepared By", "Reviewed By", "Approved By"].map(lbl => (
            <div key={lbl} style={S.sigBox}>
              <p style={{ margin: "0 0 30px", fontSize: "12px", color: "#333" }}>{lbl}</p>
              <div style={{ borderBottom: "1px solid #333", marginBottom: "4px" }}/>
              <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>Name / Date / Signature</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.docFooter} className="doc-footer">
          <span>Falcon — Confidential | PCV Validation Report</span>
          <span>{product_name} — {facility_name}</span>
          <span>Submitted by: {submitted_by}</span>
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      <div style={S.pageHeader}>
        <h2 style={{ margin: 0 }}>Periodic Cleaning Validation Protocol & Report</h2>
        <button onClick={goHome} style={S.backBtn}>Back to Home</button>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {[["protocol","Protocol"],["archive","Archive"],["report","Report"]].map(([t,label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={activeTab === t ? S.tabActive : S.tabInactive}>{label}</button>
        ))}
      </div>

      {/* ── PROTOCOL TAB ─────────────────────────────────────── */}
      {activeTab === "protocol" && (
        <div>
          {!archiveDoc ? (
            <div style={S.filterCard}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
                <div>
                  <label style={S.filterLabel}>Facility</label>
                  <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} style={S.select}>
                    <option value="">Select Facility</option>
                    {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.filterLabel}>Source Product (Previous Product)</label>
                  <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                    style={S.select} disabled={!selectedFacility}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                  </select>
                </div>
                {role === "VIEWER"
                  ? <p style={{ margin:0, fontSize:"13px", color:"#856404", background:"#fff3cd", padding:"8px 12px", borderRadius:"6px" }}>
                      Viewer role cannot generate protocols.
                    </p>
                  : <button onClick={generate} disabled={loading || !selectedProduct}
                      style={loading || !selectedProduct ? S.genBtnDisabled : S.genBtn}>
                      {loading ? "Generating..." : "Generate Protocol"}
                    </button>
                }
                {result && (
                  <>
                    <button onClick={handlePrint} style={S.printBtn}>Print / Export PDF</button>
                    {role !== "VIEWER" && (
                      <button onClick={() => { setSaveStatus("Draft"); setShowSaveModal(true); }} style={S.archiveBtn}>
                        💾 Save to Archive
                      </button>
                    )}
                  </>
                )}
              </div>
              {policy && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#555" }}>
                  Active policy: <strong style={{ color: "#004f9f" }}>{policy.description}</strong>
                </div>
              )}
            </div>
          ) : (
            <div style={S.filterCard}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={handlePrint} style={S.printBtn}>Print / Export PDF</button>
                <button onClick={() => setArchiveDoc(null)} style={S.backBtn}>← Back to Generator</button>
                <span style={{ fontSize: "12px", color: "#888" }}>Viewing archived version — data is frozen at time of generation</span>
              </div>
            </div>
          )}

          {!displayResult && !loading && (
            <div style={S.emptyState}>
              <p style={{ margin: 0, color: "#888" }}>
                Select a facility and source product, then click <strong>Generate Protocol</strong>.
              </p>
            </div>
          )}

          {displayResult && (
            <div style={{ background: "#c8cdd6", padding: "28px 0 40px", margin: "0 -20px" }}>
              <div style={{ maxWidth: "794px", margin: "0 auto", padding: "0 16px" }}>
                {renderProtocolDoc()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ARCHIVE TAB ──────────────────────────────────────── */}
      {activeTab === "archive" && (
        <div style={{ background: "white", borderRadius: "0 10px 10px 10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, color: "#004f9f" }}>Protocol Archive</h3>
            <button onClick={loadArchives} style={S.refreshBtn}>🔄 Refresh</button>
          </div>
          {archiveLoading ? <p style={{ color: "#888" }}>Loading…</p>
          : archiveList.length === 0
            ? <div style={{ textAlign: "center", padding: "48px 24px", color: "#888" }}>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}>No archived protocols yet.</p>
                <p style={{ fontSize: "13px" }}>Generate a protocol and click <strong>Save to Archive</strong>.</p>
              </div>
            : <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#004f9f", color: "white" }}>
                      {["Document No.","Ver.","Product","Facility","Generated By","Date","Status","Actions"].map(h => (
                        <th key={h} style={archCell}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archiveList.map((a, i) => (
                      <tr key={a.archive_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                        <td style={archCell}><code style={{ fontSize: "12px", color: "#004f9f" }}>{a.doc_number}</code></td>
                        <td style={{ ...archCell, textAlign: "center" }}>
                          <span style={{ background: "#e8f0fe", color: "#1a56db", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", fontSize: "12px" }}>
                            v{a.version}</span>
                        </td>
                        <td style={archCell}>{a.product_name}</td>
                        <td style={archCell}>{a.facility_name}</td>
                        <td style={archCell}>{a.generated_by}</td>
                        <td style={archCell}>{new Date(a.generated_at).toLocaleDateString("en-IN")}</td>
                        <td style={{ ...archCell, textAlign: "center" }}>
                          <span style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold",
                            background: a.status === "Final" ? "#d4edda" : "#fff3cd",
                            color:      a.status === "Final" ? "#155724" : "#856404" }}>{a.status}</span>
                        </td>
                        <td style={archCell}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button onClick={() => viewArchive(a.archive_id)} style={S.viewBtn}>View</button>
                            {role !== "VIEWER" && (
                              <button onClick={() => { setSelectedArchive(a); setDeleteArchivePassword(""); setShowDeleteArchiveModal(true); }}
                                style={S.deleteBtn}>Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* ── REPORT TAB ───────────────────────────────────────── */}
      {activeTab === "report" && (
        <div style={{ background: "white", borderRadius: "0 10px 10px 10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {!viewingReport ? (
            <>
              <h3 style={{ color: "#004f9f", marginTop: 0 }}>Create Periodic Cleaning Verification Report</h3>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "20px" }}>
                <div>
                  <label style={S.filterLabel}>Facility</label>
                  <select value={reportFacility} onChange={e => setReportFacility(e.target.value)} style={S.select}>
                    <option value="">Select Facility</option>
                    {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.filterLabel}>Product</label>
                  <select value={reportProduct} onChange={e => setReportProduct(e.target.value)}
                    style={S.select} disabled={!reportFacility}>
                    <option value="">Select Product</option>
                    {reportProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.filterLabel}>Approved Protocol</label>
                  <select value={selectedProtocol?.archive_id || ""} onChange={e => {
                    const proto = approvedProtocols.find(p => p.archive_id === parseInt(e.target.value));
                    if (proto) handleProtocolSelect(proto);
                  }} style={S.select} disabled={!reportProduct || protocolsLoading}>
                    <option value="">Select Protocol</option>
                    {approvedProtocols.map(p => <option key={p.archive_id} value={p.archive_id}>
                      {p.doc_number} v{p.version} — {new Date(p.generated_at).toLocaleDateString("en-IN")}
                    </option>)}
                  </select>
                </div>
              </div>

              {protocolsNotice && (
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#856404" }}>
                  ⚠ {protocolsNotice}
                </div>
              )}

              {selectedProtocol && (
                <>
                  <div style={{ background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "6px", padding: "10px 14px", marginBottom: "20px" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#004f9f" }}>
                      <strong>Selected Protocol:</strong> {selectedProtocol.doc_number} v{selectedProtocol.version} · {selectedProtocol.status}
                    </p>
                  </div>

                  {/* Save draft reminder */}
                  <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 14px", marginBottom: "16px", fontSize: "12px", color: "#92400e", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>💾</span>
                    <span>Use <strong>Save Draft</strong> regularly to avoid losing your data.</span>
                  </div>

                  {/* Batch numbers — one input per run side by side */}
                  <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                    {runResults.map((run, runIdx) => (
                      <div key={runIdx} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                        <div style={{ background: "#004f9f", color: "white", padding: "8px 12px", fontWeight: "bold", fontSize: "12px" }}>
                          Run-{run.run_number}
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <label style={{ ...S.label, marginBottom: "4px" }}>Batch Number *</label>
                          <input value={run.batch_number}
                            onChange={e => handleRunResultChange(runIdx, 0, "batch_number", e.target.value)}
                            placeholder="e.g. B-2025-001" style={{ ...S.input, marginBottom: 0 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Combined results table */}
                  {runResults[0]?.equipment_results.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No equipment configured for this protocol.</p>
                  ) : (
                    <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: "#004f9f", color: "white" }}>
                            <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle" }}>Equipment</th>
                            <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle" }}>Sample</th>
                            <th rowSpan={2} style={{ ...sampCell, textAlign: "center", verticalAlign: "middle" }}>Limit (ppm)</th>
                            {runResults.map(run => (
                              <th key={run.run_number} colSpan={3} style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8" }}>
                                Run-{run.run_number}
                              </th>
                            ))}
                          </tr>
                          <tr style={{ background: "#1a6bbd", color: "white" }}>
                            {runResults.map(run => (
                              <React.Fragment key={run.run_number}>
                                <th style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8", fontWeight: "normal" }}>Insp. Lot No.</th>
                                <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal" }}>Result (ppm)</th>
                                <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal" }}>Status</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {runResults[0].equipment_results.map((eq, equipIdx) => {
                            const isSynth = eq.eq_type === "synthesis";
                            const isFirstSynth = isSynth && (equipIdx === 0 || runResults[0].equipment_results[equipIdx - 1]?.eq_type !== "synthesis");
                            const rowCount = 1 + (eq.swab_results?.length || 0);
                            const bg = isSynth ? "#fffbf5" : (equipIdx % 2 === 0 ? "white" : "#f8fafc");
                            return (
                              <React.Fragment key={equipIdx}>
                                {isFirstSynth && (
                                  <tr>
                                    <td colSpan={3 + runResults.length * 3} style={{
                                      padding: "6px 12px",
                                      background: "#fff7ed",
                                      borderTop: "2px solid #f97316",
                                      borderBottom: "1px solid #fed7aa",
                                      fontWeight: "700",
                                      fontSize: "11px",
                                      color: "#9a3412",
                                      letterSpacing: "0.4px",
                                    }}>
                                      Synthesis Intermediate Steps — Fixed 10 ppm Criterion
                                    </td>
                                  </tr>
                                )}
                                {/* Rinse row */}
                                <tr style={{ background: bg }}>
                                  <td rowSpan={rowCount} style={{ ...sampCell, fontWeight: "600", verticalAlign: "middle", borderRight: "2px solid #c7d9f7", background: isSynth ? "#fffbf5" : undefined }}>
                                    {eq.equipment_name}
                                    {eq.category_name && <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>}
                                    {isSynth && (
                                      <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>
                                        Synthesis Step — Fixed 10 ppm
                                      </div>
                                    )}
                                  </td>
                                  <td style={sampCell}>Rinse</td>
                                  <td style={{ ...sampCell, textAlign: "center" }}>{eq.rinse_limit_ppm ?? "—"}</td>
                                  {runResults.map((run, runIdx) => {
                                    const runEq = run.equipment_results[equipIdx];
                                    const rinseStatus = compareResultToLimit(runEq?.rinse_result_ppm, runEq?.rinse_limit_ppm);
                                    return (
                                      <React.Fragment key={runIdx}>
                                        <td style={{ ...sampCell, borderLeft: "2px solid #e2e8f0" }}>
                                          <input placeholder="Lot No." value={runEq?.rinse_lot_number || ""}
                                            onChange={e => handleRunResultChange(runIdx, equipIdx, "rinse_lot_number", e.target.value)}
                                            style={{ width: "75px", padding: "3px", borderRadius: "4px", border: "1px solid #ccc", textAlign: "center", fontSize: "11px" }} />
                                        </td>
                                        <td style={{ ...sampCell }}>
                                          <input type="number" step="0.01" placeholder="—"
                                            value={runEq?.rinse_result_ppm || ""}
                                            onChange={e => handleRunResultChange(runIdx, equipIdx, "rinse_result_ppm", e.target.value)}
                                            style={{ width: "65px", padding: "3px", borderRadius: "4px", border: "1px solid #ccc", textAlign: "center" }} />
                                        </td>
                                        <td style={{ ...sampCell, textAlign: "center" }}>{statusBadge(rinseStatus)}</td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                                {/* Swab rows */}
                                {(eq.swab_results || []).map((swab, swabIdx) => (
                                  <tr key={swabIdx} style={{ background: bg }}>
                                    <td style={{ ...sampCell, color: isSynth ? "#7c2d12" : "#444" }}>
                                      <span style={{ fontWeight: "600", color: isSynth ? "#9a3412" : "#004f9f" }}>{swab.sample_number}</span>
                                      {" — "}{swab.location_description}
                                    </td>
                                    <td style={{ ...sampCell, textAlign: "center" }}>{eq.swab_limit_ppm ?? "—"}</td>
                                    {runResults.map((run, runIdx) => {
                                      const runEq = run.equipment_results[equipIdx];
                                      const runSwab = runEq?.swab_results?.[swabIdx];
                                      const swabStatus = compareResultToLimit(runSwab?.result_ppm, runEq?.swab_limit_ppm);
                                      return (
                                        <React.Fragment key={runIdx}>
                                          <td style={{ ...sampCell, borderLeft: "2px solid #e2e8f0" }}>
                                            <input placeholder="Lot No." value={runSwab?.lot_number || ""}
                                              onChange={e => handleRunResultChange(runIdx, equipIdx, "swab_lot_number", e.target.value, swabIdx)}
                                              style={{ width: "75px", padding: "3px", borderRadius: "4px", border: "1px solid #ccc", textAlign: "center", fontSize: "11px" }} />
                                          </td>
                                          <td style={sampCell}>
                                            <input type="number" step="0.01" placeholder="—"
                                              value={runSwab?.result_ppm || ""}
                                              onChange={e => handleRunResultChange(runIdx, equipIdx, "swab_result_ppm", e.target.value, swabIdx)}
                                              style={{ width: "65px", padding: "3px", borderRadius: "4px", border: "1px solid #ccc", textAlign: "center" }} />
                                          </td>
                                          <td style={{ ...sampCell, textAlign: "center" }}>{statusBadge(swabStatus)}</td>
                                        </React.Fragment>
                                      );
                                    })}
                                  </tr>
                                ))}
                                {eq.swab_results?.length === 0 && (
                                  <tr style={{ background: bg }}>
                                    <td colSpan={3 + runResults.length * 3} style={{ ...sampCell, color: "#999", fontStyle: "italic" }}>
                                      No swab locations in sampling plan for this category.
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", marginBottom: "20px" }}>

                    {/* Dates */}
                    <div style={{ display: "flex", gap: "16px", marginBottom: "4px" }}>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Validation Start Date</label>
                        <input
                          type="text"
                          readOnly
                          value={selectedProtocol?.generated_at
                            ? new Date(selectedProtocol.generated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                          style={{ ...S.input, background: "#f0f4ff", color: "#004f9f", fontWeight: "600", cursor: "default" }}
                          title="Auto-filled from protocol approval date" />
                        <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Auto-filled — date protocol was approved</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Completion Date (Run) *</label>
                        <input
                          type="date"
                          value={completionDate}
                          onChange={e => setCompletionDate(e.target.value)}
                          max={new Date().toISOString().split("T")[0]}
                          style={S.input} />
                        <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Date Run was completed</p>
                      </div>
                    </div>

                    <label style={S.label}>Training Details * (e.g. "John Doe, Alice Smith - Trained 2025-05-10")</label>
                    <textarea value={trainingDetails} onChange={e => setTrainingDetails(e.target.value)}
                      placeholder="Enter training details..." style={{ ...S.input, minHeight: "60px", fontFamily: "Arial" }} />

                    <label style={S.label}>SOP Followed * (e.g. "CL-SOP-001-v2.0")</label>
                    <input value={sopFollowed} onChange={e => setSOPFollowed(e.target.value)}
                      placeholder="Enter SOP number/version" style={S.input} />
                  </div>

                  {/* Draft-loaded banner */}
                  {existingReportForProtocol?.status === "Draft" && (
                    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "8px 14px", marginBottom: "12px", fontSize: "12px", color: "#856404" }}>
                      <strong>Draft loaded.</strong> Your previously saved draft has been restored. Continue editing and save again or submit.
                    </div>
                  )}

                  {/* Submit / Draft buttons */}
                  {role === "VIEWER"
                    ? <p style={{ margin: 0, fontSize: "13px", color: "#856404", background: "#fff3cd", padding: "8px 12px", borderRadius: "6px" }}>
                        Viewer role cannot submit reports.
                      </p>
                    : existingReportForProtocol && existingReportForProtocol.status !== "Draft"
                      ? <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", color: "#721c24" }}>
                          A <strong>{existingReportForProtocol.status}</strong> report already exists for this protocol. Delete the existing report if you need to re-create it.
                        </div>
                      : <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button onClick={saveDraft} disabled={savingDraft}
                            style={{ ...S.genBtn, background: savingDraft ? "#aaa" : "#92400e", cursor: savingDraft ? "not-allowed" : "pointer" }}>
                            {savingDraft ? "Saving…" : "Save Draft"}
                          </button>
                          <button onClick={() => { setReportPassword(""); setShowSubmitReportModal(true); }}
                            style={S.genBtn}>Submit Report</button>
                        </div>
                  }
                </>
              )}

              {/* Report list */}
              <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #e2e8f0" }} />
              <h3 style={{ color: "#004f9f", marginTop: "24px" }}>Previous Reports</h3>
              {reportListError && (
                <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "6px", padding: "10px 14px", marginBottom: "12px", fontSize: "13px", color: "#721c24" }}>
                  ✕ {reportListError}
                </div>
              )}
              {reportListLoading ? <p style={{ color: "#888" }}>Loading…</p>
              : reportList.length === 0
                ? <p style={{ color: "#888", fontStyle: "italic" }}>No reports submitted yet.</p>
                : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#004f9f", color: "white" }}>
                        <th style={archCell}>Product</th>
                        <th style={archCell}>Facility</th>
                        <th style={archCell}>Submitted By</th>
                        <th style={archCell}>Date</th>
                        <th style={archCell}>Status</th>
                        <th style={archCell}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportList.map((r, i) => (
                        <tr key={r.report_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                          <td style={archCell}>{r.product_name}</td>
                          <td style={archCell}>{r.facility_name}</td>
                          <td style={archCell}>{r.submitted_by}</td>
                          <td style={archCell}>{new Date(r.submitted_at).toLocaleDateString("en-IN")}</td>
                          <td style={archCell}>
                            <span style={{
                              display: "inline-block", padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold",
                              background: r.status === "Approved" ? "#d4edda" : r.status === "Draft" ? "#fff3cd" : "#dbeafe",
                              color:      r.status === "Approved" ? "#155724" : r.status === "Draft" ? "#92400e" : "#1e40af",
                            }}>
                              {r.status || "Submitted"}
                            </span>
                          </td>
                          <td style={archCell}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button onClick={() => viewReportDetail(r.report_id)} style={S.viewBtn}>View</button>
                              {["QA", "ADMIN"].includes(role) && r.status === "Submitted" && (
                                <button onClick={() => { setApproveTarget(r); setApprovePwd(""); setShowApproveModal(true); }}
                                  style={{ ...S.viewBtn, background: "#155724", color: "white", border: "none" }}>Approve</button>
                              )}
                              {role !== "VIEWER" && (
                                <button onClick={() => { setDeleteReportTarget(r); setDeleteReportPwd(""); setShowDeleteReportModal(true); }}
                                  style={S.deleteBtn}>Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
                <button onClick={() => { setViewingReport(null); }} style={S.backBtn}>← Back to List</button>
                {viewingReport.results_data && (
                  <>
                    <button onClick={handleReportPrint} style={S.printBtn}>Print / Export PDF</button>
                    {role !== "VIEWER" && (
                      <button onClick={() => { setDeleteReportTarget(viewingReport); setDeleteReportPwd(""); setShowDeleteReportModal(true); }}
                        style={{ ...S.deleteBtn, padding: "9px 16px", fontSize: "13px" }}>
                        Delete Report
                      </button>
                    )}
                  </>
                )}
              </div>

              {viewReportLoading ? (
                <p style={{ color: "#888", padding: "24px" }}>Loading report…</p>
              ) : viewingReport.results_data ? (
                <div style={{ background: "#c8cdd6", padding: "28px 0 40px", margin: "0 -20px" }}>
                  <div style={{ maxWidth: "950px", margin: "0 auto", padding: "0 16px" }}>
                    {renderArchivedReport()}
                  </div>
                </div>
              ) : (
                <p style={{ color: "#888" }}>No report data available.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}

      {/* Save to archive */}
      {showSaveModal && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#004f9f", marginTop: 0 }}>💾 Save Protocol to Archive</h3>
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
            Saves a <strong>frozen snapshot</strong> of the current protocol including the active sampling plan.
            Future changes to products, equipment, or sampling locations will not affect this archived version.
          </p>
          <table style={{ fontSize: "13px", width: "100%", marginBottom: "16px" }}><tbody>
            <tr><td style={{ padding: "3px 8px", color: "#888", width: "130px" }}>Document No.</td>
                <td style={{ padding: "3px 8px", fontWeight: "bold" }}>{displayDocNumber}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Product</td>
                <td style={{ padding: "3px 8px" }}>{sourceProduct?.product_name}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Facility</td>
                <td style={{ padding: "3px 8px" }}>{facilities.find(f => f.facility_id === sourceProduct?.facility_id)?.facility_name}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Sampling Locations</td>
                <td style={{ padding: "3px 8px" }}>
                  {protocolSamplingPlan.reduce((n, c) => n + c.entries.length, 0)} total across{" "}
                  {protocolSamplingPlan.filter(c => c.entries.length > 0).length} categories
                </td></tr>
          </tbody></table>
          <label style={S.label}>Status</label>
          <select value={saveStatus} onChange={e => setSaveStatus(e.target.value)} style={S.input}>
            <option value="Draft">Draft</option>
            <option value="Final">Final</option>
          </select>
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button onClick={saveToArchive} disabled={saveLoading}
              style={saveLoading ? S.saveBtnDisabled : S.saveBtn}>
              {saveLoading ? "Saving..." : "Save to Archive"}
            </button>
            <button onClick={() => setShowSaveModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Delete archive */}
      {showDeleteArchiveModal && selectedArchive && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Delete Archived Protocol</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{selectedArchive.doc_number} — Version {selectedArchive.version}</strong><br/>
            <span style={{ color: "#888" }}>{selectedArchive.product_name} · {new Date(selectedArchive.generated_at).toLocaleDateString("en-IN")}</span>
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={deleteArchivePassword}
            onChange={e => setDeleteArchivePassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmDeleteArchive(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={confirmDeleteArchive} disabled={deletingArchive}
              style={deletingArchive ? S.saveBtnDisabled : { ...S.saveBtn, background: "#dc3545" }}>
              {deletingArchive ? "Deleting..." : "Confirm Delete"}
            </button>
            <button onClick={() => setShowDeleteArchiveModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Delete report */}
      {showDeleteReportModal && deleteReportTarget && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Delete PCV Validation Report</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{deleteReportTarget.product_name}</strong> — {deleteReportTarget.facility_name}<br/>
            <span style={{ color: "#888" }}>Submitted by {deleteReportTarget.submitted_by} on {deleteReportTarget.submitted_at ? new Date(deleteReportTarget.submitted_at).toLocaleDateString("en-IN") : "—"}</span>
          </p>
          <p style={{ fontSize: "12px", background: "#f8d7da", padding: "8px 10px", borderRadius: "5px", color: "#721c24" }}>
            This action cannot be undone. The report will be permanently removed.
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={deleteReportPwd}
            onChange={e => setDeleteReportPwd(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmDeleteReport(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={confirmDeleteReport} disabled={deletingReport}
              style={deletingReport ? S.saveBtnDisabled : { ...S.saveBtn, background: "#dc3545" }}>
              {deletingReport ? "Deleting..." : "Confirm Delete"}
            </button>
            <button onClick={() => setShowDeleteReportModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Approve report */}
      {showApproveModal && approveTarget && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#155724", marginTop: 0 }}>Approve PCV Validation Report</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{approveTarget.product_name}</strong> — {approveTarget.facility_name}<br/>
            <span style={{ color: "#888" }}>Submitted by {approveTarget.submitted_by}</span>
          </p>
          <p style={{ fontSize: "12px", background: "#d4edda", padding: "8px 10px", borderRadius: "5px", color: "#155724", marginBottom: "14px" }}>
            Once approved, this product becomes eligible for Periodic Cleaning Verification (PCV) runs.
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={approvePwd}
            onChange={e => setApprovePwd(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmApproveReport(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={confirmApproveReport} disabled={approvingReport}
              style={approvingReport ? S.saveBtnDisabled : { ...S.saveBtn, background: "#155724" }}>
              {approvingReport ? "Approving..." : "Confirm Approve"}
            </button>
            <button onClick={() => setShowApproveModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Submit report */}
      {showSubmitReportModal && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#004f9f", marginTop: 0 }}>Submit PCV Validation Report</h3>
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
            Submit report for <strong>{selectedProtocol?.doc_number || "Protocol"}</strong> · <strong>{reportProducts.find(p => p.product_id === parseInt(reportProduct))?.product_name || "Product"}</strong>
          </p>
          <p style={{ fontSize: "12px", background: "#f0f4ff", padding: "8px 10px", borderRadius: "5px", marginBottom: "16px" }}>
            • 1 run with batch number<br/>
            • All equipment results entered (rinse & swab)<br/>
            • Training details and SOP recorded
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={reportPassword} onChange={e => setReportPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitReport(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button onClick={submitReport} disabled={submittingReport || reportLoading}
              style={submittingReport || reportLoading ? S.saveBtnDisabled : S.saveBtn}>
              {submittingReport || reportLoading ? "Submitting..." : "Submit Report"}
            </button>
            <button onClick={() => setShowSubmitReportModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

    </div>
  );
}

const archCell = { border: "1px solid #ddd", padding: "8px 10px" };
const sampCell = { border: "1px solid #e2e8f0", padding: "8px 12px" };

const S = {
  pageHeader:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn:        { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  tabBar:         { display: "flex", gap: "4px", marginBottom: "20px" },
  tabActive:      { padding: "10px 24px", background: "#004f9f", color: "white", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  tabInactive:    { padding: "10px 24px", background: "white", color: "#555", border: "1px solid #e2e8f0", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  filterCard:     { background: "white", borderRadius: "0 10px 10px 10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "16px" },
  filterLabel:    { display: "block", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  select:         { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "220px", cursor: "pointer" },
  genBtn:         { padding: "9px 18px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  genBtnDisabled: { padding: "9px 18px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "13px" },
  printBtn:       { padding: "9px 18px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  archiveBtn:     { padding: "9px 18px", background: "#6f42c1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  refreshBtn:     { padding: "7px 14px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  viewBtn:        { padding: "5px 12px", background: "#004f9f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  editBtn:        { padding: "5px 10px", background: "#ffc107", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  deleteBtn:      { padding: "5px 10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  emptyState:     { textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  overlay:        { position: "fixed", top:0, left:0, right:0, bottom:0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal:          { background: "white", padding: "28px", borderRadius: "10px", width: "440px", boxShadow: "0px 10px 30px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" },
  label:          { display: "block", marginBottom: "5px", marginTop: "12px", fontWeight: "bold", fontSize: "13px" },
  input:          { padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  saveBtn:        { padding: "10px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  saveBtnDisabled:{ padding: "10px 16px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", flex: 1 },
  cancelBtn:      { padding: "10px 16px", background: "#555",     color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  // Protocol document
  docHeader:      { padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: "20px", borderBottom: "2px solid #004f9f" },
  docTitle:       { margin: "0 0 4px", fontSize: "18px", color: "#004f9f", fontWeight: "bold" },
  docSub:         { margin: 0, fontSize: "13px", color: "#666" },
  metaTable:      { fontSize: "11px", borderCollapse: "collapse" },
  metaKey:        { color: "#888", padding: "2px 8px 2px 0", whiteSpace: "nowrap" },
  metaVal:        { fontWeight: "bold", color: "#222", padding: "2px 0" },
  section:        { padding: "18px 24px", marginBottom: "2px", borderLeft: "4px solid #e2e8f0" },
  sectionTitle:   { margin: "0 0 12px", fontSize: "14px", fontWeight: "bold", color: "#004f9f", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" },
  para:           { margin: "0 0 8px", fontSize: "13px", color: "#444", lineHeight: "1.6" },
  policyBadgeBox: { marginBottom: "10px" },
  policyBadge:    { background: "#eef4ff", color: "#004f9f", border: "1px solid #c7d9f7", borderRadius: "4px", padding: "3px 10px", fontWeight: "bold", fontSize: "12px" },
  formulaBox:     { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" },
  formulaLabel:   { fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  formulaCode:    { fontFamily: "monospace", fontSize: "12px", color: "#004f9f", background: "#eef4ff", padding: "4px 8px", borderRadius: "4px" },
  formulaNote:    { fontSize: "11px", color: "#888" },
  pairBlock:      { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" },
  pairTitle:      { margin: "0 0 12px", fontWeight: "bold", fontSize: "13px", color: "#004f9f" },
  subLabel:       { margin: "0 0 6px", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  dataTable:      { width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "4px" },
  th:             { background: "#e8f0fb", color: "#004f9f", padding: "7px 10px", textAlign: "left", fontWeight: "bold", border: "1px solid #d0dff7" },
  td:             { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#333" },
  tdKey:          { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#888", fontWeight: "600", width: "180px", background: "#f8fafc" },
  tdVal:          { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#222" },
  activeMark:     { color: "#155724", fontWeight: "bold", fontSize: "14px" },
  inactiveMark:   { color: "#aaa", fontSize: "14px" },
  governingBox:   { background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" },
  govLabel:       { margin: "0 0 4px", fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.4px" },
  govValue:       { margin: 0, fontSize: "18px", fontWeight: "bold", color: "#004f9f" },
  sigGrid:        { padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "32px" },
  sigBox:         { display: "flex", flexDirection: "column" },
  docFooter:      { background: "#f8fafc", padding: "10px 24px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#888", borderTop: "1px solid #e2e8f0" },
};
