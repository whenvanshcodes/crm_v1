# MVP Acceptance and RLS Test Matrix

## Preconditions

1. Apply `supabase/migrations/202609300001_initial.sql` to a disposable Supabase project.
2. Create one `SUPER_ADMIN` profile, two venues, and one owner profile for each venue.
3. Sign in separately as Super Admin, Owner A and Owner B.

## Core acceptance flow

| Step | Expected result | Current status |
| --- | --- | --- |
| Super Admin creates Café A | Venue and owner Auth/profile are created atomically | Not implemented: venue API creates only a venue; owner invite creation is missing |
| Owner configures categories/resources/pricing | Tenant-owned data is persisted | Partial: resources route exists; categories/pricing UI/API missing |
| Phone lookup and customer creation | Existing phone returns one tenant customer; new phone creates one | Partial: customer API is tenant scoped; reception UI is not migrated |
| Booking and conflict validation | Concurrent overlap is rejected | Not implemented in Next.js |
| Session, timer, extension and checkout | Server time and server billing are authoritative | Not implemented in Next.js |
| Payment and history | Payment updates transaction/customer/report data | Not implemented in Next.js |
| Reports | Values are derived from tenant data | Partial: summary API only |

## RLS tests to execute in Supabase

For every test, capture the authenticated request and result; use the Supabase anon key with each user session.

| Actor | Request | Expected result |
| --- | --- | --- |
| Owner A | Select Customer/Resource/Booking/Session/Payment belonging to Café B | Empty result or 403; no record data |
| Owner A | Insert customer with Café B `venue_id` | RLS denial |
| Owner A | Update Booking/Session/Payment using Café B UUID | Zero rows affected / RLS denial |
| Owner A | Query Reports API after manually adding Café B IDs | No Café B figures |
| Owner B | Repeat against Café A | Empty result or 403; no record data |
| Super Admin | Read both venue data sets | Permitted |
| Unauthenticated | Query tenant tables/API | Denied |

## Evidence required before deployment

- Migration applied to a real PostgreSQL Supabase instance.
- Screenshot/export of RLS policy list and authenticated test results.
- API integration tests for booking conflicts, session billing and payment lifecycle.
- Playwright acceptance flow passing against a disposable tenant fixture.
