import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import ResourcesClient from '@/components/ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!

  const [resources, categories, addOns] = await Promise.all([
    db.resource.findMany({
      where: { venueId },
      include: {
        category: true,
        pricingRules: { where: { active: true } },
        sessions: {
          where: { status: 'ACTIVE' },
          include: { customer: true }
        }
      },
      orderBy: { name: 'asc' }
    }),
    db.resourceCategory.findMany({
      where: { venueId },
      orderBy: { name: 'asc' }
    }),
    db.addOn.findMany({
      where: { venueId, active: true },
      orderBy: { createdAt: 'desc' }
    })
  ])

  return (
    <AppShell
      user={ctx}
      title="Resources & Stations"
      subtitle="Snooker & pool tables, PS5s, gaming PCs, hourly pricing, and live status."
    >
      <ResourcesClient
        resources={resources.map((r) => ({
          ...r,
          sessions: r.sessions.map((s) => ({
            ...s,
            startedAt: s.startedAt.toISOString()
          }))
        }))}
        categories={categories}
        initialAddOns={addOns.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          pricingType: a.pricingType,
          price: a.price,
          active: a.active,
          categoryName: a.categoryName
        }))}
      />
    </AppShell>
  )
}
