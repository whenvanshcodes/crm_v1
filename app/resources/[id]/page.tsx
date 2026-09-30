import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAppContext } from '@/lib/auth/context'
import { getResource } from '@/lib/services/resource'
import AppShell from '@/components/AppShell'
import ResourceDetailClient from '@/components/ResourceDetailClient'

export const dynamic = 'force-dynamic'

export default async function ResourceDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  let resource
  try {
    resource = await getResource(ctx.venueId!, id)
  } catch {
    notFound()
  }

  return (
    <AppShell
      user={ctx}
      title={`Resource · ${resource.name}`}
      subtitle={`Manage rates, availability and schedule for ${resource.name}.`}
      headerAction={
        <Link href="/resources" className="secondary">
          ← Back to Resources
        </Link>
      }
    >
      <ResourceDetailClient
        resource={{
          ...resource,
          bookings: resource.bookings.map((b) => ({
            ...b,
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString()
          })),
          sessions: resource.sessions.map((s) => ({
            ...s,
            startedAt: s.startedAt.toISOString(),
            endedAt: s.endedAt ? s.endedAt.toISOString() : null
          })),
          maintenanceBlocks: resource.maintenanceBlocks.map((m) => ({
            ...m,
            startTime: m.startTime.toISOString(),
            endTime: m.endTime.toISOString()
          }))
        }}
      />
    </AppShell>
  )
}
