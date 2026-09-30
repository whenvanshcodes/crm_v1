import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import CalendarClient from '@/components/CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!

  const [resources, activeSessions, bookings, customers] = await Promise.all([
    db.resource.findMany({
      where: { venueId },
      include: { pricingRules: { where: { active: true } } },
      orderBy: { name: 'asc' }
    }),
    db.session.findMany({
      where: { venueId, status: 'ACTIVE' },
      include: { customer: true, resource: true }
    }),
    db.booking.findMany({
      where: {
        venueId,
        status: { in: ['CONFIRMED', 'SCHEDULED'] }
      },
      include: { customer: true, resource: true },
      orderBy: { startTime: 'asc' }
    }),
    db.customer.findMany({
      where: { venueId },
      orderBy: { name: 'asc' },
      take: 50
    })
  ])

  const formattedResources = resources.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    rate: r.pricingRules[0]?.rate ?? 400
  }))

  const formattedSessions = activeSessions.map((s) => ({
    id: s.id,
    resourceName: s.resource.name,
    customerName: s.customer.name,
    startedAt: s.startedAt.toISOString(),
    expectedEndAt: s.expectedEndAt?.toISOString()
  }))

  const formattedBookings = bookings.map((b) => ({
    id: b.id,
    resourceId: b.resourceId,
    resourceName: b.resource.name,
    customerName: b.customer.name,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    status: b.status
  }))

  return (
    <AppShell
      user={ctx}
      title="Floor Schedule"
      subtitle="Visual timeline of active sessions, confirmed bookings, and maintenance."
    >
      <CalendarClient
        resources={formattedResources}
        activeSessions={formattedSessions}
        bookings={formattedBookings}
        customers={customers}
      />
    </AppShell>
  )
}
