import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function listCustomers(venueId: string, search?: string) {
  const normalized = search ? normalizePhone(search) : ''
  const where = {
    venueId,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            ...(normalized ? [{ phone: { contains: normalized } }] : [])
          ]
        }
      : {})
  }

  return db.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })
}

export async function getCustomer(venueId: string, id: string) {
  const customer = await db.customer.findFirst({
    where: { id, venueId },
    include: {
      bookings: {
        include: { resource: true },
        orderBy: { startTime: 'desc' }
      },
      sessions: {
        include: {
          resource: {
            include: { category: true }
          },
          transaction: {
            include: { payments: true }
          }
        },
        orderBy: { startedAt: 'desc' }
      }
    }
  })
  if (!customer) throw new Error('NOT_FOUND')
  return customer
}

export async function getCustomerByPhone(venueId: string, phone: string) {
  const cleanPhone = normalizePhone(phone)
  return db.customer.findUnique({
    where: {
      venueId_phone: {
        venueId,
        phone: cleanPhone
      }
    }
  })
}

export async function getCustomerWithInsights(venueId: string, phone: string) {
  const cleanPhone = normalizePhone(phone)
  const customer = await db.customer.findUnique({
    where: {
      venueId_phone: {
        venueId,
        phone: cleanPhone
      }
    },
    include: {
      sessions: {
        where: { status: 'COMPLETED' },
        include: {
          resource: { include: { category: true } }
        },
        orderBy: { endedAt: 'desc' },
        take: 20
      }
    }
  })

  if (!customer) return null

  // Calculate insights
  const sessions = customer.sessions
  let typicalGroupSize: number | null = null
  let favouriteCategory: string | null = null
  let lastResourcePlayed: string | null = null

  if (sessions.length > 0) {
    const totalPeople = sessions.reduce((acc, s) => acc + (s.partySize || 1), 0)
    typicalGroupSize = Math.round(totalPeople / sessions.length)

    const catCounts = new Map<string, number>()
    for (const s of sessions) {
      const catName = s.resource?.category?.name || 'General'
      catCounts.set(catName, (catCounts.get(catName) || 0) + 1)
    }

    let topCat = ''
    let maxCount = 0
    for (const [cat, count] of catCounts.entries()) {
      if (count > maxCount) {
        maxCount = count
        topCat = cat
      }
    }
    favouriteCategory = topCat || null
    lastResourcePlayed = sessions[0]?.resource?.name || null
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    totalVisits: customer.totalVisits,
    totalSpending: customer.totalSpending,
    lastVisitAt: customer.lastVisitAt,
    typicalGroupSize,
    favouriteCategory,
    lastResourcePlayed,
    hasHistory: sessions.length > 0
  }
}

export async function createOrGetCustomer(
  ctx: LocalContext,
  data: { name: string; phone: string }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const phone = normalizePhone(data.phone)
  if (!phone || phone.length < 6) throw new Error('VALIDATION_ERROR')
  const name = data.name.trim()
  if (!name) throw new Error('VALIDATION_ERROR')

  const existing = await db.customer.findUnique({
    where: {
      venueId_phone: {
        venueId: ctx.venueId,
        phone
      }
    }
  })
  if (existing) return existing

  const customer = await db.customer.create({
    data: {
      venueId: ctx.venueId,
      name,
      phone
    }
  })

  await db.auditLog.create({
    data: {
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: 'CREATE',
      entity: 'CUSTOMER',
      entityId: customer.id,
      newValue: JSON.stringify({ name: customer.name, phone: customer.phone })
    }
  })

  return customer
}

export async function updateCustomer(
  ctx: LocalContext,
  id: string,
  data: { name?: string; phone?: string }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const existing = await db.customer.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!existing) throw new Error('NOT_FOUND')

  const updateData: { name?: string; phone?: string } = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.phone !== undefined) updateData.phone = normalizePhone(data.phone)

  const updated = await db.customer.update({
    where: { id },
    data: updateData
  })

  await db.auditLog.create({
    data: {
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: 'UPDATE',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: JSON.stringify({ name: existing.name, phone: existing.phone }),
      newValue: JSON.stringify(updateData)
    }
  })

  return updated
}
