import React from "react";
import logo from "./assets/cipla-logo.svg";

function GenotoxicImpurityPage({ goHome, currentUser, role }) {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>⚗️ Genotoxic and Nitrosamine Impurity</h2>
        <button onClick={goHome} style={styles.backBtn}>⬅ Back to Home</button>
      </div>

      <hr style={{ marginBottom: "24px" }} />

      <div style={styles.placeholder}>
        <div style={styles.iconWrap}>
          <svg viewBox="0 0 64 64" fill="none" stroke="#004f9f" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round"
               style={{ width: 72, height: 72 }}>
            {/* DNA helix */}
            <path d="M20 8 C26 16 38 20 44 28 C38 36 26 40 20 48 C26 56 38 60 44 56"/>
            <path d="M44 8 C38 16 26 20 20 28 C26 36 38 40 44 48 C38 56 26 60 20 56"/>
            <line x1="22" y1="21" x2="42" y2="21"/>
            <line x1="20" y1="28" x2="44" y2="28"/>
            <line x1="22" y1="35" x2="42" y2="35"/>
            <line x1="20" y1="42" x2="44" y2="42"/>
          </svg>
        </div>

        <h3 style={styles.comingSoonTitle}>Module Under Development</h3>

        <p style={styles.comingSoonDesc}>
          The <strong>Genotoxic and Nitrosamine Impurity</strong> module is currently under development.
          This section will provide tools for assessing acceptable daily intake (ADI) limits,
          Threshold of Toxicological Concern (TTC), and NDMA / nitrosamine risk evaluation
          in accordance with ICH M7 and EMA guidelines.
        </p>

        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🔬</span>
            <span>Genotoxic Impurity Risk Assessment (ICH M7)</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🧪</span>
            <span>Nitrosamine Impurity Evaluation (NDMA, NDEA, NMBA, etc.)</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📋</span>
            <span>TTC-Based Acceptable Intake Limits</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📊</span>
            <span>Compound-Specific AI Limits (Cohort of Concern)</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📄</span>
            <span>Risk Assessment Report Generation</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📁</span>
            <span>Audit Trail & Document Control</span>
          </div>
        </div>

        <div style={styles.comingSoonBadge}>Coming Soon</div>
      </div>
    </div>
  );
}

const styles = {
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  backBtn: {
    padding: "8px 16px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "white",
    borderRadius: "16px",
    padding: "48px 40px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    maxWidth: "680px",
    margin: "0 auto",
    textAlign: "center",
  },
  iconWrap: {
    background: "#eef4ff",
    borderRadius: "50%",
    width: "120px",
    height: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
  },
  comingSoonTitle: {
    fontSize: "22px",
    color: "#004f9f",
    margin: "0 0 12px 0",
    fontWeight: "bold",
  },
  comingSoonDesc: {
    fontSize: "14px",
    color: "#555",
    lineHeight: "1.7",
    marginBottom: "28px",
    maxWidth: "520px",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    maxWidth: "460px",
    marginBottom: "32px",
    textAlign: "left",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    color: "#333",
  },
  featureIcon: {
    fontSize: "18px",
    flexShrink: 0,
  },
  comingSoonBadge: {
    padding: "8px 28px",
    background: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: "20px",
    color: "#856404",
    fontWeight: "bold",
    fontSize: "14px",
    letterSpacing: "0.5px",
  },
};

export default GenotoxicImpurityPage;
