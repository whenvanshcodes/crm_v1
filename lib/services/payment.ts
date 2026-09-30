import { db } from '@/lib/db'
import type { LocalContext } from '@/lib/auth/local'

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER'

export async function listPayments(
  venueId: string,
  filters?: { method?: PaymentMethod; from?: Date; to?: Date }
) {
  return db.payment.findMany({
    where: {
      venueId,
      ...(filters?.method ? { method: filters.method } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters?.from ? { gte: filters.from } : {}),
              ...(filters?.to ? { lte: filters.to } : {})
            }
          }
        : {})
    },
    include: {
      transaction: {
        include: {
          session: {
            include: {
              customer: true,
              resource: true
            }
          }
        }
      },
      recordedBy: {
        select: { id: true, name: true, role: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function recordPayment(
  ctx: LocalContext,
  input: {
    transactionId: string
    amount: number
    method: PaymentMethod
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  if (input.amount <= 0) throw new Error('VALIDATION_ERROR')

  const transaction = await db.transaction.findFirst({
    where: { id: input.transactionId, venueId: ctx.venueId },
    include: { payments: true, session: true }
  })
  if (!transaction) throw new Error('NOT_FOUND')

  const paidAlready = transaction.payments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = Math.max(0, transaction.total - paidAlready)

  if (input.amount > outstanding + 0.01) {
    throw new Error('VALIDATION_ERROR')
  }

  const isFullPayment = paidAlready + input.amount >= transaction.total - 0.01

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        venueId: ctx.venueId!,
        transactionId: input.transactionId,
        amount: input.amount,
        method: input.method,
        status: isFullPayment ? 'PAID' : 'PARTIAL',
        recordedById: ctx.userId
      },
      include: {
        transaction: {
          include: {
            session: {
              include: { customer: true, resource: true }
            }
          }
        }
      }
    })

    await tx.auditLog.create({
      data: {
        venueId: ctx.venueId!,
        actorId: ctx.userId,
        action: 'RECORD',
        entity: 'PAYMENT',
        entityId: payment.id,
        newValue: JSON.stringify({
          amount: payment.amount,
          method: payment.method,
          transactionId: transaction.id,
          total: transaction.total
        })
      }
    })

    return payment
  })
}
