import React, { useState, useEffect, useRef, useCallback } from "react";
import LoginPage from "./LoginPage";
import ForceChangePasswordPage from "./ForceChangePasswordPage";
import PolicyPage from "./PolicyPage";
import ProtocolPage from "./ProtocolPage";
import FacilityPage from "./FacilityPage";
import EquipmentPage from "./EquipmentPage";
import ProductPage from "./ProductPage";
import MatrixPage from "./MatrixPage";
import AuditPage from "./AuditPage";
import UserManagementPage from "./UserManagementPage";
import NlpQueryPage from "./NlpQueryPage";
import HelpPage from "./HelpPage";
import LifeCycleManagementPage from "./LifeCycleManagementPage";
import DashboardPage from "./DashboardPage";
import CCVProtocolPage from "./CCVProtocolPage";
import GenotoxicImpurityPage from "./GenotoxicImpurityPage";
import DataRetentionPage from "./DataRetentionPage";
import logo from "./assets/falcon-logo.svg";
import Footer from "./Footer";

const icons = {
  /* Dashboard / bar chart */
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <rect x="7" y="13" width="3" height="5" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="11" y="9" width="3" height="9" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="15" y="6" width="3" height="12" rx="0.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  /* Manufacturing facility / building */
  facility: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <path d="M2 20V9l6-5v5l6-5v16"/>
      <path d="M14 20V10l6-4v14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
      <rect x="5" y="14" width="2.5" height="3" rx="0.4"/>
      <rect x="9" y="14" width="2.5" height="3" rx="0.4"/>
    </svg>
  ),
  /* Industrial equipment / reactor vessel with pipes */
  equipment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="6" y="6" width="12" height="13" rx="2"/>
      <path d="M9 6V4h6v2"/>
      <path d="M9 19v2h6v-2"/>
      <line x1="3" y1="10" x2="6" y2="10"/>
      <line x1="18" y1="10" x2="21" y2="10"/>
      <line x1="3" y1="14" x2="6" y2="14"/>
      <line x1="18" y1="14" x2="21" y2="14"/>
      <circle cx="12" cy="12.5" r="2"/>
    </svg>
  ),
  /* Pharmaceutical tablet / pill */
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="3" y="9" width="18" height="6" rx="3"/>
      <line x1="12" y1="9" x2="12" y2="15"/>
      <circle cx="6.5" cy="7" r="1.2"/>
      <circle cx="10" cy="5.5" r="1"/>
      <circle cx="14" cy="5.5" r="1"/>
      <circle cx="17.5" cy="7" r="1.2"/>
    </svg>
  ),
  /* Cleaning matrix / cross-reference grid with tick */
  matrix: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
      <polyline points="11 12 12.5 13.5 15.5 10.5"/>
    </svg>
  ),
  /* Audit trail / checklist with magnifying glass */
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="4" y="2" width="12" height="16" rx="2"/>
      <line x1="7" y1="7" x2="13" y2="7"/>
      <line x1="7" y1="10" x2="13" y2="10"/>
      <line x1="7" y1="13" x2="10" y2="13"/>
      <circle cx="17" cy="17" r="3.5"/>
      <line x1="19.5" y1="19.5" x2="22" y2="22"/>
    </svg>
  ),
  /* NLP query / chat bubble with search */
  query: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <line x1="8" y1="9" x2="16" y2="9"/>
      <line x1="8" y1="13" x2="13" y2="13"/>
    </svg>
  ),
  /* User management / team */
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <circle cx="9" cy="7" r="3"/>
      <path d="M3 21v-2a5 5 0 0 1 10 0v2"/>
      <circle cx="17" cy="8" r="2.5"/>
      <path d="M21 21v-1.5a4 4 0 0 0-5-3.87"/>
    </svg>
  ),
  /* Calculation policy / scales of justice */
  policy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <line x1="12" y1="3" x2="12" y2="21"/>
      <path d="M5 21h14"/>
      <path d="M6 6l-3 6h6L6 6z"/>
      <path d="M18 6l-3 6h6l-3-6z"/>
      <line x1="6" y1="6" x2="18" y2="6"/>
    </svg>
  ),
  /* Protocol & report / document with numbered steps */
  protocol: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="11" x2="16" y2="11"/>
      <line x1="8" y1="15" x2="13" y2="15"/>
      <polyline points="13 17 15 19 19 15"/>
    </svg>
  ),
  /* VMP (unused in cards but kept for completeness) */
  vmp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  /* CCV Protocol & Report — document with refresh cycle */
  ccvprotocol: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="11" x2="16" y2="11"/>
      <line x1="8" y1="15" x2="11" y2="15"/>
      <path d="M13 17a3 3 0 1 0 5.5-1.5"/>
      <polyline points="18.5 14 18.5 15.5 20 15.5"/>
    </svg>
  ),
  /* Continuous Cleaning Verification / recurring check cycle */
  ccv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <path d="M4 12a8 8 0 0 1 14.93-3"/>
      <path d="M20 12a8 8 0 0 1-14.93 3"/>
      <polyline points="19 5 19.93 9 15.93 9"/>
      <polyline points="5 19 4.07 15 8.07 15"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  /* Genotoxic & Nitrosamine Impurity / DNA double helix */
  genotoxic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <path d="M8 3 C10 6 14 8 16 11 C14 14 10 16 8 19 C10 22 14 23 16 21"/>
      <path d="M16 3 C14 6 10 8 8 11 C10 14 14 16 16 19 C14 22 10 23 8 21"/>
      <line x1="8.5" y1="8" x2="15.5" y2="8"/>
      <line x1="8" y1="11" x2="16" y2="11"/>
      <line x1="8.5" y1="14" x2="15.5" y2="14"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  /* Data Retention / hourglass with clock */
  retention: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <path d="M5 3h14M5 21h14"/>
      <path d="M6 3v4l6 5-6 5v4"/>
      <path d="M18 3v4l-6 5 6 5v4"/>
      <circle cx="18" cy="6" r="3" fill="#004f9f" stroke="none" opacity="0.25"/>
      <circle cx="18" cy="6" r="1.2" fill="#004f9f" stroke="none"/>
      <line x1="18" y1="4" x2="18" y2="6"/>
      <line x1="18" y1="6" x2="19.2" y2="6.8"/>
    </svg>
  ),
  /* Life Cycle Management / timeline with milestones */
  lifecycle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
      <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"/>
      <line x1="6" y1="12" x2="6" y2="7"/>
      <line x1="12" y1="12" x2="12" y2="17"/>
      <line x1="18" y1="12" x2="18" y2="7"/>
      <rect x="3" y="4" width="6" height="3" rx="1"/>
      <rect x="9" y="17" width="6" height="3" rx="1"/>
      <rect x="15" y="4" width="6" height="3" rx="1"/>
    </svg>
  ),
};

