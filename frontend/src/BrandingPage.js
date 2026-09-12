import React, { useRef, useState } from "react";
import api from "./api";
import { useLogo } from "./LogoContext";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

const apiError = (e, fallback) =>
  e?.response?.data?.detail || e?.message || fallback;

function BrandingPage({ embedded }) {
  const { logoSrc, hasCustomLogo, refreshLogo } = useLogo();
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    setMessage(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "Unsupported file type. Use PNG, JPEG, SVG, or WEBP." });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ type: "error", text: "File too large — max 2 MB." });
      e.target.value = "";
      return;
    }
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelSelection = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", previewFile);
      await api.post("/branding/logo", formData);
      await refreshLogo();
      cancelSelection();
      setMessage({ type: "ok", text: "Logo updated successfully ✅" });
    } catch (e) {
      setMessage({ type: "error", text: apiError(e, "Failed to upload logo.") });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset to the default placeholder logo?")) return;
    setResetting(true);
    setMessage(null);
    try {
      await api.delete("/branding/logo");
      await refreshLogo();
      setMessage({ type: "ok", text: "Logo reset to default placeholder ✅" });
    } catch (e) {
      setMessage({ type: "error", text: apiError(e, "Failed to reset logo.") });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={embedded ? {} : S.page}>
      <h3 style={S.heading}>App Logo</h3>
      <p style={S.subtext}>
        Upload a custom logo to replace the default placeholder shown across the app —
        login screen, page headers, and printed reports. PNG, JPEG, SVG, or WEBP, up to 2 MB.
      </p>

      <div style={S.row}>
        <div style={S.previewBox}>
          <img src={previewUrl || logoSrc} alt="Current logo" style={S.previewImg} />
        </div>
        <div style={S.statusCol}>
          <div style={S.statusLabel}>
            {previewUrl
              ? "Preview — not yet saved"
              : hasCustomLogo ? "Custom logo active" : "Using default placeholder logo"}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            onChange={onFileChange}
            style={{ display: "none" }}
          />

          <div style={S.btnRow}>
            <button style={S.secondaryBtn} onClick={pickFile}>Choose Image…</button>
            {previewFile && (
              <>
                <button style={S.primaryBtn} onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading…" : "Save Logo"}
                </button>
                <button style={S.secondaryBtn} onClick={cancelSelection} disabled={uploading}>
                  Cancel
                </button>
              </>
            )}
            {!previewFile && hasCustomLogo && (
              <button style={S.dangerBtn} onClick={handleReset} disabled={resetting}>
                {resetting ? "Resetting…" : "Reset to Default"}
              </button>
            )}
          </div>

          {message && (
            <div style={message.type === "ok" ? S.okMsg : S.errMsg}>{message.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  page:        { padding: "20px" },
  heading:     { margin: "0 0 6px", color: "#1e293b", fontSize: "17px" },
  subtext:     { margin: "0 0 20px", color: "#666", fontSize: "13px", maxWidth: 560, lineHeight: 1.5 },
  row:         { display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" },
  previewBox:  {
    width: 120, height: 120, borderRadius: "10px", border: "1px solid #e2e8f0",
    background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, padding: "12px",
  },
  previewImg:  { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  statusCol:   { display: "flex", flexDirection: "column", gap: "10px", minWidth: 240 },
  statusLabel: { fontSize: "13px", fontWeight: 600, color: "#333" },
  btnRow:      { display: "flex", gap: "10px", flexWrap: "wrap" },
  primaryBtn:  { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  secondaryBtn:{ padding: "8px 16px", background: "white", color: "#004f9f", border: "1px solid #004f9f", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  dangerBtn:   { padding: "8px 16px", background: "white", color: "#dc3545", border: "1px solid #dc3545", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  okMsg:       { fontSize: "13px", color: "#155724", background: "#d4edda", padding: "8px 10px", borderRadius: "5px", maxWidth: 360 },
  errMsg:      { fontSize: "13px", color: "#721c24", background: "#f8d7da", padding: "8px 10px", borderRadius: "5px", maxWidth: 360 },
};

export default BrandingPage;
