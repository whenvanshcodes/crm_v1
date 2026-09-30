import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { listStaff, createStaffMember } from '@/lib/services/staff'
import { apiError } from '@/lib/http'

const staffInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['MANAGER', 'RECEPTIONIST', 'STAFF']),
  password: z.string().min(6).optional()
})

export async function GET() {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const staff = await listStaff(c.venueId!)
    return NextResponse.json(staff)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const data = staffInput.parse(await request.json())
    const staffMember = await createStaffMember(c, data)
    return NextResponse.json(staffMember, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
