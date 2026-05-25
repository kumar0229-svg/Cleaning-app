import React, { useState, useEffect } from "react";
import api from "./api";

const POLICY_DESCRIPTIONS = {
  all_min: {
    label: "All Methods — Most Conservative",
    detail: "Computes PDE-based, Dose-based, and 10 ppm limits. The smallest value governs. Recommended for highest regulatory assurance.",
    methods: ["PDE / ADE", "Dose (1/1000th)", "10 ppm"],
    color: "#004f9f",
    bg: "#eef4ff",
  },
  pde_only: {
    label: "PDE / ADE Based Only",
    detail: "Uses only the Permitted Daily Exposure (Health-Based Exposure Limit) method as per EMA guideline EMA/CHMP/CVMP/SWP/169430/2012.",
    methods: ["PDE / ADE"],
    color: "#155724",
    bg: "#d4edda",
  },
  dose_only: {
    label: "Dose Based Only (1/1000th)",
    detail: "Uses the traditional 1/1000th of the minimum therapeutic dose of the source product per maximum daily dose of the next product.",
    methods: ["Dose (1/1000th)"],
    color: "#856404",
    bg: "#fff3cd",
  },
  "10ppm_only": {
    label: "10 ppm Criterion Only",
    detail: "Applies the traditional 10 ppm general limit based on the minimum batch size of the next product. Independent of pharmacological data.",
    methods: ["10 ppm"],
    color: "#5a4a00",
    bg: "#fef9e7",
  },
  pde_dose_min: {
    label: "PDE + Dose — Most Conservative",
    detail: "Computes both PDE-based and Dose-based limits; the smaller governs. Excludes the 10 ppm criterion.",
    methods: ["PDE / ADE", "Dose (1/1000th)"],
    color: "#4a235a",
    bg: "#f3e5f5",
  },
  pde_10ppm_min: {
    label: "PDE + 10 ppm — Most Conservative",
    detail: "Computes PDE-based and 10 ppm limits; the smaller governs. Excludes the dose-based criterion.",
    methods: ["PDE / ADE", "10 ppm"],
    color: "#1a4a3a",
    bg: "#e8f5e9",
  },
};