const INACTIVITY_MS  = 10 * 60 * 1000;
const WARNING_MS     = 60 * 1000;
const HEALTH_POLL_MS = 30 * 1000;

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState("");
  const [role, setRole] = useState("");
  const [forceReset, setForceReset] = useState(false);
  const [page, setPage] = useState("home");
  const [showWarning, setShowWarning] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const failCount = useRef(0);

  const logoutTimer = useRef(null);
  const warningTimer = useRef(null);

  const navigate = useCallback((newPage) => {
    setPage(newPage);
    const url = newPage === "home" ? "/" : `/${newPage}`;
    window.history.pushState({ page: newPage }, "", url);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setLoggedIn(false);
    setUser("");
    setRole("");
    setForceReset(false);
    setPage("home");
    setShowWarning(false);
    window.history.replaceState({ page: "home" }, "", "/");
  }, []);

  const resetTimers = useCallback(() => {
    clearTimeout(logoutTimer.current);
    clearTimeout(warningTimer.current);
    setShowWarning(false);

    warningTimer.current = setTimeout(() => setShowWarning(true), INACTIVITY_MS - WARNING_MS);
    logoutTimer.current = setTimeout(logout, INACTIVITY_MS);
  }, [logout]);

  // Health-check poll — uses native fetch to avoid axios interceptor interference.
  // Only marks offline after 2 consecutive failures to suppress false positives on startup.
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          failCount.current = 0;
          setServerOnline(true);
        } else {
          failCount.current += 1;
          if (failCount.current >= 2) setServerOnline(false);
        }
      } catch {
        failCount.current += 1;
        if (failCount.current >= 2) setServerOnline(false);
      }
    };
    check();
    const id = setInterval(check, HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      clearTimeout(logoutTimer.current);
      clearTimeout(warningTimer.current);
      setShowWarning(false);
      return;
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimers));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      clearTimeout(logoutTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [loggedIn, resetTimers]);

  useEffect(() => {
    window.history.replaceState({ page: "home" }, "", "/");
  }, []);

  useEffect(() => {
    const handlePopState = (e) => {
      setPage(e.state?.page ?? "home");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Browser ignores custom text in modern versions, but setting returnValue
      // is required to trigger the native confirmation dialog.
      e.returnValue = "You have unsaved data. Are you sure you want to leave?";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loggedIn]);

  const offlineBanner = !serverOnline && (
    <div style={styles.offlineBanner}>
      Server is unreachable — please contact IT support. Retrying automatically...
    </div>
  );

  if (!loggedIn) {
    return (
      <>
        {offlineBanner}
        <LoginPage onLogin={(username, userRole, mustReset) => {
          setUser((username || "").trim());
          setRole((userRole || "").trim());
          setForceReset(!!mustReset);
          setLoggedIn(true);
          setPage("home");
          window.history.replaceState({ page: "home" }, "", "/");
        }} />
        <Footer />
      </>
    );
  }

  if (forceReset) {
    return (
      <>
        {offlineBanner}
        <ForceChangePasswordPage
          currentUser={user}
          onPasswordChanged={() => setForceReset(false)}
          onLogout={logout}
        />
        <Footer />
      </>
    );
  }

  const warningOverlay = showWarning && (
    <div style={styles.overlay}>
      <div style={styles.overlayBox}>
        <p style={{ margin: "0 0 12px", fontWeight: "bold", color: "#856404" }}>
          Inactivity Warning
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 14 }}>
          You will be logged out in 1 minute due to inactivity.
        </p>
        <button style={styles.stayBtn} onClick={resetTimers}>Stay Logged In</button>
      </div>
    </div>
  );

  if (page === "facility") return <>{offlineBanner}{warningOverlay}<FacilityPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "equipment") return <>{offlineBanner}{warningOverlay}<EquipmentPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "product") return <>{offlineBanner}{warningOverlay}<ProductPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "matrix") return <>{offlineBanner}{warningOverlay}<MatrixPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "audit") return <>{offlineBanner}{warningOverlay}<AuditPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "query") return <>{offlineBanner}{warningOverlay}<NlpQueryPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "users")  return <>{offlineBanner}{warningOverlay}<UserManagementPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "policy")   return <>{offlineBanner}{warningOverlay}<PolicyPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "protocol") return <>{offlineBanner}{warningOverlay}<ProtocolPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "help")   return <>{offlineBanner}{warningOverlay}<HelpPage goHome={() => navigate("home")} /><Footer /></>;
  if (page === "dashboard") return <>{offlineBanner}{warningOverlay}<DashboardPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;
  if (page === "lifecycle") return <>{offlineBanner}{warningOverlay}<LifeCycleManagementPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "ccvprotocol") return <>{offlineBanner}{warningOverlay}<CCVProtocolPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "genotoxic") return <>{offlineBanner}{warningOverlay}<GenotoxicImpurityPage goHome={() => navigate("home")} currentUser={user} role={role} /><Footer /></>;
  if (page === "retention") return <>{offlineBanner}{warningOverlay}<DataRetentionPage goHome={() => navigate("home")} currentUser={user} /><Footer /></>;

  const cards = [
    { key: "dashboard", label: "Dashboard",          color: "#e0f2fe" },
    { key: "facility",  label: "Facility",          color: "#e8f0fb" },
    { key: "equipment", label: "Equipment",          color: "#eaf7ee" },
    { key: "product",   label: "Product",            color: "#fef3e2" },
    { key: "matrix",    label: "Matrix",             color: "#f0ebfb" },
    { key: "protocol",     label: "Cleaning Validation Protocol & Report", color: "#e8f5e9" },
    { key: "ccvprotocol", label: "Periodic Cleaning Validation Protocol & Report", color: "#ecfdf5" },
    { key: "lifecycle",   label: "Life Cycle Management",   color: "#f0ebfb" },
    { key: "genotoxic",   label: "Genotoxic and Nitrosamine Impurity", color: "#fff0f0" },
    { key: "audit",     label: "Audit",              color: "#fde8e8" },
    { key: "query",     label: "Query",              color: "#e2f4fb" },
  ];

  return (
    <div style={styles.container}>

      {/* Server offline banner */}
      {offlineBanner}

      {/* Inactivity warning */}
      {warningOverlay}

      {/* HEADER */}
      <div style={styles.header}>
        <img src={logo} alt="Falcon" style={styles.logo} />
        <span style={styles.headerText}>Cleaning Limit Software</span>
        <button style={styles.helpBtn} onClick={() => navigate("help")}>? Help</button>
        <button style={styles.logout} onClick={logout}>Logout</button>
      </div>

      {/* Welcome */}
      <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#374151", fontWeight: 600 }}>
        Welcome, {user} {role ? `(${role})` : ""}
      </p>

      {/* GRID CARDS */}
      <div style={styles.grid}>
        {cards.map((card) => (
          <div
            key={card.key}
            style={styles.card}
            onClick={() => navigate(card.key)}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <div style={{ ...styles.iconBox, background: card.color }}>
              <span style={{ color: "#004f9f" }}>{icons[card.key]}</span>
            </div>
            <p style={styles.cardLabel}>{card.label}</p>
          </div>
        ))}

        {role === "ADMIN" && (
          <>
            <div
              style={styles.card}
              onClick={() => navigate("users")}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ ...styles.iconBox, background: "#e8f5e9" }}>
                <span style={{ color: "#004f9f" }}>{icons.users}</span>
              </div>
              <p style={styles.cardLabel}>User Management</p>
            </div>
            <div
              style={styles.card}
              onClick={() => navigate("policy")}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ ...styles.iconBox, background: "#eaf0fb" }}>
                <span style={{ color: "#004f9f" }}>{icons.policy}</span>
              </div>
              <p style={styles.cardLabel}>Calculation Policy</p>
            </div>
            <div
              style={styles.card}
              onClick={() => navigate("retention")}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ ...styles.iconBox, background: "#fef9ec" }}>
                <span style={{ color: "#004f9f" }}>{icons.retention}</span>
              </div>
              <p style={styles.cardLabel}>Data Retention Policy</p>
            </div>
          </>
        )}
      </div>


      <Footer />

    </div>
  );
}

