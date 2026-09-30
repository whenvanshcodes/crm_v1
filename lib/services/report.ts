import { db } from '@/lib/db'

export async function getVenueReportsByDays(venueId: string, days: number) {
  return getVenueReportsImpl(venueId, days)
}

export async function getVenueReports(venueId: string) {
  return getVenueReportsImpl(venueId, 7)
}

async function getVenueReportsImpl(venueId: string, days: number) {
  if (!venueId) {
    throw new Error('VALIDATION_ERROR: venueId is required')
  }
  const now = new Date()

  // Start of today
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  // Dynamic range based on days param
  const startOfRange = new Date(now)
  startOfRange.setDate(startOfRange.getDate() - (days - 1))
  startOfRange.setHours(0, 0, 0, 0)

  // Start of 7 days ago (fixed for weekly metric)
  const startOf7Days = new Date(now)
  startOf7Days.setDate(startOf7Days.getDate() - 6)
  startOf7Days.setHours(0, 0, 0, 0)

  // Start of 30 days ago (fixed for monthly metric)
  const startOf30Days = new Date(now)
  startOf30Days.setDate(startOf30Days.getDate() - 29)
  startOf30Days.setHours(0, 0, 0, 0)

  const [
    todayPayments,
    weeklyPayments,
    monthlyPayments,
    totalSessions,
    activeSessions,
    completedSessions,
    totalCustomers,
    resources,
    paymentMethods,
    topCustomers,
    allPayments,
    completedSessionsList,
    noShowsCount,
    cancellationsCount,
    categoryRevenueSessions
  ] = await Promise.all([
    // Today revenue
    db.payment.aggregate({
      where: { venueId, createdAt: { gte: startOfToday } },
      _sum: { amount: true }
    }),
    // 7 days revenue
    db.payment.aggregate({
      where: { venueId, createdAt: { gte: startOf7Days } },
      _sum: { amount: true }
    }),
    // 30 days revenue
    db.payment.aggregate({
      where: { venueId, createdAt: { gte: startOf30Days } },
      _sum: { amount: true }
    }),
    // Sessions
    db.session.count({ where: { venueId } }),
    db.session.count({ where: { venueId, status: 'ACTIVE' } }),
    db.session.count({ where: { venueId, status: 'COMPLETED' } }),
    // Customers
    db.customer.count({ where: { venueId } }),
    // Resources with session counts
    db.resource.findMany({
      where: { venueId },
      include: {
        _count: { select: { sessions: true } }
      }
    }),
    // Payment breakdown (all time)
    db.payment.groupBy({
      by: ['method'],
      where: { venueId },
      _sum: { amount: true },
      _count: { id: true }
    }),
    // Top customers
    db.customer.findMany({
      where: { venueId },
      orderBy: { totalSpending: 'desc' },
      take: 5
    }),
    // Payments in dynamic range for trend chart
    db.payment.findMany({
      where: { venueId, createdAt: { gte: startOfRange } },
      select: { amount: true, createdAt: true }
    }),
    // Completed sessions in dynamic range for duration & party analytics
    db.session.findMany({
      where: { venueId, status: 'COMPLETED', endedAt: { gte: startOfRange } },
      select: {
        startedAt: true,
        endedAt: true,
        partySize: true,
        plannedDurationMinutes: true,
        actualDurationMinutes: true,
        completionStatus: true
      }
    }),
    db.booking.count({ where: { venueId, status: 'NO_SHOW' } }),
    db.booking.count({ where: { venueId, status: 'CANCELLED' } }),
    // Category revenue: completed sessions in range with resource.category
    db.session.findMany({
      where: { venueId, status: 'COMPLETED', endedAt: { gte: startOfRange } },
      select: {
        finalAmount: true,
        resource: { select: { category: { select: { name: true } } } }
      }
    })
  ])

  // Calculate revenue trend daily buckets using dynamic range
  const daysMap: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfRange)
    d.setDate(d.getDate() + i)
    const key = days <= 7
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : days <= 31
      ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (!(key in daysMap)) daysMap[key] = 0
  }

  for (const p of allPayments) {
    const d = new Date(p.createdAt)
    const key = days <= 7
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : days <= 31
      ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (key in daysMap) daysMap[key] += p.amount
  }

  const dailyTrend = Object.entries(daysMap).map(([day, value]) => ({ day, value }))

  // Utilization calculation
  const totalResourcesCount = resources.length
  const occupiedCount = resources.filter((r) => r.status === 'OCCUPIED').length
  const utilizationPercentage =
    totalResourcesCount > 0 ? Math.round((occupiedCount / totalResourcesCount) * 100) : 0

  // Popular resources sorted by session count
  const popularResources = resources
    .map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      sessionCount: r._count.sessions
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  // Payment method breakdown formatted
  const paymentBreakdown = ['CASH', 'UPI', 'CARD', 'OTHER'].map((method) => {
    const record = paymentMethods.find((pm) => pm.method === method)
    return {
      method,
      amount: record?._sum.amount ?? 0,
      count: record?._count.id ?? 0
    }
  })

  // Advanced Session & Duration Analytics
  const totalBookedMinutes = completedSessionsList.reduce(
    (acc, s) => acc + (s.plannedDurationMinutes || 0),
    0
  )
  const totalActualMinutes = completedSessionsList.reduce(
    (acc, s) => acc + (s.actualDurationMinutes || 0),
    0
  )
  const bookedHours = Math.round((totalBookedMinutes / 60) * 10) / 10
  const actualHours = Math.round((totalActualMinutes / 60) * 10) / 10

  const averageSessionDuration =
    completedSessionsList.length > 0
      ? Math.round(totalActualMinutes / completedSessionsList.length)
      : 0
  const averageBookedDuration =
    completedSessionsList.length > 0
      ? Math.round(totalBookedMinutes / completedSessionsList.length)
      : 0
  const averageGroupSize =
    completedSessionsList.length > 0
      ? Math.round(
          (completedSessionsList.reduce((acc, s) => acc + (s.partySize || 1), 0) /
            completedSessionsList.length) *
            10
        ) / 10
      : 0

  const earlyEndSessions = completedSessionsList.filter(
    (s) => s.completionStatus === 'ENDED_EARLY'
  ).length
  const extendedSessions = completedSessionsList.filter(
    (s) => s.completionStatus === 'EXTENDED'
  ).length
  const ranOverSessions = completedSessionsList.filter(
    (s) => s.completionStatus === 'RAN_OVER'
  ).length

  // Peak Hours calculation
  const hourBuckets = new Array(24).fill(0)
  for (const s of completedSessionsList) {
    const hour = new Date(s.startedAt).getHours()
    hourBuckets[hour]++
  }
  let maxHour = -1
  let maxHourCount = 0
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > maxHourCount) {
      maxHourCount = hourBuckets[h]
      maxHour = h
    }
  }
  const peakHours =
    maxHour >= 0 && maxHourCount > 0
      ? `${(maxHour % 12 || 12)}:00 ${maxHour >= 12 ? 'PM' : 'AM'} – ${((maxHour + 2) % 12 || 12)}:00 ${maxHour + 2 >= 12 ? 'PM' : 'AM'}`
      : 'No session data'

  // Category revenue breakdown
  const categoryRevenueMap: Record<string, number> = {}
  for (const s of categoryRevenueSessions) {
    const catName = s.resource?.category?.name || 'Uncategorized'
    categoryRevenueMap[catName] = (categoryRevenueMap[catName] || 0) + (s.finalAmount || 0)
  }
  const categoryRevenue = Object.entries(categoryRevenueMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    todayRevenue: todayPayments._sum.amount ?? 0,
    weeklyRevenue: weeklyPayments._sum.amount ?? 0,
    monthlyRevenue: monthlyPayments._sum.amount ?? 0,
    totalSessions,
    activeSessions,
    completedSessions,
    totalCustomers,
    totalResources: totalResourcesCount,
    occupiedResources: occupiedCount,
    utilizationPercentage,
    popularResources,
    topCustomers: topCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      visits: c.totalVisits,
      spending: c.totalSpending
    })),
    paymentBreakdown,
    dailyTrend,
    averageSessionDuration,
    averageBookedDuration,
    averageGroupSize,
    earlyEndSessions,
    extendedSessions,
    ranOverSessions,
    bookedHours,
    actualHours,
    peakHours,
    noShows: noShowsCount,
    cancellations: cancellationsCount,
    categoryRevenue,
    rangeDays: days
  }
}

