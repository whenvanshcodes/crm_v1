import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import {
  listAllVenues,
  createVenueWithOwner,
  createParlourWithWizard,
  addBranchToBusiness
} from '@/lib/services/venue'
import { apiError } from '@/lib/http'

const simpleCreateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal('')),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  currency: z.string().optional(),
  ownerName: z.string().trim().min(2),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().optional(),
  ownerPassword: z.string().min(6).optional()
})

export async function GET() {
  try {
    await requireContext(['SUPER_ADMIN'])
    const venues = await listAllVenues()
    return NextResponse.json(venues)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['SUPER_ADMIN'])
    const body = await request.json()

    // 1. Wizard-driven full parlour creation
    if (body.wizard === true) {
      const result = await createParlourWithWizard(c, body)
      return NextResponse.json(result, { status: 201 })
    }

    // 2. Add Branch to existing business
    if (body.action === 'add_branch') {
      const result = await addBranchToBusiness(c, body)
      return NextResponse.json(result, { status: 201 })
    }

    // 3. Fallback simple creation
    const parsed = simpleCreateSchema.parse(body)
    const result = await createVenueWithOwner(c, {
      ...parsed,
      email: parsed.email || undefined
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
