import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAppContext } from '@/lib/auth/context'
import { getSession } from '@/lib/services/session'
import AppShell from '@/components/AppShell'
import SessionDetailClient from '@/components/SessionDetailClient'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({
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
  let session
  try {
    session = await getSession(ctx.venueId!, id)
  } catch {
    notFound()
  }

  return (
    <AppShell
      user={ctx}
      title={`Session · ${session.resource.name}`}
      subtitle={`Customer: ${session.customer.name} (${session.customer.phone})`}
      headerAction={
        <Link href="/sessions" className="secondary">
          ← Back to Sessions
        </Link>
      }
    >
      <SessionDetailClient
        session={{
          ...session,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt ? session.endedAt.toISOString() : null,
          expectedEndAt: session.expectedEndAt ? session.expectedEndAt.toISOString() : null,
          transaction: session.transaction
            ? {
                ...session.transaction,
                payments: session.transaction.payments.map((p) => ({
                  ...p,
                  createdAt: p.createdAt.toISOString()
                }))
              }
            : null
        }}
      />
    </AppShell>
  )
}
