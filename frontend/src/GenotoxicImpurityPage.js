import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import logo from "./assets/cipla-logo.png";

// ─── helpers ────────────────────────────────────────────────────────────────
function apiErr(e, fb = "An unexpected error occurred.") {
  const d = e?.response?.data?.detail;
  if (!d) return fb;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(x => x.msg || JSON.stringify(x)).join("; ");
  return JSON.stringify(d);
}
function badge(status) {
  if (!status) return null;
  const pass = status === "PASS";
  return (
    <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 7px",
      borderRadius: "3px", background: pass ? "#d4edda" : "#f8d7da",
      color: pass ? "#155724" : "#721c24" }}>
      {status}
    </span>
  );
}
// Format genotoxic limit values — use scientific notation for very small numbers
function fmtGeo(val) {
  if (val == null) return "—";
  if (val === 0) return "0";
  if (val > 0 && val < 0.0001) return val.toExponential(3);
  return String(val);
}

const EMPTY_FORM = {
  impurity_name:     "",
  pde_ug_day:        "",
  analytical_method: "",
  lod_ppm:           "",
  loq_ppm:           "",
  equipment_ids:     [],
};

export default function GenotoxicImpurityPage({ goHome, currentUser, role }) {
  // ── Facility / Product selectors ─────────────────────────────────────────
  const [facilities,        setFacilities]        = useState([]);
  const [selectedFacility,  setSelectedFacility]  = useState("");
  const [products,          setProducts]          = useState([]);
  const [selectedProduct,   setSelectedProduct]   = useState("");
  const [productEquipment,  setProductEquipment]  = useState([]);  // equipment for selected product

  // ── Impurity list ────────────────────────────────────────────────────────
  const [impurities,  setImpurities]  = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // ── Calculated limits ────────────────────────────────────────────────────
  const [limits,        setLimits]        = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(false);

  // ── Add / Edit modal ─────────────────────────────────────────────────────
  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);  // null = add, else impurity object
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  // ── Delete modal ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePwd,    setDeletePwd]    = useState("");
  const [deleting,     setDeleting]     = useState(false);

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("mapping");   // "mapping" | "limits"

  // ── Load facilities ───────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/facility/all").then(r => setFacilities(r.data)).catch(console.error);
  }, []);

  // ── Load products when facility changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedFacility) { setProducts([]); setSelectedProduct(""); return; }
    api.get("/product/all")
      .then(r => setProducts(r.data.filter(p => String(p.facility_id) === String(selectedFacility))))
      .catch(console.error);
    setSelectedProduct("");
  }, [selectedFacility]);

  // ── Load impurities + product equipment when product changes ─────────────
  const loadImpurities = useCallback(async (pid) => {
    if (!pid) { setImpurities([]); setLimits(null); return; }
    setListLoading(true);
    try {
      const r = await api.get(`/genotoxic/impurities?product_id=${pid}`);
      setImpurities(r.data);
    } catch (e) { console.error(e); }
    finally { setListLoading(false); }
  }, []);

  const loadProductEquipment = useCallback(async (pid) => {
    if (!pid) { setProductEquipment([]); return; }
    try {
      const [eqIdsRes, allEqRes] = await Promise.all([
        api.get(`/product/${pid}/equipment`),
        api.get("/equipment/all"),
      ]);
      const eqIds = eqIdsRes.data || [];
      const allEq = allEqRes.data || [];
      setProductEquipment(allEq.filter(e => eqIds.includes(e.equipment_id)));
    } catch { setProductEquipment([]); }
  }, []);

  useEffect(() => {
    setImpurities([]);
    setLimits(null);
    setActiveTab("mapping");
    if (selectedProduct) {
      loadImpurities(selectedProduct);
      loadProductEquipment(selectedProduct);
    } else {
      setProductEquipment([]);
    }
  }, [selectedProduct, loadImpurities, loadProductEquipment]);

  // ── Calculate limits ─────────────────────────────────────────────────────
  const calcLimits = async () => {
    setLimitsLoading(true);
    try {
      const r = await api.get(`/genotoxic/limits/${selectedProduct}`);
      setLimits(r.data);
    } catch (e) { alert(apiErr(e, "Error calculating limits ❌")); }
    finally { setLimitsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "limits" && selectedProduct && limits === null) {
      calcLimits();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProduct]);

  // ── Open add modal ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = (imp) => {
    setEditTarget(imp);
    setForm({
      impurity_name:     imp.impurity_name,
      pde_ug_day:        imp.pde_ug_day,
      analytical_method: imp.analytical_method || "",
      lod_ppm:           imp.lod_ppm ?? "",
      loq_ppm:           imp.loq_ppm ?? "",
      equipment_ids:     imp.equipment_ids || [],
    });
    setShowModal(true);
  };

  // ── Save (add or edit) ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.impurity_name.trim()) { alert("Enter impurity name ❌"); return; }
    if (!form.pde_ug_day || isNaN(parseFloat(form.pde_ug_day)) || parseFloat(form.pde_ug_day) <= 0) {
      alert("Enter a valid PDE/ADE (μg/day) > 0 ❌"); return;
    }
    const src = products.find(p => String(p.product_id) === String(selectedProduct));
    const payload = {
      product_id:        parseInt(selectedProduct),
      facility_id:       parseInt(selectedFacility),
      impurity_name:     form.impurity_name.trim(),
      pde_ug_day:        parseFloat(form.pde_ug_day),
      analytical_method: form.analytical_method || null,
      lod_ppm:           form.lod_ppm !== "" ? parseFloat(form.lod_ppm) : null,
      loq_ppm:           form.loq_ppm !== "" ? parseFloat(form.loq_ppm) : null,
      equipment_ids:     form.equipment_ids,
    };
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/genotoxic/impurities/${editTarget.impurity_id}`, payload);
      } else {
        await api.post("/genotoxic/impurities", payload);
      }
      setShowModal(false);
      setLimits(null);   // invalidate cached limits
      loadImpurities(selectedProduct);
    } catch (e) { alert(apiErr(e, "Save failed ❌")); }
    finally { setSaving(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletePwd) { alert("Enter your password ❌"); return; }
    setDeleting(true);
    try {
      await api.delete(`/genotoxic/impurities/${deleteTarget.impurity_id}`,
        { data: { password: deletePwd } });
      setDeleteTarget(null);
      setDeletePwd("");
      setLimits(null);
      loadImpurities(selectedProduct);
    } catch (e) { alert(apiErr(e, "Delete failed ❌")); }
    finally { setDeleting(false); }
  };

  // ── Toggle equipment selection ────────────────────────────────────────────
  const toggleEq = (eqId) => {
    setForm(prev => {
      const ids = prev.equipment_ids.includes(eqId)
        ? prev.equipment_ids.filter(x => x !== eqId)
        : [...prev.equipment_ids, eqId];
      return { ...prev, equipment_ids: ids };
    });
  };

  const selectedProdObj = products.find(p => String(p.product_id) === String(selectedProduct));

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logo} alt="Cipla" style={{ width: "40px", filter: "brightness(0) invert(1)" }} />
          <div>
            <h2 style={{ margin: 0, color: "white", fontSize: "18px" }}>Genotoxic &amp; Nitrosamine Impurity</h2>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>
              ICH M7 / EMA Nitrosamine Guideline — Cleaning Limit Assessment
            </p>
          </div>
        </div>
        <button onClick={goHome} style={S.backBtn}>Back to Home</button>
      </div>

      {/* Selectors */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={S.fieldGroup}>
            <label style={S.label}>Facility</label>
            <select style={S.select} value={selectedFacility}
              onChange={e => setSelectedFacility(e.target.value)}>
              <option value="">— Select Facility —</option>
              {facilities.map(f => (
                <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
              ))}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Product</label>
            <select style={S.select} value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              disabled={!selectedFacility}>
              <option value="">— Select Product —</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {selectedProduct && (
        <>
          <div style={{ display: "flex", gap: "4px", marginBottom: "0" }}>
            {[
              { key: "mapping", label: "Impurity Mapping" },
              { key: "limits",  label: "Calculated Limits" },
            ].map(t => (
              <button key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: "9px 20px", border: "none", cursor: "pointer", fontWeight: "600",
                  fontSize: "13px", borderRadius: "8px 8px 0 0",
                  background: activeTab === t.key ? "white" : "#cbd5e1",
                  color: activeTab === t.key ? "#004f9f" : "#475569",
                  borderBottom: activeTab === t.key ? "2px solid white" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Mapping ─────────────────────────────────────────────── */}
          {activeTab === "mapping" && (
            <div style={{ ...S.card, borderTopLeftRadius: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: "700", color: "#1e293b", fontSize: "14px" }}>
                    {selectedProdObj?.product_name}
                  </p>
                  <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "11px" }}>
                    Facility: {facilities.find(f => String(f.facility_id) === String(selectedFacility))?.facility_name}
                  </p>
                </div>
                <button onClick={openAdd} style={S.addBtn}>+ Add Impurity</button>
              </div>

              {listLoading ? (
                <p style={S.muted}>Loading…</p>
              ) : impurities.length === 0 ? (
                <div style={S.emptyBox}>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                    No genotoxic / nitrosamine impurities mapped to this product yet.
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "11px" }}>
                    Click "Add Impurity" to map an impurity with its PDE/ADE value.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {impurities.map((imp) => {
                    const mappedEq = imp.equipment_ids
                      .map(id => productEquipment.find(e => e.equipment_id === id))
                      .filter(Boolean);
                    return (
                      <div key={imp.impurity_id} style={S.impurityBlock}>
                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: "700", fontSize: "14px", color: "#1e293b" }}>{imp.impurity_name}</span>
                            <span style={{ marginLeft: "12px", fontSize: "13px", color: "#dc2626", fontWeight: "600" }}>
                              PDE/ADE: {imp.pde_ug_day} μg/day
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => openEdit(imp)} style={S.editBtn}>Edit</button>
                            <button onClick={() => { setDeleteTarget(imp); setDeletePwd(""); }} style={S.delBtn}>Delete</button>
                          </div>
                        </div>

                        {/* Analytical info chips */}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {imp.analytical_method && <span style={S.chip}>{imp.analytical_method}</span>}
                          {imp.lod_ppm != null && <span style={S.chip}>LOD: {imp.lod_ppm} ppm</span>}
                          {imp.loq_ppm != null && <span style={S.chip}>LOQ: {imp.loq_ppm} ppm</span>}
                          {!imp.analytical_method && imp.lod_ppm == null && imp.loq_ppm == null && (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No method / detection limits defined</span>
                          )}
                        </div>

                        {/* Equipment mapping sub-table */}
                        <div style={{ background: "#f0f4fa", borderRadius: "7px", padding: "10px 12px" }}>
                          <p style={{ margin: "0 0 8px", fontWeight: "700", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Equipment Exposed ({mappedEq.length})
                          </p>
                          {mappedEq.length === 0 ? (
                            <p style={{ margin: 0, color: "#94a3b8", fontSize: "12px" }}>No equipment mapped to this impurity.</p>
                          ) : (
                            <table style={{ ...S.table, borderRadius: "6px", overflow: "hidden" }}>
                              <thead>
                                <tr style={{ background: "#e8f0fb" }}>
                                  <th style={S.th}>Equipment Name</th>
                                  <th style={S.th}>Category</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Surface Area (cm²)</th>
                                  <th style={{ ...S.th, textAlign: "center" }}>Rinse Vol (L)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mappedEq.map((eq, i) => (
                                  <tr key={eq.equipment_id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                                    <td style={{ ...S.td, fontWeight: "600", color: "#1e293b" }}>{eq.equipment_name}</td>
                                    <td style={S.td}>{eq.category_name || "—"}</td>
                                    <td style={{ ...S.td, textAlign: "center" }}>{eq.surface_area_cm2 ?? "—"}</td>
                                    <td style={{ ...S.td, textAlign: "center" }}>{eq.rinse_volume_liters ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Limits ──────────────────────────────────────────────── */}
          {activeTab === "limits" && (
            <div style={{ ...S.card, borderTopLeftRadius: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <p style={{ margin: 0, fontWeight: "700", color: "#1e293b", fontSize: "14px" }}>
                  Calculated Cleaning Limits — {selectedProdObj?.product_name}
                </p>
                <button onClick={() => { setLimits(null); calcLimits(); }} style={S.refreshBtn}>
                  Recalculate
                </button>
              </div>

              {/* Formula box */}
              <div style={S.formulaBox}>
                <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "11px", color: "#004f9f" }}>
                  Calculation Methodology
                </p>
                <code style={{ fontSize: "11px", color: "#1e293b", lineHeight: "1.8" }}>
                  MACO (mg) = PDE_impurity (μg/day) × MinYield_target (kg) × 1,000 / MaxDose_target (mg)<br/>
                  Rinse (ppm) = MACO (mg) × 9 in² / [Surface_area (in²) × Rinse_vol (L)]<br/>
                  Swab  (ppm) = MACO (mg) × 9 in² × 100 / Surface_area (in²)
                </code>
              </div>

              {limitsLoading ? (
                <p style={S.muted}>Calculating…</p>
              ) : !limits ? (
                <p style={S.muted}>No data.</p>
              ) : limits.length === 0 ? (
                <div style={S.emptyBox}>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                    No impurities mapped. Add impurities in the Impurity Mapping tab first.
                  </p>
                </div>
              ) : (
                limits.map((imp, idx) => (
                  <div key={imp.impurity_id} style={{ ...S.impurityBlock, marginBottom: idx < limits.length - 1 ? "20px" : 0 }}>
                    {/* Impurity header */}
                    <div style={S.impurityHeader}>
                      <div>
                        <span style={{ fontWeight: "700", fontSize: "14px", color: "#1e293b" }}>
                          {imp.impurity_name}
                        </span>
                        <span style={{ marginLeft: "12px", fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>
                          PDE/ADE: {imp.pde_ug_day} μg/day
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {imp.analytical_method && <span style={S.chip}>{imp.analytical_method}</span>}
                        {imp.lod_ppm != null && <span style={S.chip}>LOD {imp.lod_ppm} ppm</span>}
                        {imp.loq_ppm != null && <span style={S.chip}>LOQ {imp.loq_ppm} ppm</span>}
                      </div>
                    </div>

                    {imp.target_products.length === 0 ? (
                      <p style={{ ...S.muted, margin: "10px 0 0" }}>
                        No target products share this equipment. Ensure equipment is mapped to other products in the facility.
                      </p>
                    ) : (
                      <>
                        {/* Per-target-product breakdown table */}
                        <table style={{ ...S.table, marginTop: "10px" }}>
                          <thead>
                            <tr style={{ background: "#fef3c7" }}>
                              <th style={S.th}>Target Product</th>
                              <th style={{ ...S.th, textAlign: "center" }}>MACO (mg)</th>
                              <th style={S.th}>Equipment</th>
                              <th style={{ ...S.th, textAlign: "center" }}>Rinse Limit (ppm)</th>
                              <th style={{ ...S.th, textAlign: "center" }}>Swab Limit (ppm)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {imp.target_products.map((tp, ti) =>
                              (tp.equipment || []).map((eq, ei) => (
                                <tr key={`${ti}-${ei}`} style={{ background: ti % 2 === 0 ? "white" : "#fffbf0" }}>
                                  {ei === 0 && (
                                    <>
                                      <td style={{ ...S.td, fontWeight: "600", color: "#1e293b", verticalAlign: "top" }}
                                        rowSpan={(tp.equipment || []).length}>
                                        {tp.product_name}
                                      </td>
                                      <td style={{ ...S.td, textAlign: "center", fontWeight: "700",
                                        color: "#92400e", verticalAlign: "top" }}
                                        rowSpan={(tp.equipment || []).length}>
                                        {tp.maco_mg}
                                      </td>
                                    </>
                                  )}
                                  <td style={{ ...S.td, color: "#475569" }}>{eq.name}</td>
                                  <td style={{ ...S.td, textAlign: "center", fontWeight: "700", color: "#1d4ed8" }}>
                                    {fmtGeo(eq.rinse_limit)}
                                  </td>
                                  <td style={{ ...S.td, textAlign: "center", fontWeight: "700", color: "#1d4ed8" }}>
                                    {fmtGeo(eq.swab_limit)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {/* Governing limits */}
                        <div style={S.governingRow}>
                          <span style={{ fontWeight: "700", fontSize: "12px", color: "#1e293b" }}>
                            Governing Limits (most conservative across all products &amp; equipment):
                          </span>
                          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                            <span style={S.govValue}>
                              Rinse: <strong style={{ color: "#1d4ed8" }}>{fmtGeo(imp.governing_rinse_limit)} ppm</strong>
                              {" "}{badge(imp.rinse_status)}
                            </span>
                            <span style={S.govValue}>
                              Swab: <strong style={{ color: "#1d4ed8" }}>{fmtGeo(imp.governing_swab_limit)} ppm</strong>
                              {" "}{badge(imp.swab_status)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Placeholder when no product selected */}
      {!selectedProduct && (
        <div style={S.card}>
          <p style={S.muted}>Select a facility and product above to begin mapping genotoxic impurities.</p>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{editTarget ? "Edit Impurity" : "Add Genotoxic / Nitrosamine Impurity"}</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
              Product: <strong>{selectedProdObj?.product_name}</strong>
            </p>

            <div style={S.formGrid}>
              <div style={S.fg2}>
                <label style={S.label}>Impurity Name *</label>
                <input style={S.input} value={form.impurity_name}
                  placeholder="e.g. NDMA, NDEA, NMBA…"
                  onChange={e => setForm(p => ({ ...p, impurity_name: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>PDE / ADE (μg/day) *</label>
                <input style={S.input} type="number" min="0" step="any"
                  value={form.pde_ug_day}
                  placeholder="e.g. 0.03"
                  onChange={e => setForm(p => ({ ...p, pde_ug_day: e.target.value }))} />
              </div>

              <div style={S.fg2}>
                <label style={S.label}>Analytical Method</label>
                <input style={S.input} value={form.analytical_method}
                  placeholder="e.g. HPLC-UV, GC-MS, LC-MS/MS"
                  onChange={e => setForm(p => ({ ...p, analytical_method: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>LOD (ppm)</label>
                <input style={S.input} type="number" min="0" step="any"
                  value={form.lod_ppm}
                  onChange={e => setForm(p => ({ ...p, lod_ppm: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>LOQ (ppm)</label>
                <input style={S.input} type="number" min="0" step="any"
                  value={form.loq_ppm}
                  onChange={e => setForm(p => ({ ...p, loq_ppm: e.target.value }))} />
              </div>
            </div>

            {/* Equipment multi-select */}
            <div style={{ marginTop: "14px" }}>
              <label style={{ ...S.label, display: "block", marginBottom: "6px" }}>
                Equipment Exposed to this Impurity (select all that apply)
              </label>
              {productEquipment.length === 0 ? (
                <p style={{ ...S.muted, fontSize: "11px" }}>
                  No equipment mapped to this product. Map equipment in the Product page first.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {productEquipment.map(eq => {
                    const sel = form.equipment_ids.includes(eq.equipment_id);
                    return (
                      <button key={eq.equipment_id} type="button"
                        onClick={() => toggleEq(eq.equipment_id)}
                        style={{
                          padding: "6px 12px", border: `2px solid ${sel ? "#004f9f" : "#cbd5e1"}`,
                          borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                          background: sel ? "#004f9f" : "white",
                          color: sel ? "white" : "#475569",
                          fontWeight: sel ? "700" : "normal",
                        }}>
                        {eq.equipment_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "22px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={S.cancelBtn} disabled={saving}>Cancel</button>
              <button onClick={handleSave} style={S.saveBtn} disabled={saving}>
                {saving ? "Saving…" : (editTarget ? "Update" : "Add Impurity")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: "380px" }}>
            <h3 style={{ ...S.modalTitle, color: "#dc2626" }}>Delete Impurity</h3>
            <p style={{ fontSize: "13px", color: "#555" }}>
              Delete <strong>{deleteTarget.impurity_name}</strong> from this product?
              This action is irreversible.
            </p>
            <label style={S.label}>Confirm with your password</label>
            <input type="password" style={S.input} value={deletePwd}
              placeholder="Your password"
              onChange={e => setDeletePwd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleDelete()} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={S.cancelBtn} disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ ...S.saveBtn, background: "#dc2626" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  header: {
    background: "#004f9f",
    borderRadius: "12px",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  backBtn: {
    padding: "8px 16px", background: "rgba(255,255,255,0.15)", color: "white",
    border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px",
    cursor: "pointer", fontWeight: "bold", fontSize: "13px",
  },
  card: {
    background: "white", borderRadius: "10px", padding: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: "16px",
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "4px", minWidth: "220px" },
  label: { fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" },
  select: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", minWidth: "200px" },
  input: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px", width: "100%", boxSizing: "border-box" },
  addBtn: {
    padding: "8px 18px", background: "#004f9f", color: "white",
    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px",
  },
  refreshBtn: {
    padding: "7px 14px", background: "#f1f5f9", color: "#334155",
    border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
  },
  editBtn: {
    padding: "4px 10px", background: "#e0edff", color: "#004f9f",
    border: "1px solid #93c5fd", borderRadius: "4px", cursor: "pointer",
    fontSize: "11px", fontWeight: "600", marginRight: "4px",
  },
  delBtn: {
    padding: "4px 10px", background: "#fee2e2", color: "#dc2626",
    border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer",
    fontSize: "11px", fontWeight: "600",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { padding: "8px 10px", fontWeight: "700", color: "#374151", textAlign: "left", fontSize: "11px", borderBottom: "2px solid #e2e8f0" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: "12px" },
  muted: { color: "#94a3b8", fontSize: "13px", fontStyle: "italic" },
  emptyBox: {
    background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px",
    padding: "24px", textAlign: "center",
  },
  formulaBox: {
    background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px",
    padding: "12px 16px", marginBottom: "16px",
  },
  impurityBlock: {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px",
  },
  impurityHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "10px", flexWrap: "wrap", gap: "8px",
  },
  chip: {
    padding: "2px 8px", background: "#e2e8f0", color: "#475569",
    borderRadius: "4px", fontSize: "11px", fontWeight: "600",
  },
  governingRow: {
    marginTop: "12px", padding: "10px 14px",
    background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: "10px",
  },
  govValue: { fontSize: "12px", color: "#1e293b" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: "white", borderRadius: "12px", padding: "28px",
    width: "100%", maxWidth: "640px", maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  modalTitle: { margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#1e293b" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  fg2: { gridColumn: "1 / -1" },
  saveBtn: {
    padding: "9px 22px", background: "#004f9f", color: "white",
    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px",
  },
  cancelBtn: {
    padding: "9px 22px", background: "#f1f5f9", color: "#334155",
    border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
  },
};
