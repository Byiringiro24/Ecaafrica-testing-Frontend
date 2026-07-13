# ecareafrica — Student Attendance Tracking System

A production-grade React + Tailwind CSS frontend MVP for Rwandan secondary schools. ecareafrica records attendance via student ID cards (NFC/QR), face, and fingerprint scans, sends SMS notifications to parents, manages boarding, fees, staff, and gate access, and provides rich analytics for administrators.  

Built with **React 19**, **TanStack Start / Router**, **Tailwind CSS v4**, **Recharts**, **Lucide React**, and **Plus Jakarta Sans / DM Sans** typography. All data is mocked with realistic Rwandan content (names, schools, RWF amounts, Kinyarwanda SMS templates).

---

## Tech Stack

- React 19 + TypeScript (strict)
- TanStack Start v1 + TanStack Router (file-based routing)
- Tailwind CSS v4 (via `src/styles.css`)
- Recharts for analytics
- Lucide React icons
- shadcn/ui component primitives
- Vite 7 build tooling

---

## Architecture

The app ships **two layouts**:

1. **`AppLayout`** — School Admin workspace with the navy `#0F172A` sidebar grouped into collapsible sections (Core, Boarding, Finance, HR, Communication, Analytics, System). Sections are gated by `schoolConfig.enabledModules` and feature flags (`hasBoarding`, `hasBiometrics`).
2. **`SuperAdminLayout`** — Separate platform layout with a `slate-900` sidebar and "Super Admin" badge for managing tenant schools.

All mock data lives in `src/lib/mockData.ts` (60 students, attendance history, SMS logs, classes S1A–S6B, parents, dorms, gate logs, fees, transactions, staff, platform schools).

---

## School Admin Pages

### Dashboard (`/dashboard`)

- KPI cards: Total Students, Present Today, Absent, SMS Sent
- Daily attendance trend (Recharts Area)
- Class-by-class breakdown
- Recent activity feed
- Quick actions

### Attendance (`/attendance`)

- **Three scan modes**: Card/QR, Face Recognition, Fingerprint
  - Face mode: viewfinder UI with animated scanning line + randomized recognition
  - Fingerprint: pulsing SVG with success/error states
  - Card: NFC/QR scan simulation
- Success popup modal showing student photo, class, time, parent SMS preview
- Live attendance log table with status badges
- Manual attendance override

### Students (`/students`)

- Searchable + filterable directory (60 mock students)
- **Multi-step Registration Modal** (3 steps): Personal Info → Academic Info → Parent/Guardian
- Student profile drawer with attendance history, SMS log, biometric enrollment
- **Biometric Enrollment Modal** for face + fingerprint
- Bulk actions, CSV export (simulated), per-row edit/delete

### Classes (`/classes`)

- Grid of class cards (S1A–S6B) with `levelBorderClass` color coding
- Right-side detail drawer: student roster + attendance trend chart
- Per-class stats and teacher assignment

### Staff (`/staff`)

- Staff directory with grid + table views
- **4-step Registration Modal**: Personal → Role → Contract → Documents
- Departments view, staff attendance log
- Staff profile with role badges

### Fees (`/fees`)

- Collection dashboard with Recharts
- Student fees table with payment recording
- Receipt generation modal (print + simulated PDF download)
- Transactions ledger
- Fee structure editor
- Payment reminders (SMS triggered)
- All amounts formatted via `formatRWF()` → `RWF 180,000`

### Boarding (`/boarding`)

- KPIs: occupancy %, total beds, present/absent boarders
- Dormitory grid with capacity bars
- House detail slide-over
- Roll Call modal (Morning / Evening) with bulk mark
- Absence monitoring panel

### Gate (`/gate`)

- KPIs: on-campus count, today's entries/exits
- Live Campus Status (auto-refreshing)
- Tabs: Entry Analytics, Exit Analytics, Time-of-day Analytics
- Duplicate entry prevention log

### Leaves (`/leaves`)

- KPIs across leave statuses
- Tabs: Pending / Approved / Rejected / All
- Approve/Reject modals with SMS preview to parents
- Exit tracking
- **3-step New Leave Modal**: Reason → Dates → Parent confirmation

### Parents (`/parents`)

- Searchable parent directory mapped to students
- **SMS Compose Modal** with English ↔ Kinyarwanda template toggle and variable injection (`{studentName}`, `{status}`, `{time}`)
- **Bulk SMS** tool with simulated progress counter
- SMS history per parent

