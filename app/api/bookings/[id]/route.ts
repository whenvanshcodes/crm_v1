import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { getBooking, updateBookingStatus } from '@/lib/services/booking'
import { apiError } from '@/lib/http'

const statusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'ARRIVED'])
})

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext()
    const { id } = await params
    const booking = await getBooking(c.venueId!, id)
    return NextResponse.json(booking)
  } catch (error) {
    return apiError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const body = statusSchema.parse(await request.json())
    const updated = await updateBookingStatus(c, id, body.status)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const updated = await updateBookingStatus(c, id, 'CANCELLED')
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
