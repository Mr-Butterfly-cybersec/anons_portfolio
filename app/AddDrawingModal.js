"use client";

import { useState, useRef, useEffect } from "react";

export default function AddDrawingModal({ isOpen, onClose, onDrawingAdded }) {
  const [passphrase, setPassphrase] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setPassphrase("");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setLoading(false);
      setErrorMsg("");
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setErrorMsg("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select an image file.");
      return;
    }
    if (!passphrase) {
      setErrorMsg("Password required.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("passphrase", passphrase);
      formData.append("image", file);

      const res = await fetch("/api/drawings", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      // Wipe passphrase from memory and field
      setPassphrase("");

      if (!res.ok || !data.success) {
        setLoading(false);
        setErrorMsg(data.error || "Authentication failed. Access denied.");
        return;
      }

      if (onDrawingAdded && data.drawing) {
        onDrawingAdded(data.drawing);
      }

      onClose();
    } catch {
      setPassphrase("");
      setLoading(false);
      setErrorMsg("Network failure during upload.");
    }
  };

  return (
    <div className="xp-modal-overlay" onClick={!loading ? onClose : undefined}>
      <div
        className="xp-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="xp-modal-titlebar">
          <span className="xp-ttl-icon">
            <svg viewBox="0 0 20 20" width="16" height="16">
              <path
                d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2H4zm0 1h10l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                fill="#F6C13A"
                stroke="#B8860B"
                strokeWidth=".5"
              />
              <path d="M10 6v8M6 10h8" stroke="#0a246a" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="xp-ttl-text" id="modal-title">
            Add_Drawing.exe
          </span>
          <div className="win-btns">
            <button
              type="button"
              className="win-btn close"
              onClick={!loading ? onClose : undefined}
              aria-label="Close"
              disabled={loading}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form Body - Only file picker and password */}
        <form onSubmit={handleSubmit} className="xp-modal-form">
          <div className="xp-form-group">
            <label className="xp-form-label" htmlFor="art-file">
              SELECT DRAWING
            </label>
            <div className="xp-file-row">
              <input
                id="art-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={loading}
                className="xp-file-hidden"
              />
              <button
                type="button"
                className="xp-tool-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                SELECT FILE...
              </button>
              <span className="xp-file-name">
                {file ? file.name : "No file selected"}
              </span>
            </div>

            {preview && (
              <div className="xp-modal-preview">
                <img src={preview} alt="Upload preview" />
              </div>
            )}
          </div>

          <div className="xp-form-group">
            <label className="xp-form-label" htmlFor="art-pass">
              PASSWORD
            </label>
            <input
              id="art-pass"
              type="password"
              className="xp-input"
              placeholder="Enter password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={loading}
              autoComplete="off"
              required
            />
          </div>

          {errorMsg && (
            <div className="xp-modal-error-line">
              [ERROR] {errorMsg}
            </div>
          )}

          {/* Action buttons */}
          <div className="xp-modal-actions">
            <button
              type="button"
              className="xp-tool-btn"
              onClick={onClose}
              disabled={loading}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="xp-tool-btn xp-tool-submit-btn"
              disabled={loading}
            >
              {loading ? "UPLOADING..." : "+ ADD DRAWING"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
