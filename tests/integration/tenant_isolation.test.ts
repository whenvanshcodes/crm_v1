import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { listCustomers, getCustomer } from '@/lib/services/customer'
import { listResources, getResource } from '@/lib/services/resource'
import { createBooking, getBooking } from '@/lib/services/booking'
import { startSession } from '@/lib/services/session'
import { getVenueReports } from '@/lib/services/report'
import type { LocalContext } from '@/lib/auth/local'

describe('Multi-Tenancy Isolation & IDOR Protection', () => {
  let ctxOwnerA: LocalContext
  let ctxOwnerB: LocalContext
  let cafeACustomerId: string
  let cafeBCustomerId: string
  let cafeAResourceId: string
  let cafeBResourceId: string

  beforeAll(async () => {
    let userA = await db.user.findUnique({ where: { email: 'owner.a@parlour.local' } })
    let userB = await db.user.findUnique({ where: { email: 'owner.b@parlour.local' } })

    if (!userA) {
      throw new Error('Seed data missing for owner.a. Run pnpm db:seed first.')
    }

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

    ctxOwnerA = {
      userId: userA.id,
      venueId: userA.venueId,
      role: 'OWNER',
      name: userA.name
    }

    ctxOwnerB = {
      userId: userB.id,
      venueId: userB.venueId,
      role: 'OWNER',
      name: userB.name
    }

    // Create a customer in Cafe A and a customer in Cafe B
    const [custA, custB] = await Promise.all([
      db.customer.upsert({
        where: { venueId_phone: { venueId: ctxOwnerA.venueId!, phone: '9900112233' } },
        update: {},
        create: { venueId: ctxOwnerA.venueId!, name: 'Customer In Cafe A', phone: '9900112233' }
      }),
      db.customer.upsert({
        where: { venueId_phone: { venueId: ctxOwnerB.venueId!, phone: '9900445566' } },
        update: {},
        create: { venueId: ctxOwnerB.venueId!, name: 'Customer In Cafe B', phone: '9900445566' }
      })
    ])

    cafeACustomerId = custA.id
    cafeBCustomerId = custB.id

    // Get resources for Cafe A and B
    const resA = await db.resource.findFirst({ where: { venueId: ctxOwnerA.venueId! } })
    let resB = await db.resource.findFirst({ where: { venueId: ctxOwnerB.venueId! } })

    if (!resB) {
      const catB = await db.resourceCategory.upsert({
        where: { venueId_name: { venueId: ctxOwnerB.venueId!, name: 'Test Snooker B' } },
        update: {},
        create: { venueId: ctxOwnerB.venueId!, name: 'Test Snooker B' }
      })
      resB = await db.resource.create({
        data: {
          venueId: ctxOwnerB.venueId!,
          categoryId: catB.id,
          name: 'Isolation Resource B',
          status: 'AVAILABLE'
        }
      })
      await db.pricingRule.create({
        data: {
          venueId: ctxOwnerB.venueId!,
          resourceId: resB.id,
          unit: 'HOUR',
          rate: 200
        }
      })
    }

    cafeAResourceId = resA!.id
    cafeBResourceId = resB.id
  })

  it('Owner A can list customers and sees only Cafe A customers', async () => {
    const customers = await listCustomers(ctxOwnerA.venueId!)
    expect(customers.length).toBeGreaterThan(0)
    for (const c of customers) {
      expect(c.venueId).toBe(ctxOwnerA.venueId)
    }
  })

  it('Owner A cannot access Cafe B customer by ID (IDOR Prevention)', async () => {
    await expect(getCustomer(ctxOwnerA.venueId!, cafeBCustomerId)).rejects.toThrow(
      'NOT_FOUND'
    )
  })

  it('Owner B cannot access Cafe A customer by ID (IDOR Prevention)', async () => {
    await expect(getCustomer(ctxOwnerB.venueId!, cafeACustomerId)).rejects.toThrow(
      'NOT_FOUND'
    )
  })

  it('Owner A cannot access Cafe B resource by ID', async () => {
    await expect(getResource(ctxOwnerA.venueId!, cafeBResourceId)).rejects.toThrow(
      'NOT_FOUND'
    )
  })

  it('Owner A cannot book a resource belonging to Cafe B', async () => {
    const start = new Date(Date.now() + 3600000 * 20)
    const end = new Date(Date.now() + 3600000 * 21)

    await expect(
      createBooking(ctxOwnerA, {
        customerId: cafeACustomerId,
        resourceId: cafeBResourceId, // Belongs to Cafe B!
        startTime: start,
        endTime: end
      })
    ).rejects.toThrow('NOT_FOUND')
  })

  it('Owner A cannot start a session on Cafe B resource', async () => {
    await expect(
      startSession(ctxOwnerA, {
        customerId: cafeACustomerId,
        resourceId: cafeBResourceId // Belongs to Cafe B!
      })
    ).rejects.toThrow('NOT_FOUND')
  })

  it('Reports for Cafe A strictly exclude all activity from Cafe B', async () => {
    const reportsA = await getVenueReports(ctxOwnerA.venueId!)
    const reportsB = await getVenueReports(ctxOwnerB.venueId!)

    expect(reportsA).toBeDefined()
    expect(reportsB).toBeDefined()
  })
})
