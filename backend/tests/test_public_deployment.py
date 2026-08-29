import os
import requests

PUBLIC_BASE = os.getenv('PUBLIC_BASE_URL', 'http://127.0.0.1:8000')

def test_public_health():
    r = requests.get(f"{PUBLIC_BASE}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_public_spa_root():
    r = requests.get(f"{PUBLIC_BASE}/")
    assert r.status_code == 200
    assert "NAMASTE Sentinel" in r.text

def test_public_reset_to_go():
    r = requests.post(f"{PUBLIC_BASE}/simulation/reset?site_id=MANHOLE-01")
    assert r.status_code == 200
    assert r.json()["latest"]["final_decision"] == "GO"

def test_public_deterioration_to_caution():
    r = requests.post(f"{PUBLIC_BASE}/simulation/event", json={"site_id": "MANHOLE-01", "mode": "decline", "points": 12})
    assert r.status_code == 200
    assert r.json()["latest"]["final_decision"] in ("CAUTION", "NO-GO")

def test_public_severe_to_no_go():
    r = requests.post(f"{PUBLIC_BASE}/simulation/event", json={"site_id": "MANHOLE-01", "mode": "rise", "points": 14})
    assert r.status_code == 200
    assert r.json()["latest"]["final_decision"] == "NO-GO"

def test_public_recovery_to_go():
    r = requests.post(f"{PUBLIC_BASE}/simulation/event", json={"site_id": "MANHOLE-01", "mode": "recovery", "points": 16})
    assert r.status_code == 200
    assert r.json()["latest"]["final_decision"] == "GO"
