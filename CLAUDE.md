# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Deploy

```bash
# Frontend build (node lives at /usr/local/bin on Render)
export PATH="/usr/local/bin:$PATH"
cd frontend && npm run build

# Run backend locally
cd backend && node server.js

# Push to deploy (Render auto-deploys from main)
git push origin main
```

## Stack

- **Backend**: Node.js + Express + PostgreSQL (`pg` pool in `backend/database.js`)
- **Frontend**: React 18 + Vite + React Router v6
- **Auth**: HMAC-SHA256 token; frontend `POST /auth/login` → token stored in `localStorage.clinic_token`; all API calls go through `frontend/src/authFetch.js`
- **Deployment**: Render; backend and frontend are separate services; Render sets `PORT` env var

## Architecture

### Backend
```
backend/
  server.js          # Express app; mounts all routes after requireAuth middleware
  migrations.js      # Idempotent migration runner; runs on startup; tracks in schema_migrations
  database.js        # pg Pool export
  reminderJob.js     # node-cron hourly job for 24h / same-day / follow-up reminder emails
  routes/            # Thin controllers — validate inputs, call service, return JSON
  services/          # All SQL and business logic
  middleware/
    validate.js      # validate(schema) — body/query/params; rules: required, type, min/max, pattern
    errorHandler.js  # asyncHandler(fn) + global handler mapping PG codes 23503/23514/23505
```

### Frontend
```
frontend/src/
  main.jsx           # BrowserRouter + all Route definitions
  App.jsx            # Fixed sidebar nav + <Outlet />
  pages/             # One file per route
  services/          # API modules (one per resource); all use authFetch
  hooks/             # useAsync, useClients, useAppointments, useConflictCheck, useServices…
  context/           # AuthContext, SettingsContext
  utils/
    styleUtils.jsx   # MUST be .jsx — contains JSX (VIP badges). Exports outlineBtn, solidBtn, VIP_BADGE
    dateUtils.js
```

## Key Patterns

- **Service/controller split**: Routes parse/validate input and call service functions. All SQL lives in `backend/services/`.
- **asyncHandler**: Wrap every async route handler with `asyncHandler(async (req, res) => {...})`.
- **validate middleware**: Place before asyncHandler — `router.post('/', validate(schema), asyncHandler(...))`.
- **useAsync hook**: Initialises with `undefined` (not `null`) — destructuring defaults like `{ data: items = [] }` only fire on `undefined`.
- **Vite JSX rule**: Any file containing JSX **must** use `.jsx` extension or Vite build fails.

## Database Migrations

Migrations run automatically on server start via `runMigrations(pool)` in `migrations.js`. Add new entries to the `migrations` array — they are skipped if already recorded in `schema_migrations`.

Current range: 001–010 (updated_at trigger, FK constraints, status CHECK, indexes, therapists + therapist_schedules tables).

### Appointment status values
`tentative | confirmed | confirmed_by_client | done | cancelled | cancelled_by_client`

- **`tentative`**: never blocks scheduling slots; no emails sent on create; shown as amber dashed card on calendar.
- Conflict checks (`checkConflicts`, `checkTherapistConflict`) use `NOT IN ('cancelled', 'cancelled_by_client', 'tentative')`.
- Promoting tentative → confirmed: `PATCH /appointments/:id/confirm` (sends confirmation email).

## Appointment Conflict Checking

Two checks run inside a transaction with `SELECT ... FOR UPDATE` row-locking:
1. Global capacity: max 3 concurrent confirmed appointments per time slot.
2. Per-therapist: no double-booking the same therapist (text name match).

Both checks are **skipped entirely** when `apptStatus === 'tentative'`.

## Therapist / Shift Schedule Module

- **DB**: `therapists(id, name)` + `therapist_schedules(therapist_id FK, date TEXT, shift_type TEXT, UNIQUE(therapist_id, date))`.
- `shift_type` is free TEXT — no enum constraint.
- Frontend persists shift colors in `localStorage` key `clinic_shift_colors_v1`; custom shift names in `clinic_custom_shifts_v1`.
- Preset shifts (AM / PM / OFF) cannot be deleted; custom shifts can.

## Sidebar Navigation (App.jsx)

| Section | Nav link | Route |
|---|---|---|
| Schedule | Client Schedule | `/calendar` |
| Schedule | Shift Schedule | `/therapist-schedule` |
| Clients | Clients | `/clients` |
| Clients | Import CSV | `/import-clients` |
| Items | Stock | `/inventory` |
| System | Settings | `/settings` |

"+ Add Client" is a button on `ClientList.jsx`, **not** in the sidebar.
