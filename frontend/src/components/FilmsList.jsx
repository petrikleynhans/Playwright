import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { daysUntil, formatDate } from "../lib/utils";
import NewFilmModal from "./NewFilmModal";

export default function FilmsList() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listFilms();
      setFilms(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (payload) => {
    const film = await api.createFilm(payload);
    setShowNew(false);
    navigate(`/films/${film.id}`);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this film and all its shots and iterations?")) return;
    await api.deleteFilm(id);
    load();
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-title">
          <h1 className="mono">FILM TRACKER</h1>
          <span className="sub">Iteration journal · production layer</span>
        </div>
      </div>

      <div className="films-page">
        <h2>Films</h2>
        <div className="films-grid" data-testid="films-grid">
          {films.map(f => {
            const days = daysUntil(f.deadline);
            return (
              <div
                key={f.id}
                className="film-card"
                onClick={() => navigate(`/films/${f.id}`)}
                data-testid={`film-card-${f.title.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <button className="delete-btn" onClick={(e) => handleDelete(e, f.id)} title="Delete film" data-testid="film-delete-btn">✕</button>
                <h3 className="title">{f.title}</h3>
                {f.description && <p className="desc">{f.description}</p>}
                <div className="meta">
                  {f.deadline && (
                    <span><strong>{formatDate(f.deadline)}</strong> {days !== null && (days >= 0 ? `· ${days}d left` : `· ${Math.abs(days)}d overdue`)}</span>
                  )}
                  {f.total_shots > 0 && <span><strong>{f.total_shots}</strong> shots</span>}
                  <span style={{ color: f.status === "COMPLETE" ? "var(--status-final)" : "var(--status-progress)" }}>{f.status}</span>
                </div>
              </div>
            );
          })}
          <div className="new-film-card" onClick={() => setShowNew(true)} data-testid="new-film-btn">
            + New Film
          </div>
        </div>
        {!loading && films.length === 0 && (
          <div className="empty-state" style={{ marginTop: 20 }}>
            No films yet. Create one to get started.
          </div>
        )}
      </div>

      {showNew && <NewFilmModal onClose={() => setShowNew(false)} onSaved={handleCreate} />}
    </div>
  );
}
