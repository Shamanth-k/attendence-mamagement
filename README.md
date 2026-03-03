# Attendance Management (React + Node Microservices + MySQL)

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express microservices
- API Gateway: Express + reverse proxy
- Database: MySQL (XAMPP)
- Fingerprint Ingestion: Biometric microservice endpoint (`/api/biometric/punch`)

## Architecture
- `frontend` (port 5173)
- `backend/gateway` (port 8080)
- `backend/services/master-service` (port 5001)
- `backend/services/attendance-service` (port 5002)
- `backend/services/report-service` (port 5003)
- `backend/services/biometric-service` (port 5004)

Gateway routes:
- `/api/master/*` -> master service
- `/api/attendance/*` -> attendance service
- `/api/report/*` -> report service
- `/api/biometric/*` -> biometric service

Auth routes at gateway:
- `POST /auth/bootstrap` (one-time, only when no users exist)
- `POST /auth/login`

Additional API used by UI interactions:
- `GET /api/master/employees`
- `GET /api/attendance/range/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/attendance/summary-range/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Setup
1. Start XAMPP MySQL.
2. Create database/tables using `sql/schema.sql` in phpMyAdmin or MySQL CLI.
3. Import scanner-based seed data using `sql/fingerprint_seed.sql`.
4. Copy `backend/.env.example` to `backend/.env` and update credentials.
5. Copy `frontend/.env.example` to `frontend/.env` if gateway URL is different.
6. From project root, run:

```bash
npm install
```

## Run
Single command (works on Windows PowerShell/CMD, macOS Terminal, and Linux shells):

```bash
npm run dev
```

Or run services separately:

```bash
npm run dev:master
npm run dev:attendance
npm run dev:report
npm run dev:biometric
npm run dev:gateway
npm run dev:frontend
```

Then open `http://localhost:5173`.

## Security / Governance
- JWT authentication and role-based access control are enforced at gateway.
- Audit logs are written for all service requests (except `/health`) into `audit_logs`.
- Biometric ingestion supports encrypted payload storage (`payload_encrypted`) when `DATA_ENCRYPTION_KEY` is provided.

Default seeded user (from `sql/schema.sql`):
- `username`: `admin`
- `password`: `admin123`

Use bearer token after login:
`Authorization: Bearer <token>`

## Alerts / Analytics / Ingestion APIs
- Alerts (rule engine):
  - `GET /api/attendance/alerts/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `POST /api/attendance/alerts/run/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/attendance/alerts-stored/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Predictive/anomaly analytics:
  - `GET /api/report/predictive/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/report/anomalies/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Multi-source ingestion:
  - `POST /api/biometric/ingest` with `source_type` (`biometric|rfid|mobile|manual|api`) and `records[]`

## Seed / Reseed
To reload scanner data (employees + attendance + biometric events), re-import `sql/fingerprint_seed.sql`.

To regenerate `sql/fingerprint_seed.sql` from new scanner reports:

```powershell
powershell -ExecutionPolicy Bypass -File .\sql\generate_fingerprint_seed.ps1
```

## Cross-Platform Notes
- Frontend is responsive for desktop, tablet, and mobile widths.
- API URL is configurable with `VITE_API_BASE_URL`, so UI works the same on macOS/Linux/Windows.
- Use Node.js 18+ and npm 9+ for consistent behavior across OSes.

## Fingerprint Scanner Integration
Most scanners expose SDK events or webhook callbacks. On each verification/punch, send this payload to gateway:

`POST http://localhost:8080/api/biometric/punch`

```json
{
  "employee_code": "EMP-1001",
  "scanner_id": "DEVICE-01",
  "punch_type": "IN",
  "device_timestamp": "2025-10-16 09:10:00",
  "payload": {
    "quality": 88,
    "template_id": "T-234"
  }
}
```

The event is saved in `biometric_events`. You can later add a processing worker to convert raw punches into `attendance_logs` rows.
