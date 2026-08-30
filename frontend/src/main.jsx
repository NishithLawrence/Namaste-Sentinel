import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:8000' : 'https://namaste-sentinel.vercel.app')
const SITE = 'MANHOLE-01'

const SENSOR_META = {
  h2s: { label: 'H₂S (Hydrogen Sulfide)', unit: 'ppm', limit: 'Configured threshold: ≥ 18.0 ppm' },
  ch4: { label: 'CH₄ (Methane)', unit: '% LEL', limit: 'Configured threshold: ≥ 4.0 % LEL' },
  o2: { label: 'O₂ (Oxygen)', unit: '%', limit: 'Configured floor: ≤ 18.5 %' },
  temperature: { label: 'Temperature', unit: '°C', limit: 'Baseline: ~28.0 °C' },
  humidity: { label: 'Humidity', unit: '%', limit: 'Baseline: ~72 %' },
}

function MiniSparkline({ data, field }) {
  const { points, strokeColor } = useMemo(() => {
    if (!data || data.length < 2) return { points: '', strokeColor: '#126278' }
    const vals = data.map(d => Number(d[field] ?? 0))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1

    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * 100
      const y = 90 - ((v - min) / span) * 75
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const stroke = field === 'o2' 
      ? (vals.at(-1) <= 18.5 ? '#E33B4F' : '#22A06B') 
      : (field === 'h2s' 
        ? (vals.at(-1) >= 18 ? '#E33B4F' : vals.at(-1) >= 6 ? '#F2A623' : '#22A06B') 
        : '#2CC6D6')
    return { points: pts.join(' '), strokeColor: stroke }
  }, [data, field])

  return (
    <div className="sparkline-box">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    </div>
  )
}

