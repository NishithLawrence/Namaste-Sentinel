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

function App() {
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [activeMode, setActiveMode] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [s, t, e] = await Promise.all([
        fetch(`${API}/sites/${SITE}/status`),
        fetch(`${API}/sites/${SITE}/telemetry?limit=90`),
        fetch(`${API}/sites/${SITE}/events?limit=12`)
      ])
      if (!s.ok) throw new Error('No telemetry found. Click "Reset Baseline" to initialize prototype demo.')
      setStatus(await s.json())
      setHistory(await t.json())
      setEvents(await e.json())
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [])

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

  const getDecisionBadgeText = () => {
    if (!isFresh) return '! UNCERTAIN — TELEMETRY LINK STALE'
    if (decision === 'GO') return '✓ GO — ATMOSPHERE STABLE (BASELINE CLEAR)'
    if (decision === 'CAUTION') return '⚠ CAUTION — PREDICTIVE AI ANOMALY (SAFETY RULES CLEAR)'
    if (decision === 'NO-GO') {
      return status?.rule_state === 'NO-GO'
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
    <div>
      {/* Permanent Mandatory Notice Banner */}
      <div className="demo-top-banner">
        <span className="badge">SIMULATION MODE — PROTOTYPE DATA</span>
        <span>Illustrative thresholds only — not real-world safety limits.</span>
      </div>

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

          {/* Operational Intelligence Pipeline Ribbon */}
          <div className="pipeline-ribbon">
            <div className="pipeline-step">
              <span className="step-num">1</span>
              <span className="step-label">SENSOR CHANGE</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className="pipeline-step">
              <span className="step-num">2</span>
              <span className="step-label">TREND / ANOMALY</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className="pipeline-step">
              <span className="step-num">3</span>
              <span className="step-label">AI RISK</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className="pipeline-step">
              <span className="step-num">4</span>
              <span className="step-label">HARD SAFETY RULE</span>
            </div>
            <span className="pipeline-arrow">➔</span>
            <div className="pipeline-step final">
              <span className="step-num">5</span>
              <span className="step-label">DECISION & ESCALATION</span>
            </div>
          </div>

          {/* Primary Safety Risk Decision Banner Card */}
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
                  <strong>SAFETY RULES:</strong> {status?.rule_state === 'NO-GO' ? '⛔ BREACHED (OVERRIDE)' : '✓ CLEAR (0 BREACHES)'}
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

          {/* Decision Evidence Panel (Multivariate Anomaly Factors) - Full Width Compact Panel */}
          <section className="evidence-panel-section">
            <div className="panel-card evidence-panel">
              <div className="panel-header">
                <h2>DECISION EVIDENCE</h2>
                <span>Multivariate Anomaly Factors & Explainable AI Hierarchy</span>
              </div>

              {(status?.factors || []).length ? (
                <div className="factors-compact-grid">
                  {status.factors.map((f, idx) => {
                    const pct = Math.min((f.impact / 4) * 100, 100)
                    const rank = idx === 0 ? 'PRIMARY DRIVER' : (idx === 1 ? 'SECONDARY DRIVER' : 'CONTRIBUTING FACTOR')
                    return (
                      <div className="factor-compact-card" key={f.feature}>
                        <div className="factor-top">
                          <span className="factor-rank-badge">{rank}</span>
                          <span className="factor-val">{f.impact.toFixed(2)}</span>
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
                <div className="empty-msg">No active risk drivers detected. Telemetry signals stable against prototype baseline.</div>
              )}
            </div>
          </section>

          {/* Unified Incident Response Log Panel */}
          <section className="incident-log-section">
            <div className="panel-card incident-log-panel">
              <div className="panel-header">
                <h2>SAFETY EVENT LOG</h2>
                <span>Detection, warning, escalation and acknowledgement history ({events.length} records)</span>
              </div>

              {events.length ? (
                <div className="incident-log-scroll">
                  {events.map(e => (
                    <div className={`incident-row ${!e.acknowledged && e.severity === 'NO-GO' ? 'unack' : ''}`} key={e.id}>
                      <div className="incident-icon-col">
                        {e.severity === 'NO-GO' && <span style={{ color: '#D61F3A', fontWeight: 'bold' }}>⛔</span>}
                        {e.severity === 'CAUTION' && <span style={{ color: '#F5A623', fontWeight: 'bold' }}>⚠</span>}
                        {e.severity === 'GO' && <span style={{ color: '#16845A', fontWeight: 'bold' }}>✓</span>}
                      </div>
                      <div className="incident-time-col">
                        <span className="incident-timestamp">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="incident-main-col">
                        <div className="incident-type-tag">{e.event_type} [{e.severity}]</div>
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
                <div className="empty-msg">No critical events logged. Click simulation controls below to test escalation.</div>
              )}
            </div>
          </section>

          {/* Scenario Controller Toolbar */}
          <section className="controller-card">
            <div className="controller-header">
              <div className="controller-title">
                <span>🎛 SCENARIO CONTROLLER</span>
              </div>
              <div className="controller-subtitle">Run controlled scenarios to evaluate real-time anomaly scoring and safety decisions.</div>
            </div>

            <div className="demo-buttons-grid">
              <button disabled={busy} className="demo-btn reset" onClick={resetDemo}>
                {activeMode === 'reset' ? 'Resetting...' : '🔄 Reset Baseline'}
              </button>
              <button disabled={busy} className="demo-btn stable" onClick={() => simulate('normal')}>
                {activeMode === 'normal' ? 'Simulating...' : '✓ Stable Baseline (GO)'}
              </button>
              <button disabled={busy} className="demo-btn decline" onClick={() => simulate('decline')}>
                {activeMode === 'decline' ? 'Simulating...' : '⚠ Deterioration (CAUTION)'}
              </button>
              <button disabled={busy} className="demo-btn rise" onClick={() => simulate('rise')}>
                {activeMode === 'rise' ? 'Simulating...' : '⛔ Rapid Gas Spike (NO-GO)'}
              </button>
              <button disabled={busy} className="demo-btn noise" onClick={() => simulate('noise')}>
                {activeMode === 'noise' ? 'Simulating...' : '⚡ Noise Spike (Debounced)'}
              </button>
              <button disabled={busy} className="demo-btn recovery" onClick={() => simulate('recovery')}>
                {activeMode === 'recovery' ? 'Simulating...' : '🔄 Recovery (GO)'}
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
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
