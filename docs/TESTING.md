# Automated Testing & Verification Guide

This document details the test architecture, test suites, Section 77 pricing test matrix, and verification instructions for the **Parlour Management CRM**.

---

## 1. Test Suite Summary

The repository includes **47 tests across 7 test suites** executing against local SQLite with **100% pass rate**.

| Test File | Tests | Focus Area |
| :--- | :--- | :--- |
| `tests/unit/billing.test.ts` | 11 | Section 77 pricing scenarios, add-on pricing, discounts, phone normalization |
| `tests/integration/booking_conflicts.test.ts` | 5 | Overlapping bookings, adjacent slots, maintenance blocks, alternatives |
| `tests/integration/multi_venue_ownership.test.ts` | 6 | Multi-branch switching, cross-tenant 403 authorization, overnight hours |
| `tests/integration/tenant_isolation.test.ts` | 7 | IDOR prevention, cross-tenant isolation on customers, resources, reports |
| `tests/integration/features_v2.test.ts` | 4 | Party size, generic add-ons, smart extension limits, Super Admin 9-step wizard |
| `tests/integration/end_to_end_flow.test.ts` | 11 | Complete 11-step local business flow from onboarding to reports |
| `tests/integration/api_routes.test.ts` | 3 | API authorization, unauthenticated 401 rejection, role 403 checks |

---

## 2. Section 77 Master Specification Pricing Matrix

`tests/unit/billing.test.ts` implements test coverage for all 5 master pricing scenarios:

### Scenario 1: Normal Session
- **Input**: Booked 60 mins, used 60 mins at ₹120/hr.
- **Result**: Charged ₹120. `completionStatus: COMPLETED_AS_BOOKED`.

### Scenario 2: Early End Session
- **Input**: Booked 120 mins (expected ₹240), ended at 45 mins.
- **Rule**: Customer is charged for **actual usage** (45 mins = ₹90), NOT full 120 mins.
- **Result**: Charged ₹90. `completionStatus: ENDED_EARLY`.

### Scenario 3: Extension Session
- **Input**: Booked 60 mins, extended by 30 mins, total duration 90 mins at ₹120/hr.
- **Result**: Charged ₹180. `completionStatus: EXTENDED`.

### Scenario 4: Runs Over (Unextended Overtime)
- **Input**: Booked 60 mins, ended at 75 mins without explicit extension.
- **Rule**: Actual elapsed duration is charged.
- **Result**: Charged ₹150 for 75 mins. `completionStatus: RAN_OVER`.

### Scenario 5: Add-on Early End & Generic Pricing Types
- **Input**: PS5 at ₹120/hr + Extra Remote at ₹60/hr (`PER_HOUR`) + Snack Combo at ₹100 (`FIXED_CHARGE`) + VR Headset at ₹50/person (`PER_PERSON` with partySize = 3).
- **Duration**: Planned 120 mins, ended early at 60 mins.
- **Calculation**:
  - Resource: 60 mins * ₹120/hr = ₹120
  - Extra Remote (`PER_HOUR`): 60 mins * ₹60/hr = ₹60 (charged for actual duration, not 120 mins)
  - Snack Combo (`FIXED_CHARGE`): ₹100
  - VR Headset (`PER_PERSON` for 3): ₹50 * 3 = ₹150
  - Add-ons Subtotal: ₹60 + ₹100 + ₹150 = ₹310
  - Final Total: ₹120 + ₹310 = ₹430

---

## 3. Running Tests

### Run All Tests
```bash
pnpm test
```

### Run Specific Test Suite
```bash
# Unit tests only
pnpm vitest run tests/unit/billing.test.ts

# Integration tests only
pnpm vitest run tests/integration/features_v2.test.ts
```

### Run TypeScript Verification
```bash
pnpm typecheck
```

### Run Production Build
```bash
pnpm build
```

---

## 4. Resetting Test Database

To wipe test records created during test runs and return to the pristine starter state:
```bash
pnpm db:reset
```
This guarantees that `dev.db` returns to:
- 0 customers
- 0 bookings
- 0 sessions
- 0 payments
- ₹0 revenue
- Cue Club with exactly 2 branches
