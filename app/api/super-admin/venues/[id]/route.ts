import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { setVenueStatus, getVenueSettings, updateVenueSettings } from '@/lib/services/venue'
import { apiError } from '@/lib/http'

const adminVenueUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  shortName: z.string().trim().max(50).optional().or(z.literal('')),
  phone: z.string().trim().min(6).max(32).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  currency: z.string().min(1).max(5).optional(),
  logoUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  coverImageUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  dashboardHeroUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  galleryImages: z.string().max(5000).optional().nullable().or(z.literal('')),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  taxRate: z.number().min(0).max(100).optional()
})

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireContext(['SUPER_ADMIN'])
    const { id } = await params
    const venue = await getVenueSettings(id)
    return NextResponse.json(venue)
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['SUPER_ADMIN'])
    const { id } = await params
    const body = adminVenueUpdateSchema.parse(await request.json())

    if (body.status) {
      await setVenueStatus(c, id, body.status)
    }

    const updated = await updateVenueSettings(c, body, id)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}
