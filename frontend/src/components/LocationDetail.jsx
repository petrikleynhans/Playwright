import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import FilmSubNav from "./FilmSubNav";
import { fileToCompressedDataURL } from "../lib/utils";

function useDebouncedSave(saveFn, delay = 800) {
  const t = useRef(null);
  return (data) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => { saveFn(data); }, delay);
  };
}

export default function LocationDetail() {
  const { filmId, locId } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [loc, setLoc] = useState(null);
  const [shots, setShots] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [f, l, s] = await Promise.all([
        api.getFilm(filmId),
        api.getLocation(locId),
        api.shotsForLocation(locId),
      ]);
      setFilm(f); setLoc(l); setShots(s);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locId]);

  const save = async (patch) => {
    try {
      const updated = await api.updateLocation(locId, patch);
      setLoc(updated); setSavedAt(new Date());
    } catch (e) { console.error(e); }
  };
  const debouncedSave = useDebouncedSave(save);
  const update = (key, val) => {
    setLoc(l => ({ ...l, [key]: val }));
    debouncedSave({ [key]: val });
  };

  const onAddRef = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newOnes = [];
    for (const f of files) {
      newOnes.push(await fileToCompressedDataURL(f, 1600, 0.85));
    }
    const updated = [...(loc.reference_images || []), ...newOnes];
    setLoc(l => ({ ...l, reference_images: updated }));
    await save({ reference_images: updated });
    e.target.value = "";
  };

  const removeRef = async (idx) => {
    const updated = (loc.reference_images || []).filter((_, i) => i !== idx);
    setLoc(l => ({ ...l, reference_images: updated }));
    await save({ reference_images: updated });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    await api.deleteLocation(locId);
    navigate(`/films/${filmId}/locations`);
  };

  if (loading || !loc) return <div className="app-shell"><FilmSubNav filmId={filmId} film={film} /><div className="grid-page"><div className="empty-state">Loading…</div></div></div>;

  return (
    <div className="app-shell">
      <FilmSubNav filmId={filmId} film={film} />
      <div className="grid-page">
        <div className="page-title">
          <div>
            <a onClick={() => navigate(`/films/${filmId}/locations`)} style={{ fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>← Locations</a>
            <h2 style={{ marginTop: 4 }} data-testid="location-name">{loc.name}</h2>
            <div className="sub">{loc.int_ext}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedAt && <span style={{ fontSize: 11, color: "var(--text-3)" }}>Saved · {savedAt.toLocaleTimeString()}</span>}
            <button className="btn ghost" onClick={handleDelete} data-testid="location-delete-btn" style={{ color: "var(--status-discard)" }}>Delete</button>
          </div>
        </div>

        <div className="entity-detail">
          <div className="entity-side">
            <div className="field">
              <label>Name</label>
              <input value={loc.name} onChange={e => update("name", e.target.value)} />
            </div>
            <div className="field">
              <label>INT/EXT</label>
              <select value={loc.int_ext || "INT"} onChange={e => update("int_ext", e.target.value)}>
                <option>INT</option><option>EXT</option>
              </select>
            </div>
            <div className="field">
              <label>Reference Images <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({(loc.reference_images || []).length})</span></label>
              <button className="btn" style={{ width: "100%" }} onClick={() => document.getElementById("loc-ref-input").click()}>+ Add reference images</button>
              <input id="loc-ref-input" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onAddRef} />
              <div className="refs-grid">
                {(loc.reference_images || []).map((src, idx) => (
                  <div key={idx} className="ref-img">
                    <img src={src} alt={`ref ${idx}`} />
                    <button className="remove-ref" onClick={() => removeRef(idx)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="spec-section-title">Used in {shots.length} shot{shots.length === 1 ? "" : "s"}</div>
            {shots.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>No shots linked yet. Edit a shot to set this as its location.</div>
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

          <div className="entity-main">
            <div className="field">
              <label>Visual Grammar (Locked)</label>
              <textarea
                className="mono"
                rows={6}
                value={loc.visual_grammar || ""}
                onChange={e => update("visual_grammar", e.target.value)}
                placeholder="e.g. urban waterfront promenade, city skyline backdrop, overcast diffuse light, no golden hour, no dramatic sky..."
                data-testid="location-grammar"
              />
            </div>
            <div className="field">
              <label>Lighting Notes</label>
              <textarea
                rows={3}
                value={loc.lighting_notes || ""}
                onChange={e => update("lighting_notes", e.target.value)}
                placeholder="Source, direction, quality, colour temp, shadow behaviour."
              />
            </div>
            <div className="field">
              <label>Sound Notes</label>
              <textarea
                rows={3}
                value={loc.sound_notes || ""}
                onChange={e => update("sound_notes", e.target.value)}
                placeholder="Ambient bed, signature sounds, room tone..."
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea
                rows={3}
                value={loc.notes || ""}
                onChange={e => update("notes", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
