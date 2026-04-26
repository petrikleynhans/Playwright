import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, PROTOCOL_FIELDS } from "../lib/api";
import FilmSubNav from "./FilmSubNav";
import { fileToCompressedDataURL } from "../lib/utils";

const SOUL_ID_OPTIONS = ["NOT SET", "GENERATED", "LOCKED"];

function useDebouncedSave(saveFn, delay = 800) {
  const t = useRef(null);
  return (data) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => { saveFn(data); }, delay);
  };
}

export default function CharacterDetail() {
  const { filmId, charId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [character, setCharacter] = useState(null);
  const [shots, setShots] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [f, c, s] = await Promise.all([
        api.getFilm(filmId),
        api.getCharacter(charId),
        api.shotsForCharacter(charId),
      ]);
      setFilm(f); setCharacter(c); setShots(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [charId]);

  const save = async (patch) => {
    try {
      const updated = await api.updateCharacter(charId, patch);
      setCharacter(updated);
      setSavedAt(new Date());
    } catch (e) { console.error(e); }
  };
  const debouncedSave = useDebouncedSave(save);

  const update = (key, val) => {
    setCharacter(c => ({ ...c, [key]: val }));
    debouncedSave({ [key]: val });
  };

  const onSoulIdChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToCompressedDataURL(file, 1600, 0.85);
    setCharacter(c => ({ ...c, soul_id_image: dataUrl }));
    await save({ soul_id_image: dataUrl });
  };

  const onAddRef = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newOnes = [];
    for (const f of files) {
      newOnes.push(await fileToCompressedDataURL(f, 1600, 0.85));
    }
    const updated = [...(character.reference_images || []), ...newOnes];
    setCharacter(c => ({ ...c, reference_images: updated }));
    await save({ reference_images: updated });
    e.target.value = "";
  };

  const removeRef = async (idx) => {
    const updated = (character.reference_images || []).filter((_, i) => i !== idx);
    setCharacter(c => ({ ...c, reference_images: updated }));
    await save({ reference_images: updated });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete character "${character.name}"? This will not delete shots.`)) return;
    await api.deleteCharacter(charId);
    navigate(`/films/${filmId}/characters`);
  };

  if (loading || !character) return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />
      <div className="grid-page">
        <div className="page-title">
          <div>
            <a onClick={() => navigate(`/films/${filmId}/characters`)} style={{ fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>← Characters</a>
            <h2 style={{ marginTop: 4 }} data-testid="character-name">{character.name}</h2>
            <div className="sub">{character.role_summary || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedAt && <span style={{ fontSize: 11, color: "var(--text-3)" }}>Saved · {savedAt.toLocaleTimeString()}</span>}
            <button className="btn ghost" onClick={handleDelete} data-testid="character-delete-btn" style={{ color: "var(--status-discard)" }}>Delete</button>
          </div>
        </div>

        <div className="entity-detail">
          {/* SIDE */}
          <div className="entity-side">
            <div className="field">
              <label>Name</label>
              <input value={character.name} onChange={e => update("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Role / Summary</label>
              <input value={character.role_summary || ""} onChange={e => update("role_summary", e.target.value)} />
            </div>
            <div className="field">
              <label>Soul ID Status</label>
              <select value={character.soul_id_status} onChange={e => update("soul_id_status", e.target.value)} data-testid="soul-id-select">
                {SOUL_ID_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Soul ID Anchor</label>
              <div className="dropzone" onClick={() => document.getElementById("soul-id-input").click()}>
                <input id="soul-id-input" type="file" accept="image/*" style={{ display: "none" }} onChange={onSoulIdChange} />
                {character.soul_id_image ? (
                  <>
                    <img src={character.soul_id_image} alt="soul id" style={{ maxHeight: 240 }} />
                    <button className="remove" onClick={(e) => { e.stopPropagation(); update("soul_id_image", null); }}>Remove</button>
                  </>
                ) : <div>Click to upload anchor image</div>}
              </div>
            </div>

            <div className="field">
              <label>Reference Images <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({(character.reference_images || []).length})</span></label>
              <button className="btn" style={{ width: "100%" }} onClick={() => document.getElementById("ref-input").click()}>+ Add reference images</button>
              <input id="ref-input" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onAddRef} />
              <div className="refs-grid">
                {(character.reference_images || []).map((src, idx) => (
                  <div key={idx} className="ref-img">
                    <img src={src} alt={`ref ${idx}`} />
                    <button className="remove-ref" onClick={() => removeRef(idx)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="spec-section-title">Appears in {shots.length} shot{shots.length === 1 ? "" : "s"}</div>
            {shots.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>No shots linked yet. Edit a shot to add this character.</div>
            ) : (
              <div className="chips">
                {shots.map(s => (
                  <span key={s.id} className="chip" onClick={() => navigate(`/films/${filmId}/shots/${s.id}`)} title={s.action_summary}>
                    {s.shot_number}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* MAIN: 19-field protocol */}
          <div className="entity-main">
            <h3 style={{ marginTop: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-2)", fontWeight: 600 }}>
              19-Field Protocol
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 0 }}>
              Lock all 19 drift vectors before any prompt is generated. Auto-saves on edit.
            </p>
            <div className="protocol-grid">
              {PROTOCOL_FIELDS.map((f, idx) => (
                <div key={f.key} className="protocol-row">
                  <div className="lbl">
                    <span className="num mono">{String(idx + 1).padStart(2, "0")}</span>
                    {f.label}
                    <span className="hint">{f.hint}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={character[f.key] || ""}
                    onChange={e => update(f.key, e.target.value)}
                    placeholder={f.label}
                    data-testid={`protocol-${f.key}`}
                  />
                </div>
              ))}
            </div>

            <div className="protocol-row" style={{ marginTop: 14 }}>
              <div className="lbl">Notes <span className="hint">Free-form</span></div>
              <textarea rows={3} value={character.notes || ""} onChange={e => update("notes", e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
