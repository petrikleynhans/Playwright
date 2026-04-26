import React, { useState } from "react";
import { api } from "../lib/api";

const SAMPLE = `| Shot # | Filename | Model | Location | INT/EXT | Time of Day | Shot Type | Framing | Camera | Action / Subject | Est. Duration | Emotion (0–10) | Audio Notes | Special Notes |
|--------|----------|-------|----------|---------|-------------|-----------|---------|--------|-----------------|---------------|----------------|-------------|---------------|
| 01 | OPEN_BELL_ECU.mp4 | Kling 3.0 | Coffee Shop | INT | Morning | ECU | Tight on bell | Static | Finger presses bell | 4s | 0 | DING | Opening frame |`;

export default function ImportModal({ filmId, onClose, onImported }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
  };

  const submit = async () => {
    if (!text.trim()) { setErr("Paste or upload a shot list first."); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await api.importShots(filmId, text);
      setResult(r);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const closeAndRefresh = () => { onImported && onImported(); onClose(); };

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="import-modal">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import Shot List</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 0 }}>
          Paste a markdown table (e.g. from <code>03_shot-list.md</code>) or a CSV. Existing shots with the same number are updated; new shots are created. Column order is flexible.
        </p>

        <div className="field">
          <label>Upload .md / .csv file</label>
          <input type="file" accept=".md,.csv,.txt,text/markdown,text/csv,text/plain" onChange={onFile} data-testid="import-file" />
        </div>
        <div className="field">
          <label>Or paste content</label>
          <textarea
            rows={14}
            className="mono"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={SAMPLE}
            data-testid="import-textarea"
          />
        </div>
        {err && <div className="field-error-msg">{err}</div>}
        {result && (
          <div className="import-results" data-testid="import-result">
            <span className="ok">✓ Imported as <strong>{result.format}</strong> — created: {result.created}, updated: {result.updated}</span>
            {result.warnings && result.warnings.length > 0 && (
              <div className="warn" style={{ marginTop: 6 }}>
                Warnings:
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          {result ? (
            <>
              <button className="btn ghost" onClick={() => { setResult(null); setText(""); }}>Import Another</button>
              <button className="btn primary" onClick={closeAndRefresh} data-testid="import-done-btn">Done</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={submit} disabled={busy} data-testid="import-submit-btn">
                {busy ? "Importing…" : "Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
