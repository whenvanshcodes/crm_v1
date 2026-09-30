import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  // If super admin has no active venue selected, send to super-admin dashboard
  if (ctx.role === 'SUPER_ADMIN' && !ctx.venueId) {
    redirect('/super-admin')
  }

  const venueId = ctx.venueId!
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const startOf7Days = new Date(now)
  startOf7Days.setDate(startOf7Days.getDate() - 6)
  startOf7Days.setHours(0, 0, 0, 0)

  // Fetch real operational SQLite data
  const [
    venue,
    todayRevenueAgg,
    activeSessions,
    todaySessions,
    totalResources,
    availableResources,
    upcomingBookings,
    allResources,
    venueAddOns,
    topCustomersList
  ] = await Promise.all([
    db.venue.findUnique({ where: { id: venueId } }),
    db.payment.aggregate({
      where: { venueId, createdAt: { gte: startOfToday } },
      _sum: { amount: true }
    }),
    db.session.findMany({
      where: { venueId, status: 'ACTIVE' },
      include: {
        customer: true,
        resource: true,
        pricingRule: true,
        addOns: { include: { addOn: true } }
      },
      orderBy: { startedAt: 'desc' }
    }),
    db.session.findMany({
      where: { venueId, startedAt: { gte: startOfToday } },
      select: { id: true, customerId: true }
    }),
    db.resource.count({ where: { venueId } }),
    db.resource.count({ where: { venueId, status: 'AVAILABLE' } }),
    db.booking.findMany({
      where: {
        venueId,
        startTime: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] }
      },
      include: {
        customer: true,
        resource: true
      },
      orderBy: { startTime: 'asc' },
      take: 8
    }),
    db.resource.findMany({
      where: { venueId },
      include: {
        category: true,
        pricingRules: { where: { active: true } },
        sessions: {
          where: { status: 'ACTIVE' },
          include: { customer: true }
        },
        bookings: {
          where: {
            startTime: { gte: startOfToday, lte: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
            status: { in: ['CONFIRMED', 'SCHEDULED', 'ARRIVED'] }
          },
          include: { customer: true },
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    }),
    db.addOn.findMany({
      where: { venueId, active: true },
      select: { id: true, name: true, price: true, pricingType: true, categoryName: true }
    }),
    db.customer.findMany({
      where: { venueId },
      select: { id: true, name: true, phone: true, totalVisits: true },
      orderBy: { totalVisits: 'desc' },
      take: 50
    })
  ])

  const todayCustomersCount = new Set(todaySessions.map((s) => s.customerId)).size

  const nowMs = now.getTime()
  const in15mMs = nowMs + 15 * 60 * 1000
  const in30mMs = nowMs + 30 * 60 * 1000

  const attentionAlerts = {
    overtime: activeSessions
      .filter((s) => s.expectedEndAt && new Date(s.expectedEndAt).getTime() < nowMs)
      .map((s) => ({
        id: s.id,
        resourceName: s.resource.name,
        customerName: s.customer.name,
        overtimeMinutes: Math.floor((nowMs - new Date(s.expectedEndAt!).getTime()) / 60000)
      })),
    endingSoon: activeSessions
      .filter((s) => {
        if (!s.expectedEndAt) return false
        const endMs = new Date(s.expectedEndAt).getTime()
        return endMs >= nowMs && endMs <= in15mMs
      })
      .map((s) => ({
        id: s.id,
        resourceName: s.resource.name,
        customerName: s.customer.name,
        minutesLeft: Math.max(1, Math.floor((new Date(s.expectedEndAt!).getTime() - nowMs) / 60000))
      })),
    startingSoon: upcomingBookings
      .filter((b) => {
        const startMs = new Date(b.startTime).getTime()
        return startMs >= nowMs && startMs <= in30mMs
      })
      .map((b) => ({
        id: b.id,
        resourceName: b.resource.name,
        customerName: b.customer.name,
        minutesUntilStart: Math.max(1, Math.floor((new Date(b.startTime).getTime() - nowMs) / 60000))
      })),
    maintenance: allResources
      .filter((r) => r.status === 'MAINTENANCE' || r.status === 'DISABLED')
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status
      }))
  }

  const venueInfo = {
    name: venue?.name || 'Parlour',
    shortName: venue?.shortName,
    city: venue?.city || 'Indore',
    coverImageUrl: venue?.coverImageUrl,
    dashboardHeroUrl: venue?.dashboardHeroUrl,
    openingTime: venue?.openingTime || '10:00',
    closingTime: venue?.closingTime || '02:00',
    primaryColor: venue?.primaryColor || '#6d5ce8'
  }

  return (
    <AppShell
      user={ctx}
      title="Dashboard"
      subtitle={`Live operational overview for ${venueInfo.name}`}
    >
      <DashboardClient
        venueInfo={venueInfo}
        userName={ctx.name}
        metrics={{
          todayRevenue: todayRevenueAgg._sum.amount ?? 0,
          activeSessionsCount: activeSessions.length,
          todaySessionsCount: todaySessions.length,
          todayCustomersCount,
          availableResourcesCount: availableResources,
          totalResourcesCount: totalResources,
          upcomingBookingsCount: upcomingBookings.length
        }}
        activeSessions={activeSessions.map((s) => ({
          ...s,
          startedAt: s.startedAt.toISOString(),
          expectedEndAt: s.expectedEndAt ? s.expectedEndAt.toISOString() : null
        }))}
        resources={allResources.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          category: r.category,
          pricingRules: r.pricingRules
        }))}
        upcomingBookings={upcomingBookings.map((b) => ({
          id: b.id,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
          status: b.status,
          customer: b.customer,
          resource: b.resource
        }))}
        attentionAlerts={attentionAlerts}
        addOns={venueAddOns}
        initialCustomers={topCustomersList}
      />
    </AppShell>
  )
}
