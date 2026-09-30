import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { getCustomer, updateCustomer } from '@/lib/services/customer'
import { apiError } from '@/lib/http'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().min(6).max(32).optional()
})

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext()
    const { id } = await params
    const customer = await getCustomer(c.venueId!, id)
    return NextResponse.json(customer)
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const input = updateSchema.parse(await request.json())
    const updated = await updateCustomer(c, id, input)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
