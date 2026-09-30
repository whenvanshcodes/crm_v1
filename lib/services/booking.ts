import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { LocalContext } from '@/lib/auth/local'

type DatabaseClient = typeof db | Prisma.TransactionClient

export async function findAlternativeResources(
  venueId: string,
  categoryId: string | null,
  start: Date,
  end: Date,
  excludeResourceId: string,
  client: DatabaseClient = db
) {
  const candidates = await client.resource.findMany({
    where: {
      venueId,
      id: { not: excludeResourceId },
      status: 'AVAILABLE',
      ...(categoryId ? { categoryId } : {})
    }
  })

  const available: Array<{ id: string; name: string }> = []

  for (const candidate of candidates) {
    const [conflictBooking, conflictMaintenance, conflictSession] = await Promise.all([
      client.booking.findFirst({
        where: {
          venueId,
          resourceId: candidate.id,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          startTime: { lt: end },
          endTime: { gt: start }
        }
      }),
      client.maintenanceBlock.findFirst({
        where: {
          venueId,
          resourceId: candidate.id,
          startTime: { lt: end },
          endTime: { gt: start }
        }
      }),
      client.session.findFirst({
        where: {
          venueId,
          resourceId: candidate.id,
          status: 'ACTIVE',
          startedAt: { lt: end }
        }
      })
    ])

    if (
      !conflictBooking &&
      !conflictMaintenance &&
      (!conflictSession || (conflictSession.expectedEndAt && conflictSession.expectedEndAt <= start))
    ) {
      available.push({ id: candidate.id, name: candidate.name })
    }
  }

  return available
}

