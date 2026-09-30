import { NextResponse } from 'next/server'
import { localContext, ACTIVE_VENUE_COOKIE } from '@/lib/auth/local'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const ctx = await localContext(req)
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { venueId } = body
  if (!venueId || typeof venueId !== 'string') {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Check authorization to target venue
  if (ctx.role !== 'SUPER_ADMIN') {
    const allowed = await db.venue.findFirst({
      where: {
        id: venueId,
        OR: [{ ownerId: ctx.userId }, { id: ctx.venueId || undefined }]
      }
    })
    if (!allowed) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  } else {
    const exists = await db.venue.findUnique({ where: { id: venueId } })
    if (!exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const response = NextResponse.json({ success: true, activeVenueId: venueId })

  try {
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_VENUE_COOKIE, venueId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
  } catch {
    response.cookies.set(ACTIVE_VENUE_COOKIE, venueId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })
  }

  return response
}
