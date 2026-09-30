import { requireLocal, type LocalContext, type Role } from '@/lib/auth/local'
import { db } from '@/lib/db'

export type AppRole = Role
export type AuthContext = LocalContext
export const requireContext = requireLocal

export async function getAppContext() {
  const ctx = await requireLocal()

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true, phone: true }
  })

  let activeVenue = null
  let activeSessionsCount = 0
  let venueName = 'Parlour'

  if (ctx.venueId) {
    activeVenue = await db.venue.findUnique({
      where: { id: ctx.venueId },
      select: {
        id: true,
        name: true,
        shortName: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        currency: true,
        openingTime: true,
        closingTime: true,
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
        coverImageUrl: true,
        dashboardHeroUrl: true
      }
    })
    if (activeVenue) venueName = activeVenue.name

    activeSessionsCount = await db.session.count({
      where: { venueId: ctx.venueId, status: 'ACTIVE' }
    })
  }

  // Venues available for switching
  let venues: Array<{
    id: string
    name: string
    shortName: string | null
    city: string | null
    status: string
    primaryColor: string | null
    logoUrl?: string | null
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
  } else if (activeVenue) {
    venues = [
      {
        id: activeVenue.id,
        name: activeVenue.name,
        shortName: activeVenue.shortName,
        city: activeVenue.city,
        status: 'ACTIVE',
        primaryColor: activeVenue.primaryColor,
        logoUrl: activeVenue.logoUrl
      }
    ]
  }

  return {
    ...ctx,
    email: user?.email,
    phone: user?.phone,
    venueName,
    activeVenue,
    venues,
    activeSessionsCount
  }
}
