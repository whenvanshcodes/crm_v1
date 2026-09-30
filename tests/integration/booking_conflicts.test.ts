import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import {
  createBooking,
  updateBookingStatus
} from '@/lib/services/booking'
import { createMaintenanceBlock, createResource } from '@/lib/services/resource'
import type { LocalContext } from '@/lib/auth/local'

describe('Double Booking & Conflict Prevention', () => {
  let ctx: LocalContext
  let resourceId: string
  let customerId: string

  beforeAll(async () => {
    const owner = await db.user.findUnique({
      where: { email: 'owner.a@parlour.local' }
    })
    ctx = {
      userId: owner!.id,
      venueId: owner!.venueId,
      role: 'OWNER',
      name: owner!.name
    }

    const category = await db.resourceCategory.findFirst({
      where: { venueId: ctx.venueId! }
    })

    const resource = await createResource(ctx, {
      name: `Conflict Isolation Table ${Date.now()}`,
      categoryId: category?.id,
      hourlyRate: 300
    })
    resourceId = resource.id

    const customer = await db.customer.upsert({
      where: { venueId_phone: { venueId: ctx.venueId!, phone: '9888877777' } },
      update: {},
      create: {
        venueId: ctx.venueId!,
        name: 'Conflict Test Customer',
        phone: '9888877777'
      }
    })
    customerId = customer.id
  })

  afterAll(async () => {
    if (resourceId) {
      await db.booking.deleteMany({ where: { resourceId } })
      await db.maintenanceBlock.deleteMany({ where: { resourceId } })
      await db.resource.delete({ where: { id: resourceId } }).catch(() => {})
    }
  })

  it('rejects exact overlapping booking', async () => {
    const baseTime = Date.now() + 3600000 * 50
    const start = new Date(baseTime)
    const end = new Date(baseTime + 3600000 * 2) // 2 hours

    // First booking succeeds
    const first = await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end
    })
    expect(first.id).toBeDefined()

    // Second booking with exact same slot must fail
    await expect(
      createBooking(ctx, {
        customerId,
        resourceId,
        startTime: start,
        endTime: end
      })
    ).rejects.toThrow('BOOKING_CONFLICT')
  })

  it('rejects partially overlapping booking (starts inside existing booking)', async () => {
    const baseTime = Date.now() + 3600000 * 60
    const start = new Date(baseTime)
    const end = new Date(baseTime + 3600000 * 2)

    await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end
    })

    // Overlaps from +1hr to +3hr
    const overlapStart = new Date(baseTime + 3600000)
    const overlapEnd = new Date(baseTime + 3600000 * 3)

    await expect(
      createBooking(ctx, {
        customerId,
        resourceId,
        startTime: overlapStart,
        endTime: overlapEnd
      })
    ).rejects.toThrow('BOOKING_CONFLICT')
  })

  it('allows adjacent non-overlapping bookings', async () => {
    const baseTime = Date.now() + 3600000 * 70
    const slot1Start = new Date(baseTime)
    const slot1End = new Date(baseTime + 3600000)

    const slot2Start = new Date(baseTime + 3600000)
    const slot2End = new Date(baseTime + 3600000 * 2)

    const b1 = await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: slot1Start,
      endTime: slot1End
    })
    expect(b1.id).toBeDefined()

    // Adjacent right after b1 ends
    const b2 = await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: slot2Start,
      endTime: slot2End
    })
    expect(b2.id).toBeDefined()
  })

  it('cancelled booking releases slot for a new reservation', async () => {
    const baseTime = Date.now() + 3600000 * 80
    const start = new Date(baseTime)
    const end = new Date(baseTime + 3600000)

    const booking = await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end
    })

    // Cancel first booking
    await updateBookingStatus(ctx, booking.id, 'CANCELLED')

    // New booking in same slot should now succeed
    const replacement = await createBooking(ctx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end
    })
    expect(replacement.id).toBeDefined()
  })

  it('rejects booking if resource has active maintenance block', async () => {
    const baseTime = Date.now() + 3600000 * 90
    const start = new Date(baseTime)
    const end = new Date(baseTime + 3600000 * 2)

    // Create maintenance block
    await createMaintenanceBlock(ctx, {
      resourceId,
      startTime: start,
      endTime: end,
      reason: 'Cushion replacement'
    })

    // Attempting to book during maintenance block must fail
    await expect(
      createBooking(ctx, {
        customerId,
        resourceId,
        startTime: start,
        endTime: end
      })
    ).rejects.toThrow('BOOKING_CONFLICT')
  })
})
