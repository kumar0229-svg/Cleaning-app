import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/cipla-logo.png";

function apiError(e, fallback = "An unexpected error occurred. Please try again.") {
  const detail = e?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join("; ");
  if (typeof detail === "object") return detail.msg || JSON.stringify(detail);
  return fallback;
}

function holdTimeBadge(holdTime, limitHours) {
  if (holdTime == null || holdTime === "" || limitHours == null) return null;
  const ht = parseFloat(holdTime);
  const lim = parseFloat(limitHours);
  if (isNaN(ht) || isNaN(lim)) return null;
  const pass = ht <= lim;
  return (
    <span style={{
      fontSize: "10px", fontWeight: "bold", padding: "2px 8px", borderRadius: "3px",
      background: pass ? "#d4edda" : "#f8d7da",
      color: pass ? "#155724" : "#721c24",
    }}>
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

function statusBadge(status) {
  if (!status) return null;
  const cfg = {
    Draft:     { bg: "#fff3cd", color: "#92400e" },
    Submitted: { bg: "#dbeafe", color: "#1e40af" },
    Approved:  { bg: "#d4edda", color: "#155724" },
  };
  const s = cfg[status] || { bg: "#f0f0f0", color: "#555" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: "10px",
      fontSize: "11px", fontWeight: "bold", background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

function calcHoldTime(usageEnd, cleaningStart) {
  if (!usageEnd || !cleaningStart) return null;
  const diff = (new Date(cleaningStart) - new Date(usageEnd)) / (1000 * 60 * 60);
  if (isNaN(diff) || diff < 0) return null;
  return parseFloat(diff.toFixed(2));
}

export default function DEHTPage({ goHome, currentUser, role }) {

  // ── Core state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState("protocol");
  const [facilities, setFacilities]     = useState([]);
  const [products, setProducts]         = useState([]);
  const [selectedFacility, setSelectedFacility] = useState("");
  const [selectedProduct, setSelectedProduct]   = useState("");
  const [dehtHours, setDehtHours]       = useState(null);
  const [dehtMeta, setDehtMeta]         = useState(null);
  const [protocolData, setProtocolData] = useState(null); // { equipmentList, productName, facilityName, productId }
  const [loading, setLoading]           = useState(false);
  const printRef = useRef(null);

  // ── Archive state ───────────────────────────────────────────────────
  const [archiveList, setArchiveList]         = useState([]);
  const [archiveLoading, setArchiveLoading]   = useState(false);
  const [showArchiveTable, setShowArchiveTable] = useState(true);
  const [archiveDoc, setArchiveDoc]           = useState(null); // viewing a specific archived version
  const [showSaveModal, setShowSaveModal]     = useState(false);
  const [saveStatus, setSaveStatus]           = useState("Draft");
  const [savePassword, setSavePassword]       = useState("");
  const [saveLoading, setSaveLoading]         = useState(false);
  const [showDeleteArchiveModal, setShowDeleteArchiveModal] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [deleteArchivePwd, setDeleteArchivePwd] = useState("");
  const [deletingArchive, setDeletingArchive]   = useState(false);

  // ── Report state ────────────────────────────────────────────────────
  const [finalProtocols, setFinalProtocols]     = useState([]);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [reportEquipment, setReportEquipment]   = useState([]); // from snapshot
  const [reportDehtHours, setReportDehtHours]   = useState(null);
  const [trainingDetails, setTrainingDetails]   = useState("");
  const [sopFollowed, setSopFollowed]           = useState("");
  const [completionDate, setCompletionDate]     = useState("");
  const [runResults, setRunResults] = useState([
    { run_number: 1, batch_number: "", equipment_results: [] },
    { run_number: 2, batch_number: "", equipment_results: [] },
    { run_number: 3, batch_number: "", equipment_results: [] },
  ]);
  const [showSubmitModal, setShowSubmitModal]   = useState(false);
  const [submitReason, setSubmitReason]         = useState("");
  const [submitPassword, setSubmitPassword]     = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [savingDraft, setSavingDraft]           = useState(false);
  const [existingReport, setExistingReport]     = useState(null);
  const [reportNotice, setReportNotice]         = useState("");

  // ── Report list ─────────────────────────────────────────────────────
  const [reportList, setReportList]             = useState([]);
  const [reportListLoading, setReportListLoading] = useState(false);
  const [reportListError, setReportListError]   = useState("");
  const [viewingReport, setViewingReport]       = useState(null);
  const [viewReportLoading, setViewReportLoading] = useState(false);
  const reportPrintRef = useRef(null);

  // ── Report modals ───────────────────────────────────────────────────
  const [showApproveModal, setShowApproveModal]   = useState(false);
  const [approveTarget, setApproveTarget]         = useState(null);
  const [approvePwd, setApprovePwd]               = useState("");
  const [approvingReport, setApprovingReport]     = useState(false);
  const [showDeleteReportModal, setShowDeleteReportModal] = useState(false);
  const [deleteReportTarget, setDeleteReportTarget] = useState(null);
  const [deleteReportPwd, setDeleteReportPwd]     = useState("");
  const [deletingReport, setDeletingReport]       = useState(false);

  // ── Derived display (live vs archived protocol view) ────────────────
  const displayProtocol   = archiveDoc ?? protocolData;
  const displayDocNumber  = archiveDoc
    ? archiveDoc.docNumber
    : (protocolData
        ? `DEHT-PROTO-${String(protocolData.productId || "").padStart(4, "0")}-${new Date().getFullYear()}`
        : "—");

  // ── Boot: load facilities + DEHT hours ─────────────────────────────
  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(console.log);
    api.get("/lifecycle/deht-hours")
      .then(r => { setDehtHours(r.data.hours); setDehtMeta(r.data); })
      .catch(console.log);
  }, []);

  useEffect(() => {
    if (!selectedFacility) { setProducts([]); setSelectedProduct(""); return; }
    api.get("/product/all")
      .then(r => setProducts(r.data.filter(p => String(p.facility_id) === String(selectedFacility))))
      .catch(console.log);
  }, [selectedFacility]);

  useEffect(() => {
    if (activeTab === "report") {
      loadFinalProtocols();
      loadReportList();
    }
  }, [activeTab]);

  // ── Load archived DEHT protocols list ──────────────────────────────
  const loadArchives = async () => {
    setArchiveLoading(true);
    try {
      const r = await api.get("/protocol/archives");
      setArchiveList(r.data.filter(a => a.doc_number?.startsWith("DEHT-PROTO-")));
    } catch (e) { console.log(e); }
    finally { setArchiveLoading(false); }
  };

  useEffect(() => {
    loadArchives();
  }, []);

  // ── Protocol generation ─────────────────────────────────────────────
  const generateProtocol = async () => {
    if (!selectedProduct) { alert("Select a product first."); return; }
    setLoading(true); setProtocolData(null); setArchiveDoc(null);
    try {
      const product = products.find(p => String(p.product_id) === String(selectedProduct));
      const facility = facilities.find(f => String(f.facility_id) === String(selectedFacility));

      // Get equipment for this product
      const [eqByFacRes, prodEqRes] = await Promise.all([
        api.get(`/equipment/by_facility/${selectedFacility}`),
        api.get(`/product/${selectedProduct}/equipment`),
      ]);
      const prodEqIds = new Set((prodEqRes.data || []).map(id => String(id)));
      const equipmentList = (eqByFacRes.data || []).filter(eq => prodEqIds.has(String(eq.equipment_id)));

      setProtocolData({
        productId: product.product_id,
        productName: product.product_name,
        facilityId: facility?.facility_id,
        facilityName: facility?.facility_name || "",
        equipmentList,
      });
    } catch (err) {
      alert(apiError(err, "Error generating protocol."));
    } finally { setLoading(false); }
  };

  // ── Archive: view ───────────────────────────────────────────────────
  const viewArchive = async (archiveId) => {
    try {
      const res = await api.get(`/protocol/archive/${archiveId}`);
      const { snapshot, doc_number, version, generated_by, generated_at, status } = res.data;
      setArchiveDoc({
        ...snapshot,
        docNumber: doc_number,
        meta: { version, generated_by, generated_at, status, doc_number },
      });
      setProtocolData(null);
      setActiveTab("protocol");
    } catch { alert("Error loading archived protocol."); }
  };

  // ── Archive: save ───────────────────────────────────────────────────
  const saveToArchive = async () => {
    if (!protocolData) return;
    if (!savePassword.trim()) { alert("Enter your password."); return; }
    setSaveLoading(true);
    try {
      const docNum = `DEHT-PROTO-${String(protocolData.productId).padStart(4, "0")}-${new Date().getFullYear()}`;
      const snapshot = {
        productId: protocolData.productId,
        productName: protocolData.productName,
        facilityId: protocolData.facilityId,
        facilityName: protocolData.facilityName,
        equipmentList: protocolData.equipmentList,
        dehtHours,
        docNumber: docNum,
      };
      const res = await api.post("/protocol/archive", {
        snapshot,
        doc_number: docNum,
        product_id: protocolData.productId,
        product_name: protocolData.productName,
        facility_name: protocolData.facilityName,
        status: saveStatus,
        password: savePassword,
      });
      setShowSaveModal(false);
      setSavePassword("");
      alert(`Saved: ${res.data.doc_number}  Version ${res.data.version}`);
      loadArchives();
    } catch (e) { alert(apiError(e, "Error saving protocol.")); }
    finally { setSaveLoading(false); }
  };

  // ── Archive: delete ─────────────────────────────────────────────────
  const confirmDeleteArchive = async () => {
    if (!deleteArchivePwd.trim()) { alert("Enter your password."); return; }
    setDeletingArchive(true);
    try {
      await api.delete(`/protocol/archive/remove/${selectedArchive.archive_id}`, {
        data: { password: deleteArchivePwd, reason: "DEHT Protocol archive removed by user" },
      });
      alert("Archive deleted.");
      setShowDeleteArchiveModal(false);
      setDeleteArchivePwd("");
      loadArchives();
    } catch (e) { alert(apiError(e, "Error deleting archive.")); }
    finally { setDeletingArchive(false); }
  };

  // ── Report: load final protocols ────────────────────────────────────
  const loadFinalProtocols = async () => {
    setProtocolsLoading(true);
    setReportNotice("");
    try {
      const r = await api.get("/protocol/archives");
      const dehtFinal = r.data.filter(a => a.doc_number?.startsWith("DEHT-PROTO-") && a.status === "Final");
      setFinalProtocols(dehtFinal);
      if (dehtFinal.length === 0)
        setReportNotice("No Final DEHT protocols found. Generate and save a DEHT protocol with status 'Final' first.");
    } catch (e) { setReportNotice(apiError(e, "Failed to load protocols.")); }
    finally { setProtocolsLoading(false); }
  };

  // ── Report: load protocol into run form ─────────────────────────────
  const loadProtocol = async (protocol, existingDraft = null) => {
    setSelectedProtocol(protocol);
    setReportNotice("");
    setExistingReport(null);
    try {
      const res = await api.get(`/protocol/archive/${protocol.archive_id}`);
      const snap = res.data.snapshot;
      const eqList = snap.equipmentList || [];
      const hrs = snap.dehtHours ?? dehtHours;
      setReportDehtHours(hrs);

      const buildEqResults = () =>
        eqList.map(eq => ({
          equipment_name: eq.equipment_name || eq.name || "",
          equipment_id: eq.equipment_id,
          usage_end_datetime: "",
          cleaning_start_datetime: "",
          hold_time_hours: null,
          limit_hours: hrs,
          sample_points: "",
        }));

      if (existingDraft?.status === "Draft" && existingDraft.results_data?.runs) {
        const draftRuns = existingDraft.results_data.runs;
        setRunResults(prev => prev.map((run, ri) => {
          const draftRun = draftRuns[ri];
          if (!draftRun) return { ...run, equipment_results: buildEqResults() };
          return {
            ...draftRun,
            equipment_results: buildEqResults().map((eq, ei) => {
              const draftEq = draftRun.equipment_results?.[ei];
              if (!draftEq) return eq;
              return { ...eq, ...draftEq, limit_hours: hrs };
            }),
          };
        }));
        setTrainingDetails(existingDraft.results_data.training_details || "");
        setSopFollowed(existingDraft.results_data.sop_followed || "");
        setCompletionDate(existingDraft.results_data.completion_date || "");
      } else {
        setRunResults([
          { run_number: 1, batch_number: "", equipment_results: buildEqResults() },
          { run_number: 2, batch_number: "", equipment_results: buildEqResults() },
          { run_number: 3, batch_number: "", equipment_results: buildEqResults() },
        ]);
        setTrainingDetails("");
        setSopFollowed("");
        setCompletionDate("");
      }
    } catch (e) { setReportNotice(apiError(e, "Failed to load protocol details.")); }
  };

  const handleProtocolSelect = async (protocol) => {
    if (!protocol) { setSelectedProtocol(null); return; }
    // Check for existing report for this protocol
    let existDraft = null;
    try {
      const r = await api.get(`/report/by-archive/${protocol.archive_id}`);
      if (r.data) {
        existDraft = r.data;
        if (r.data.status === "Draft") {
          const full = await api.get(`/deht/report/${r.data.report_id}`);
          existDraft = { ...r.data, results_data: full.data.results_data };
        }
        setExistingReport(existDraft);
      }
    } catch (_) {}
    await loadProtocol(protocol, existDraft?.status === "Draft" ? existDraft : null);
  };

  // ── Run result change handlers ───────────────────────────────────────
  const handleRunChange = (runIdx, equipIdx, field, value) => {
    setRunResults(prev => prev.map((run, ri) => {
      if (ri !== runIdx) return run;
      if (field === "batch_number") return { ...run, batch_number: value };
      const eqs = run.equipment_results.map((eq, ei) => {
        if (ei !== equipIdx) return eq;
        const updated = { ...eq, [field]: value };
        // Auto-calculate hold time when either datetime changes
        if (field === "usage_end_datetime" || field === "cleaning_start_datetime") {
          const uEnd  = field === "usage_end_datetime"    ? value : eq.usage_end_datetime;
          const cStart = field === "cleaning_start_datetime" ? value : eq.cleaning_start_datetime;
          updated.hold_time_hours = calcHoldTime(uEnd, cStart);
        }
        return updated;
      });
      return { ...run, equipment_results: eqs };
    }));
  };

  // ── Report list ─────────────────────────────────────────────────────
  const loadReportList = async () => {
    setReportListLoading(true);
    setReportListError("");
    try {
      const res = await api.get("/deht/report/list");
      setReportList(res.data || []);
    } catch (e) { setReportListError(apiError(e, "Failed to load reports.")); }
    finally { setReportListLoading(false); }
  };

  const viewReportDetail = async (reportId) => {
    setViewingReport({ report_id: reportId });
    setViewReportLoading(true);
    try {
      const res = await api.get(`/deht/report/${reportId}`);
      setViewingReport(res.data);
    } catch (e) {
      alert(apiError(e, "Failed to load report."));
      setViewingReport(null);
    } finally { setViewReportLoading(false); }
  };

  // ── Submit report ───────────────────────────────────────────────────
  const validateReport = () => {
    if (!selectedProtocol) { alert("Select a protocol first."); return false; }
    for (let i = 0; i < runResults.length; i++) {
      if (!runResults[i].batch_number.trim()) {
        alert(`Batch number required for Run ${i + 1}.`); return false;
      }
      for (let j = 0; j < runResults[i].equipment_results.length; j++) {
        const eq = runResults[i].equipment_results[j];
        if (!eq.usage_end_datetime) {
          alert(`Usage Completion Date/Time required for Run ${i + 1}, ${eq.equipment_name}.`); return false;
        }
        if (!eq.cleaning_start_datetime) {
          alert(`Cleaning Start Date/Time required for Run ${i + 1}, ${eq.equipment_name}.`); return false;
        }
      }
    }
    if (!trainingDetails.trim()) { alert("Training details are required."); return false; }
    if (!sopFollowed.trim()) { alert("SOP Followed is required."); return false; }
    if (!completionDate) { alert("Completion date is required."); return false; }
    return true;
  };

  const submitReport = async () => {
    if (!validateReport()) return;
    if (!submitPassword.trim()) { alert("Enter your password."); return; }
    setSubmitting(true);
    try {
      const resultsData = {
        runs: runResults,
        training_details: trainingDetails,
        sop_followed: sopFollowed,
        completion_date: completionDate,
        deht_hours: reportDehtHours,
      };
      if (existingReport?.status === "Draft") {
        await api.put(`/deht/report/${existingReport.report_id}`, {
          results_data: resultsData,
          password: submitPassword,
          reason: submitReason || "DEHT Report submitted",
          is_draft: false,
        });
      } else {
        await api.post("/deht/report/create", {
          archive_id: selectedProtocol.archive_id,
          results_data: resultsData,
          password: submitPassword,
          reason: submitReason || "DEHT Report submitted",
        });
      }
      alert("Report submitted successfully.");
      setShowSubmitModal(false);
      setSubmitPassword(""); setSubmitReason("");
      resetReportForm();
      loadReportList();
    } catch (e) { alert(apiError(e, "Error submitting report.")); }
    finally { setSubmitting(false); }
  };

  const saveDraft = async () => {
    if (!selectedProtocol) { alert("Select a protocol first."); return; }
    setSavingDraft(true);
    try {
      const resultsData = {
        runs: runResults,
        training_details: trainingDetails,
        sop_followed: sopFollowed,
        completion_date: completionDate || null,
        deht_hours: reportDehtHours,
      };
      if (existingReport?.status === "Draft") {
        await api.put(`/deht/report/${existingReport.report_id}`, {
          results_data: resultsData,
          reason: "Draft save",
          is_draft: true,
        });
      } else {
        const res = await api.post("/deht/report/create", {
          archive_id: selectedProtocol.archive_id,
          results_data: resultsData,
          is_draft: true,
        });
        setExistingReport({ report_id: res.data.report_id, status: "Draft" });
      }
      alert("Draft saved.");
      loadReportList();
    } catch (e) { alert(apiError(e, "Error saving draft.")); }
    finally { setSavingDraft(false); }
  };

  const resetReportForm = () => {
    setSelectedProtocol(null);
    setReportEquipment([]);
    setTrainingDetails(""); setSopFollowed(""); setCompletionDate("");
    setExistingReport(null);
    setRunResults([
      { run_number: 1, batch_number: "", equipment_results: [] },
      { run_number: 2, batch_number: "", equipment_results: [] },
      { run_number: 3, batch_number: "", equipment_results: [] },
    ]);
  };

  // ── Approve report ──────────────────────────────────────────────────
  const confirmApproveReport = async () => {
    if (!approvePwd.trim()) { alert("Enter your password."); return; }
    setApprovingReport(true);
    try {
      await api.post(`/deht/report/${approveTarget.report_id}/approve`, { password: approvePwd });
      alert("Report approved.");
      setShowApproveModal(false); setApprovePwd("");
      loadReportList();
    } catch (e) { alert(apiError(e, "Error approving report.")); }
    finally { setApprovingReport(false); }
  };

  // ── Delete report ───────────────────────────────────────────────────
  const confirmDeleteReport = async () => {
    if (!deleteReportPwd.trim()) { alert("Enter your password."); return; }
    setDeletingReport(true);
    try {
      await api.delete(`/deht/report/${deleteReportTarget.report_id}`, {
        data: { password: deleteReportPwd, reason: "DEHT Report removed by user" },
      });
      alert("Report deleted.");
      setShowDeleteReportModal(false); setDeleteReportPwd("");
      setViewingReport(null);
      loadReportList();
    } catch (e) { alert(apiError(e, "Error deleting report.")); }
    finally { setDeletingReport(false); }
  };

  // ── Print: protocol PDF ─────────────────────────────────────────────
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
<title>DEHT Protocol — ${displayDocNumber}${versionLabel}</title>
<style>
@page{size:A4 portrait;margin:22mm 14mm 18mm 14mm}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.rh{position:fixed;top:0;left:0;right:0;height:18mm;background:white;border-bottom:2px solid #004f9f;display:flex;align-items:center;gap:12px;padding:0 14mm;z-index:1000}
.rh img{height:10mm}.rh-center{flex:1}.rh-title{font-size:11pt;font-weight:bold;color:#004f9f;margin:0}
.rh-sub{font-size:8pt;color:#666;margin:1px 0 0}.rh-meta{text-align:right;font-size:7.5pt;color:#777;line-height:1.5}
.rf{position:fixed;bottom:0;left:0;right:0;height:12mm;background:white;border-top:1px solid #d0d0d0;display:flex;align-items:center;justify-content:space-between;padding:0 14mm;font-size:7.5pt;color:#999;z-index:1000}
body{font-family:Arial,sans-serif;font-size:10pt;color:#222;margin:0;padding:20mm 0 14mm;line-height:1.5}
.doc-header{display:none!important}.doc-footer{display:none!important}.archive-banner{display:none!important}
.doc-section{break-inside:avoid;page-break-inside:avoid;padding:8pt 0!important;border-left:none!important;margin-bottom:0!important}
table{width:100%!important;border-collapse:collapse;margin:3pt 0}
th{background:#004f9f!important;color:white!important;padding:4pt 6pt!important;text-align:left;border:0.5pt solid #c0d0e8;font-size:8.5pt!important;font-weight:bold}
td{border:0.5pt solid #d8e2ef;padding:4pt 6pt!important;font-size:8.5pt!important}
tr:nth-child(even) td{background:#f5f8fc!important}
h2{font-size:11pt;color:#004f9f;border-bottom:1pt solid #004f9f;padding-bottom:3pt;margin:14pt 0 6pt}
img{max-width:70pt;max-height:26pt}p{margin:0 0 5pt}
.sig-grid-print{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:20pt!important;padding:10pt 0!important;margin-top:10pt!important;break-inside:avoid}
</style></head><body>
<div class="rh">
  <img src="${logoDataUrl}" alt="Cipla"/>
  <div class="rh-center">
    <p class="rh-title">Dirty Equipment Hold Time (DEHT) Study Protocol</p>
    <p class="rh-sub">Cleaning Validation — DEHT Protocol</p>
  </div>
  <div class="rh-meta">
    <div><strong>${displayDocNumber}</strong>${versionLabel}</div>
    <div>Version ${archiveDoc ? archiveDoc.meta.version : "1.0"} &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-IN")}</div>
    <div>Generated by: ${archiveDoc ? archiveDoc.meta.generated_by : currentUser}</div>
  </div>
</div>
<div class="rf">
  <span>Cipla Ltd. &mdash; Confidential</span>
  <span>${displayDocNumber}${versionLabel}</span>
  <span>Printed: ${new Date().toLocaleString("en-IN")}</span>
</div>
${printRef.current.innerHTML}
</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  // ── Print: report PDF ───────────────────────────────────────────────
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
    const { product_name, facility_name, submitted_by, results_data } = viewingReport;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>DEHT Report — ${product_name}</title>
<style>
@page{size:A4 landscape;margin:18mm 12mm 15mm 12mm}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.rh{position:fixed;top:0;left:0;right:0;height:15mm;background:white;border-bottom:2px solid #004f9f;display:flex;align-items:center;gap:12px;padding:0 12mm;z-index:1000}
.rh img{height:9mm}.rh-center{flex:1}.rh-title{font-size:10pt;font-weight:bold;color:#004f9f;margin:0}
.rh-sub{font-size:7.5pt;color:#666;margin:1px 0 0}.rh-meta{text-align:right;font-size:7pt;color:#777;line-height:1.5}
.rf{position:fixed;bottom:0;left:0;right:0;height:10mm;background:white;border-top:1px solid #d0d0d0;display:flex;align-items:center;justify-content:space-between;padding:0 12mm;font-size:7pt;color:#999;z-index:1000}
body{font-family:Arial,sans-serif;font-size:9pt;color:#222;margin:0;padding:17mm 0 12mm;line-height:1.4}
.doc-header{display:none!important}.doc-footer{display:none!important}
.doc-section{break-inside:avoid;padding:6pt 0!important;border-left:none!important;margin-bottom:0!important}
table{width:100%!important;border-collapse:collapse;margin:3pt 0}
th{background:#004f9f!important;color:white!important;padding:3pt 5pt!important;text-align:left;border:0.5pt solid #c0d0e8;font-size:7.5pt!important;font-weight:bold}
td{border:0.5pt solid #d8e2ef;padding:3pt 5pt!important;font-size:7.5pt!important}
tr:nth-child(even) td{background:#f5f8fc!important}
.sig-grid-print{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16pt!important;padding:8pt 0!important;break-inside:avoid}
.pass-badge{background:#d4edda!important;color:#155724!important;font-weight:bold;padding:1pt 4pt;border-radius:2pt;font-size:7pt}
.fail-badge{background:#f8d7da!important;color:#721c24!important;font-weight:bold;padding:1pt 4pt;border-radius:2pt;font-size:7pt}
img{max-width:70pt;max-height:24pt}p{margin:0 0 5pt}
</style></head><body>
<div class="rh">
  <img src="${logoDataUrl}" alt="Cipla"/>
  <div class="rh-center">
    <p class="rh-title">Dirty Equipment Hold Time (DEHT) Study Report</p>
    <p class="rh-sub">DEHT Report — ${product_name}</p>
  </div>
  <div class="rh-meta">
    <div><strong>${product_name}</strong> &nbsp;|&nbsp; ${facility_name}</div>
    <div>DEHT Limit: ${results_data?.deht_hours ?? "—"} hours</div>
    <div>Submitted by: ${submitted_by}</div>
  </div>
</div>
<div class="rf">
  <span>Cipla Ltd. &mdash; Confidential</span>
  <span>${product_name} — DEHT Study Report</span>
  <span>Printed: ${new Date().toLocaleString("en-IN")}</span>
</div>
${reportPrintRef.current.innerHTML}
</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  // ── Protocol document renderer ──────────────────────────────────────
  const renderProtocolDoc = () => {
    const d = displayProtocol;
    if (!d) return null;
    const docNum = displayDocNumber;
    const hrs = d.dehtHours ?? dehtHours ?? "—";
    const eqList = d.equipmentList || [];
    const productName = d.productName || "—";
    const facilityName = d.facilityName || "—";

    return (
      <div ref={printRef} style={{ background: "white", boxShadow: "0 4px 28px rgba(0,0,0,0.32)", minHeight: "1123px" }}>

        {/* Archive banner */}
        {archiveDoc && (
          <div className="archive-banner" style={{
            background: "#fff3cd", borderBottom: "2px solid #ffc107",
            padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: "13px", color: "#856404" }}>
              <strong>Archived — {archiveDoc.docNumber} Version {archiveDoc.meta.version}</strong>
              <span style={{ marginLeft: "14px", fontWeight: "normal" }}>
                by {archiveDoc.meta.generated_by} · {new Date(archiveDoc.meta.generated_at).toLocaleDateString("en-IN")} · {archiveDoc.meta.status}
              </span>
            </div>
            <button onClick={() => setArchiveDoc(null)}
              style={{ padding: "4px 12px", background: "#856404", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
              Close
            </button>
          </div>
        )}

        {/* Doc header */}
        <div style={S.docHeader} className="doc-header">
          <img src={logo} alt="Cipla" style={{ width: 70 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={S.docTitle}>Dirty Equipment Hold Time (DEHT) Study Protocol</h3>
                <p style={S.docSub}>Cleaning Validation — DEHT Determination</p>
              </div>
              <table style={S.metaTable}><tbody>
                <tr><td style={S.metaKey}>Document No.</td><td style={S.metaVal}>{docNum}</td></tr>
                <tr><td style={S.metaKey}>Version</td><td style={S.metaVal}>{archiveDoc ? archiveDoc.meta.version : "1.0"}</td></tr>
                <tr><td style={S.metaKey}>Date</td><td style={S.metaVal}>{new Date().toLocaleDateString("en-IN")}</td></tr>
                <tr><td style={S.metaKey}>Generated By</td><td style={S.metaVal}>{archiveDoc ? archiveDoc.meta.generated_by : currentUser}</td></tr>
              </tbody></table>
            </div>
          </div>
        </div>

        {/* § 1 Objective */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>1. Objective</p>
          <p style={S.para}>
            To determine and document that dirty equipment used in the manufacture of <strong>{productName}</strong> can
            be held for up to <strong>{hrs} hours</strong> without cleaning, without adversely affecting product quality
            or cleanability. The maximum allowable dirty hold time is <strong>{hrs} hours</strong> as defined in the
            Calculation Policy.
          </p>
        </div>

        {/* § 2 Scope */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>2. Scope</p>
          <p style={{ ...S.para, marginBottom: "10px" }}>
            This protocol applies to the following equipment used in the manufacture of <strong>{productName}</strong>
            {" "}at <strong>{facilityName}</strong>:
          </p>
          {eqList.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>
              No equipment linked to this product.
            </p>
          ) : (
            <table style={S.dataTable}>
              <thead>
                <tr style={{ background: "#e8f0fb" }}>
                  <th style={S.th}>#</th>
                  <th style={S.th}>Equipment Name</th>
                  <th style={S.th}>Equipment ID / Tag</th>
                  <th style={S.th}>Category</th>
                </tr>
              </thead>
              <tbody>
                {eqList.map((eq, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                    <td style={{ ...S.td, textAlign: "center", width: "40px" }}>{i + 1}</td>
                    <td style={{ ...S.td, fontWeight: "600" }}>{eq.equipment_name || eq.name || "—"}</td>
                    <td style={S.td}>{eq.equipment_tag || eq.equipment_id || "—"}</td>
                    <td style={S.td}>{eq.category_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* § 3 Procedure */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>3. Procedure</p>
          <p style={{ ...S.para, marginBottom: "10px" }}>
            Three (3) consecutive runs shall be conducted. For each run, the following data shall be recorded:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map(runNo => (
              <div key={runNo} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ background: "#004f9f", color: "white", padding: "8px 14px", fontWeight: "bold", fontSize: "13px" }}>
                  Run {runNo}
                </div>
                <table style={{ ...S.dataTable, margin: 0 }}>
                  <thead>
                    <tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Equipment Name</th>
                      <th style={S.th}>Usage Completion Date/Time</th>
                      <th style={S.th}>Cleaning Start Date/Time</th>
                      <th style={S.th}>Hold Time (hrs)</th>
                      <th style={S.th}>Sample Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqList.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...S.td, color: "#aaa", fontStyle: "italic", textAlign: "center" }}>No equipment</td></tr>
                    ) : eqList.map((eq, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ ...S.td, fontWeight: "600" }}>{eq.equipment_name || eq.name || "—"}</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic" }}>To be recorded</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic" }}>To be recorded</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic", textAlign: "center" }}>Calculated</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic" }}>Per sampling plan</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* § 4 Acceptance Criteria */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>4. Acceptance Criteria</p>
          <div style={{ background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#004f9f", fontWeight: "bold" }}>
              Maximum Allowable Dirty Hold Time: <span style={{ fontSize: "20px" }}>{hrs} hours</span>
            </p>
          </div>
          <p style={S.para}>
            The actual hold time for each equipment in each run shall not exceed <strong>{hrs} hours</strong>.
            Hold time is calculated as: <em>Cleaning Start Date/Time minus Equipment Usage Completion Date/Time</em>.
            Any exceedance shall be treated as an OOS event and investigated per applicable SOP.
          </p>
          <table style={S.dataTable}>
            <thead>
              <tr style={{ background: "#e8f0fb" }}>
                <th style={S.th}>Parameter</th>
                <th style={S.th}>Limit</th>
                <th style={S.th}>Evaluation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Dirty Equipment Hold Time</td>
                <td style={{ ...S.td, fontWeight: "bold", color: "#004f9f" }}>{hrs} hours (maximum)</td>
                <td style={S.td}>Hold Time = (Cleaning Start) − (Usage Completion) ≤ {hrs} hrs</td>
              </tr>
              <tr style={{ background: "#f8fafc" }}>
                <td style={S.td}>Number of Runs</td>
                <td style={{ ...S.td, fontWeight: "bold" }}>3 consecutive runs</td>
                <td style={S.td}>All 3 runs must individually meet the hold time limit</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* § 5 Sampling */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>5. Sampling</p>
          <p style={S.para}>
            Sample locations as defined in the Cleaning Validation Sampling Plan. Visual inspection and/or
            analytical sampling shall be performed post-cleaning after each hold time run to verify cleanability
            is not adversely affected. All sample points shall be documented in the corresponding DEHT report.
          </p>
        </div>

        {/* § 6 References */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>6. References</p>
          <table style={S.dataTable}>
            <tbody>
              <tr><td style={S.tdKey}>DEHT Limit Source</td><td style={S.tdVal}>Cleaning Validation Calculation Policy — Lifecycle Management</td></tr>
              <tr><td style={S.tdKey}>DEHT Hours</td><td style={S.tdVal}><strong>{hrs} hours</strong></td></tr>
              {dehtMeta && (
                <>
                  <tr><td style={S.tdKey}>Policy Updated By</td><td style={S.tdVal}>{dehtMeta.updated_by || "—"}</td></tr>
                  <tr><td style={S.tdKey}>Policy Updated At</td><td style={S.tdVal}>{dehtMeta.updated_at ? new Date(dehtMeta.updated_at).toLocaleDateString("en-IN") : "—"}</td></tr>
                </>
              )}
              <tr><td style={S.tdKey}>Regulatory Basis</td><td style={S.tdVal}>ICH Q7, EU GMP Annex 15, Site Cleaning Validation SOP</td></tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div style={S.sigGrid} className="sig-grid-print">
          {["Prepared By", "Reviewed By", "Approved By"].map(lbl => (
            <div key={lbl} style={S.sigBox}>
              <p style={{ margin: "0 0 30px", fontSize: "12px", color: "#333" }}>{lbl}</p>
              <div style={{ borderBottom: "1px solid #333", marginBottom: "4px" }} />
              <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>Name / Date / Signature</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.docFooter} className="doc-footer">
          <span>Cipla Ltd. — Confidential | DEHT Study Protocol</span>
          <span>{docNum}{archiveDoc ? ` v${archiveDoc.meta.version}` : ""}</span>
          <span>Generated by: {archiveDoc ? archiveDoc.meta.generated_by : currentUser}</span>
        </div>
      </div>
    );
  };

  // ── Archived report renderer ────────────────────────────────────────
  const renderArchivedReport = () => {
    if (!viewingReport?.results_data) return null;
    const { results_data, product_name, facility_name, submitted_by, submitted_at, doc_number } = viewingReport;
    const runs = results_data.runs || [];
    const hrs = results_data.deht_hours ?? "—";

    return (
      <div ref={reportPrintRef} style={{ background: "white", boxShadow: "0 4px 28px rgba(0,0,0,0.32)", minHeight: "1123px" }}>

        {/* Doc header */}
        <div style={S.docHeader} className="doc-header">
          <img src={logo} alt="Cipla" style={{ width: 70 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={S.docTitle}>Dirty Equipment Hold Time (DEHT) Study Report</h3>
                <p style={S.docSub}>Archived Report — {product_name}</p>
              </div>
              <table style={S.metaTable}><tbody>
                <tr><td style={S.metaKey}>Product</td><td style={S.metaVal}>{product_name}</td></tr>
                <tr><td style={S.metaKey}>Facility</td><td style={S.metaVal}>{facility_name}</td></tr>
                {doc_number && <tr><td style={S.metaKey}>Protocol Ref.</td><td style={S.metaVal}>{doc_number}</td></tr>}
                <tr><td style={S.metaKey}>DEHT Limit</td><td style={S.metaVal}>{hrs} hours</td></tr>
                <tr><td style={S.metaKey}>Submitted By</td><td style={S.metaVal}>{submitted_by}</td></tr>
                <tr><td style={S.metaKey}>Date</td><td style={S.metaVal}>{submitted_at ? new Date(submitted_at).toLocaleDateString("en-IN") : "—"}</td></tr>
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
              <td style={S.tdKey}>DEHT Limit (hrs)</td><td style={S.tdVal}><strong style={{ color: "#004f9f" }}>{hrs} hours</strong></td>
              <td style={S.tdKey}>Completion Date</td>
              <td style={S.tdVal}>{results_data.completion_date ? new Date(results_data.completion_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
            </tr>
            <tr>
              <td style={S.tdKey}>SOP Followed</td><td style={S.tdVal}>{results_data.sop_followed || "—"}</td>
              <td style={S.tdKey}>Submitted By</td><td style={S.tdVal}>{submitted_by}</td>
            </tr>
          </tbody></table>
        </div>

        {/* § 2 Training Details */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>2. Training &amp; Compliance</p>
          <table style={S.dataTable}><tbody>
            <tr>
              <td style={{ ...S.tdKey, width: "180px" }}>Training Details</td>
              <td style={S.tdVal}>{results_data.training_details || "—"}</td>
            </tr>
          </tbody></table>
        </div>

        {/* § 3 DEHT Results per Run */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>3. DEHT Results</p>
          {runs.map((run, ri) => (
            <div key={ri} style={{ marginBottom: "20px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ background: "#004f9f", color: "white", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", fontSize: "13px" }}>Run {run.run_number}</span>
                <span style={{ fontSize: "12px", opacity: 0.85 }}>Batch: {run.batch_number || "—"}</span>
              </div>
              <table style={{ ...S.dataTable, margin: 0 }}>
                <thead>
                  <tr style={{ background: "#e8f0fb" }}>
                    <th style={S.th}>Equipment</th>
                    <th style={S.th}>Usage Completion</th>
                    <th style={S.th}>Cleaning Start</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Hold Time (hrs)</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Limit (hrs)</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Status</th>
                    <th style={S.th}>Sample Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(run.equipment_results || []).map((eq, ei) => {
                    const ht = eq.hold_time_hours != null ? eq.hold_time_hours : calcHoldTime(eq.usage_end_datetime, eq.cleaning_start_datetime);
                    return (
                      <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ ...S.td, fontWeight: "600" }}>{eq.equipment_name || "—"}</td>
                        <td style={S.td}>{eq.usage_end_datetime ? new Date(eq.usage_end_datetime).toLocaleString("en-IN") : "—"}</td>
                        <td style={S.td}>{eq.cleaning_start_datetime ? new Date(eq.cleaning_start_datetime).toLocaleString("en-IN") : "—"}</td>
                        <td style={{ ...S.td, textAlign: "center", fontWeight: "bold" }}>{ht != null ? ht : "—"}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{eq.limit_hours ?? hrs}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{holdTimeBadge(ht, eq.limit_hours ?? hrs)}</td>
                        <td style={S.td}>{eq.sample_points || "—"}</td>
                      </tr>
                    );
                  })}
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
              <div style={{ borderBottom: "1px solid #333", marginBottom: "4px" }} />
              <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>Name / Date / Signature</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.docFooter} className="doc-footer">
          <span>Cipla Ltd. — Confidential | DEHT Study Report</span>
          <span>{product_name} — {facility_name}</span>
          <span>Submitted by: {submitted_by}</span>
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      <div style={S.pageHeader}>
        <h2 style={{ margin: 0 }}>Dirty Equipment Hold Time (DEHT) Study</h2>
        <button onClick={goHome} style={S.backBtn}>Back to Home</button>
      </div>

      {dehtHours != null && (
        <div style={{ background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "8px",
          padding: "10px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", color: "#555" }}>
            Current DEHT Limit (from Lifecycle Policy):
          </span>
          <span style={{ fontSize: "18px", fontWeight: "bold", color: "#004f9f" }}>
            {dehtHours} hours
          </span>
          {dehtMeta?.updated_by && (
            <span style={{ fontSize: "11px", color: "#888" }}>
              Updated by {dehtMeta.updated_by}
              {dehtMeta.updated_at && ` on ${new Date(dehtMeta.updated_at).toLocaleDateString("en-IN")}`}
            </span>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        {[["protocol", "Protocol"], ["report", "Report"]].map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={activeTab === t ? S.tabActive : S.tabInactive}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PROTOCOL TAB ──────────────────────────────────────── */}
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
                  <label style={S.filterLabel}>Product</label>
                  <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                    style={S.select} disabled={!selectedFacility}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                  </select>
                </div>
                {role === "VIEWER"
                  ? <p style={{ margin: 0, fontSize: "13px", color: "#856404", background: "#fff3cd", padding: "8px 12px", borderRadius: "6px" }}>
                      Viewer role cannot generate protocols.
                    </p>
                  : <button onClick={generateProtocol} disabled={loading || !selectedProduct}
                      style={loading || !selectedProduct ? S.genBtnDisabled : S.genBtn}>
                      {loading ? "Generating..." : "Generate Protocol"}
                    </button>
                }
                {protocolData && (
                  <>
                    <button onClick={handlePrint} style={S.printBtn}>Print PDF</button>
                    {role !== "VIEWER" && (
                      <button onClick={() => { setSaveStatus("Draft"); setSavePassword(""); setShowSaveModal(true); }}
                        style={S.archiveBtn}>
                        Save Protocol
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={S.filterCard}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={handlePrint} style={S.printBtn}>Print PDF</button>
                <button onClick={() => setArchiveDoc(null)} style={S.backBtn}>Back to Generator</button>
                <span style={{ fontSize: "12px", color: "#888" }}>Viewing archived version — data is frozen at time of generation</span>
              </div>
            </div>
          )}

          {!displayProtocol && !loading && (
            <div style={S.emptyState}>
              <p style={{ margin: 0, color: "#888" }}>
                Select a facility and product, then click <strong>Generate Protocol</strong>.
              </p>
            </div>
          )}

          {displayProtocol && (
            <div style={{ background: "#c8cdd6", padding: "28px 0 40px", margin: "0 -20px" }}>
              <div style={{ maxWidth: "794px", margin: "0 auto", padding: "0 16px" }}>
                {renderProtocolDoc()}
              </div>
            </div>
          )}

          {/* Archived protocols list */}
          <div style={{ background: "white", borderRadius: "10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, color: "#004f9f", fontSize: "15px" }}>Archived DEHT Protocols</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setShowArchiveTable(v => !v)} style={{ ...S.refreshBtn, background: "#6c757d" }}>
                  {showArchiveTable ? "Hide" : "Show"}
                </button>
                <button onClick={loadArchives} style={S.refreshBtn}>Refresh</button>
              </div>
            </div>

            {showArchiveTable && (
              archiveLoading ? <p style={{ color: "#888" }}>Loading...</p>
              : archiveList.length === 0
                ? <div style={{ textAlign: "center", padding: "32px 24px", color: "#888" }}>
                    <p style={{ fontSize: "14px", marginBottom: "6px" }}>No archived DEHT protocols yet.</p>
                    <p style={{ fontSize: "12px" }}>Generate a protocol and click <strong>Save Protocol</strong>.</p>
                  </div>
                : <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#004f9f", color: "white" }}>
                          {["Document No.", "Ver.", "Product", "Facility", "Generated By", "Date", "Status", "Actions"].map(h => (
                            <th key={h} style={archCell}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {archiveList.map((a, i) => (
                          <tr key={a.archive_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                            <td style={{ ...archCell, fontWeight: "bold", color: "#004f9f" }}>{a.doc_number}</td>
                            <td style={{ ...archCell, textAlign: "center" }}>v{a.version}</td>
                            <td style={archCell}>{a.product_name}</td>
                            <td style={archCell}>{a.facility_name || "—"}</td>
                            <td style={archCell}>{a.generated_by}</td>
                            <td style={archCell}>{new Date(a.generated_at).toLocaleDateString("en-IN")}</td>
                            <td style={archCell}>{statusBadge(a.status)}</td>
                            <td style={archCell}>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => viewArchive(a.archive_id)} style={S.viewBtn}>View</button>
                                {role !== "VIEWER" && (
                                  <button onClick={() => { setSelectedArchive(a); setDeleteArchivePwd(""); setShowDeleteArchiveModal(true); }}
                                    style={S.deleteBtn}>Delete</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>
        </div>
      )}

      {/* ── REPORT TAB ────────────────────────────────────────── */}
      {activeTab === "report" && (
        <div style={{ background: "white", borderRadius: "0 10px 10px 10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

          {!viewingReport ? (
            <>
              <h3 style={{ color: "#004f9f", marginTop: 0 }}>Create DEHT Study Report</h3>

              {/* Protocol selector */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "16px" }}>
                <div>
                  <label style={S.filterLabel}>Select Approved (Final) DEHT Protocol</label>
                  <select
                    value={selectedProtocol?.archive_id || ""}
                    onChange={e => {
                      const proto = finalProtocols.find(p => p.archive_id === parseInt(e.target.value));
                      if (proto) handleProtocolSelect(proto);
                      else { setSelectedProtocol(null); resetReportForm(); }
                    }}
                    style={{ ...S.select, minWidth: "320px" }}
                    disabled={protocolsLoading}>
                    <option value="">Select Protocol</option>
                    {finalProtocols.map(p => (
                      <option key={p.archive_id} value={p.archive_id}>
                        {p.doc_number} v{p.version} — {p.product_name} — {new Date(p.generated_at).toLocaleDateString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={loadFinalProtocols} style={S.refreshBtn} disabled={protocolsLoading}>
                  {protocolsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {reportNotice && (
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px",
                  padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#856404" }}>
                  {reportNotice}
                </div>
              )}

              {selectedProtocol && (
                <>
                  {/* Protocol info banner */}
                  <div style={{ background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "6px",
                    padding: "10px 14px", marginBottom: "16px" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#004f9f" }}>
                      <strong>Protocol:</strong> {selectedProtocol.doc_number} v{selectedProtocol.version}
                      {" · "}<strong>Product:</strong> {selectedProtocol.product_name}
                      {" · "}<strong>DEHT Limit:</strong> {reportDehtHours ?? "—"} hours
                    </p>
                  </div>

                  {/* Save draft reminder */}
                  <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px",
                    padding: "8px 14px", marginBottom: "16px", fontSize: "12px", color: "#92400e",
                    display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>Use <strong>Save Draft</strong> regularly to avoid losing your data.</span>
                  </div>

                  {/* Draft loaded notice */}
                  {existingReport?.status === "Draft" && (
                    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px",
                      padding: "8px 14px", marginBottom: "12px", fontSize: "12px", color: "#856404" }}>
                      <strong>Draft loaded.</strong> Previously saved draft has been restored. Continue editing and save again or submit.
                    </div>
                  )}

                  {/* 3 Runs */}
                  {runResults.map((run, runIdx) => (
                    <div key={runIdx} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "20px", overflow: "hidden" }}>
                      <div style={{ background: "#004f9f", color: "white", padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "14px" }}>Run {run.run_number}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <label style={{ fontSize: "12px", opacity: 0.85 }}>Batch Number:</label>
                          <input
                            value={run.batch_number}
                            onChange={e => handleRunChange(runIdx, 0, "batch_number", e.target.value)}
                            placeholder="e.g. B-2025-001"
                            style={{ padding: "4px 8px", borderRadius: "4px", border: "none", fontSize: "13px",
                              width: "160px", color: "#333" }} />
                        </div>
                      </div>

                      {run.equipment_results.length === 0 ? (
                        <div style={{ padding: "16px", color: "#aaa", fontStyle: "italic", textAlign: "center", fontSize: "13px" }}>
                          No equipment loaded. Select a protocol and click Load.
                        </div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ background: "#e8f0fb" }}>
                                <th style={sampCell}>Equipment Name</th>
                                <th style={sampCell}>Usage Completion Date/Time</th>
                                <th style={sampCell}>Cleaning Start Date/Time</th>
                                <th style={{ ...sampCell, textAlign: "center" }}>Hold Time (hrs)</th>
                                <th style={{ ...sampCell, textAlign: "center" }}>Limit (hrs)</th>
                                <th style={{ ...sampCell, textAlign: "center" }}>Status</th>
                                <th style={sampCell}>Sample Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.equipment_results.map((eq, ei) => {
                                const ht = eq.hold_time_hours != null
                                  ? eq.hold_time_hours
                                  : calcHoldTime(eq.usage_end_datetime, eq.cleaning_start_datetime);
                                const lim = eq.limit_hours ?? reportDehtHours;
                                return (
                                  <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#f8fafc" }}>
                                    <td style={{ ...sampCell, fontWeight: "600" }}>{eq.equipment_name || "—"}</td>
                                    <td style={sampCell}>
                                      <input
                                        type="datetime-local"
                                        value={eq.usage_end_datetime || ""}
                                        onChange={e => handleRunChange(runIdx, ei, "usage_end_datetime", e.target.value)}
                                        style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px" }} />
                                    </td>
                                    <td style={sampCell}>
                                      <input
                                        type="datetime-local"
                                        value={eq.cleaning_start_datetime || ""}
                                        onChange={e => handleRunChange(runIdx, ei, "cleaning_start_datetime", e.target.value)}
                                        style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px" }} />
                                    </td>
                                    <td style={{ ...sampCell, textAlign: "center", fontWeight: "bold",
                                      color: ht != null ? (ht > (lim || Infinity) ? "#dc3545" : "#155724") : "#666" }}>
                                      {ht != null ? ht : "—"}
                                    </td>
                                    <td style={{ ...sampCell, textAlign: "center" }}>
                                      {lim ?? "—"}
                                    </td>
                                    <td style={{ ...sampCell, textAlign: "center" }}>
                                      {holdTimeBadge(ht, lim)}
                                    </td>
                                    <td style={sampCell}>
                                      <input
                                        value={eq.sample_points || ""}
                                        onChange={e => handleRunChange(runIdx, ei, "sample_points", e.target.value)}
                                        placeholder="e.g. S-0001, S-0002"
                                        style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc",
                                          fontSize: "12px", width: "140px" }} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Metadata fields */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", gap: "16px", marginBottom: "4px" }}>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Completion Date *</label>
                        <input type="date" value={completionDate}
                          onChange={e => setCompletionDate(e.target.value)}
                          max={new Date().toISOString().split("T")[0]}
                          style={S.input} />
                        <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Date Run-3 was completed</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>SOP Followed *</label>
                        <input value={sopFollowed} onChange={e => setSopFollowed(e.target.value)}
                          placeholder="e.g. CL-SOP-DEHT-001-v1.0" style={S.input} />
                      </div>
                    </div>
                    <label style={S.label}>Training Details *</label>
                    <textarea value={trainingDetails} onChange={e => setTrainingDetails(e.target.value)}
                      placeholder="e.g. John Doe, Alice Smith — trained on SOP-DEHT-001 on 2025-05-10"
                      style={{ ...S.input, minHeight: "60px", fontFamily: "Arial" }} />
                  </div>

                  {/* Action buttons */}
                  {role === "VIEWER"
                    ? <p style={{ margin: 0, fontSize: "13px", color: "#856404", background: "#fff3cd",
                          padding: "8px 12px", borderRadius: "6px" }}>
                        Viewer role cannot submit reports.
                      </p>
                    : existingReport && existingReport.status !== "Draft"
                      ? <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "6px",
                            padding: "10px 14px", fontSize: "13px", color: "#721c24" }}>
                          A <strong>{existingReport.status}</strong> report already exists for this protocol. Delete the existing report to re-create it.
                        </div>
                      : <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button onClick={saveDraft} disabled={savingDraft}
                            style={{ ...S.genBtn, background: savingDraft ? "#aaa" : "#92400e", cursor: savingDraft ? "not-allowed" : "pointer" }}>
                            {savingDraft ? "Saving..." : "Save Draft"}
                          </button>
                          <button onClick={() => { setSubmitPassword(""); setSubmitReason(""); setShowSubmitModal(true); }}
                            style={S.genBtn}>
                            Submit Report
                          </button>
                        </div>
                  }
                </>
              )}

              {/* Report list */}
              <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid #e2e8f0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ color: "#004f9f", margin: 0 }}>Previous DEHT Reports</h3>
                <button onClick={loadReportList} style={S.refreshBtn}>Refresh</button>
              </div>

              {reportListError && (
                <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "6px",
                  padding: "10px 14px", marginBottom: "12px", fontSize: "13px", color: "#721c24" }}>
                  {reportListError}
                </div>
              )}

              {reportListLoading ? <p style={{ color: "#888" }}>Loading...</p>
              : reportList.length === 0
                ? <p style={{ color: "#888", fontStyle: "italic" }}>No DEHT reports submitted yet.</p>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#004f9f", color: "white" }}>
                        {["Product", "Protocol Ref.", "Submitted By", "Date", "Status", "Actions"].map(h => (
                          <th key={h} style={archCell}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportList.map((r, i) => (
                        <tr key={r.report_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                          <td style={archCell}>{r.product_name}</td>
                          <td style={archCell}>{r.doc_number || r.protocol_doc_number || "—"}</td>
                          <td style={archCell}>{r.submitted_by}</td>
                          <td style={archCell}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-IN") : "—"}</td>
                          <td style={archCell}>{statusBadge(r.status)}</td>
                          <td style={archCell}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button onClick={() => viewReportDetail(r.report_id)} style={S.viewBtn}>View</button>
                              {["QA", "ADMIN"].includes(role) && r.status === "Submitted" && (
                                <button onClick={() => { setApproveTarget(r); setApprovePwd(""); setShowApproveModal(true); }}
                                  style={{ ...S.viewBtn, background: "#155724", color: "white", border: "none" }}>
                                  Approve
                                </button>
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
                )
              }
            </>
          ) : (
            /* View Report Detail */
            <>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
                <button onClick={() => setViewingReport(null)} style={S.backBtn}>Back to List</button>
                {viewingReport.results_data && (
                  <>
                    <button onClick={handleReportPrint} style={S.printBtn}>Print PDF</button>
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
                <p style={{ color: "#888", padding: "24px" }}>Loading report...</p>
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

      {/* ── MODALS ────────────────────────────────────────────── */}

      {/* Save protocol modal */}
      {showSaveModal && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#004f9f", marginTop: 0 }}>Save DEHT Protocol</h3>
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
            Saves a <strong>frozen snapshot</strong> of this protocol. Future changes to equipment or DEHT hours
            will not affect the archived version.
          </p>
          <table style={{ fontSize: "13px", width: "100%", marginBottom: "16px" }}><tbody>
            <tr><td style={{ padding: "3px 8px", color: "#888", width: "130px" }}>Document No.</td>
                <td style={{ padding: "3px 8px", fontWeight: "bold" }}>{displayDocNumber}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Product</td>
                <td style={{ padding: "3px 8px" }}>{protocolData?.productName}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Facility</td>
                <td style={{ padding: "3px 8px" }}>{protocolData?.facilityName}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>DEHT Limit</td>
                <td style={{ padding: "3px 8px", fontWeight: "bold", color: "#004f9f" }}>{dehtHours} hours</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Equipment Count</td>
                <td style={{ padding: "3px 8px" }}>{protocolData?.equipmentList?.length || 0} equipment items</td></tr>
          </tbody></table>
          <label style={S.label}>Status</label>
          <select value={saveStatus} onChange={e => setSaveStatus(e.target.value)} style={S.input}>
            <option value="Draft">Draft</option>
            <option value="Final">Final</option>
          </select>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={savePassword} onChange={e => setSavePassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveToArchive(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button onClick={saveToArchive} disabled={saveLoading}
              style={saveLoading ? S.saveBtnDisabled : S.saveBtn}>
              {saveLoading ? "Saving..." : "Save Protocol"}
            </button>
            <button onClick={() => setShowSaveModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Delete archive modal */}
      {showDeleteArchiveModal && selectedArchive && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Delete Archived Protocol</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{selectedArchive.doc_number} — Version {selectedArchive.version}</strong><br />
            <span style={{ color: "#888" }}>{selectedArchive.product_name} · {new Date(selectedArchive.generated_at).toLocaleDateString("en-IN")}</span>
          </p>
          <p style={{ fontSize: "12px", background: "#f8d7da", padding: "8px 10px", borderRadius: "5px", color: "#721c24" }}>
            This action cannot be undone.
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={deleteArchivePwd}
            onChange={e => setDeleteArchivePwd(e.target.value)}
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

      {/* Submit report modal */}
      {showSubmitModal && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#004f9f", marginTop: 0 }}>Submit DEHT Study Report</h3>
          <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
            Submit report for <strong>{selectedProtocol?.doc_number}</strong>
            {" · "}<strong>{selectedProtocol?.product_name}</strong>
          </p>
          <div style={{ background: "#f0f4ff", padding: "8px 10px", borderRadius: "5px", marginBottom: "14px", fontSize: "12px" }}>
            Ensure all 3 runs have hold times recorded and all required fields are completed before submitting.
          </div>
          <label style={S.label}>Reason / Comments (optional)</label>
          <input value={submitReason} onChange={e => setSubmitReason(e.target.value)}
            placeholder="e.g. All 3 runs completed, hold times within limit"
            style={S.input} />
          <label style={S.label}>Your Password *</label>
          <input type="password" value={submitPassword} onChange={e => setSubmitPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitReport(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button onClick={submitReport} disabled={submitting}
              style={submitting ? S.saveBtnDisabled : S.saveBtn}>
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
            <button onClick={() => setShowSubmitModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* Approve report modal */}
      {showApproveModal && approveTarget && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#155724", marginTop: 0 }}>Approve DEHT Study Report</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{approveTarget.product_name}</strong><br />
            <span style={{ color: "#888" }}>Submitted by {approveTarget.submitted_by}</span>
          </p>
          <p style={{ fontSize: "12px", background: "#d4edda", padding: "8px 10px", borderRadius: "5px", color: "#155724", marginBottom: "14px" }}>
            Approving confirms that all DEHT run data meets the acceptance criteria.
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

      {/* Delete report modal */}
      {showDeleteReportModal && deleteReportTarget && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Delete DEHT Study Report</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{deleteReportTarget.product_name}</strong><br />
            <span style={{ color: "#888" }}>
              Submitted by {deleteReportTarget.submitted_by}
              {deleteReportTarget.submitted_at
                ? ` on ${new Date(deleteReportTarget.submitted_at).toLocaleDateString("en-IN")}`
                : ""}
            </span>
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

    </div>
  );
}

const archCell = { border: "1px solid #ddd", padding: "8px 10px" };
const sampCell = { border: "1px solid #e2e8f0", padding: "8px 10px" };

const S = {
  pageHeader:      { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn:         { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  tabBar:          { display: "flex", gap: "4px", marginBottom: "20px" },
  tabActive:       { padding: "10px 24px", background: "#004f9f", color: "white", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  tabInactive:     { padding: "10px 24px", background: "white", color: "#555", border: "1px solid #e2e8f0", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  filterCard:      { background: "white", borderRadius: "0 10px 10px 10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "16px" },
  filterLabel:     { display: "block", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  select:          { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "220px", cursor: "pointer" },
  genBtn:          { padding: "9px 18px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  genBtnDisabled:  { padding: "9px 18px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "13px" },
  printBtn:        { padding: "9px 18px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  archiveBtn:      { padding: "9px 18px", background: "#6f42c1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  refreshBtn:      { padding: "7px 14px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  viewBtn:         { padding: "5px 12px", background: "#004f9f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  deleteBtn:       { padding: "5px 10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  emptyState:      { textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  overlay:         { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal:           { background: "white", padding: "28px", borderRadius: "10px", width: "460px", boxShadow: "0px 10px 30px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" },
  label:           { display: "block", marginBottom: "5px", marginTop: "12px", fontWeight: "bold", fontSize: "13px" },
  input:           { padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  saveBtn:         { padding: "10px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  saveBtnDisabled: { padding: "10px 16px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", flex: 1 },
  cancelBtn:       { padding: "10px 16px", background: "#555",     color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  // Protocol document
  docHeader:       { padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: "20px", borderBottom: "2px solid #004f9f" },
  docTitle:        { margin: "0 0 4px", fontSize: "18px", color: "#004f9f", fontWeight: "bold" },
  docSub:          { margin: 0, fontSize: "13px", color: "#666" },
  metaTable:       { fontSize: "11px", borderCollapse: "collapse" },
  metaKey:         { color: "#888", padding: "2px 8px 2px 0", whiteSpace: "nowrap" },
  metaVal:         { fontWeight: "bold", color: "#222", padding: "2px 0" },
  section:         { padding: "18px 24px", marginBottom: "2px", borderLeft: "4px solid #e2e8f0" },
  sectionTitle:    { margin: "0 0 12px", fontSize: "14px", fontWeight: "bold", color: "#004f9f", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" },
  para:            { margin: "0 0 8px", fontSize: "13px", color: "#444", lineHeight: "1.6" },
  dataTable:       { width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "4px" },
  th:              { background: "#e8f0fb", color: "#004f9f", padding: "7px 10px", textAlign: "left", fontWeight: "bold", border: "1px solid #d0dff7" },
  td:              { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#333" },
  tdKey:           { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#888", fontWeight: "600", width: "180px", background: "#f8fafc" },
  tdVal:           { border: "1px solid #e2e8f0", padding: "6px 10px", color: "#222" },
  sigGrid:         { padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "32px" },
  sigBox:          { display: "flex", flexDirection: "column" },
  docFooter:       { background: "#f8fafc", padding: "10px 24px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#888", borderTop: "1px solid #e2e8f0" },
};
