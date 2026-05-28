import React, { useEffect, useState, useRef } from "react";
import api from "./api";
import logo from "./assets/falcon-logo.svg";
import Pagination from "./Pagination";
import { exportCsv } from "./exportCsv";

const PAGE_SIZE = 50;

const EVENT_GROUPS = {
  "User Trail":  ["LOGIN", "LOGIN_FAIL", "LOGOUT"],
  "Data Events": ["CREATE", "UPDATE", "DELETE"],
  "MACO":        ["MACO_MATRIX"],
};

const ALL_EVENTS = ["LOGIN", "LOGIN_FAIL", "LOGOUT", "CREATE", "UPDATE", "DELETE", "MACO_MATRIX"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function AuditPage({ goHome, currentUser }) {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [queried, setQueried]     = useState(false);

  const [dateFrom, setDateFrom]   = useState(daysAgoStr(7));
  const [dateTo, setDateTo]       = useState(todayStr());
  const [dateError, setDateError] = useState("");

  const [filterEvent, setFilterEvent] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [searchText, setSearchText]   = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const printRef = useRef();

  const loadLogs = async () => {
    if (dateError) return;
    setLoading(true);
    setQueried(true);
    try {
      const res = await api.get("/audit/all");
      setLogs(res.data);
    } catch (err) {
      console.log("Error loading audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Validate date range on change
  const handleDateFrom = (val) => {
    setDateFrom(val);
    setDateError("");
    if (dateTo && val) {
      const diff = (new Date(dateTo) - new Date(val)) / 86400000;
      if (diff < 0)  setDateError("Start date must be before end date.");
      if (diff > 30) setDateError("Date range cannot exceed 30 days.");
    }
  };

  const handleDateTo = (val) => {
    setDateTo(val);
    setDateError("");
    if (dateFrom && val) {
      const diff = (new Date(val) - new Date(dateFrom)) / 86400000;
      if (diff < 0)  setDateError("End date must be after start date.");
      if (diff > 30) setDateError("Date range cannot exceed 30 days.");
    }
  };

  const applyQuickFilter = (group) => {
    setQuickFilter(group === quickFilter ? "" : group);
    setFilterEvent("");
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDateFrom(daysAgoStr(7));
    setDateTo(todayStr());
    setFilterEvent("");
    setQuickFilter("");
    setSearchText("");
    setDateError("");
    setLogs([]);
    setQueried(false);
    setCurrentPage(1);
  };

  // ─── Filter logic ───────────────────────────────────────────────
  const filtered = logs.filter((log) => {
    // Date range
    if (dateFrom || dateTo) {
      const ts = log.timestamp ? new Date(log.timestamp) : null;
      if (ts) {
        if (dateFrom && ts < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo   && ts > new Date(dateTo   + "T23:59:59")) return false;
      }
    }
    // Quick group
    if (quickFilter && EVENT_GROUPS[quickFilter]) {
      if (!EVENT_GROUPS[quickFilter].includes(log.event_type)) return false;
    }
    // Individual event
    if (filterEvent && log.event_type !== filterEvent) return false;
    // Free-text search across key fields
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const haystack = [
        log.performed_by, log.entity_type, log.entity_id,
        log.field_name, log.old_value, log.new_value, log.event_type
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportCsv = () => {
    if (filtered.length === 0) { alert("No records to export ❌"); return; }
    const cols = ["ID","Event","Entity","Entity ID","Field","Old Value","New Value","Performed By","Timestamp"];
    const rows = filtered.map(l => [
      l.audit_id, l.event_type, l.entity_type, l.entity_id,
      l.field_name ?? "", l.old_value ?? "", l.new_value ?? "",
      l.performed_by, l.timestamp ? new Date(l.timestamp).toLocaleString("en-IN") : ""
    ]);
    exportCsv(`AuditLog_${dateFrom}_${dateTo}.csv`, cols, rows);
  };

  const handlePrint = () => {
    if (!printRef.current || filtered.length === 0) { alert("Nothing to print ❌"); return; }
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Audit Trail Report</title>
      <style>
        body { font-family: Arial; padding: 20px; font-size: 12px; }
        .header { display:flex; align-items:center; border-bottom:2px solid #004f9f; padding-bottom:10px; margin-bottom:20px; }
        .header img { width:80px; margin-right:20px; }
        .header-text h2 { margin:0; color:#004f9f; font-size:18px; }
        .header-text p { margin:4px 0 0; color:#555; font-size:12px; }
        table { width:100%; border-collapse:collapse; }
        th { background:#004f9f; color:white; padding:8px; font-size:11px; text-align:center; }
        td { border:1px solid #ddd; padding:6px 8px; font-size:11px; text-align:center; }
        tr:nth-child(even) { background:#f8fafc; }
        .footer { margin-top:30px; border-top:1px solid #ccc; padding-top:10px; display:flex; justify-content:space-between; color:#888; font-size:11px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logo}" alt="Falcon" />
          <div class="header-text">
            <h2>Cleaning Limit Software</h2>
            <p>Audit Trail Report</p>
            <p>Period: ${dateFrom} to ${dateTo}</p>
            <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
        ${printRef.current.innerHTML}
        <div class="footer">
          <span>Falcon — Confidential</span>
          <span>Records: ${filtered.length}</span>
          <span>Printed by: ${currentUser || "Unknown"}</span>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>Audit Trail</h2>
        <button onClick={goHome} style={styles.backBtn}>Back to Home</button>
      </div>

      {/* ── Filter Card ───────────────────────────────────────────── */}
      <div style={styles.filterCard}>

        {/* Row 1 — Date + User + Event */}
        <div style={styles.filterRow}>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>From</label>
            <input type="date" value={dateFrom} max={dateTo || todayStr()}
              onChange={(e) => handleDateFrom(e.target.value)} style={styles.dateInput} />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>To</label>
            <input type="date" value={dateTo} min={dateFrom} max={todayStr()}
              onChange={(e) => handleDateTo(e.target.value)} style={styles.dateInput} />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Event Type</label>
            <select value={filterEvent}
              onChange={(e) => { setFilterEvent(e.target.value); setQuickFilter(""); }}
              style={styles.select}>
              <option value="">All Events</option>
              {ALL_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search</label>
            <input
              type="text"
              placeholder="User, entity, field, value..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ ...styles.dateInput, minWidth: "200px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <button onClick={loadLogs} disabled={!!dateError} style={dateError ? styles.refreshBtnDisabled : styles.refreshBtn}>Query</button>
            <button onClick={clearFilters} style={styles.clearBtn}>Clear</button>
            <button onClick={handleExportCsv} style={styles.csvBtn}>Export CSV</button>
            <button onClick={handlePrint} style={styles.printBtn}>Print PDF</button>
          </div>
        </div>

        {dateError && (
          <p style={{ color: "#dc3545", fontSize: "12px", margin: "4px 0 0 0" }}>
            {dateError}
          </p>
        )}

        {/* Row 2 — Quick filter chips */}
        <div style={styles.chipRow}>
          <span style={styles.chipLabel}>Quick filter:</span>
          {Object.keys(EVENT_GROUPS).map(group => (
            <span
              key={group}
              onClick={() => applyQuickFilter(group)}
              style={{
                ...styles.chip,
                background: quickFilter === group ? "#004f9f" : "#e8f0fe",
                color:      quickFilter === group ? "white"   : "#004f9f",
              }}
            >
              {group}
            </span>
          ))}
          <span style={{ ...styles.chip, marginLeft: "auto", fontSize: "11px", background: "#f1f5f9", color: "#666", cursor: "default" }}>
            Max 30 days per query
          </span>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px" }}>
        <p style={{ margin: 0, color: "#555", fontSize: "13px" }}>
          Showing <strong>{filtered.length}</strong> record{filtered.length !== 1 ? "s" : ""}
          {quickFilter ? ` · ${quickFilter}` : ""}
          {filterEvent ? ` · Event: ${filterEvent}` : ""}
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#004f9f" }}>Loading audit logs...</p>
      ) : !queried ? (
        <div style={styles.emptyState}>
          <p style={{ margin: 0, fontSize: "15px", color: "#555" }}>Set your filters and click <strong>Query</strong> to view audit logs.</p>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#aaa" }}>Maximum 30 days per query.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#888" }}>No records match the selected filters.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div ref={printRef}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#004f9f", color: "white" }}>
                  <th style={cell}>ID</th>
                  <th style={cell}>Event</th>
                  <th style={cell}>Entity</th>
                  <th style={cell}>Entity ID</th>
                  <th style={cell}>Field</th>
                  <th style={cell}>Old Value</th>
                  <th style={cell}>New Value</th>
                  <th style={cell}>Performed By</th>
                  <th style={cell}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log, index) => (
                  <tr key={log.audit_id} style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                    <td style={cell}>{log.audit_id}</td>
                    <td style={cell}>
                      <span style={{ ...styles.badge, background: badgeColor(log.event_type) }}>
                        {log.event_type}
                      </span>
                    </td>
                    <td style={cell}>{log.entity_type}</td>
                    <td style={cell}>{log.entity_id}</td>
                    <td style={cell}>{log.field_name || "—"}</td>
                    <td style={{ ...cell, color: "#cc0000" }}>{log.old_value || "—"}</td>
                    <td style={{ ...cell, color: "#007700" }}>{log.new_value || "—"}</td>
                    <td style={{ ...cell, fontWeight: "600" }}>{log.performed_by}</td>
                    <td style={cell}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            total={filtered.length}
            page={currentPage}
            pageSize={PAGE_SIZE}
            onPage={(p) => setCurrentPage(p)}
          />
        </div>
      )}

    </div>
  );
}

function badgeColor(event) {
  const map = {
    CREATE:      "#28a745",
    UPDATE:      "#e6a817",
    DELETE:      "#dc3545",
    LOGIN:       "#004f9f",
    LOGIN_FAIL:  "#ff6600",
    LOGOUT:      "#6c757d",
    MACO_MATRIX: "#6f42c1",
  };
  return map[event] || "#888";
}

const cell = { border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap" };

const styles = {
  pageHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn:     { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  filterCard:  { background: "white", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "4px" },
  filterRow:   { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "11px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  dateInput:   { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", cursor: "pointer" },
  select:      { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "150px", cursor: "pointer" },
  refreshBtn:        { padding: "8px 14px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  refreshBtnDisabled:{ padding: "8px 14px", background: "#aaa", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "13px" },
  emptyState:        { textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  clearBtn:    { padding: "8px 14px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  csvBtn:      { padding: "8px 14px", background: "#17a2b8", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  printBtn:    { padding: "8px 14px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  chipRow:     { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px", alignItems: "center" },
  chipLabel:   { fontSize: "12px", color: "#888", fontWeight: "600" },
  chip:        { padding: "4px 12px", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontWeight: "600", border: "1px solid #c0d4f5", transition: "all 0.15s" },
  badge:       { padding: "3px 8px", borderRadius: "4px", color: "white", fontSize: "11px", fontWeight: "bold" },
};

export default AuditPage;
