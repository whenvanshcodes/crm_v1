import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppContext } from '@/lib/auth/context'
import { listAllVenues } from '@/lib/services/venue'
import AppShell from '@/components/AppShell'
import SuperAdminVenuesClient from '@/components/SuperAdminVenuesClient'

export const dynamic = 'force-dynamic'

export default async function SuperAdminVenuesPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  if (ctx.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  const venues = await listAllVenues()

  return (
    <AppShell
      user={ctx}
      title="Manage Parlours"
      subtitle="View, activate, configure branding, and register multi-tenant parlours."
      headerAction={
        <Link href="/super-admin" className="secondary">
          ← Back to Admin
        </Link>
      }
    >
      <SuperAdminVenuesClient
        venues={venues.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString()
        }))}
      />
    </AppShell>
  )
}
