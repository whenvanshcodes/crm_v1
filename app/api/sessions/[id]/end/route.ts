import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { endSession } from '@/lib/services/session'
import { apiError } from '@/lib/http'

const endSchema = z.object({
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).default('CASH')
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    const { id } = await params
    let options: { discount?: number; notes?: string; paymentMethod?: string } = {
      paymentMethod: 'CASH'
    }
    try {
      const body = await request.json()
      const parsed = endSchema.safeParse(body)
      if (parsed.success) options = parsed.data
    } catch {
      // Optional body
    }
    const result = await endSession(c, id, options)
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}
