# Attendance Management

Attendance Management is a full-stack employee attendance system built as an Electron desktop application with a React frontend, a Node.js microservice backend, and a MySQL database. The repository includes:

- An Electron shell for running the app as a native desktop application
- A Vite + React frontend
- An API gateway for authentication and request routing
- Separate services for master data, attendance, reporting, and biometric ingestion
- SQL schemas and seed data for local development

## Project Structure

```text
attendance management/
├── electron/
│   ├── main.js                  # Electron main process
│   ├── preload.js               # Secure context bridge
│   └── splash.html              # Boot splash screen
├── frontend/
│   └── src/
├── backend/
│   ├── gateway/
│   ├── services/
│   │   ├── master-service/
│   │   ├── attendance-service/
│   │   ├── report-service/
│   │   └── biometric-service/
│   └── shared/
├── sql/
│   ├── schema_v2_role_based.sql
│   ├── schema.sql
│   ├── fingerprint_seed.sql
│   └── generate_fingerprint_seed.ps1
├── electron-builder.config.js   # Packaging configuration
└── package.json
```

## Tech Stack

- Desktop Shell: Electron 42, electron-builder
- Frontend: React 18, Vite, React Router, Axios, Recharts
- Backend: Node.js, Express, Nodemon
- Database: MySQL
- Auth: JWT via the gateway
- Package management: npm workspaces

## Ports Used

- Frontend: `5173`
- Gateway: `8080`
- Master service: `5001`
- Attendance service: `5002`
- Report service: `5003`
- Biometric service: `5004`
- MySQL: `3306`

## Prerequisites

Install these before running the project:

1. Node.js 18+ and npm
2. MySQL 8+ or XAMPP MySQL
3. Git

To verify:

```powershell
node -v
npm -v
mysql --version
```

## Important Setup Choice

Use `sql/schema_v2_role_based.sql` for the current application.

This is the schema that matches the current frontend and backend features, including:

- `ADMIN` / `EMPLOYEE` roles
- first-login password flow
- `holidays` table
- `password_reset_tokens` table
- current session-based auth structure

`sql/schema.sql` is an older schema and should be treated as legacy unless you intentionally want the older setup.

## First-Time Setup

### 1. Clone the repository

```powershell
git clone https://github.com/Shamanth-k/attendence-mamagement.git
cd "attendance management"
```

### 2. Install all dependencies

Run this once from the project root:

```powershell
npm install
```

Because this repo uses npm workspaces, that single command installs dependencies for:

- the root workspace (including Electron and electron-builder)
- `frontend`
- `backend/gateway`
- `backend/services/master-service`
- `backend/services/attendance-service`
- `backend/services/report-service`
- `backend/services/biometric-service`

### 3. Create the database

Open MySQL and run:

```sql
CREATE DATABASE IF NOT EXISTS attendance_management;
```

You can do this from:

- phpMyAdmin
- MySQL Workbench
- MySQL command line

### 4. Import the main schema

Import this file:

- `sql/schema_v2_role_based.sql`

Using MySQL CLI:

```powershell
mysql -u root -p attendance_management < sql\schema_v2_role_based.sql
```

If your MySQL user is not `root`, replace it with your actual username.

### 5. Import attendance seed data

After the main schema is imported, import:

- `sql/fingerprint_seed.sql`

Using MySQL CLI:

```powershell
mysql -u root -p attendance_management < sql\fingerprint_seed.sql
```

This file provides scanner-based sample data used by the app.

### 6. Configure backend environment variables

Create `backend/.env` from the example file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Required variables in `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=attendance_management
AUTH_REQUIRED=false
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=8h
LATE_AFTER_MINUTES=555
ABSENTEEISM_THRESHOLD=3
# DATA_ENCRYPTION_KEY=
```

What each one does:

- `DB_HOST`: MySQL host
- `DB_PORT`: MySQL port
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: Database name, normally `attendance_management`
- `AUTH_REQUIRED`: Set to `true` to enforce auth at the gateway; `false` is convenient for some local development scenarios
- `JWT_SECRET`: Secret used to sign login tokens
- `JWT_EXPIRES_IN`: Token lifetime
- `LATE_AFTER_MINUTES`: Late threshold in minutes from midnight. `555` means `09:15`
- `ABSENTEEISM_THRESHOLD`: Threshold used by attendance analytics
- `DATA_ENCRYPTION_KEY`: Optional 64-character hex key for AES-256-GCM encrypted biometric payload storage

