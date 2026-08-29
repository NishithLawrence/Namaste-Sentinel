import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:8000' : '')
const SITE = 'MANHOLE-01'

const SENSOR_META = {
  h2s: { label: 'H₂S (Hydrogen Sulfide)', unit: 'ppm', limit: 'Simulated Threshold: ≥ 18.0 ppm' },
  ch4: { label: 'CH₄ (Methane)', unit: '% LEL', limit: 'Simulated Threshold: ≥ 4.0 % LEL' },
  o2: { label: 'O₂ (Oxygen)', unit: '%', limit: 'Simulated Threshold: ≤ 18.5 %' },
  temperature: { label: 'Temperature', unit: '°C', limit: 'Demo Baseline: ~28.0 °C' },
  humidity: { label: 'Humidity', unit: '%', limit: 'Demo Baseline: ~72 %' },
}

function MiniSparkline({ data, field }) {
  const { points, areaPoints, strokeColor, fillColor } = useMemo(() => {
    if (!data || data.length < 2) return { points: '', areaPoints: '', strokeColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.1)' }
    const vals = data.map(d => Number(d[field] ?? 0))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1

    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * 100
      const y = 90 - ((v - min) / span) * 75
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const stroke = field === 'o2' ? (vals.at(-1) <= 18.5 ? '#ef4444' : '#10b981') : (field === 'h2s' ? (vals.at(-1) >= 18 ? '#ef4444' : vals.at(-1) >= 6 ? '#f59e0b' : '#10b981') : '#38bdf8')
    const polylineStr = pts.join(' ')
    const areaStr = `0,95 ${polylineStr} 100,95`

    return { points: polylineStr, areaPoints: areaStr, strokeColor: stroke, fillColor: stroke }
  }, [data, field])

  return (
    <div className="sparkline-box">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${field}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon fill={`url(#grad-${field})`} points={areaPoints} />
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" points={points} />
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
    if (!isFresh) return '❓ PROTOTYPE STATUS: TELEMETRY UNCERTAIN (STALE DATA LINK)'
    if (decision === 'GO') return '✓ PROTOTYPE EVALUATION: ATMOSPHERE STABLE (GO)'
    if (decision === 'CAUTION') return '⚠️ PROTOTYPE EVALUATION: ELEVATED ANOMALY RISK (CAUTION)'
    if (decision === 'NO-GO') return '⛔ PROTOTYPE EVALUATION: SIMULATED BREACH (NO-GO)'
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
        <span className="badge">SIMULATED DEMO DATA</span>
        <span>NAMASTE Sentinel Proof-of-Concept — Illustrative Thresholds Only (Not Real Safety Limits)</span>
        <span className="badge">PROTOTYPE ONLY</span>
      </div>

      <div className="shell">
        {/* Header */}
        <header className="header">
          <div>
            <div className="brand-eyebrow">Confined Space Risk Intelligence Prototype</div>
            <h1>NAMASTE Sentinel</h1>
            <p>Multivariate Anomaly & Predictive Risk Intelligence Engine (Proof of Concept)</p>
          </div>

          <div className="site-badge-container">
            <div className="site-id">LOCATION: {SITE}</div>
            <div className="stream-status">
              <div className={`status-dot ${isFresh ? '' : 'stale'}`} />
              <span>{isFresh ? `LIVE SIMULATED STREAM` : `LINK STALE (${dataAge}s ago)`}</span>
            </div>
          </div>
        </header>

        <main>
          {error && <div className="notice">{error}</div>}

          {/* 60–90 Second Judge Demo Controller Toolbar */}
          <section className="controller-card">
            <div className="controller-header">
              <div className="controller-title">
                <span>🎮 60–90 SECOND JUDGE DEMO CONTROLLER</span>
              </div>
              <div className="controller-subtitle">Trigger synthetic simulation scenarios to test real-time AI anomaly scoring and hard-rule decisions</div>
            </div>

            <div className="demo-buttons-grid">
              <button disabled={busy} className="demo-btn reset" onClick={resetDemo}>
                {activeMode === 'reset' ? 'Resetting...' : '🔄 0. Reset Baseline'}
              </button>
              <button disabled={busy} className="demo-btn stable" onClick={() => simulate('normal')}>
                {activeMode === 'normal' ? 'Simulating...' : '🟢 1. Stable Baseline (GO)'}
              </button>
              <button disabled={busy} className="demo-btn decline" onClick={() => simulate('decline')}>
                {activeMode === 'decline' ? 'Simulating...' : '🟡 2. Deterioration (CAUTION)'}
              </button>
              <button disabled={busy} className="demo-btn rise" onClick={() => simulate('rise')}>
                {activeMode === 'rise' ? 'Simulating...' : '🔴 3. Rapid Gas Spike (NO-GO)'}
              </button>
              <button disabled={busy} className="demo-btn noise" onClick={() => simulate('noise')}>
                {activeMode === 'noise' ? 'Simulating...' : '⚡ 4. Noise Spike (Debounced)'}
              </button>
              <button disabled={busy} className="demo-btn recovery" onClick={() => simulate('recovery')}>
                {activeMode === 'recovery' ? 'Simulating...' : '🔄 5. Recovery (GO)'}
              </button>
            </div>
          </section>

          {/* Primary Safety Risk Decision Banner Card */}
          <section className={`risk-decision-card ${isFresh ? className : 'uncertain'}`}>
            <div className="decision-info">
              <div className="decision-badge-row">
                <span className="state-tag">{getDecisionBadgeText()}</span>
              </div>
              <div className="decision-title">{isFresh ? decision : 'UNCERTAIN'}</div>
              <div className="decision-reason">
                {status?.reason || 'Initialize simulation baseline to compute multivariate anomaly evaluation.'}
              </div>
            </div>

            <div className="risk-meter-box">
              <div className="risk-meter-label">ANOMALY SCORE</div>
              <div className="risk-score-num">{isFresh ? score : '?'}</div>
              <div className="risk-score-max">/ 100 SCALE</div>
            </div>
          </section>

          {/* Real-time Atmospheric Telemetry & Sparklines */}
          <section>
            <div className="section-header">
              <h2>Simulated Atmospheric Telemetry Streams</h2>
              <span>{history.length} time-series data points</span>
            </div>

            <div className="sensors-grid">
              {Object.keys(SENSOR_META).map(field => {
                const meta = SENSOR_META[field]
                const val = history.length ? Number(history.at(-1)[field] ?? 0) : 0
                const trend = calcTrend(field)

                return (
                  <div className="sensor-card" key={field}>
                    <div className="sensor-top">
                      <div className="sensor-name">{meta.label}</div>
                    </div>

                    <div className="sensor-val-row">
                      <div className="sensor-val">{val > 0 ? val.toFixed(2) : '—'}</div>
                      <div className="sensor-unit">{meta.unit}</div>
                      <div className={`sensor-trend ${trend.cls}`}>{trend.text}</div>
                    </div>

                    <div className="sensor-limit">{meta.limit}</div>
                    <MiniSparkline data={history} field={field} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* Two Column Section: Explainability Factors & Event Timeline */}
          <section className="two-col-grid">
            {/* Panel 1: Explainable AI Anomaly Factors */}
            <div className="panel-card">
              <div className="section-header" style={{ margin: '0 0 16px 0' }}>
                <h2>Multivariate Anomaly Factors</h2>
                <span>Explainable AI Driver Hierarchy</span>
              </div>

              {(status?.factors || []).length ? (
                <div className="factors-list">
                  {status.factors.map(f => {
                    const pct = Math.min((f.impact / 4) * 100, 100)
                    return (
                      <div className="factor-item" key={f.feature}>
                        <div className="factor-info">
                          <b>{f.feature}</b>
                          <span>{f.direction}</span>
                        </div>
                        <div className="factor-bar-bg">
                          <div className="factor-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="factor-impact-val">{f.impact.toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-msg">No active risk drivers detected. Telemetry signals stable against prototype baseline.</div>
              )}
            </div>

            {/* Panel 2: Simulated Event Timeline & Escalation Log */}
            <div className="panel-card">
              <div className="section-header" style={{ margin: '0 0 16px 0' }}>
                <h2>Simulated Event Timeline</h2>
                <span>{events.length} system audit records</span>
              </div>

              {events.length ? (
                <div className="events-list">
                  {events.map(e => (
                    <div className={`event-item ${!e.acknowledged && e.severity === 'NO-GO' ? 'unack' : ''}`} key={e.id}>
                      <div className={`event-sev-indicator ${e.severity}`} />
                      <div className="event-details">
                        <div className="event-details-top">
                          <span className="event-type-badge">{e.event_type} [{e.severity}]</span>
                          <span className="event-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="event-msg">{e.message}</div>

                        {!e.acknowledged ? (
                          <button className="ack-btn" onClick={() => acknowledge(e.id)}>
                            Acknowledge Alert
                          </button>
                        ) : (
                          <span className="ack-done">✓ Acknowledged</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-msg">No critical events logged. Click simulation controls above to test escalation.</div>
              )}
            </div>
          </section>

          {/* Prototype Demo Threshold Legend Card */}
          <section className="threshold-legend-card">
            <div className="section-header" style={{ margin: 0 }}>
              <h2>Simulated Demo Thresholds & Prototype Decision Rules</h2>
              <span>Illustrative Demo Thresholds — Not Real-World Safety Standards</span>
            </div>

            <div className="legend-grid">
              <div className="legend-item">
                <b>H₂S Demo Limit: ≥ 18.0 ppm</b>
                <span>Simulated demo safety ceiling. Illustrative prototype limit; does not replace OSHA/NIOSH standards.</span>
              </div>
              <div className="legend-item">
                <b>CH₄ Demo Limit: ≥ 4.0 % LEL</b>
                <span>Simulated demo safety ceiling. Illustrative prototype limit only.</span>
              </div>
              <div className="legend-item">
                <b>O₂ Demo Limit: ≤ 18.5 %</b>
                <span>Simulated demo oxygen floor limit. Illustrative prototype limit only.</span>
              </div>
              <div className="legend-item">
                <b>AI Anomaly Debounce: 3 Samples</b>
                <span>Requires sustained risk to prevent false noise lockout in prototype simulation.</span>
              </div>
            </div>
          </section>

          {/* Mandatory Legal & Safety Disclaimer */}
          <footer className="footer">
            PROTOTYPE & DEMO INTERFACE ONLY — This application is a hackathon proof-of-concept demonstration. It DOES NOT provide certified safety clearance, authorize real-world hazardous entry, replace calibrated hardware gas detectors, or substitute for trained safety professionals. All thresholds (including the 18 ppm H₂S demo limit) are illustrative prototype values only.
          </footer>
        </main>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