const styles = {
  container: {
    padding: "12px 16px",
    paddingBottom: "52px",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "#f1f5f9",
    minHeight: "100vh"
  },
  header: {
    display: "flex",
    alignItems: "center",
    background: "#004f9f",
    padding: "8px 14px",
    borderRadius: "8px",
    gap: "10px"
  },
  logo: {
    width: "44px"
  },
  headerText: {
    color: "white",
    margin: 0,
    flex: 1,
    fontSize: "17px"
  },
  helpBtn: {
    padding: "5px 12px",
    background: "white",
    color: "#004f9f",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "12px"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    marginTop: "10px"
  },
  card: {
    background: "white",
    borderRadius: "10px",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0px 2px 8px rgba(0,0,0,0.09)",
    transition: "transform 0.18s",
    overflow: "hidden",
    paddingBottom: "5px"
  },
  iconBox: {
    width: "100%",
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px 10px 0 0",
  },
  cardLabel: {
    fontSize: "11.5px",
    fontWeight: "bold",
    color: "#004f9f",
    margin: "5px 4px 2px",
    lineHeight: "1.3"
  },
  logout: {
    padding: "5px 12px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "12px"
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  },
  overlayBox: {
    background: "#fff3cd",
    border: "2px solid #ffc107",
    borderRadius: "12px",
    padding: "28px 32px",
    maxWidth: "360px",
    textAlign: "center",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
  },
  stayBtn: {
    padding: "9px 20px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px"
  },
  offlineBanner: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "#dc3545",
    color: "white",
    textAlign: "center",
    padding: "10px 16px",
    fontWeight: "bold",
    fontSize: "14px",
    zIndex: 99999,
    letterSpacing: "0.2px"
  }
};

export default App;