### 7. Configure frontend environment variables

Create `frontend/.env` from the example file:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Default frontend env in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

Only change this if your gateway is not running on `http://localhost:8080`.

## Default Login

If you import `sql/schema_v2_role_based.sql`, the default admin user is created automatically:

- Username: `admin`
- Password: `admin123`

Because that schema seeds `is_first_login = 0`, you should be able to log in immediately without the forced first-password-change screen.

## How to Run the Project

### Option 1: Electron Desktop App (Recommended)

Launch the app as a native desktop window. Electron automatically starts all backend services, the Vite dev server, and opens the app in its own window:

```powershell
npm run electron:dev
```

What happens when you run this:

1. A splash screen appears while services boot
2. All five backend services start (master, attendance, report, biometric, gateway)
3. The Vite dev server starts on port 5173
4. Once everything is ready, the splash screen closes and the main app window opens

### Option 2: Browser Mode

Run all services and open the app in your regular browser:

```powershell
npm run dev
```

After startup, open `http://localhost:5173` in your browser.

### Run services individually

If you want to debug one service at a time, use these commands from the project root:

```powershell
npm run dev:master
npm run dev:attendance
npm run dev:report
npm run dev:biometric
npm run dev:gateway
npm run dev:frontend
```

## Electron Desktop App

### Overview

The app is wrapped in Electron to run as a standalone desktop application. When launched, it:

- Spawns all backend microservices as child processes
- Starts the Vite dev server (in development) or loads the built frontend (in production)
- Shows a splash screen while services boot up
- Provides a native application menu with File, Edit, View, and Window options
- Enforces single-instance lock so only one window can be open at a time
- Cleans up all child processes on exit

### Electron Files

| File | Purpose |
|------|---------|
| `electron/main.js` | Main process — service spawning, window management, lifecycle |
| `electron/preload.js` | Secure bridge between Node.js and the renderer via `contextBridge` |
| `electron/splash.html` | Loading screen displayed during service startup |
| `electron-builder.config.js` | Packaging configuration for Windows, macOS, and Linux |

### Security Configuration

The Electron shell follows recommended security practices:

