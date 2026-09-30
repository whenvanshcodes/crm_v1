import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { listPayments, recordPayment } from '@/lib/services/payment'
import { apiError } from '@/lib/http'

const input = z.object({
  transactionId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'UPI', 'CARD', 'OTHER'])
})

export async function GET(request: Request) {
  try {
    const c = await requireContext()
    const url = new URL(request.url)
    const method = (url.searchParams.get('method') as 'CASH' | 'UPI' | 'CARD' | 'OTHER') || undefined
    const payments = await listPayments(c.venueId!, { method })
    return NextResponse.json(payments)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const data = input.parse(await request.json())
    const payment = await recordPayment(c, data)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
