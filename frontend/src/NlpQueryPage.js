import React from "react";

function NlpQueryPage({ goHome }) {
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0 }}>NLP Query</h2>
        <button style={styles.backBtn} onClick={goHome}>&#8592; Back to Home</button>
      </div>

      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#004f9f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 style={styles.title}>Coming Soon</h3>
        <p style={styles.subtitle}>
          The NLP Query feature is under development.<br />
          You will soon be able to ask plain-English questions about your cleaning validation data.
        </p>
        <div style={styles.featureList}>
          <div style={styles.featureItem}>Query facilities, equipment &amp; products in natural language</div>
          <div style={styles.featureItem}>Get answers as text, tables, or charts</div>
          <div style={styles.featureItem}>Browse query history &amp; re-run past questions</div>
        </div>
      </div>
    </div>
  );
}

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
    marginBottom: 20
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
  card: {
    background: "white",
    borderRadius: 10,
    padding: "48px 32px",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.08)",
    textAlign: "center",
    maxWidth: 520,
    margin: "0 auto"
  },
  iconWrap: {
    marginBottom: 16
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: 22,
    color: "#1e293b"
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.7,
    margin: "0 0 28px 0"
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    textAlign: "left"
  },
  featureItem: {
    padding: "10px 14px",
    background: "#f0f6ff",
    border: "1px solid #c7d9f5",
    borderRadius: 6,
    fontSize: 13,
    color: "#334155"
  }
};

export default NlpQueryPage;
