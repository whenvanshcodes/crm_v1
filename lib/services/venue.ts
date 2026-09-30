import { db } from '@/lib/db'
import { hash } from 'bcryptjs'
import type { LocalContext } from '@/lib/auth/local'

export async function getVenueSettings(venueId: string) {
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    include: {
      categories: true,
      _count: {
        select: {
          resources: true,
          customers: true,
          users: true,
          sessions: true
        }
      }
    }
  })
  if (!venue) throw new Error('NOT_FOUND')
  return venue
}

export async function updateVenueSettings(
  ctx: LocalContext,
  input: {
    name?: string
    shortName?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    currency?: string
    openingTime?: string
    closingTime?: string
    timezone?: string
    logoUrl?: string | null
    coverImageUrl?: string | null
    dashboardHeroUrl?: string | null
    galleryImages?: string | null
    primaryColor?: string
    secondaryColor?: string
    taxRate?: number
  },
  targetVenueId?: string
) {
  let venueId = ctx.venueId

  if (targetVenueId) {
    if (ctx.role === 'SUPER_ADMIN') {
      venueId = targetVenueId
    } else if (ctx.role === 'OWNER') {
      const allowed = await db.venue.findFirst({
        where: {
          id: targetVenueId,
          OR: [{ ownerId: ctx.userId }, { id: ctx.venueId || undefined }]
        }
      })
      if (!allowed) throw new Error('FORBIDDEN')
      venueId = targetVenueId
    }
  }

  if (!venueId) throw new Error('FORBIDDEN')
  if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  const existing = await db.venue.findUnique({ where: { id: venueId } })
  if (!existing) throw new Error('NOT_FOUND')

  const updated = await db.venue.update({
    where: { id: venueId },
    data: {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.shortName !== undefined ? { shortName: input.shortName ? input.shortName.trim() : null } : {}),
      ...(input.phone ? { phone: input.phone.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email ? input.email.trim() : null } : {}),
      ...(input.address !== undefined ? { address: input.address ? input.address.trim() : null } : {}),
      ...(input.city !== undefined ? { city: input.city ? input.city.trim() : 'Indore' } : {}),
      ...(input.currency ? { currency: input.currency.trim() } : {}),
      ...(input.openingTime ? { openingTime: input.openingTime.trim() } : {}),
      ...(input.closingTime ? { closingTime: input.closingTime.trim() } : {}),
      ...(input.timezone ? { timezone: input.timezone.trim() } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ? input.logoUrl.trim() : null } : {}),
      ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl ? input.coverImageUrl.trim() : null } : {}),
      ...(input.dashboardHeroUrl !== undefined ? { dashboardHeroUrl: input.dashboardHeroUrl ? input.dashboardHeroUrl.trim() : null } : {}),
      ...(input.galleryImages !== undefined ? { galleryImages: input.galleryImages ? input.galleryImages.trim() : null } : {}),
      ...(input.primaryColor ? { primaryColor: input.primaryColor.trim() } : {}),
      ...(input.secondaryColor ? { secondaryColor: input.secondaryColor.trim() } : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {})
    }
  })

  await db.auditLog.create({
    data: {
      venueId,
      actorId: ctx.userId,
      action: 'UPDATE',
      entity: 'VENUE',
      entityId: venueId,
      newValue: JSON.stringify(input)
    }
  })

  return updated
}

export async function createParlourForOwner(
  ctx: LocalContext,
  input: {
    name: string
    shortName?: string
    city?: string
    address?: string
    phone: string
    email?: string
    openingTime?: string
    closingTime?: string
    currency?: string
    primaryColor?: string
    coverImageUrl?: string
  }
) {
  if (!['SUPER_ADMIN', 'OWNER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  return db.$transaction(async (tx) => {
    // Look up owner's business
    let businessId: string | null = null
    if (ctx.userId) {
      const b = await tx.business.findFirst({ where: { ownerId: ctx.userId } })
      if (b) businessId = b.id
    }
    if (!businessId && ctx.venueId) {
      const currentV = await tx.venue.findUnique({ where: { id: ctx.venueId }, select: { businessId: true } })
      if (currentV?.businessId) businessId = currentV.businessId
    }

    const venue = await tx.venue.create({
      data: {
        name: input.name.trim(),
        shortName: input.shortName?.trim() || input.name.trim().split('—')[1]?.trim() || input.name.trim(),
        city: input.city?.trim() || 'Indore',
        address: input.address?.trim() || null,
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        openingTime: input.openingTime || '10:00',
        closingTime: input.closingTime || '02:00',
        currency: input.currency || 'INR',
        primaryColor: input.primaryColor || '#10b981',
        coverImageUrl: input.coverImageUrl || null,
        dashboardHeroUrl: input.coverImageUrl || null,
        status: 'ACTIVE',
        ownerId: ctx.userId,
        businessId: businessId || null
      }
    })

    await tx.auditLog.create({
      data: {
        venueId: venue.id,
        actorId: ctx.userId,
        action: 'CREATE',
        entity: 'VENUE',
        entityId: venue.id,
        newValue: JSON.stringify({ name: venue.name, ownerId: ctx.userId, businessId })
      }
    })

    return venue
  })
}