- `contextIsolation: true` — renderer cannot access Node.js globals
- `nodeIntegration: false` — no `require()` available in the browser window
- `sandbox: true` — renderer runs in a sandboxed process
- `webSecurity: true` — same-origin policy is enforced
- Preload uses `contextBridge` to expose only a minimal API (`getVersion`, `isPackaged`, `platform`)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run electron:dev` | Launch the Electron app in development mode |
| `npm run electron:build` | Build the frontend and create a distributable installer |
| `npm run electron:pack` | Build the frontend and create an unpacked directory for testing |
| `npm run dev` | Run all services in browser mode (no Electron) |

### Building for Distribution

To create a production installer:

```powershell
npm run electron:build
```

This will:

1. Build the Vite frontend into `frontend/dist/`
2. Package the app using electron-builder
3. Output the installer to the `release/` directory

Supported targets:

- Windows: NSIS installer (`.exe`)
- macOS: DMG disk image
- Linux: AppImage and `.deb` package

### App Icon

Place your app icon at `electron/icon.png` (minimum 256x256, recommended 512x512). For Windows, you can also provide `electron/icon.ico` and update `electron-builder.config.js` accordingly.

## Production-Like Start Commands

Each service also has a `start` script. If needed, you can start them separately:

```powershell
npm --workspace backend/services/master-service run start
npm --workspace backend/services/attendance-service run start
npm --workspace backend/services/report-service run start
npm --workspace backend/services/biometric-service run start
npm --workspace backend/gateway run start
npm --workspace frontend run build
```

## Routing Overview

The gateway exposes these service routes:

- `/api/master/*` -> master service
- `/api/attendance/*` -> attendance service
- `/api/report/*` -> report service
- `/api/biometric/*` -> biometric service

Auth-related routes handled by the gateway include:

- `POST /auth/bootstrap`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `PATCH /auth/profile/name`
- `PATCH /auth/profile/password`
- `POST /auth/force-change-password`

## What Must Be Changed Before Running on Another Machine

At minimum, review and update these values:

1. `backend/.env`
   - Set `DB_USER`
   - Set `DB_PASSWORD`
   - Confirm `DB_HOST`
   - Confirm `DB_PORT`
   - Confirm `DB_NAME`
   - Change `JWT_SECRET` to your own secure value
   - Set `AUTH_REQUIRED=true` if you want authentication strictly enforced

2. `frontend/.env`
   - Change `VITE_API_BASE_URL` only if the gateway URL is different

3. MySQL data
   - Import `sql/schema_v2_role_based.sql`
   - Import `sql/fingerprint_seed.sql`

4. Optional biometric encryption
   - Add `DATA_ENCRYPTION_KEY` if you want encrypted biometric payload storage
   - It must be a 64-character hexadecimal string

## Quick Start Checklist

If you just want the shortest correct path:

1. Install Node.js and MySQL
2. Run `npm install`
3. Create database `attendance_management`
4. Import `sql/schema_v2_role_based.sql`
5. Import `sql/fingerprint_seed.sql`
6. Create `backend/.env` from `backend/.env.example`
7. Create `frontend/.env` from `frontend/.env.example`
8. Update MySQL credentials in `backend/.env`
9. Run `npm run electron:dev` (desktop) or `npm run dev` (browser)
10. Log in with `admin` / `admin123`

## Common Problems and Fixes

### 1. `Access denied for user` from MySQL

Cause:
- MySQL username or password in `backend/.env` is wrong

Fix:
- Update `DB_USER` and `DB_PASSWORD`
- Make sure MySQL is running

### 2. `ECONNREFUSED` to MySQL

Cause:
- MySQL server is not started
- Wrong host or port

Fix:
- Start MySQL/XAMPP
- Check `DB_HOST` and `DB_PORT`

### 3. Frontend opens but API calls fail

Cause:
- Gateway is not running
- `VITE_API_BASE_URL` is wrong

Fix:
- Make sure `npm run dev` started the gateway
- Confirm gateway is on `http://localhost:8080`
- Check `frontend/.env`

### 4. Login fails for `admin`

Cause:
- The database was not seeded with the v2 schema
- The database was reset with the legacy schema

Fix:
- Re-import `sql/schema_v2_role_based.sql`
- Re-import `sql/fingerprint_seed.sql`

### 5. App crashes with SQL table errors

Cause:
- The wrong schema was imported

Fix:
- Use `sql/schema_v2_role_based.sql`
- Do not rely on `sql/schema.sql` for the current UI

### 6. Services crash with syntax errors after `git pull`

Cause:
- Merge conflicts were left unresolved

Fix:
- Run `git status`
- Resolve conflicted files
- Finish the merge before running `npm run dev`

### 7. Electron app closes immediately after splash screen

Cause:
- A previous version had a race condition where destroying the splash screen triggered app quit before the main window was created

Fix:
- Pull the latest version of `electron/main.js`
- The current version creates the main window before destroying the splash

### 8. Electron services exit with code 1

Cause:
- MySQL is not running, so backend services fail to connect and exit
- Port conflict with another process using the same port

Fix:
- Start MySQL before launching the Electron app
- Check that ports 5001-5004, 5173, and 8080 are not in use

## Fingerprint Seed Regeneration

If you receive new fingerprint export data and want to regenerate the SQL seed file, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\sql\generate_fingerprint_seed.ps1
```

This updates:

- `sql/fingerprint_seed.sql`

## Notes for Developers

- Root `npm run dev` uses `concurrently` to start all apps together
- `npm run electron:dev` uses Electron's main process to spawn services as child processes
- Backend services load env values from `backend/.env`
- The frontend talks to the gateway, not directly to individual services
- The gateway handles auth and forwards API traffic to the backend services
- In Electron, the frontend uses `HashRouter` for `file://` protocol compatibility; in browser mode, it uses `BrowserRouter`
- The `electron/preload.js` exposes `window.electronAPI` which the frontend uses to detect the Electron environment

## Legacy Schema Note

`sql/schema.sql` still exists in the repository, but it represents an older structure. Use it only if you intentionally want the older non-current schema version.
