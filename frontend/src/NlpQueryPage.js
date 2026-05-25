import React, { useState, useEffect } from "react";
import api from "./api";

function NlpQueryPage({ goHome, currentUser }) {
  const [question, setQuestion] = useState("");
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    if (!document.head.querySelector('[data-nlp-styles]')) {
      styleSheet.setAttribute('data-nlp-styles', 'true');
      document.head.appendChild(styleSheet);
    }
  }, []);

  const ask = async (queryText = null) => {
    const q = (queryText || question).trim();

    if (!q) {
      alert("Please type a question");
      return;
    }

    setQuestion(q);
    setLoading(true);
    setResp(null);

    const startTime = Date.now();

    try {
      const res = await api.post("/nlp/query", { question: q });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const historyEntry = {
        id: Date.now(),
        question: q,
        response: res.data,
        timestamp: new Date().toLocaleTimeString(),
        responseTime: responseTime
      };

      setHistory([historyEntry, ...history]);
      setResp(res.data);
      setShowHistory(false);

    } catch (err) {
      console.log("ERROR:", err);

      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
          : detail
          ? JSON.stringify(detail)
          : err.message || "Error calling /nlp/query";

      setResp({
        response_type: "text",
        text: errorMsg,
        is_error: true
      });

      setHistory([
        {
          id: Date.now(),
          question: q,
          response: { response_type: "text", text: errorMsg, is_error: true },
          timestamp: new Date().toLocaleTimeString(),
          responseTime: Date.now() - startTime
        },
        ...history
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Clear all query history?")) {
      setHistory([]);
    }
  };

  const renderHistoryItem = (entry) => {
    return (
      <div
        key={entry.id}
        style={styles.historyItem}
        onClick={() => ask(entry.question)}
      >
        <div style={styles.historyQuestion}>{entry.question}</div>
        <div style={styles.historyMeta}>
          {entry.timestamp} • {entry.responseTime}ms
        </div>
      </div>
    );
  };

  const renderTable = (table) => {
    if (!table || !table.columns || !table.rows) return null;

    return (
      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              {table.columns.map((c, i) => (
                <th key={i} style={cellStyle}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                {row.map((val, j) => (
                  <td key={j} style={cellStyle}>
                    {val === null || val === undefined
                      ? "—"
                      : typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = (chart) => {
    if (!chart || !chart.data || !chart.x_key || !chart.y_key) return null;

    const maxVal = Math.max(...chart.data.map(d => Number(d[chart.y_key] || 0)));

    return (
      <div style={{ marginTop: 12 }}>
        {chart.data.map((d, i) => {
          const label = d[chart.x_key];
          const val = Number(d[chart.y_key] || 0);
          const pct = maxVal ? Math.round((val / maxVal) * 100) : 0;

          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: "#333" }}>
                {String(label)} — {val}
              </div>
              <div style={{ background: "#e6f0fa", borderRadius: 6 }}>
                <div style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? "30px" : "0",
                  background: "#004f9f",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12
                }}>
                  {val}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>🤖 NLP Query</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {history.length > 0 && (
            <button
              style={styles.historyBtn}
              onClick={() => setShowHistory(!showHistory)}
            >
              📋 History ({history.length})
            </button>
          )}
          <button style={styles.backBtn} onClick={goHome}>⬅ Back to Home</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {/* Main card */}
        <div style={{ ...styles.card, flex: showHistory ? 1 : 1 }}>

          <p style={{ color: "#444", marginTop: 0, marginBottom: 10 }}>
            Ask anything about your cleaning validation data in plain English.
          </p>

          <div style={styles.chipRow}>
            {[
              "Which product has the highest PDE?",
              "List all equipment with rinse volume above 5 litres",
              "How many products use HPLC?",
              "Show me the last 10 audit events",
              "Which facility has the most equipment?",
              "Compare total records across all categories",
            ].map((q, i) => (
              <span key={i} style={styles.chip} onClick={() => setQuestion(q)}>
                {q}
              </span>
            ))}
          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Type your question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) ask(); }}
            />
            <button
              style={loading ? styles.askBtnDisabled : styles.askBtn}
              onClick={() => ask()}
              disabled={loading}
            >
              {loading ? "⏳" : "Ask"}
            </button>
          </div>

          {loading && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
              <p style={{ color: "#004f9f", margin: "12px 0 0 0" }}>
                🔍 Processing your question...
              </p>
            </div>
          )}

          {resp && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.responseHeader}>
                <h3 style={{ margin: 0 }}>Answer</h3>
                {resp.is_error && <span style={{ color: "#dc2626" }}>⚠ Error</span>}
              </div>

              <div style={resp.is_error ? styles.errorBox : styles.answerBox}>
                {typeof resp.text === "string"
                  ? resp.text
                  : JSON.stringify(resp.text)}
              </div>

              {resp.response_type === "table" && renderTable(resp.table)}
              {resp.response_type === "chart" && renderChart(resp.chart)}

            </div>
          )}
        </div>

        {/* History sidebar */}
        {showHistory && (
          <div style={styles.historySidebar}>
            <div style={styles.historyHeader}>
              <h3 style={{ margin: 0 }}>Query History</h3>
              {history.length > 0 && (
                <button
                  style={styles.clearBtn}
                  onClick={clearHistory}
                  title="Clear history"
                >
                  🗑
                </button>
              )}
            </div>

            <div style={styles.historyList}>
              {history.length === 0 ? (
                <p style={{ color: "#999", fontSize: 12, margin: 0 }}>
                  No queries yet
                </p>
              ) : (
                history.map(renderHistoryItem)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cellStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  fontSize: "12px",
  textAlign: "center"
};

const styles = {
  container: {
    padding: 20,
    fontFamily: "Arial",
    background: "#f1f5f9",
    minHeight: "100vh"
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  backBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#004f9f",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold"
  },
  historyBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#10b981",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold"
  },
  card: {
    background: "white",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0px 4px 10px rgba(0,0,0,0.08)"
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  chip: {
    padding: "5px 10px",
    background: "#e8f0fe",
    color: "#004f9f",
    borderRadius: 20,
    fontSize: 12,
    cursor: "pointer",
    border: "1px solid #c0d4f5"
  },
  inputRow: {
    display: "flex",
    gap: 10,
    marginTop: 10
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 14
  },
  askBtn: {
    padding: "10px 16px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold"
  },
  askBtnDisabled: {
    padding: "10px 16px",
    background: "#aaa",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "not-allowed",
    fontWeight: "bold"
  },
  answerBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333"
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#991b1b"
  },
  loadingBox: {
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "#f0f9ff",
    borderRadius: 8,
    border: "1px solid #bfdbfe"
  },
  spinner: {
    width: 24,
    height: 24,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #004f9f",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  },
  responseHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  historySidebar: {
    background: "white",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0px 4px 10px rgba(0,0,0,0.08)",
    width: 280,
    height: "fit-content",
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column"
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #e2e8f0"
  },
  clearBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "4px 8px"
  },
  historyList: {
    overflowY: "auto",
    flex: 1
  },
  historyItem: {
    padding: 10,
    marginBottom: 8,
    background: "#f8fafc",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover": { background: "#f1f5f9" }
  },
  historyQuestion: {
    fontSize: 13,
    fontWeight: 500,
    color: "#333",
    marginBottom: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  historyMeta: {
    fontSize: 11,
    color: "#999"
  }
};

export default NlpQueryPage;