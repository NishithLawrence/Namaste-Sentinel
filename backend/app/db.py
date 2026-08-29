import os
import sqlite3
from pathlib import Path
from typing import Any

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

DB_PATH = Path(__file__).resolve().parents[2] / 'namaste.db'

def get_database_url():
    return os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DB_URL') or os.getenv('POSTGRES_URL')

def is_postgres():
    url = get_database_url()
    return bool(url and HAS_PSYCOPG2)

def get_connection():
    url = get_database_url()
    if is_postgres():
        # Handle postgres:// to postgresql:// URI scheme conversion if needed
        if url.startswith('postgres://'):
            url = url.replace('postgres://', 'postgresql://', 1)
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('''
                CREATE TABLE IF NOT EXISTS telemetry (
                  id SERIAL PRIMARY KEY,
                  timestamp TEXT NOT NULL,
                  site_id TEXT NOT NULL,
                  h2s REAL NOT NULL,
                  ch4 REAL NOT NULL,
                  o2 REAL NOT NULL,
                  temperature REAL NOT NULL,
                  humidity REAL NOT NULL,
                  anomaly_score REAL,
                  risk_score REAL,
                  rule_state TEXT,
                  final_decision TEXT,
                  reason TEXT,
                  explanation TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS events (
                  id SERIAL PRIMARY KEY,
                  timestamp TEXT NOT NULL,
                  site_id TEXT NOT NULL,
                  event_type TEXT NOT NULL,
                  severity TEXT NOT NULL,
                  message TEXT NOT NULL,
                  acknowledged INTEGER DEFAULT 0
                );''')
            conn.commit()
        finally:
            conn.close()
    else:
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
            try:
                conn.execute('ALTER TABLE telemetry ADD COLUMN reason TEXT')
            except sqlite3.OperationalError:
                pass

def insert_telemetry(row: dict[str, Any]) -> int:
    vals = tuple(row.get(k) for k in ('timestamp','site_id','h2s','ch4','o2','temperature','humidity','anomaly_score','risk_score','rule_state','final_decision','reason','explanation'))
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('''INSERT INTO telemetry
                (timestamp,site_id,h2s,ch4,o2,temperature,humidity,anomaly_score,risk_score,rule_state,final_decision,reason,explanation)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id''', vals)
                new_id = cur.fetchone()['id']
            conn.commit()
            return int(new_id)
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            cur = conn.execute('''INSERT INTO telemetry
            (timestamp,site_id,h2s,ch4,o2,temperature,humidity,anomaly_score,risk_score,rule_state,final_decision,reason,explanation)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''', vals)
            conn.commit()
            return int(cur.lastrowid)

def insert_event(e: dict[str, Any]) -> int:
    vals = tuple(e[k] for k in ('timestamp','site_id','event_type','severity','message'))
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('''INSERT INTO events (timestamp,site_id,event_type,severity,message)
                VALUES (%s,%s,%s,%s,%s) RETURNING id''', vals)
                new_id = cur.fetchone()['id']
            conn.commit()
            return int(new_id)
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            cur = conn.execute('INSERT INTO events (timestamp,site_id,event_type,severity,message) VALUES (?,?,?,?,?)', vals)
            conn.commit()
            return int(cur.lastrowid)

def fetch_telemetry(site_id: str, limit: int = 120):
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT * FROM telemetry WHERE site_id=%s ORDER BY id DESC LIMIT %s', (site_id, limit))
                rows = cur.fetchall()
            return [dict(r) for r in reversed(rows)]
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            rows = conn.execute('SELECT * FROM telemetry WHERE site_id=? ORDER BY id DESC LIMIT ?', (site_id, limit)).fetchall()
        return [dict(r) for r in reversed(rows)]

def fetch_events(site_id: str, limit: int = 50):
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT * FROM events WHERE site_id=%s ORDER BY id DESC LIMIT %s', (site_id, limit))
                rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            rows = conn.execute('SELECT * FROM events WHERE site_id=? ORDER BY id DESC LIMIT ?', (site_id, limit)).fetchall()
        return [dict(r) for r in rows]

def latest(site_id: str):
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT * FROM telemetry WHERE site_id=%s ORDER BY id DESC LIMIT 1', (site_id,))
                row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            row = conn.execute('SELECT * FROM telemetry WHERE site_id=? ORDER BY id DESC LIMIT 1', (site_id,)).fetchone()
        return dict(row) if row else None

def ack_event(event_id: int) -> bool:
    if is_postgres():
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('UPDATE events SET acknowledged=1 WHERE id=%s', (event_id,))
                conn.commit()
                return cur.rowcount == 1
        finally:
            conn.close()
    else:
        with get_connection() as conn:
            cur = conn.execute('UPDATE events SET acknowledged=1 WHERE id=?', (event_id,))
            conn.commit()
            return cur.rowcount == 1
