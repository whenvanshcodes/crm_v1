import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAppContext } from '@/lib/auth/context'
import AppShell from '@/components/AppShell'
import PaymentsClient from '@/components/PaymentsClient'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const venueId = ctx.venueId!
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [payments, todayAgg, unpaidTransactions] = await Promise.all([
    db.payment.findMany({
      where: { venueId },
      include: {
        transaction: {
          include: {
            session: {
              include: { customer: true, resource: true }
            }
          }
        },
        recordedBy: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    db.payment.aggregate({
      where: { venueId, createdAt: { gte: startOfToday } },
      _sum: { amount: true }
    }),
    db.transaction.findMany({
      where: { venueId },
      include: {
        payments: true,
        session: {
          include: { customer: true, resource: true }
        }
      }
    })
  ])

  // Filter transactions that have unpaid balance
  const pendingTransactions = unpaidTransactions
    .map((tx) => {
      const paid = tx.payments.reduce((s, p) => s + p.amount, 0)
      return {
        id: tx.id,
        total: tx.total,
        paid,
        customerName: tx.session.customer.name,
        resourceName: tx.session.resource.name
      }
    })
    .filter((tx) => tx.total > tx.paid + 0.01)

  return (
    <AppShell
      user={ctx}
      title="Payments & Billing"
      subtitle="Track cash, UPI, card transactions and outstanding balances."
    >
      <PaymentsClient
        payments={payments.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString()
        }))}
        unpaidTransactions={pendingTransactions}
        todayTotal={todayAgg._sum.amount ?? 0}
      />
    </AppShell>
  )
}
