import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export interface AddOnItem {
  id?: string
  name: string
  price: number
  pricingType: string // PER_HOUR, PER_SESSION, PER_PERSON, FIXED_CHARGE
  quantity: number
}

export interface BillingCalculation {
  durationMinutes: number
  baseCharge: number
  addOnsCharge: number
  subtotal: number
  discount: number
  tax: number
  total: number
  hourlyRate: number
}

export function calculateSessionBill(
  rate: number,
  start: Date,
  end: Date,
  discount: number = 0,
  taxRate: number = 0,
  addOns: AddOnItem[] = [],
  partySize: number = 1
): BillingCalculation {
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000))

  // Base rate calculation
  let baseCharge = (durationMinutes * rate) / 60

  // Preserve backwards-compatibility for quick test sessions under 30 mins with no add-ons
  if (addOns.length === 0 && durationMinutes < 30) {
    baseCharge = Math.max(Math.round(rate / 2), baseCharge)
  }

  let addOnsCharge = 0
  let hourlyAddOnRate = 0

  for (const addon of addOns) {
    const qty = Math.max(1, addon.quantity || 1)
    switch (addon.pricingType) {
      case 'PER_HOUR':
        addOnsCharge += (addon.price * qty * durationMinutes) / 60
        hourlyAddOnRate += addon.price * qty
        break
      case 'PER_SESSION':
        addOnsCharge += addon.price * qty
        break
      case 'PER_PERSON':
        addOnsCharge += addon.price * qty * Math.max(1, partySize)
        break
      case 'FIXED_CHARGE':
        addOnsCharge += addon.price * qty
        break
      default:
        addOnsCharge += (addon.price * qty * durationMinutes) / 60
        hourlyAddOnRate += addon.price * qty
    }
  }

  const calculatedSubtotal = Math.round(baseCharge + addOnsCharge)
  const safeDiscount = Math.min(calculatedSubtotal, Math.max(0, discount))
  const afterDiscount = calculatedSubtotal - safeDiscount
  const tax = Math.round(afterDiscount * taxRate)
  const total = Math.max(0, afterDiscount + tax)

  return {
    durationMinutes,
    baseCharge: Math.round(baseCharge),
    addOnsCharge: Math.round(addOnsCharge),
    subtotal: calculatedSubtotal,
    discount: safeDiscount,
    tax,
    total,
    hourlyRate: rate + hourlyAddOnRate
  }
}

