import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function FilmSubNav({ filmId, film }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const isActive = (suffix) => {
    const expected = suffix === "" ? `/films/${filmId}` : `/films/${filmId}/${suffix}`;
    if (suffix === "") return loc.pathname === expected;
    return loc.pathname.startsWith(expected);
  };

  const items = [
    { key: "", label: "Shots" },
    { key: "lessons", label: "Lessons" },
    { key: "characters", label: "Characters" },
    { key: "locations", label: "Locations" },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          <h1 className="mono" style={{ cursor: "pointer" }} onClick={() => navigate("/")} data-testid="topbar-home">FILM TRACKER</h1>
          <span className="sub">/ {film?.title || "…"}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={() => navigate("/")} data-testid="back-films-btn">← Films</button>
        </div>
      </div>
      <div className="subnav">
        {items.map(it => (
          <a
            key={it.key}
            className={isActive(it.key) ? "active" : ""}
            onClick={() => navigate(it.key === "" ? `/films/${filmId}` : `/films/${filmId}/${it.key}`)}
            data-testid={`subnav-${it.key || "shots"}`}
          >{it.label}</a>
        ))}
      </div>
    </>
  );
}
