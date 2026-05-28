import React, { useState, useEffect, useCallback } from "react";
import api from "./api";

const YEAR_OPTIONS = [
  { value: "1",  label: "1 year"        },
  { value: "2",  label: "2 years"       },
  { value: "3",  label: "3 years"       },
  { value: "5",  label: "5 years"       },
  { value: "7",  label: "7 years"       },
  { value: "10", label: "10 years"      },
  { value: "0",  label: "Never archive" },
];

const fmt = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const apiError = (e, fallback) =>
  e?.response?.data?.detail || e?.message || fallback;

// ── Save-policy modal ───────────────────────────────────────────────────────
function SaveModal({ categories, settings, autoCleanup, onConfirm, onCancel, saving }) {
  const [agreed,   setAgreed]   = useState(false);
  const [password, setPassword] = useState("");
  const canConfirm = agreed && password.trim().length > 0 && !saving;

  return (
    <div style={ov.overlay}>
      <div style={{ ...ov.box, maxWidth: 520 }}>
        <div style={ov.headerBar}>
          <span style={ov.headerIcon}>📋</span>
          <h3 style={ov.headerTitle}>Confirm Retention Policy</h3>
        </div>

        <p style={ov.desc}>
          Review the archive thresholds below. Records older than each period will be
          moved to the archive database the next time cleanup runs.
        </p>

        <table style={ov.table}>
          <thead>
            <tr>
              <th style={ov.th}>Data Category</th>
              <th style={{ ...ov.th, textAlign: "right" }}>Archive After</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const yr    = settings[cat.key] || cat.years;
              const label = YEAR_OPTIONS.find(o => o.value === yr)?.label || yr;
              return (
                <tr key={cat.key}>
                  <td style={ov.td}>{cat.label}</td>
                  <td style={{ ...ov.td, textAlign: "right", fontWeight: 600,
                    color: yr === "0" ? "#27ae60" : "#004f9f" }}>{label}</td>
                </tr>
              );
            })}
            <tr>
              <td style={ov.td}>Auto-archive on startup</td>
              <td style={{ ...ov.td, textAlign: "right", fontWeight: 600,
                color: autoCleanup === "true" ? "#e67e22" : "#27ae60" }}>
                {autoCleanup === "true" ? "Enabled" : "Disabled"}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={ov.noticeBox}>
          <strong>Note:</strong> Saving this policy does <em>not</em> immediately move any
          records. Archiving only occurs when &ldquo;Run Archive Now&rdquo; is executed or
          when the server restarts (if auto-archive is enabled).
        </div>

        <label style={{ ...ov.checkRow, padding: "0 20px" }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ accentColor: "#004f9f", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
          <span style={{ marginLeft: 10, fontSize: 13, color: "#333", lineHeight: 1.5 }}>
            I have reviewed these periods and confirm they meet our organisation's
            compliance and regulatory retention requirements.
          </span>
        </label>

        <input type="password" placeholder="Enter your password to confirm"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && canConfirm && onConfirm(password)}
          style={{ ...ov.input, opacity: agreed ? 1 : 0.45 }} disabled={!agreed} />

        <div style={ov.btnRow}>
          <button style={{ ...ov.btn, ...ov.ghost }} onClick={onCancel} disabled={saving}>Cancel</button>
          <button style={{ ...ov.btn, ...ov.primary, opacity: canConfirm ? 1 : 0.45 }}
            onClick={() => onConfirm(password)} disabled={!canConfirm}>
            {saving ? "Saving…" : "Save Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run-archive modal ───────────────────────────────────────────────────────
function RunModal({ categories, archivePath, onConfirm, onCancel, running }) {
  const [agreed,   setAgreed]   = useState(false);
  const [password, setPassword] = useState("");

  const totalArchivable = categories.reduce(
    (sum, c) => sum + (c.years !== "0" && c.deletable_records != null ? c.deletable_records : 0), 0
  );
  const canConfirm = agreed && password.trim().length > 0 && !running;

  return (
    <div style={ov.overlay}>
      <div style={{ ...ov.box, maxWidth: 560 }}>
        {/* Blue header — archiving is non-destructive */}
        <div style={{ ...ov.headerBar, background: "#f0f4fb", borderBottom: "2px solid #004f9f" }}>
          <span style={{ fontSize: 22 }}>📦</span>
          <h3 style={{ ...ov.headerTitle, color: "#004f9f" }}>
            Move Records to Archive — Read Before Proceeding
          </h3>
        </div>

        {/* What will happen */}
        <div style={{ ...ov.warningBlock, background: "#f0f4fb", borderColor: "#b8cce4" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#004f9f" }}>
            What will happen if you continue:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#444", fontSize: 13, lineHeight: 1.7 }}>
            <li>
              Records older than each category's configured period will be{" "}
              <strong>moved out of the active database</strong> into a separate archive file.
            </li>
            <li>
              They will <strong>no longer appear</strong> in the main application
              (reports, audit log views, MACO history).
            </li>
            <li>
              The archived data is <strong>not destroyed</strong> — it is preserved in{" "}
              <code style={{ background: "#e8eef5", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>
                maco_archive.db
              </code>{" "}
              and can be accessed for audit or recovery purposes.
            </li>
            <li>
              This archive event will be recorded in the audit log.
            </li>
          </ul>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#666" }}>
            Archive location: <strong>{archivePath || "maco_archive.db (backend folder)"}</strong>
          </p>
        </div>

        {/* Per-category breakdown */}
        <p style={{ fontWeight: 700, fontSize: 13, color: "#333", margin: "16px 20px 6px" }}>
          Records scheduled to be archived:
        </p>
        <table style={ov.table}>
          <thead>
            <tr>
              <th style={ov.th}>Data Category</th>
              <th style={{ ...ov.th, textAlign: "center" }}>Archive After</th>
              <th style={{ ...ov.th, textAlign: "right" }}>Records to Archive</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const skip  = cat.years === "0";
              const count = cat.deletable_records;
              return (
                <tr key={cat.key}>
                  <td style={ov.td}>{cat.label}</td>
                  <td style={{ ...ov.td, textAlign: "center", color: "#555" }}>
                    {YEAR_OPTIONS.find(o => o.value === cat.years)?.label || cat.years}
                  </td>
                  <td style={{ ...ov.td, textAlign: "right", fontWeight: 700,
                    color: skip ? "#27ae60" : count > 0 ? "#004f9f" : "#27ae60" }}>
                    {skip ? "Skip (Never archive)" : count == null ? "—" : count === 0 ? "None" : `${count} records`}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: "#eaf1fb" }}>
              <td style={{ ...ov.td, fontWeight: 700, color: "#004f9f" }} colSpan={2}>
                Total records to be moved to archive
              </td>
              <td style={{ ...ov.td, textAlign: "right", fontWeight: 800,
                fontSize: 15, color: "#004f9f" }}>
                {totalArchivable === 0 ? "None" : `${totalArchivable} records`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Acknowledgement checkbox */}
        <div style={{ ...ov.noticeBox, background: "#fff8e1", borderColor: "#f39c12", marginTop: 16 }}>
          <label style={ov.checkRow}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              style={{ accentColor: "#004f9f", width: 17, height: 17, flexShrink: 0, cursor: "pointer" }} />
            <span style={{ marginLeft: 10, fontSize: 13, color: "#333", lineHeight: 1.6 }}>
              I have read and understood that the above records will be moved out of the
              active database into the archive file for long-term storage, and will no
              longer be visible in the main application.
            </span>
          </label>
        </div>

        {/* Password */}
        <input type="password" placeholder="Enter your password to authorise archiving"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && canConfirm && onConfirm(password)}
          style={{ ...ov.input, marginTop: 14,
            borderColor: agreed ? "#004f9f" : "#ccc", opacity: agreed ? 1 : 0.45 }}
          disabled={!agreed} />
        {!agreed && (
          <p style={{ fontSize: 11, color: "#999", margin: "-10px 20px 0" }}>
            Check the box above to enable the password field.
          </p>
        )}

        <div style={{ ...ov.btnRow, marginTop: 16 }}>
          <button style={{ ...ov.btn, ...ov.ghost }} onClick={onCancel} disabled={running}>Cancel</button>
          <button
            style={{ ...ov.btn, ...ov.primary,
              opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? "pointer" : "not-allowed" }}
            onClick={() => onConfirm(password)} disabled={!canConfirm}>
            {running ? "Archiving…" : "Move to Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function DataRetentionPage({ goHome, currentUser }) {
  const [categories,   setCategories]   = useState([]);
  const [settings,     setSettings]     = useState({});
  const [autoCleanup,  setAutoCleanup]  = useState("false");
  const [lastRun,      setLastRun]      = useState("");
  const [archivePath,  setArchivePath]  = useState("");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [running,      setRunning]      = useState(false);
  const [unsaved,      setUnsaved]      = useState(false);
  const [runResult,    setRunResult]    = useState(null);
  const [showSave,     setShowSave]     = useState(false);
  const [showRun,      setShowRun]      = useState(false);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await api.get("/retention-policy");
      const cats = res.data.categories || [];
      setCategories(cats);
      const s = {};
      cats.forEach(c => { s[c.key] = c.years; });
      setSettings(s);
      setAutoCleanup(res.data.auto_cleanup || "false");
      setLastRun(res.data.last_run || "");
      setArchivePath(res.data.archive_db_path || "");
      setUnsaved(false);
    } catch (e) {
      setError(apiError(e, "Failed to load retention policy. Ensure the server is running."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPolicy(); }, [loadPolicy]);

  const handleYearChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setUnsaved(true);
    setRunResult(null);
  };

  const confirmSave = async (password) => {
    setSaving(true);
    try {
      await api.put("/retention-policy", { settings, auto_cleanup: autoCleanup, password });
      setShowSave(false);
      setUnsaved(false);
      await loadPolicy();
      alert("Retention policy saved ✅");
    } catch (e) {
      alert(apiError(e, "Failed to save policy."));
    } finally {
      setSaving(false);
    }
  };

  const confirmRun = async (password) => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await api.post("/retention-policy/run", { password });
      setShowRun(false);
      setRunResult(res.data.archived || {});
      await loadPolicy();
    } catch (e) {
      alert(apiError(e, "Archive operation failed."));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return (
    <div style={pg.page}>
      <button style={pg.back} onClick={goHome}>← Home</button>
      <p style={{ color: "#666", marginTop: 40 }}>Loading retention policy…</p>
    </div>
  );

  if (error) return (
    <div style={pg.page}>
      <button style={pg.back} onClick={goHome}>← Home</button>
      <div style={{ marginTop: 40, background: "#fdf2f2", border: "1px solid #e74c3c",
        borderRadius: 8, padding: "18px 22px", color: "#c0392b" }}>
        <strong>Error:</strong> {error}
        <button style={{ marginLeft: 16, ...pg.btnGhost, fontSize: 12, padding: "4px 12px" }}
          onClick={loadPolicy}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={pg.page}>
      <button style={pg.back} onClick={goHome}>← Home</button>

      <div style={pg.header}>
        <div>
          <h2 style={pg.title}>Data Retention Policy</h2>
          <p style={pg.subtitle}>
            Configure how long each data category remains in the active database before
            being moved to the archive. Only Administrators can change these settings.
          </p>
        </div>
        <div style={pg.actions}>
          <button style={{ ...pg.btnGhost }} onClick={() => { setRunResult(null); setShowRun(true); }}
            disabled={running}>
            📦 {running ? "Archiving…" : "Run Archive Now"}
          </button>
          <button style={{ ...pg.btnPrimary, opacity: unsaved ? 1 : 0.45,
            cursor: unsaved ? "pointer" : "not-allowed" }}
            onClick={() => unsaved && setShowSave(true)} disabled={!unsaved || saving}>
            {saving ? "Saving…" : "Save Policy"}
          </button>
        </div>
      </div>

      {unsaved && (
        <div style={pg.unsavedBanner}>
          You have unsaved changes — click <strong>Save Policy</strong> to apply them.
        </div>
      )}

      {/* Auto-archive toggle */}
      <div style={pg.autoRow}>
        <div>
          <div style={{ fontWeight: 700, color: "#004f9f", fontSize: 14 }}>
            Auto-archive on server startup
          </div>
          <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>
            When enabled, archiving runs automatically each time the server starts.
            Use only if server startup is scheduled (e.g. nightly restart).
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0, gap: 8 }}>
          <input type="checkbox" checked={autoCleanup === "true"}
            onChange={e => { setAutoCleanup(e.target.checked ? "true" : "false"); setUnsaved(true); }}
            style={{ accentColor: "#004f9f", width: 18, height: 18, cursor: "pointer" }} />
          <span style={{ fontWeight: 600, fontSize: 13,
            color: autoCleanup === "true" ? "#e67e22" : "#888" }}>
            {autoCleanup === "true" ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {/* Archive location info box */}
      {archivePath && (
        <div style={pg.archiveInfoBox}>
          <span style={{ fontWeight: 600, color: "#004f9f" }}>Archive location: </span>
          <code style={{ fontSize: 12, color: "#333", background: "#e8eef5",
            padding: "2px 6px", borderRadius: 3 }}>{archivePath}</code>
          <span style={{ color: "#666", fontSize: 12, marginLeft: 10 }}>
            — a SQLite file; open with any SQLite viewer to inspect archived records.
          </span>
        </div>
      )}

      {/* Category cards */}
      <div style={pg.grid}>
        {categories.map(cat => {
          const yr        = settings[cat.key] || cat.years;
          const noDel     = yr === "0";
          const total     = cat.total_records ?? 0;
          const archivable = cat.deletable_records ?? 0;
          const pct       = total > 0 && !noDel ? Math.round((archivable / total) * 100) : 0;
          const barColor  = pct > 50 ? "#004f9f" : pct > 20 ? "#3498db" : "#27ae60";

          return (
            <div key={cat.key} style={pg.card}>
              <div style={pg.cardTop}>
                <div style={{ flex: 1 }}>
                  <div style={pg.catLabel}>{cat.label}</div>
                  <div style={pg.catDesc}>{cat.description}</div>
                </div>
                <select value={yr} onChange={e => handleYearChange(cat.key, e.target.value)}
                  style={pg.select}>
                  {YEAR_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div style={pg.statsRow}>
                <div style={pg.stat}>
                  <span style={pg.statNum}>{total}</span>
                  <span style={pg.statLbl}>Total records</span>
                </div>
                <div style={pg.stat}>
                  <span style={{ ...pg.statNum, color: noDel ? "#999" : archivable > 0 ? "#004f9f" : "#27ae60" }}>
                    {noDel ? "—" : archivable}
                  </span>
                  <span style={pg.statLbl}>Would be archived</span>
                </div>
                <div style={pg.stat}>
                  <span style={{ ...pg.statNum, fontSize: 14,
                    color: noDel ? "#999" : archivable > 0 ? "#004f9f" : "#27ae60" }}>
                    {noDel ? "Never" : `${pct}%`}
                  </span>
                  <span style={pg.statLbl}>Of total</span>
                </div>
              </div>

              {!noDel && total > 0 && (
                <div style={pg.barBg}>
                  <div style={{ ...pg.barFill, width: `${pct}%`, background: barColor }} />
                </div>
              )}

              <div style={pg.cardMeta}>
                Last updated by <strong>{cat.updated_by || "system"}</strong>
                {cat.updated_at ? ` on ${fmt(cat.updated_at)}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div style={pg.lastRun}>
        Last archive run: <strong>{lastRun ? fmt(lastRun) : "Never run"}</strong>
      </div>

      {runResult && (
        <div style={{ background: "#eaf1fb", border: "1px solid #b8cce4",
          borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
          <strong style={{ color: "#004f9f" }}>Archive completed:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {Object.entries(runResult).map(([label, count]) => (
              <li key={label} style={{ fontSize: 13 }}>
                <strong>{label}</strong>:{" "}
                {count < 0 ? "⚠ error during archiving"
                  : count === 0 ? "No records eligible to archive"
                  : `${count} record${count !== 1 ? "s" : ""} moved to archive`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSave && (
        <SaveModal categories={categories} settings={settings} autoCleanup={autoCleanup}
          saving={saving} onConfirm={confirmSave} onCancel={() => setShowSave(false)} />
      )}
      {showRun && (
        <RunModal categories={categories} archivePath={archivePath} running={running}
          onConfirm={confirmRun} onCancel={() => setShowRun(false)} />
      )}
    </div>
  );
}

// ── Shared overlay styles ───────────────────────────────────────────────────
const ov = {
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  box:         { background: "white", borderRadius: 10, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" },
  headerBar:   { display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderRadius: "10px 10px 0 0" },
  headerIcon:  { fontSize: 20 },
  headerTitle: { margin: 0, fontSize: 17, fontFamily: "Arial, sans-serif" },
  desc:        { color: "#555", fontSize: 13, lineHeight: 1.6, padding: "14px 20px 0", margin: 0 },
  warningBlock:{ margin: "14px 20px 0", borderRadius: 6, padding: "12px 16px", border: "1px solid" },
  table:       { width: "calc(100% - 40px)", margin: "12px 20px 0", borderCollapse: "collapse", fontSize: 13 },
  th:          { background: "#004f9f", color: "white", padding: "6px 10px", textAlign: "left", fontWeight: 600 },
  td:          { padding: "6px 10px", borderBottom: "1px solid #e8eef5", color: "#333" },
  noticeBox:   { margin: "12px 20px 0", border: "1px solid", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#555", lineHeight: 1.6 },
  checkRow:    { display: "flex", alignItems: "flex-start", cursor: "pointer" },
  input:       { display: "block", width: "calc(100% - 40px)", margin: "14px 20px 0", border: "1.5px solid #b8cce4", borderRadius: 6, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" },
  btnRow:      { display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 20px 20px" },
  btn:         { borderRadius: 6, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  primary:     { background: "#004f9f", color: "white", border: "none" },
  ghost:       { background: "white", color: "#004f9f", border: "1.5px solid #004f9f" },
};

// ── Page styles ─────────────────────────────────────────────────────────────
const pg = {
  page:           { padding: "24px", fontFamily: "Arial, sans-serif", maxWidth: 920, margin: "0 auto" },
  back:           { background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#555", marginBottom: 20 },
  header:         { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title:          { margin: 0, color: "#004f9f", fontSize: 22 },
  subtitle:       { margin: "6px 0 0", color: "#666", fontSize: 13, maxWidth: 580 },
  actions:        { display: "flex", gap: 10, alignItems: "center", flexShrink: 0, marginTop: 4 },
  btnPrimary:     { background: "#004f9f", color: "white", border: "none", borderRadius: 6, padding: "9px 18px", fontWeight: 600, fontSize: 13 },
  btnGhost:       { background: "white", color: "#004f9f", border: "1.5px solid #004f9f", borderRadius: 6, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  unsavedBanner:  { background: "#fff8e1", border: "1px solid #f39c12", borderRadius: 6, padding: "8px 14px", fontSize: 13, color: "#8a6914", marginBottom: 16 },
  autoRow:        { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#f0f4fb", border: "1px solid #d0ddf0", borderRadius: 8, padding: "14px 18px", marginBottom: 14, flexWrap: "wrap" },
  archiveInfoBox: { background: "#f0f4fb", border: "1px solid #b8cce4", borderRadius: 6, padding: "9px 14px", marginBottom: 20, fontSize: 13 },
  grid:           { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16, marginBottom: 20 },
  card:           { border: "1.5px solid #d8e4f0", borderRadius: 10, padding: "16px 18px", background: "#fff", boxShadow: "0 1px 4px rgba(0,79,159,0.06)" },
  cardTop:        { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  catLabel:       { fontWeight: 700, fontSize: 14, color: "#1a1a2e", marginBottom: 4 },
  catDesc:        { fontSize: 12, color: "#777", lineHeight: 1.4 },
  select:         { border: "1.5px solid #b8cce4", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#004f9f", fontWeight: 600, background: "#f0f6ff", cursor: "pointer", flexShrink: 0, minWidth: 138 },
  statsRow:       { display: "flex", gap: 10, marginBottom: 10 },
  stat:           { flex: 1, background: "#f8fafc", borderRadius: 6, padding: "8px 10px", textAlign: "center" },
  statNum:        { display: "block", fontSize: 20, fontWeight: 700, color: "#1a1a2e" },
  statLbl:        { display: "block", fontSize: 10, color: "#999", marginTop: 2 },
  barBg:          { height: 6, background: "#e8eef5", borderRadius: 3, overflow: "hidden", marginBottom: 10 },
  barFill:        { height: "100%", borderRadius: 3, transition: "width 0.4s ease" },
  cardMeta:       { fontSize: 11, color: "#aaa", marginTop: 4 },
  lastRun:        { fontSize: 13, color: "#888", marginBottom: 16 },
};
