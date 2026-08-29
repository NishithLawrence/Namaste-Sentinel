from dataclasses import dataclass
@dataclass(frozen=True)
class DemoThresholds:
    # Illustrative prototype values only; not real-world safety limits.
    h2s_demo_high: float = 18.0
    ch4_demo_high: float = 4.0
    o2_demo_low: float = 18.5
    anomaly_caution: float = 0.58
    anomaly_no_go: float = 0.78
    risk_caution: float = 0.42
    risk_no_go: float = 0.68
    persistence_points: int = 3
DEMO = DemoThresholds()
