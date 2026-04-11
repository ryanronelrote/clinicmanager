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
  server.js                      # Express app; mounts all routes after requireAuth middleware
  migrations.js                  # Idempotent migration runner; runs on startup; tracks in schema_migrations
  database.js                    # pg Pool export
  reminderJob.js                 # node-cron hourly job for 24h / same-day / follow-up reminder emails
  emailService.js                # Nodemailer SMTP helpers
  emailTemplates.js              # HTML email template builders
  routes/
    appointments.js
    auth.js
    blockedSlots.js
    clients.js
    dashboard.js                 # KPI / sales dashboard endpoints
    inventory.js
    invoices.js                  # Invoice CRUD + payment recording
    services.js
    settings.js
    staff.js                     # Staff (non-therapist) management
    therapistSchedule.js
  services/                      # All SQL and business logic
    appointmentService.js
    invoiceService.js
    kpiDashboardService.js
    paymentService.js
    therapistScheduleService.js
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
    Calendar.jsx, AddAppointment.jsx, AppointmentDetail.jsx, BlockTime.jsx
    ClientList.jsx, AddClient.jsx, ClientDetail.jsx, ImportClients.jsx
    InvoiceList.jsx, CreateInvoice.jsx, InvoiceDetail.jsx
    Dashboard.jsx                # Sales KPI dashboard
    InventoryList.jsx, AddInventoryItem.jsx, InventoryDetail.jsx
    Home.jsx, Login.jsx, Settings.jsx, TherapistSchedule.jsx
  services/          # API modules (one per resource); all use authFetch
    appointmentService.js, blockedSlotService.js, clientService.js
    dashboardService.js, inventoryService.js, invoiceService.js
    serviceService.js, settingsService.js, staffService.js
    therapistScheduleService.js
  hooks/             # useAsync, useClients, useAppointments, useConflictCheck, useServices
                     # useClient, useInventory, useInventoryItem, useSettings
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

Current range: 001–018 (updated_at trigger, FK constraints, status CHECK, indexes, therapists + therapist_schedules, invoices + invoice_items + payments, staff, invoice/payment date columns).

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

## Invoices / Billing Module

- **DB tables**: `invoices`, `invoice_items`, `payments`, `staff` (all created via migrations 011–018).
- `invoices` has `invoice_date DATE` (Manila local date, not UTC timestamp) and `created_by TEXT`.
- `payments` has `payment_date DATE` and `received_by TEXT`.
- `invoice_items` stores line items with `quantity`, `unit_price`, `subtotal`.
- Backend: `routes/invoices.js` → `services/invoiceService.js`; payments are sub-resources (`POST /invoices/:id/payments`).
- KPI dashboard: `routes/dashboard.js` → `services/kpiDashboardService.js`; frontend at `/dashboard`.

## Staff Module

- **DB table**: `staff(id, name, role, created_at)` — distinct from `therapists` table.
- Route: `routes/staff.js`; frontend service: `staffService.js`.
- Used for populating `created_by` / `received_by` dropdowns on invoice/payment forms.

## Therapist / Shift Schedule Module

- **DB**: `therapists(id, name)` + `therapist_schedules(therapist_id FK, date TEXT, shift_type TEXT, UNIQUE(therapist_id, date))`.
- `shift_type` is free TEXT — no enum constraint.
- Frontend persists shift colors in `localStorage` key `clinic_shift_colors_v1`; custom shift names in `clinic_custom_shifts_v1`.
- Preset shifts (AM / PM / OFF) cannot be deleted; custom shifts can.

## Sidebar Navigation (App.jsx)

| Section | Nav link | Route | Style |
|---|---|---|---|
| *(top)* | Home | `/` | navLink |
| Schedule | Client Schedule | `/calendar` | navLink |
| Schedule | Shift Schedule | `/therapist-schedule` | navLink |
| Clients | Clients | `/clients` | navLink |
| Clients | Import CSV | `/import-clients` | subNavLink (indented) |
| Billing | Invoices | `/invoices` | navLink |
| Billing | Sales KPIs | `/dashboard` | subNavLink (indented) |
| Items | Stock | `/inventory` | navLink |
| System | Settings | `/settings` | navLink |

"+ Add Client" is a button on `ClientList.jsx`, **not** in the sidebar.

## Design System

### Typography
- **Display font**: Cormorant Garamond (500/600/700) — used for `h1`, `h2`, `h3`, brand name (sidebar + Home), stat card values
- **Body font**: Inter (400/500/600/700) — used for everything else (forms, tables, buttons, nav)
- Loaded via Google Fonts `<link>` in `frontend/index.html` (not `@import`)
- CSS vars: `--font-display`, `--font-body` defined in `index.css` for both `:root` and `[data-theme="warm"]`
- The `h1, h2, h3 { font-family: var(--font-display); }` rule in `index.css` automatically propagates the display font across all page titles — no per-file changes needed

### Spacing Scale
4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 36px

### Input Standard
- Min-height: 40px (enforced via `input, select, textarea { min-height: 40px; }` in `index.css`)
- Padding: `9px 12px`
- Border radius: 8px
- Use `inputBase` from `styleUtils.jsx` when building new forms

### Button Standard
- Use `solidBtn(color)` and `outlineBtn(color)` from `styleUtils.jsx`
- Padding: `9px 20px`, border-radius: 8px, font: Inter 600, font-size: 13px
- `solidBtn` auto-picks dark text (`#3e2f25`) for warm palette colors: `#c8a97e`, `var(--primary)`, `#6b8f71`, `#d6a45c`, `#c97b7b`

### Color System (Warm Theme — `data-theme="warm"`)
See `[data-theme="warm"]` block in `index.css`. Primary accent: `#c8a97e` (tan/gold). All semantic colors use CSS vars.
