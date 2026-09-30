import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { listWaitlist, addToWaitlist } from '@/lib/services/waitlist'
import { apiError } from '@/lib/http'

const addWaitlistSchema = z.object({
  customerId: z.string().min(1),
  partySize: z.coerce.number().min(1).default(1),
  categoryName: z.string().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const list = await listWaitlist(c.venueId!, status)
    return NextResponse.json(list)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const body = addWaitlistSchema.parse(await request.json())
    const created = await addToWaitlist(c, body)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
