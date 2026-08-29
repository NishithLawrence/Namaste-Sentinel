from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
FEATURES=['h2s','ch4','o2','temperature','humidity','h2s_slope','ch4_slope','o2_slope','risk_accel']
@dataclass
class ModelResult:
    anomaly_score: float
    risk_score: float
    factors: list[dict]
class RiskModel:
    def __init__(self):
        self.baseline=pd.DataFrame(self._normal_rows(300)); self.model=IsolationForest(n_estimators=180,contamination=0.08,random_state=42); self.model.fit(self.baseline[FEATURES])
        self.center=self.baseline[FEATURES].mean(); self.scale=self.baseline[FEATURES].std().replace(0,1)
    @staticmethod
    def _normal_rows(n):
        rng=np.random.default_rng(42); rows=[]
        for _ in range(n):
            rows.append({'h2s':max(0,rng.normal(4.5,.9)),'ch4':max(0,rng.normal(1.2,.25)),'o2':rng.normal(20.5,.35),'temperature':rng.normal(28,1.6),'humidity':rng.normal(72,5),'h2s_slope':rng.normal(0,.15),'ch4_slope':rng.normal(0,.05),'o2_slope':rng.normal(0,.08),'risk_accel':rng.normal(0,.05)})
        return rows
    def score(self,current,history):
        df=pd.DataFrame(history+[current])
        for c in ['h2s','ch4','o2','temperature','humidity']: df[f'{c}_slope']=df[c].diff().rolling(3).mean().fillna(0)
        df['risk_accel']=df['h2s_slope'].diff().fillna(0)+df['ch4_slope'].diff().fillna(0)-df['o2_slope'].diff().fillna(0)
        row=df.iloc[-1]; raw=-self.model.decision_function(pd.DataFrame([row[FEATURES]]))[0]; anomaly=float(np.clip((raw+.25)/.55,0,1))
        factors = []
        for f in ['h2s', 'ch4', 'o2', 'temperature', 'humidity']:
            z = abs((float(row[f]) - float(self.center[f])) / float(self.scale[f]))
            impact = z if ((f == 'o2' and row[f] < self.center[f]) or (f != 'o2' and row[f] > self.center[f])) else z * 0.25
            factors.append({'feature': f.upper(), 'impact': float(impact), 'direction': 'declining' if f == 'o2' else 'elevated'})
        for f in ['h2s_slope', 'ch4_slope', 'o2_slope', 'risk_accel']:
            s_val = float(row[f])
            is_worsening = (f in ['h2s_slope', 'ch4_slope', 'risk_accel'] and s_val > 0) or (f == 'o2_slope' and s_val < 0)
            impact = abs(s_val) / float(self.scale[f]) if is_worsening else abs(s_val) * 0.2 / float(self.scale[f])
            factors.append({'feature': f, 'impact': float(impact), 'direction': 'worsening trend' if is_worsening else 'improving trend'})
        factors.sort(key=lambda x: x['impact'], reverse=True)
        top = factors[:4]
        normalized = float(np.clip(np.mean([min(x['impact'] / 4, 1) for x in top]), 0, 1))
        risk = float(np.clip(0.52 * anomaly + 0.48 * normalized, 0, 1))
        return ModelResult(anomaly,risk,top)
