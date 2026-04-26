import React, { useState } from "react";
import { ACTS, MODELS, SHOT_TYPES, SHOT_STATUSES } from "../lib/utils";

export default function NewFilmModal({ onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [totalShots, setTotalShots] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setSaving(true);
    try {
      await onSaved({
        title: title.trim(),
        description,
        deadline: deadline || null,
        total_shots: Number(totalShots) || 0,
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="new-film-modal">
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>New Film</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="field">
          <label>Title<span className="req">*</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)} data-testid="film-title-input" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} data-testid="film-desc-input" />
        </div>
        <div className="field">
          <label>Deadline</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} data-testid="film-deadline-input" />
        </div>
        <div className="field">
          <label>Total Shots (planned)</label>
          <input type="number" min="0" value={totalShots} onChange={e => setTotalShots(e.target.value)} data-testid="film-shots-input" />
        </div>
        {err && <div className="field-error-msg">{err}</div>}
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving} data-testid="film-save-btn">
            {saving ? "Saving..." : "Create Film"}
          </button>
        </div>
      </div>
    </div>
  );
}
