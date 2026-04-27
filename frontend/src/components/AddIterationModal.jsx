import React, { useState } from "react";
import { MODELS, STILL_MODELS, VIDEO_MODELS, fileToCompressedDataURL } from "../lib/utils";

export default function AddIterationModal({ shot, kind = "VIDEO", onClose, onSaved }) {
  const isStill = kind === "STILL";
  const defaultModel = isStill
    ? (STILL_MODELS.includes(shot.model_assigned) ? shot.model_assigned : STILL_MODELS[0])
    : (VIDEO_MODELS.includes(shot.model_assigned) ? shot.model_assigned : VIDEO_MODELS[0]);

  const [model, setModel] = useState(defaultModel);
  const [promptText, setPromptText] = useState("");
  const [thumbnail, setThumbnail] = useState(null);
  const [whatFailed, setWhatFailed] = useState("");
  const [whatWorked, setWhatWorked] = useState("");
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const [thumbError, setThumbError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) setThumbError("Image larger than 8MB. Compressing...");
    try {
      const dataUrl = await fileToCompressedDataURL(file, 1600, 0.85);
      setThumbnail(dataUrl);
      setThumbError(null);
    } catch (e) {
      setThumbError("Failed to read image.");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const submit = async () => {
    const errs = {};
    if (!whatFailed.trim()) errs.whatFailed = "Required";
    if (!whatWorked.trim()) errs.whatWorked = "Required";
    if (!decision) errs.decision = "Required";
    if (!promptText.trim()) errs.promptText = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await onSaved({
        kind,
        model_used: model,
        prompt_text: promptText,
        thumbnail,
        what_failed: whatFailed,
        what_worked: whatWorked,
        notes,
        decision,
      });
    } catch (e) {
      console.error(e);
      alert("Failed to save iteration: " + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const title = isStill ? "Add Still" : "Add Video Iteration";
  const promptPlaceholder = isStill
    ? "Paste the still-generation prompt (Seedream / Flux)..."
    : "Paste the video-generation prompt (Kling / Veo / etc.)...";
  const finalCopy = isStill
    ? "FINAL still becomes the reference image for this shot."
    : "FINAL video promotes the thumbnail and marks the shot complete.";

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="add-iteration-modal">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title} — Shot {shot.shot_number}
            <span className={`kind-badge ${isStill ? "still" : "video"}`} style={{ marginLeft: 10, fontSize: 11 }}>{kind}</span>
          </h3>
          <button className="close" onClick={onClose} data-testid="modal-close-btn">×</button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 16px" }}>{finalCopy}</p>

        <div className="modal-grid">
          <div>
            <div className="field">
              <label>Model Used</label>
              <select value={model} onChange={e => setModel(e.target.value)} data-testid="iter-model-select">
                <optgroup label={isStill ? "Recommended (still)" : "Recommended (video)"}>
                  {(isStill ? STILL_MODELS : VIDEO_MODELS).map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Other">
                  {MODELS.filter(m => !(isStill ? STILL_MODELS : VIDEO_MODELS).includes(m)).map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              </select>
            </div>

            <div className={`field ${errors.promptText ? "error" : ""}`}>
              <label>Prompt Text<span className="req">*</span></label>
              <textarea
                className="mono"
                rows={10}
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder={promptPlaceholder}
                data-testid="iter-prompt-input"
              />
              {errors.promptText && <span className="field-error-msg">{errors.promptText}</span>}
            </div>

            <div className="field">
              <label>{isStill ? "Still" : "Thumbnail"}</label>
              <div
                className={`dropzone ${drag ? "drag" : ""}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById("file-input-iter").click()}
                data-testid="iter-thumb-dropzone"
              >
                <input
                  id="file-input-iter"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => handleFile(e.target.files[0])}
                />
                {thumbnail ? (
                  <>
                    <img src={thumbnail} alt="thumbnail" />
                    <button
                      className="remove"
                      onClick={(e) => { e.stopPropagation(); setThumbnail(null); }}
                      data-testid="iter-thumb-remove"
                    >Remove</button>
                  </>
                ) : (
                  <div>Drag image here or click to browse<br />
                    <span style={{ fontSize: 10, opacity: 0.7 }}>JPEG/PNG · auto-resized to 1600px</span>
                  </div>
                )}
              </div>
              {thumbError && <span className="field-error-msg">{thumbError}</span>}
            </div>
          </div>

          <div>
            <div className={`field ${errors.whatFailed ? "error" : ""}`}>
              <label>What Failed<span className="req">*</span></label>
              <textarea
                rows={4}
                value={whatFailed}
                onChange={e => setWhatFailed(e.target.value)}
                placeholder="Even on FINAL, capture what didn't quite land..."
                data-testid="iter-failed-input"
              />
              {errors.whatFailed && <span className="field-error-msg">{errors.whatFailed}</span>}
            </div>
            <div className={`field ${errors.whatWorked ? "error" : ""}`}>
              <label>What Worked<span className="req">*</span></label>
              <textarea
                rows={4}
                value={whatWorked}
                onChange={e => setWhatWorked(e.target.value)}
                placeholder="What landed correctly..."
                data-testid="iter-worked-input"
              />
              {errors.whatWorked && <span className="field-error-msg">{errors.whatWorked}</span>}
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional freeform..."
                data-testid="iter-notes-input"
              />
            </div>

            <div className="field">
              <label>Decision<span className="req">*</span></label>
              <div className="decision-row">
                {["DISCARD", "KEEP", "FINAL"].map(d => (
                  <button
                    key={d}
                    type="button"
                    className="btn decision"
                    data-decision={d}
                    data-active={decision === d}
                    onClick={() => setDecision(d)}
                    data-testid={`iter-decision-${d.toLowerCase()}`}
                  >{d}</button>
                ))}
              </div>
              {errors.decision && <span className="field-error-msg">{errors.decision}</span>}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose} data-testid="iter-cancel-btn">Cancel</button>
          <button className="btn primary" onClick={submit} disabled={saving} data-testid="iter-save-btn">
            {saving ? "Saving..." : `Save ${isStill ? "Still" : "Iteration"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
