import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { listResources, createResource } from '@/lib/services/resource'
import { apiError } from '@/lib/http'

const input = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  hourlyRate: z.coerce.number().min(0).optional()
})

export async function GET() {
  try {
    const c = await requireContext()
    const resources = await listResources(c.venueId!)
    return NextResponse.json(resources)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER'])
    const body = input.parse(await request.json())
    const resource = await createResource(c, body)
    return NextResponse.json(resource, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
