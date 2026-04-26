"""Backend tests for AI Film Production Tracker.
Covers: Films, Shots, Iterations CRUD, status auto-update logic, ordering, validation.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stage-confirm.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def unseen_film(session):
    r = session.get(f"{API}/films")
    assert r.status_code == 200, r.text
    films = r.json()
    unseen = next((f for f in films if f["title"] == "Unseen"), None)
    assert unseen, "Unseen film not seeded"
    return unseen


# ---------------- Films ----------------
class TestFilms:
    def test_list_films_seeded(self, session):
        r = session.get(f"{API}/films")
        assert r.status_code == 200
        titles = [f["title"] for f in r.json()]
        assert "Unseen" in titles

    def test_get_film(self, session, unseen_film):
        r = session.get(f"{API}/films/{unseen_film['id']}")
        assert r.status_code == 200
        assert r.json()["title"] == "Unseen"
        assert r.json()["total_shots"] == 41

    def test_create_update_delete_film(self, session):
        # Create
        payload = {"title": "TEST_Film_E2E", "description": "tmp", "deadline": "2026-12-31", "total_shots": 0}
        r = session.post(f"{API}/films", json=payload)
        assert r.status_code == 200, r.text
        film = r.json()
        assert film["title"] == "TEST_Film_E2E"
        fid = film["id"]

        # Get
        r = session.get(f"{API}/films/{fid}")
        assert r.status_code == 200
        assert r.json()["description"] == "tmp"

        # Patch
        r = session.patch(f"{API}/films/{fid}", json={"description": "updated"})
        assert r.status_code == 200
        assert r.json()["description"] == "updated"

        # Add a shot, then verify cascade delete
        shot_payload = {"shot_number": "01", "act": "ACT 1", "model_assigned": "Kling 3.0", "shot_type": "ECU"}
        rs = session.post(f"{API}/films/{fid}/shots", json=shot_payload)
        assert rs.status_code == 200
        sid = rs.json()["id"]

        # Add an iteration to that shot
        ri = session.post(f"{API}/shots/{sid}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "f", "what_worked": "w", "decision": "KEEP"
        })
        assert ri.status_code == 200

        # Delete film should cascade
        r = session.delete(f"{API}/films/{fid}")
        assert r.status_code == 200
        # Shot gone
        r = session.get(f"{API}/shots/{sid}")
        assert r.status_code == 404
        # Iterations gone
        r = session.get(f"{API}/shots/{sid}/iterations")
        # 200 with empty (shot id no longer maps)
        assert r.status_code == 200
        assert r.json() == []

    def test_film_not_found(self, session):
        r = session.get(f"{API}/films/nonexistent-id")
        assert r.status_code == 404


# ---------------- Shots ----------------
class TestShots:
    def test_list_shots_count_and_order(self, session, unseen_film):
        r = session.get(f"{API}/films/{unseen_film['id']}/shots")
        assert r.status_code == 200
        shots = r.json()
        assert len(shots) == 41, f"Expected 41 shots, got {len(shots)}"

        # Order check - first 12 shot_numbers
        nums = [s["shot_number"] for s in shots]
        expected_prefix = ["01", "02", "03", "04", "05", "06", "07A", "07B", "07C", "07D", "07E", "08"]
        assert nums[:12] == expected_prefix, f"Order mismatch: {nums[:12]}"

        # Verify 21, 21A, 21B order
        idx21 = nums.index("21")
        assert nums[idx21:idx21+3] == ["21", "21A", "21B"]

        # Last shot 35
        assert nums[-1] == "35"

    def test_status_distribution(self, session, unseen_film):
        shots = session.get(f"{API}/films/{unseen_film['id']}/shots").json()
        from collections import Counter
        c = Counter(s["status"] for s in shots)
        assert c.get("FINAL", 0) == 13
        assert c.get("IN PROGRESS", 0) == 6
        assert c.get("NOT STARTED", 0) == 21
        assert c.get("CUT", 0) == 1

    def test_act_distribution(self, session, unseen_film):
        shots = session.get(f"{API}/films/{unseen_film['id']}/shots").json()
        from collections import Counter
        acts = Counter(s["act"] for s in shots)
        # ACT 1 should have 18 shots per problem statement
        assert acts.get("ACT 1", 0) == 18, f"ACT 1 count: {acts}"

    def test_get_shot(self, session, unseen_film):
        shots = session.get(f"{API}/films/{unseen_film['id']}/shots").json()
        s = shots[0]
        r = session.get(f"{API}/shots/{s['id']}")
        assert r.status_code == 200
        assert r.json()["shot_number"] == s["shot_number"]
        assert "_id" not in r.json()

    def test_create_shot_sort_key(self, session, unseen_film):
        # Create test film for clean testing
        f = session.post(f"{API}/films", json={"title": "TEST_SortKey"}).json()
        fid = f["id"]
        try:
            for n in ["10", "02", "07A", "07"]:
                session.post(f"{API}/films/{fid}/shots", json={
                    "shot_number": n, "act": "ACT 1", "model_assigned": "Kling 3.0", "shot_type": "CU"
                })
            r = session.get(f"{API}/films/{fid}/shots")
            assert [s["shot_number"] for s in r.json()] == ["02", "07", "07A", "10"]
        finally:
            session.delete(f"{API}/films/{fid}")


# ---------------- Iterations ----------------
class TestIterations:
    @pytest.fixture
    def temp_shot(self, session):
        f = session.post(f"{API}/films", json={"title": "TEST_IterFilm"}).json()
        fid = f["id"]
        s = session.post(f"{API}/films/{fid}/shots", json={
            "shot_number": "01", "act": "ACT 1", "model_assigned": "Kling 3.0", "shot_type": "CU"
        }).json()
        yield s, fid
        session.delete(f"{API}/films/{fid}")

    def test_validation_what_failed_required(self, session, temp_shot):
        shot, _ = temp_shot
        r = session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "  ",
            "what_worked": "w", "decision": "KEEP"
        })
        assert r.status_code == 400

    def test_validation_what_worked_required(self, session, temp_shot):
        shot, _ = temp_shot
        r = session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "f",
            "what_worked": "", "decision": "KEEP"
        })
        assert r.status_code == 400

    def test_attempt_auto_increment(self, session, temp_shot):
        shot, _ = temp_shot
        for i in range(3):
            r = session.post(f"{API}/shots/{shot['id']}/iterations", json={
                "model_used": "Kling 3.0", "prompt_text": f"p{i}", "what_failed": "f",
                "what_worked": "w", "decision": "KEEP"
            })
            assert r.status_code == 200
            assert r.json()["attempt_number"] == i + 1
        # Shot attempt_count
        s = session.get(f"{API}/shots/{shot['id']}").json()
        assert s["attempt_count"] == 3
        # Status auto-bumped from NOT STARTED to IN PROGRESS
        assert s["status"] == "IN PROGRESS"

    def test_decision_final_promotes_thumbnail(self, session, temp_shot):
        shot, _ = temp_shot
        r = session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "thumbnail": TINY_PNG,
            "what_failed": "f", "what_worked": "w", "decision": "FINAL"
        })
        assert r.status_code == 200
        s = session.get(f"{API}/shots/{shot['id']}").json()
        assert s["status"] == "FINAL"
        assert s["current_thumbnail"] == TINY_PNG

    def test_final_does_not_auto_downgrade(self, session, temp_shot):
        shot, _ = temp_shot
        # Mark FINAL first
        session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "f",
            "what_worked": "w", "decision": "FINAL"
        })
        # Add KEEP iter - shouldn't downgrade
        session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p2", "what_failed": "f",
            "what_worked": "w", "decision": "KEEP"
        })
        s = session.get(f"{API}/shots/{shot['id']}").json()
        assert s["status"] == "FINAL"

    def test_delete_iteration_decrements(self, session, temp_shot):
        shot, _ = temp_shot
        r = session.post(f"{API}/shots/{shot['id']}/iterations", json={
            "model_used": "Kling 3.0", "prompt_text": "p", "what_failed": "f",
            "what_worked": "w", "decision": "KEEP"
        })
        iter_id = r.json()["id"]
        s_before = session.get(f"{API}/shots/{shot['id']}").json()
        assert s_before["attempt_count"] == 1

        d = session.delete(f"{API}/iterations/{iter_id}")
        assert d.status_code == 200
        s_after = session.get(f"{API}/shots/{shot['id']}").json()
        assert s_after["attempt_count"] == 0
