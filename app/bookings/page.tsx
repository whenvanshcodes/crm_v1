import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import BookingsClient from '@/components/BookingsClient'

export const dynamic = 'force-dynamic'

export default async function BookingsAndSessionsPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!

  const [bookings, activeSessions, completedSessions, resources, customers, addOns, waitlistEntries] = await Promise.all([
    db.booking.findMany({
      where: { venueId },
      include: {
        customer: true,
        resource: { include: { category: true } },
        addOns: { include: { addOn: true } }
      },
      orderBy: { startTime: 'desc' }
    }),
    db.session.findMany({
      where: { venueId, status: 'ACTIVE' },
      include: {
        customer: true,
        resource: { include: { category: true } },
        pricingRule: true,
        addOns: { include: { addOn: true } }
      },
      orderBy: { startedAt: 'desc' }
    }),
    db.session.findMany({
      where: { venueId, status: 'COMPLETED' },
      include: {
        customer: true,
        resource: { include: { category: true } },
        pricingRule: true,
        transaction: {
          include: { payments: true }
        },
        addOns: { include: { addOn: true } }
      },
      orderBy: { endedAt: 'desc' },
      take: 30
    }),
    db.resource.findMany({
      where: { venueId, status: { not: 'DISABLED' } },
      include: {
        category: true,
        pricingRules: { where: { active: true } },
        bookings: {
          where: {
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
            endTime: { gt: new Date() }
          },
          orderBy: { startTime: 'asc' },
          take: 1
        },
        sessions: {
          where: { status: 'ACTIVE' },
          take: 1
        }
      },
      orderBy: { name: 'asc' }
    }),
    db.customer.findMany({
      where: { venueId },
      orderBy: { name: 'asc' },
      take: 100
    }),
    db.addOn.findMany({
      where: { venueId, active: true },
      orderBy: { name: 'asc' }
    }),
    db.waitlistEntry.findMany({
      where: { venueId, status: { in: ['WAITING', 'SKIPPED'] } },
      include: { customer: true },
      orderBy: { createdAt: 'asc' }
    })
  ])

  return (
    <AppShell
      user={ctx}
      title="Bookings & Sessions"
      subtitle="Unified operational hub: manage live timers, walk-ins, reservations, and checkout."
    >
      <BookingsClient
        initialBookings={bookings.map((b) => ({
          ...b,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
          partySize: b.partySize || 1,
          groupMembers: b.groupMembers || null,
          addOns: b.addOns.map((ba) => ({
            id: ba.id,
            name: ba.addOn.name,
            price: ba.unitPrice,
            pricingType: ba.pricingType,
            quantity: ba.quantity
          }))
        }))}
        initialActiveSessions={activeSessions.map((s) => ({
          ...s,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt ? s.endedAt.toISOString() : null,
          expectedEndAt: s.expectedEndAt ? s.expectedEndAt.toISOString() : null,
          plannedStartAt: s.plannedStartAt ? s.plannedStartAt.toISOString() : null,
          plannedEndAt: s.plannedEndAt ? s.plannedEndAt.toISOString() : null,
          partySize: s.partySize || 1,
          groupMembers: s.groupMembers || null,
          bookedAmount: s.bookedAmount ?? null,
          addOns: s.addOns.map((sa) => ({
            id: sa.id,
            name: sa.addOn.name,
            price: sa.unitPrice,
            pricingType: sa.pricingType,
            quantity: sa.quantity
          }))
        }))}
        initialCompletedSessions={completedSessions.map((s) => ({
          ...s,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt ? s.endedAt.toISOString() : null,
          expectedEndAt: s.expectedEndAt ? s.expectedEndAt.toISOString() : null,
          plannedStartAt: s.plannedStartAt ? s.plannedStartAt.toISOString() : null,
          plannedEndAt: s.plannedEndAt ? s.plannedEndAt.toISOString() : null,
          partySize: s.partySize || 1,
          groupMembers: s.groupMembers || null,
          bookedAmount: s.bookedAmount ?? null,
          actualAmount: s.actualAmount ?? null,
          completionStatus: s.completionStatus || 'COMPLETED',
          addOns: s.addOns.map((sa) => ({
            id: sa.id,
            name: sa.addOn.name,
            price: sa.unitPrice,
            pricingType: sa.pricingType,
            quantity: sa.quantity
          }))
        }))}
        resources={resources.map((r) => {
          const isLive = r.sessions.length > 0
          const nextBooking = r.bookings[0] || null
          return {
            id: r.id,
            name: r.name,
            categoryName: r.category?.name || 'General',
            status: isLive ? 'LIVE' : r.status,
            rate: r.pricingRules[0]?.rate || 120,
            nextBookingAt: nextBooking ? nextBooking.startTime.toISOString() : null,
            nextBookingCustomer: nextBooking ? (nextBooking as any).customer?.name : null
          }
        })}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          totalVisits: c.totalVisits,
          totalSpending: c.totalSpending
        }))}
        initialAddOns={addOns.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description || undefined,
          pricingType: a.pricingType,
          price: a.price,
          categoryName: a.categoryName || undefined
        }))}
        initialWaitlist={waitlistEntries.map((w) => ({
          id: w.id,
          venueId: w.venueId,
          customerId: w.customerId,
          partySize: w.partySize,
          categoryName: w.categoryName || null,
          preferredTime: w.preferredTime || null,
          notes: w.notes || null,
          status: w.status,
          createdAt: w.createdAt.toISOString(),
          customer: {
            id: w.customer.id,
            name: w.customer.name,
            phone: w.customer.phone
          }
        }))}
      />
    </AppShell>
  )
}