export async function assertAvailable(
  venueId: string,
  resourceId: string,
  start: Date,
  end: Date,
  ignoreBookingId?: string,
  client: DatabaseClient = db
) {
  const resource = await client.resource.findFirst({
    where: { id: resourceId, venueId }
  })
  if (!resource) throw new Error('NOT_FOUND')
  if (resource.status === 'DISABLED' || resource.status === 'MAINTENANCE') {
    throw new Error('RESOURCE_UNAVAILABLE')
  }

  const [booking, maintenance, activeSession] = await Promise.all([
    client.booking.findFirst({
      where: {
        venueId,
        resourceId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startTime: { lt: end },
        endTime: { gt: start },
        ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {})
      },
      include: { customer: true }
    }),
    client.maintenanceBlock.findFirst({
      where: {
        venueId,
        resourceId,
        startTime: { lt: end },
        endTime: { gt: start }
      }
    }),
    client.session.findFirst({
      where: {
        venueId,
        resourceId,
        status: 'ACTIVE',
        startedAt: { lt: end }
      },
      include: { customer: true }
    })
  ])

  if (
    booking ||
    maintenance ||
    (activeSession && activeSession.expectedEndAt && activeSession.expectedEndAt > start)
  ) {
    const alternatives = await findAlternativeResources(
      venueId,
      resource.categoryId,
      start,
      end,
      resourceId,
      client
    )

    let conflictDetail = ''
    if (booking) {
      conflictDetail = `Booked for ${booking.customer?.name || 'another customer'} (${booking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${booking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
    } else if (activeSession) {
      conflictDetail = `In active session with ${activeSession.customer?.name || 'customer'}.`
    } else if (maintenance) {
      conflictDetail = `Scheduled for maintenance.`
    }

    const altText =
      alternatives.length > 0
        ? ` Available alternatives: ${alternatives.map((a) => a.name).join(', ')}.`
        : ' No alternatives currently available.'

    const err = new Error(
      `BOOKING_CONFLICT: ${resource.name} is unavailable. ${conflictDetail}${altText}`
    ) as Error & { code?: string; alternatives?: Array<{ id: string; name: string }> }
    err.code = 'BOOKING_CONFLICT'
    err.alternatives = alternatives
    throw err
  }
}

export async function createBooking(
  ctx: LocalContext,
  input: {
    customerId: string
    resourceId: string
    startTime: Date
    endTime: Date
    partySize?: number
    groupMembers?: string
    notes?: string
    priceEstimate?: number
    addOns?: { addOnId: string; quantity?: number }[]
  }
) {
  if (!ctx.venueId || input.endTime <= input.startTime) {
    throw new Error('VALIDATION_ERROR')
  }

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, venueId: ctx.venueId }
  })
  if (!customer) throw new Error('NOT_FOUND')

  return db.$transaction(async (tx) => {
    await assertAvailable(ctx.venueId!, input.resourceId, input.startTime, input.endTime, undefined, tx)

    const durationMinutes = Math.max(1, Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000))

    const booking = await tx.booking.create({
      data: {
        venueId: ctx.venueId!,
        customerId: input.customerId,
        resourceId: input.resourceId,
        startTime: input.startTime,
        endTime: input.endTime,
        partySize: input.partySize ?? 1,
        groupMembers: input.groupMembers,
        plannedStartAt: input.startTime,
        plannedEndAt: input.endTime,
        plannedDurationMinutes: durationMinutes,
        notes: input.notes,
        priceEstimate: input.priceEstimate,
        status: 'CONFIRMED',
        createdById: ctx.userId
      },
      include: {
        customer: true,
        resource: true
      }
    })

    // Attach add-ons if supplied
    if (input.addOns && input.addOns.length > 0) {
      const addOnIds = input.addOns.map((a) => a.addOnId)
      const dbAddOns = await tx.addOn.findMany({
        where: { id: { in: addOnIds }, venueId: ctx.venueId!, active: true }
      })

      for (const item of input.addOns) {
        const found = dbAddOns.find((a) => a.id === item.addOnId)
        if (found) {
          await tx.bookingAddOn.create({
            data: {
              bookingId: booking.id,
              addOnId: found.id,
              quantity: item.quantity || 1,
              unitPrice: found.price,
              pricingType: found.pricingType
            }
          })
        }
      }
    }

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'CREATE',
        entity: 'BOOKING',
        entityId: booking.id,
        newValue: JSON.stringify({
          customerId: booking.customerId,
          resourceId: booking.resourceId,
          partySize: booking.partySize,
          start: booking.startTime,
          end: booking.endTime
        })
      }
    })

    return booking
  })
}

export async function getSmartAvailability(venueId: string, targetTime?: Date) {
  const checkTime = targetTime || new Date()
  const windowEnd = new Date(checkTime.getTime() + 60 * 60 * 1000) // 1 hour slot default

  const resources = await db.resource.findMany({
    where: { venueId, status: { notIn: ['DISABLED', 'MAINTENANCE'] } },
    include: {
      category: true,
      pricingRules: { where: { active: true } },
      bookings: {
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          endTime: { gt: checkTime }
        },
        orderBy: { startTime: 'asc' },
        take: 1
      },
      sessions: {
        where: { status: 'ACTIVE' },
        take: 1
      }
    }
  })

  return resources.map((r) => {
    const isLive = r.sessions.length > 0
    const nextBooking = r.bookings[0] || null
    const isBookedDuringSlot = nextBooking && nextBooking.startTime < windowEnd

    return {
      id: r.id,
      name: r.name,
      category: r.category?.name || 'General',
      rate: r.pricingRules[0]?.rate || 0,
      status: isLive ? 'LIVE' : isBookedDuringSlot ? 'UPCOMING' : 'AVAILABLE',
      nextBookingAt: nextBooking?.startTime || null,
      availableNow: !isLive && (!nextBooking || nextBooking.startTime > checkTime)
    }
  })
}

export async function listBookings(
  venueId: string,
  filters?: {
    status?: string
    resourceId?: string
    customerId?: string
    from?: Date
    to?: Date
  }
) {
  return db.booking.findMany({
    where: {
      venueId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.resourceId ? { resourceId: filters.resourceId } : {}),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.from || filters?.to
        ? {
            startTime: {
              ...(filters?.from ? { gte: filters.from } : {}),
              ...(filters?.to ? { lte: filters.to } : {})
            }
          }
        : {})
    },
    include: {
      customer: true,
      resource: true,
      addOns: { include: { addOn: true } }
    },
    orderBy: { startTime: 'asc' }
  })
}

export async function getBooking(venueId: string, id: string) {
  const booking = await db.booking.findFirst({
    where: { id, venueId },
    include: {
      customer: true,
      resource: {
        include: { pricingRules: true, category: true }
      },
      sessions: true,
      addOns: { include: { addOn: true } }
    }
  })
  if (!booking) throw new Error('NOT_FOUND')
  return booking
}

export async function updateBookingStatus(
  ctx: LocalContext,
  id: string,
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'ARRIVED'
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const existing = await db.booking.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!existing) throw new Error('NOT_FOUND')

  const updated = await db.booking.update({
    where: { id },
    data: { status }
  })

  await db.auditLog.create({
    data: {
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: 'UPDATE_STATUS',
      entity: 'BOOKING',
      entityId: id,
      oldValue: existing.status,
      newValue: status
    }
  })

  return updated
}

export async function cancelBooking(ctx: LocalContext, id: string, reason?: string) {
  return updateBookingStatus(ctx, id, 'CANCELLED')
}