### Notifications (`/notifications`)

- Filterable SMS log (status, trigger, date)
- Retry Failed action
- Delivery status badges
- Trigger-type icons (check-in, leave, fee reminder, etc.)

### Reports (`/reports`)

- 4 tabs: **Overview**, **By Class**, **By Student**, **By Time**
- Recharts Area + Bar charts
- Sortable tables
- CSS Grid attendance heatmap (week × period)
- Daily trend, weekly comparison

### Settings (`/settings`)

- 6 vertical tabs:
  1. School Info
  2. SMS API Configuration
  3. Academic Calendar (with holiday management)
  4. Biometric thresholds
  5. Roles & Permissions (edit modal)
  6. Subscription & Plan (usage meters + upgrade modal)

---

## Super Admin Pages

Separate `SuperAdminLayout` (slate-900 sidebar + "Super Admin" badge).

### Platform Overview (`/super-admin`)

- KPIs: Total schools, active subscriptions, MRR, system health
- 2 platform charts + recent activity feed

### Schools (`/super-admin/schools`)

- Grid of tenant schools
- **5-step School Onboarding Modal**: Identity → Contacts → Plan → Modules → Confirmation

### Subscriptions (`/super-admin/subscriptions`)

- Plans table + active subscriptions

### Billing (`/super-admin/billing`)

- Platform-wide invoices and revenue

### Analytics (`/super-admin/analytics`)

- Cross-tenant usage analytics

### System (`/super-admin/system`)

- Default SMS provider selection (Pindo / Africa's Talking / Twilio / MTN)
- Global notification templates
- Feature flags (Boarding, Biometrics, Gate, Bulk SMS, CSV export)
- Maintenance mode toggle

### Platform Users (`/super-admin/users`)

- Internal ecareafrica team accounts (Platform Admin, Support, Sales, Finance)

### Announcements (`/super-admin/announcements`)

- Broadcast announcements to tenant schools

---

## Shared Components

- **Layout**: `AppLayout`, `AppHeader`, `AppSidebar`, `SuperAdminLayout`
- **UI Kit**: `StatCard`, `StatusBadge`, `Avatar`
- **Modals**:
  - `StudentRegistrationModal` (3 steps)
  - `BiometricEnrollModal`
  - `SMSComposeModal` (EN/KIN templates)
  - `ConfirmModal` (reusable)
- **shadcn/ui** primitives in `src/components/ui/*`

---

## Design System

- **Sidebar**: Navy `#0F172A` (school admin) / `slate-900` (super admin)
- **Primary**: Indigo
- **Typography**: Plus Jakarta Sans (headings), DM Sans (body)
- **Tables**: hover states + zebra striping
- **Forms**: required-field validation with red border + helper text
- **Phone validation**: `+250 7\d{8}`
- **Currency**: `formatRWF(n)` helper
- All design tokens in `src/styles.css` (oklch)

---

## Localization

SMS templates and key terms are bilingual:

| English | Kinyarwanda |
| ------- | ----------- |
| Parent  | Mubyeyi     |
| Student | Umunyeshuri |
| School  | Ishuri      |
| Lessons | Amasomo     |

---

## Project Structure

```
src/
├── components/
│   ├── layout/          # AppLayout, AppSidebar, AppHeader, SuperAdminLayout
│   ├── modals/          # StudentRegistration, SMSCompose, BiometricEnroll, Confirm
│   ├── ui-kit/          # StatCard, StatusBadge, Avatar
│   └── ui/              # shadcn primitives
├── lib/
│   ├── mockData.ts      # All Rwandan mock data + formatRWF
│   └── utils.ts
├── routes/              # File-based TanStack routes
│   ├── __root.tsx
│   ├── dashboard.tsx, attendance.tsx, students.tsx, classes.tsx
│   ├── staff.tsx, fees.tsx, boarding.tsx, gate.tsx, leaves.tsx
│   ├── parents.tsx, notifications.tsx, reports.tsx, settings.tsx
│   └── super-admin.*.tsx
├── router.tsx
└── styles.css
```

---

## Getting Started

```bash
bun install
bun run dev
```

The app runs at `http://localhost:5173`. All data is mocked — no backend required for the MVP.

scp-rdist/*user@ip:/var/www/ecare_africa/frontend/

npm run dev -- --host 127.0.0.1 --port 5173
