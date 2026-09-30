import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { startSession, listSessions } from '@/lib/services/session'
import { apiError } from '@/lib/http'

const input = z.object({
  customerId: z.string().min(1),
  resourceId: z.string().min(1),
  pricingRuleId: z.string().optional(),
  bookingId: z.string().optional(),
  expectedDurationMinutes: z.coerce.number().min(1).optional(),
  partySize: z.coerce.number().min(1).default(1),
  groupMembers: z.string().optional(),
  addOns: z
    .array(
      z.object({
        addOnId: z.string().min(1),
        quantity: z.coerce.number().min(1).default(1)
      })
    )
    .optional()
})

export async function GET(request: Request) {
  try {
    const c = await requireContext()
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || undefined
    const resourceId = url.searchParams.get('resourceId') || undefined
    const customerId = url.searchParams.get('customerId') || undefined

    const sessions = await listSessions(c.venueId!, { status, resourceId, customerId })
    return NextResponse.json(sessions)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    const session = await startSession(c, input.parse(await request.json()))
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
