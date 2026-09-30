import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { getResource, updateResource } from '@/lib/services/resource'
import { apiError } from '@/lib/http'

const updateInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  categoryId: z.string().optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'DISABLED']).optional(),
  hourlyRate: z.coerce.number().min(0).optional()
})

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext()
    const { id } = await params
    const resource = await getResource(c.venueId!, id)
    return NextResponse.json(resource)
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const body = updateInput.parse(await request.json())
    const updated = await updateResource(c, id, body)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
