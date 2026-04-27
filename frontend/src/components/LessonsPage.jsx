import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import FilmSubNav from "./FilmSubNav";
import { MODELS } from "../lib/utils";

export default function LessonsPage() {
  const { filmId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDecision, setFilterDecision] = useState("ALL");
  const [filterModel, setFilterModel] = useState("All");
  const [filterKind, setFilterKind] = useState("ALL");
  const [openKey, setOpenKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, l] = await Promise.all([api.getFilm(filmId), api.lessons(filmId)]);
      setFilm(f);
      setData(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filmId]);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.groups
      .filter(g => filterModel === "All" || g.model === filterModel)
      .map(g => ({
        ...g,
        iterations: g.iterations.filter(it => {
          if (filterDecision !== "ALL" && it.decision !== filterDecision) return false;
          if (filterKind !== "ALL" && (it.kind || "VIDEO") !== filterKind) return false;
          return true;
        }),
      }))
      .filter(g => g.iterations.length > 0);
  }, [data, filterDecision, filterModel, filterKind]);

  if (loading || !data) {
    return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;
  }

  const summary = data.summary || {};
  const isEmpty = (data.summary?.total_iterations || 0) === 0;

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />
      <div className="grid-page">
        <div className="page-title">
          <div>
            <h2>Lessons</h2>
            <div className="sub">Aggregated learnings from every iteration. Grouped by Model × Location.</div>
          </div>
        </div>

        {isEmpty ? (
          <div className="cta-block">
            <h4>No iterations logged yet</h4>
            <p>Add iterations on individual shots to start building the lessons archive.</p>
            <button className="btn primary" onClick={() => navigate(`/films/${filmId}`)}>Back to Shots</button>
          </div>
        ) : (
          <>
            <div className="lessons-summary" data-testid="lessons-summary">
              <div className="stat">
                <div className="label">Total Iterations</div>
                <div className="value">{summary.total_iterations}</div>
              </div>
              <div className="stat">
                <div className="label">By Decision</div>
                <div className="value-row">
                  <div className="item"><span className="n" style={{ color: "var(--status-discard)" }}>{summary.by_decision?.DISCARD || 0}</span><span className="nm">Discard</span></div>
                  <div className="item"><span className="n" style={{ color: "var(--status-progress)" }}>{summary.by_decision?.KEEP || 0}</span><span className="nm">Keep</span></div>
                  <div className="item"><span className="n" style={{ color: "var(--status-final)" }}>{summary.by_decision?.FINAL || 0}</span><span className="nm">Final</span></div>
                </div>
              </div>
              <div className="stat">
                <div className="label">By Model</div>
                <div className="value-row">
                  {Object.entries(summary.by_model || {}).map(([m, n]) => (
                    <div key={m} className="item"><span className="n">{n}</span><span className="nm" title={m}>{m.split(" ")[0]}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-bar">
              <div className="filter-group">
                <label>Kind</label>
                <select value={filterKind} onChange={e => setFilterKind(e.target.value)} data-testid="lessons-filter-kind">
                  <option value="ALL">All</option>
                  <option value="STILL">Stills</option>
                  <option value="VIDEO">Videos</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Decision</label>
                <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)} data-testid="lessons-filter-decision">
                  <option value="ALL">All</option>
                  <option value="DISCARD">Discard</option>
                  <option value="KEEP">Keep</option>
                  <option value="FINAL">Final</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Model</label>
                <select value={filterModel} onChange={e => setFilterModel(e.target.value)} data-testid="lessons-filter-model">
                  <option>All</option>
                  {MODELS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="empty-state">No iterations match the filters.</div>
            ) : groups.map(g => {
              const key = `${g.model}__${g.location}`;
              const isOpen = openKey === key || openKey === "ALL";
              return (
                <div key={key} className="lesson-group" data-testid={`lesson-group-${g.model}-${g.location}`}>
                  <div className="lesson-group-head" onClick={() => setOpenKey(isOpen && openKey !== "ALL" ? null : key)}>
                    <div className="left">
                      <span className="model">{g.model}</span>
                      <span className="loc">· {g.location}</span>
                    </div>
                    <div className="counts">
                      {g.counts.DISCARD > 0 && <span className="count-pill" data-decision="DISCARD">{g.counts.DISCARD} discard</span>}
                      {g.counts.KEEP > 0 && <span className="count-pill" data-decision="KEEP">{g.counts.KEEP} keep</span>}
                      {g.counts.FINAL > 0 && <span className="count-pill" data-decision="FINAL">{g.counts.FINAL} final</span>}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="lesson-group-body">
                      {g.iterations.map(it => (
                        <div key={it.id} className="lesson-entry">
                          <div className="head">
                            <span
                              className="shot-link"
                              onClick={() => navigate(`/films/${filmId}/shots/${it.shot_id}`)}
                            >Shot {it.shot_number}</span>
                            <span>· attempt #{it.attempt_number}</span>
                            <span className={`kind-badge ${(it.kind || "VIDEO") === "STILL" ? "still" : "video"}`}>{it.kind || "VIDEO"}</span>
                            <span className="decision-pill" data-decision={it.decision}>{it.decision}</span>
                          </div>
                          <div className="pair">
                            <div className="fb failed"><span className="lbl">Failed</span>{it.what_failed}</div>
                            <div className="fb worked"><span className="lbl">Worked</span>{it.what_worked}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
