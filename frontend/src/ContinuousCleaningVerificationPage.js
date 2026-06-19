import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";
import logo from "./assets/cipla-logo.png";

const apiError = (e, fallback) =>
  e?.response?.data?.detail || e?.message || fallback;

function statusBadge(status) {
  if (!status) return null;
  const pass = status === "PASS";
  return (
    <span style={{
      fontSize: "10px", fontWeight: "bold", padding: "2px 7px", borderRadius: "3px",
      background: pass ? "#d4edda" : "#f8d7da",
      color: pass ? "#155724" : "#721c24",
    }}>{status}</span>
  );
}

function compareToLimit(result, limit) {
  if (!result || !limit) return null;
  const r = parseFloat(result), l = parseFloat(limit);
  if (isNaN(r) || isNaN(l)) return null;
  return r <= l ? "PASS" : "FAIL";
}

function ContinuousCleaningVerificationPage({ goHome, currentUser, role, noHeader = false }) {
  const [activeTab, setActiveTab] = useState("new");

  // ── Facility / product selection ─────────────────────────────────
  const [facilities, setFacilities]             = useState([]);
  const [selFacility, setSelFacility]           = useState("");
  const [eligibleProducts, setEligibleProducts] = useState([]);
  const [selProduct, setSelProduct]             = useState("");
  const [approvedReports, setApprovedReports]   = useState([]);
  const [selReport, setSelReport]               = useState("");
  const [loadingProducts, setLoadingProducts]   = useState(false);
  const [loadingReports, setLoadingReports]     = useState(false);

  // ── Template ─────────────────────────────────────────────────────
  const [template, setTemplate]               = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [nextRunNumber, setNextRunNumber]     = useState(null);

  // ── Run entry ────────────────────────────────────────────────────
  const [batchNumber, setBatchNumber]           = useState("");
  const [runEquipmentResults, setRunEquipmentResults] = useState([]);
  const [trainingDetails, setTrainingDetails]   = useState("");
  const [sopFollowed, setSopFollowed]           = useState("");
  const [completionDate, setCompletionDate]     = useState("");

  // ── Draft ────────────────────────────────────────────────────────
  const [existingDraftCCV, setExistingDraftCCV] = useState(null);
  const [savingDraft, setSavingDraft]           = useState(false);
  const [draftLoaded, setDraftLoaded]           = useState(false);

  // ── Submit modal ─────────────────────────────────────────────────
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitPwd, setSubmitPwd]             = useState("");
  const [submitting, setSubmitting]           = useState(false);

  // ── View tab ─────────────────────────────────────────────────────
  const [viewFacility, setViewFacility] = useState("");
  const [viewProduct, setViewProduct]   = useState("");
  const [viewProducts, setViewProducts] = useState([]);
  const [ccvList, setCcvList]           = useState([]);
  const [listLoading, setListLoading]   = useState(false);
  const [viewingCCV, setViewingCCV]     = useState(null);
  const [viewLoading, setViewLoading]   = useState(false);

  // ── Delete modal ─────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [deletePwd, setDeletePwd]             = useState("");
  const [deleting, setDeleting]               = useState(false);

  const printRef = useRef();

  // ── Load facilities once ─────────────────────────────────────────
  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(() => {});
  }, []);

  // ── Load eligible products when facility changes ─────────────────
  useEffect(() => {
    setEligibleProducts([]); setSelProduct("");
    setApprovedReports([]); setSelReport(""); setTemplate(null);
    if (!selFacility) return;
    setLoadingProducts(true);
    api.get("/ccv/eligible-products", { params: { facility_id: selFacility } })
      .then(r => setEligibleProducts(r.data)).catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selFacility]);

  // ── Load approved reports when product changes ───────────────────
  useEffect(() => {
    setApprovedReports([]); setSelReport(""); setTemplate(null);
    if (!selProduct) return;
    setLoadingReports(true);
    api.get("/ccv/approved-reports", { params: { product_id: selProduct } })
      .then(r => setApprovedReports(r.data)).catch(() => {})
      .finally(() => setLoadingReports(false));
  }, [selProduct]);

  // ── Load template when report selected ───────────────────────────
  useEffect(() => {
    setTemplate(null); setRunEquipmentResults([]); setNextRunNumber(null);
    setBatchNumber(""); setTrainingDetails(""); setSopFollowed(""); setCompletionDate("");
    setExistingDraftCCV(null); setDraftLoaded(false);
    if (!selReport) return;
    const report = approvedReports.find(r => String(r.report_id) === String(selReport));
    if (!report) return;
    setLoadingTemplate(true);
    Promise.all([
      api.get(`/protocol/archive/${report.archive_id}`),
      api.get("/ccv/list", { params: { product_id: selProduct } }),
      api.get("/sampling/plan"),
      api.get("/equipment/all"),
      api.get("/ccv/draft", { params: { report_id: selReport } }).catch(() => ({ data: null })),
    ]).then(([archRes, listRes, planRes, equipRes, draftRes]) => {
      const snapshot = archRes.data.snapshot;
      setTemplate({ archiveId: report.archive_id, docNumber: archRes.data.doc_number });

      const pairs = snapshot.result?.data || [];

      // Build category → entries map from live sampling plan
      const catEntries = {};
      planRes.data.forEach(cat => { catEntries[cat.category_id] = cat.entries || []; });

      // Fallback: resolve category_id from live equipment for old snapshots
      const liveEqCatMap = {};
      equipRes.data.forEach(e => { liveEqCatMap[e.equipment_name] = e.category_id; });

      // Per-equipment governing limits: minimum of eq.rinse_final / eq.swab_final across all pairs.
      // Matches Protocol Section 5 exactly. Keep govRinse/govSwab as fallback for old snapshots.
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
            const resolvedCatId = eq.category_id ?? liveEqCatMap[eq.name] ?? null;
            eqMap[eq.name] = {
              equipment_name: eq.name,
              category_id:    resolvedCatId,
              category_name:  eq.category_name ?? planRes.data.find(c => c.category_id === resolvedCatId)?.category_name ?? "—",
              eq_type: "maco",
            };
          }
        });
      });

      // Also add SYNTHESIS-step equipment (fixed 10 ppm limit).
      // Prefer top-level synthesis_steps from snapshot (all source synthesis equipment);
      // fall back to per-pair synthesis_step_equipment for older snapshots.
      const synthSteps = snapshot.result?.synthesis_steps || [];
      const addSynthEq = (eq) => {
        if (eqMap[eq.name]) return; // already present as MACO equipment
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
        // Fallback for snapshots without top-level synthesis_steps
        pairs.forEach(pair =>
          (pair.synthesis_step_equipment || []).forEach(stepGrp =>
            (stepGrp.equipment || []).forEach(addSynthEq)
          )
        );
      }

      const rows = Object.values(eqMap).map(eq => ({
        ...eq,
        rinse_limit_ppm: eq.eq_type === "synthesis" ? 10.0
          : (eqLimitsMap[eq.equipment_name]?.rinse_final ?? govRinse),
        swab_limit_ppm:  eq.eq_type === "synthesis" ? 10.0
          : (eqLimitsMap[eq.equipment_name]?.swab_final  ?? govSwab),
        rinse_result_ppm: "",
        rinse_lot_number: "",
        swab_results: (catEntries[eq.category_id] || []).map(entry => ({
          sample_number:        entry.sample_number,
          location_description: entry.location_description,
          result_ppm: "",
          lot_number: "",
        })),
      }));

      setNextRunNumber((listRes.data?.filter(r => r.status === "Completed").length || 0) + 1);

      const draft = draftRes?.data;
      if (draft?.ccv_id) {
        setExistingDraftCCV({ ccv_id: draft.ccv_id });
        setDraftLoaded(true);
        const rd = draft.results_data;
        if (rd) {
          setBatchNumber(rd.run?.batch_number || "");
          setTrainingDetails(rd.training_details || "");
          setSopFollowed(rd.sop_followed || "");
          setCompletionDate(rd.completion_date || "");
          const draftEq = rd.run?.equipment_results || [];
          setRunEquipmentResults(rows.map(tEq => {
            const dEq = draftEq.find(d => d.equipment_name === tEq.equipment_name);
            if (!dEq) return tEq;
            return {
              ...tEq,
              rinse_result_ppm: dEq.rinse_result_ppm || "",
              rinse_lot_number: dEq.rinse_lot_number || "",
              swab_results: tEq.swab_results.map(ts => {
                const ds = (dEq.swab_results || []).find(s => s.sample_number === ts.sample_number);
                return ds ? { ...ts, result_ppm: ds.result_ppm || "", lot_number: ds.lot_number || "" } : ts;
              }),
            };
          }));
        } else {
          setRunEquipmentResults(rows);
        }
      } else {
        setRunEquipmentResults(rows);
      }
    }).catch(() => {}).finally(() => setLoadingTemplate(false));
  }, [selReport, approvedReports, selProduct]);

  // ── View tab eligible products ────────────────────────────────────
  useEffect(() => {
    setViewProducts([]); setViewProduct("");
    if (!viewFacility) return;
    api.get("/ccv/eligible-products", { params: { facility_id: viewFacility } })
      .then(r => setViewProducts(r.data)).catch(() => {});
  }, [viewFacility]);

  const loadCCVList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.get("/ccv/list", {
        params: { facility_id: viewFacility || undefined, product_id: viewProduct || undefined }
      });
      setCcvList(res.data);
    } catch { setCcvList([]); }
    finally { setListLoading(false); }
  }, [viewFacility, viewProduct]);

  // ── Result update helpers ─────────────────────────────────────────
  const updateRinse = (eqIdx, field, val) => {
    setRunEquipmentResults(prev => prev.map((eq, i) =>
      i === eqIdx ? { ...eq, [field]: val } : eq
    ));
  };

  const updateSwab = (eqIdx, swabIdx, field, val) => {
    setRunEquipmentResults(prev => prev.map((eq, i) => {
      if (i !== eqIdx) return eq;
      return {
        ...eq,
        swab_results: eq.swab_results.map((s, j) =>
          j === swabIdx ? { ...s, [field]: val } : s
        ),
      };
    }));
  };

  // ── Save Draft ───────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!selFacility || !selProduct || !selReport || !template) {
      alert("Select facility, product, and report first ❌"); return;
    }
    setSavingDraft(true);
    const report = approvedReports.find(r => String(r.report_id) === String(selReport));
    const resultsData = {
      run: { batch_number: batchNumber, equipment_results: runEquipmentResults },
      training_details: trainingDetails,
      sop_followed:     sopFollowed,
      completion_date:  completionDate || null,
    };
    try {
      if (existingDraftCCV?.ccv_id) {
        await api.put(`/ccv/${existingDraftCCV.ccv_id}`, {
          results_data: resultsData,
          reason: "Draft save",
          is_draft: true,
        });
      } else {
        const res = await api.post("/ccv/create", {
          report_id:  parseInt(selReport),
          archive_id: report.archive_id,
          results_data: resultsData,
          is_draft: true,
        });
        setExistingDraftCCV({ ccv_id: res.data.ccv_id });
      }
      alert("Draft saved ✅");
    } catch (e) { alert(apiError(e, "Error saving draft.")); }
    finally { setSavingDraft(false); }
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!batchNumber.trim()) { alert("Enter a batch number ❌"); return; }
    if (!completionDate)     { alert("Enter the run completion date ❌"); return; }
    if (!trainingDetails.trim()) { alert("Enter training details ❌"); return; }
    if (!sopFollowed.trim())     { alert("Enter SOP reference ❌"); return; }
    setSubmitPwd(""); setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    if (!submitPwd.trim()) { alert("Enter your password ❌"); return; }
    setSubmitting(true);
    const report = approvedReports.find(r => String(r.report_id) === String(selReport));
    const resultsData = {
      run: { batch_number: batchNumber, equipment_results: runEquipmentResults },
      training_details: trainingDetails,
      sop_followed:     sopFollowed,
      completion_date:  completionDate,
    };
    try {
      let runNumber;
      if (existingDraftCCV?.ccv_id) {
        const res = await api.put(`/ccv/${existingDraftCCV.ccv_id}`, {
          results_data: resultsData,
          password: submitPwd,
          reason: "CCV run submitted",
          is_draft: false,
        });
        runNumber = res.data.run_number;
      } else {
        const res = await api.post("/ccv/create", {
          report_id:  parseInt(selReport),
          archive_id: report.archive_id,
          results_data: resultsData,
          password: submitPwd,
        });
        runNumber = res.data.run_number;
      }
      alert(`CCV Run ${runNumber} submitted ✅`);
      setShowSubmitModal(false);
      setBatchNumber(""); setTrainingDetails(""); setSopFollowed(""); setCompletionDate("");
      setTemplate(null); setSelReport(""); setRunEquipmentResults([]);
      setExistingDraftCCV(null); setDraftLoaded(false);
    } catch (e) { alert(apiError(e, "Error submitting CCV run ❌")); }
    finally { setSubmitting(false); }
  };

  // ── View detail ───────────────────────────────────────────────────
  const viewCCVDetail = async (ccvId) => {
    setViewingCCV({ ccv_id: ccvId });
    setViewLoading(true);
    try {
      const res = await api.get(`/ccv/${ccvId}`);
      setViewingCCV(res.data);
    } catch (e) { alert(apiError(e, "Failed to load CCV run.")); setViewingCCV(null); }
    finally { setViewLoading(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deletePwd.trim()) { alert("Enter your password ❌"); return; }
    setDeleting(true);
    try {
      await api.delete(`/ccv/${deleteTarget.ccv_id}`,
        { data: { password: deletePwd, reason: "CCV run removed" } });
      alert("CCV run deleted ✅");
      setShowDeleteModal(false); setDeletePwd("");
      setViewingCCV(null); loadCCVList();
    } catch (e) { alert(apiError(e, "Error deleting CCV run.")); }
    finally { setDeleting(false); }
  };

  const handlePrint = () => {
    if (!viewingCCV?.results_data) return;
    const win = window.open("", "_blank");
    const rd  = viewingCCV.results_data;
    const eq  = rd?.run?.equipment_results || [];
    win.document.write(`<html><head><title>CCV Run ${viewingCCV.run_number}</title>
    <style>
      body{font-family:Arial;padding:20px;font-size:12px}
      .hdr{display:flex;align-items:center;border-bottom:3px solid #004f9f;padding-bottom:12px;margin-bottom:16px}
      .hdr img{height:48px;margin-right:16px}
      h2{margin:0;color:#004f9f;font-size:17px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#004f9f;color:white;padding:6px 10px;font-size:11px;text-align:center}
      td{border:1px solid #ddd;padding:5px 9px;font-size:11px}
      .pass{color:#155724;font-weight:bold}.fail{color:#dc3545;font-weight:bold}
      .meta{background:#f0f4ff;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px}
      .footer{margin-top:20px;border-top:1px solid #ccc;padding-top:8px;display:flex;justify-content:space-between;color:#888;font-size:11px}
    </style></head><body>
    <div class="hdr"><img src="${logo}" alt="Cipla"/>
      <div><h2>Continuous Cleaning Verification</h2>
      <p style="margin:3px 0 0;color:#555">Run ${viewingCCV.run_number} — ${viewingCCV.product_name} | ${viewingCCV.facility_name}</p>
      <p style="margin:2px 0 0;color:#555">Protocol: ${viewingCCV.doc_number||"—"} | Submitted by: ${viewingCCV.submitted_by}</p></div></div>
    <div class="meta"><b>Batch No.:</b> ${rd?.run?.batch_number||"—"} &nbsp;&nbsp;
      <b>Completion Date:</b> ${rd.completion_date?new Date(rd.completion_date).toLocaleDateString("en-IN"):"—"}<br/>
      <b>Training:</b> ${rd.training_details||"—"} &nbsp;&nbsp; <b>SOP:</b> ${rd.sop_followed||"—"}</div>
    <table><thead><tr>
      <th rowspan="2">Equipment</th><th rowspan="2">Sample</th>
      <th rowspan="2">Limit (ppm)</th>
      <th>Insp. Lot No.</th><th>Result (ppm)</th><th>Status</th>
    </tr></thead><tbody>
    ${eq.map(e=>{
      const rinseStatus = e.rinse_result_ppm
        ? (parseFloat(e.rinse_result_ppm) <= parseFloat(e.rinse_limit_ppm) ? "PASS" : "FAIL") : "—";
      const rowCount = 1 + (e.swab_results||[]).length;
      return `<tr>
        <td rowspan="${rowCount}" style="font-weight:600;vertical-align:middle">${e.equipment_name}<br/><small style="color:#666">${e.category_name}</small></td>
        <td>Rinse</td><td style="text-align:center">${e.rinse_limit_ppm??'—'}</td>
        <td style="text-align:center">${e.rinse_lot_number||"—"}</td>
        <td style="text-align:center">${e.rinse_result_ppm||"—"}</td>
        <td class="${rinseStatus==="PASS"?"pass":rinseStatus==="FAIL"?"fail":""}" style="text-align:center">${rinseStatus}</td></tr>
      ${(e.swab_results||[]).map(s=>{
        const ss = s.result_ppm
          ? (parseFloat(s.result_ppm) <= parseFloat(e.swab_limit_ppm) ? "PASS" : "FAIL") : "—";
        return `<tr><td><b>${s.sample_number}</b> — ${s.location_description}</td>
          <td style="text-align:center">${e.swab_limit_ppm??'—'}</td>
          <td style="text-align:center">${s.lot_number||"—"}</td>
          <td style="text-align:center">${s.result_ppm||"—"}</td>
          <td class="${ss==="PASS"?"pass":ss==="FAIL"?"fail":""}" style="text-align:center">${ss}</td></tr>`;
      }).join("")}`;
    }).join("")}
    </tbody></table>
    <div class="footer"><span>Falcon — Confidential</span>
      <span>Printed: ${new Date().toLocaleString("en-IN")}</span>
      <span>Printed by: ${currentUser}</span></div>
    </body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div style={noHeader ? {} : { padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* Header — hidden when embedded inside another page */}
      {!noHeader && (
        <div style={S.pageHeader}>
          <button onClick={goHome} style={S.backBtn}>← Home</button>
          <div>
            <h2 style={{ margin: 0 }}>Continuous Cleaning Verification</h2>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#aad4ff" }}>
              Routine post-validation monitoring — one run per report
            </p>
          </div>
          <img src={logo} alt="Cipla" style={{ height: 40, marginLeft: "auto" }} />
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabBar}>
        <button onClick={() => setActiveTab("new")}  style={activeTab === "new"  ? S.tabActive : S.tabInactive}>New Run</button>
        <button onClick={() => { setActiveTab("view"); loadCCVList(); }} style={activeTab === "view" ? S.tabActive : S.tabInactive}>View Runs</button>
      </div>

      {/* ── NEW RUN TAB ───────────────────────────────────────────── */}
      {activeTab === "new" && (
        <div style={S.card}>
          <h3 style={{ marginTop: 0, color: "#004f9f" }}>Enter CCV Run</h3>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "18px" }}>
            Only products with an <strong>approved</strong> Cleaning Validation Report are eligible.
            QA / ADMIN can approve reports from the Protocol &amp; Report page.
          </p>

          {/* Facility + Product */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <div>
              <label style={S.label}>Facility *</label>
              <select value={selFacility} onChange={e => setSelFacility(e.target.value)} style={S.input}>
                <option value="">— Select Facility —</option>
                {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Product *</label>
              <select value={selProduct} onChange={e => setSelProduct(e.target.value)} style={S.input}
                disabled={!selFacility || loadingProducts}>
                <option value="">{loadingProducts ? "Loading…" : eligibleProducts.length === 0 && selFacility ? "No eligible products" : "— Select Product —"}</option>
                {eligibleProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
              </select>
              {selFacility && !loadingProducts && eligibleProducts.length === 0 && (
                <p style={{ color: "#856404", fontSize: "12px", margin: "4px 0 0" }}>
                  No approved validation reports found for this facility.
                </p>
              )}
            </div>
          </div>

          {/* Approved report selector */}
          {selProduct && (
            <div style={{ marginBottom: "16px" }}>
              <label style={S.label}>Based on Approved Report *</label>
              <select value={selReport} onChange={e => setSelReport(e.target.value)} style={S.input}
                disabled={loadingReports}>
                <option value="">{loadingReports ? "Loading…" : "— Select Approved Report —"}</option>
                {approvedReports.map(r => (
                  <option key={r.report_id} value={r.report_id}>
                    Report #{r.report_id} — Approved by {r.approved_by} on {r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-IN") : "—"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingTemplate && <p style={{ color: "#004f9f" }}>Loading protocol template…</p>}

          {/* ── Run entry form ─────────────────────────────────────── */}
          {template && !loadingTemplate && (
            <>
              {/* Draft-loaded banner */}
              {draftLoaded && (
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "8px 14px", marginBottom: "14px", fontSize: "12px", color: "#856404" }}>
                  <strong>Draft loaded.</strong> Your previously saved draft has been restored. Continue editing and save again or submit.
                </div>
              )}

              {/* Save draft reminder */}
              {!draftLoaded && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 14px", marginBottom: "14px", fontSize: "12px", color: "#92400e", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>💾</span>
                  <span>Use <strong>Save Draft</strong> regularly to avoid losing your data.</span>
                </div>
              )}

              {/* Run badge + batch / date */}
              <div style={{ background: "#f0f4ff", border: "1px solid #c7d7ff", borderRadius: "8px", padding: "14px 18px", marginBottom: "18px", display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <span style={S.runBadge}>CCV Run {nextRunNumber}</span>
                  <span style={{ fontSize: "12px", color: "#555", marginLeft: "10px" }}>
                    Protocol: {template.docNumber || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "16px", flex: 1, flexWrap: "wrap" }}>
                  <div style={{ minWidth: "180px" }}>
                    <label style={S.label}>Batch Number *</label>
                    <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                      placeholder="e.g. B-2025-001" style={S.input} />
                  </div>
                  <div style={{ minWidth: "200px" }}>
                    <label style={S.label}>Run Completion Date *</label>
                    <input type="datetime-local" value={completionDate}
                      onChange={e => setCompletionDate(e.target.value)} style={S.input} />
                  </div>
                </div>
              </div>

              {/* ── Equipment / Rinse / Swab table ───────────────────── */}
              {runEquipmentResults.length > 0 && (
                <div style={{ overflowX: "auto", marginBottom: "18px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#004f9f", color: "white" }}>
                        <th style={{ ...sampCell, textAlign: "left", verticalAlign: "middle" }}>Equipment</th>
                        <th style={{ ...sampCell, textAlign: "left", verticalAlign: "middle" }}>Sample</th>
                        <th style={{ ...sampCell, textAlign: "center", verticalAlign: "middle" }}>Limit (ppm)</th>
                        <th style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8" }}>Insp. Lot No.</th>
                        <th style={{ ...sampCell, textAlign: "center" }}>Result (ppm)</th>
                        <th style={{ ...sampCell, textAlign: "center" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runEquipmentResults.map((eq, eqIdx) => {
                        const isSynth = eq.eq_type === "synthesis";
                        const isFirstSynth = isSynth && (eqIdx === 0 || runEquipmentResults[eqIdx - 1]?.eq_type !== "synthesis");
                        const rowCount = 1 + (eq.swab_results?.length || 0);
                        const bg = isSynth ? "#fffbf5" : (eqIdx % 2 === 0 ? "white" : "#f8fafc");
                        return (
                          <React.Fragment key={eqIdx}>
                            {isFirstSynth && (
                              <tr>
                                <td colSpan={6} style={{
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
                                <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>
                                {isSynth && (
                                  <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>
                                    Synthesis Step — Fixed 10 ppm
                                  </div>
                                )}
                              </td>
                              <td style={sampCell}>Rinse</td>
                              <td style={{ ...sampCell, textAlign: "center", color: isSynth ? "#9a3412" : "#004f9f", fontWeight: "bold" }}>
                                {eq.rinse_limit_ppm != null ? eq.rinse_limit_ppm : "—"}
                              </td>
                              <td style={{ ...sampCell, borderLeft: "2px solid #e2e8f0" }}>
                                <input
                                  placeholder="Lot No."
                                  value={eq.rinse_lot_number}
                                  onChange={e => updateRinse(eqIdx, "rinse_lot_number", e.target.value)}
                                  style={inputStyle}
                                />
                              </td>
                              <td style={sampCell}>
                                <input
                                  type="number" step="0.01" placeholder="—"
                                  value={eq.rinse_result_ppm}
                                  onChange={e => updateRinse(eqIdx, "rinse_result_ppm", e.target.value)}
                                  style={{ ...inputStyle, width: "70px" }}
                                />
                              </td>
                              <td style={{ ...sampCell, textAlign: "center" }}>
                                {statusBadge(compareToLimit(eq.rinse_result_ppm, eq.rinse_limit_ppm))}
                              </td>
                            </tr>

                            {/* Swab rows */}
                            {eq.swab_results.map((s, sIdx) => (
                              <tr key={sIdx} style={{ background: bg }}>
                                <td style={{ ...sampCell, color: isSynth ? "#7c2d12" : "#444" }}>
                                  <span style={{ fontWeight: "600", color: isSynth ? "#9a3412" : "#004f9f" }}>{s.sample_number}</span>
                                  {" — "}{s.location_description}
                                </td>
                                <td style={{ ...sampCell, textAlign: "center", color: isSynth ? "#9a3412" : "#004f9f", fontWeight: "bold" }}>
                                  {eq.swab_limit_ppm != null ? eq.swab_limit_ppm : "—"}
                                </td>
                                <td style={{ ...sampCell, borderLeft: "2px solid #e2e8f0" }}>
                                  <input
                                    placeholder="Lot No."
                                    value={s.lot_number}
                                    onChange={e => updateSwab(eqIdx, sIdx, "lot_number", e.target.value)}
                                    style={inputStyle}
                                  />
                                </td>
                                <td style={sampCell}>
                                  <input
                                    type="number" step="0.01" placeholder="—"
                                    value={s.result_ppm}
                                    onChange={e => updateSwab(eqIdx, sIdx, "result_ppm", e.target.value)}
                                    style={{ ...inputStyle, width: "70px" }}
                                  />
                                </td>
                                <td style={{ ...sampCell, textAlign: "center" }}>
                                  {statusBadge(compareToLimit(s.result_ppm, eq.swab_limit_ppm))}
                                </td>
                              </tr>
                            ))}

                            {eq.swab_results.length === 0 && (
                              <tr style={{ background: bg }}>
                                <td colSpan={5} style={{ ...sampCell, color: "#999", fontStyle: "italic" }}>
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

              {/* Training + SOP */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                <div>
                  <label style={S.label}>Training Details *</label>
                  <textarea value={trainingDetails} onChange={e => setTrainingDetails(e.target.value)}
                    rows={3} style={{ ...S.input, resize: "vertical" }}
                    placeholder="Training record reference / details" />
                </div>
                <div>
                  <label style={S.label}>SOP Followed *</label>
                  <textarea value={sopFollowed} onChange={e => setSopFollowed(e.target.value)}
                    rows={3} style={{ ...S.input, resize: "vertical" }}
                    placeholder="SOP number / title" />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={saveDraft} disabled={savingDraft}
                  style={{ ...S.submitBtn, background: savingDraft ? "#94a3b8" : "#92400e", cursor: savingDraft ? "not-allowed" : "pointer" }}>
                  {savingDraft ? "Saving…" : "Save Draft"}
                </button>
                <button onClick={handleSubmit} style={S.submitBtn}>
                  Submit CCV Run {nextRunNumber}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VIEW RUNS TAB ─────────────────────────────────────────── */}
      {activeTab === "view" && (
        <div style={S.card}>
          {!viewingCCV ? (
            <>
              <h3 style={{ marginTop: 0, color: "#004f9f" }}>CCV Run History</h3>

              {/* Filters */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "16px" }}>
                <div>
                  <label style={S.label}>Facility</label>
                  <select value={viewFacility} onChange={e => setViewFacility(e.target.value)} style={{ ...S.input, width: "200px" }}>
                    <option value="">All Facilities</option>
                    {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Product</label>
                  <select value={viewProduct} onChange={e => setViewProduct(e.target.value)} style={{ ...S.input, width: "220px" }}>
                    <option value="">All Products</option>
                    {viewProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                  </select>
                </div>
                <button onClick={loadCCVList} style={S.queryBtn}>Query</button>
              </div>

              {listLoading ? <p style={{ color: "#888" }}>Loading…</p>
                : ccvList.length === 0
                  ? <p style={{ color: "#888", fontStyle: "italic" }}>No CCV runs found. Click Query to load.</p>
                  : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#004f9f", color: "white" }}>
                          <th style={sampCell}>Run #</th>
                          <th style={sampCell}>Product</th>
                          <th style={sampCell}>Facility</th>
                          <th style={sampCell}>Submitted By</th>
                          <th style={sampCell}>Date</th>
                          <th style={sampCell}>Status</th>
                          <th style={sampCell}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ccvList.map((r, i) => (
                          <tr key={r.ccv_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                            <td style={{ ...sampCell, fontWeight: "bold", textAlign: "center" }}>Run {r.run_number}</td>
                            <td style={sampCell}>{r.product_name}</td>
                            <td style={sampCell}>{r.facility_name}</td>
                            <td style={sampCell}>{r.submitted_by}</td>
                            <td style={sampCell}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-IN") : "—"}</td>
                            <td style={{ ...sampCell, textAlign: "center" }}>
                              <span style={{
                                padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold",
                                background: r.status === "Completed" ? "#d4edda" : "#e2e8f0",
                                color:      r.status === "Completed" ? "#155724" : "#555",
                              }}>{r.status}</span>
                            </td>
                            <td style={{ ...sampCell, textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                <button onClick={() => viewCCVDetail(r.ccv_id)} style={S.viewBtn}>View</button>
                                {["QA", "ADMIN"].includes(role) && (
                                  <button onClick={() => { setDeleteTarget(r); setDeletePwd(""); setShowDeleteModal(true); }}
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
            <>
              {/* Run detail toolbar */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
                <button onClick={() => setViewingCCV(null)} style={S.backBtn}>← Back to List</button>
                {viewingCCV.results_data && (
                  <>
                    <button onClick={handlePrint} style={S.printBtn}>Print / Export PDF</button>
                    {["QA", "ADMIN"].includes(role) && (
                      <button onClick={() => { setDeleteTarget(viewingCCV); setDeletePwd(""); setShowDeleteModal(true); }}
                        style={{ ...S.deleteBtn, padding: "9px 16px" }}>Delete Run</button>
                    )}
                  </>
                )}
              </div>

              {viewLoading
                ? <p style={{ color: "#888" }}>Loading…</p>
                : viewingCCV.results_data && (
                  <div ref={printRef}>
                    {renderCCVDetail(viewingCCV, currentUser, logo)}
                  </div>
                )
              }
            </>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      {showSubmitModal && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#004f9f", marginTop: 0 }}>Submit CCV Run {nextRunNumber}</h3>
          <p style={{ fontSize: "13px", color: "#555" }}>
            Product: <strong>{eligibleProducts.find(p => String(p.product_id) === String(selProduct))?.product_name}</strong><br/>
            Batch: <strong>{batchNumber}</strong>
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={submitPwd} onChange={e => setSubmitPwd(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmSubmit(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={confirmSubmit} disabled={submitting}
              style={submitting ? S.saveBtnDisabled : S.saveBtn}>
              {submitting ? "Submitting…" : "Confirm Submit"}
            </button>
            <button onClick={() => setShowSubmitModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

      {showDeleteModal && deleteTarget && (
        <div style={S.overlay}><div style={S.modal}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Delete CCV Run {deleteTarget.run_number}</h3>
          <p style={{ fontSize: "13px" }}>
            <strong>{deleteTarget.product_name}</strong> — {deleteTarget.facility_name}
          </p>
          <p style={{ fontSize: "12px", background: "#f8d7da", padding: "8px 10px", borderRadius: "5px", color: "#721c24" }}>
            This action cannot be undone.
          </p>
          <label style={S.label}>Your Password *</label>
          <input type="password" value={deletePwd} onChange={e => setDeletePwd(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmDelete(); }}
            placeholder="Enter your password" style={S.input} autoFocus />
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={confirmDelete} disabled={deleting}
              style={deleting ? S.saveBtnDisabled : { ...S.saveBtn, background: "#dc3545" }}>
              {deleting ? "Deleting…" : "Confirm Delete"}
            </button>
            <button onClick={() => setShowDeleteModal(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </div></div>
      )}

    </div>
  );
}

// ── Read-only detail view ────────────────────────────────────────────
function renderCCVDetail(ccv, currentUser, logoSrc) {
  const rd       = ccv.results_data;
  const eqList   = rd?.run?.equipment_results || [];
  const passStyle = { color: "#155724", fontWeight: "bold" };
  const failStyle = { color: "#dc3545", fontWeight: "bold" };
  const pf = (result, limit) => {
    if (!result || limit == null) return null;
    return parseFloat(result) <= parseFloat(limit);
  };

  return (
    <div style={{ background: "white", borderRadius: "10px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>

      {/* Cover */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "3px solid #004f9f", paddingBottom: "16px", marginBottom: "20px" }}>
        <img src={logoSrc} alt="Cipla" style={{ height: 50, marginRight: 20 }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: "#004f9f" }}>Continuous Cleaning Verification</h2>
          <p style={{ margin: "4px 0 0", color: "#555", fontSize: "13px" }}>
            Run {ccv.run_number} &nbsp;|&nbsp; {ccv.product_name} &nbsp;|&nbsp; {ccv.facility_name}
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
          <p style={{ margin: 0 }}>Protocol: <strong>{ccv.doc_number || "—"}</strong></p>
          <p style={{ margin: "2px 0 0" }}>Submitted by: <strong>{ccv.submitted_by}</strong></p>
          <p style={{ margin: "2px 0 0" }}>{ccv.submitted_at ? new Date(ccv.submitted_at).toLocaleString("en-IN") : ""}</p>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
        {[
          ["Batch No.",       rd?.run?.batch_number || "—"],
          ["Completion Date", rd.completion_date ? new Date(rd.completion_date).toLocaleDateString("en-IN") : "—"],
          ["Training Details", rd.training_details || "—"],
          ["SOP Followed",    rd.sop_followed || "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#f0f4ff", borderRadius: "6px", padding: "10px 14px" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" }}>{k}</p>
            <p style={{ margin: "3px 0 0", fontWeight: "bold", fontSize: "12px" }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              <th style={{ ...sampCell, textAlign: "left" }}>Equipment</th>
              <th style={{ ...sampCell, textAlign: "left" }}>Sample</th>
              <th style={{ ...sampCell, textAlign: "center" }}>Limit (ppm)</th>
              <th style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #6a9fd8" }}>Insp. Lot No.</th>
              <th style={{ ...sampCell, textAlign: "center" }}>Result (ppm)</th>
              <th style={{ ...sampCell, textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {eqList.map((eq, i) => {
              const isSynth = eq.eq_type === "synthesis";
              const isFirstSynth = isSynth && (i === 0 || eqList[i - 1]?.eq_type !== "synthesis");
              const rowCount = 1 + (eq.swab_results?.length || 0);
              const bg = isSynth ? "#fffbf5" : (i % 2 === 0 ? "white" : "#f8fafc");
              const rPass = pf(eq.rinse_result_ppm, eq.rinse_limit_ppm);
              return (
                <React.Fragment key={i}>
                  {isFirstSynth && (
                    <tr>
                      <td colSpan={6} style={{
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
                      <div style={{ fontWeight: "normal", color: "#666", fontSize: "11px" }}>{eq.category_name}</div>
                      {isSynth && (
                        <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "600", marginTop: "2px" }}>
                          Synthesis Step — Fixed 10 ppm
                        </div>
                      )}
                    </td>
                    <td style={sampCell}>Rinse</td>
                    <td style={{ ...sampCell, textAlign: "center", color: isSynth ? "#9a3412" : "#004f9f", fontWeight: "bold" }}>{eq.rinse_limit_ppm ?? "—"}</td>
                    <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>{eq.rinse_lot_number || "—"}</td>
                    <td style={{ ...sampCell, textAlign: "center" }}>{eq.rinse_result_ppm || "—"}</td>
                    <td style={{ ...sampCell, textAlign: "center", ...(rPass === true ? passStyle : rPass === false ? failStyle : {}) }}>
                      {rPass === true ? "PASS" : rPass === false ? "FAIL" : "—"}
                    </td>
                  </tr>
                  {(eq.swab_results || []).map((s, j) => {
                    const sPass = pf(s.result_ppm, eq.swab_limit_ppm);
                    return (
                      <tr key={j} style={{ background: bg }}>
                        <td style={{ ...sampCell, color: isSynth ? "#7c2d12" : "#444" }}>
                          <span style={{ fontWeight: "600", color: isSynth ? "#9a3412" : "#004f9f" }}>{s.sample_number}</span>
                          {" — "}{s.location_description}
                        </td>
                        <td style={{ ...sampCell, textAlign: "center", color: isSynth ? "#9a3412" : "#004f9f", fontWeight: "bold" }}>{eq.swab_limit_ppm ?? "—"}</td>
                        <td style={{ ...sampCell, textAlign: "center", borderLeft: "2px solid #e2e8f0" }}>{s.lot_number || "—"}</td>
                        <td style={{ ...sampCell, textAlign: "center" }}>{s.result_ppm || "—"}</td>
                        <td style={{ ...sampCell, textAlign: "center", ...(sPass === true ? passStyle : sPass === false ? failStyle : {}) }}>
                          {sPass === true ? "PASS" : sPass === false ? "FAIL" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {eq.swab_results?.length === 0 && (
                    <tr style={{ background: bg }}>
                      <td colSpan={5} style={{ ...sampCell, color: "#999", fontStyle: "italic" }}>
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

      <p style={{ marginTop: "24px", fontSize: "11px", color: "#aaa", textAlign: "center" }}>
        Falcon — Confidential &nbsp;|&nbsp; Printed by {currentUser} on {new Date().toLocaleString("en-IN")}
      </p>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────
const sampCell  = { border: "1px solid #e2e8f0", padding: "8px 12px" };
const inputStyle = { width: "80px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc", textAlign: "center", fontSize: "12px" };

const S = {
  pageHeader: {
    display: "flex", alignItems: "center", gap: "14px",
    background: "#004f9f", color: "white",
    padding: "16px 20px", borderRadius: "10px", marginBottom: "20px",
  },
  backBtn: { padding: "8px 14px", background: "white", color: "#004f9f", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  tabBar:    { display: "flex", gap: "4px", marginBottom: "20px" },
  tabActive: { padding: "10px 22px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px 6px 0 0", cursor: "pointer", fontWeight: "bold" },
  tabInactive: { padding: "10px 22px", background: "white", color: "#666", border: "1px solid #ddd", borderRadius: "6px 6px 0 0", cursor: "pointer" },
  card:    { background: "white", borderRadius: "10px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" },
  label:   { display: "block", fontSize: "12px", fontWeight: "bold", color: "#444", marginBottom: "4px" },
  input:   { width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" },
  runBadge: { background: "#004f9f", color: "white", padding: "3px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold" },
  submitBtn: { padding: "12px 28px", background: "#004f9f", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  queryBtn:  { padding: "9px 20px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  viewBtn:   { padding: "5px 12px", background: "#004f9f", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "12px" },
  deleteBtn: { padding: "5px 12px", background: "white", color: "#dc3545", border: "1px solid #dc3545", borderRadius: "5px", cursor: "pointer", fontSize: "12px" },
  printBtn:  { padding: "9px 16px", background: "#166534", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal:     { background: "white", borderRadius: "12px", padding: "28px 32px", maxWidth: "440px", width: "90%", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" },
  saveBtn:   { padding: "10px 22px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  saveBtnDisabled: { padding: "10px 22px", background: "#94a3b8", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontSize: "13px" },
  cancelBtn: { padding: "10px 22px", background: "white", color: "#555", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
};

export default ContinuousCleaningVerificationPage;