export async function startSession(
  ctx: LocalContext,
  input: {
    customerId: string
    resourceId: string
    pricingRuleId?: string
    bookingId?: string
    expectedDurationMinutes?: number
    partySize?: number
    groupMembers?: string
    addOns?: { addOnId: string; quantity?: number }[]
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const now = new Date()
  const durationMinutes = input.expectedDurationMinutes ?? 60
  const expectedEndAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

  // Resolve customer and resource
  const [customer, resource] = await Promise.all([
    db.customer.findFirst({ where: { id: input.customerId, venueId: ctx.venueId } }),
    db.resource.findFirst({
      where: { id: input.resourceId, venueId: ctx.venueId },
      include: { pricingRules: true, category: true }
    })
  ])

  if (!customer || !resource) throw new Error('NOT_FOUND')
  if (['DISABLED', 'MAINTENANCE'].includes(resource.status)) {
    throw new Error('RESOURCE_UNAVAILABLE')
  }

  // Resolve pricing rule: passed explicitly or default active rule for resource
  let pricingRuleId = input.pricingRuleId
  if (!pricingRuleId) {
    const defaultRule = resource.pricingRules.find((r) => r.active)
    if (!defaultRule) {
      const rule = await db.pricingRule.findFirst({
        where: { venueId: ctx.venueId, active: true }
      })
      if (!rule) throw new Error('VALIDATION_ERROR')
      pricingRuleId = rule.id
    } else {
      pricingRuleId = defaultRule.id
    }
  }

  const pricingRule = await db.pricingRule.findFirst({
    where: { id: pricingRuleId, venueId: ctx.venueId, active: true }
  })
  if (!pricingRule) throw new Error('NOT_FOUND')

  // Check if booking was passed to carry over planned values and add-ons
  let bookingPartySize = input.partySize ?? 1
  let bookingGroupMembers = input.groupMembers
  let bookingAddOns = input.addOns || []
  let plannedStartAt = now
  let plannedEndAt = expectedEndAt
  let plannedDurationMinutes = durationMinutes

  if (input.bookingId) {
    const booking = await db.booking.findFirst({
      where: { id: input.bookingId, venueId: ctx.venueId },
      include: { addOns: { include: { addOn: true } } }
    })
    if (booking) {
      plannedStartAt = booking.startTime
      plannedEndAt = booking.endTime
      plannedDurationMinutes = Math.max(1, Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60000))
      bookingPartySize = input.partySize ?? booking.partySize
      bookingGroupMembers = input.groupMembers ?? booking.groupMembers ?? undefined
      if (bookingAddOns.length === 0 && booking.addOns.length > 0) {
        bookingAddOns = booking.addOns.map((ba) => ({
          addOnId: ba.addOnId,
          quantity: ba.quantity
        }))
      }
    }
  }

  return db.$transaction(async (tx) => {
    // Concurrency check: Ensure resource is not occupied or actively in session
    const activeSession = await tx.session.findFirst({
      where: { venueId: ctx.venueId!, resourceId: input.resourceId, status: 'ACTIVE' }
    })
    if (activeSession) throw new Error('SESSION_CONFLICT')

    const currentResource = await tx.resource.findFirst({
      where: { id: input.resourceId, venueId: ctx.venueId! }
    })
    if (currentResource?.status === 'OCCUPIED') throw new Error('SESSION_CONFLICT')

    // Fetch add-ons details for rate calculation
    const addOnIds = bookingAddOns.map((a) => a.addOnId)
    const resolvedAddOns = addOnIds.length > 0
      ? await tx.addOn.findMany({
          where: { id: { in: addOnIds }, venueId: ctx.venueId!, active: true }
        })
      : []

    const addOnItems: AddOnItem[] = bookingAddOns.map((inputAddon) => {
      const dbAddon = resolvedAddOns.find((r) => r.id === inputAddon.addOnId)
      return {
        id: inputAddon.addOnId,
        name: dbAddon?.name || 'Add-on',
        price: dbAddon?.price || 0,
        pricingType: dbAddon?.pricingType || 'PER_HOUR',
        quantity: inputAddon.quantity || 1
      }
    })

    // Calculate planned booked amount
    const initialBill = calculateSessionBill(
      pricingRule.rate,
      now,
      expectedEndAt,
      0,
      0,
      addOnItems,
      bookingPartySize
    )

    const session = await tx.session.create({
      data: {
        venueId: ctx.venueId!,
        resourceId: input.resourceId,
        customerId: input.customerId,
        pricingRuleId,
        bookingId: input.bookingId,
        startedAt: now,
        expectedEndAt,
        status: 'ACTIVE',
        partySize: bookingPartySize,
        groupMembers: bookingGroupMembers,
        plannedStartAt,
        plannedEndAt,
        plannedDurationMinutes,
        bookedAmount: initialBill.total,
        createdById: ctx.userId
      },
      include: {
        customer: true,
        resource: true,
        pricingRule: true,
        addOns: { include: { addOn: true } }
      }
    })

    // Create session add-ons
    for (const item of addOnItems) {
      if (item.id) {
        await tx.sessionAddOn.create({
          data: {
            sessionId: session.id,
            addOnId: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            pricingType: item.pricingType
          }
        })
      }
    }

    await tx.resource.update({
      where: { id: input.resourceId },
      data: { status: 'OCCUPIED' }
    })

    if (input.bookingId) {
      await tx.booking.update({
        where: { id: input.bookingId },
        data: { status: 'COMPLETED' }
      })
    }

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'START',
        entity: 'SESSION',
        entityId: session.id,
        newValue: JSON.stringify({
          resourceId: session.resourceId,
          customerId: session.customerId,
          partySize: session.partySize,
          bookedAmount: initialBill.total
        })
      }
    })

    const freshSession = await tx.session.findUnique({
      where: { id: session.id },
      include: {
        customer: true,
        resource: true,
        pricingRule: true,
        addOns: { include: { addOn: true } }
      }
    })

    return freshSession || session
  })
}

