import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import { getVenueSettings } from '@/lib/services/venue'
import AppShell from '@/components/AppShell'
import SettingsClient from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
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
        title="Parlour Settings"
        subtitle="Configure parlour profile, overnight operating hours, branding, and operations."
      >
        <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
          No parlour branch found. Please create or configure a branch first.
        </div>
      </AppShell>
    )
  }

  let venue = null
  try {
    venue = await getVenueSettings(venueId)
  } catch {
    const firstVenue = await db.venue.findFirst({ orderBy: { createdAt: 'asc' } })
    if (firstVenue) {
      venue = await getVenueSettings(firstVenue.id).catch(() => null)
    }
  }

  return (
    <AppShell
      user={ctx}
      title="Parlour Settings"
      subtitle="Configure parlour profile, overnight operating hours, branding, and operations."
    >
      <SettingsClient venue={venue as any} />
    </AppShell>
  )
}
