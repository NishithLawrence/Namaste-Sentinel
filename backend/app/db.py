import sqlite3
from pathlib import Path
from typing import Any
DB_PATH = Path(__file__).resolve().parents[2] / 'namaste.db'

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS telemetry (
          id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, site_id TEXT NOT NULL,
          h2s REAL NOT NULL, ch4 REAL NOT NULL, o2 REAL NOT NULL, temperature REAL NOT NULL, humidity REAL NOT NULL,
          anomaly_score REAL, risk_score REAL, rule_state TEXT, final_decision TEXT, reason TEXT, explanation TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, site_id TEXT NOT NULL,
          event_type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, acknowledged INTEGER DEFAULT 0
        );''')
        # Migration check for existing database without reason column
        try:
            conn.execute('ALTER TABLE telemetry ADD COLUMN reason TEXT')
        except sqlite3.OperationalError:
            pass

def insert_telemetry(row: dict[str, Any]) -> int:
    with get_connection() as conn:
        cur = conn.execute('''INSERT INTO telemetry
        (timestamp,site_id,h2s,ch4,o2,temperature,humidity,anomaly_score,risk_score,rule_state,final_decision,reason,explanation)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''', tuple(row.get(k) for k in ('timestamp','site_id','h2s','ch4','o2','temperature','humidity','anomaly_score','risk_score','rule_state','final_decision','reason','explanation')))
        conn.commit(); return int(cur.lastrowid)

def insert_event(e: dict[str, Any]) -> int:
    with get_connection() as conn:
        cur = conn.execute('INSERT INTO events (timestamp,site_id,event_type,severity,message) VALUES (?,?,?,?,?)', tuple(e[k] for k in ('timestamp','site_id','event_type','severity','message')))
        conn.commit(); return int(cur.lastrowid)

def fetch_telemetry(site_id: str, limit: int = 120):
    with get_connection() as conn:
        rows = conn.execute('SELECT * FROM telemetry WHERE site_id=? ORDER BY id DESC LIMIT ?', (site_id,limit)).fetchall()
    return [dict(r) for r in reversed(rows)]

def fetch_events(site_id: str, limit: int = 50):
    with get_connection() as conn:
        rows = conn.execute('SELECT * FROM events WHERE site_id=? ORDER BY id DESC LIMIT ?', (site_id,limit)).fetchall()
    return [dict(r) for r in rows]

def latest(site_id: str):
    with get_connection() as conn:
        row = conn.execute('SELECT * FROM telemetry WHERE site_id=? ORDER BY id DESC LIMIT 1',(site_id,)).fetchone()
    return dict(row) if row else None

def ack_event(event_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute('UPDATE events SET acknowledged=1 WHERE id=?',(event_id,)); conn.commit(); return cur.rowcount == 1
