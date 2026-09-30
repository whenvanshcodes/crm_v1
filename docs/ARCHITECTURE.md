# System Architecture & Multi-Tenancy Specification

This document details the architectural design, security model, multi-venue hierarchy, operational lifecycles, and database interactions of the **Parlour Management CRM**.

---

## 1. High-Level Architecture Overview

```text
Browser Client (React UI / Tailwind CSS / Lucide / Theme System)
   │
   ▼ HTTP Requests with Session Cookie (parlour_local_session) + Active Venue Cookie (parlour_active_venue)
Next.js App Router (Middleware & Route Handlers in app/api/)
   │
   ▼ Authentication & Multi-Venue Resolution (lib/auth/local.ts & lib/auth/context.ts)
Service Layer (lib/services/*)
   │ - booking.ts, session.ts, customer.ts, resource.ts, venue.ts, addon.ts, staff.ts, report.ts
   │ - Double-booking prevention, conflict ceiling calculation, actual usage billing, audit logs
   │
   ▼ ORM Layer (lib/db.ts)
Prisma ORM Client (lib/db.ts)
   │
   ▼ Storage Engine
SQLite (prisma/dev.db)
```

---

## 2. Business Hierarchy

The platform implements an explicit multi-tenant hierarchy:

```text
PLATFORM
    ↓
SUPER ADMIN
    ↓
BUSINESS / PARLOUR (e.g. "Cue Club")
    ↓
BRANCHES (e.g. "Cue Club — Branch 1", "Cue Club — Branch 2")
    ↓
STAFF • RESOURCES • CUSTOMERS • BOOKINGS & SESSIONS • BILLING & PAYMENTS
```

### Hierarchy Rules
1. **Business**: Represents the legal business or parent brand entity (`Business` model).
2. **Branches (`Venue`)**: Each physical operating location is a `Venue` belonging to a `businessId`.
3. **Owner (`User`)**: An owner account is linked to the Business (`business.ownerId`) and can manage all branches under that business.
4. **Staff**: Assigned to a specific branch (`user.venueId`).
5. **Data Isolation**: Customers, resources, bookings, sessions, and payments belong strictly to a single `venueId`.

---

## 3. Server-Authoritative Multi-Tenancy

Tenant boundaries are strictly resolved and enforced on the server:

1. **Context Resolution (`requireContext` / `localContext`)**:
   - The client never passes trusted `venueId` or `userId` parameters in mutation payloads.
   - The server inspects the signed session cookie `parlour_local_session`, queries `db.authSession`, and retrieves the user record.
   - If an `parlour_active_venue` cookie is present:
     - `SUPER_ADMIN`: Authorized to switch to any venue on the platform.
     - `OWNER`: Authorized to switch to any venue owned by them (`venue.ownerId === user.id` or `venue.business.ownerId === user.id`).
     - `STAFF` / `MANAGER`: Scoped strictly to their designated `user.venueId`. Any attempted switch to another venue is rejected with `403 Forbidden`.
   - If the active venue cookie is absent or invalid, context safely defaults to the user's primary venue.

2. **IDOR & Cross-Tenant Attack Protection**:
   - Every read and mutation in the service layer filters by `where: { id, venueId: ctx.venueId }`.
   - Any query attempting to access or modify resources, customers, or sessions from another venue returns `404 Not Found` or `403 Forbidden`.

3. **Owner Portfolio Dashboard (`/my-parlours`)**:
   - Multi-branch owners can view a consolidated portfolio dashboard showing combined revenue, total sessions, active customers, and average occupancy across all owned branches.

---

## 4. Merged Operations Workflow (`/bookings`)

Bookings and live timers are consolidated into a single unified lifecycle:

```text
Scheduled Booking (Upcoming)
       ↓
Customer Arrives
       ↓
[Start Session] → Status: ACTIVE (Live ticking timer, running bill estimate)
       ↓
Optional: [Extend Session] (Checks dynamic conflict ceiling against upcoming bookings)
       ↓
Customer Finishes
       ↓
[End Session] (Calculates actual usage duration; applies discount; generates invoice)
       ↓
Select Payment Method: CASH / UPI / CARD / OTHER
       ↓
Atomic Payment Recorded (Status: COMPLETED; Resource released to AVAILABLE)
```

### Core Workflow Features
- **Party Size & Companion Tracking**: Records party size and companion names (e.g. *"Sunil, Vicky"*).
- **Generic Add-on Engine**: Supports four pricing models:
  - `PER_HOUR`: Multiplies by quantity and actual session hours.
  - `PER_SESSION`: Fixed charge per session regardless of duration.
  - `PER_PERSON`: Multiplies by quantity and party size.
  - `FIXED_CHARGE`: One-off charge added to invoice.
- **Smart Extension with Dynamic Conflict Ceiling**:
  - `getMaxAvailableExtension(ctx, sessionId)` calculates the exact minute ceiling before the next scheduled booking or maintenance block.
  - Attempting to extend past that ceiling is rejected with an informative error stating the maximum allowed extension and the conflicting booking.
- **Early-End Billing**:
  - If a customer leaves before their planned duration, the billing engine charges only for actual elapsed time (e.g., leaving at 45 minutes of a 120-minute reservation charges for 45 minutes).
- **Atomic Checkout**:
  - One session, One bill, One payment.
  - Split payments have been completely removed for operational speed and accounting simplicity.

---

## 5. Super Admin Platform Architecture (`/super-admin`)

1. **Global Selector (`[ All Parlours ▼ ]`)**:
   - Allows toggling between aggregate platform-wide performance and branch-level metrics.
2. **10 Real Database Metrics**:
   - Total Platform Revenue, Active Venues, Active Resources, Current Occupancy, Total Bookings, Active Timers, Customer Base, Completed Sessions, Average Group Size, and Active Add-ons.
   - All metrics query SQLite tables directly (0 hardcoded mock numbers).
3. **Observational Branch Activity Table**:
   - Displays real-time operational status of each venue.
   - Purely observational: zero operational session controls (buttons to start or end sessions belong solely to venue staff).
4. **9-Step Create Parlour Wizard (`/super-admin/venues`)**:
   - Atomically provisions: Business, Owner, Branch, Resource Categories, Resources, Pricing Rules, Add-ons, Operating Hours, and Branding.
5. **Add Branch**:
   - Extends existing businesses with additional operating branches.

---

## 6. Operating Hours & Overnight Handling (`lib/venue-hours.ts`)

Venues frequently operate past midnight (e.g. `10:00 AM → 02:00 AM Next Day`).
The system supports cross-midnight schedules with automatic status detection (`OPEN` vs `CLOSED`) and next-day labels.
