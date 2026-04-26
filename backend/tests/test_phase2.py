"""Phase 2 tests: import (CSV/Markdown), lessons aggregation, characters, locations, shot linking."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def temp_film(session):
    f = session.post(f"{API}/films", json={"title": "TEST_Phase2_Film"}).json()
    yield f
    session.delete(f"{API}/films/{f['id']}")


@pytest.fixture(scope="module")
def unseen_film(session):
    films = session.get(f"{API}/films").json()
    return next(f for f in films if f["title"] == "Unseen")


# ---------------- Import ----------------
class TestImport:
    def test_markdown_import_creates_shots(self, session, temp_film):
        md = (
            "| Shot # | Filename | Model | Location | Shot Type | Action / Subject | Emotion (0\u201310) |\n"
            "|---|---|---|---|---|---|---|\n"
            "| TEST_001 | T_001.mp4 | Kling 3.0 | Test Loc | MS | A subject moves | 7 |\n"
            "| TEST_002 | T_002.mp4 | Veo 3.1 Fast | Test Loc | CU | Close on hands | 4 |\n"
        )
        r = session.post(f"{API}/films/{temp_film['id']}/import", json={"text": md})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["format"] == "markdown"
        assert body["created"] == 2
        assert body["updated"] == 0

        shots = session.get(f"{API}/films/{temp_film['id']}/shots").json()
        nums = sorted(s["shot_number"] for s in shots)
        assert nums == ["TEST_001", "TEST_002"]
        s1 = next(s for s in shots if s["shot_number"] == "TEST_001")
        assert s1["model_assigned"] == "Kling 3.0"
        assert s1["shot_type"] == "MS"
        assert s1["location"] == "Test Loc"
        assert s1["action_summary"] == "A subject moves"
        assert s1["emotion_level"] == 7

    def test_csv_import_works(self, session, temp_film):
        csv_text = (
            "Shot #,Filename,Model,Location,Shot Type,Action / Subject\n"
            "TEST_C01,c01.mp4,WAN 2.6,CSV Loc,WS,Action one\n"
            "TEST_C02,c02.mp4,Sora 2,CSV Loc,ECU,Action two\n"
        )
        r = session.post(f"{API}/films/{temp_film['id']}/import", json={"text": csv_text})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["format"] == "csv"
        assert body["created"] == 2

    def test_import_upserts_existing(self, session, temp_film):
        md1 = (
            "| Shot # | Model | Shot Type | Action / Subject |\n"
            "|---|---|---|---|\n"
            "| TEST_UP1 | Kling 3.0 | MS | initial |\n"
        )
        r1 = session.post(f"{API}/films/{temp_film['id']}/import", json={"text": md1})
        assert r1.json()["created"] == 1

        md2 = (
            "| Shot # | Model | Shot Type | Action / Subject |\n"
            "|---|---|---|---|\n"
            "| TEST_UP1 | Veo 3.1 Fast | CU | UPDATED |\n"
        )
        r2 = session.post(f"{API}/films/{temp_film['id']}/import", json={"text": md2})
        body = r2.json()
        assert body["created"] == 0
        assert body["updated"] == 1

        shots = session.get(f"{API}/films/{temp_film['id']}/shots").json()
        s = next(s for s in shots if s["shot_number"] == "TEST_UP1")
        assert s["model_assigned"] == "Veo 3.1 Fast"
        assert s["shot_type"] == "CU"
        assert s["action_summary"] == "UPDATED"

    def test_tolerant_column_aliases(self, session, temp_film):
        md = (
            "| # | Type | Setting | Subject |\n"
            "|---|---|---|---|\n"
            "| TEST_ALIAS | ECU | Bedroom | woman at window |\n"
        )
        r = session.post(f"{API}/films/{temp_film['id']}/import", json={"text": md})
        assert r.status_code == 200, r.text
        assert r.json()["created"] == 1
        shots = session.get(f"{API}/films/{temp_film['id']}/shots").json()
        s = next(s for s in shots if s["shot_number"] == "TEST_ALIAS")
        assert s["shot_type"] == "ECU"
        assert s["location"] == "Bedroom"
        assert s["action_summary"] == "woman at window"

    def test_import_film_not_found(self, session):
        r = session.post(f"{API}/films/nope-id/import", json={"text": "no"})
        assert r.status_code == 404


# ---------------- Lessons ----------------
class TestLessons:
    def test_lessons_groups_and_summary(self, session, temp_film):
        # Create 2 shots in 2 locations; add iterations w/ varied models & decisions
        s1 = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "01", "act": "ACT 1", "model_assigned": "Kling 3.0",
            "shot_type": "MS", "location": "Bedroom"
        }).json()
        s2 = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "02", "act": "ACT 1", "model_assigned": "Veo 3.1 Fast",
            "shot_type": "CU", "location": "Street"
        }).json()
        # Bedroom + Kling: 1 KEEP + 1 DISCARD
        for dec in ["KEEP", "DISCARD"]:
            session.post(f"{API}/shots/{s1['id']}/iterations", json={
                "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "f",
                "what_worked": "w", "decision": dec
            })
        # Street + Veo: 1 FINAL
        session.post(f"{API}/shots/{s2['id']}/iterations", json={
            "model_used": "Veo 3.1 Fast", "prompt_text": "p", "what_failed": "f",
            "what_worked": "w", "decision": "FINAL"
        })

        r = session.get(f"{API}/films/{temp_film['id']}/lessons")
        assert r.status_code == 200
        body = r.json()
        assert body["summary"]["total_iterations"] == 3
        assert body["summary"]["by_decision"]["KEEP"] == 1
        assert body["summary"]["by_decision"]["DISCARD"] == 1
        assert body["summary"]["by_decision"]["FINAL"] == 1
        assert body["summary"]["by_model"]["Kling 3.0"] == 2
        assert body["summary"]["by_model"]["Veo 3.1 Fast"] == 1

        groups = body["groups"]
        keys = {(g["model"], g["location"]) for g in groups}
        assert ("Kling 3.0", "Bedroom") in keys
        assert ("Veo 3.1 Fast", "Street") in keys
        bedroom = next(g for g in groups if g["location"] == "Bedroom")
        assert bedroom["counts"]["KEEP"] == 1
        assert bedroom["counts"]["DISCARD"] == 1
        assert len(bedroom["iterations"]) == 2

    def test_lessons_empty(self, session):
        f = session.post(f"{API}/films", json={"title": "TEST_LessonsEmpty"}).json()
        try:
            r = session.get(f"{API}/films/{f['id']}/lessons")
            assert r.status_code == 200
            assert r.json()["groups"] == []
        finally:
            session.delete(f"{API}/films/{f['id']}")


# ---------------- Characters ----------------
class TestCharacters:
    def test_create_lists_defaults(self, session, temp_film):
        r = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_Hero"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == "TEST_Hero"
        assert c["soul_id_status"] == "NOT SET"
        # All 19 protocol fields exist and are blank by default
        for field in [
            "subject", "emotion", "environment_setting", "clothing", "lighting_weather",
            "camera_angle_framing", "lens_characteristics", "eye_details", "skin_textures",
            "mouth_lips", "hair", "atmospheric_texture", "color_palette", "processing_style",
            "framing", "emotional_impact", "extras_props", "composition_notes", "negative_prompt",
        ]:
            assert field in c, f"Missing protocol field {field}"
            assert c[field] == ""
        assert c["reference_images"] == []

        # List
        rl = session.get(f"{API}/films/{temp_film['id']}/characters")
        assert rl.status_code == 200
        names = [x["name"] for x in rl.json()]
        assert "TEST_Hero" in names

    def test_patch_updates_protocol_and_images(self, session, temp_film):
        c = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_Pat"}).json()
        update = {
            "subject": "woman at window",
            "eye_details": "hazel, single catchlight",
            "negative_prompt": "no smiling",
            "soul_id_status": "GENERATED",
            "soul_id_image": TINY_PNG,
            "reference_images": [TINY_PNG, TINY_PNG],
        }
        r = session.patch(f"{API}/characters/{c['id']}", json=update)
        assert r.status_code == 200
        upd = r.json()
        assert upd["subject"] == "woman at window"
        assert upd["eye_details"] == "hazel, single catchlight"
        assert upd["soul_id_status"] == "GENERATED"
        assert len(upd["reference_images"]) == 2

        # Verify persistence
        g = session.get(f"{API}/characters/{c['id']}").json()
        assert g["subject"] == "woman at window"
        assert g["soul_id_image"] == TINY_PNG

    def test_delete_pulls_from_shot_character_ids(self, session, temp_film):
        c = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_Del"}).json()
        s = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "C01", "act": "ACT 1", "model_assigned": "Kling 3.0",
            "shot_type": "MS", "character_ids": [c["id"]]
        }).json()
        assert c["id"] in s["character_ids"]

        d = session.delete(f"{API}/characters/{c['id']}")
        assert d.status_code == 200
        s2 = session.get(f"{API}/shots/{s['id']}").json()
        assert c["id"] not in s2["character_ids"]
        # Character is gone
        assert session.get(f"{API}/characters/{c['id']}").status_code == 404

    def test_shots_for_character(self, session, temp_film):
        c = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_ShotChar"}).json()
        s = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "CSHOT1", "act": "ACT 1", "model_assigned": "Kling 3.0",
            "shot_type": "MS", "character_ids": [c["id"]]
        }).json()
        r = session.get(f"{API}/characters/{c['id']}/shots")
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert s["id"] in ids


# ---------------- Locations ----------------
class TestLocations:
    def test_crud_and_shot_clear(self, session, temp_film):
        loc = session.post(f"{API}/films/{temp_film['id']}/locations", json={
            "name": "TEST_Loc", "visual_grammar": "low key", "lighting_notes": "north window"
        }).json()
        assert loc["name"] == "TEST_Loc"
        assert loc["visual_grammar"] == "low key"

        # patch
        u = session.patch(f"{API}/locations/{loc['id']}", json={
            "sound_notes": "rain", "reference_images": [TINY_PNG]
        }).json()
        assert u["sound_notes"] == "rain"
        assert u["reference_images"] == [TINY_PNG]

        # list
        lst = session.get(f"{API}/films/{temp_film['id']}/locations").json()
        assert any(x["id"] == loc["id"] for x in lst)

        # link to shot
        s = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "L01", "act": "ACT 1", "model_assigned": "Kling 3.0",
            "shot_type": "MS", "location_id": loc["id"]
        }).json()
        # shots-for-location
        rl = session.get(f"{API}/locations/{loc['id']}/shots").json()
        assert any(x["id"] == s["id"] for x in rl)

        # delete: clears location_id from shots
        d = session.delete(f"{API}/locations/{loc['id']}")
        assert d.status_code == 200
        s2 = session.get(f"{API}/shots/{s['id']}").json()
        assert s2["location_id"] is None
        assert session.get(f"{API}/locations/{loc['id']}").status_code == 404


# ---------------- Shot patch character_ids/location_id ----------------
class TestShotLinking:
    def test_patch_shot_character_and_location(self, session, temp_film):
        c1 = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_C1"}).json()
        c2 = session.post(f"{API}/films/{temp_film['id']}/characters", json={"name": "TEST_C2"}).json()
        loc = session.post(f"{API}/films/{temp_film['id']}/locations", json={"name": "TEST_LOC2"}).json()

        s = session.post(f"{API}/films/{temp_film['id']}/shots", json={
            "shot_number": "P01", "act": "ACT 1", "model_assigned": "Kling 3.0", "shot_type": "MS"
        }).json()

        r = session.patch(f"{API}/shots/{s['id']}", json={
            "character_ids": [c1["id"], c2["id"]], "location_id": loc["id"]
        })
        assert r.status_code == 200
        upd = r.json()
        assert set(upd["character_ids"]) == {c1["id"], c2["id"]}
        assert upd["location_id"] == loc["id"]

        # Verify persisted
        g = session.get(f"{API}/shots/{s['id']}").json()
        assert g["location_id"] == loc["id"]
        assert len(g["character_ids"]) == 2


# ---------------- Cascade delete includes characters & locations ----------------
class TestCascadeDelete:
    def test_film_delete_removes_chars_and_locs(self, session):
        f = session.post(f"{API}/films", json={"title": "TEST_Cascade"}).json()
        c = session.post(f"{API}/films/{f['id']}/characters", json={"name": "TEST_CC"}).json()
        l = session.post(f"{API}/films/{f['id']}/locations", json={"name": "TEST_LL"}).json()

        d = session.delete(f"{API}/films/{f['id']}")
        assert d.status_code == 200
        assert session.get(f"{API}/characters/{c['id']}").status_code == 404
        assert session.get(f"{API}/locations/{l['id']}").status_code == 404


# ---------------- Unseen film integrity (no breakage) ----------------
class TestUnseenIntegrity:
    def test_unseen_still_41_shots(self, session, unseen_film):
        shots = session.get(f"{API}/films/{unseen_film['id']}/shots").json()
        assert len(shots) == 41
