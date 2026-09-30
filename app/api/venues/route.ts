import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { getVenueSettings, updateVenueSettings, createParlourForOwner } from '@/lib/services/venue'
import { apiError } from '@/lib/http'
import { cookies } from 'next/headers'
import { ACTIVE_VENUE_COOKIE } from '@/lib/auth/local'

const updateVenueSchema = z.object({
  venueId: z.string().optional(),
  name: z.string().trim().min(2).max(160).optional(),
  shortName: z.string().trim().max(50).optional().or(z.literal('')),
  phone: z.string().trim().min(6).max(32).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  currency: z.string().min(1).max(5).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  coverImageUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  dashboardHeroUrl: z.string().max(2000).optional().nullable().or(z.literal('')),
  galleryImages: z.string().max(5000).optional().nullable().or(z.literal('')),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  taxRate: z.number().min(0).max(100).optional()
})

const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().max(50).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(255).optional(),
  phone: z.string().trim().min(6).max(32),
  email: z.string().email().optional().or(z.literal('')),
  openingTime: z.string().default('10:00'),
  closingTime: z.string().default('02:00'),
  currency: z.string().default('INR'),
  primaryColor: z.string().default('#10b981'),
  coverImageUrl: z.string().optional()
})

export async function GET() {
  try {
    const c = await requireContext(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    if (!c.venueId) {
      return NextResponse.json({ error: 'NO_VENUE_SELECTED' }, { status: 400 })
    }
    const venue = await getVenueSettings(c.venueId)
    return NextResponse.json(venue)
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const c = await requireContext(['SUPER_ADMIN', 'OWNER', 'MANAGER'])
    const input = updateVenueSchema.parse(await request.json())
    const targetVenueId = input.venueId || c.venueId || undefined
    const updated = await updateVenueSettings(c, input, targetVenueId)
    return NextResponse.json(updated)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['SUPER_ADMIN', 'OWNER'])
    const input = createVenueSchema.parse(await request.json())
    const newVenue = await createParlourForOwner(c, input)

    const response = NextResponse.json(newVenue, { status: 201 })
    try {
      const cookieStore = await cookies()
      cookieStore.set(ACTIVE_VENUE_COOKIE, newVenue.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30
      })
    } catch {
      response.cookies.set(ACTIVE_VENUE_COOKIE, newVenue.id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30
      })
    }

    return response
  } catch (error) {
    return apiError(error)
  }
}
