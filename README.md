# ORBIT WAVE Smart Home Dashboard — Upgraded Architecture

Modernized, full-stack Smart Home platform built with **React + Vite**, **Node.js Express**, **Firebase Realtime Database**, **Apache Kafka**, **Apache Flink**, **Apache Airflow**, and **Grok AI**.

---

## 🏛️ System Architecture

```text
                         ┌─────────────────────────────────────────┐
                         │       React + Vite UI Dashboard         │
                         │  • Live Device Controls & Switches      │
                         │  • Telemetry Displays & Real-time Charts│
                         │  • MediaPipe Camera Gesture Control     │
                         │  • Grok AI Chatbot with Firebase Context│
                         │  • Pipeline Health & Alert Center       │
                         └───────▲─────────────────────────▲───────┘
                                 │ Direct RTDB Listener    │ HTTP/WS
                                 │                         │
                         ┌───────┴────────┐       ┌────────┴────────┐
                         │    Firebase    │       │  Node Backend   │
                         │Realtime Database│       │  • Grok AI API  │
                         │(Source of Truth│       │  • Health Check │
                         │for Live State) │       │  • Kafka Bridge │
                         └───────▲────────┘       └────────▲────────┘
                                 │                         │
                      ┌──────────┴──────────┐              │ Event Ingestion
                      │    Raspberry Pi     │              │
                      │   / IoT Sensors     │              ▼
                      └─────────────────────┘     ┌─────────────────┐
                                                  │  Apache Kafka   │
                                                  │ (sensor/device  │
                                                  │  event topics)  │
                                                  └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │  Apache Flink   │
                                                  │ (Stream Window  │
                                                  │ Avg/Min/Max/    │
                                                  │ Trends/Anomaly) │
                                                  └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ Derived Stream  │
                                                  │  to Firebase /  │
                                                  │ React Analytics │
                                                  └─────────────────┘

                         ┌─────────────────────────────────────────┐
                         │             Apache Airflow              │
                         │  • Daily Sensor Aggregations DAG        │
                         │  • System & Pipeline Health Check DAG   │
                         │  • Historical Data Maintenance DAG      │
                         └─────────────────────────────────────────┘
```

---

## 📦 Project Structure

```text
.
├── frontend/                     # React + Vite Application
│   ├── src/
│   │   ├── components/           # UI Components (SensorCard, LightCard, SafeMode, Scheduler, etc.)
│   │   ├── pages/                # Dashboard, Analytics, Gesture Control, Chatbot, Pipeline Health
│   │   ├── services/             # Direct Firebase Realtime listeners and Backend API client
│   │   ├── gesture/              # Vision camera gesture recognition module
│   │   └── styles/               # Polished styling with 3D switches & vibrations
│   ├── public/                   # Logo and static assets
│   └── Dockerfile
├── backend/                      # Node.js API, Grok AI integration & Kafka Bridge
│   ├── src/
│   │   ├── config/               # Firebase, Kafka configuration
│   │   ├── routes/               # /api/chat, /api/health, /api/telemetry, /api/analytics
│   │   ├── services/             # Firebase snapshot builder, Grok AI agent, Kafka producer/consumer
│   │   └── server.js             # Express app entrypoint
│   ├── test/                     # Backend unit tests
│   └── Dockerfile
├── flink/                        # Real-time stream processing
│   ├── jobs/                     # PyFlink streaming analytics script
│   ├── stream_processor.js       # Streaming sliding-window analytics engine
│   ├── test/                     # Flink unit test suite
│   └── Dockerfile
├── airflow/                      # Batch & scheduled workflows
│   ├── dags/                     # Daily Analytics, System Health, Data Maintenance DAGs
│   └── Dockerfile
├── docker-compose.yml            # Multi-service container orchestration
└── README.md
```

---

## 🚀 Getting Started

### 1. Local Development (Node.js)

#### Backend:
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:5000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:3000
```

### 2. Docker Compose Deployment
```bash
docker compose up --build
```
- **React Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **Flink Dashboard**: `http://localhost:8081`
- **Airflow Webserver**: `http://localhost:8080`

---

## 🧪 Testing Suite

- **Backend Unit & Integration Tests**:
  ```bash
  cd backend && npm test
  ```
- **Flink Stream Analytics Tests**:
  ```bash
  cd flink && npm test
  ```
- **Airflow DAG Syntax Validation**:
  ```bash
  python -m py_compile airflow/dags/*.py
  ```
- **Frontend Production Build**:
  ```bash
  cd frontend && npm run build
  ```

---

## 🔒 Security & Privacy
- Grok API keys are kept strictly on the server side in `backend/.env`.
- Frontend never receives or exposes sensitive credentials.
- Safe Mode locks down physical control toggles and dispatches instant security alerts upon movement.
