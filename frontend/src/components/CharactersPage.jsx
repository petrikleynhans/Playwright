import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, PROTOCOL_FIELDS } from "../lib/api";
import FilmSubNav from "./FilmSubNav";
import { fileToCompressedDataURL } from "../lib/utils";

const SOUL_ID_OPTIONS = ["NOT SET", "GENERATED", "LOCKED"];

export default function CharactersPage() {
  const { filmId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [chars, setChars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([api.getFilm(filmId), api.listCharacters(filmId)]);
      setFilm(f);
      setChars(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filmId]);

  const create = async () => {
    if (!newName.trim()) return;
    const c = await api.createCharacter(filmId, { name: newName.trim(), role_summary: newRole });
    setShowNew(false);
    setNewName(""); setNewRole("");
    navigate(`/films/${filmId}/characters/${c.id}`);
  };

  if (loading) return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />
      <div className="grid-page">
        <div className="page-title">
          <div>
            <h2>Characters</h2>
            <div className="sub">Field-gated 19-field protocol per character. Locks all drift vectors before prompt generation.</div>
          </div>
          <button className="btn primary" onClick={() => setShowNew(true)} data-testid="new-character-btn">+ New Character</button>
        </div>

        {chars.length === 0 ? (
          <div className="cta-block">
            <h4>No characters yet</h4>
            <p>Add a character to lock the 19-field protocol before generating prompts.</p>
            <button className="btn primary" onClick={() => setShowNew(true)}>+ New Character</button>
          </div>
        ) : (
          <div className="entity-grid" data-testid="characters-grid">
            {chars.map(c => (
              <div key={c.id} className="entity-card" onClick={() => navigate(`/films/${filmId}/characters/${c.id}`)} data-testid={`character-card-${c.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="thumb">
                  {c.soul_id_image ? <img src={c.soul_id_image} alt={c.name} /> :
                    c.reference_images && c.reference_images[0] ? <img src={c.reference_images[0]} alt={c.name} /> :
                    <div className="thumb-placeholder">No anchor</div>}
                  <div className="soul-id-pill" data-status={c.soul_id_status}>Soul ID: {c.soul_id_status}</div>
                </div>
                <div className="body">
                  <h3>{c.name}</h3>
                  <div className="meta">{c.role_summary || "—"}</div>
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
              <h3>New Character</h3>
              <button className="close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="field">
              <label>Name<span className="req">*</span></label>
              <input value={newName} onChange={e => setNewName(e.target.value)} data-testid="character-name-input" autoFocus />
            </div>
            <div className="field">
              <label>Role / Summary</label>
              <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. The Woman / The Waiter / The Figure" />
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn primary" onClick={create} data-testid="character-create-btn">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
