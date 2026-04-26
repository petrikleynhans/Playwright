import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { STATUS_COLORS, DECISION_COLORS, formatDateTime, SHOT_STATUSES } from "../lib/utils";
import AddIterationModal from "./AddIterationModal";

function IterationCard({ it, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = (it.prompt_text || "").length > 200;

  return (
    <div className="iter-card" data-decision={it.decision} data-testid={`iter-card-${it.attempt_number}`}>
      <div className="iter-card-head">
        <div className="left">
          <span className="attempt mono">#{String(it.attempt_number).padStart(2, "0")}</span>
          <span className="decision-pill" data-decision={it.decision}>{it.decision}</span>
          <span className="model-badge">{it.model_used}</span>
        </div>
        <div className="meta">
          <span>{formatDateTime(it.created_at)}</span>
          <button className="delete-iter" onClick={() => onDelete(it.id)} title="Delete iteration" data-testid={`iter-delete-${it.attempt_number}`}>✕</button>
        </div>
      </div>

      <div className="iter-body">
        <div className="iter-thumb">
          {it.thumbnail ? (
            <img src={it.thumbnail} alt={`attempt ${it.attempt_number}`} />
          ) : (
            <div className="iter-thumb-placeholder">No image</div>
          )}
        </div>
        <div>
          <div
            className={`iter-prompt ${(!expanded && truncated) ? "collapsed" : ""}`}
            onClick={() => setExpanded(e => !e)}
            data-testid={`iter-prompt-${it.attempt_number}`}
          >
            {it.prompt_text}
          </div>
          {truncated && (
            <div className="iter-prompt-toggle" onClick={() => setExpanded(e => !e)} style={{ cursor: "pointer" }}>
              {expanded ? "▲ Collapse" : "▼ Expand prompt"}
            </div>
          )}
          <div className="iter-feedback">
            <div className="iter-fb failed">
              <span className="lbl">What Failed</span>
              {it.what_failed}
            </div>
            <div className="iter-fb worked">
              <span className="lbl">What Worked</span>
              {it.what_worked}
            </div>
          </div>
          {it.notes && (
            <div className="iter-fb notes">
              <span className="lbl">Notes</span>
              {it.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShotDetail() {
  const { filmId, shotId } = useParams();
  const navigate = useNavigate();
  const [shot, setShot] = useState(null);
  const [iterations, setIterations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, its] = await Promise.all([api.getShot(shotId), api.listIterations(shotId)]);
      setShot(s);
      setIterations(its);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [shotId]);

  const handleSave = async (payload) => {
    await api.createIteration(shotId, payload);
    setShowAdd(false);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this iteration?")) return;
    await api.deleteIteration(id);
    load();
  };

  const handleStatusChange = async (newStatus) => {
    await api.updateShot(shotId, { status: newStatus });
    load();
  };

  if (loading || !shot) {
    return <div className="app-shell"><div className="topbar"><div className="topbar-title"><h1 className="mono">FILM TRACKER</h1></div></div><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-title">
          <h1 className="mono" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>FILM TRACKER</h1>
          <span className="sub">/ {shot.shot_number}</span>
        </div>
        <button className="btn ghost" onClick={() => navigate(`/films/${filmId}`)} data-testid="back-grid-btn">← Back to Grid</button>
      </div>

      <div className="detail-page">
        {/* LEFT: SHOT SPEC */}
        <div className="shot-spec">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/films/${filmId}`); }} className="back-link">← Back to Grid</a>
          <h2 data-testid="detail-shot-number">{shot.shot_number}</h2>
          <div className="filename">{shot.filename}</div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <span className="status-pill" data-status={shot.status}>
              <span className="dot" style={{ background: STATUS_COLORS[shot.status] }} />
              {shot.status}
            </span>
            <select
              value={shot.status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ fontSize: 11, padding: "4px 6px" }}
              data-testid="status-override"
              title="Manual status override"
            >
              {SHOT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="spec-row"><span className="label">Act</span><span className="value">{shot.act}</span></div>
            <div className="spec-row"><span className="label">Model</span><span className="value mono">{shot.model_assigned}</span></div>
            <div className="spec-row"><span className="label">Type</span><span className="value">{shot.shot_type}</span></div>
            <div className="spec-row"><span className="label">Location</span><span className="value">{shot.location}{shot.int_ext && ` · ${shot.int_ext}`}</span></div>
            {shot.time_of_day && <div className="spec-row"><span className="label">Time</span><span className="value">{shot.time_of_day}</span></div>}
            {shot.duration && <div className="spec-row"><span className="label">Duration</span><span className="value">{shot.duration}</span></div>}
            <div className="spec-row"><span className="label">Camera</span><span className="value">{shot.camera}</span></div>
            <div className="spec-row"><span className="label">Emotion</span><span className="value mono">{shot.emotion_level}/10</span></div>
          </div>

          {shot.framing && (
            <>
              <div className="spec-section-title">Framing</div>
              <div className="spec-text">{shot.framing}</div>
            </>
          )}
          <div className="spec-section-title">Action</div>
          <div className="spec-text">{shot.action_summary}</div>

          {shot.audio_notes && (
            <>
              <div className="spec-section-title">Audio</div>
              <div className="spec-text">{shot.audio_notes}</div>
            </>
          )}

          {shot.special_notes && (
            <>
              <div className="spec-section-title">Special Notes</div>
              <div className="spec-text warn">{shot.special_notes}</div>
            </>
          )}

          <button
            className="btn primary add-iter-btn"
            onClick={() => setShowAdd(true)}
            data-testid="add-iteration-btn"
          >
            + Add Iteration
          </button>
        </div>

        {/* RIGHT: ITERATION LOG */}
        <div className="iter-log">
          <div className="iter-log-header">
            <h3>Iteration Log · {iterations.length} attempt{iterations.length === 1 ? "" : "s"}</h3>
          </div>

          {iterations.length === 0 ? (
            <div className="empty-state" data-testid="no-iterations">
              No iterations yet. Click <strong>+ Add Iteration</strong> to log your first attempt.
            </div>
          ) : (
            iterations.map(it => (
              <IterationCard key={it.id} it={it} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>

      {showAdd && (
        <AddIterationModal
          shot={shot}
          onClose={() => setShowAdd(false)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}
