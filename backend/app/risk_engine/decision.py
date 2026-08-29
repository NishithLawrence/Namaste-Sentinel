from dataclasses import dataclass
from ..config import DEMO

@dataclass
class Decision:
    rule_state: str
    final_decision: str
    reason: str
    escalated: bool

def decide(r, anomaly_score, risk_score, recent):
    hard = []
    if r["h2s"] >= DEMO.h2s_demo_high: hard.append("simulated H₂S rule breached")
    if r["ch4"] >= DEMO.ch4_demo_high: hard.append("simulated CH₄ rule breached")
    if r["o2"] <= DEMO.o2_demo_low: hard.append("simulated O₂ rule breached")

    recent_scores = [(x.get("risk_score") or 0) for x in recent[-DEMO.persistence_points:]]
    persistent = len(recent_scores) >= DEMO.persistence_points and all(s >= DEMO.risk_caution for s in recent_scores)

    # Persistence/debounce prevents a transient AI spike from immediately escalating.
    if hard:
        return Decision("NO-GO", "NO-GO", "Simulated demo safety floor: " + "; ".join(hard), True)
    if anomaly_score >= DEMO.anomaly_no_go and persistent:
        return Decision("AI-HIGH", "NO-GO", "High multivariate anomaly sustained across recent samples (Simulated AI Threshold)", True)
    if risk_score >= DEMO.risk_no_go and persistent:
        return Decision("AI-HIGH", "NO-GO", "High multivariate risk score sustained across recent samples (Simulated AI Threshold)", True)
    if anomaly_score >= DEMO.anomaly_caution or risk_score >= DEMO.risk_caution:
        return Decision("AI-MODERATE", "CAUTION", "Unstable trend or moderate multivariate anomaly (Simulated AI Threshold)", False)
    return Decision("CLEAR", "GO", "Telemetry signals stable against simulated prototype baseline", False)
