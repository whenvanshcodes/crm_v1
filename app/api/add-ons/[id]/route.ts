import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { updateAddOn, deleteAddOn } from '@/lib/services/addon'
import { apiError } from '@/lib/http'

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().optional(),
  pricingType: z.enum(['PER_HOUR', 'PER_SESSION', 'PER_PERSON', 'FIXED_CHARGE']).optional(),
  price: z.coerce.number().min(0).optional(),
  categoryName: z.string().optional(),
  active: z.boolean().optional()
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.parse(body)
    const result = await updateAddOn(c, id, parsed)
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const { id } = await params
    const result = await deleteAddOn(c, id)
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}
