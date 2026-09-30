import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export async function listResources(venueId: string) {
  return db.resource.findMany({
    where: { venueId },
    include: {
      category: true,
      pricingRules: {
        where: { active: true }
      },
      sessions: {
        where: { status: 'ACTIVE' },
        include: { customer: true }
      }
    },
    orderBy: { name: 'asc' }
  })
}

export async function getResource(venueId: string, id: string) {
  const resource = await db.resource.findFirst({
    where: { id, venueId },
    include: {
      category: true,
      pricingRules: true,
      sessions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: { customer: true }
      },
      bookings: {
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 10,
        include: { customer: true }
      },
      maintenanceBlocks: {
        orderBy: { startTime: 'desc' },
        take: 5
      }
    }
  })
  if (!resource) throw new Error('NOT_FOUND')
  return resource
}

export async function createResource(
  ctx: LocalContext,
  input: {
    name: string
    categoryId?: string
    categoryName?: string
    description?: string
    imageUrl?: string | null
    hourlyRate?: number
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const name = input.name.trim()
  if (!name) throw new Error('VALIDATION_ERROR')

  let categoryId = input.categoryId
  if (!categoryId && input.categoryName) {
    const category = await db.resourceCategory.upsert({
      where: {
        venueId_name: {
          venueId: ctx.venueId,
          name: input.categoryName.trim()
        }
      },
      update: {},
      create: {
        venueId: ctx.venueId,
        name: input.categoryName.trim()
      }
    })
    categoryId = category.id
  }

  return db.$transaction(async (tx) => {
    const resource = await tx.resource.create({
      data: {
        venueId: ctx.venueId!,
        name,
        categoryId,
        description: input.description,
        imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
        status: 'AVAILABLE'
      },
      include: { category: true }
    })

    if (input.hourlyRate !== undefined && input.hourlyRate >= 0) {
      await tx.pricingRule.create({
        data: {
          venueId: ctx.venueId!,
          resourceId: resource.id,
          unit: 'HOUR',
          rate: input.hourlyRate,
          active: true
        }
      })
    }

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'CREATE',
        entity: 'RESOURCE',
        entityId: resource.id,
        newValue: JSON.stringify({ name: resource.name, hourlyRate: input.hourlyRate })
      }
    })

    return resource
  })
}

export async function updateResource(
  ctx: LocalContext,
  id: string,
  input: {
    name?: string
    categoryId?: string
    description?: string
    imageUrl?: string | null
    status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DISABLED'
    hourlyRate?: number
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  const existing = await db.resource.findFirst({
    where: { id, venueId: ctx.venueId },
    include: { pricingRules: true }
  })
  if (!existing) throw new Error('NOT_FOUND')

  return db.$transaction(async (tx) => {
    const updateData: {
      name?: string
      categoryId?: string
      description?: string
      imageUrl?: string | null
      status?: string
    } = {}
    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId
    if (input.description !== undefined) updateData.description = input.description
    if (input.imageUrl !== undefined) {
      updateData.imageUrl = input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null
    }
    if (input.status !== undefined) updateData.status = input.status

    const updated = await tx.resource.update({
      where: { id },
      data: updateData,
      include: { category: true, pricingRules: true }
    })

    if (input.hourlyRate !== undefined && input.hourlyRate >= 0) {
      const activeRule = existing.pricingRules.find((r) => r.active)
      if (activeRule) {
        await tx.pricingRule.update({
          where: { id: activeRule.id },
          data: { rate: input.hourlyRate }
        })
      } else {
        await tx.pricingRule.create({
          data: {
            venueId: ctx.venueId!,
            resourceId: id,
            unit: 'HOUR',
            rate: input.hourlyRate,
            active: true
          }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'UPDATE',
        entity: 'RESOURCE',
        entityId: id,
        oldValue: JSON.stringify({ status: existing.status, name: existing.name }),
        newValue: JSON.stringify(input)
      }
    })

    return updated
  })
}

export async function listCategories(venueId: string) {
  return db.resourceCategory.findMany({
    where: { venueId },
    include: { _count: { select: { resources: true } } },
    orderBy: { name: 'asc' }
  })
}

export async function createCategory(ctx: LocalContext, name: string, description?: string) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  return db.resourceCategory.create({
    data: {
      venueId: ctx.venueId,
      name: name.trim(),
      description
    }
  })
}

export async function createMaintenanceBlock(
  ctx: LocalContext,
  input: { resourceId: string; startTime: Date; endTime: Date; reason?: string }
) {
  if (!ctx.venueId || input.endTime <= input.startTime) throw new Error('VALIDATION_ERROR')
  const resource = await db.resource.findFirst({
    where: { id: input.resourceId, venueId: ctx.venueId }
  })
  if (!resource) throw new Error('NOT_FOUND')

  return db.maintenanceBlock.create({
    data: {
      venueId: ctx.venueId,
      resourceId: input.resourceId,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason
    }
  })
}

export async function bulkCreateResources(
  ctx: LocalContext,
  input: {
    categoryName: string
    namePrefix: string
    quantity: number
    hourlyRate: number
    description?: string
    imageUrl?: string | null
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  const prefix = input.namePrefix ? input.namePrefix.trim() : ''
  if (!prefix || prefix.length < 2) throw new Error('VALIDATION_ERROR')

  if (
    typeof input.quantity !== 'number' ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 50
  ) {
    throw new Error('INVALID_QUANTITY')
  }

  if (
    typeof input.hourlyRate !== 'number' ||
    isNaN(input.hourlyRate) ||
    input.hourlyRate < 0
  ) {
    throw new Error('INVALID_PRICING')
  }

  const categoryName = input.categoryName ? input.categoryName.trim() : 'General'

  // Generate resource names: e.g. "PS5 Lounge 01", "PS5 Lounge 02"
  const generatedNames: string[] = []
  for (let i = 1; i <= input.quantity; i++) {
    const padded = String(i).padStart(2, '0')
    generatedNames.push(`${prefix} ${padded}`)
  }

  // Check for duplicate names within this branch
  const existingWithSameName = await db.resource.findFirst({
    where: {
      venueId: ctx.venueId,
      name: { in: generatedNames }
    }
  })

  if (existingWithSameName) {
    throw new Error(`DUPLICATE_NAME: Resource '${existingWithSameName.name}' already exists in this branch`)
  }

  // Upsert Category
  const category = await db.resourceCategory.upsert({
    where: {
      venueId_name: {
        venueId: ctx.venueId,
        name: categoryName
      }
    },
    update: {},
    create: {
      venueId: ctx.venueId,
      name: categoryName,
      description: input.description
    }
  })

  return db.$transaction(async (tx) => {
    const createdResources = []

    for (const resName of generatedNames) {
      const res = await tx.resource.create({
        data: {
          venueId: ctx.venueId!,
          categoryId: category.id,
          name: resName,
          description: input.description,
          imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
          status: 'AVAILABLE'
        },
        include: { category: true }
      })

      const rule = await tx.pricingRule.create({
        data: {
          venueId: ctx.venueId!,
          resourceId: res.id,
          unit: 'HOUR',
          rate: input.hourlyRate,
          active: true
        }
      })

      createdResources.push({
        ...res,
        pricingRules: [rule]
      })
    }

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'BULK_CREATE',
        entity: 'RESOURCE',
        newValue: JSON.stringify({
          prefix,
          quantity: input.quantity,
          categoryName,
          hourlyRate: input.hourlyRate,
          createdNames: generatedNames
        })
      }
    })

    return createdResources
  })
}

