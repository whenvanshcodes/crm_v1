import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { listAddOns, createAddOn } from '@/lib/services/addon'
import { apiError } from '@/lib/http'

const createSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  pricingType: z.enum(['PER_HOUR', 'PER_SESSION', 'PER_PERSON', 'FIXED_CHARGE']).default('PER_HOUR'),
  price: z.coerce.number().min(0),
  categoryName: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF', 'SUPER_ADMIN'])
    if (!c.venueId) return NextResponse.json([])
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const addOns = await listAddOns(c.venueId, category)
    return NextResponse.json(addOns)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const body = await request.json()
    const parsed = createSchema.parse(body)
    const addOn = await createAddOn(c, parsed)
    return NextResponse.json(addOn, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
