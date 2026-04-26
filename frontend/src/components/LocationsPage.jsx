import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import FilmSubNav from "./FilmSubNav";

export default function LocationsPage() {
  const { filmId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIntExt, setNewIntExt] = useState("INT");

  const load = async () => {
    setLoading(true);
    try {
      const [f, l] = await Promise.all([api.getFilm(filmId), api.listLocations(filmId)]);
      setFilm(f); setLocations(l);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filmId]);

  const create = async () => {
    if (!newName.trim()) return;
    const l = await api.createLocation(filmId, { name: newName.trim(), int_ext: newIntExt });
    setShowNew(false);
    setNewName(""); setNewIntExt("INT");
    navigate(`/films/${filmId}/locations/${l.id}`);
  };

  if (loading) return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />
      <div className="grid-page">
        <div className="page-title">
          <div>
            <h2>Locations</h2>
            <div className="sub">Locked visual grammar per location. Reference images, lighting, sound notes.</div>
          </div>
          <button className="btn primary" onClick={() => setShowNew(true)} data-testid="new-location-btn">+ New Location</button>
        </div>

        {locations.length === 0 ? (
          <div className="cta-block">
            <h4>No locations yet</h4>
            <p>Lock visual grammar for each location to prevent drift across shots.</p>
            <button className="btn primary" onClick={() => setShowNew(true)}>+ New Location</button>
          </div>
        ) : (
          <div className="entity-grid" data-testid="locations-grid">
            {locations.map(l => (
              <div key={l.id} className="entity-card" onClick={() => navigate(`/films/${filmId}/locations/${l.id}`)} data-testid={`location-card-${l.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="thumb">
                  {l.reference_images && l.reference_images[0]
                    ? <img src={l.reference_images[0]} alt={l.name} />
                    : <div className="thumb-placeholder">No reference</div>}
                </div>
                <div className="body">
                  <h3>{l.name}</h3>
                  <div className="meta">{l.int_ext || ""}{l.int_ext && l.visual_grammar ? " · " : ""}{(l.visual_grammar || "").slice(0, 60)}{(l.visual_grammar || "").length > 60 ? "…" : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal small" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>New Location</h3>
              <button className="close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="field">
              <label>Name<span className="req">*</span></label>
              <input value={newName} onChange={e => setNewName(e.target.value)} data-testid="location-name-input" autoFocus />
            </div>
            <div className="field">
              <label>INT/EXT</label>
              <select value={newIntExt} onChange={e => setNewIntExt(e.target.value)}>
                <option>INT</option><option>EXT</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn primary" onClick={create} data-testid="location-create-btn">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
