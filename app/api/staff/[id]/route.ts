import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { updateStaffMember } from '@/lib/services/staff'
import { apiError } from '@/lib/http'

const updateStaffInput = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const { id } = await params
    const body = updateStaffInput.parse(await request.json())
    const updated = await updateStaffMember(c, id, body)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