function SiteBlueprint({ currentSite, currentDecision, isFresh }) {
  const nodes = [
    { id: 'MANHOLE-01', name: 'MANHOLE-01 (MONITORED SITE)', type: 'ACTIVE', cx: 120, cy: 70 },
    { id: 'WELL-02', name: 'WELL-02 (SUBSTATION B)', type: 'STANDBY', cx: 320, cy: 40 },
    { id: 'JUNCTION-03', name: 'JUNCTION-03 (PUMP STATION C)', type: 'STANDBY', cx: 320, cy: 100 },
    { id: 'VALVE-04', name: 'VALVE-04 (DISTRICT D)', type: 'STANDBY', cx: 500, cy: 70 }
  ]

  const getStatusColor = () => {
    if (!isFresh) return '#19A7B8'
    if (currentDecision === 'GO') return '#22A06B'
    if (currentDecision === 'CAUTION') return '#F2A623'
    if (currentDecision === 'NO-GO') return '#E33B4F'
    return '#19A7B8'
  }

  return (
    <section className="site-blueprint-card">
      <div className="panel-header">
        <h2>SITE OVERVIEW</h2>
        <span>Industrial Schematic Layout & Telemetry Nodes</span>
      </div>

      <div className="blueprint-container">
        <svg viewBox="0 0 620 140" className="blueprint-svg" preserveAspectRatio="xMidYMid meet">
          {/* Schematic Connecting Lines */}
          <line x1="120" y1="70" x2="320" y2="40" stroke="#2C3B42" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="120" y1="70" x2="320" y2="100" stroke="#2C3B42" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="320" y1="40" x2="500" y2="70" stroke="#2C3B42" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="320" y1="100" x2="500" y2="70" stroke="#2C3B42" strokeWidth="2" strokeDasharray="4 4" />

          {/* Monitored Nodes */}
          {nodes.map(n => {
            const isActive = n.id === currentSite
            const color = isActive ? getStatusColor() : '#718187'
            return (
              <g key={n.id} className={`blueprint-node ${isActive ? 'active-node' : ''}`}>
                <circle cx={n.cx} cy={n.cy} r={isActive ? 16 : 10} fill="#111A20" stroke={color} strokeWidth={isActive ? 3 : 2} />
                <circle cx={n.cx} cy={n.cy} r={isActive ? 6 : 4} fill={color} />
                <text x={n.cx} y={n.cy + (isActive ? 32 : 26)} textAnchor="middle" fill={isActive ? '#F2F5F4' : '#AAB8BD'} fontSize={isActive ? 11 : 10} fontFamily="IBM Plex Mono" fontWeight={isActive ? 700 : 500}>
                  {n.id} {isActive ? `[${isFresh ? currentDecision : 'UNCERTAIN'}]` : '[STANDBY]'}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="blueprint-legend-row">
          <div className="legend-node-pill active">
            <span className="dot" style={{ backgroundColor: getStatusColor() }} />
            <span>MANHOLE-01: {isFresh ? currentDecision : 'LINK STALE'}</span>
          </div>
          <div className="legend-node-pill standby">
            <span className="dot standby-dot" />
            <span>SUBSTATIONS 02–04: STANDBY</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function XaiExplanationModal({ factor, history, onClose }) {
  if (!factor) return null

  const field = (factor.feature || '').toLowerCase()
  const latestVal = history.length ? Number(history.at(-1)[field] ?? 0) : 0
  const impactLevel = factor.impact >= 2.0 ? 'HIGH' : (factor.impact >= 1.0 ? 'MODERATE' : 'LOW')
  const direction = factor.direction || 'STABLE'

  const getFaithfulExplanation = () => {
    if (field.includes('h2s')) {
      return 'The multivariate anomaly scoring model detected elevated H₂S concentration deviating from baseline history. High H₂S contributes directly to multivariate risk scoring. Deterministic safety rule overrides if concentration exceeds ≥ 18.0 ppm.'
    }
    if (field.includes('ch4')) {
      return 'Methane level deviation detected by risk scoring model. Elevated % LEL increases atmospheric risk weight. Hard safety rule forces NO-GO if threshold reaches ≥ 4.0 % LEL.'
    }
    if (field.includes('o2')) {
      return 'Oxygen level monitored relative to standard atmospheric floor. Depletion below ≤ 18.5 % triggers immediate hard safety rule override.'
    }
    return 'Multivariate statistical deviation evaluated against atmospheric time-series history.'
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="xai-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-eyebrow">EXPLAINABLE AI (XAI) DRILL-DOWN</span>
            <h3 className="modal-title">{factor.feature.toUpperCase()} EVIDENCE</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="xai-grid">
          <div className="xai-stat-box">
            <span className="xai-label">CURRENT TELEMETRY</span>
            <span className="xai-val">{latestVal > 0 ? latestVal.toFixed(2) : '—'}</span>
          </div>
          <div className="xai-stat-box">
            <span className="xai-label">TREND DIRECTION</span>
            <span className={`xai-val dir ${direction.toLowerCase()}`}>{direction}</span>
          </div>
          <div className="xai-stat-box">
            <span className="xai-label">AI CONTRIBUTION</span>
            <span className={`xai-val impact ${impactLevel.toLowerCase()}`}>{impactLevel} ({factor.impact.toFixed(2)})</span>
          </div>
        </div>

        <div className="xai-explanation-section">
          <h4>WHY THIS FACTOR MATTERS</h4>
          <p>{getFaithfulExplanation()}</p>
        </div>

        <div className="xai-architecture-note">
          <div className="arch-pill ai">
            <strong>AI EVIDENCE:</strong> Probabilistic Anomaly Weighting
          </div>
          <div className="arch-pill rule">
            <strong>SAFETY RULE:</strong> Deterministic Boundary Authority
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-done-btn" onClick={onClose}>Close Explanation</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [activeMode, setActiveMode] = useState('')
  const [error, setError] = useState('')
  const [selectedFactor, setSelectedFactor] = useState(null)
  const [audioMuted, setAudioMuted] = useState(true)

  const load = async () => {
    try {
      const [s, t, e] = await Promise.all([
        fetch(`${API}/sites/${SITE}/status`),
        fetch(`${API}/sites/${SITE}/telemetry?limit=90`),
        fetch(`${API}/sites/${SITE}/events?limit=12`)
      ])
      if (!s.ok) throw new Error('No telemetry found. Click "Reset Baseline" to initialize baseline.')
      const statusData = await s.json()
      setStatus(statusData)
      setHistory(await t.json())
      setEvents(await e.json())
      setError('')

      if (!audioMuted && statusData?.final_decision === 'NO-GO') {
        playIndustrialAlarmChime()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [audioMuted])

  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') setSelectedFactor(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const playIndustrialAlarmChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch (e) {
      // Audio context restricted or unavailable
    }
  }

  const simulate = async mode => {
    setBusy(true)
    setActiveMode(mode)
    setError('')
    try {
      const pointsCount = mode === 'noise' ? 8 : (mode === 'recovery' ? 16 : 14)
      const r = await fetch(`${API}/simulation/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: SITE, mode, points: pointsCount })
      })
      if (!r.ok) throw new Error('Simulation execution failed')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setActiveMode('')
    }
  }

  const resetDemo = async () => {
    setBusy(true)
    setActiveMode('reset')
    setError('')
    try {
      const r = await fetch(`${API}/simulation/reset?site_id=${SITE}`, { method: 'POST' })
      if (!r.ok) throw new Error('Reset failed')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setActiveMode('')
    }
  }

  const acknowledge = async id => {
    await fetch(`${API}/alerts/${id}/acknowledge`, { method: 'POST' })
    await load()
  }

  const decision = status?.final_decision || 'GO'
  const className = decision.toLowerCase().replace('-', '')
  const score = status ? Math.round(status.risk_score * 100) : 0
  const isFresh = status ? status.data_fresh : true
  const dataAge = status ? Math.round(status.data_age_seconds || 0) : 0
  const isBreach = status?.rule_state === 'NO-GO'

  const getDecisionBadgeText = () => {
    if (!isFresh) return '! UNCERTAIN — TELEMETRY LINK STALE'
    if (decision === 'GO') return '✓ GO — ATMOSPHERE STABLE (BASELINE CLEAR)'
    if (decision === 'CAUTION') return '⚠ CAUTION — PREDICTIVE AI ANOMALY (SAFETY RULES CLEAR)'
    if (decision === 'NO-GO') {
      return isBreach
        ? '⛔ NO-GO — DETERMINISTIC SAFETY RULE BREACH (OVERRIDE)'
        : '⛔ NO-GO — SUSTAINED AI ANOMALY ESCALATION'
    }
    return decision
  }

  const calcTrend = field => {
    if (history.length < 2) return { text: '→ Stable', cls: 'stable' }
    const latestVal = Number(history.at(-1)[field] ?? 0)
    const prevVal = Number(history.at(-2)[field] ?? 0)
    const diff = latestVal - prevVal
    if (Math.abs(diff) < 0.05) return { text: '→ Stable', cls: 'stable' }
    if (field === 'o2') {
      return diff < 0 ? { text: `↓ ${diff.toFixed(2)} %/min`, cls: 'declining' } : { text: `↑ +${diff.toFixed(2)} %/min`, cls: 'rising' }
    }
    return diff > 0 ? { text: `↑ +${diff.toFixed(2)}/min`, cls: 'rising' } : { text: `↓ ${diff.toFixed(2)}/min`, cls: 'declining' }
  }

  return (
    <div className="app">
      <div className="shell">
        {/* Top Navigation Bar */}
        <header className="top-nav-bar">
          <div className="nav-brand">
            <div className="brand-eyebrow">ATMOSPHERIC RISK INTELLIGENCE</div>
            <h1 className="brand-title">NAMASTE SENTINEL</h1>
          </div>

          <div className="nav-meta">
            <div className="site-badge">LOCATION: {SITE}</div>
            <div className="stream-status-pill">
              <span className={`status-indicator-dot ${isFresh ? '' : 'stale'}`} />
              <span>{isFresh ? `LIVE STREAM (DATA SOURCE: SIMULATION)` : `LINK STALE (${dataAge}s ago)`}</span>
            </div>
          </div>
        </header>

        <main>
          {error && <div className="notice">{error}</div>}

          {/* Interactive 5-Stage Intelligence Pipeline Ribbon */}
          <div className="pipeline-ribbon">
            <div className={`pipeline-step ${history.length ? 'step-active' : ''}`}>
              <span className="step-num">1</span>
              <span className="step-label">01 SENSOR CHANGE</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className={`pipeline-step ${status ? 'step-active' : ''}`}>
              <span className="step-num">2</span>
              <span className="step-label">02 TREND / ANOMALY</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className={`pipeline-step ${score > 30 || decision !== 'GO' ? 'step-active ai-highlight' : ''}`}>
              <span className="step-num">3</span>
              <span className="step-label">03 AI RISK</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className={`pipeline-step ${isBreach ? 'step-breach' : ''}`}>
              <span className="step-num">4</span>
              <span className="step-label">04 HARD SAFETY RULE</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className={`pipeline-step final ${decision === 'NO-GO' ? 'step-nogo' : (decision === 'CAUTION' ? 'step-caution' : '')}`}>
              <span className="step-num">5</span>
              <span className="step-label">05 DECISION & ESCALATION</span>
            </div>
          </div>

          {/* Primary Safety Risk Decision Panel Card */}
          <section className={`risk-decision-panel ${isFresh ? className : 'uncertain'}`}>
            <div className="decision-main">
              <div className="decision-header-row">
                <span className="status-badge">{getDecisionBadgeText()}</span>
              </div>
              <div className="decision-title-text">{isFresh ? decision : 'UNCERTAIN'}</div>
              <div className="decision-reason-text">
                {status?.reason || 'Initialize simulation baseline to compute multivariate anomaly evaluation.'}
              </div>

              <div className="decision-sub-breakdown">
                <span className="breakdown-pill">
                  <strong>SAFETY RULES:</strong> {isBreach ? '⛔ BREACHED (OVERRIDE)' : '✓ CLEAR (0 BREACHES)'}
                </span>
                <span className="breakdown-pill">
                  <strong>AI RISK SCORE:</strong> {score} / 100
                </span>
                {(status?.factors || []).length > 0 && (
                  <span className="breakdown-pill">
                    <strong>PRIMARY AI DRIVER:</strong> {status.factors[0].feature} ({status.factors[0].direction})
                  </span>
                )}
              </div>
            </div>

            <div className="risk-meter-display">
              <div className="risk-meter-title">ANOMALY SCORE</div>
              <div className="risk-score-value">{isFresh ? score : '?'}</div>
              <div className="risk-score-scale">/ 100 SCALE</div>
            </div>
          </section>

          {/* Site Overview Schematic Blueprint Panel */}
          <SiteBlueprint currentSite={SITE} currentDecision={decision} isFresh={isFresh} />

          {/* Real-time Atmospheric Telemetry & Sparklines */}
          <section className="telemetry-section">
            <div className="section-header">
              <h2>ATMOSPHERIC TELEMETRY</h2>
              <span>{history.length} time-series data points (DATA SOURCE: SIMULATION)</span>
            </div>

            <div className="sensors-grid">
              {Object.keys(SENSOR_META).map(field => {
                const meta = SENSOR_META[field]
                const val = history.length ? Number(history.at(-1)[field] ?? 0) : 0
                const trend = calcTrend(field)

                return (
                  <div className="sensor-card" key={field}>
                    <div className="sensor-header">
                      <span className="sensor-label">{meta.label}</span>
                    </div>

                    <div className="sensor-readout-row">
                      <span className="sensor-val">{val > 0 ? val.toFixed(2) : '—'}</span>
                      <span className="sensor-unit">{meta.unit}</span>
                    </div>

                    <div className="sensor-meta-footer">
                      <span className={`sensor-trend-badge ${trend.cls}`}>{trend.text}</span>
                      <span className="sensor-limit-tag">{meta.limit}</span>
                    </div>
                    <MiniSparkline data={history} field={field} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* Decision Evidence Panel (Multivariate Anomaly Factors) with XAI Drill-Down */}
          <section className="evidence-panel-section">
            <div className="panel-card evidence-panel">
              <div className="panel-header">
                <h2>DECISION EVIDENCE</h2>
                <span>Multivariate Anomaly Factors & Explainable AI Hierarchy (Click factor to inspect evidence)</span>
              </div>

              {(status?.factors || []).length ? (
                <div className="factors-compact-grid">
                  {status.factors.map((f, idx) => {
                    const pct = Math.min((f.impact / 4) * 100, 100)
                    const rank = idx === 0 ? 'PRIMARY DRIVER' : (idx === 1 ? 'SECONDARY DRIVER' : 'CONTRIBUTING FACTOR')
                    return (
                      <div className="factor-compact-card clickable" key={f.feature} onClick={() => setSelectedFactor(f)} title="Click to view Explainable AI (XAI) drill-down details">
                        <div className="factor-top">
                          <span className="factor-rank-badge">{rank}</span>
                          <span className="factor-val">{f.impact.toFixed(2)} 🔍</span>
                        </div>
                        <div className="factor-middle">
                          <span className="factor-name">{f.feature}</span>
                          <span className="factor-dir">{f.direction}</span>
                        </div>
                        <div className="factor-bar-track">
                          <div className="factor-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-msg">No active risk drivers detected. Telemetry signals stable against baseline.</div>
              )}
            </div>
          </section>

          {/* Structured Safety Event Log Audit Trail */}
          <section className="incident-log-section">
            <div className="panel-card incident-log-panel">
              <div className="panel-header">
                <h2>SAFETY EVENT LOG</h2>
                <span>Operational audit trail of detections, warnings, escalations and acknowledgements ({events.length} records)</span>
              </div>

              {events.length ? (
                <div className="incident-log-scroll">
                  <div className="log-table-header">
                    <span className="col-time">TIME</span>
                    <span className="col-sev">SEVERITY</span>
                    <span className="col-type">EVENT TYPE</span>
                    <span className="col-detail">DETAIL</span>
                    <span className="col-action">ACTION</span>
                  </div>

                  {events.map(e => (
                    <div className={`incident-row ${!e.acknowledged && e.severity === 'NO-GO' ? 'unack' : ''}`} key={e.id}>
                      <div className="incident-time-col">
                        <span className="incident-timestamp">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="incident-sev-col">
                        {e.severity === 'NO-GO' && <span className="sev-tag nogo">⛔ NO-GO</span>}
                        {e.severity === 'CAUTION' && <span className="sev-tag caution">⚠ CAUTION</span>}
                        {e.severity === 'GO' && <span className="sev-tag go">✓ GO</span>}
                      </div>
                      <div className="incident-type-col">
                        <span className="incident-type-tag">{e.event_type}</span>
                      </div>
                      <div className="incident-main-col">
                        <div className="incident-msg">{e.message}</div>
                      </div>
                      <div className="incident-action-col">
                        {!e.acknowledged ? (
                          <button className="ack-button" onClick={() => acknowledge(e.id)}>
                            Acknowledge Alert
                          </button>
                        ) : (
                          <span className="ack-status-tag">✓ Acknowledged</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-msg">No critical events logged. Use operator scenario controller below to test escalation.</div>
              )}
            </div>
          </section>

          {/* Operator Scenario Console */}
          <section className="controller-card">
            <div className="controller-header">
              <div className="controller-title">
                <span>🎛 SCENARIO CONTROLLER</span>
                <button className="audio-toggle-btn" onClick={() => setAudioMuted(!audioMuted)}>
                  {audioMuted ? '🔇 ALARM MUTED' : '🔊 ALARM ENABLED'}
                </button>
              </div>
              <div className="controller-subtitle">Run controlled scenarios to evaluate real-time anomaly scoring, safety rules, and escalation.</div>
            </div>

            <div className="demo-buttons-grid">
              <button disabled={busy} className={`demo-btn reset ${activeMode === 'reset' ? 'active' : ''}`} onClick={resetDemo}>
                {activeMode === 'reset' ? 'Resetting...' : '🔄 RESET BASELINE'}
              </button>
              <button disabled={busy} className={`demo-btn stable ${activeMode === 'normal' ? 'active' : ''}`} onClick={() => simulate('normal')}>
                {activeMode === 'normal' ? 'Simulating...' : '✓ STABLE BASELINE (GO)'}
              </button>
              <button disabled={busy} className={`demo-btn decline ${activeMode === 'decline' ? 'active' : ''}`} onClick={() => simulate('decline')}>
                {activeMode === 'decline' ? 'Simulating...' : '⚠ DETERIORATION (CAUTION)'}
              </button>
              <button disabled={busy} className={`demo-btn rise ${activeMode === 'rise' ? 'active' : ''}`} onClick={() => simulate('rise')}>
                {activeMode === 'rise' ? 'Simulating...' : '⛔ RAPID GAS SPIKE (NO-GO)'}
              </button>
              <button disabled={busy} className={`demo-btn noise ${activeMode === 'noise' ? 'active' : ''}`} onClick={() => simulate('noise')}>
                {activeMode === 'noise' ? 'Simulating...' : '⚡ NOISE SPIKE (DEBOUNCED)'}
              </button>
              <button disabled={busy} className={`demo-btn recovery ${activeMode === 'recovery' ? 'active' : ''}`} onClick={() => simulate('recovery')}>
                {activeMode === 'recovery' ? 'Simulating...' : '🔄 RECOVERY (GO)'}
              </button>
            </div>
          </section>

          {/* Decision Rules Card */}
          <section className="threshold-legend-card">
            <div className="panel-header" style={{ marginBottom: '12px' }}>
              <h2>DECISION RULES</h2>
              <span>Configured decision logic</span>
            </div>

            <div className="legend-grid">
              <div className="legend-item">
                <span className="legend-title">H₂S</span>
                <span className="legend-desc">Configured threshold: ≥ 18.0 ppm</span>
              </div>
              <div className="legend-item">
                <span className="legend-title">CH₄</span>
                <span className="legend-desc">Configured threshold: ≥ 4.0 % LEL</span>
              </div>
              <div className="legend-item">
                <span className="legend-title">O₂</span>
                <span className="legend-desc">Configured floor: ≤ 18.5 %</span>
              </div>
              <div className="legend-item">
                <span className="legend-title">AI Anomaly Debounce</span>
                <span className="legend-desc">3 consecutive samples</span>
              </div>
            </div>

            <div className="threshold-note">
              Threshold values shown are illustrative configuration values only.
            </div>
          </section>

          {/* Single Mandatory Safety Notice */}
          <footer className="footer-notice">
            SAFETY NOTICE — This application is a proof-of-concept system. It does not provide certified safety clearance, authorize real-world hazardous entry, replace calibrated gas detectors, or substitute for trained safety professionals. Threshold values shown are illustrative configuration values only and are not real-world safety limits.
          </footer>
        </main>
      </div>

      {/* XAI Explanation Modal */}
      <XaiExplanationModal factor={selectedFactor} history={history} onClose={() => setSelectedFactor(null)} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
