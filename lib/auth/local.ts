import { compare } from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'STAFF'
export type LocalContext = { userId: string; venueId: string | null; role: Role; name: string }

export const KEY = 'parlour_local_session'
export const ACTIVE_VENUE_COOKIE = 'parlour_active_venue'

export async function localContext(req?: Request): Promise<LocalContext | null> {
  let id: string | undefined
  let activeVenueId: string | undefined

  try {
    const cookieStore = await cookies()
    id = cookieStore.get(KEY)?.value
    activeVenueId = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value
  } catch {
    // In unit testing or raw request contexts where next/headers cookies() is not active
    if (req) {
      const cookieHeader = req.headers.get('cookie') || ''
      const match = cookieHeader.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`))
      if (match) id = decodeURIComponent(match[1])
      const vMatch = cookieHeader.match(new RegExp(`(?:^|; )${ACTIVE_VENUE_COOKIE}=([^;]*)`))
      if (vMatch) activeVenueId = decodeURIComponent(vMatch[1])
    }
  }

  if (!id) return null

  const session = await db.authSession.findUnique({
    where: { id },
    include: { user: true }
  })

  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
    return null
  }

  const user = session.user
  let resolvedVenueId = user.venueId

  // If user requested an active venue, verify authorization
  if (activeVenueId) {
    if (user.role === 'SUPER_ADMIN') {
      resolvedVenueId = activeVenueId
    } else if (user.role === 'OWNER') {
      const allowed = await db.venue.findFirst({
        where: {
          id: activeVenueId,
          OR: [{ ownerId: user.id }, { id: user.venueId || undefined }]
        }
      })
      if (allowed) {
        resolvedVenueId = allowed.id
      }
    }
  }

  // If owner has no venueId set on user record, fallback to first owned venue
  if (!resolvedVenueId && user.role === 'OWNER') {
    const firstOwned = await db.venue.findFirst({ where: { ownerId: user.id } })
    if (firstOwned) resolvedVenueId = firstOwned.id
  }

  // If super admin has no active venue set, fallback to the first venue on the platform
  if (!resolvedVenueId && user.role === 'SUPER_ADMIN') {
    const firstVenue = await db.venue.findFirst({ orderBy: { createdAt: 'asc' } })
    if (firstVenue) resolvedVenueId = firstVenue.id
  }

  return {
    userId: user.id,
    venueId: resolvedVenueId,
    role: user.role as Role,
    name: user.name
  }
}

export async function requireLocal(roles?: Role[], req?: Request) {
  const context = await localContext(req)
  if (!context) throw new Error('UNAUTHORIZED')
  if (roles && !roles.includes(context.role)) throw new Error('FORBIDDEN')
  if (context.role !== 'SUPER_ADMIN' && !context.venueId) throw new Error('FORBIDDEN')
  return context
}

export async function checkCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } })
  return user && user.status === 'ACTIVE' && (await compare(password, user.passwordHash))
    ? user
    : null
}

export async function createLocalSession(userId: string) {
  const expiresAt = new Date(Date.now() + sessionCookie.options.maxAge * 1000)
  return db.authSession.create({ data: { userId, expiresAt } })
}

export async function revokeLocalSession(id: string | undefined) {
  if (id) await db.authSession.deleteMany({ where: { id } })
}

export const sessionCookie = {
  name: KEY,
  options: { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 12 }
}
