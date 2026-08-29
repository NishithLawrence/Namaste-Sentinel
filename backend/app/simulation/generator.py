from datetime import datetime, timezone, timedelta
import numpy as np
BASE={'h2s':4.5,'ch4':1.2,'o2':20.5,'temperature':28.0,'humidity':72.0}
def generate(mode,points=12,seed=7):
    rng=np.random.default_rng(seed); now=datetime.now(timezone.utc); out=[]
    for i in range(points):
        p=i/max(points-1,1); v=dict(BASE)
        if mode=='rise': v.update(h2s=4.5+15.5*p,ch4=1.2+3.0*p,o2=20.5-2.7*p)
        elif mode=='decline': v.update(h2s=4.5+4.8*p,ch4=1.2+0.8*p,o2=20.5-0.8*p)
        elif mode=='noise': v.update(h2s=4.5+rng.normal(0,3.5),ch4=1.2+rng.normal(0,.8),o2=20.5+rng.normal(0,1.2))
        elif mode=='recovery': v.update(h2s=19-14.5*p,ch4=4.1-2.9*p,o2=18+2.5*p)
        out.append({'timestamp':(now-timedelta(seconds=(points-i-1)*2)).isoformat(),'h2s':max(.1,v['h2s']+rng.normal(0,.18)),'ch4':max(.05,v['ch4']+rng.normal(0,.05)),'o2':v['o2']+rng.normal(0,.08),'temperature':v['temperature']+rng.normal(0,.25),'humidity':float(np.clip(v['humidity']+rng.normal(0,.8),10,100))})
    return out
