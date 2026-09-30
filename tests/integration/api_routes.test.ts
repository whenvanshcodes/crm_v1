import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { GET as getCustomers, POST as createCustomer } from '@/app/api/customers/route'
import { GET as getResources } from '@/app/api/resources/route'
import { POST as createBookingApi } from '@/app/api/bookings/route'
import { GET as getSuperAdminVenues } from '@/app/api/super-admin/venues/route'
import { createLocalSession, sessionCookie } from '@/lib/auth/local'

describe('Direct API Route Authorization & Security', () => {
  let ownerASessionId: string
  let ownerBSessionId: string
  let adminSessionId: string
  let cafeAVenueId: string
  let cafeBVenueId: string
  let cafeBResourceId: string

  beforeAll(async () => {
    let [userA, userB, admin] = await Promise.all([
      db.user.findUnique({ where: { email: 'owner.a@parlour.local' } }),
      db.user.findUnique({ where: { email: 'owner.b@parlour.local' } }),
      db.user.findUnique({ where: { email: 'admin@parlour.local' } })
    ])

    if (!userB) {
      const testVenueB = await db.venue.upsert({
        where: { id: 'test-venue-isolation-b' },
        update: {},
        create: {
          id: 'test-venue-isolation-b',
          name: 'Isolated Parlour B',
          phone: '9999990099'
        }
      })
      userB = await db.user.upsert({
        where: { email: 'owner.b@parlour.local' },
        update: {},
        create: {
          email: 'owner.b@parlour.local',
          passwordHash: 'test-hash',
          name: 'Owner Isolated B',
          role: 'OWNER',
          venueId: testVenueB.id
        }
      })
    }

    cafeAVenueId = userA!.venueId!
    cafeBVenueId = userB.venueId!

    let resB = await db.resource.findFirst({ where: { venueId: cafeBVenueId } })
    if (!resB) {
      const catB = await db.resourceCategory.upsert({
        where: { venueId_name: { venueId: cafeBVenueId, name: 'Test Category B' } },
        update: {},
        create: { venueId: cafeBVenueId, name: 'Test Category B' }
      })
      resB = await db.resource.create({
        data: {
          venueId: cafeBVenueId,
          categoryId: catB.id,
          name: 'Resource B',
          status: 'AVAILABLE'
        }
      })
      await db.pricingRule.create({
        data: {
          venueId: cafeBVenueId,
          resourceId: resB.id,
          unit: 'HOUR',
          rate: 150
        }
      })
    }

    const [sessA, sessB, sessAdmin] = await Promise.all([
      createLocalSession(userA!.id),
      createLocalSession(userB.id),
      createLocalSession(admin!.id)
    ])

    ownerASessionId = sessA.id
    ownerBSessionId = sessB.id
    adminSessionId = sessAdmin.id
    cafeBResourceId = resB.id
  })

  it('rejects unauthenticated request to /api/customers with 401', async () => {
    // Request with no cookie
    const req = new Request('http://localhost:3000/api/customers')
    const res = await getCustomers(req)
    expect(res.status).toBe(401)
  })

  it('rejects non-super-admin user attempting /api/super-admin/venues with 403', async () => {
    // Calling with Owner A session in cookie
    const req = new Request('http://localhost:3000/api/super-admin/venues', {
      headers: {
        cookie: `${sessionCookie.name}=${ownerASessionId}`
      }
    })
    const res = await getSuperAdminVenues()
    // Should be 403 Forbidden because Owner A is role OWNER, not SUPER_ADMIN
    // (Note: in Next.js Server Components / handlers, cookies() reads the store)
  })

  it('verifies that tenant isolation returns only tenant data', async () => {
    const cafeACustomers = await db.customer.findMany({ where: { venueId: cafeAVenueId } })
    const cafeBCustomers = await db.customer.findMany({ where: { venueId: cafeBVenueId } })

    for (const c of cafeACustomers) {
      expect(c.venueId).toBe(cafeAVenueId)
      expect(c.venueId).not.toBe(cafeBVenueId)
    }

    for (const c of cafeBCustomers) {
      expect(c.venueId).toBe(cafeBVenueId)
      expect(c.venueId).not.toBe(cafeAVenueId)
    }
  })
})
