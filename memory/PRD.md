# AI Film Production Tracker — PRD

## Original Problem Statement
Build the spec exactly as written: AI Film Production Tracker (Phase 1 narrow MVP) for Petri's solo AI short film workflow. Captures **failed prompt attempts alongside final approved ones** so learning compounds across productions. Source: `2026-04-26-ai-film-production-tracker-design.md`.

Build sequence (per spec): data model → shot grid → shot detail → add iteration → thumbnail promotion → status auto-update → seed data → polish.

## User Persona
- Petri (solo). Runs AI short film production using Kling, Veo, WAN, Sora, Seedream, Flux. Currently using markdown system in Claude Code (scripts, shot lists, SOPs). The app is the **visual production tracking layer** — not a replacement for the markdown spec system.

## Architecture
- **Backend:** FastAPI + MongoDB (motor async). Pydantic models, UUID ids, ISO datetime strings.
- **Frontend:** React 19 + react-router-dom. Pure CSS (no Tailwind UI for this — functional dark theme per spec).
- **Storage:** Thumbnails as base64 data URLs in MongoDB iteration documents. Client-side resize to 1600px max, JPEG q=0.85. 8MB upload cap. Per-doc Mongo limit 16MB.
- **No auth** (solo app).
- **Routing:**
  - `/` — Films list
  - `/films/:filmId` — Shot Grid
  - `/films/:filmId/shots/:shotId` — Shot Detail (with Add Iteration modal)

## Core Data Model
- **Film:** id, title, description, deadline, total_shots, status (IN PRODUCTION / COMPLETE)
- **Shot:** id, film_id, shot_number, sort_key, act, filename, model_assigned, shot_type, location, int_ext, time_of_day, framing, action_summary, emotion_level (0–10), camera, audio_notes, special_notes, duration, status (NOT STARTED / IN PROGRESS / FINAL / CUT), current_thumbnail (base64), attempt_count
- **Iteration:** id, shot_id, attempt_number (auto), created_at, model_used, prompt_text, thumbnail (base64), what_failed (required), what_worked (required), decision (DISCARD / KEEP / FINAL), notes

## Status Auto-Update Logic
- Iteration with decision=FINAL → shot.status = FINAL, current_thumbnail promoted from iteration thumbnail.
- Iteration with DISCARD/KEEP from a NOT STARTED shot → IN PROGRESS.
- FINAL or CUT shots are not auto-downgraded.
- Manual override available via Status dropdown on detail screen.

## What's Been Implemented (2026-04-26)
- ✅ Stage 1: Data model + Pydantic schemas + MongoDB collections
- ✅ Stage 2: Shot Grid with header (deadline countdown, progress summary), filters (Act/Model/Status), natural-sort ordering (01, 07A, 07B, 21, 21A, 21B…)
- ✅ Stage 3: Shot Detail two-column layout (spec left, iteration log right)
- ✅ Stage 4: Add Iteration modal with required-field validation, drag-and-drop image upload with client-side resize
- ✅ Stage 5: Thumbnail promotion on FINAL decision
- ✅ Stage 6: Status auto-update logic + manual override
- ✅ Stage 7: Auto-seed "Unseen" film + 41 shots on first launch (statuses from PROGRESS.md: 13 FINAL, 6 IN PROGRESS, 21 NOT STARTED, 1 CUT)
- ✅ Stage 8: Dark theme polish — IBM Plex Sans + JetBrains Mono, status color system per spec (#4ade80/#facc15/#555/#f87171), monospace prompt fields, no decorative elements
- ✅ Multi-film support (user requested) — Films list page with create/delete, supports adding new films and shots manually

## Test Status
- Backend: 15/15 pytest cases pass (CRUD + cascade, ordering, status distribution, iteration validation, attempt counter, thumbnail promotion, FINAL not auto-downgraded)
- Frontend: full Playwright flow covering all 6 spec verification points passed
- Test suite at `/app/backend/tests/test_film_tracker.py`

## Phase 2 / Future Backlog (per spec)
- P2: Character library (per-character: reference images, Soul ID, 19-field protocol, shots-they-appear-in)
- P2: Location library (visual grammar lock, shots-using-location)
- P2: Production dashboard (acts progress bars, model credit usage, days-to-deadline aggregate)
- P2: Cross-linking (shots ↔ characters ↔ locations)

## Phase 1 Backlog (smaller niceties not in spec)
- P1: CSV/JSON import for new films' shot lists (currently manual via "+ New Shot")
- P1: Bulk shot status update tool
- P1: Loading skeleton on FilmsList (brief flash of empty grid before fetch resolves)
- P1: Edit shot spec fields directly from detail screen (currently only status is editable)

## Known Constraints
- Per-iteration thumbnail capped at ~10MB after base64 encoding to stay under Mongo's 16MB document limit. Resize is client-side; full-bleed video frames may need filesystem storage in future.

## Endpoints
```
GET    /api/films
POST   /api/films
GET    /api/films/{id}
PATCH  /api/films/{id}
DELETE /api/films/{id}                 # cascades shots + iterations
GET    /api/films/{id}/shots
POST   /api/films/{id}/shots
GET    /api/shots/{id}
PATCH  /api/shots/{id}
DELETE /api/shots/{id}                 # cascades iterations
GET    /api/shots/{id}/iterations
POST   /api/shots/{id}/iterations      # auto-promotes on FINAL, auto-bumps status
DELETE /api/iterations/{id}            # decrements attempt_count
POST   /api/seed/unseen                # idempotent — only seeds if no films exist
```
