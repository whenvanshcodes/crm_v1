import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { updateWaitlistStatus } from '@/lib/services/waitlist'
import { apiError } from '@/lib/http'

const statusSchema = z.object({
  status: z.enum(['WAITING', 'ASSIGNED', 'SKIPPED', 'REMOVED'])
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const body = statusSchema.parse(await request.json())
    const updated = await updateWaitlistStatus(c, id, body.status)
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
    const updated = await updateWaitlistStatus(c, id, 'REMOVED')
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
