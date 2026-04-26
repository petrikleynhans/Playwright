import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ACTS, MODELS, SHOT_STATUSES, daysUntil, formatDate, STATUS_COLORS } from "../lib/utils";
import NewShotModal from "./NewShotModal";

const STATUS_LABEL = {
  "FINAL": "FINAL",
  "IN PROGRESS": "IN PROGRESS",
  "NOT STARTED": "NOT STARTED",
  "CUT": "CUT",
};

export default function ShotGrid() {
  const { filmId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewShot, setShowNewShot] = useState(false);

  const [filterAct, setFilterAct] = useState("All");
  const [filterModel, setFilterModel] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([api.getFilm(filmId), api.listShots(filmId)]);
      setFilm(f);
      setShots(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filmId]);

  const counts = useMemo(() => {
    const c = { FINAL: 0, "IN PROGRESS": 0, "NOT STARTED": 0, CUT: 0, total: shots.length };
    shots.forEach(s => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [shots]);

  const filtered = useMemo(() => shots.filter(s => {
    if (filterAct !== "All" && s.act !== filterAct) return false;
    if (filterModel !== "All" && s.model_assigned !== filterModel) return false;
    if (filterStatus !== "All" && s.status !== filterStatus) return false;
    return true;
  }), [shots, filterAct, filterModel, filterStatus]);

  const days = film?.deadline ? daysUntil(film.deadline) : null;
  const deadlineClass = days === null ? "" : (days < 7 ? "urgent" : days < 30 ? "warn" : "");

  const handleCreateShot = async (payload) => {
    await api.createShot(filmId, payload);
    setShowNewShot(false);
    load();
  };

  if (loading || !film) {
    return <div className="app-shell"><div className="topbar"><div className="topbar-title"><h1 className="mono">FILM TRACKER</h1></div></div><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-title">
          <h1 className="mono" style={{ cursor: "pointer" }} onClick={() => navigate("/")} data-testid="topbar-home">FILM TRACKER</h1>
          <span className="sub">/ {film.title}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={() => navigate("/")} data-testid="back-films-btn">← Films</button>
          <button className="btn primary" onClick={() => setShowNewShot(true)} data-testid="new-shot-btn">+ New Shot</button>
        </div>
      </div>

      <div className="grid-page">
        <div className="grid-header">
          <div className="film-meta-block">
            <h2 data-testid="film-title">{film.title}</h2>
            {film.description && <div className="deadline" style={{ marginBottom: 6 }}>{film.description}</div>}
            {film.deadline && (
              <div className={`deadline ${deadlineClass}`} data-testid="film-deadline">
                Deadline: {formatDate(film.deadline)} {days !== null && (days >= 0 ? `· ${days} days left` : `· ${Math.abs(days)} days overdue`)}
              </div>
            )}
          </div>
          <div className="progress-summary" data-testid="progress-summary">
            <div className="item"><span className="dot" style={{ background: STATUS_COLORS.FINAL }} />{counts.FINAL}<span style={{ color: "var(--text-2)" }}>/{counts.total} Final</span></div>
            <div className="item"><span className="dot" style={{ background: STATUS_COLORS["IN PROGRESS"] }} />{counts["IN PROGRESS"]} In Progress</div>
            <div className="item"><span className="dot" style={{ background: STATUS_COLORS["NOT STARTED"] }} />{counts["NOT STARTED"]} Not Started</div>
            {counts.CUT > 0 && <div className="item"><span className="dot" style={{ background: STATUS_COLORS.CUT }} />{counts.CUT} Cut</div>}
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            <label>Act</label>
            <select value={filterAct} onChange={e => setFilterAct(e.target.value)} data-testid="filter-act">
              <option>All</option>
              {ACTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Model</label>
            <select value={filterModel} onChange={e => setFilterModel(e.target.value)} data-testid="filter-model">
              <option>All</option>
              {MODELS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} data-testid="filter-status">
              <option>All</option>
              {SHOT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-2)", alignSelf: "center" }} data-testid="visible-count">
            {filtered.length} of {shots.length} shots
          </div>
        </div>

        <div className="shot-grid" data-testid="shot-grid">
          {filtered.map(s => (
            <div
              key={s.id}
              className={`shot-card ${s.status === "CUT" ? "cut" : ""}`}
              onClick={() => navigate(`/films/${filmId}/shots/${s.id}`)}
              data-testid={`shot-card-${s.shot_number}`}
            >
              <div className="shot-thumb">
                {s.current_thumbnail ? (
                  <img src={s.current_thumbnail} alt={s.shot_number} />
                ) : (
                  <div className="shot-thumb-placeholder">No image</div>
                )}
                <div className="shot-thumb-overlay">{s.shot_number}</div>
                <div className="shot-thumb-status" style={{ background: STATUS_COLORS[s.status] }} title={s.status} />
              </div>
              <div className="shot-card-body">
                <div className="row1">
                  <span className="status-pill" data-status={s.status}>
                    <span className="dot" style={{ background: STATUS_COLORS[s.status] }} />
                    {STATUS_LABEL[s.status]}
                  </span>
                  <span className="model-badge">{s.model_assigned}</span>
                </div>
                <div className="type-loc">{s.shot_type} · {s.location}</div>
                <div className="action">{s.action_summary}</div>
                <div className="footer">
                  <span>{s.act}</span>
                  <span className="attempt-pill">{s.attempt_count || 0} attempt{s.attempt_count === 1 ? "" : "s"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="empty-state" style={{ marginTop: 20 }}>No shots match the filters.</div>
        )}
      </div>

      {showNewShot && <NewShotModal onClose={() => setShowNewShot(false)} onSaved={handleCreateShot} />}
    </div>
  );
}
