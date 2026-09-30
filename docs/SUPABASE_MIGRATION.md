# Future Supabase / PostgreSQL Migration Roadmap

This document outlines the strategic architectural roadmap to migrate the **Parlour Management CRM** from the current local MVP (SQLite + Prisma + Local Auth) to **Supabase PostgreSQL**, **Supabase Auth**, and **Row Level Security (RLS)** in production.

---

## 1. Migration Strategy Principles

1. **Local MVP Independence**: The local MVP must remain 100% operational with zero external cloud dependencies.
2. **Schema Compatibility**: Prisma schema types map directly from SQLite to PostgreSQL types.
3. **Data Parity**: The database hierarchy (`Platform → Super Admin → Business → Venue/Branch → Resources/Staff/Customers/Sessions`) remains unchanged.
4. **Service Abstraction**: Next.js service layer functions (`lib/services/*`) already isolate all database access, making database driver transitions straightforward.

---

## 2. Database Schema Mapping (SQLite → PostgreSQL)

| SQLite Entity (Current) | PostgreSQL / Supabase Equivalent | Notes |
| :--- | :--- | :--- |
| `String @id @default(cuid())` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Or keep `TEXT` cuid format |
| `DateTime @default(now())` | `TIMESTAMPTZ DEFAULT now()` | Proper timezone storage |
| `Float` | `NUMERIC(10, 2)` or `DOUBLE PRECISION` | Exact decimal precision for currency |
| `String` (enums) | `enum` or `TEXT` with `CHECK` constraints | Pricing types, session statuses |
| `Boolean @default(true)` | `BOOLEAN DEFAULT true` | Identical |
| SQLite JSON strings (`extensionHistory`) | `JSONB` | Native JSON queries and indexing |

---

## 3. Row Level Security (RLS) Policy Architecture

In Supabase PostgreSQL, RLS policies will enforce tenant isolation at the database engine level:

### Helper Functions in Postgres:
```sql
-- Retrieve active venue from JWT claims
CREATE OR REPLACE FUNCTION auth.active_venue_id()
RETURNS TEXT AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'active_venue_id', ''),
    (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'default_venue_id', ''))
  );
$$ LANGUAGE sql STABLE;

-- Check if current user is Super Admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'SUPER_ADMIN';
$$ LANGUAGE sql STABLE;
```

### Example RLS Policy on `Customer`:
```sql
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can access venue customers"
ON "Customer"
FOR ALL
USING (
  auth.is_super_admin() OR venue_id = auth.active_venue_id()
);
```

### Example RLS Policy on `Session`:
```sql
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can access venue sessions"
ON "Session"
FOR ALL
USING (
  auth.is_super_admin() OR venue_id = auth.active_venue_id()
);
```

---

## 4. Authentication Migration: Local Auth → Supabase Auth

1. **Current Local Auth (`lib/auth/local.ts`)**:
   - Uses `parlour_local_session` signed HTTP cookie + `AuthSession` table + bcrypt passwords.
2. **Target Supabase Auth (`@supabase/ssr`)**:
   - Supabase handles JWT tokens and refresh cycles in HTTP-only cookies.
   - User metadata in `auth.users` contains:
     - `role`: `SUPER_ADMIN` | `OWNER` | `MANAGER` | `RECEPTIONIST` | `STAFF`
     - `business_id`: Parent business reference
     - `default_venue_id`: Default branch assigned
     - `active_venue_id`: Currently active branch (switched via API)
3. **Transition Bridge (`lib/auth/context.ts`)**:
   - Maintain the `LocalContext` TypeScript interface (`{ userId, venueId, role, name }`).
   - `requireContext()` will switch from reading `localContext(req)` to extracting user context from `supabase.auth.getUser()`.

---

## 5. Storage Migration: Venue Assets

- Local MVP stores public asset URLs or placeholder URLs in `coverImageUrl`, `logoUrl`, `dashboardHeroUrl`.
- In Supabase:
  - Create a public bucket `venue-assets`.
  - Use Supabase Storage client to upload venue logos, table photographs, and cover banners.

---

## 6. Migration Execution Checklist

- [ ] Create Supabase project in region closest to target deployment (e.g. `ap-south-1` Mumbai).
- [ ] Set `DATABASE_URL` in production `.env` pointing to Supabase PostgreSQL connection pooler (port 6543 / 5432).
- [ ] Run `prisma db push` or apply generated migration scripts.
- [ ] Enable RLS on all tenant tables (`Customer`, `Resource`, `Booking`, `Session`, `Transaction`, `Payment`).
- [ ] Migrate local bcrypt password hashes or provision initial admin users via Supabase Admin API.
- [ ] Deploy Next.js application to Vercel, Railway, or AWS.
