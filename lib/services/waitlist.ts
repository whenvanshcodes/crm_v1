import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export async function listWaitlist(venueId: string, status?: string) {
  return db.waitlistEntry.findMany({
    where: {
      venueId,
      ...(status ? { status } : { status: { in: ['WAITING', 'SKIPPED'] } })
    },
    include: {
      customer: true
    },
    orderBy: { createdAt: 'asc' }
  })
}

export async function addToWaitlist(
  ctx: LocalContext,
  input: {
    customerId: string
    partySize?: number
    categoryName?: string
    preferredTime?: string
    notes?: string
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  return db.waitlistEntry.create({
    data: {
      venueId: ctx.venueId,
      customerId: input.customerId,
      partySize: input.partySize || 1,
      categoryName: input.categoryName?.trim() || null,
      preferredTime: input.preferredTime?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'WAITING'
    },
    include: {
      customer: true
    }
  })
}

export async function updateWaitlistStatus(
  ctx: LocalContext,
  id: string,
  status: 'WAITING' | 'ASSIGNED' | 'SKIPPED' | 'REMOVED'
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const entry = await db.waitlistEntry.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!entry) throw new Error('NOT_FOUND')

  return db.waitlistEntry.update({
    where: { id },
    data: { status },
    include: { customer: true }
  })
}
