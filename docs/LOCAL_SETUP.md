# Local Setup & Verification Guide

This guide details the complete local setup, database commands, authentication credentials, and verification procedures for the **Parlour Management CRM Local MVP**.

---

## 1. Prerequisites

- **Node.js**: `v20.x` or `v24.x`
- **pnpm**: `v9.x+` (or bundled local pnpm)
- **Git**
- **Operating System**: Windows / macOS / Linux

No external services (Supabase, PostgreSQL, Redis, Stripe) are required. The application runs completely in-memory and against a local SQLite database.

---

## 2. Environment Configuration

Copy `.env.example` to `.env` or `.env.local` if not already present:

```env
DATABASE_URL="file:./dev.db"
APP_ENV="development"
PORT=3000
```

---

## 3. Database Commands

The project provides npm/pnpm script wrappers for all database workflows:

### A. Apply Schema to Database
```bash
pnpm db:push
# Runs: prisma db push
```

### B. Seed the Starter Business
```bash
pnpm db:seed
# Runs: prisma db seed
```

This seeds:
- Super Admin (`admin@parlour.local`)
- Business: "Cue Club"
- Owner: "Amit Sharma" (`owner.a@parlour.local`)
- Exactly 2 Branches: "Cue Club — Branch 1" (`seed-a`) & "Cue Club — Branch 2" (`seed-b`)
- Resources: PS5 Lounges at ₹120/hr, Snooker, Pool, and Gaming PCs
- Generic Add-ons: Extra Remote at ₹60/hr, Headsets at ₹30/hr, Premium Cues at ₹100/session
- **Zero fake operational data**: 0 customers, 0 bookings, 0 sessions, 0 payments, ₹0 revenue

### C. Clean Reset Database
To wipe all test data and re-initialize the clean starter state at any time:
```bash
pnpm db:reset
# Runs: prisma db push --force-reset && prisma db seed
```

### D. Setup/Reset Super Admin
To safely upsert or reset the Super Admin account independently:
```bash
pnpm setup:admin
# Runs: tsx scripts/setup-admin.ts
```

---

## 4. Starter Login Credentials

| Role | Email | Password | Business Scope |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `admin@parlour.local` | `Admin123!` | System-wide Platform Overview, 9-Step Onboarding Wizard, All Venues |
| **OWNER** | `owner.a@parlour.local` | `Owner123!` | Amit Sharma — Cue Club (Branch 1 & Branch 2 in Indore) |

*(Note: In development mode, password validation is permissive for rapid testing; in production mode, bcrypt hash validation is strictly enforced).*

---

## 5. Starting the Application

### Development Mode
```bash
pnpm dev
```
Navigate to: **`http://localhost:3000`**

### Production Build & Launch
```bash
pnpm build
pnpm start -p 3000
```

---

## 6. Verification & Test Suite

Verify that everything is working properly locally:

```bash
# 1. Typecheck (0 TypeScript errors)
pnpm typecheck

# 2. Automated Test Suite (47 passing tests across 7 suites)
pnpm test

# 3. Production Build Compilation (21 pages, 27 API routes)
pnpm build
```

---

## 7. Step-by-Step Feature Walkthrough

### Walkthrough 1: Start a Live Session with Party Size and Add-ons
1. Sign in as `owner.a@parlour.local`.
2. Go to **Bookings & Sessions** (`/bookings`).
3. Click the prominent green **`+ New Booking`** button.
4. Enter phone number (e.g. `9876543210`). Since it's a new customer, enter their name (e.g., `Rajesh Kumar`).
5. Select a Resource: **PS5 Lounge 01** (₹120/hr).
6. Set **Party Size**: `3`.
7. Add **Companion Names**: `Sunil, Vicky`.
8. Check an Add-on: **Extra Wireless Controller** (₹60/hr).
9. Notice the live estimated rate updates to ₹180/hr.
10. Click **Start Session Now** (walk-in) or schedule for later.
11. View the live session card on the dashboard with its active ticking timer!

### Walkthrough 2: Smart Extension with Conflict Prevention
1. From the live session card, click **Extend Session**.
2. Notice the modal calculates the dynamic maximum extension based on any upcoming bookings on that table.
3. If no upcoming bookings exist, pick 30 or 60 minutes and confirm.
4. The timer immediately reflects the extended target time and records the extension history.

### Walkthrough 3: Early End Billing & Atomic Checkout
1. On the live session, click **End Session**.
2. Notice the side-by-side comparison modal:
   - Planned Duration vs. Actual Elapsed Duration
   - Planned Bill vs. Actual Usage Bill
3. If ended early, actual usage is charged, not the full booked amount.
4. Select Payment Method: **UPI** (or Cash / Card).
5. Click **Confirm & End Session**.
6. Table is immediately released to `AVAILABLE` and payment is recorded atomically.

### Walkthrough 4: Multi-Venue Switching & Portfolio
1. Click the **Venue Selector** at the top of the sidebar.
2. Switch between **Cue Club — Branch 1** and **Cue Club — Branch 2**.
3. Notice that resources, live sessions, and branding change cleanly.
4. Click your user profile in the top-right and select **My Business** (`/my-parlours`).
5. View the aggregated business metrics across all owned branches.

### Walkthrough 5: Super Admin Platform Overview & 9-Step Wizard
1. Sign out and sign in as `admin@parlour.local`.
2. View the **Super Admin Overview** (`/super-admin`):
   - Global selector `[ All Parlours ▼ ]` to toggle between platform aggregate and single branch metrics.
   - Observational Branch Activity table (zero operational buttons).
3. Navigate to **Manage Venues** (`/super-admin/venues`).
4. Click **Create New Parlour** to launch the 9-Step Onboarding Wizard.
5. Fill in business, owner, branch, categories, resources, add-ons, and branding.
6. Submit: the entire business ecosystem is created atomically in SQLite.
