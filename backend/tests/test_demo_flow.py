import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app, model
from backend.app.db import init_db, get_connection, insert_telemetry, is_postgres

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM telemetry")
                cur.execute("DELETE FROM events")
            conn.commit()
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            conn.execute("DELETE FROM telemetry")
            conn.execute("DELETE FROM events")
            conn.commit()

def test_stable_to_go():
    res = client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "normal", "points": 10})
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "normal"
    assert data["latest"]["final_decision"] == "GO"

    status_res = client.get("/sites/MANHOLE-01/status")
    assert status_res.status_code == 200
    status = status_res.json()
    assert status["final_decision"] == "GO"
    assert status["data_fresh"] is True

def test_deterioration_to_caution():
    res = client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "decline", "points": 12})
    assert res.status_code == 200
    data = res.json()
    assert data["latest"]["final_decision"] in ("CAUTION", "NO-GO")

def test_severe_hard_rule_to_no_go():
    res = client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "rise", "points": 14})
    assert res.status_code == 200
    data = res.json()
    assert data["latest"]["final_decision"] == "NO-GO"
    assert "breached" in data["latest"]["reason"] or "sustained" in data["latest"]["reason"]

    events_res = client.get("/sites/MANHOLE-01/events")
    assert events_res.status_code == 200
    events = events_res.json()
    assert len(events) > 0
    assert events[0]["severity"] == "NO-GO"

def test_noise_spike_debounce():
    # Inject 1 transient high anomaly point, but recent baseline is clear
    client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "normal", "points": 5})
    
    # Send a single reading with elevated anomaly risk but normal hard values
    single_spike = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "site_id": "MANHOLE-01",
        "h2s": 7.0,
        "ch4": 1.5,
        "o2": 20.0,
        "temperature": 28.0,
        "humidity": 72.0
    }
    res = client.post("/telemetry", json=single_spike)
    assert res.status_code == 200
    data = res.json()
    # A single transient AI spike without hard rule breach should NOT cause NO-GO (debounced to CAUTION or GO)
    assert data["final_decision"] != "NO-GO"

def test_recovery_flow():
    # First inject rise (NO-GO)
    client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "rise", "points": 10})
    # Then inject recovery
    res = client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "recovery", "points": 16})
    assert res.status_code == 200
    data = res.json()
    # At end of recovery points, values stabilize and decision transitions to GO
    assert data["latest"]["final_decision"] == "GO"

def test_stale_data_detection():
    # Insert old telemetry reading (> 30s ago)
    old_time = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
    row = {
        "timestamp": old_time,
        "site_id": "MANHOLE-01",
        "h2s": 4.5, "ch4": 1.2, "o2": 20.5, "temperature": 28.0, "humidity": 72.0,
        "anomaly_score": 0.1, "risk_score": 0.1, "rule_state": "CLEAR", "final_decision": "GO",
        "reason": "Clear baseline", "explanation": "[]"
    }
    insert_telemetry(row)

    status_res = client.get("/sites/MANHOLE-01/status")
    assert status_res.status_code == 200
    status = status_res.json()
    assert status["data_fresh"] is False
    assert status["rule_state"] == "STALE_TELEMETRY"
    assert status["final_decision"] == "UNCERTAIN"
    assert "STALE TELEMETRY" in status["reason"]

def test_reset_simulation():
    client.post("/simulation/event", json={"site_id": "MANHOLE-01", "mode": "rise", "points": 10})
    reset_res = client.post("/simulation/reset?site_id=MANHOLE-01")
    assert reset_res.status_code == 200
    assert reset_res.json()["latest"]["final_decision"] == "GO"

