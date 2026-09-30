import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { bulkCreateResources } from '@/lib/services/resource'
import { apiError } from '@/lib/http'

const bulkInputSchema = z.object({
  categoryName: z.string().trim().min(1).max(100),
  namePrefix: z.string().trim().min(2).max(100),
  quantity: z.number().int().min(1).max(50),
  hourlyRate: z.number().min(0),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().max(2000).optional().nullable().or(z.literal(''))
})

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'SUPER_ADMIN'])
    const body = bulkInputSchema.parse(await request.json())
    const resources = await bulkCreateResources(c, body)
    return NextResponse.json(resources, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
