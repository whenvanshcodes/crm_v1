import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { startSession, extendSession, endSession } from '@/lib/services/session'
import { createAddOn } from '@/lib/services/addon'
import type { LocalContext } from '@/lib/auth/local'

describe('Mandatory Walk-in POS Test Scenario', () => {
  let ctx: LocalContext
  let customerId: string
  let resourceId: string
  let controllerAddOnId: string
  let venueId: string

  beforeAll(async () => {
    const owner = await db.user.findUnique({
      where: { email: 'owner.a@parlour.local' }
    })
    if (!owner) throw new Error('Owner missing')
    venueId = owner.venueId!

    ctx = {
      userId: owner.id,
      venueId: venueId,
      role: 'OWNER',
      name: owner.name
    }

    // 1. Ensure customer: Amit Sharma (9876543210)
    const customer = await db.customer.upsert({
      where: { venueId_phone: { venueId, phone: '9876543210' } },
      update: { name: 'Amit Sharma' },
      create: {
        venueId,
        name: 'Amit Sharma',
        phone: '9876543210'
      }
    })
    customerId = customer.id

    // 2. Ensure resource: PS5 Lounge 01 (₹120/hr)
    let resource = await db.resource.findFirst({
      where: { venueId, status: 'AVAILABLE' },
      include: { pricingRules: true }
    })

    if (!resource) {
      const cat = await db.resourceCategory.upsert({
        where: { venueId_name: { venueId, name: 'PS5' } },
        update: {},
        create: { venueId, name: 'PS5' }
      })
      resource = await db.resource.create({
        data: {
          venueId,
          categoryId: cat.id,
          name: 'PS5 Lounge 01',
          status: 'AVAILABLE'
        },
        include: { pricingRules: true }
      })
      await db.pricingRule.create({
        data: {
          venueId,
          resourceId: resource.id,
          unit: 'HOUR',
          rate: 120
        }
      })
    } else {
      await db.resource.update({
        where: { id: resource.id },
        data: { status: 'AVAILABLE' }
      })
    }
    resourceId = resource.id

    // 3. Ensure add-on: Controller (₹60/hr)
    let addOn = await db.addOn.findFirst({
      where: { venueId, name: { contains: 'Controller' } }
    })

    if (!addOn) {
      addOn = await createAddOn(ctx, {
        name: 'Extra Controller',
        price: 60,
        pricingType: 'PER_HOUR',
        categoryName: 'ACCESSORY'
      })
    }
    controllerAddOnId = addOn.id
  })

  it('executes full counter walk-in: Customer -> People=3 -> PS5 01 -> Controllers=2 -> Time=2h -> START', async () => {
    // 1. START session
    const session = await startSession(ctx, {
      customerId,
      resourceId,
      partySize: 3,
      expectedDurationMinutes: 120,
      addOns: [{ addOnId: controllerAddOnId, quantity: 2 }]
    })

    expect(session.id).toBeDefined()
    expect(session.status).toBe('ACTIVE')
    expect(session.partySize).toBe(3)

    // Resource should now be OCCUPIED
    const resAfterStart = await db.resource.findUnique({
      where: { id: resourceId }
    })
    expect(resAfterStart?.status).toBe('OCCUPIED')

    // 2. Extend by +30 min
    const extended = await extendSession(ctx, session.id, 30)
    expect(extended.expectedEndAt).toBeDefined()

    const initialEnd = new Date(session.expectedEndAt!).getTime()
    const newEnd = new Date(extended.expectedEndAt!).getTime()
    expect(newEnd - initialEnd).toBe(30 * 60 * 1000)

    // 3. END session with CASH payment
    const result = await endSession(ctx, session.id, {
      paymentMethod: 'CASH'
    })

    expect(result.session.status).toBe('COMPLETED')
    expect(result.billing.total).toBeGreaterThan(0)

    // 4. Verify payment recorded
    const payment = await db.payment.findFirst({
      where: { transaction: { sessionId: session.id } }
    })
    expect(payment).toBeDefined()
    expect(payment?.method).toBe('CASH')
    expect(payment?.status).toBe('PAID')

    // 5. Verify resource becomes AVAILABLE again
    const resAfterEnd = await db.resource.findUnique({
      where: { id: resourceId }
    })
    expect(resAfterEnd?.status).toBe('AVAILABLE')

    // 6. Verify customer history updated
    const customer = await db.customer.findUnique({
      where: { id: customerId }
    })
    expect(customer?.totalVisits).toBeGreaterThanOrEqual(1)
    expect(Number(customer?.totalSpending)).toBeGreaterThan(0)
  })
})
