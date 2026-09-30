import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import {
  startSession,
  extendSession,
  endSession,
  calculateSessionBill
} from '@/lib/services/session'
import { createBooking, cancelBooking, updateBookingStatus } from '@/lib/services/booking'
import { createOrGetCustomer } from '@/lib/services/customer'
import { updateResource } from '@/lib/services/resource'
import { LocalContext } from '@/lib/auth/local'

describe('Final Acceptance & Product Walkthrough E2E Test Matrix', () => {
  let branch1Id: string
  let branch2Id: string
  let ownerCtx: LocalContext
  let receptionist1Ctx: LocalContext
  let receptionist2Ctx: LocalContext
  let ps5Res1: any
  let ps5Res2: any
  let extraControllerAddon: any
  const createdBookingIds: string[] = []

  afterAll(async () => {
    if (createdBookingIds.length > 0) {
      await db.bookingAddOn.deleteMany({ where: { bookingId: { in: createdBookingIds } } })
      await db.booking.deleteMany({ where: { id: { in: createdBookingIds } } })
    }
  })

  beforeAll(async () => {
    // Locate Cue Club branches seeded
    const b1 = await db.venue.findFirst({ where: { name: { contains: 'Branch 1' } } })
    const b2 = await db.venue.findFirst({ where: { name: { contains: 'Branch 2' } } })
    if (!b1 || !b2) throw new Error('Seeded branches not found')
    branch1Id = b1.id
    branch2Id = b2.id

    const owner = await db.user.findFirst({ where: { role: 'OWNER' } })
    if (!owner) throw new Error('Owner not found')

    ownerCtx = {
      userId: owner.id,
      venueId: branch1Id,
      role: 'OWNER',
      name: owner.name
    }

    let rec1 = await db.user.findFirst({ where: { venueId: branch1Id, role: 'RECEPTIONIST' } })
    if (!rec1) {
      rec1 = await db.user.create({
        data: {
          venueId: branch1Id,
          name: 'Rohan Receptionist',
          email: 'rohan.rec@cueclub.local',
          passwordHash: 'dummy',
          role: 'RECEPTIONIST',
          status: 'ACTIVE'
        }
      })
    }

    receptionist1Ctx = {
      userId: rec1.id,
      venueId: branch1Id,
      role: 'RECEPTIONIST',
      name: rec1.name
    }

    let rec2 = await db.user.findFirst({ where: { venueId: branch2Id, role: 'RECEPTIONIST' } })
    if (!rec2) {
      rec2 = await db.user.create({
        data: {
          venueId: branch2Id,
          name: 'Pooja Receptionist B2',
          email: 'pooja.rec@cueclub.local',
          passwordHash: 'dummy',
          role: 'RECEPTIONIST',
          status: 'ACTIVE'
        }
      })
    }

    receptionist2Ctx = {
      userId: rec2.id,
      venueId: branch2Id,
      role: 'RECEPTIONIST',
      name: rec2.name
    }

    // Find PS5 resources in Branch 1
    const resources = await db.resource.findMany({
      where: { venueId: branch1Id, name: { contains: 'PS5' } },
      include: { pricingRules: true }
    })
    ps5Res1 = resources[0]
    ps5Res2 = resources[1]

    await db.resource.updateMany({
      where: { id: { in: [ps5Res1.id, ps5Res2.id] } },
      data: { status: 'AVAILABLE' }
    })

    // Ensure extra controller add-on exists in Branch 1
    extraControllerAddon = await db.addOn.findFirst({
      where: { venueId: branch1Id, name: 'Extra Controller' }
    })
    if (!extraControllerAddon) {
      extraControllerAddon = await db.addOn.create({
        data: {
          venueId: branch1Id,
          name: 'Extra Controller',
          price: 60,
          pricingType: 'PER_HOUR',
          active: true
        }
      })
    }
  })

  // 1. Mandatory End-to-End Walkthrough Simulation
  it('1. Standard Walk-in: Start, Timer/Running, Extend +30m, End & Bill with UPI Payment', async () => {
    // Step A: Receptionist finds or creates customer
    const customer = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Amit Sharma',
      phone: '9876543210'
    })
    expect(customer.id).toBeDefined()
    expect(customer.name).toBe('Amit Sharma')

    // Step B: Calculate hourly rate with add-ons
    // Base PS5: ₹120/hr, 2 Extra Controllers: 2 * ₹60 = ₹120/hr. Total hourly rate = ₹240/hr.
    const startEstimate = new Date('2026-10-01T10:00:00Z')
    const endEstimate = new Date('2026-10-01T11:00:00Z')
    const hourlyEstimate = calculateSessionBill(120, startEstimate, endEstimate, 0, 0, [
      { name: 'Extra Controller', price: 60, pricingType: 'PER_HOUR', quantity: 2 }
    ], 3)
    expect(hourlyEstimate.hourlyRate).toBe(240)

    // Step C: Start 2-hour walk-in session
    const session = await startSession(receptionist1Ctx, {
      customerId: customer.id,
      resourceId: ps5Res1.id,
      partySize: 3,
      expectedDurationMinutes: 120,
      groupMembers: 'Amit Sharma with 2 companions',
      addOns: [{ addOnId: extraControllerAddon.id, quantity: 2 }]
    })

    expect(session.status).toBe('ACTIVE')
    expect(session.plannedDurationMinutes).toBe(120)
    expect(session.plannedEndAt).toBeDefined()

    // Verify resource is now OCCUPIED
    const resOccupied = await db.resource.findUnique({ where: { id: ps5Res1.id } })
    expect(resOccupied?.status).toBe('OCCUPIED')

    // Step D: Running bill calculation (45 mins elapsed)
    const runningCalc = calculateSessionBill(
      120,
      session.startedAt,
      new Date(session.startedAt.getTime() + 45 * 60000),
      0,
      0,
      [{ name: 'Extra Controller', price: 60, pricingType: 'PER_HOUR', quantity: 2 }],
      3
    )
    expect(runningCalc.total).toBe(180) // 45 mins of ₹240/hr = ₹180

    // Step E: Extend by 30 mins
    const extended = await extendSession(receptionist1Ctx, session.id, 30)
    expect(extended.plannedDurationMinutes).toBe(120) // Planned duration MUST remain unchanged!
    expect(extended.extensionHistory).toBeDefined()
    const history = JSON.parse(extended.extensionHistory || '[]')
    expect(history.length).toBe(1)
    expect(history[0].minutes).toBe(30)

    // Step F: End & Bill
    const ended = await endSession(receptionist1Ctx, session.id, {
      paymentMethod: 'UPI'
    })

    expect(ended.session.status).toBe('COMPLETED')
    expect(ended.session.actualDurationMinutes).toBeGreaterThanOrEqual(1)
    expect(ended.session.finalAmount).toBeGreaterThan(0)
    expect(ended.payment).toBeDefined()
    expect(ended.payment!.method).toBe('UPI')
    expect(ended.payment!.amount).toBe(ended.session.finalAmount)

    // Verify resource released
    const resReleased = await db.resource.findUnique({ where: { id: ps5Res1.id } })
    expect(resReleased?.status).toBe('AVAILABLE')

    // Verify customer stats updated
    const updatedCust = await db.customer.findUnique({ where: { id: customer.id } })
    expect(updatedCust?.totalVisits).toBeGreaterThanOrEqual(1)
    expect(updatedCust?.totalSpending).toBeGreaterThanOrEqual(ended.payment!.amount)
  })

  // 2. Early-End Billing Test (2h Booked @ ₹360 -> Ended at 1h -> Final Bill = ₹180)
  it('2. Early-End Billing: Booked 2h ₹360, actual 1h usage charges exactly ₹180', () => {
    const plannedStart = new Date('2026-10-01T14:00:00Z')
    const actualEnd = new Date('2026-10-01T15:00:00Z') // 1h actual

    const bill = calculateSessionBill(180, plannedStart, actualEnd)

    expect(bill.durationMinutes).toBe(60)
    expect(bill.total).toBe(180)
  })

  // 3. Overtime Billing Test (2h Booked @ ₹360 -> Ended at 2h20m -> Final Bill = ₹420)
  it('3. Overtime Billing: Booked 2h ₹360, actual 2h20m usage charges exactly ₹420', () => {
    const plannedStart = new Date('2026-10-01T14:00:00Z')
    const actualEnd = new Date('2026-10-01T16:20:00Z') // 2h 20m = 140m

    const bill = calculateSessionBill(180, plannedStart, actualEnd)

    expect(bill.durationMinutes).toBe(140)
    // 140 / 60 * 180 = 420
    expect(bill.total).toBe(420)
  })

  // 4. Booking Conflict Test (Double booking rejected, alternate resource allowed)
  it('4. Booking Conflict Prevention: Overlapping reservation on same resource is rejected', async () => {
    const customer = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Rohan Sharma',
      phone: '9826099999'
    })

    const baseTime = Date.now() + 86400000 * 30 + Math.floor(Math.random() * 100000)
    const startA = new Date(baseTime)
    const endA = new Date(baseTime + 2 * 3600000)

    // Create Booking A
    const bookingA = await createBooking(receptionist1Ctx, {
      customerId: customer.id,
      resourceId: ps5Res1.id,
      startTime: startA,
      endTime: endA,
      partySize: 2
    })
    expect(bookingA.id).toBeDefined()
    createdBookingIds.push(bookingA.id)

    // Attempt overlapping Booking B on same resource
    const startB = new Date(baseTime + 3600000)
    const endB = new Date(baseTime + 3 * 3600000)

    await expect(
      createBooking(receptionist1Ctx, {
        customerId: customer.id,
        resourceId: ps5Res1.id,
        startTime: startB,
        endTime: endB,
        partySize: 2
      })
    ).rejects.toThrow()

    // Allowed on alternative resource (PS5 Lounge 02)
    const bookingAlternative = await createBooking(receptionist1Ctx, {
      customerId: customer.id,
      resourceId: ps5Res2.id,
      startTime: startB,
      endTime: endB,
      partySize: 2
    })
    expect(bookingAlternative.id).toBeDefined()
    expect(bookingAlternative.resourceId).toBe(ps5Res2.id)
    createdBookingIds.push(bookingAlternative.id)
  })

  // 5. Maintenance Conflict Test
  it('5. Maintenance Mode: Resource in maintenance rejects new sessions', async () => {
    // Put ps5Res2 into maintenance
    await updateResource(ownerCtx, ps5Res2.id, { status: 'MAINTENANCE' })

    const customer = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Suresh Kumar',
      phone: '9826077777'
    })

    await expect(
      startSession(receptionist1Ctx, {
        customerId: customer.id,
        resourceId: ps5Res2.id,
        partySize: 1,
        expectedDurationMinutes: 60
      })
    ).rejects.toThrow()

    // Restore to available
    await updateResource(ownerCtx, ps5Res2.id, { status: 'AVAILABLE' })
    const restored = await db.resource.findUnique({ where: { id: ps5Res2.id } })
    expect(restored?.status).toBe('AVAILABLE')
  })

  // 6. Customer Reuse: Identical phone reuses record without duplicating
  it('6. Customer Phone Deduplication: Same phone reuses existing record', async () => {
    const cust1 = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Vijay Verma',
      phone: '9826055555'
    })

    const cust2 = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Vijay V.',
      phone: '9826055555'
    })

    expect(cust1.id).toBe(cust2.id)
  })

  // 7. Cancellation & No-Show Record Preservation
  it('7. Historical Integrity: Cancelled and No-Show bookings retain records', async () => {
    const customer = await createOrGetCustomer(receptionist1Ctx, {
      name: 'Pooja Jain',
      phone: '9826044444'
    })

    const baseTime1 = Date.now() + 86400000 * 50 + Math.floor(Math.random() * 100000)
    const booking = await createBooking(receptionist1Ctx, {
      customerId: customer.id,
      resourceId: ps5Res1.id,
      startTime: new Date(baseTime1),
      endTime: new Date(baseTime1 + 3600000),
      partySize: 2
    })
    createdBookingIds.push(booking.id)

    // Cancel
    const cancelled = await cancelBooking(receptionist1Ctx, booking.id, 'Customer called to cancel')
    expect(cancelled.status).toBe('CANCELLED')

    // Verify record is preserved in database
    const dbRecord = await db.booking.findUnique({ where: { id: booking.id } })
    expect(dbRecord).not.toBeNull()
    expect(dbRecord?.status).toBe('CANCELLED')

    // Mark another booking as NO_SHOW
    const baseTime2 = Date.now() + 86400000 * 60 + Math.floor(Math.random() * 100000)
    const booking2 = await createBooking(receptionist1Ctx, {
      customerId: customer.id,
      resourceId: ps5Res1.id,
      startTime: new Date(baseTime2),
      endTime: new Date(baseTime2 + 3600000),
      partySize: 2
    })
    createdBookingIds.push(booking2.id)

    const noShow = await updateBookingStatus(receptionist1Ctx, booking2.id, 'NO_SHOW')
    expect(noShow.status).toBe('NO_SHOW')
  })

  // 8. Multi-Branch Isolation
  it('8. Multi-Branch Isolation: Branch 2 receptionist cannot operate Branch 1 resource', async () => {
    const customer = await createOrGetCustomer(receptionist2Ctx, {
      name: 'Rahul B2',
      phone: '9826033333'
    })

    // Attempt to start session on Branch 1 resource from Branch 2 receptionist context
    await expect(
      startSession(receptionist2Ctx, {
        customerId: customer.id,
        resourceId: ps5Res1.id, // Belongs to Branch 1!
        partySize: 1,
        expectedDurationMinutes: 60
      })
    ).rejects.toThrow()
  })
})