export async function getMaxAvailableExtension(ctx: LocalContext, sessionId: string) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const session = await db.session.findFirst({
    where: { id: sessionId, venueId: ctx.venueId, status: 'ACTIVE' }
  })
  if (!session) throw new Error('NOT_FOUND')

  const currentPlannedEnd = session.expectedEndAt ?? new Date()

  // Find next upcoming booking for this resource
  const nextBooking = await db.booking.findFirst({
    where: {
      venueId: ctx.venueId,
      resourceId: session.resourceId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startTime: { gte: currentPlannedEnd }
    },
    orderBy: { startTime: 'asc' },
    include: { customer: true }
  })

  // Find next maintenance block
  const nextMaintenance = await db.maintenanceBlock.findFirst({
    where: {
      venueId: ctx.venueId,
      resourceId: session.resourceId,
      startTime: { gte: currentPlannedEnd }
    },
    orderBy: { startTime: 'asc' }
  })

  let maxMinutes = 180 // default max 3 hours extension window
  let conflictReason: string | null = null
  let nextBookingTime: string | null = null

  if (nextBooking) {
    const diffMs = nextBooking.startTime.getTime() - currentPlannedEnd.getTime()
    const availableMinutes = Math.max(0, Math.floor(diffMs / 60000))
    if (availableMinutes < maxMinutes) {
      maxMinutes = availableMinutes
      conflictReason = `Next booking for ${nextBooking.customer.name} starts at ${nextBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      nextBookingTime = nextBooking.startTime.toISOString()
    }
  }

  if (nextMaintenance) {
    const diffMs = nextMaintenance.startTime.getTime() - currentPlannedEnd.getTime()
    const availableMinutes = Math.max(0, Math.floor(diffMs / 60000))
    if (availableMinutes < maxMinutes) {
      maxMinutes = availableMinutes
      conflictReason = `Maintenance scheduled at ${nextMaintenance.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
  }

  return {
    maxMinutes,
    currentPlannedEnd,
    conflictReason,
    nextBookingTime
  }
}

export async function extendSession(ctx: LocalContext, id: string, minutes: number) {
  if (!ctx.venueId || minutes < 1) throw new Error('VALIDATION_ERROR')

  const session = await db.session.findFirst({
    where: { id, venueId: ctx.venueId, status: 'ACTIVE' },
    include: {
      pricingRule: true,
      addOns: { include: { addOn: true } }
    }
  })
  if (!session) throw new Error('NOT_FOUND')

  const { maxMinutes, conflictReason } = await getMaxAvailableExtension(ctx, id)

  if (minutes > maxMinutes) {
    throw new Error(
      `CONFLICT: Maximum available extension is ${maxMinutes} minutes. ${conflictReason || ''}`
    )
  }

  const currentEnd = session.expectedEndAt ?? new Date()
  const newEnd = new Date(currentEnd.getTime() + minutes * 60 * 1000)

  return db.$transaction(async (tx) => {
    // Parse existing extension history
    let history: Array<{
      minutes: number
      addedAt: string
      previousPlannedEnd: string
      newPlannedEnd: string
    }> = []

    if (session.extensionHistory) {
      try {
        history = JSON.parse(session.extensionHistory)
      } catch {
        history = []
      }
    }

    history.push({
      minutes,
      addedAt: new Date().toISOString(),
      previousPlannedEnd: currentEnd.toISOString(),
      newPlannedEnd: newEnd.toISOString()
    })

    const updated = await tx.session.update({
      where: { id },
      data: {
        expectedEndAt: newEnd,
        extensionHistory: JSON.stringify(history)
      },
      include: {
        customer: true,
        resource: true,
        pricingRule: true,
        addOns: { include: { addOn: true } }
      }
    })

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'EXTEND',
        entity: 'SESSION',
        entityId: id,
        newValue: JSON.stringify({ minutes, newExpectedEnd: newEnd, totalExtensions: history.length })
      }
    })

    return updated
  })
}

