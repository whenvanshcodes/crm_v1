import { redirect } from 'next/navigation'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import MyParloursClient from '@/components/MyParloursClient'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function MyParloursPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  // Non-owner / non-admin cannot access portfolio
  if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'OWNER') {
    redirect('/dashboard')
  }

  const [venues, business] = await Promise.all([
    ctx.role === 'SUPER_ADMIN'
      ? db.venue.findMany({ orderBy: { name: 'asc' }, include: { business: true } })
      : db.venue.findMany({
          where: {
            OR: [{ ownerId: ctx.userId }, { id: ctx.venueId || undefined }]
          },
          orderBy: { name: 'asc' },
          include: { business: true }
        }),
    db.business.findFirst({
      where: {
        OR: [
          { ownerId: ctx.userId },
          ...(ctx.venueId ? [{ venues: { some: { id: ctx.venueId } } }] : [])
        ]
      }
    })
  ])

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  let combinedRevenue = 0
  let combinedSessions = 0
  let combinedCustomers = 0
  let activeParlours = 0
  let totalActiveSessionsAcrossVenues = 0
  let totalResourcesAcrossVenues = 0

  const detailedVenues = await Promise.all(
    venues.map(async (v) => {
      const [
        totalPay,
        todayPay,
        activeSessions,
        totalSessions,
        customersCount,
        resourcesCount,
        partySizeAgg
      ] = await Promise.all([
        db.payment.aggregate({
          where: { venueId: v.id },
          _sum: { amount: true }
        }),
        db.payment.aggregate({
          where: { venueId: v.id, createdAt: { gte: startOfToday } },
          _sum: { amount: true }
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
        }),
        db.session.aggregate({
          where: { venueId: v.id },
          _avg: { partySize: true }
        })
      ])

      const venueTotalRev = totalPay._sum.amount || 0
      const venueTodayRev = todayPay._sum.amount || 0

      combinedRevenue += venueTotalRev
      combinedSessions += totalSessions
      combinedCustomers += customersCount
      totalActiveSessionsAcrossVenues += activeSessions
      totalResourcesAcrossVenues += resourcesCount
      if (v.status === 'ACTIVE') activeParlours++

      const utilization =
        resourcesCount > 0 ? Math.round((activeSessions / resourcesCount) * 100) : 0
      const averageGroupSize = partySizeAgg._avg.partySize
        ? Number(partySizeAgg._avg.partySize.toFixed(1))
        : 2.5
      const peakHours = '18:00 – 23:00'

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
        utilization,
        averageGroupSize,
        peakHours
      }
    })
  )

  const avgOccupancy = totalResourcesAcrossVenues > 0
    ? Math.round((totalActiveSessionsAcrossVenues / totalResourcesAcrossVenues) * 100)
    : 0

  const summary = {
    businessName: business?.name || 'Cue Club',
    totalRevenue: combinedRevenue,
    totalSessions: combinedSessions,
    totalCustomers: combinedCustomers,
    activeParlours,
    averageOccupancy: `${avgOccupancy}%`
  }

  return (
    <AppShell
      user={ctx}
      title="My Business"
      subtitle={`${summary.businessName} multi-branch portfolio: performance metrics and branch switcher.`}
    >
      <MyParloursClient
        venues={detailedVenues}
        summary={summary}
        currentVenueId={ctx.venueId}
      />
    </AppShell>
  )
}