function PolicyPage({ goHome, currentUser, role }) {
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [updatedBy, setUpdatedBy] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Confirm modal
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Verification interval
  const [currentInterval,  setCurrentInterval]  = useState(3);
  const [selectedInterval, setSelectedInterval] = useState(3);
  const [intervalUpdatedBy, setIntervalUpdatedBy] = useState("");
  const [intervalUpdatedAt, setIntervalUpdatedAt] = useState("");
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [intervalPassword,  setIntervalPassword]  = useState("");
  const [savingInterval,    setSavingInterval]    = useState(false);

  useEffect(() => { loadPolicy(); loadInterval(); }, []);

  const loadPolicy = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/policy");
      setCurrentPolicy(res.data.policy);
      setSelectedPolicy(res.data.policy);
      setUpdatedBy(res.data.updated_by || "");
      setUpdatedAt(res.data.updated_at || "");
    } catch (err) {
      setLoadError(
        err.response?.status === 404
          ? "Policy endpoint not found. Please restart the backend server to apply recent updates."
          : "Failed to load policy. Check that the backend is running."
      );
      setCurrentPolicy("all_min");
      setSelectedPolicy("all_min");
    } finally {
      setLoading(false);
    }
  };

  const loadInterval = async () => {
    try {
      const res = await api.get("/lifecycle/interval");
      setCurrentInterval(res.data.years);
      setSelectedInterval(res.data.years);
      setIntervalUpdatedBy(res.data.updated_by || "");
      setIntervalUpdatedAt(res.data.updated_at || "");
    } catch { /* non-critical */ }
  };

  const confirmIntervalSave = async () => {
    if (!intervalPassword) { alert("Enter your password ❌"); return; }
    setSavingInterval(true);
    try {
      await api.put("/lifecycle/interval", { years: selectedInterval, password: intervalPassword });
      setCurrentInterval(selectedInterval);
      setIntervalUpdatedBy(currentUser);
      setIntervalUpdatedAt(new Date().toISOString());
      setShowIntervalModal(false);
      alert(`Verification interval updated to ${selectedInterval} year(s) ✅`);
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed ❌");
    } finally {
      setSavingInterval(false);
    }
  };

  const openSaveModal = () => {
    if (selectedPolicy === currentPolicy) {
      alert("No change to save.");
      return;
    }
    setPassword("");
    setShowModal(true);
  };

  const confirmSave = async () => {
    if (!password) { alert("Enter your password ❌"); return; }
    setSaving(true);
    try {
      await api.put("/policy", { policy: selectedPolicy, password });
      setCurrentPolicy(selectedPolicy);
      setUpdatedBy(currentUser);
      setUpdatedAt(new Date().toISOString());
      setShowModal(false);
      alert("Policy saved ✅ Matrix calculations will now use the new methodology.");
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed ❌");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.pageHeader}>
          <h2 style={{ margin: 0 }}>Limit Calculation Policy</h2>
          <button onClick={goHome} style={styles.backBtn}>Back to Home</button>
        </div>
        <p style={{ color: "#004f9f" }}>Loading policy...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Limit Calculation Policy</h2>
        <button onClick={goHome} style={styles.backBtn}>Back to Home</button>
      </div>

      {/* Backend not ready warning */}
      {loadError && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: "#856404" }}>
          ⚠ {loadError} Showing default policy. Changes cannot be saved until the backend is restarted.
          <button onClick={loadPolicy} style={{ marginLeft: "12px", padding: "3px 10px", background: "#004f9f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
            Retry
          </button>
        </div>
      )}

      {/* Current policy banner */}
      <div style={{ ...styles.activeBanner, borderColor: POLICY_DESCRIPTIONS[currentPolicy]?.color || "#004f9f" }}>
        <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.4px" }}>
          Active Policy
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
          <span style={{ fontSize: "16px", fontWeight: "bold", color: POLICY_DESCRIPTIONS[currentPolicy]?.color || "#004f9f" }}>
            {POLICY_DESCRIPTIONS[currentPolicy]?.label || currentPolicy}
          </span>
          {updatedBy && (
            <span style={{ fontSize: "12px", color: "#888" }}>
              — set by {updatedBy}
              {updatedAt ? ` on ${new Date(updatedAt).toLocaleDateString("en-IN")}` : ""}
            </span>
          )}
        </div>
      </div>

      <p style={{ color: "#555", fontSize: "13px", margin: "16px 0 8px" }}>
        Select the methodology to use when computing the governing MACO in the Matrix page.
        Changes apply to all future calculations immediately.
      </p>

      {/* Policy options */}
      <div style={styles.grid}>
        {Object.entries(POLICY_DESCRIPTIONS).map(([key, desc]) => {
          const isActive = currentPolicy === key;
          const isSelected = selectedPolicy === key;
          return (
            <div
              key={key}
              onClick={() => setSelectedPolicy(key)}
              style={{
                ...styles.card,
                border: isSelected ? `2px solid ${desc.color}` : "2px solid #e2e8f0",
                background: isSelected ? desc.bg : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%",
                    border: `2px solid ${desc.color}`,
                    background: isSelected ? desc.color : "white",
                    flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "white" }} />}
                  </div>
                  <span style={{ fontWeight: "bold", fontSize: "14px", color: desc.color }}>{desc.label}</span>
                </div>
                {isActive && (
                  <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 7px", borderRadius: "10px", background: desc.color, color: "white", whiteSpace: "nowrap" }}>
                    ACTIVE
                  </span>
                )}
              </div>

              <p style={{ margin: "0 0 10px 28px", fontSize: "13px", color: "#555", lineHeight: "1.5" }}>
                {desc.detail}
              </p>

              <div style={{ marginLeft: "28px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {desc.methods.map(m => (
                  <span key={m} style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", background: desc.color + "22", color: desc.color, border: `1px solid ${desc.color}44` }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPolicy !== currentPolicy && (
        <div style={styles.changeBar}>
          <span style={{ fontSize: "13px", color: "#856404" }}>
            Unsaved change: switching to <strong>{POLICY_DESCRIPTIONS[selectedPolicy]?.label}</strong>
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setSelectedPolicy(currentPolicy)} style={styles.cancelBtn}>Discard</button>
            <button onClick={openSaveModal} style={styles.saveBtn}>Save Policy</button>
          </div>
        </div>
      )}

      {/* Automatic overrides — display only */}
      <div style={{ marginTop: "28px", background: "white", borderRadius: "10px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: "4px solid #f97316" }}>
        <p style={{ margin: "0 0 4px", fontWeight: "bold", fontSize: "14px", color: "#9a3412" }}>Automatic Overrides — Policy Not Applied</p>
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#888" }}>
          The following scenarios bypass the selected policy entirely. They are governed by regulatory fixed limits and cannot be changed here.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "14px" }}>
            <p style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "13px", color: "#9a3412" }}>Intermediate / KSM Source Product</p>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#7c2d12", lineHeight: "1.5" }}>
              When the source product category is <strong>Intermediate</strong> or <strong>KSM</strong> (Key Starting Material), MACO calculation is not applicable.
              A fixed limit of <strong>10 ppm</strong> is applied to all rinse and swab acceptance criteria, regardless of the policy selected above.
            </p>
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", background: "#f97316", color: "white" }}>Fixed 10 ppm — Always</span>
          </div>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "14px" }}>
            <p style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "13px", color: "#9a3412" }}>Synthesis Intermediate Step Equipment</p>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#7c2d12", lineHeight: "1.5" }}>
              Equipment used exclusively in synthesis intermediate steps (non-final product steps) always uses the <strong>fixed 10 ppm criterion</strong>.
              This applies regardless of the source product category or the policy selected above.
            </p>
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", background: "#f97316", color: "white" }}>Fixed 10 ppm — Always</span>
          </div>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "14px" }}>
            <p style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "13px", color: "#9a3412" }}>10 ppm Cap on All Derived Limits</p>
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#7c2d12", lineHeight: "1.5" }}>
              Even when a MACO-derived rinse or swab limit exceeds 10 ppm, the acceptance criterion is <strong>capped at 10.0 ppm</strong>.
              This cap applies to all API source products and all policy methods.
            </p>
            <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", background: "#f97316", color: "white" }}>Hard Cap — Always</span>
          </div>
        </div>
      </div>

      {/* Periodic Verification Interval */}
      <div style={{ marginTop: "28px", background: "white", borderRadius: "10px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: "4px solid #7c3aed" }}>
        <p style={{ margin: "0 0 4px", fontWeight: "bold", fontSize: "14px", color: "#4c1d95" }}>Periodic Verification Interval</p>
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#888" }}>
          Sets how often a completed cleaning validation must be re-verified. The schedule page calculates the next due date using this interval.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: "8px", padding: "12px 18px", minWidth: 160 }}>
            <div style={{ fontSize: "11px", color: "#7c3aed", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Current Interval</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#4c1d95" }}>Every {currentInterval} Year{currentInterval !== 1 ? "s" : ""}</div>
            {intervalUpdatedBy && (
              <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                Set by {intervalUpdatedBy}{intervalUpdatedAt ? ` on ${new Date(intervalUpdatedAt).toLocaleDateString("en-IN")}` : ""}
              </div>
            )}
          </div>
          {(role === "ADMIN" || role === "QA") && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
                  New Interval
                </label>
                <select
                  value={selectedInterval}
                  onChange={e => setSelectedInterval(Number(e.target.value))}
                  style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", background: "white", cursor: "pointer" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
                    <option key={y} value={y}>{y} Year{y !== 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (selectedInterval === currentInterval) { alert("No change to save."); return; }
                  setIntervalPassword("");
                  setShowIntervalModal(true);
                }}
                style={{ marginTop: "18px", padding: "8px 18px", background: "#7c3aed", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                Save Interval
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formula reference */}
      <div style={styles.formulaBox}>
        <p style={styles.formulaTitle}>Formula Reference (API Source Products)</p>
        <div style={styles.formulaGrid}>
          <div style={styles.formulaCard}>
            <p style={styles.formulaLabel}>PDE / ADE Based</p>
            <code style={styles.formula}>MACO = (PDE<sub>source</sub> × MinYield<sub>next</sub> × 10⁶) / TDD<sub>next</sub></code>
            <p style={styles.formulaNote}>PDE = Permitted Daily Exposure (mg/day) · MinYield = Min batch size (kg) · TDD = Max daily dose (mg/day) · ×10⁶ = unit conversion to ppm</p>
          </div>
          <div style={styles.formulaCard}>
            <p style={styles.formulaLabel}>Dose Based (1/1000th)</p>
            <code style={styles.formula}>MACO = (TD<sub>source</sub> × MinYield<sub>next</sub> × 10⁶) / (TDD<sub>next</sub> × 1000)</code>
            <p style={styles.formulaNote}>TD = Min therapeutic dose (mg) · Safety factor = 1000 · ×10⁶ = unit conversion to ppm</p>
          </div>
          <div style={styles.formulaCard}>
            <p style={styles.formulaLabel}>10 ppm Criterion</p>
            <code style={styles.formula}>MACO = MinYield<sub>next</sub> × 10</code>
            <p style={styles.formulaNote}>10 ppm = 10 mg/kg · MinYield = Min batch size of next product (kg) · All results capped at 10 ppm</p>
          </div>
        </div>
      </div>

      {/* Interval confirm modal */}
      {showIntervalModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Confirm Interval Change</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Changing periodic verification interval to{" "}
              <strong style={{ color: "#7c3aed" }}>Every {selectedInterval} Year{selectedInterval !== 1 ? "s" : ""}</strong>.
              All future schedule due dates will recalculate.
            </p>
            <label style={styles.modalLabel}>Your Password</label>
            <input
              type="password"
              value={intervalPassword}
              onChange={e => setIntervalPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmIntervalSave(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmIntervalSave} disabled={savingInterval}
                style={savingInterval ? styles.confirmDisabled : { ...styles.confirmBtn, background: "#7c3aed" }}>
                {savingInterval ? "Saving..." : "Confirm"}
              </button>
              <button onClick={() => setShowIntervalModal(false)} style={styles.cancelModalBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Confirm Policy Change</h3>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#555" }}>
              Changing active policy to:
            </p>
            <p style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "bold", color: POLICY_DESCRIPTIONS[selectedPolicy]?.color }}>
              {POLICY_DESCRIPTIONS[selectedPolicy]?.label}
            </p>
            <label style={styles.modalLabel}>Your Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmSave(); }}
              placeholder="Enter your login password"
              style={styles.modalInput}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmSave} disabled={saving}
                style={saving ? styles.confirmDisabled : styles.confirmBtn}>
                {saving ? "Saving..." : "Confirm"}
              </button>
              <button onClick={() => setShowModal(false)} style={styles.cancelModalBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page:       { padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" },
  header:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" },
  backBtn:    { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  activeBanner: { background: "white", borderRadius: "10px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: "4px solid #004f9f" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px", marginTop: "16px" },
  card:       { borderRadius: "10px", padding: "16px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s" },
  changeBar:  { marginTop: "16px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  saveBtn:    { padding: "8px 18px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  cancelBtn:  { padding: "8px 14px", background: "white", color: "#555", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  formulaBox: { marginTop: "28px", background: "white", borderRadius: "10px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  formulaTitle: { margin: "0 0 12px", fontWeight: "bold", fontSize: "14px", color: "#004f9f" },
  formulaGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" },
  formulaCard:  { background: "#f8fafc", borderRadius: "8px", padding: "12px", border: "1px solid #e2e8f0" },
  formulaLabel: { margin: "0 0 6px", fontWeight: "bold", fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  formula:      { display: "block", fontSize: "12px", color: "#004f9f", background: "#eef4ff", padding: "6px 8px", borderRadius: "4px", fontFamily: "monospace", margin: "0 0 6px" },
  formulaNote:  { margin: 0, fontSize: "11px", color: "#888", lineHeight: "1.5" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox:     { background: "white", borderRadius: "12px", padding: "28px", width: "400px", maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalLabel:   { display: "block", fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  modalInput:   { width: "100%", padding: "9px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", boxSizing: "border-box" },
  confirmBtn:        { flex: 1, padding: "9px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  confirmDisabled:   { flex: 1, padding: "9px", background: "#aaa",     color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "13px" },
  cancelModalBtn:    { flex: 1, padding: "9px", background: "#f1f5f9",  color: "#333",  border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
};

export default PolicyPage;
