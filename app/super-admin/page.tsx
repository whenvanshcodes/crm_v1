import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import { getSuperAdminOverview } from '@/lib/services/venue'
import AppShell from '@/components/AppShell'
import SuperAdminDashboardClient from '@/components/SuperAdminDashboardClient'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  if (ctx.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  const [overview, venues] = await Promise.all([
    getSuperAdminOverview('all'),
    db.venue.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ])

  return (
    <AppShell
      user={ctx}
      title="Platform Overview"
      subtitle="Super Admin global monitoring, branch performance and platform management."
    >
      <SuperAdminDashboardClient
        initialOverview={overview}
        venuesList={venues}
      />
    </AppShell>
  )
}
