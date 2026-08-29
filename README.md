# NAMASTE Sentinel — Confined Space Risk Intelligence Platform

> **Predictive Atmospheric Anomaly Intelligence & Safety Floor for Underground Workspaces**
> 
> *Proof-of-Concept Prototype for Hackathon Demonstration*

---

## 🌐 Real Public Deployment URLs (Live Internet Reachable)

- **Real Public Frontend & Full-Stack Application**: [https://05f8a001a7420129-103-179-52-14.serveousercontent.com/](https://05f8a001a7420129-103-179-52-14.serveousercontent.com/)
- **Real Public Backend API Base**: [https://05f8a001a7420129-103-179-52-14.serveousercontent.com](https://05f8a001a7420129-103-179-52-14.serveousercontent.com)
- **Real Public /health Endpoint**: [https://05f8a001a7420129-103-179-52-14.serveousercontent.com/health](https://05f8a001a7420129-103-179-52-14.serveousercontent.com/health)
- **Real Public Interactive API Docs (Swagger UI)**: [https://05f8a001a7420129-103-179-52-14.serveousercontent.com/docs](https://05f8a001a7420129-103-179-52-14.serveousercontent.com/docs)
- **Deployment Platform**: Serveo Secure Reverse HTTPS Tunnel (Zero-configuration public deployment)

*Note: For local development, the app also runs on http://127.0.0.1:8000 and http://localhost:5173.*

---

## 🚨 Safety & Prototype Disclaimer

> **IMPORTANT**: This application is a hackathon proof-of-concept demonstration. It **DOES NOT** provide certified safety clearance, authorize real-world hazardous entry, replace calibrated hardware gas detectors, or substitute for trained safety professionals. All threshold values (including the simulated 18.0 ppm H₂S ceiling) are illustrative demo parameters only and do not represent real-world safety limits or legal compliance standards.

---

## 📌 Problem Statement

Underground utility workers (sewer inspectors, manhole maintenance crews, industrial vault technicians) face severe risks from toxic gas accumulation—primarily **Hydrogen Sulfide (H₂S)**, **Methane (CH₄)**, and **Oxygen (O₂) displacement**. 

Traditional threshold-only alarms trigger *only after* hazardous gas concentrations have already reached dangerous levels. Furthermore, single-sensor spot detectors fail to analyze multivariate relationships (e.g., a simultaneous drop in O₂ combined with rising H₂S trends), leaving workers vulnerable to sudden atmospheric deterioration.

---

## 💡 Solution: NAMASTE Sentinel

**NAMASTE Sentinel** introduces a dual-layered risk intelligence model for confined spaces:

1. **Deterministic Safety Floor (Hard Rules)**: Immediate lockout if any gas level breaches predefined safety limits (e.g., H₂S ≥ 18 ppm, CH₄ ≥ 4% LEL, O₂ ≤ 18.5%).
2. **Multivariate AI Anomaly Engine**: An Isolation Forest machine learning model combined with multi-point trend slope analysis to detect subtle atmospheric deterioration **before** hard ceilings are hit.
3. **Transient Noise Debouncing**: Persistence windowing prevents single-sample sensor glitches from triggering false alarms or unnecessarily halting operations.
4. **Stale Telemetry Watchdog**: Automatically transitions the system state to `UNCERTAIN` if data streaming interrupts (>30 seconds).

---

## 🏗️ Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │       NAMASTE Sentinel Architecture          │
                               └──────────────────────────────────────────────┘

  ┌────────────────────────┐      POST /telemetry       ┌─────────────────────────────────┐
  │ Atmospheric Sensors /  ├───────────────────────────►│  FastAPI Backend Server         │
  │ Synthetic Simulator    │                            │  (http://127.0.0.1:8000)        │
  └────────────────────────┘                            └────────────────┬────────────────┘
                                                                         │
                                                                         ▼
                                                        ┌─────────────────────────────────┐
                                                        │  Multivariate Risk Engine       │
                                                        │  - Scikit-Learn Isolation Forest│
                                                        │  - Rate-of-Change Slope Scorer  │
                                                        │  - Hard-Rule Safety Floor       │
                                                        └────────────────┬────────────────┘
                                                                         │
                                                                         ▼
  ┌────────────────────────┐       REST API / Polling   ┌─────────────────────────────────┐
  │  React / Vite Dashboard│◄───────────────────────────┤  SQLite Persistence             │
  │  (http://localhost:5173│                            │  (telemetry & events database)  │
  └────────────────────────┘                            └─────────────────────────────────┘
```

---

## 🛠️ Technology Stack

- **Backend**: Python 3.13, FastAPI, Uvicorn, SQLite3, Scikit-learn (Isolation Forest), Pandas, NumPy, Pydantic v2
- **Frontend**: React 18, Vite, Vanilla CSS (Dark-mode Glassmorphism), SVG Sparklines
- **Testing**: Pytest, FastAPI TestClient

---

## 🚀 Quickstart & Setup (Start from Scratch)

### Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.0` or higher

### 1. Clone Repository
```bash
git clone https://github.com/your-org/namaste-sentinel.git
cd namaste-sentinel
```

### 2. Backend Setup
```bash
# Create and activate virtual environment (optional)
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Run backend test suite (17/17 tests passing)
python -m pytest

# Start FastAPI server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*Backend API & Built Production Dashboard will be live at [http://127.0.0.1:8000](http://127.0.0.1:8000) (Interactive Swagger Docs at `/docs`).*

### 3. Frontend Setup (Dev Mode)
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Vite Dev Dashboard will be live at [http://localhost:5173](http://localhost:5173).*

---

## 🎮 60–90 Second Judge Demo Sequence

Use the interactive **Judge Demo Controller** toolbar at the top of the dashboard:

| Step | Action Button | Observed System Behavior & Visual State |
| :--- | :--- | :--- |
| **0** | `🔄 0. Reset Baseline` | Resets database to clean `GO` baseline (Emerald Green card). |
| **1** | `🟢 1. Stable Baseline (GO)` | Simulates normal atmospheric telemetry. Decision remains `GO`. |
| **2** | `🟡 2. Deterioration (CAUTION)` | Simulates gradual O₂ decline and rising H₂S trend. AI detects slope risk → Card turns **Amber CAUTION**. |
| **3** | `🔴 3. Rapid Gas Spike (NO-GO)` | H₂S breaches 18 ppm ceiling → Card turns **Pulsing Red NO-GO** and creates an unacknowledged escalation alert in timeline. |
| **4** | `Acknowledge Alert` | Click button on timeline alert → Changes state to `✓ Acknowledged`. |
| **5** | `⚡ 4. Noise Spike (Debounced)` | Single transient glitch → Debounce engine holds state to prevent false lockout. |
| **6** | `🔄 5. Recovery (GO)` | Atmosphere stabilizes → Risk decays back to **Emerald Green GO**. |

---

## 🚢 Deployment Readiness Configuration

The project is structured for containerized or cloud deployment (Render, Railway, Fly.io, Vercel, AWS):

### Backend Deployment (Docker / Cloud PaaS)
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY frontend/dist ./frontend/dist
COPY pytest.ini .
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Production Build
```bash
cd frontend
npm run build
# Serves optimized production build from dist/ folder
```

---

## ⚠️ Limitations & Future Scope

- **Prototype Scope**: Designed as an illustrative proof-of-concept for hackathon evaluation.
- **Hardware Integration**: Includes hooks for future ESP32 / MQTT sensor telemetry ingestion.
- **Production Safety**: Real-world deployment requires industrial sensor calibration, intrinsically safe hardware packaging, and ATEX/IECEx certification.

---

## 📄 License

MIT License — Prototype Demonstration Code Only.
