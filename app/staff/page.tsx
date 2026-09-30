import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import StaffClient from '@/components/StaffClient'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!

  const staff = await db.user.findMany({
    where: { venueId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  })

  return (
    <AppShell
      user={ctx}
      title="Staff & Access"
      subtitle="Team member permissions, roles and operational access."
    >
      <StaffClient
        staff={staff.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString()
        }))}
        currentRole={ctx.role}
      />
    </AppShell>
  )
}
