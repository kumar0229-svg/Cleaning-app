import React, { useEffect, useState, useRef } from "react";
import api from "./api";
import logo from "./assets/falcon-logo.svg";
import Pagination from "./Pagination";

const PAGE_SIZE = 20;

function EquipmentPage({ goHome, currentUser }) {
  const [facilityId, setFacilityId] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [area, setArea] = useState("");
  const [rinseVolume, setRinseVolume] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [filterFacilityId, setFilterFacilityId] = useState("");

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPassword, setAddPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editArea, setEditArea] = useState("");
  const [editRinse, setEditRinse] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Add/manage category modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catPassword, setCatPassword] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState(null);

  const [eqPage, setEqPage] = useState(1);
  const printRef = useRef();

  const loadFacilities = async () => {
    try {
      const res = await api.get("/facility/all");
      setFacilities(res.data);
    } catch (err) {
      console.log("Error loading facilities:", err);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get("/equipment/categories");
      setCategories(res.data);
    } catch (err) {
      console.log("Error loading categories:", err);
    }
  };

  const loadEquipment = async (fid) => {
    try {
      const url = fid ? `/equipment/by_facility/${fid}` : "/equipment/all";
      const res = await api.get(url);
      setEquipmentList(res.data);
    } catch (err) {
      console.log("Error loading equipment:", err);
    }
  };

  const loadData = () => {
    loadFacilities();
    loadCategories();
    loadEquipment(filterFacilityId);
  };

  const handleFilterChange = (fid) => {
    setFilterFacilityId(fid);
    loadEquipment(fid);
  };

  useEffect(() => {
    loadFacilities();
    loadCategories();
  }, [currentUser]);

  const addEquipment = () => {
    if (!facilityId || !equipmentName || !area || !rinseVolume || !categoryId) {
      alert("Fill all fields including Category ❌");
      return;
    }
    setAddPassword("");
    setShowAddModal(true);
  };

  const confirmAdd = async () => {
    if (!addPassword) { alert("Enter your password ❌"); return; }
    setAddLoading(true);
    try {
      await api.post("/equipment/add", {
        equipment_name: equipmentName,
        facility_id: parseInt(facilityId),
        surface_area_cm2: parseFloat(area),
        rinse_volume_liters: parseFloat(rinseVolume),
        category_id: parseInt(categoryId),
        password: addPassword,
      });
      alert("Equipment Added ✅");
      setEquipmentName("");
      setArea("");
      setRinseVolume("");
      setCategoryId("");
      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error adding equipment ❌");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (eq) => {
    setSelectedEquipment(eq);
    setEditArea((eq.surface_area_cm2 / 6.4516).toFixed(2));
    setEditRinse(String(eq.rinse_volume_liters || 0));
    setEditCategoryId(eq.category_id ? String(eq.category_id) : "");
    setEditPassword("");
    setEditReason("");
    setShowEditModal(true);
  };

  const confirmEdit = async () => {
    if (!editArea || !editRinse) { alert("Fill all fields ❌"); return; }
    if (!editReason.trim()) { alert("Enter reason ❌"); return; }
    if (!editPassword.trim()) { alert("Enter password ❌"); return; }

    setSaving(true);
    try {
      await api.put(
        `/equipment/update/${selectedEquipment.equipment_id}`,
        {
          surface_area_in2: parseFloat(editArea),
          rinse_volume_liters: parseFloat(editRinse),
          category_id: editCategoryId ? parseInt(editCategoryId) : null,
          password: editPassword,
          reason: editReason,
        }
      );
      alert("Equipment Updated ✅");
      setShowEditModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error updating equipment ❌");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (eq) => {
    setSelectedEquipment(eq);
    setDeleteReason("");
    setDeletePassword("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteReason.trim()) { alert("Enter reason ❌"); return; }
    if (!deletePassword.trim()) { alert("Enter password ❌"); return; }
    setDeleting(true);
    try {
      await api.delete(
        `/equipment/delete/${selectedEquipment.equipment_id}`,
        { data: { password: deletePassword, reason: deleteReason } }
      );
      alert("Equipment deleted ✅");
      setShowDeleteModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error deleting ❌");
    } finally {
      setDeleting(false);
    }
  };

  const confirmAddCategory = async () => {
    if (!newCatName.trim()) { alert("Enter category name ❌"); return; }
    if (!catPassword.trim()) { alert("Enter your password ❌"); return; }
    setCatLoading(true);
    try {
      await api.post("/equipment/categories/add", {
        category_name: newCatName.trim(),
        password: catPassword,
      });
      alert(`Category "${newCatName.trim()}" added ✅`);
      setNewCatName("");
      setCatPassword("");
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.detail || "Error adding category ❌");
    } finally {
      setCatLoading(false);
    }
  };

  const removeCategory = async (cat) => {
    if (!catPassword.trim()) { alert("Enter your password first ❌"); return; }
    if (!window.confirm(`Remove category "${cat.category_name}"?`)) return;
    setDeletingCatId(cat.category_id);
    try {
      await api.delete(`/equipment/categories/remove/${cat.category_id}`, {
        data: { password: catPassword, reason: "Category removed by user" },
      });
      alert(`Category "${cat.category_name}" removed ✅`);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.detail || "Error removing category ❌");
    } finally {
      setDeletingCatId(null);
    }
  };

  const handlePrint = () => {
    if (!printRef.current || equipmentList.length === 0) {
      alert("Nothing to print ❌");
      return;
    }
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Equipment Master Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        .header { display: flex; align-items: center; border-bottom: 2px solid #004f9f; padding-bottom: 10px; margin-bottom: 20px; }
        .header img { width: 80px; margin-right: 20px; }
        .header-text h2 { margin: 0; color: #004f9f; font-size: 18px; }
        .header-text p { margin: 4px 0 0 0; color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #004f9f; color: white; padding: 8px; text-align: center; font-size: 11px; }
        td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 11px; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; color: #888; font-size: 11px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logo}" alt="Falcon" />
          <div class="header-text">
            <h2>Cleaning Limit Software</h2>
            <p>Equipment Master Report</p>
            <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
        ${printContent}
        <div class="footer">
          <span>Falcon — Confidential</span>
          <span>Total Records: ${equipmentList.length}</span>
          <span>Printed by: ${currentUser || "Unknown"}</span>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>⚙️ Equipment Master</h2>
        <button onClick={goHome} style={styles.backBtn}>⬅ Back to Home</button>
      </div>

      <div style={styles.formBox}>
        <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} style={styles.input}>
          <option value="">Select Facility</option>
          {facilities.map((f) => (
            <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
          ))}
        </select>

        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={styles.input}>
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
          ))}
        </select>

        <input placeholder="Equipment Name" value={equipmentName}
          onChange={(e) => setEquipmentName(e.target.value)} style={styles.input} />
        <input placeholder="Surface Area (in²)" value={area}
          onChange={(e) => setArea(e.target.value)} style={styles.input} />
        <input placeholder="Rinse Volume (Liters)" value={rinseVolume}
          onChange={(e) => setRinseVolume(e.target.value)} style={styles.input} />

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={addEquipment} style={{ ...styles.addBtn, flex: 1 }}>➕ Add Equipment</button>
          <button onClick={() => { setNewCatName(""); setCatPassword(""); setShowCatModal(true); }}
            style={styles.catBtn} title="Add new equipment category">
            + Category
          </button>
        </div>
      </div>

      <hr />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 style={{ margin: 0 }}>Equipment List</h3>
          <select
            value={filterFacilityId}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">All Facilities</option>
            {facilities.map((f) => (
              <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={loadData} style={styles.refreshBtn}>🔄 Refresh</button>
          <button onClick={handlePrint} style={styles.printBtn}>🖨️ Print as PDF</button>
        </div>
      </div>

      <div ref={printRef}>
        {equipmentList.length === 0 ? (
          <p style={{ color: "#888", marginTop: "12px" }}>
            {filterFacilityId ? "No equipment found for this facility." : "No equipment found."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#004f9f", color: "white" }}>
                  <th style={cell}>ID</th>
                  <th style={cell}>Category</th>
                  <th style={cell}>Equipment Name</th>
                  <th style={cell}>Facility</th>
                  <th style={cell}>Surface Area (in²)</th>
                  <th style={cell}>Rinse Volume (L)</th>
                  <th style={cell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipmentList.slice((eqPage-1)*PAGE_SIZE, eqPage*PAGE_SIZE).map((e, index) => (
                  <tr key={e.equipment_id}
                    style={{ background: index % 2 === 0 ? "#f8fafc" : "white" }}>
                    <td style={cell}>{e.equipment_id}</td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      <span style={{
                        background: "#e8f0fe", color: "#1a56db",
                        padding: "2px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold"
                      }}>
                        {e.category_name || "—"}
                      </span>
                    </td>
                    <td style={cell}>{e.equipment_name}</td>
                    <td style={cell}>
                      {facilities.find(f => f.facility_id === e.facility_id)?.facility_name || e.facility_id}
                    </td>
                    <td style={cell}>{(e.surface_area_cm2 / 6.4516).toFixed(2)}</td>
                    <td style={cell}>{e.rinse_volume_liters ?? "—"}</td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        <button onClick={() => openEditModal(e)} style={styles.editBtn}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => openDeleteModal(e)} style={styles.deleteBtn}>
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination total={equipmentList.length} page={eqPage} pageSize={PAGE_SIZE} onPage={setEqPage} />
      <br />
      <p style={{ color: "#888", fontSize: "13px" }}>Total Records: {equipmentList.length}</p>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#004f9f", marginTop: 0 }}>Confirm Add Equipment</h3>
            <p>Adding: <strong>{equipmentName}</strong></p>
            <p style={{ margin: "4px 0", fontSize: "13px", color: "#555" }}>
              Category: <strong>{categories.find(c => String(c.category_id) === String(categoryId))?.category_name || "—"}</strong>
            </p>

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
                style={addLoading ? styles.saveBtnDisabled : styles.saveBtn}
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

      {/* Edit Modal */}
      {showEditModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#004f9f", marginTop: 0 }}>✏️ Edit Equipment</h3>
            <p>Editing: <strong>{selectedEquipment?.equipment_name}</strong></p>
            <p style={{ color: "#888", fontSize: "12px" }}>
              Facility is locked — delete and re-add to change facility.
            </p>

            <label style={styles.label}>Category</label>
            <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} style={styles.input}>
              <option value="">— No Category —</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
              ))}
            </select>

            <label style={styles.label}>Surface Area (in²) *</label>
            <input type="number" value={editArea}
              onChange={(e) => setEditArea(e.target.value)} style={styles.input} />

            <label style={styles.label}>Rinse Volume (L) *</label>
            <input type="number" value={editRinse}
              onChange={(e) => setEditRinse(e.target.value)} style={styles.input} />

            <label style={styles.label}>Reason for Change *</label>
            <textarea rows={3} placeholder="Enter reason..."
              value={editReason} onChange={(e) => setEditReason(e.target.value)}
              style={styles.textarea} />

            <label style={styles.label}>Your Password *</label>
            <input type="password" placeholder="Enter your password"
              value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
              style={styles.input} />

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button onClick={confirmEdit} disabled={saving}
                style={saving ? styles.saveBtnDisabled : styles.saveBtn}>
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
              <button onClick={() => setShowEditModal(false)} style={styles.cancelBtn}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#dc3545", marginTop: 0 }}>🗑 Delete Equipment</h3>
            <p>Deleting: <strong>{selectedEquipment?.equipment_name}</strong></p>

            <label style={styles.label}>Reason *</label>
            <textarea rows={3} placeholder="Enter reason..." value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)} style={styles.textarea} />

            <label style={styles.label}>Your Password *</label>
            <input type="password" placeholder="Enter your password" value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)} style={styles.input} />

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button onClick={confirmDelete} disabled={deleting}
                style={deleting ? styles.saveBtnDisabled : styles.confirmDeleteBtn}>
                {deleting ? "Deleting..." : "✅ Confirm Delete"}
              </button>
              <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showCatModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ color: "#004f9f", marginTop: 0 }}>⚙️ Manage Equipment Categories</h3>

            <label style={styles.label}>Your Password *</label>
            <input
              type="password"
              placeholder="Required for add / remove"
              value={catPassword}
              onChange={(e) => setCatPassword(e.target.value)}
              style={styles.input}
              autoFocus
            />

            <label style={{ ...styles.label, marginTop: "16px" }}>Existing Categories</label>
            <div style={{ border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
              {categories.length === 0 && (
                <p style={{ padding: "10px", color: "#888", fontSize: "13px", margin: 0 }}>No categories yet.</p>
              )}
              {categories.map((c) => (
                <div key={c.category_id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: "13px"
                }}>
                  <span>{c.category_name}</span>
                  <button
                    onClick={() => removeCategory(c)}
                    disabled={deletingCatId === c.category_id}
                    style={{
                      padding: "3px 10px", background: deletingCatId === c.category_id ? "#aaa" : "#dc3545",
                      color: "white", border: "none", borderRadius: "4px",
                      cursor: deletingCatId === c.category_id ? "not-allowed" : "pointer", fontSize: "12px"
                    }}
                  >
                    {deletingCatId === c.category_id ? "..." : "Remove"}
                  </button>
                </div>
              ))}
            </div>

            <label style={styles.label}>Add New Category</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="e.g. Fluid Bed Dryer"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAddCategory(); }}
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={confirmAddCategory}
                disabled={catLoading}
                style={{
                  padding: "10px 14px", background: catLoading ? "#aaa" : "#004f9f",
                  color: "white", border: "none", borderRadius: "6px",
                  cursor: catLoading ? "not-allowed" : "pointer", fontWeight: "bold", whiteSpace: "nowrap"
                }}
              >
                {catLoading ? "..." : "Add"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setShowCatModal(false)} style={styles.cancelBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const cell = { border: "1px solid #ddd", padding: "8px", textAlign: "center" };

const styles = {
  formBox: { display: "flex", flexDirection: "column", gap: "12px", width: "320px" },
  filterSelect: { padding: "7px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", cursor: "pointer", minWidth: "180px" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  addBtn: { padding: "10px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  catBtn: { padding: "10px 14px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" },
  refreshBtn: { padding: "8px 14px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  printBtn: { padding: "8px 14px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  editBtn: { padding: "5px 10px", background: "#ffc107", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  deleteBtn: { padding: "5px 10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  saveBtn: { padding: "10px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  saveBtnDisabled: { padding: "10px 16px", background: "#aaa", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", flex: 1 },
  confirmDeleteBtn: { padding: "10px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  cancelBtn: { padding: "10px 16px", background: "#555", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1 },
  pageHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn: { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", padding: "30px", borderRadius: "10px", width: "420px", boxShadow: "0px 10px 30px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" },
  label: { display: "block", marginBottom: "5px", marginTop: "10px", fontWeight: "bold", fontSize: "13px" },
  textarea: { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", resize: "vertical" }
};

export default EquipmentPage;
