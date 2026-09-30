import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import { getVenueReports } from '@/lib/services/report'
import AppShell from '@/components/AppShell'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  let venueId = ctx.venueId
  if (!venueId) {
    const firstVenue = await db.venue.findFirst({
      where: ctx.role === 'OWNER' ? { ownerId: ctx.userId } : {},
      orderBy: { createdAt: 'asc' }
    })
    venueId = firstVenue?.id || null
  }

  if (!venueId) {
    return (
      <AppShell
        user={ctx}
        title="Analytics & Reports"
        subtitle="Comprehensive revenue, utilization and customer metrics."
      >
        <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
          No parlour branch found. Please create or configure a branch first.
        </div>
      </AppShell>
    )
  }

  let reports
  try {
    reports = await getVenueReports(venueId)
  } catch (err) {
    console.error('Failed to load venue reports:', err)
    reports = null
  }

  return (
    <AppShell
      user={ctx}
      title="Analytics & Reports"
      subtitle="Comprehensive revenue, utilization and customer metrics from SQLite."
    >
      <ReportsClient reports={reports as any} />
    </AppShell>
  )
}