// Super Admin capabilities
export async function listAllVenues() {
  return db.venue.findMany({
    include: {
      business: true,
      owner: {
        select: { id: true, name: true, email: true, phone: true }
      },
      users: {
        where: { role: 'OWNER' },
        select: { id: true, name: true, email: true, phone: true }
      },
      _count: {
        select: {
          resources: true,
          customers: true,
          sessions: true,
          users: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createVenueWithOwner(
  ctx: LocalContext,
  input: {
    name: string
    phone: string
    email?: string
    openingTime?: string
    closingTime?: string
    currency?: string
    ownerName: string
    ownerEmail: string
    ownerPhone?: string
    ownerPassword?: string
  }
) {
  if (ctx.role !== 'SUPER_ADMIN') throw new Error('FORBIDDEN')

  const ownerEmail = input.ownerEmail.toLowerCase().trim()
  const existingUser = await db.user.findUnique({ where: { email: ownerEmail } })
  if (existingUser) throw new Error('CONFLICT')

  const passwordHash = await hash(input.ownerPassword || 'demo1234', 12)

  return db.$transaction(async (tx) => {
    const venue = await tx.venue.create({
      data: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim(),
        openingTime: input.openingTime || '10:00',
        closingTime: input.closingTime || '02:00',
        currency: input.currency || 'INR',
        status: 'ACTIVE'
      }
    })

    const owner = await tx.user.create({
      data: {
        venueId: venue.id,
        name: input.ownerName.trim(),
        email: ownerEmail,
        phone: input.ownerPhone?.trim(),
        role: 'OWNER',
        status: 'ACTIVE',
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        venueId: true
      }
    })

    // Seed default resource categories for this venue
    const snooker = await tx.resourceCategory.create({
      data: { venueId: venue.id, name: 'Snooker' }
    })
    const pool = await tx.resourceCategory.create({
      data: { venueId: venue.id, name: 'Pool' }
    })

    // Seed default resources
    const table1 = await tx.resource.create({
      data: {
        venueId: venue.id,
        name: 'Snooker Table 01',
        categoryId: snooker.id,
        status: 'AVAILABLE'
      }
    })
    await tx.pricingRule.create({
      data: {
        venueId: venue.id,
        resourceId: table1.id,
        unit: 'HOUR',
        rate: 400,
        active: true
      }
    })

    await tx.auditLog.create({
      data: {
        venueId: venue.id,
        actorId: ctx.userId,
        action: 'CREATE',
        entity: 'VENUE_WITH_OWNER',
        entityId: venue.id,
        newValue: JSON.stringify({ venue: venue.name, owner: owner.email })
      }
    })

    return { venue, owner }
  })
}

export async function setVenueStatus(ctx: LocalContext, id: string, status: 'ACTIVE' | 'INACTIVE') {
  if (ctx.role !== 'SUPER_ADMIN') throw new Error('FORBIDDEN')

  const updated = await db.venue.update({
    where: { id },
    data: { status }
  })

  await db.auditLog.create({
    data: {
      venueId: id,
      actorId: ctx.userId,
      action: 'UPDATE_STATUS',
      entity: 'VENUE',
      entityId: id,
      newValue: status
    }
  })

  return updated
}

export async function getPlatformStats() {
  const [venues, users, customers, sessions, paymentsSum] = await Promise.all([
    db.venue.count(),
    db.user.count(),
    db.customer.count(),
    db.session.count(),
    db.payment.aggregate({ _sum: { amount: true } })
  ])

  return {
    venues,
    users,
    customers,
    sessions,
    totalRevenue: paymentsSum._sum.amount ?? 0
  }
}

export async function getSuperAdminOverview(selectedVenueId?: string) {
  const isAll = !selectedVenueId || selectedVenueId === 'all'
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const venueWhere = isAll ? {} : { id: selectedVenueId }
  const opWhere = isAll ? {} : { venueId: selectedVenueId }

  const [
    allBranches,
    activeBusinessesCount,
    activeBranchesCount,
    customersToday,
    liveSessions,
    bookingsToday,
    revenueTodayAgg,
    totalResources,
    occupiedResources,
    availableResources,
    totalStaff
  ] = await Promise.all([
    db.venue.findMany({
      where: venueWhere,
      include: {
        business: true,
        resources: {
          include: { pricingRules: true }
        },
        customers: true,
        sessions: { where: { status: 'ACTIVE' } },
        bookings: { where: { startTime: { gte: startOfDay, lte: endOfDay } } },
        payments: { where: { createdAt: { gte: startOfDay, lte: endOfDay } } },
        addOns: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    isAll ? db.business.count() : 1,
    db.venue.count({ where: { ...venueWhere, status: 'ACTIVE' } }),
    db.customer.count({ where: { ...opWhere, createdAt: { gte: startOfDay, lte: endOfDay } } }),
    db.session.count({ where: { ...opWhere, status: 'ACTIVE' } }),
    db.booking.count({ where: { ...opWhere, startTime: { gte: startOfDay, lte: endOfDay } } }),
    db.payment.aggregate({
      where: { ...opWhere, createdAt: { gte: startOfDay, lte: endOfDay } },
      _sum: { amount: true }
    }),
    db.resource.count({ where: opWhere }),
    db.resource.count({ where: { ...opWhere, status: 'OCCUPIED' } }),
    db.resource.count({ where: { ...opWhere, status: 'AVAILABLE' } }),
    db.user.count({
      where: {
        ...(isAll ? {} : { venueId: selectedVenueId }),
        role: { in: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] }
      }
    })
  ])

  const branchActivity = allBranches.map((b) => {
    const totalRev = b.payments.reduce((acc, p) => acc + p.amount, 0)
    const occRate = b.resources.length > 0
      ? Math.round((b.sessions.length / b.resources.length) * 100)
      : 0

    return {
      id: b.id,
      name: b.name,
      businessName: b.business?.name || 'Independent',
      city: b.city || '—',
      customers: b.customers.length,
      liveSessions: b.sessions.length,
      bookings: b.bookings.length,
      revenue: totalRev,
      occupancy: `${occRate}%`,
      status: b.status
    }
  })

  const setupHealth = allBranches.map((b) => {
    const businessCreated = Boolean(b.businessId)
    const branchCreated = Boolean(b.id)
    const resourcesAdded = b.resources.length > 0
    const pricingRulesSet = b.resources.some((r) => r.pricingRules && r.pricingRules.length > 0)
    const addOnsConfigured = Boolean(b.addOns && b.addOns.length > 0)
    const brandingUploaded = Boolean(b.coverImageUrl || b.logoUrl || b.dashboardHeroUrl)
    // Images are strictly optional: 100% completion achievable without uploading anything
    const coreCount = [
      businessCreated,
      branchCreated,
      resourcesAdded,
      pricingRulesSet,
      addOnsConfigured
    ].filter(Boolean).length
    const completionPercentage = Math.round((coreCount / 5) * 100)

    return {
      branchId: b.id,
      branchName: b.name,
      businessName: b.business?.name || 'Independent',
      city: b.city || '—',
      businessCreated,
      branchCreated,
      resourcesAdded,
      pricingRulesSet,
      addOnsConfigured,
      brandingUploaded,
      completionPercentage
    }
  })

  return {
    isAll,
    selectedVenueId: isAll ? 'all' : selectedVenueId,
    activeBusinesses: activeBusinessesCount,
    activeBranches: activeBranchesCount,
    customersToday,
    liveSessions,
    bookingsToday,
    revenueToday: revenueTodayAgg._sum.amount ?? 0,
    totalResources,
    occupiedResources,
    availableResources,
    totalStaff,
    branchActivity,
    setupHealth
  }
}

export interface CreateParlourWizardInput {
  business: {
    name: string
    displayName?: string
    phone: string
    email?: string
    website?: string
  }
  owner: {
    name: string
    phone?: string
    email: string
    password?: string
  }
  branch: {
    name: string
    phone: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    timezone?: string
    openingTime?: string
    closingTime?: string
    primaryColor?: string
    secondaryColor?: string
    coverImageUrl?: string
    dashboardHeroUrl?: string
    logoUrl?: string
  }
  services?: string[]
  resources?: Array<{ name: string; categoryName: string; rate: number }>
  addOns?: Array<{ name: string; price: number; pricingType?: string; categoryName?: string; description?: string }>
}

export async function createParlourWithWizard(ctx: LocalContext, input: CreateParlourWizardInput) {
  if (ctx.role !== 'SUPER_ADMIN') throw new Error('FORBIDDEN')

  return db.$transaction(async (tx) => {
    const ownerEmail = input.owner.email.trim().toLowerCase()
    let owner = await tx.user.findUnique({ where: { email: ownerEmail } })
    const passwordHash = await hash(input.owner.password || 'TemporaryPass123!', 12)

    // 1. Create Business
    const business = await tx.business.create({
      data: {
        name: input.business.name.trim(),
        displayName: input.business.displayName?.trim() || input.business.name.trim(),
        phone: input.business.phone.trim(),
        email: input.business.email?.trim() || null,
        website: input.business.website?.trim() || null
      }
    })

    // 2. Create or link Owner
    if (!owner) {
      owner = await tx.user.create({
        data: {
          name: input.owner.name.trim(),
          email: ownerEmail,
          phone: input.owner.phone?.trim() || null,
          role: 'OWNER',
          passwordHash,
          status: 'ACTIVE'
        }
      })
    }

    await tx.business.update({
      where: { id: business.id },
      data: { ownerId: owner.id }
    })

    // 3. Create First Branch
    const branch = await tx.venue.create({
      data: {
        businessId: business.id,
        ownerId: owner.id,
        name: input.branch.name.trim(),
        shortName: input.branch.name.trim().split('—')[1]?.trim() || input.branch.name.trim(),
        phone: input.branch.phone.trim(),
        email: input.business.email?.trim() || null,
        address: input.branch.address?.trim() || null,
        city: input.branch.city?.trim() || 'Indore',
        state: input.branch.state?.trim() || null,
        pincode: input.branch.pincode?.trim() || null,
        timezone: input.branch.timezone || 'Asia/Kolkata',
        openingTime: input.branch.openingTime || '10:00',
        closingTime: input.branch.closingTime || '02:00',
        primaryColor: input.branch.primaryColor || '#10b981',
        secondaryColor: input.branch.secondaryColor || '#0f172a',
        coverImageUrl: input.branch.coverImageUrl || null,
        dashboardHeroUrl: input.branch.dashboardHeroUrl || null,
        logoUrl: input.branch.logoUrl || null,
        status: 'ACTIVE'
      }
    })

    if (!owner.venueId) {
      await tx.user.update({ where: { id: owner.id }, data: { venueId: branch.id } })
    }

    // 4. Categories & Services (Optional)
    const categoryMap = new Map<string, string>()
    if (input.services && input.services.length > 0) {
      for (const s of input.services) {
        const cat = await tx.resourceCategory.create({
          data: { venueId: branch.id, name: s.trim() }
        })
        categoryMap.set(s.trim().toLowerCase(), cat.id)
      }
    }

    // 5. Resources & Pricing Rules (Optional - owner configures them later)
    if (input.resources && input.resources.length > 0) {
      for (const r of input.resources) {
        let catId = categoryMap.get(r.categoryName.trim().toLowerCase())
        if (!catId) {
          const newCat = await tx.resourceCategory.create({
            data: { venueId: branch.id, name: r.categoryName.trim() }
          })
          catId = newCat.id
          categoryMap.set(r.categoryName.trim().toLowerCase(), catId)
        }

        const res = await tx.resource.create({
          data: {
            venueId: branch.id,
            categoryId: catId,
            name: r.name.trim(),
            status: 'AVAILABLE'
          }
        })

        await tx.pricingRule.create({
          data: {
            venueId: branch.id,
            resourceId: res.id,
            unit: 'HOUR',
            rate: r.rate,
            active: true
          }
        })
      }
    }

    // 6. Generic Add-ons (Optional)
    if (input.addOns && input.addOns.length > 0) {
      for (const addon of input.addOns) {
        await tx.addOn.create({
          data: {
            venueId: branch.id,
            name: addon.name.trim(),
            description: addon.description?.trim() || null,
            pricingType: addon.pricingType || 'PER_HOUR',
            price: addon.price,
            categoryName: addon.categoryName?.trim() || null,
            active: true
          }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        venueId: branch.id,
        actorId: ctx.userId,
        action: 'CREATE_PARLOUR_WIZARD',
        entity: 'BUSINESS',
        entityId: business.id,
        newValue: JSON.stringify({ business: business.name, branch: branch.name, owner: owner.email })
      }
    })

    return { business, branch, owner }
  })
}

export async function addBranchToBusiness(
  ctx: LocalContext,
  input: {
    businessId: string
    branch: {
      name: string
      phone: string
      address?: string
      city?: string
      state?: string
      pincode?: string
      timezone?: string
      openingTime?: string
      closingTime?: string
      primaryColor?: string
      secondaryColor?: string
      coverImageUrl?: string
      dashboardHeroUrl?: string
      logoUrl?: string
    }
    resources?: Array<{ name: string; categoryName: string; rate: number }>
    addOns?: Array<{ name: string; price: number; pricingType?: string; categoryName?: string; description?: string }>
  }
) {
  if (!['SUPER_ADMIN', 'OWNER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  const business = await db.business.findUnique({ where: { id: input.businessId } })
  if (!business) throw new Error('NOT_FOUND')

  if (ctx.role === 'OWNER' && business.ownerId !== ctx.userId) {
    throw new Error('FORBIDDEN')
  }

  return db.$transaction(async (tx) => {
    const branch = await tx.venue.create({
      data: {
        businessId: business.id,
        ownerId: business.ownerId,
        name: input.branch.name.trim(),
        shortName: input.branch.name.trim().split('—')[1]?.trim() || input.branch.name.trim(),
        phone: input.branch.phone.trim(),
        email: business.email,
        address: input.branch.address?.trim() || null,
        city: input.branch.city?.trim() || 'Indore',
        state: input.branch.state?.trim() || null,
        pincode: input.branch.pincode?.trim() || null,
        timezone: input.branch.timezone || 'Asia/Kolkata',
        openingTime: input.branch.openingTime || '10:00',
        closingTime: input.branch.closingTime || '02:00',
        primaryColor: input.branch.primaryColor || '#10b981',
        secondaryColor: input.branch.secondaryColor || '#0f172a',
        coverImageUrl: input.branch.coverImageUrl || null,
        dashboardHeroUrl: input.branch.dashboardHeroUrl || null,
        logoUrl: input.branch.logoUrl || null,
        status: 'ACTIVE'
      }
    })

    const categoryMap = new Map<string, string>()

    if (input.resources && input.resources.length > 0) {
      for (const r of input.resources) {
        let catId = categoryMap.get(r.categoryName.trim().toLowerCase())
        if (!catId) {
          const newCat = await tx.resourceCategory.create({
            data: { venueId: branch.id, name: r.categoryName.trim() }
          })
          catId = newCat.id
          categoryMap.set(r.categoryName.trim().toLowerCase(), catId)
        }

        const res = await tx.resource.create({
          data: {
            venueId: branch.id,
            categoryId: catId,
            name: r.name.trim(),
            status: 'AVAILABLE'
          }
        })

        await tx.pricingRule.create({
          data: {
            venueId: branch.id,
            resourceId: res.id,
            unit: 'HOUR',
            rate: r.rate,
            active: true
          }
        })
      }
    }

    if (input.addOns && input.addOns.length > 0) {
      for (const addon of input.addOns) {
        await tx.addOn.create({
          data: {
            venueId: branch.id,
            name: addon.name.trim(),
            description: addon.description?.trim() || null,
            pricingType: addon.pricingType || 'PER_HOUR',
            price: addon.price,
            categoryName: addon.categoryName?.trim() || null,
            active: true
          }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        venueId: branch.id,
        actorId: ctx.userId,
        action: 'ADD_BRANCH',
        entity: 'VENUE',
        entityId: branch.id,
        newValue: JSON.stringify({ businessId: business.id, branch: branch.name })
      }
    })

    return { branch }
  })
}
