import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAppContext } from '@/lib/auth/context'
import { getCustomer } from '@/lib/services/customer'
import AppShell from '@/components/AppShell'
import CustomerDetailClient from '@/components/CustomerDetailClient'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({
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
  let customer
  try {
    customer = await getCustomer(ctx.venueId!, id)
  } catch {
    notFound()
  }

  return (
    <AppShell
      user={ctx}
      title={customer.name}
      subtitle={`Customer Phone: ${customer.phone}`}
      headerAction={
        <Link href="/customers" className="secondary">
          ← Back to Customers
        </Link>
      }
    >
      <CustomerDetailClient
        customer={{
          ...customer,
          createdAt: customer.createdAt.toISOString(),
          lastVisitAt: customer.lastVisitAt ? customer.lastVisitAt.toISOString() : null,
          bookings: customer.bookings.map((b) => ({
            ...b,
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString()
          })),
          sessions: customer.sessions.map((s) => ({
            ...s,
            startedAt: s.startedAt.toISOString(),
            endedAt: s.endedAt ? s.endedAt.toISOString() : null,
            resource: {
              ...s.resource,
              category: s.resource.category
                ? { name: s.resource.category.name }
                : null
            },
            transaction: s.transaction
              ? {
                  ...s.transaction,
                  payments: s.transaction.payments.map((p) => ({
                    ...p,
                    createdAt: p.createdAt.toISOString()
                  }))
                }
              : null
          }))
        }}
      />
    </AppShell>
  )
}
