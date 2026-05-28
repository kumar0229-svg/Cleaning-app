import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/falcon-logo.svg";

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

function compareResultToLimit(result, limit) {
  if (!result || !limit) return null;
  const r = parseFloat(result), l = parseFloat(limit);
  if (isNaN(r) || isNaN(l)) return null;
  return r <= l ? "PASS" : "FAIL";
}

const FORMULA_TEXT = {
  pde:   "MACO(PDE)  = [PDE_source (mg) × Min_Yield_next (kg) × 1,000,000] / Max_Daily_Dose_next (mg)",
  dose:  "MACO(Dose) = [Min_Dose_source (mg) × Min_Yield_next (kg) × 1,000,000] / [Max_Daily_Dose_next (mg) × 1000]",
  ppm:   "MACO(10ppm) = [Min_Yield_next (kg) × 1,000,000 × 10] / 1,000,000",
  rinse: "Rinse (ppm) = [MACO (mg) × Rinse_Area (in²)] / [Shared_Surface_Area (in²) × Rinse_Sample_Vol (L)]",
  swab:  "Swab Limit (ppm)  = (MACO × Swab_area_in² × 1000) / (Chain_area_in² × 10 mL)",
};

export default function DEHTPage({ goHome, currentUser, role }) {

  // ── Core state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState("protocol");
  const [facilities, setFacilities]     = useState([]);
  const [products, setProducts]         = useState([]);
  const [selectedFacility, setSelectedFacility] = useState("");
  const [selectedProduct, setSelectedProduct]   = useState("");
  const [dehtHours, setDehtHours]             = useState(null);
  const [dehtMeta, setDehtMeta]               = useState(null);
  const [result, setResult]                   = useState(null);
  const [sourceProduct, setSourceProduct]     = useState(null);
  const [policy, setPolicy]                   = useState(null);
  const [protocolSamplingPlan, setProtocolSamplingPlan] = useState([]);
  const [loading, setLoading]                 = useState(false);
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
  const displayResult        = archiveDoc?.result        ?? result;
  const displaySourceProduct = archiveDoc?.sourceProduct ?? sourceProduct;
  const displaySamplingPlan  = archiveDoc?.samplingPlan  ?? protocolSamplingPlan;
  const displayDocNumber     = archiveDoc?.docNumber ??
    (result ? `DEHT-PROTO-${String(sourceProduct?.product_id || "").padStart(4, "0")}-${new Date().getFullYear()}` : "—");
  const getFacilityName = (fid) =>
    archiveDoc ? archiveDoc.facilityName
               : (facilities.find(f => f.facility_id === fid)?.facility_name || fid);

  // ── Boot: load facilities, policy, DEHT hours ──────────────────────
  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(console.log);
    api.get("/policy").then(r => setPolicy(r.data)).catch(console.log);
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
      alert(apiError(err, "Error generating protocol ❌"));
    } finally { setLoading(false); }
  };

  // ── Archive: view ───────────────────────────────────────────────────
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

  // ── Archive: save ───────────────────────────────────────────────────
  const saveToArchive = async () => {
    if (!result || !sourceProduct) return;
    if (!savePassword.trim()) { alert("Enter your password ❌"); return; }
    setSaveLoading(true);
    try {
      const facilityName = facilities.find(f => f.facility_id === sourceProduct.facility_id)?.facility_name || "";
      const docNum = `DEHT-PROTO-${String(sourceProduct.product_id).padStart(4, "0")}-${new Date().getFullYear()}`;
      const snapshot = { result, sourceProduct, facilityName, docNumber: docNum, samplingPlan: protocolSamplingPlan, dehtHours };
      const res = await api.post("/protocol/archive", {
        snapshot,
        doc_number: docNum,
        product_id: sourceProduct.product_id,
        product_name: sourceProduct.product_name,
        facility_name: facilityName,
        status: saveStatus,
        password: savePassword,
      });
      setShowSaveModal(false);
      setSavePassword("");
      alert(`Saved: ${res.data.doc_number}  Version ${res.data.version} ✅`);
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
      const [archiveRes, planRes, equipRes] = await Promise.all([
        api.get(`/protocol/archive/${protocol.archive_id}`),
        api.get("/sampling/plan"),
        api.get("/equipment/all"),
      ]);
      const snap = archiveRes.data.snapshot;
      const pairs = snap.result?.data || [];
      const hrs = snap.dehtHours ?? dehtHours;
      setReportDehtHours(hrs);

      // Live sampling plan entries by category
      const catEntries = {};
      planRes.data.forEach(cat => { catEntries[cat.category_id] = cat.entries || []; });

      // Fallback: resolve category_id from live equipment when snapshot predates field
      const liveEqCatMap = {};
      equipRes.data.forEach(e => { liveEqCatMap[e.equipment_name] = e.category_id; });

      // Per-equipment governing limits (min across all pairs)
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

      // Collect unique final-step equipment
      const eqMap = {};
      pairs.forEach(pair => {
        (pair.shared_equipment || []).forEach(eq => {
          if (!eqMap[eq.name]) {
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

      // Synthesis-step equipment (fixed 10 ppm)
      const synthSteps = snap.result?.synthesis_steps || [];
      const addSynthEq = (eq) => {
        if (eqMap[eq.name]) return;
        const resolvedCatId = eq.category_id ?? liveEqCatMap[eq.name] ?? null;
        eqMap[eq.name] = {
          equipment_name: eq.name,
          category_id: resolvedCatId,
          category_name: eq.category_name ?? planRes.data.find(c => c.category_id === resolvedCatId)?.category_name ?? "—",
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
        swab_limit_ppm: eq.eq_type === "synthesis" ? 10.0
          : (eqLimitsMap[eq.equipment_name]?.swab_final ?? govSwab),
        rinse_result_ppm: "",
        rinse_lot_number: "",
        swab_results: (catEntries[eq.category_id] || []).map(entry => ({
          sample_number: entry.sample_number,
          location_description: entry.location_description,
          result_ppm: "",
          lot_number: "",
        })),
        usage_end_datetime: "",
        cleaning_start_datetime: "",
        hold_time_hours: null,
        limit_hours: hrs,
      }));

      if (existingDraft?.status === "Draft" && existingDraft.results_data?.runs) {
        const draftRuns = existingDraft.results_data.runs;
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
                usage_end_datetime: draftEq.usage_end_datetime || "",
                cleaning_start_datetime: draftEq.cleaning_start_datetime || "",
                hold_time_hours: draftEq.hold_time_hours ?? null,
                limit_hours: hrs,
              };
            }),
          };
        }));
        setTrainingDetails(existingDraft.results_data.training_details || "");
        setSopFollowed(existingDraft.results_data.sop_followed || "");
        setCompletionDate(existingDraft.results_data.completion_date || "");
      } else {
        setRunResults([
          { run_number: 1, batch_number: "", equipment_results: equipmentResults },
          { run_number: 2, batch_number: "", equipment_results: equipmentResults.map(eq => ({ ...eq })) },
          { run_number: 3, batch_number: "", equipment_results: equipmentResults.map(eq => ({ ...eq })) },
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
  const handleRunChange = (runIdx, equipIdx, field, value, swabIdx) => {
    setRunResults(prev => prev.map((run, ri) => {
      if (ri !== runIdx) return run;
      if (field === "batch_number") return { ...run, batch_number: value };
      const eqs = run.equipment_results.map((eq, ei) => {
        if (ei !== equipIdx) return eq;
        if (field === "swab_result_ppm" || field === "swab_lot_number") {
          const key = field === "swab_result_ppm" ? "result_ppm" : "lot_number";
          const swab_results = (eq.swab_results || []).map((s, si) =>
            si === swabIdx ? { ...s, [key]: value } : s
          );
          return { ...eq, swab_results };
        }
        const updated = { ...eq, [field]: value };
        if (field === "usage_end_datetime" || field === "cleaning_start_datetime") {
          const uEnd   = field === "usage_end_datetime"    ? value : eq.usage_end_datetime;
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
        if (!eq.rinse_result_ppm) {
          alert(`Rinse result required for Run ${i + 1}, ${eq.equipment_name}.`); return false;
        }
        if (isNaN(parseFloat(eq.rinse_result_ppm))) {
          alert(`Rinse result must be numeric (Run ${i + 1}, ${eq.equipment_name}).`); return false;
        }
        for (let k = 0; k < (eq.swab_results || []).length; k++) {
          const swab = eq.swab_results[k];
          if (!swab.result_ppm) {
            alert(`Swab result required for Run ${i + 1}, ${eq.equipment_name} — ${swab.sample_number}.`); return false;
          }
          if (isNaN(parseFloat(swab.result_ppm))) {
            alert(`Swab result must be numeric (Run ${i + 1}, ${eq.equipment_name} — ${swab.sample_number}).`); return false;
          }
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
@page{size:A4 portrait;margin:22mm 14mm 18mm 14mm;@bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Arial,sans-serif;font-size:7.5pt;color:#666}}
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
  <img src="${logoDataUrl}" alt="Falcon"/>
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
  <span>Falcon &mdash; Confidential</span>
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
@page{size:A4 landscape;margin:18mm 12mm 15mm 12mm;@bottom-center{content:"Page " counter(page) " of " counter(pages);font-family:Arial,sans-serif;font-size:7pt;color:#666}}
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
  <img src="${logoDataUrl}" alt="Falcon"/>
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
  <span>Falcon &mdash; Confidential</span>
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
    const r  = displayResult;
    const sp = displaySourceProduct;
    if (!r) return null;
    if (!r.source) return (
      <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
        Re-generate this protocol to view the updated DEHT protocol document.
      </div>
    );

    const docNum = displayDocNumber;
    const hrs    = (archiveDoc?.dehtHours ?? dehtHours) ?? "—";

    const catMap = new Map();
    r.data?.forEach(pair => pair.shared_equipment?.forEach(eq => {
      if (eq.category_id && !catMap.has(eq.category_id))
        catMap.set(eq.category_id, eq.category_name);
    }));
    const relevantPlan = displaySamplingPlan
      .filter(c => catMap.size === 0 || catMap.has(c.category_id))
      .filter(c => c.entries.length > 0);

    // Collect unique final-product equipment for the DEHT procedure table
    const finalEqMap = {};
    (r.data || []).forEach(pair =>
      (pair.shared_equipment || []).forEach(eq => {
        if (!finalEqMap[eq.name]) finalEqMap[eq.name] = eq;
      })
    );
    const allEquipment = Object.values(finalEqMap);

    return (
      <div ref={printRef} style={{ background: "white", boxShadow: "0 4px 28px rgba(0,0,0,0.32)", minHeight: "1123px" }}>

        {/* Archive banner */}
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
                <h3 style={S.docTitle}>Dirty Equipment Hold Time (DEHT) Study Protocol</h3>
                <p style={S.docSub}>Cleaning Validation with DEHT Determination — MACO Methodology</p>
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

        {/* § 1 Scope & Objective */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>1. Scope &amp; Objective</p>
          <p style={S.para}>
            This protocol defines the Maximum Allowable Carryover (MACO) cleaning limits for{" "}
            <strong>{r.source}</strong> as a source (previous) product manufactured at{" "}
            <strong>{getFacilityName(sp?.facility_id)}</strong>, and establishes the Dirty Equipment
            Hold Time (DEHT) study procedure to determine the maximum allowable time between end of
            production and start of cleaning.
          </p>
          <p style={S.para}>
            MACO limits are derived using the <strong>{r.policy_label || r.policy}</strong> methodology
            in accordance with ICH Q7, EMA/CHMP/CVMP/SWP/169430/2012, and applicable site SOPs.
            The maximum allowable dirty hold time is <strong>{hrs} hours</strong> as defined in the
            Cleaning Validation Calculation Policy.
          </p>
        </div>

        {/* § 2 Source Product Information */}
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

        {/* § 3 Calculation Methodology */}
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
              <p style={{ ...S.para, marginBottom: 0 }}>
                <strong>Fixed 10 ppm Criterion Applied.</strong> The source product <strong>{r.source}</strong> is
                classified as <strong>{r.source_category}</strong>. A fixed limit of <strong>10 ppm</strong> applies
                to all rinse and swab acceptance criteria.
              </p>
            </div>
          ) : (
            <>
              <p style={S.para}>The governing MACO uses the <strong>{r.policy_label || r.policy}</strong> approach.
                All final limits are capped at 10 ppm.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(["all_min","pde_only","pde_dose_min","pde_10ppm_min"].includes(r.policy)) && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — PDE / ADE Based</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.pde}</code>
                    <span style={S.formulaNote}>PDE = Permitted Daily Exposure · BS = Min batch size of target · TDD = Max daily dose of target</span>
                  </div>
                )}
                {(["all_min","dose_only","pde_dose_min"].includes(r.policy)) && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — Dose Based (1/1000th)</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.dose}</code>
                    <span style={S.formulaNote}>TD = Min therapeutic dose · Safety factor = 1000 · BS = Min batch size · TDD = Max daily dose</span>
                  </div>
                )}
                {(["all_min","10ppm_only","pde_10ppm_min"].includes(r.policy)) && (
                  <div style={S.formulaBox} className="formula-box">
                    <span style={S.formulaLabel}>MACO — 10 ppm Criterion</span>
                    <code style={S.formulaCode}>{FORMULA_TEXT.ppm}</code>
                    <span style={S.formulaNote}>10 mg/kg × minimum batch size of target product</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                <div style={S.formulaBox} className="formula-box">
                  <span style={S.formulaLabel}>Rinse Limit</span>
                  <code style={S.formulaCode}>{FORMULA_TEXT.rinse}</code>
                  <span style={S.formulaNote}>Rinse_Area = rinse sampling area (in²) · Shared_Surface_Area = total shared surface area (in²) · Rinse_Sample_Vol = rinse volume (L)</span>
                </div>
                <div style={S.formulaBox} className="formula-box">
                  <span style={S.formulaLabel}>Swab Limit</span>
                  <code style={S.formulaCode}>{FORMULA_TEXT.swab}</code>
                  <span style={S.formulaNote}>Swab_area = swab sampling area (in²) · Chain_area = total equipment surface area (in²) · 10 mL = fixed swab extraction volume</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* § 4 Cleaning Limit Calculations */}
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
                  <table style={S.dataTable}>
                    <thead><tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Equipment</th><th style={S.th}>Category</th>
                      <th style={S.th}>Surface Area (in²)</th><th style={S.th}>Rinse Vol (L)</th>
                      <th style={S.th}>Swab Area (in²)</th><th style={S.th}>Rinse Area (in²)</th>
                    </tr></thead>
                    <tbody>
                      {row.shared_equipment.map((eq, i) => (
                        <tr key={i}>
                          <td style={S.td}>{eq.name}</td><td style={S.td}>{eq.category_name || "—"}</td>
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
                        <strong>Fixed 10 ppm criterion applied</strong> — MACO not applicable for {r.source_category} source.
                        Rinse and swab limits are set to <strong>10.0 ppm</strong>.
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
                            <td style={S.td} colSpan={2}>Governing MACO ({r.policy_label || r.policy})</td>
                            <td style={{ ...S.td, textAlign: "center", color: "#155724" }}>
                              {row.governing_maco_pair != null ? `${row.governing_maco_pair} mg` : "—"}
                            </td>
                            <td style={S.td}/>
                          </tr>
                        </tbody>
                      </table>

                      <p style={{ ...S.subLabel, marginTop: "10px" }}>Per-Equipment Limits (ppm) — Final Product Step</p>
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
                        <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>No final-product-step equipment shared.</p>
                      )}

                      {(row.synthesis_step_equipment || []).length > 0 && (
                        <>
                          <p style={{ ...S.subLabel, marginTop: "12px" }}>Synthesis Intermediate Steps — Fixed 10 ppm</p>
                          {row.synthesis_step_equipment.map((stepGrp, si) => (
                            <div key={si} style={{ marginBottom: "10px", border: "1px solid #fed7aa", borderRadius: "6px", overflow: "hidden" }}>
                              <div style={{ background: "#fff7ed", padding: "7px 12px", borderBottom: "1px solid #fed7aa",
                                display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontWeight: "700", fontSize: "12px", color: "#9a3412" }}>Step {stepGrp.step_number}</span>
                                <span style={{ fontSize: "12px", color: "#7c3aed" }}>Test Compound: <strong>{stepGrp.test_compound || "—"}</strong></span>
                                <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9a3412", fontWeight: "600" }}>Limit: 10 ppm (Rinse &amp; Swab)</span>
                              </div>
                              <table style={{ ...S.dataTable, margin: 0 }}>
                                <thead><tr style={{ background: "#fff7ed" }}>
                                  <th style={S.th}>Equipment</th><th style={S.th}>Category</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Surface Area (in²)</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Rinse Vol (L)</th>
                                  <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Rinse Limit (ppm)</th>
                                  <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Swab Limit (ppm)</th>
                                </tr></thead>
                                <tbody>
                                  {(stepGrp.equipment || []).map((eq, ei) => (
                                    <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#fffbf5" }}>
                                      <td style={S.td}>{eq.name}</td><td style={S.td}>{eq.category_name || "—"}</td>
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

                  <p style={{ ...S.subLabel, marginTop: "12px" }}>Acceptance Criteria (Governing)</p>
                  <table style={S.dataTable}>
                    <thead><tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Criterion</th>
                      {row.scenario !== "fixed_10ppm" && <><th style={S.th}>PDE (ppm)</th><th style={S.th}>Dose (ppm)</th><th style={S.th}>10 ppm (ppm)</th></>}
                      <th style={{ ...S.th, background: "#d0dff7" }}>Final Limit (ppm)</th>
                      <th style={S.th}>LOQ (ppm)</th><th style={S.th}>Status</th>
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
                </>}
            </div>
          ))}
        </div>

        {/* § 5 Governing Cleaning Limit */}
        {(() => {
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
          const synthSteps = r.synthesis_steps || [];
          return (
            <div style={S.section} className="doc-section">
              <p style={S.sectionTitle}>5. Governing Cleaning Limit</p>
              {r.scenario === "fixed_10ppm" ? (
                <p style={S.para}>Fixed 10 ppm applied for <strong>{r.source_category}</strong> source. All rinse and swab limits = <strong>10.0 ppm</strong>.</p>
              ) : (
                <>
                  <div style={S.governingBox} className="governing-box">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
                      <div><p style={S.govLabel}>Governing MACO</p><p style={S.govValue}>{r.governing_maco ?? "—"} mg</p></div>
                      <div><p style={S.govLabel}>Calculation Policy</p><p style={{ ...S.govValue, fontSize: "13px" }}>{r.policy_label || r.policy}</p></div>
                      <div><p style={S.govLabel}>Analytical Method</p><p style={{ ...S.govValue, fontSize: "13px" }}>{r.analytical_method || "—"}</p></div>
                    </div>
                  </div>
                  <p style={S.para}>The governing MACO of <strong>{r.governing_maco ?? "—"} mg</strong> represents the most restrictive cleaning limit across all product pairs (LOQ: {r.loq_ppm} ppm, LOD: {r.lod_ppm} ppm).</p>
                </>
              )}
              {finalProductLimits.length > 0 && (
                <>
                  <p style={{ ...S.subLabel, marginTop: "14px" }}>Final Product Step — Finalized Limits per Equipment</p>
                  <table style={S.dataTable}>
                    <thead><tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Equipment</th><th style={S.th}>Category</th>
                      <th style={{ ...S.th, textAlign: "center" }}>Rinse Limit (ppm)</th>
                      <th style={{ ...S.th, textAlign: "center" }}>Swab Limit (ppm)</th>
                    </tr></thead>
                    <tbody>
                      {finalProductLimits.map((eq, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                          <td style={S.td}>{eq.name}</td><td style={S.td}>{eq.category_name}</td>
                          <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#1d4ed8" }}>{eq.rinse_final ?? "—"}</td>
                          <td style={{ ...S.td, textAlign: "center", fontWeight: "600", color: "#1d4ed8" }}>{eq.swab_final ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {synthSteps.length > 0 && (
                <>
                  <p style={{ ...S.subLabel, marginTop: "16px" }}>Synthesis Intermediate Steps — Fixed 10 ppm Cleaning Limits</p>
                  {synthSteps.map((stepGrp, si) => (
                    <div key={si} style={{ marginBottom: "12px", border: "1px solid #fed7aa", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#fff7ed", padding: "8px 14px", borderBottom: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: "14px" }}>
                        <span style={{ fontWeight: "700", fontSize: "12px", color: "#9a3412" }}>Step {stepGrp.step_number}</span>
                        <span style={{ fontSize: "12px", color: "#7c3aed" }}>Test Compound: <strong>{stepGrp.test_compound || "—"}</strong></span>
                        <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "700", background: "#fed7aa", color: "#9a3412", padding: "2px 10px", borderRadius: "4px" }}>Limit: 10.0 ppm</span>
                      </div>
                      <table style={{ ...S.dataTable, margin: 0 }}>
                        <thead><tr style={{ background: "#fff7ed" }}>
                          <th style={S.th}>Equipment</th><th style={S.th}>Category</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Surface Area (in²)</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Rinse Vol (L)</th>
                          <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Rinse Limit (ppm)</th>
                          <th style={{ ...S.th, textAlign: "center", background: "#fed7aa" }}>Swab Limit (ppm)</th>
                        </tr></thead>
                        <tbody>
                          {(stepGrp.equipment || []).map((eq, ei) => (
                            <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#fffbf5" }}>
                              <td style={S.td}>{eq.name}</td><td style={S.td}>{eq.category_name || "—"}</td>
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
            <p style={S.para}>The cleaning limits for <strong>{r.source}</strong> ({r.source_category}) have been determined by applying the <strong>Fixed 10 ppm criterion</strong>. All rinse and swab acceptance limits are set at <strong>10.0 ppm</strong>.
              {r.data.length > 0 ? ` A total of ${r.data.length} target product(s) were evaluated.` : ""}
              {" "}The limits must be analytically detectable by the <strong>{r.analytical_method || "specified"}</strong> method (LOQ: {r.loq_ppm} ppm).</p>
          ) : (
            <p style={S.para}>The cleaning limits for <strong>{r.source}</strong> have been calculated using the <strong>{r.policy_label || r.policy}</strong> approach. Governing MACO: <strong>{r.governing_maco ?? "—"} mg</strong>.
              {r.data.length > 0 ? ` A total of ${r.data.length} target product(s) were evaluated.` : ""}
              {" "}Limits are analytically detectable and meet acceptance criteria.</p>
          )}
        </div>

        {/* § 7 Swab Sampling Plan */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>7. Swab Sampling Plan</p>
          <p style={S.para}>The following swab sampling locations are defined for each equipment category.
            All samples shall be collected after cleaning and before next product manufacture.</p>
          {relevantPlan.length === 0
            ? <p style={{ color: "#888", fontStyle: "italic", fontSize: "12px" }}>No sampling plan configured.</p>
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
                        <td style={{ ...S.td, fontFamily: "monospace", fontWeight: "bold", color: "#004f9f" }}>{entry.sample_number}</td>
                        <td style={S.td}>{entry.location_description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>

        {/* § 8 DEHT Procedure */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>8. DEHT Study Procedure</p>
          <p style={S.para}>
            Three (3) consecutive runs shall be conducted. For each run, the following data shall be recorded
            for every equipment item in addition to the cleaning validation sampling results:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            {[1, 2, 3].map(runNo => (
              <div key={runNo} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ background: "#004f9f", color: "white", padding: "8px 14px", fontWeight: "bold", fontSize: "13px" }}>
                  Run {runNo}
                </div>
                <table style={{ ...S.dataTable, margin: 0 }}>
                  <thead>
                    <tr style={{ background: "#e8f0fb" }}>
                      <th style={S.th}>Equipment Name</th>
                      <th style={S.th}>Category</th>
                      <th style={S.th}>Usage Completion Date/Time</th>
                      <th style={S.th}>Cleaning Start Date/Time</th>
                      <th style={{ ...S.th, textAlign: "center" }}>Hold Time (hrs)</th>
                      <th style={{ ...S.th, textAlign: "center" }}>Acceptance Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allEquipment.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...S.td, color: "#aaa", fontStyle: "italic", textAlign: "center" }}>No shared equipment</td></tr>
                    ) : allEquipment.map((eq, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ ...S.td, fontWeight: "600" }}>{eq.name}</td>
                        <td style={S.td}>{eq.category_name || "—"}</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic" }}>To be recorded</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic" }}>To be recorded</td>
                        <td style={{ ...S.td, color: "#aaa", fontStyle: "italic", textAlign: "center" }}>Calculated</td>
                        <td style={{ ...S.td, textAlign: "center", fontWeight: "bold", color: "#004f9f" }}>≤ {hrs} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* § 9 DEHT Acceptance Criteria */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>9. DEHT Acceptance Criteria</p>
          <div style={{ background: "#eef4ff", border: "1px solid #c7d9f7", borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#004f9f", fontWeight: "bold" }}>
              Maximum Allowable Dirty Hold Time: <span style={{ fontSize: "20px" }}>{hrs} hours</span>
              {dehtMeta?.updated_by && (
                <span style={{ marginLeft: "16px", fontSize: "11px", fontWeight: "normal", color: "#666" }}>
                  (Policy set by {dehtMeta.updated_by}{dehtMeta.updated_at ? ` on ${new Date(dehtMeta.updated_at).toLocaleDateString("en-IN")}` : ""})
                </span>
              )}
            </p>
          </div>
          <p style={S.para}>
            The actual hold time for each equipment in each run shall not exceed <strong>{hrs} hours</strong>.
            Hold time = Cleaning Start Date/Time − Equipment Usage Completion Date/Time.
            Any exceedance shall be treated as an OOS event and investigated per applicable SOP.
          </p>
          <table style={S.dataTable}>
            <thead><tr style={{ background: "#e8f0fb" }}>
              <th style={S.th}>Parameter</th><th style={S.th}>Limit</th><th style={S.th}>Evaluation</th>
            </tr></thead>
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

        {/* § 10 References */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>10. References</p>
          <table style={S.dataTable}><tbody>
            <tr><td style={S.tdKey}>Cleaning Policy</td><td style={S.tdVal}>{r.policy_label || r.policy}</td></tr>
            <tr><td style={S.tdKey}>DEHT Limit</td><td style={S.tdVal}><strong>{hrs} hours</strong> — set in Cleaning Validation Calculation Policy</td></tr>
            <tr><td style={S.tdKey}>Regulatory Basis</td><td style={S.tdVal}>ICH Q7, EMA/CHMP/CVMP/SWP/169430/2012, EU GMP Annex 15, Site SOP</td></tr>
            <tr><td style={S.tdKey}>Analytical Method</td><td style={S.tdVal}>{r.analytical_method || "—"} (LOD: {r.lod_ppm} ppm, LOQ: {r.loq_ppm} ppm)</td></tr>
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
          <span>Falcon — Confidential | DEHT Study Protocol</span>
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
          <img src={logo} alt="Falcon" style={{ width: 70 }} />
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
            <tr>
              <td style={S.tdKey}>SOP Followed</td>
              <td style={S.tdVal}>{results_data.sop_followed || "—"}</td>
            </tr>
          </tbody></table>
        </div>

        {/* § 3 DEHT Hold Time Results per Run */}
        <div style={S.section} className="doc-section">
          <p style={S.sectionTitle}>3. Dirty Equipment Hold Time Results</p>
          {runs.map((run, ri) => (
            <div key={ri} style={{ marginBottom: "16px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ background: "#004f9f", color: "white", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", fontSize: "13px" }}>Run {run.run_number}</span>
                <span style={{ fontSize: "12px", opacity: 0.85 }}>Batch: {run.batch_number || "—"}</span>
              </div>
              <table style={{ ...S.dataTable, margin: 0 }}>
                <thead>
                  <tr style={{ background: "#e8f0fb" }}>
                    <th style={S.th}>Equipment</th>
                    <th style={S.th}>Category</th>
                    <th style={S.th}>Usage Completion</th>
                    <th style={S.th}>Cleaning Start</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Hold Time (hrs)</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Limit (hrs)</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(run.equipment_results || []).map((eq, ei) => {
                    const ht = eq.hold_time_hours != null ? eq.hold_time_hours : calcHoldTime(eq.usage_end_datetime, eq.cleaning_start_datetime);
                    return (
                      <tr key={ei} style={{ background: ei % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ ...S.td, fontWeight: "600" }}>{eq.equipment_name || "—"}</td>
                        <td style={S.td}>{eq.category_name || "—"}</td>
                        <td style={S.td}>{eq.usage_end_datetime ? new Date(eq.usage_end_datetime).toLocaleString("en-IN") : "—"}</td>
                        <td style={S.td}>{eq.cleaning_start_datetime ? new Date(eq.cleaning_start_datetime).toLocaleString("en-IN") : "—"}</td>
                        <td style={{ ...S.td, textAlign: "center", fontWeight: "bold" }}>{ht != null ? ht : "—"}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{eq.limit_hours ?? hrs}</td>
                        <td style={{ ...S.td, textAlign: "center" }}>{holdTimeBadge(ht, eq.limit_hours ?? hrs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* § 4 Cleaning Validation Results (combined 3-run) */}
        {(() => {
          const equipmentList = runs[0]?.equipment_results || [];
          if (equipmentList.length === 0) return null;
          return (
            <div style={S.section} className="doc-section">
              <p style={S.sectionTitle}>4. Cleaning Validation Results</p>
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
                                padding: "6px 12px", background: "#fff7ed",
                                borderTop: "2px solid #f97316", borderBottom: "1px solid #fed7aa",
                                fontWeight: "700", fontSize: "11px", color: "#9a3412", letterSpacing: "0.4px",
                              }}>
                                Synthesis Intermediate Steps — Fixed 10 ppm Criterion
                              </td>
                            </tr>
                          )}
                          <tr style={{ background: bg }}>
                            <td rowSpan={rowCount} style={{ ...sampCell, fontWeight: "600", verticalAlign: "middle",
                              borderRight: "2px solid #c7d9f7", background: isSynth ? "#fffbf5" : undefined }}>
                              {eq.equipment_name}
                              {eq.category_name && <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>}
                              {isSynth && <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>Synthesis — Fixed 10 ppm</div>}
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
                                  <td style={{ ...sampCell, textAlign: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
                                      background: rinseStatus === "PASS" ? "#d4edda" : rinseStatus === "FAIL" ? "#f8d7da" : "#f0f0f0",
                                      color: rinseStatus === "PASS" ? "#155724" : rinseStatus === "FAIL" ? "#721c24" : "#888" }}>
                                      {rinseStatus || "—"}
                                    </span>
                                  </td>
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
                                    <td style={{ ...sampCell, textAlign: "center" }}>
                                      <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
                                        background: swabStatus === "PASS" ? "#d4edda" : swabStatus === "FAIL" ? "#f8d7da" : "#f0f0f0",
                                        color: swabStatus === "PASS" ? "#155724" : swabStatus === "FAIL" ? "#721c24" : "#888" }}>
                                        {swabStatus || "—"}
                                      </span>
                                    </td>
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
          );
        })()}

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
          <span>Falcon — Confidential | DEHT Study Report</span>
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
                {result && (
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

          {!displayResult && !loading && !archiveDoc && (
            <div style={S.emptyState}>
              <p style={{ margin: 0, color: "#888" }}>
                Select a facility and product, then click <strong>Generate Protocol</strong>.
              </p>
            </div>
          )}

          {!displayResult && !loading && archiveDoc && (
            <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px",
              padding: "20px 24px", margin: "16px 0", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#856404", fontSize: "14px" }}>
                This archived protocol was saved in an older format and cannot be displayed.
              </p>
              <p style={{ margin: "0 0 12px", color: "#856404", fontSize: "13px" }}>
                Please click <strong>Back to Generator</strong>, select the facility and product,
                regenerate the protocol, and save a new archive. You may then delete this outdated entry.
              </p>
              <button onClick={() => setArchiveDoc(null)}
                style={{ padding: "6px 16px", background: "#856404", color: "white",
                  border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>
                Back to Generator
              </button>
            </div>
          )}

          {displayResult && (
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

                  {/* Section A: Hold Time Records (per-run) */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ color: "#004f9f", margin: "0 0 12px", fontSize: "14px", borderBottom: "2px solid #004f9f", paddingBottom: "6px" }}>
                      A. Dirty Equipment Hold Time Records
                    </h4>
                    {runResults.map((run, runIdx) => (
                      <div key={runIdx} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "14px", overflow: "hidden" }}>
                        <div style={{ background: "#004f9f", color: "white", padding: "8px 14px",
                          display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{ fontWeight: "bold", fontSize: "14px" }}>Run {run.run_number}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <label style={{ fontSize: "12px", opacity: 0.85 }}>Batch Number:</label>
                            <input
                              value={run.batch_number}
                              onChange={e => handleRunChange(runIdx, 0, "batch_number", e.target.value)}
                              placeholder="e.g. B-2025-001"
                              style={{ padding: "4px 8px", borderRadius: "4px", border: "none", fontSize: "13px", width: "160px", color: "#333" }} />
                          </div>
                        </div>
                        {run.equipment_results.length === 0 ? (
                          <div style={{ padding: "16px", color: "#aaa", fontStyle: "italic", textAlign: "center", fontSize: "13px" }}>
                            No equipment loaded. Select a protocol above.
                          </div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                              <thead>
                                <tr style={{ background: "#e8f0fb" }}>
                                  <th style={sampCell}>Equipment Name</th>
                                  <th style={sampCell}>Category</th>
                                  <th style={sampCell}>Usage Completion Date/Time</th>
                                  <th style={sampCell}>Cleaning Start Date/Time</th>
                                  <th style={{ ...sampCell, textAlign: "center" }}>Hold Time (hrs)</th>
                                  <th style={{ ...sampCell, textAlign: "center" }}>Limit (hrs)</th>
                                  <th style={{ ...sampCell, textAlign: "center" }}>Status</th>
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
                                      <td style={{ ...sampCell, color: "#666" }}>{eq.category_name || "—"}</td>
                                      <td style={sampCell}>
                                        <input type="datetime-local"
                                          value={eq.usage_end_datetime || ""}
                                          onChange={e => handleRunChange(runIdx, ei, "usage_end_datetime", e.target.value)}
                                          style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px" }} />
                                      </td>
                                      <td style={sampCell}>
                                        <input type="datetime-local"
                                          value={eq.cleaning_start_datetime || ""}
                                          onChange={e => handleRunChange(runIdx, ei, "cleaning_start_datetime", e.target.value)}
                                          style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px" }} />
                                      </td>
                                      <td style={{ ...sampCell, textAlign: "center", fontWeight: "bold",
                                        color: ht != null ? (ht > (lim || Infinity) ? "#dc3545" : "#155724") : "#666" }}>
                                        {ht != null ? ht : "—"}
                                      </td>
                                      <td style={{ ...sampCell, textAlign: "center" }}>{lim ?? "—"}</td>
                                      <td style={{ ...sampCell, textAlign: "center" }}>{holdTimeBadge(ht, lim)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Section B: Cleaning Results (combined 3-run table) */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ color: "#004f9f", margin: "0 0 12px", fontSize: "14px", borderBottom: "2px solid #004f9f", paddingBottom: "6px" }}>
                      B. Cleaning Validation Results
                    </h4>
                    {runResults[0]?.equipment_results.length === 0 ? (
                      <div style={{ padding: "16px", color: "#aaa", fontStyle: "italic", textAlign: "center", fontSize: "13px" }}>
                        No equipment loaded. Select a protocol above.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ background: "#004f9f", color: "white" }}>
                              <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle", color: "white" }}>Equipment</th>
                              <th rowSpan={2} style={{ ...sampCell, textAlign: "left", verticalAlign: "middle", color: "white" }}>Sample</th>
                              <th rowSpan={2} style={{ ...sampCell, textAlign: "center", verticalAlign: "middle", color: "white" }}>Limit (ppm)</th>
                              {runResults.map(run => (
                                <th key={run.run_number} colSpan={3} style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8", color: "white" }}>
                                  Run-{run.run_number}
                                </th>
                              ))}
                            </tr>
                            <tr style={{ background: "#1a6bbd", color: "white" }}>
                              {runResults.map(run => (
                                <React.Fragment key={run.run_number}>
                                  <th style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8", fontWeight: "normal", color: "white" }}>Insp. Lot No.</th>
                                  <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal", color: "white" }}>Result (ppm)</th>
                                  <th style={{ ...sampCell, textAlign: "center", fontWeight: "normal", color: "white" }}>Status</th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(runResults[0]?.equipment_results || []).map((eq, equipIdx) => {
                              const isSynth = eq.eq_type === "synthesis";
                              const isFirstSynth = isSynth && (equipIdx === 0 || runResults[0].equipment_results[equipIdx - 1]?.eq_type !== "synthesis");
                              const rowCount = 1 + (eq.swab_results?.length || 0);
                              const bg = isSynth ? "#fffbf5" : (equipIdx % 2 === 0 ? "white" : "#f8fafc");
                              return (
                                <React.Fragment key={equipIdx}>
                                  {isFirstSynth && (
                                    <tr>
                                      <td colSpan={3 + runResults.length * 3} style={{
                                        padding: "6px 12px", background: "#fff7ed",
                                        borderTop: "2px solid #f97316", borderBottom: "1px solid #fed7aa",
                                        fontWeight: "700", fontSize: "11px", color: "#9a3412", letterSpacing: "0.4px",
                                      }}>
                                        Synthesis Intermediate Steps — Fixed 10 ppm Criterion
                                      </td>
                                    </tr>
                                  )}
                                  <tr style={{ background: bg }}>
                                    <td rowSpan={rowCount} style={{ ...sampCell, fontWeight: "600", verticalAlign: "middle",
                                      borderRight: "2px solid #c7d9f7", background: isSynth ? "#fffbf5" : undefined }}>
                                      {eq.equipment_name}
                                      {eq.category_name && <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>}
                                      {isSynth && <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>Synthesis — Fixed 10 ppm</div>}
                                    </td>
                                    <td style={sampCell}>Rinse</td>
                                    <td style={{ ...sampCell, textAlign: "center" }}>{eq.rinse_limit_ppm ?? "—"}</td>
                                    {runResults.map((run, runIdx) => {
                                      const runEq = run.equipment_results[equipIdx];
                                      const rinseStatus = compareResultToLimit(runEq?.rinse_result_ppm, runEq?.rinse_limit_ppm);
                                      return (
                                        <React.Fragment key={runIdx}>
                                          <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>
                                            <input value={runEq?.rinse_lot_number || ""}
                                              onChange={e => handleRunChange(runIdx, equipIdx, "rinse_lot_number", e.target.value)}
                                              placeholder="Lot #"
                                              style={{ width: "80px", padding: "3px 5px", borderRadius: "3px", border: "1px solid #ccc", fontSize: "11px" }} />
                                          </td>
                                          <td style={{ ...sampCell, textAlign: "center" }}>
                                            <input value={runEq?.rinse_result_ppm || ""}
                                              onChange={e => handleRunChange(runIdx, equipIdx, "rinse_result_ppm", e.target.value)}
                                              placeholder="ppm"
                                              style={{ width: "60px", padding: "3px 5px", borderRadius: "3px", border: "1px solid #ccc", fontSize: "11px" }} />
                                          </td>
                                          <td style={{ ...sampCell, textAlign: "center" }}>
                                            <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
                                              background: rinseStatus === "PASS" ? "#d4edda" : rinseStatus === "FAIL" ? "#f8d7da" : "#f0f0f0",
                                              color: rinseStatus === "PASS" ? "#155724" : rinseStatus === "FAIL" ? "#721c24" : "#888" }}>
                                              {rinseStatus || "—"}
                                            </span>
                                          </td>
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
                                      {runResults.map((run, runIdx) => {
                                        const runEq = run.equipment_results[equipIdx];
                                        const runSwab = runEq?.swab_results?.[swabIdx];
                                        const swabStatus = compareResultToLimit(runSwab?.result_ppm, runEq?.swab_limit_ppm);
                                        return (
                                          <React.Fragment key={runIdx}>
                                            <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>
                                              <input value={runSwab?.lot_number || ""}
                                                onChange={e => handleRunChange(runIdx, equipIdx, "swab_lot_number", e.target.value, swabIdx)}
                                                placeholder="Lot #"
                                                style={{ width: "80px", padding: "3px 5px", borderRadius: "3px", border: "1px solid #ccc", fontSize: "11px" }} />
                                            </td>
                                            <td style={{ ...sampCell, textAlign: "center" }}>
                                              <input value={runSwab?.result_ppm || ""}
                                                onChange={e => handleRunChange(runIdx, equipIdx, "swab_result_ppm", e.target.value, swabIdx)}
                                                placeholder="ppm"
                                                style={{ width: "60px", padding: "3px 5px", borderRadius: "3px", border: "1px solid #ccc", fontSize: "11px" }} />
                                            </td>
                                            <td style={{ ...sampCell, textAlign: "center" }}>
                                              <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "3px",
                                                background: swabStatus === "PASS" ? "#d4edda" : swabStatus === "FAIL" ? "#f8d7da" : "#f0f0f0",
                                                color: swabStatus === "PASS" ? "#155724" : swabStatus === "FAIL" ? "#721c24" : "#888" }}>
                                                {swabStatus || "—"}
                                              </span>
                                            </td>
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
                    )}
                  </div>

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
                <td style={{ padding: "3px 8px" }}>{sourceProduct?.product_name}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Facility</td>
                <td style={{ padding: "3px 8px" }}>{facilities.find(f => f.facility_id === sourceProduct?.facility_id)?.facility_name}</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>DEHT Limit</td>
                <td style={{ padding: "3px 8px", fontWeight: "bold", color: "#004f9f" }}>{dehtHours} hours</td></tr>
            <tr><td style={{ padding: "3px 8px", color: "#888" }}>Sampling Locations</td>
                <td style={{ padding: "3px 8px" }}>{protocolSamplingPlan.reduce((n, c) => n + c.entries.length, 0)} total across {protocolSamplingPlan.filter(c => c.entries.length > 0).length} categories</td></tr>
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
