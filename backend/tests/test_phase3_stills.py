"""Phase 3 tests: Iteration kind (STILL/VIDEO), still_count, current_still, lessons.kind."""
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
    f = session.post(f"{API}/films", json={"title": "TEST_Phase3_Stills"}).json()
    yield f
    session.delete(f"{API}/films/{f['id']}")


@pytest.fixture
def temp_shot(session, temp_film):
    s = session.post(f"{API}/films/{temp_film['id']}/shots", json={
        "shot_number": "01", "act": "ACT 1", "model_assigned": "Kling 3.0",
        "shot_type": "MS", "location": "Bedroom"
    }).json()
    return s


# ---------- Shot defaults ----------
class TestShotStillFields:
    def test_new_shot_has_still_fields(self, temp_shot):
        assert temp_shot["still_count"] == 0
        assert temp_shot["current_still"] is None
        assert temp_shot["attempt_count"] == 0


# ---------- STILL iteration creation ----------
class TestCreateStillIteration:
    def test_still_increments_still_count_not_attempt(self, session, temp_shot):
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "STILL",
            "model_used": "Seedream 5.0 Lite",
            "prompt_text": "still p",
            "what_failed": "f",
            "what_worked": "w",
            "decision": "KEEP",
        })
        assert r.status_code == 200, r.text
        it = r.json()
        assert it["kind"] == "STILL"
        assert it["attempt_number"] == 1

        s = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s["still_count"] == 1
        assert s["attempt_count"] == 0
        # KEEP changes status from NOT STARTED -> IN PROGRESS (existing behavior)
        assert s["status"] == "IN PROGRESS"

    def test_still_final_promotes_current_still_not_status(self, session, temp_shot):
        # mark shot as NOT STARTED initially
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "STILL",
            "model_used": "Flux 1.1",
            "prompt_text": "p",
            "thumbnail": TINY_PNG,
            "what_failed": "f",
            "what_worked": "w",
            "decision": "FINAL",
        })
        assert r.status_code == 200, r.text
        it = r.json()
        assert it["kind"] == "STILL"

        s = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s["current_still"] == TINY_PNG
        assert s["current_thumbnail"] is None
        # STILL FINAL should NOT make shot status FINAL
        assert s["status"] != "FINAL"

    def test_still_attempt_number_independent_of_video(self, session, temp_shot):
        # Add 2 video iterations first
        for _ in range(2):
            session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
                "kind": "VIDEO", "model_used": "Kling 3.0", "prompt_text": "p",
                "what_failed": "f", "what_worked": "w", "decision": "KEEP",
            })
        # First still on this shot must be attempt #1, not #3
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "STILL", "model_used": "Seedream 5.0 Lite", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        })
        it = r.json()
        assert it["attempt_number"] == 1
        s = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s["still_count"] == 1
        assert s["attempt_count"] == 2


# ---------- VIDEO iteration backwards compatibility ----------
class TestCreateVideoIteration:
    def test_video_default_when_kind_omitted(self, session, temp_shot):
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        })
        assert r.status_code == 200, r.text
        it = r.json()
        assert it["kind"] == "VIDEO"
        s = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s["attempt_count"] == 1
        assert s["still_count"] == 0

    def test_video_final_sets_status_final_and_thumbnail(self, session, temp_shot):
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "VIDEO", "model_used": "Kling 3.0", "prompt_text": "p",
            "thumbnail": TINY_PNG,
            "what_failed": "f", "what_worked": "w", "decision": "FINAL",
        })
        assert r.status_code == 200, r.text
        s = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s["status"] == "FINAL"
        assert s["current_thumbnail"] == TINY_PNG
        assert s["current_still"] is None


# ---------- Listing with kind filter ----------
class TestListIterationsKindFilter:
    def test_filter_by_kind(self, session, temp_shot):
        # Create 2 stills + 1 video
        for _ in range(2):
            session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
                "kind": "STILL", "model_used": "Seedream 5.0 Lite", "prompt_text": "p",
                "what_failed": "f", "what_worked": "w", "decision": "KEEP",
            })
        session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "VIDEO", "model_used": "Kling 3.0", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        })
        all_its = session.get(f"{API}/shots/{temp_shot['id']}/iterations").json()
        assert len(all_its) == 3
        stills = session.get(f"{API}/shots/{temp_shot['id']}/iterations?kind=STILL").json()
        assert len(stills) == 2
        assert all(it["kind"] == "STILL" for it in stills)
        videos = session.get(f"{API}/shots/{temp_shot['id']}/iterations?kind=VIDEO").json()
        assert len(videos) == 1
        assert videos[0]["kind"] == "VIDEO"


# ---------- Delete decrements per-kind counter ----------
class TestDeleteIterationCounter:
    def test_delete_still_decrements_still_count(self, session, temp_shot):
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "STILL", "model_used": "Seedream 5.0 Lite", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        }).json()
        s_before = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s_before["still_count"] == 1

        d = session.delete(f"{API}/iterations/{r['id']}")
        assert d.status_code == 200
        s_after = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s_after["still_count"] == 0
        assert s_after["attempt_count"] == 0

    def test_delete_video_decrements_attempt_count(self, session, temp_shot):
        r = session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "VIDEO", "model_used": "Kling 3.0", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        }).json()
        s_before = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s_before["attempt_count"] == 1
        session.delete(f"{API}/iterations/{r['id']}")
        s_after = session.get(f"{API}/shots/{temp_shot['id']}").json()
        assert s_after["attempt_count"] == 0


# ---------- Lessons include kind ----------
class TestLessonsIncludeKind:
    def test_lessons_iterations_include_kind(self, session, temp_film, temp_shot):
        # create one STILL + one VIDEO iteration
        session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "STILL", "model_used": "Seedream 5.0 Lite", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        })
        session.post(f"{API}/shots/{temp_shot['id']}/iterations", json={
            "kind": "VIDEO", "model_used": "Kling 3.0", "prompt_text": "p",
            "what_failed": "f", "what_worked": "w", "decision": "KEEP",
        })
        r = session.get(f"{API}/films/{temp_film['id']}/lessons")
        body = r.json()
        kinds_seen = set()
        for g in body["groups"]:
            for it in g["iterations"]:
                assert "kind" in it
                kinds_seen.add(it["kind"])
        assert "STILL" in kinds_seen
        assert "VIDEO" in kinds_seen


# ---------- Unseen integrity ----------
class TestUnseenIntegrity:
    def test_unseen_shots_have_still_fields(self, session):
        films = session.get(f"{API}/films").json()
        unseen = next(f for f in films if f["title"] == "Unseen")
        shots = session.get(f"{API}/films/{unseen['id']}/shots").json()
        assert len(shots) == 41
        # All shots should have still fields with safe defaults
        for s in shots:
            assert "still_count" in s
            assert "current_still" in s
            assert s["still_count"] == 0 or isinstance(s["still_count"], int)
