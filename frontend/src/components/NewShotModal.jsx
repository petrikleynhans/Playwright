import React, { useState } from "react";
import { ACTS, MODELS, SHOT_TYPES, SHOT_STATUSES } from "../lib/utils";

const empty = {
  shot_number: "",
  act: "ACT 1",
  filename: "",
  model_assigned: "Kling 3.0",
  shot_type: "MS",
  location: "",
  int_ext: "INT",
  time_of_day: "",
  framing: "",
  action_summary: "",
  emotion_level: 0,
  camera: "Static",
  audio_notes: "",
  special_notes: "",
  duration: "",
  status: "NOT STARTED",
};

export default function NewShotModal({ onClose, onSaved }) {
  const [data, setData] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const update = (k, v) => setData(d => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!data.shot_number.trim()) { setErr("Shot number required"); return; }
    setSaving(true);
    try {
      const payload = { ...data, emotion_level: Number(data.emotion_level) || 0 };
      await onSaved(payload);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="new-shot-modal">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>New Shot</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="modal-grid">
          <div>
            <div className="field">
              <label>Shot Number<span className="req">*</span></label>
              <input value={data.shot_number} onChange={e => update("shot_number", e.target.value)} placeholder="e.g. 01, 07A" data-testid="shot-number-input" />
            </div>
            <div className="field">
              <label>Filename</label>
              <input value={data.filename} onChange={e => update("filename", e.target.value)} className="mono" />
            </div>
            <div className="field">
              <label>Act</label>
              <select value={data.act} onChange={e => update("act", e.target.value)}>
                {ACTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Model Assigned</label>
              <select value={data.model_assigned} onChange={e => update("model_assigned", e.target.value)}>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Shot Type</label>
              <select value={data.shot_type} onChange={e => update("shot_type", e.target.value)}>
                {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={data.status} onChange={e => update("status", e.target.value)}>
                {SHOT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="field">
              <label>Location</label>
              <input value={data.location} onChange={e => update("location", e.target.value)} />
            </div>
            <div className="field">
              <label>INT/EXT</label>
              <select value={data.int_ext} onChange={e => update("int_ext", e.target.value)}>
                <option value="INT">INT</option>
                <option value="EXT">EXT</option>
              </select>
            </div>
            <div className="field">
              <label>Time of Day</label>
              <input value={data.time_of_day} onChange={e => update("time_of_day", e.target.value)} />
            </div>
            <div className="field">
              <label>Action Summary</label>
              <textarea rows={2} value={data.action_summary} onChange={e => update("action_summary", e.target.value)} />
            </div>
            <div className="field">
              <label>Camera</label>
              <input value={data.camera} onChange={e => update("camera", e.target.value)} />
            </div>
            <div className="field">
              <label>Emotion Level (0–10)</label>
              <input type="number" min={0} max={10} value={data.emotion_level} onChange={e => update("emotion_level", e.target.value)} />
            </div>
            <div className="field">
              <label>Audio Notes</label>
              <textarea rows={2} value={data.audio_notes} onChange={e => update("audio_notes", e.target.value)} />
            </div>
            <div className="field">
              <label>Special Notes</label>
              <textarea rows={2} value={data.special_notes} onChange={e => update("special_notes", e.target.value)} />
            </div>
          </div>
        </div>
        {err && <div className="field-error-msg">{err}</div>}
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving} data-testid="shot-save-btn">
            {saving ? "Saving..." : "Create Shot"}
          </button>
        </div>
      </div>
    </div>
  );
}
