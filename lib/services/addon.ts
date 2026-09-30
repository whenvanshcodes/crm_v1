import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export async function listAddOns(venueId: string, categoryName?: string) {
  return db.addOn.findMany({
    where: {
      venueId,
      active: true,
      ...(categoryName
        ? {
            OR: [
              { categoryName },
              { categoryName: null },
              { categoryName: '' }
            ]
          }
        : {})
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createAddOn(
  ctx: LocalContext,
  input: {
    name: string
    description?: string
    pricingType?: string
    price: number
    categoryName?: string
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  return db.addOn.create({
    data: {
      venueId: ctx.venueId,
      name: input.name,
      description: input.description,
      pricingType: input.pricingType || 'PER_HOUR',
      price: input.price,
      categoryName: input.categoryName || null,
      active: true
    }
  })
}

export async function updateAddOn(
  ctx: LocalContext,
  id: string,
  input: {
    name?: string
    description?: string
    pricingType?: string
    price?: number
    categoryName?: string
    active?: boolean
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const existing = await db.addOn.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!existing) throw new Error('NOT_FOUND')

  return db.addOn.update({
    where: { id },
    data: input
  })
}

export async function deleteAddOn(ctx: LocalContext, id: string) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')

  const existing = await db.addOn.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!existing) throw new Error('NOT_FOUND')

  return db.addOn.update({
    where: { id },
    data: { active: false }
  })
}
