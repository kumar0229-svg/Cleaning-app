import React, { useState, useEffect } from "react";
import api from "./api";

const CHANGE_CATEGORIES = [
  "New Product Introduction",
  "Mapping Change",
  "Product Parameter Change",
  "Other",
];

const RECORD_TYPE_LABELS = {
  FACILITY_LIMIT_IMPACT: "Facility-Wide Limit Impact",
  LIMIT_CHANGE: "Limit Changes",
  PROTOCOL:     "Cleaning Validation Protocol",
  REPORT:       "Cleaning Validation Report",
  CCV:          "Continuous Cleaning Verification",
  DEHT:         "DEHT Report",
};

function statusBadgeColor(status) {
  const map = {
    Draft:     "#e6a817",
    Submitted: "#17a2b8",
    Approved:  "#28a745",
    Completed: "#28a745",
    Final:     "#28a745",
  };
  return map[status] || "#6c757d";
}

function ImpactAssessmentPage({ goHome }) {
  const [mode, setMode] = useState("list"); // list | new | detail

  const [assessments, setAssessments] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qmsReference, setQmsReference] = useState("");
  const [changeCategory, setChangeCategory] = useState(CHANGE_CATEGORIES[0]);
  const [changeDescription, setChangeDescription] = useState("");
  const [validationRecords, setValidationRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanRun, setScanRun] = useState(false);

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const res = await api.get("/impact-assessment/list");
      setAssessments(res.data);
    } catch (err) {
      console.log("Error loading impact assessments:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const startNew = async () => {
    setMode("new");
    setSelectedProductId("");
    setQmsReference("");
    setChangeCategory(CHANGE_CATEGORIES[0]);
    setChangeDescription("");
    setValidationRecords([]);
    setCheckedItems({});
    setFormError("");
    setScanRun(false);
    if (products.length === 0) {
      try {
        const res = await api.get("/product/all");
        setProducts(res.data);
      } catch (err) {
        console.log("Error loading products:", err);
      }
    }
  };

  const onSelectProduct = async (id) => {
    setSelectedProductId(id);
    setValidationRecords([]);
    setCheckedItems({});
    setScanRun(false);
    if (!id) return;
    setLoadingRecords(true);
    try {
      const res = await api.get(`/product/${id}/validation-records`);
      setValidationRecords(res.data);
    } catch (err) {
      console.log("Error loading validation records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  const runFacilityScan = async () => {
    const product = products.find(p => String(p.product_id) === String(selectedProductId));
    if (!product) { setFormError("Select a product first."); return; }

    setScanning(true);
    setFormError("");
    try {
      const res = await api.post("/impact-assessment/scan-limit-impact", {
        facility_id: product.facility_id,
      });
      const scanItems = res.data.changes.map(c => ({
        record_type: "FACILITY_LIMIT_IMPACT",
        record_id: c.product_id,
        label: `${c.product_name}: ${c.earlier_limit ?? "N/A"} mg → ${c.new_limit ?? "N/A"} mg`,
        status: null,
      }));
      setValidationRecords(prev => [
        ...prev.filter(r => r.record_type !== "FACILITY_LIMIT_IMPACT"),
        ...scanItems,
      ]);
      setScanRun(true);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to scan facility for limit impact.");
    } finally {
      setScanning(false);
    }
  };

  const toggleItem = (rec) => {
    const key = `${rec.record_type}_${rec.record_id}`;
    setCheckedItems(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { ...rec, impact_note: "", recommendation: "" };
      }
      return next;
    });
  };

  const updateItemField = (key, field, value) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!selectedProductId) { setFormError("Select a product."); return; }
    if (!qmsReference.trim()) { setFormError("QMS reference number is required."); return; }
    const items = Object.values(checkedItems);
    if (items.length === 0) { setFormError("Select at least one validation record to assess."); return; }

    setSubmitting(true);
    try {
      await api.post("/impact-assessment/create", {
        product_id: Number(selectedProductId),
        qms_reference: qmsReference.trim(),
        change_category: changeCategory,
        change_description: changeDescription,
        items: items.map(it => ({
          record_type: it.record_type,
          record_id: it.record_id,
          record_label: it.label,
          record_status_snapshot: it.status,
          impact_note: it.impact_note,
          recommendation: it.recommendation,
        })),
      });
      setMode("list");
      loadList();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to save impact assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    setMode("detail");
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/impact-assessment/${id}`);
      setDetail(res.data);
    } catch (err) {
      console.log("Error loading impact assessment:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const groupedRecords = validationRecords.reduce((acc, r) => {
    (acc[r.record_type] = acc[r.record_type] || []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>Impact Assessment</h2>
        <button onClick={mode === "list" ? goHome : () => setMode("list")} style={styles.backBtn}>
          {mode === "list" ? "Back to Home" : "Back to List"}
        </button>
      </div>

      {mode === "list" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ margin: 0, color: "#555", fontSize: "13px" }}>
              Showing <strong>{assessments.length}</strong> record{assessments.length !== 1 ? "s" : ""}
            </p>
            <button onClick={startNew} style={styles.primaryBtn}>+ New Impact Assessment</button>
          </div>

          {loadingList ? (
            <p style={{ color: "#004f9f" }}>Loading...</p>
          ) : assessments.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ margin: 0, fontSize: "15px", color: "#555" }}>No impact assessments recorded yet.</p>
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#aaa" }}>
                Click <strong>+ New Impact Assessment</strong> to document the impact of a product change.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#004f9f", color: "white" }}>
                    <th style={cell}>ID</th>
                    <th style={cell}>Product</th>
                    <th style={cell}>QMS Reference</th>
                    <th style={cell}>Change Category</th>
                    <th style={cell}>Items</th>
                    <th style={cell}>Created By</th>
                    <th style={cell}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a, index) => (
                    <tr
                      key={a.id}
                      style={{ background: index % 2 === 0 ? "#f8fafc" : "white", cursor: "pointer" }}
                      onClick={() => openDetail(a.id)}
                    >
                      <td style={cell}>{a.id}</td>
                      <td style={cell}>{a.product_name}</td>
                      <td style={cell}>{a.qms_reference}</td>
                      <td style={cell}>{a.change_category}</td>
                      <td style={cell}>{a.item_count}</td>
                      <td style={{ ...cell, fontWeight: "600" }}>{a.created_by}</td>
                      <td style={cell}>{a.created_at ? new Date(a.created_at).toLocaleString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {mode === "new" && (
        <div style={styles.filterCard}>
          <div style={styles.formGrid}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Product *</label>
              <select value={selectedProductId} onChange={e => onSelectProduct(e.target.value)} style={styles.select}>
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>QMS Reference Number *</label>
              <input
                type="text"
                value={qmsReference}
                onChange={e => setQmsReference(e.target.value)}
                placeholder="e.g. CC-2026-0142"
                style={styles.dateInput}
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Change Category</label>
              <select value={changeCategory} onChange={e => setChangeCategory(e.target.value)} style={styles.select}>
                {CHANGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={styles.filterLabel}>Change Description</label>
            <textarea
              value={changeDescription}
              onChange={e => setChangeDescription(e.target.value)}
              rows={3}
              style={styles.textarea}
              placeholder="Describe what changed on the product (e.g. equipment mapping updated, dose revised)..."
            />
          </div>

          {selectedProductId && (
            <div style={{ marginTop: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <button onClick={runFacilityScan} disabled={scanning} style={styles.primaryBtn}>
                  {scanning ? "Scanning..." : "Scan Facility for Limit Impact"}
                </button>
                <span style={{ fontSize: "12px", color: "#666" }}>
                  Recalculates the MACO limit for every product in this facility and lists any whose
                  governing limit changed — may take a few seconds.
                </span>
              </div>
              {scanRun && (
                <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#28a745" }}>
                  Scan complete — results merged into Facility-Wide Limit Impact below.
                </p>
              )}
            </div>
          )}

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ fontSize: "15px", color: "#004f9f", margin: "0 0 8px" }}>Affected Validation Records</h3>
            {!selectedProductId ? (
              <p style={{ color: "#888", fontSize: "13px" }}>Select a product to see its validation records.</p>
            ) : loadingRecords ? (
              <p style={{ color: "#004f9f" }}>Loading records...</p>
            ) : validationRecords.length === 0 ? (
              <p style={{ color: "#888", fontSize: "13px" }}>No existing validation records found for this product.</p>
            ) : (
              Object.keys(RECORD_TYPE_LABELS).filter(t => groupedRecords[t]).map(type => (
                <div key={type} style={{ marginBottom: "14px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#374151", margin: "0 0 6px", textTransform: "uppercase" }}>
                    {RECORD_TYPE_LABELS[type]}
                  </p>
                  {groupedRecords[type].map(rec => {
                    const key = `${rec.record_type}_${rec.record_id}`;
                    const checked = !!checkedItems[key];
                    return (
                      <div key={key} style={styles.recordRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleItem(rec)} />
                          <span style={{ fontSize: "13px" }}>{rec.label}</span>
                          {rec.status && (
                            <span style={{ ...styles.badge, background: statusBadgeColor(rec.status) }}>{rec.status}</span>
                          )}
                        </div>
                        {checked && (
                          <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div>
                              <label style={styles.filterLabel}>Impact on this validation</label>
                              <textarea
                                rows={2}
                                style={styles.textarea}
                                value={checkedItems[key].impact_note}
                                onChange={e => updateItemField(key, "impact_note", e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={styles.filterLabel}>Recommendation / Suggestion</label>
                              <textarea
                                rows={2}
                                style={styles.textarea}
                                value={checkedItems[key].recommendation}
                                onChange={e => updateItemField(key, "recommendation", e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {formError && <p style={{ color: "#dc3545", fontSize: "13px", margin: "12px 0 0" }}>{formError}</p>}

          <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
            <button onClick={handleSubmit} disabled={submitting} style={styles.primaryBtn}>
              {submitting ? "Saving..." : "Save Impact Assessment"}
            </button>
            <button onClick={() => setMode("list")} style={styles.clearBtn}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "detail" && (
        loadingDetail || !detail ? (
          <p style={{ color: "#004f9f" }}>Loading...</p>
        ) : (
          <div style={styles.filterCard}>
            <div style={styles.formGrid}>
              <div><strong>Product:</strong> {detail.product_name}</div>
              <div><strong>QMS Reference:</strong> {detail.qms_reference}</div>
              <div><strong>Change Category:</strong> {detail.change_category}</div>
              <div><strong>Created By:</strong> {detail.created_by}</div>
              <div><strong>Created At:</strong> {detail.created_at ? new Date(detail.created_at).toLocaleString("en-IN") : "—"}</div>
            </div>
            {detail.change_description && (
              <p style={{ marginTop: "10px", fontSize: "13px", color: "#374151" }}>
                <strong>Change Description:</strong> {detail.change_description}
              </p>
            )}

            <h3 style={{ fontSize: "15px", color: "#004f9f", margin: "20px 0 8px" }}>Assessed Validation Records</h3>
            <div style={{ overflowX: "auto", background: "white", borderRadius: "10px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#004f9f", color: "white" }}>
                    <th style={cell}>Type</th>
                    <th style={cell}>Record</th>
                    <th style={cell}>Status at Assessment</th>
                    <th style={cell}>Impact</th>
                    <th style={cell}>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it, index) => (
                    <tr key={it.id} style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                      <td style={cell}>{RECORD_TYPE_LABELS[it.record_type] || it.record_type}</td>
                      <td style={cell}>{it.record_label}</td>
                      <td style={cell}>
                        <span style={{ ...styles.badge, background: statusBadgeColor(it.record_status_snapshot) }}>
                          {it.record_status_snapshot || "—"}
                        </span>
                      </td>
                      <td style={{ ...cell, textAlign: "left" }}>{it.impact_note || "—"}</td>
                      <td style={{ ...cell, textAlign: "left" }}>{it.recommendation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

    </div>
  );
}

const cell = { border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap" };

const styles = {
  pageHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn:     { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  primaryBtn:  { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  clearBtn:    { padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  filterCard:  { background: "white", borderRadius: "10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  formGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  dateInput:   { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
  select:      { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
  textarea:    { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", fontFamily: "Arial", resize: "vertical", boxSizing: "border-box" },
  recordRow:   { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" },
  emptyState:  { textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  badge:       { padding: "3px 8px", borderRadius: "4px", color: "white", fontSize: "11px", fontWeight: "bold", marginLeft: "8px" },
};

export default ImpactAssessmentPage;
