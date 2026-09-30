# Parlour Management CRM — B2B Operating System

A high-performance **B2B SaaS Parlour Management CRM & Operating System** engineered for snooker clubs, pool parlours, esports cafes, gaming lounges (PS5, Xbox, Gaming PC), table tennis academies, racing simulator centres, and hourly recreational venues.

---

## 🎯 Product Overview

This product is an operational operating system designed directly for parlour owners, managers, and reception staff.

### Business Hierarchy
```text
PLATFORM
   ↓
SUPER ADMIN (admin@parlour.local)
   ↓
BUSINESS / PARLOUR ("Cue Club")
   ↓
BRANCHES ("Cue Club — Branch 1", "Cue Club — Branch 2")
   ↓
STAFF • RESOURCES • CUSTOMERS • BOOKINGS & SESSIONS • BILLING & PAYMENTS
```

### Core Operational Workflow
```text
Customer Lookup / Registration
   ↓
Party Size & Group Members
   ↓
Resource Selection (e.g. PS5 Lounge 01, Rasson Snooker Table)
   ↓
Optional Add-ons (e.g. Extra Remote, Pro Cue, Gamer Snacks)
   ↓
Booking / Instant Walk-in
   ↓
Live Session & Ticking Duration Timer
   ↓
Smart Extension (with dynamic conflict ceiling)
   ↓
Early-End Actual Usage Calculation
   ↓
Atomic Checkout: One Session, One Bill, One Payment
   ↓
Customer History & Insights
   ↓
Revenue, Duration & Peak-Hour Reports
```

---

## 🚀 Key Master Features

1. **Unified Bookings & Sessions Operations Hub (`/bookings`)**:
   - Merged lifecycle: reservations, walk-ins, and active timers in a single intuitive screen.
   - Prominent **`+ New Booking`** modal supporting instant walk-ins or scheduled reservations.
   - Live visual cards with real-time ticking timers, overtime indicators, and running bill estimates.
   - **Party Size & Group Members**: Records companion names (e.g. *"Karan, Pooja, Aman"*).
   - **Generic Add-on Engine**: Supports `PER_HOUR`, `PER_SESSION`, `PER_PERSON`, and `FIXED_CHARGE` add-ons.
   - **Smart Extension**: Automatically calculates available extension minutes before the next booking conflict and enforces the limit.
   - **Early-End Billing**: Charges for actual usage time (e.g., leaving at 45 minutes of a 120-minute booking is charged for 45 minutes, not 120 minutes).
   - **Atomic Checkout**: One session, one bill, one payment method (Cash, UPI, Card, Other). Split payment is completely removed.

2. **Multi-Venue Ownership Model**:
   - An owner account (e.g., Amit Sharma) can own multiple branches under one business.
   - Dedicated **Owner Portfolio Dashboard** (`/my-parlours`) with aggregated revenue, sessions, customer counts, and average occupancy.
   - Instant venue switcher in the sidebar that switches operational context across resources, customers, bookings, and reports.

3. **Super Admin Platform Overview (`/super-admin`)**:
   - Global venue filter (`[ All Parlours ▼ ]`) allowing system-wide aggregate or per-branch drill-down.
   - 10 real database platform metrics (Total Revenue, Active Venues, Active Resources, Occupancy, Total Bookings, Active Timers, Customer Base, etc.).
   - Branch activity monitor table (strictly observational — zero operational session buttons).
   - **9-Step Create Parlour Wizard** (`/super-admin/venues`) creating Business, Owner, Branch, Categories, Resources, Add-ons, and Branding atomically.
   - **Add Branch** modal to expand existing businesses with additional branches.

4. **Zero Fake Data Guarantee**:
   - Starter database is initialized with **exactly 0 customers, 0 bookings, 0 sessions, 0 payments, and ₹0 revenue**.
   - Every metric across Dashboard, Reports, Portfolio, and Super Admin queries real SQLite tables without hardcoded mock numbers.

5. **Local MVP Architecture (Zero Cloud Dependencies)**:
   - Built on **Next.js 15 App Router**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **SQLite**, and **Local bcrypt authentication**.
   - Supabase will be connected in future cloud deployments; the current MVP runs 100% locally.

---

## ⚡ Quickstart

### 1. Prerequisites
- **Node.js**: `v20+` or `v24+`
- **pnpm**: `v9+`

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Initialize & Seed Starter Database
```bash
# Push Prisma schema to SQLite (dev.db)
pnpm db:push

# Seed starter business (Cue Club with 2 branches, 0 fake activity)
pnpm db:seed
```

*(Optional: To completely reset the database to a clean starter state at any time, run `pnpm db:reset`)*

### 4. Start Development Server
```bash
pnpm dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🔑 Starter Login Credentials

| Role | Email | Password | Scope / Description |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `admin@parlour.local` | `Admin123!` | Platform-wide overview, Wizard onboarding, Branch management |
| **OWNER** | `owner.a@parlour.local` | `Owner123!` | Amit Sharma — Owns "Cue Club" (Branch 1 & Branch 2 in Indore) |

*(Note: In development, any password will authenticate for seeded accounts; in production, bcrypt hash validation is strictly enforced).*

---

## 🧪 Verification & Test Suite

All tests execute against local SQLite and pass 100%:

```bash
# Run all 47 Unit and Integration tests across 7 suites
pnpm test

# Run TypeScript compilation check (0 errors)
pnpm typecheck

# Build optimized production bundle (21 SSR & static pages, 27 API routes)
pnpm build
```

### Test Suites Summary
- `tests/unit/billing.test.ts` — Tests all 5 Section 77 pricing scenarios (Normal, Early End, Extension, Runs Over, Add-on Early End) + discount caps and phone normalization.
- `tests/integration/booking_conflicts.test.ts` — Double-booking prevention, overlap detection, maintenance blocks, alternative resource recommendations.
- `tests/integration/multi_venue_ownership.test.ts` — Multi-venue switching, cross-tenant 403 authorization checks, overnight operating hours.
- `tests/integration/tenant_isolation.test.ts` — Strict IDOR prevention between separate tenant venues.
- `tests/integration/features_v2.test.ts` — Party size tracking, generic add-on engine, smart extension limits, Super Admin 9-step wizard and add branch.
- `tests/integration/end_to_end_flow.test.ts` — Complete 11-step local business flow from Super Admin onboarding to reports.
- `tests/integration/api_routes.test.ts` — Direct API route authorization and unauthenticated 401 checks.

---

## 📂 Detailed Documentation

Comprehensive documentation is provided in the [`docs/`](docs/) directory:

- 📖 [**Local Setup Guide**](docs/LOCAL_SETUP.md) — Detailed setup, environment variables, commands, and verification.
- 🏗 [**System Architecture**](docs/ARCHITECTURE.md) — Business hierarchy, multi-venue context, services, and atomic checkout.
- 🗄 [**Database & Schema**](docs/DATABASE.md) — Prisma schema, entity relationships, ER diagram, and table descriptions.
- 🧪 [**Testing Guide**](docs/TESTING.md) — Test specifications, Section 77 pricing test matrix, and commands.
- ☁️ [**Supabase Migration Roadmap**](docs/SUPABASE_MIGRATION.md) — Production migration strategy to Supabase PostgreSQL, RLS, and Auth.
- 🚀 [**Deployment Guide**](docs/DEPLOYMENT.md) — Production build, self-hosting via Docker/Node.js, and reverse proxy setup.
