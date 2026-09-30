import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { createBooking, listBookings, getSmartAvailability } from '@/lib/services/booking'
import { apiError } from '@/lib/http'

const input = z.object({
  customerId: z.string().min(1),
  resourceId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  partySize: z.coerce.number().min(1).default(1),
  groupMembers: z.string().optional(),
  notes: z.string().max(1000).optional(),
  priceEstimate: z.coerce.number().min(0).optional(),
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
    const checkAvailability = url.searchParams.get('check') === 'availability'
    if (checkAvailability) {
      const timeParam = url.searchParams.get('time')
      const targetTime = timeParam ? new Date(timeParam) : new Date()
      const availability = await getSmartAvailability(c.venueId!, targetTime)
      return NextResponse.json(availability)
    }

    const status = url.searchParams.get('status') || undefined
    const resourceId = url.searchParams.get('resourceId') || undefined
    const customerId = url.searchParams.get('customerId') || undefined

    const bookings = await listBookings(c.venueId!, { status, resourceId, customerId })
    return NextResponse.json(bookings)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const booking = await createBooking(c, input.parse(await request.json()))
    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    if (error.code === 'BOOKING_CONFLICT') {
      return NextResponse.json(
        {
          error: 'BOOKING_CONFLICT',
          message: error.message,
          alternatives: error.alternatives || []
        },
        { status: 409 }
      )
    }
    return apiError(error)
  }
}
