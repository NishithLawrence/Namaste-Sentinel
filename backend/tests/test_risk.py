from backend.app.risk_engine.decision import decide
def test_hard_rule_forces_no_go():
    d=decide({'h2s':25,'ch4':1,'o2':20},.01,.01,[]); assert d.final_decision=='NO-GO' and d.escalated
def test_moderate_risk_is_caution():
    d=decide({'h2s':6,'ch4':1.4,'o2':20.1},.6,.5,[]); assert d.final_decision=='CAUTION'
def test_stable_is_go():
    d=decide({'h2s':4,'ch4':1,'o2':20.6},.1,.1,[]); assert d.final_decision=='GO'


def test_transient_ai_spike_is_debounced():
    d=decide({'h2s':7,'ch4':1.5,'o2':20.0},.95,.75,[{'risk_score':.1},{'risk_score':.12}])
    assert d.final_decision=='CAUTION'
