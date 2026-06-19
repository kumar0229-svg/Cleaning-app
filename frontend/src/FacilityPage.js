import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/cipla-logo.svg";

function FacilityPage({ goHome, currentUser }) {
  const [name, setName] = useState("");
  const [facilities, setFacilities] = useState([]);
  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPassword, setAddPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [pendingName, setPendingName] = useState("");

  // Delete modal
  const [showModal, setShowModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const printRef = useRef();

  const loadFacilities = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get("/facility/all");
      setFacilities(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, [currentUser]);

  const addFacility = () => {
    if (!name.trim()) { alert("Enter facility name ❌"); return; }
    setPendingName(name.trim());
    setAddPassword("");
    setShowAddModal(true);
  };

  const confirmAdd = async () => {
    if (!addPassword) { alert("Enter your password ❌"); return; }
    setAddLoading(true);
    try {
      await api.post("/facility/add", { facility_name: pendingName, password: addPassword });
      alert("Facility added ✅");
      setName("");
      setShowAddModal(false);
      loadFacilities();
    } catch (err) {
      alert(err.response?.data?.detail || "Error adding facility ❌");
    } finally {
      setAddLoading(false);
    }
  };

  const openDeleteModal = (facility) => {
    setSelectedFacility(facility);
    setDeleteReason("");
    setDeletePassword("");
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteReason.trim()) {
      alert("Enter reason for deletion ❌");
      return;
    }
    if (!deletePassword.trim()) {
      alert("Enter your password ❌");
      return;
    }

    setDeleting(true);
    try {
      await api.delete(
        `/facility/delete/${selectedFacility.facility_id}`,
        { data: { password: deletePassword, reason: deleteReason } }
      );
      alert("Facility deleted ✅");
      setShowModal(false);
      loadFacilities();
    } catch (err) {
      alert(err.response?.data?.detail || "Error deleting facility ❌");
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current || facilities.length === 0) {
      alert("Nothing to print ❌");
      return;
    }
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Facility Master Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #004f9f; padding-bottom: 10px; margin-bottom: 20px; }
            .header img { width: 80px; margin-right: 20px; }
            .header-text h2 { margin: 0; color: #004f9f; font-size: 18px; }
            .header-text p { margin: 4px 0 0 0; color: #555; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #004f9f; color: white; padding: 8px; text-align: center; font-size: 11px; }
            td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; color: #888; font-size: 11px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logo}" alt="Cipla" />
            <div class="header-text">
              <h2>Cleaning Limit Software</h2>
              <p>Facility Master Report</p>
              <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
            </div>
          </div>
          ${printContent}
          <div class="footer">
            <span>Falcon — Confidential</span>
            <span>Total Records: ${facilities.length}</span>
            <span>Printed by: ${currentUser || "Unknown"}</span>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>

      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>🏭 Facility Master</h2>
        <button onClick={goHome} style={styles.backBtn}>⬅ Back to Home</button>
      </div>

      {/* Add Form */}
      <div style={styles.formBox}>
        <input
          placeholder="Enter Facility Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />
        <button onClick={addFacility} style={styles.addBtn}>
          ➕ Add Facility
        </button>
      </div>

      <hr />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Existing Facilities</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={loadFacilities} style={styles.refreshBtn}>🔄 Refresh</button>
          <button onClick={handlePrint} style={styles.printBtn}>🖨️ Print as PDF</button>
        </div>
      </div>

      <div ref={printRef}>
        {facilities.length === 0 ? (
          <p>No facilities found</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#004f9f", color: "white" }}>
                  <th style={cell}>ID</th>
                  <th style={cell}>Facility Name</th>
                  <th style={cell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((f, index) => (
                  <tr key={f.facility_id}
                    style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                    <td style={cell}>{f.facility_id}</td>
                    <td style={cell}>{f.facility_name}</td>
                    <td style={cell}>
                      <button
                        onClick={() => openDeleteModal(f)}
                        style={styles.deleteBtn}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <br />
      <p style={{ color: "#888", fontSize: "13px" }}>Total Records: {facilities.length}</p>

      {/* Add Facility Modal */}
      {showAddModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#004f9f", marginTop: 0 }}>Confirm Add Facility</h3>
            <p>Adding facility: <strong>{pendingName}</strong></p>

            <label style={styles.label}>Your Password *</label>
            <input
              type="password"
              placeholder="Enter your password to confirm"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmAdd(); }}
              style={styles.input}
              autoFocus
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button
                onClick={confirmAdd}
                disabled={addLoading}
                style={addLoading ? styles.deleteBtnDisabled : styles.confirmDeleteBtn}
              >
                {addLoading ? "Adding..." : "Confirm Add"}
              </button>
              <button onClick={() => setShowAddModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#dc3545", marginTop: 0 }}>🗑 Delete Facility</h3>
            <p>You are about to delete: <strong>{selectedFacility?.facility_name}</strong></p>

            <label style={styles.label}>Reason for Deletion *</label>
            <textarea
              rows={3}
              placeholder="Enter reason..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              style={styles.textarea}
            />

            <label style={styles.label}>Your Password *</label>
            <input
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              style={styles.input}
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={deleting ? styles.deleteBtnDisabled : styles.confirmDeleteBtn}
              >
                {deleting ? "Deleting..." : "✅ Confirm Delete"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={styles.cancelBtn}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const cell = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "center"
};

const styles = {
  formBox: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  input: {
    padding: "10px",
    width: "280px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  addBtn: {
    padding: "10px 16px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold"
  },
  refreshBtn: {
    padding: "8px 14px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold"
  },
  printBtn: {
    padding: "8px 14px",
    background: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold"
  },
  deleteBtn: {
    padding: "5px 10px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px"
  },
  confirmDeleteBtn: {
    padding: "10px 16px",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    flex: 1
  },
  deleteBtnDisabled: {
    padding: "10px 16px",
    background: "#aaa",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "not-allowed",
    fontWeight: "bold",
    flex: 1
  },
  cancelBtn: {
    padding: "10px 16px",
    background: "#555",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    flex: 1
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px"
  },
  backBtn: {
    padding: "8px 16px",
    background: "#004f9f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  },
  overlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  modal: {
    background: "white",
    padding: "30px",
    borderRadius: "10px",
    width: "400px",
    boxShadow: "0px 10px 30px rgba(0,0,0,0.3)"
  },
  label: {
    display: "block",
    marginBottom: "5px",
    marginTop: "10px",
    fontWeight: "bold",
    fontSize: "13px"
  },
  textarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "14px",
    boxSizing: "border-box",
    resize: "vertical"
  }
};

export default FacilityPage;