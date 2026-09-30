import { NextResponse } from 'next/server'
import { localContext } from '@/lib/auth/local'
import { db } from '@/lib/db'

export async function GET() {
  const ctx = await localContext()
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      venueId: true
    }
  })

  // List of venues this user has access to
  let venues: Array<{
    id: string
    name: string
    shortName: string | null
    city: string | null
    status: string
    primaryColor: string | null
    logoUrl: string | null
  }> = []

  if (ctx.role === 'SUPER_ADMIN') {
    venues = await db.venue.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
        status: true,
        primaryColor: true,
        logoUrl: true
      },
      orderBy: { name: 'asc' }
    })
  } else if (ctx.role === 'OWNER') {
    venues = await db.venue.findMany({
      where: {
        OR: [{ ownerId: ctx.userId }, { id: ctx.venueId || undefined }]
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
        status: true,
        primaryColor: true,
        logoUrl: true
      },
      orderBy: { name: 'asc' }
    })
  } else if (ctx.venueId) {
    const single = await db.venue.findUnique({
      where: { id: ctx.venueId },
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
        status: true,
        primaryColor: true,
        logoUrl: true
      }
    })
    if (single) venues = [single]
  }

  let activeVenue = null
  if (ctx.venueId) {
    activeVenue = await db.venue.findUnique({
      where: { id: ctx.venueId },
      select: {
        id: true,
        name: true,
        shortName: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        currency: true,
        openingTime: true,
        closingTime: true,
        status: true,
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
        coverImageUrl: true,
        dashboardHeroUrl: true
      }
    })
  }

  // Count active sessions for badge
  let activeSessionsCount = 0
  if (ctx.venueId) {
    activeSessionsCount = await db.session.count({
      where: { venueId: ctx.venueId, status: 'ACTIVE' }
    })
  }

  return NextResponse.json({
    userId: ctx.userId,
    name: ctx.name,
    email: user?.email,
    phone: user?.phone,
    role: ctx.role,
    venueId: ctx.venueId,
    activeVenue,
    venue: activeVenue, // compatibility
    venues,
    activeSessionsCount
  })
}