export async function endSession(
  ctx: LocalContext,
  id: string,
  options?: { discount?: number; notes?: string; paymentMethod?: string }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const session = await db.session.findFirst({
    where: { id, venueId: ctx.venueId, status: 'ACTIVE' },
    include: {
      pricingRule: true,
      addOns: { include: { addOn: true } }
    }
  })
  if (!session) throw new Error('NOT_FOUND')

  const endedAt = new Date()
  const addOnItems: AddOnItem[] = session.addOns.map((sa) => ({
    name: sa.addOn.name,
    price: sa.unitPrice,
    pricingType: sa.pricingType,
    quantity: sa.quantity
  }))

  const billing = calculateSessionBill(
    session.pricingRule.rate,
    session.startedAt,
    endedAt,
    options?.discount ?? 0,
    0,
    addOnItems,
    session.partySize
  )

  const plannedMinutes =
    session.plannedDurationMinutes ||
    Math.max(1, Math.round(((session.expectedEndAt?.getTime() ?? endedAt.getTime()) - session.startedAt.getTime()) / 60000))

  const actualMinutes = billing.durationMinutes
  const hasExtensions = !!session.extensionHistory && JSON.parse(session.extensionHistory || '[]').length > 0

  let completionStatus = 'COMPLETED_AS_BOOKED'
  if (actualMinutes < plannedMinutes - 3) {
    completionStatus = 'ENDED_EARLY'
  } else if (hasExtensions) {
    completionStatus = 'EXTENDED'
  } else if (actualMinutes > plannedMinutes + 3) {
    completionStatus = 'RAN_OVER'
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt,
        actualStartAt: session.startedAt,
        actualEndAt: endedAt,
        actualDurationMinutes: actualMinutes,
        actualAmount: billing.total,
        finalAmount: billing.total,
        completionStatus,
        endedById: ctx.userId
      },
      include: {
        customer: true,
        resource: true,
        pricingRule: true,
        addOns: { include: { addOn: true } }
      }
    })

    const transaction = await tx.transaction.create({
      data: {
        venueId: ctx.venueId!,
        sessionId: id,
        subtotal: billing.subtotal,
        discount: billing.discount,
        tax: billing.tax,
        total: billing.total
      }
    })

    // If a payment method is supplied, record payment immediately (One session, One bill, One payment)
    let payment = null
    if (options?.paymentMethod && billing.total >= 0) {
      payment = await tx.payment.create({
        data: {
          venueId: ctx.venueId!,
          transactionId: transaction.id,
          amount: billing.total,
          method: options.paymentMethod,
          status: 'PAID',
          recordedById: ctx.userId
        }
      })
    }

    await tx.resource.update({
      where: { id: session.resourceId },
      data: { status: 'AVAILABLE' }
    })

    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        totalVisits: { increment: 1 },
        totalSpending: { increment: billing.total },
        lastVisitAt: endedAt
      }
    })

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'END',
        entity: 'SESSION',
        entityId: id,
        newValue: JSON.stringify({
          total: billing.total,
          duration: billing.durationMinutes,
          bookedAmount: session.bookedAmount,
          completionStatus
        })
      }
    })

    const fullTransaction = await tx.transaction.findUnique({
      where: { id: transaction.id },
      include: { payments: true }
    })

    return {
      session: updated,
      transaction: fullTransaction || transaction,
      payment,
      billing: {
        ...billing,
        bookedAmount: session.bookedAmount ?? billing.total,
        bookedMinutes: plannedMinutes,
        completionStatus
      }
    }
  })
}

export async function cancelSession(ctx: LocalContext, id: string) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const session = await db.session.findFirst({
    where: { id, venueId: ctx.venueId, status: 'ACTIVE' }
  })
  if (!session) throw new Error('NOT_FOUND')

  return db.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        endedAt: new Date(),
        endedById: ctx.userId
      }
    })

    await tx.resource.update({
      where: { id: session.resourceId },
      data: { status: 'AVAILABLE' }
    })

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'CANCEL',
        entity: 'SESSION',
        entityId: id
      }
    })

    return updated
  })
}

export async function listActiveSessions(venueId: string) {
  return db.session.findMany({
    where: { venueId, status: 'ACTIVE' },
    include: {
      customer: true,
      resource: {
        include: { pricingRules: true, category: true }
      },
      pricingRule: true,
      addOns: {
        include: { addOn: true }
      }
    },
    orderBy: { startedAt: 'asc' }
  })
}

export async function listSessions(
  venueId: string,
  filters?: {
    status?: string
    resourceId?: string
    customerId?: string
  }
) {
  return db.session.findMany({
    where: {
      venueId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.resourceId ? { resourceId: filters.resourceId } : {}),
      ...(filters?.customerId ? { customerId: filters.customerId } : {})
    },
    include: {
      customer: true,
      resource: {
        include: { pricingRules: true, category: true }
      },
      pricingRule: true,
      transaction: {
        include: { payments: true }
      },
      addOns: {
        include: { addOn: true }
      }
    },
    orderBy: { startedAt: 'desc' }
  })
}

export async function getSession(venueId: string, id: string) {
  const session = await db.session.findFirst({
    where: { id, venueId },
    include: {
      customer: true,
      resource: {
        include: { pricingRules: true, category: true }
      },
      pricingRule: true,
      booking: true,
      transaction: {
        include: { payments: true }
      },
      addOns: {
        include: { addOn: true }
      }
    }
  })
  if (!session) throw new Error('NOT_FOUND')
  return session
}
