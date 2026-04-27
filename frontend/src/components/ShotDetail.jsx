import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { STATUS_COLORS, formatDateTime, SHOT_STATUSES } from "../lib/utils";
import AddIterationModal from "./AddIterationModal";
import FilmSubNav from "./FilmSubNav";

function IterationCard({ it, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = (it.prompt_text || "").length > 200;
  const kind = it.kind || "VIDEO";

  return (
    <div className="iter-card" data-decision={it.decision} data-testid={`iter-card-${kind.toLowerCase()}-${it.attempt_number}`}>
      <div className="iter-card-head">
        <div className="left">
          <span className="attempt mono">#{String(it.attempt_number).padStart(2, "0")}</span>
          <span className={`kind-badge ${kind === "STILL" ? "still" : "video"}`}>{kind}</span>
          <span className="decision-pill" data-decision={it.decision}>{it.decision}</span>
          <span className="model-badge">{it.model_used}</span>
        </div>
        <div className="meta">
          <span>{formatDateTime(it.created_at)}</span>
          <button className="delete-iter" onClick={() => onDelete(it.id)} title="Delete iteration" data-testid={`iter-delete-${kind.toLowerCase()}-${it.attempt_number}`}>✕</button>
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

function IterationSection({ kind, iterations, onAdd, onDelete }) {
  const isStill = kind === "STILL";
  const empty = iterations.length === 0;
  const title = isStill ? "Stills" : "Video Iterations";
  const sub = isStill
    ? "Reference image generation (Seedream / Flux). FINAL still becomes the I2V source."
    : "Final motion takes (Kling / Veo / etc). FINAL video promotes the shot to complete.";
  return (
    <div className={`iter-section ${empty ? "empty" : ""}`} data-testid={`iter-section-${kind.toLowerCase()}`}>
      <div className="iter-section-head">
        <div className="left">
          <span className={`kind-badge ${isStill ? "still" : "video"}`}>{kind}</span>
          <h3>{title}</h3>
          <span className="count">{iterations.length} attempt{iterations.length === 1 ? "" : "s"}</span>
        </div>
        <button
          className="btn primary add-kind-btn"
          onClick={onAdd}
          data-testid={`add-${kind.toLowerCase()}-btn`}
        >+ Add {isStill ? "Still" : "Video"}</button>
      </div>
      {empty ? (
        <div className="iter-section-empty">{sub}</div>
      ) : (
        <div className="iter-section-body">
          {iterations.map(it => (
            <IterationCard key={it.id} it={it} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShotDetail() {
  const { filmId, shotId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [shot, setShot] = useState(null);
  const [iterations, setIterations] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addKind, setAddKind] = useState(null); // "STILL" | "VIDEO" | null

  const load = async () => {
    setLoading(true);
    try {
      const [f, s, its, chars, locs] = await Promise.all([
        api.getFilm(filmId),
        api.getShot(shotId),
        api.listIterations(shotId),
        api.listCharacters(filmId),
        api.listLocations(filmId),
      ]);
      setFilm(f); setShot(s); setIterations(its); setCharacters(chars); setLocations(locs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [shotId]);

  const handleSave = async (payload) => {
    await api.createIteration(shotId, payload);
    setAddKind(null);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this iteration?")) return;
    await api.deleteIteration(id);
    load();
  };

  const handleStatusChange = async (newStatus) => {
    const updated = await api.updateShot(shotId, { status: newStatus });
    setShot(updated);
  };

  const toggleCharacter = async (id) => {
    const current = shot.character_ids || [];
    const next = current.includes(id) ? current.filter(c => c !== id) : [...current, id];
    const updated = await api.updateShot(shotId, { character_ids: next });
    setShot(updated);
  };

  const setLocation = async (id) => {
    const updated = await api.updateShot(shotId, { location_id: id || null });
    setShot(updated);
  };

  if (loading || !shot) {
    return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;
  }

  const linkedLocation = locations.find(l => l.id === shot.location_id);
  const stills = iterations.filter(it => (it.kind || "VIDEO") === "STILL");
  const videos = iterations.filter(it => (it.kind || "VIDEO") === "VIDEO");

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />

      <div className="detail-page">
        {/* LEFT: SHOT SPEC */}
        <div className="shot-spec">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/films/${filmId}`); }} className="back-link">← Back to Grid</a>
          <h2 data-testid="detail-shot-number">{shot.shot_number}</h2>
          <div className="filename">{shot.filename}</div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

          {/* Reference still display */}
          {shot.current_still && (
            <div className="ref-still-block">
              <div className="ref-still-label">
                <span className="kind-badge still">STILL</span>
                Reference Still (FINAL)
              </div>
              <img src={shot.current_still} alt="reference still" />
            </div>
          )}

          {shot.framing && (<><div className="spec-section-title">Framing</div><div className="spec-text">{shot.framing}</div></>)}
          <div className="spec-section-title">Action</div>
          <div className="spec-text">{shot.action_summary}</div>
          {shot.audio_notes && (<><div className="spec-section-title">Audio</div><div className="spec-text">{shot.audio_notes}</div></>)}
          {shot.special_notes && (<><div className="spec-section-title">Special Notes</div><div className="spec-text warn">{shot.special_notes}</div></>)}

          <div className="spec-section-title" style={{ marginTop: 18 }}>Characters in shot</div>
          {characters.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              No characters defined. <a onClick={() => navigate(`/films/${filmId}/characters`)} style={{ color: "var(--status-progress)", cursor: "pointer", textDecoration: "underline dotted" }}>Add one →</a>
            </div>
          ) : (
            <div className="chips" data-testid="character-chips">
              {characters.map(c => (
                <span
                  key={c.id}
                  className="chip"
                  data-selected={(shot.character_ids || []).includes(c.id)}
                  onClick={() => toggleCharacter(c.id)}
                  data-testid={`character-chip-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                >{c.name}</span>
              ))}
            </div>
          )}

          <div className="spec-section-title">Linked Location</div>
          {locations.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              No locations defined. <a onClick={() => navigate(`/films/${filmId}/locations`)} style={{ color: "var(--status-progress)", cursor: "pointer", textDecoration: "underline dotted" }}>Add one →</a>
            </div>
          ) : (
            <select
              value={shot.location_id || ""}
              onChange={e => setLocation(e.target.value)}
              style={{ width: "100%", fontSize: 12 }}
              data-testid="location-select"
            >
              <option value="">— None —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {linkedLocation && (
            <a
              onClick={() => navigate(`/films/${filmId}/locations/${linkedLocation.id}`)}
              style={{ fontSize: 11, color: "var(--text-2)", cursor: "pointer", textDecoration: "underline dotted", display: "inline-block", marginTop: 4 }}
            >View {linkedLocation.name} →</a>
          )}
        </div>

        {/* RIGHT: TWO ITERATION SECTIONS */}
        <div>
          <IterationSection
            kind="STILL"
            iterations={stills}
            onAdd={() => setAddKind("STILL")}
            onDelete={handleDelete}
          />
          <IterationSection
            kind="VIDEO"
            iterations={videos}
            onAdd={() => setAddKind("VIDEO")}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {addKind && (
        <AddIterationModal
          shot={shot}
          kind={addKind}
          onClose={() => setAddKind(null)}
          onSaved={handleSave}
        />
      )}
    </div>
  );
}
