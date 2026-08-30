import json
import sys
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db, insert_event, insert_telemetry, fetch_telemetry, fetch_events, latest, ack_event, get_connection, is_postgres
from .schemas import TelemetryIn, SimulationEvent, AcknowledgeResponse
from .ml.engine import RiskModel
from .risk_engine.decision import decide
from .simulation.generator import generate

app = FastAPI(title='NAMASTE Sentinel API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

DIST_DIR = PROJECT_ROOT / 'frontend' / 'dist'
if DIST_DIR.exists():
    app.mount('/assets', StaticFiles(directory=str(DIST_DIR / 'assets')), name='assets')
    @app.get('/', include_in_schema=False)
    def serve_spa():
        return FileResponse(DIST_DIR / 'index.html')
model=RiskModel()
@app.on_event('startup')
def startup(): init_db()
def process(reading):
    hist=fetch_telemetry(reading['site_id'],120); result=model.score(reading,hist); d=decide(reading,result.anomaly_score,result.risk_score,hist)
    row={**reading,'anomaly_score':result.anomaly_score,'risk_score':result.risk_score,'rule_state':d.rule_state,'final_decision':d.final_decision,'reason':d.reason,'explanation':json.dumps(result.factors)}
    tid=insert_telemetry(row)
    if d.escalated: insert_event({'timestamp':reading['timestamp'],'site_id':reading['site_id'],'event_type':'ESCALATION','severity':d.final_decision,'message':d.reason})
    elif d.final_decision=='CAUTION': insert_event({'timestamp':reading['timestamp'],'site_id':reading['site_id'],'event_type':'WARNING','severity':'CAUTION','message':d.reason})
    return {'id':tid,**row,'factors':result.factors,'reason':d.reason}
@app.get('/health')
def health(): return {'status':'ok','service':'namaste-sentinel-api','prototype':True}
@app.post('/telemetry')
def telemetry(p:TelemetryIn): return process(p.model_dump())
@app.get('/sites/{site_id}/status')
def status(site_id:str):
    item=latest(site_id)
    if not item: raise HTTPException(404,'No telemetry for site')
    item['factors']=json.loads(item.get('explanation') or '[]')
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(item['timestamp'].replace('Z', '+00:00'))).total_seconds()
    except ValueError:
        age = None
    item['data_age_seconds'] = age
    item['data_fresh'] = age is not None and age <= 30
    if age is not None and age > 30:
        item['rule_state'] = 'STALE_TELEMETRY'
        item['final_decision'] = 'UNCERTAIN'
        item['reason'] = f'STALE TELEMETRY: Last reading received {int(age)}s ago. System state unverified.'
    return item
@app.get('/sites/{site_id}/telemetry')
def telemetry_history(site_id:str,limit:int=120): return fetch_telemetry(site_id,max(1,min(limit,500)))
@app.get('/sites/{site_id}/events')
def events(site_id:str,limit:int=50): return fetch_events(site_id,max(1,min(limit,200)))
@app.post('/simulation/event')
def simulation(p:SimulationEvent):
    results=[process({'site_id':p.site_id,**r}) for r in generate(p.mode,p.points)]
    return {'mode':p.mode,'points':len(results),'results':results,'latest':results[-1]}
@app.post('/alerts/{event_id}/acknowledge',response_model=AcknowledgeResponse)
def acknowledge(event_id:int):
    if not ack_event(event_id): raise HTTPException(404,'Alert not found')
    return {'success':True,'message':'Alert acknowledged'}

@app.post('/simulation/reset')
def reset_simulation(site_id: str = 'MANHOLE-01'):
    if is_postgres():
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute('DELETE FROM telemetry WHERE site_id=%s', (site_id,))
            cur.execute('DELETE FROM events WHERE site_id=%s', (site_id,))
        conn.commit()
    else:
        with get_connection() as conn:
            conn.execute('DELETE FROM telemetry WHERE site_id=?', (site_id,))
            conn.execute('DELETE FROM events WHERE site_id=?', (site_id,))
            conn.commit()
    res = process({'site_id': site_id, 'timestamp': datetime.now(timezone.utc).isoformat(), 'h2s': 4.5, 'ch4': 1.2, 'o2': 20.5, 'temperature': 28.0, 'humidity': 72.0})
    return {'success': True, 'message': 'Demo state reset to clean baseline', 'latest': res}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('backend.app.main:app', host='127.0.0.1', port=8000, reload=True)

