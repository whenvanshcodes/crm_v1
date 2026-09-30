import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import CustomersClient from '@/components/CustomersClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!

  const customers = await db.customer.findMany({
    where: { venueId },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <AppShell
      user={ctx}
      title="Customers"
      subtitle="Phone-first customer database and loyalty spending records."
    >
      <CustomersClient
        customers={customers.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          lastVisitAt: c.lastVisitAt ? c.lastVisitAt.toISOString() : null
        }))}
      />
    </AppShell>
  )
}
