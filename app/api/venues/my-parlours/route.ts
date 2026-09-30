import { NextResponse } from 'next/server'
import { localContext } from '@/lib/auth/local'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const ctx = await localContext(req)
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let venues: Awaited<ReturnType<typeof db.venue.findMany>> = []
  if (ctx.role === 'SUPER_ADMIN') {
    venues = await db.venue.findMany({
      orderBy: { name: 'asc' }
    })
  } else if (ctx.role === 'OWNER') {
    venues = await db.venue.findMany({
      where: {
        OR: [{ ownerId: ctx.userId }, { id: ctx.venueId || undefined }]
      },
      orderBy: { name: 'asc' }
    })
  } else {
    // Non-owner only gets their own venue
    if (!ctx.venueId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const single = await db.venue.findUnique({ where: { id: ctx.venueId } })
    if (single) venues = [single]
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  let combinedRevenue = 0
  let combinedSessions = 0
  let combinedCustomers = 0
  let activeParlours = 0

  const detailedVenues = await Promise.all(
    venues.map(async (v) => {
      const [
        totalTx,
        todayTx,
        activeSessions,
        totalSessions,
        customersCount,
        resourcesCount
      ] = await Promise.all([
        db.transaction.aggregate({
          where: { venueId: v.id },
          _sum: { total: true }
        }),
        db.transaction.aggregate({
          where: { venueId: v.id, createdAt: { gte: startOfToday } },
          _sum: { total: true }
        }),
        db.session.count({
          where: { venueId: v.id, status: 'ACTIVE' }
        }),
        db.session.count({
          where: { venueId: v.id }
        }),
        db.customer.count({
          where: { venueId: v.id }
        }),
        db.resource.count({
          where: { venueId: v.id, status: { not: 'DISABLED' } }
        })
      ])

      const venueTotalRev = totalTx._sum.total || 0
      const venueTodayRev = todayTx._sum.total || 0

      combinedRevenue += venueTotalRev
      combinedSessions += totalSessions
      combinedCustomers += customersCount
      if (v.status === 'ACTIVE') activeParlours++

      const utilization =
        resourcesCount > 0 ? Math.round((activeSessions / resourcesCount) * 100) : 0

      return {
        id: v.id,
        name: v.name,
        shortName: v.shortName,
        city: v.city || 'Indore',
        address: v.address,
        phone: v.phone,
        status: v.status,
        currency: v.currency,
        openingTime: v.openingTime,
        closingTime: v.closingTime,
        primaryColor: v.primaryColor || '#10b981',
        coverImageUrl: v.coverImageUrl,
        dashboardHeroUrl: v.dashboardHeroUrl,
        todayRevenue: venueTodayRev,
        totalRevenue: venueTotalRev,
        activeSessions,
        totalSessions,
        totalCustomers: customersCount,
        resourcesCount,
        utilization
      }
    })
  )

  return NextResponse.json({
    venues: detailedVenues,
    summary: {
      totalRevenue: combinedRevenue,
      totalSessions: combinedSessions,
      totalCustomers: combinedCustomers,
      activeParlours
    }
  })
}
