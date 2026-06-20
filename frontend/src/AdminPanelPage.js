import React, { useState } from "react";
import UserManagementPage from "./UserManagementPage";
import PolicyPage from "./PolicyPage";
import DataRetentionPage from "./DataRetentionPage";

const ALL_TABS = [
  { key: "users",     label: "User Management", adminOnly: true },
  { key: "policy",    label: "Calculation Policy" },
  { key: "retention", label: "Data Retention" },
];

function AdminPanelPage({ goHome, currentUser, role }) {
  const isAdmin = role === "ADMIN";
  const tabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState(isAdmin ? "users" : "policy");

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, color: "#1e293b", fontSize: "20px" }}>Admin Panel</h2>
        <button onClick={goHome} style={S.backBtn}>Back to Home</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid #e2e8f0" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={activeTab === key ? S.tabActive : S.tabInactive}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={S.tabBody}>
        {activeTab === "users" && isAdmin && (
          <UserManagementPage goHome={goHome} currentUser={currentUser} embedded />
        )}
        {activeTab === "policy" && (
          <PolicyPage goHome={goHome} currentUser={currentUser} role={role} embedded />
        )}
        {activeTab === "retention" && (
          <DataRetentionPage goHome={goHome} currentUser={currentUser} embedded />
        )}
      </div>

    </div>
  );
}

const S = {
  backBtn:    { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  tabActive:  { padding: "10px 24px", background: "#004f9f", color: "white", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  tabInactive:{ padding: "10px 22px", background: "white", color: "#555", border: "1px solid #e2e8f0", borderBottom: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  tabBody:    { background: "white", borderRadius: "0 8px 8px 8px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", minHeight: "60vh" },
};

export default AdminPanelPage;
