import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { localContext, createLocalSession, KEY, ACTIVE_VENUE_COOKIE } from '@/lib/auth/local'
import { POST as switchVenueApi } from '@/app/api/auth/switch-venue/route'
import { formatOperatingHours, isCurrentlyOpen } from '@/lib/venue-hours'

describe('Multi-Venue Ownership & Context Switching', () => {
  let ownerAUserId: string
  let ownerASessionId: string
  let ownerBUserId: string
  let ownerBSessionId: string
  let adminUserId: string
  let adminSessionId: string
  let cafeAVenueId: string
  let cafeCVenueId: string
  let cafeBVenueId: string

  beforeAll(async () => {
    let [userA, admin, venueA, venueB] = await Promise.all([
      db.user.findUnique({ where: { email: 'owner.a@parlour.local' } }),
      db.user.findUnique({ where: { email: 'admin@parlour.local' } }),
      db.venue.findUnique({ where: { id: 'seed-a' } }),
      db.venue.findUnique({ where: { id: 'seed-b' } })
    ])

    if (!userA) {
      throw new Error('Seed data missing for owner.a. Run pnpm db:seed first.')
    }

    // Ensure an isolated venue owned by someone else exists for 403 authorization test
    const venueOther = await db.venue.upsert({
      where: { id: 'test-venue-isolation-b' },
      update: {},
      create: {
        id: 'test-venue-isolation-b',
        name: 'Isolated Parlour B',
        phone: '9999990099'
      }
    })

    let userB = await db.user.findUnique({ where: { email: 'owner.b@parlour.local' } })
    if (!userB) {
      userB = await db.user.upsert({
        where: { email: 'owner.b@parlour.local' },
        update: {},
        create: {
          email: 'owner.b@parlour.local',
          passwordHash: 'test-hash',
          name: 'Owner Isolated B',
          role: 'OWNER',
          venueId: venueOther.id
        }
      })
    }

    ownerAUserId = userA.id
    ownerBUserId = userB.id
    adminUserId = admin!.id
    cafeAVenueId = venueA!.id
    cafeCVenueId = venueB!.id // Branch 2 owned by Owner A
    cafeBVenueId = venueOther.id // Unauthorized venue not owned by Owner A

    const [sessA, sessB, sessAdmin] = await Promise.all([
      createLocalSession(ownerAUserId),
      createLocalSession(ownerBUserId),
      createLocalSession(adminUserId)
    ])

    ownerASessionId = sessA.id
    ownerBSessionId = sessB.id
    adminSessionId = sessAdmin.id
  })

  it('resolves Owner A default venue to Café A when no active cookie is passed', async () => {
    const req = new Request('http://localhost:3000/api/customers', {
      headers: { cookie: `${KEY}=${ownerASessionId}` }
    })
    const ctx = await localContext(req)
    expect(ctx).not.toBeNull()
    expect(ctx?.userId).toBe(ownerAUserId)
    expect(ctx?.venueId).toBe(cafeAVenueId)
  })

  it('switches Owner A context to Café C when ACTIVE_VENUE_COOKIE is set', async () => {
    const req = new Request('http://localhost:3000/api/customers', {
      headers: {
        cookie: `${KEY}=${ownerASessionId}; ${ACTIVE_VENUE_COOKIE}=${cafeCVenueId}`
      }
    })
    const ctx = await localContext(req)
    expect(ctx).not.toBeNull()
    expect(ctx?.venueId).toBe(cafeCVenueId)
  })

  it('rejects Owner A attempting to switch to Café B with 403 Forbidden', async () => {
    const req = new Request('http://localhost:3000/api/auth/switch-venue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${KEY}=${ownerASessionId}`
      },
      body: JSON.stringify({ venueId: cafeBVenueId })
    })

    const res = await switchVenueApi(req)
    expect(res.status).toBe(403)
  })

  it('allows Owner A to switch to Café C via switch-venue API', async () => {
    const req = new Request('http://localhost:3000/api/auth/switch-venue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${KEY}=${ownerASessionId}`
      },
      body: JSON.stringify({ venueId: cafeCVenueId })
    })

    const res = await switchVenueApi(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.activeVenueId).toBe(cafeCVenueId)
  })

  it('allows Super Admin to switch to any venue (Café B)', async () => {
    const req = new Request('http://localhost:3000/api/auth/switch-venue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${KEY}=${adminSessionId}`
      },
      body: JSON.stringify({ venueId: cafeBVenueId })
    })

    const res = await switchVenueApi(req)
    expect(res.status).toBe(200)
  })

  it('properly formats overnight operating hours across midnight', () => {
    const schedule = formatOperatingHours('10:00', '02:00')
    expect(schedule.isOvernight).toBe(true)
    expect(schedule.display).toBe('10:00 AM – 2:00 AM (Next Day)')
    expect(schedule.openUntilLabel).toBe('Open until 2:00 AM (Next day)')

    // 11:30 PM (23:30) is open
    const lateNight = new Date('2026-09-30T23:30:00')
    expect(isCurrentlyOpen('10:00', '02:00', lateNight)).toBe(true)

    // 01:15 AM is open
    const postMidnight = new Date('2026-09-30T01:15:00')
    expect(isCurrentlyOpen('10:00', '02:00', postMidnight)).toBe(true)

    // 04:00 AM is closed
    const earlyMorning = new Date('2026-09-30T04:00:00')
    expect(isCurrentlyOpen('10:00', '02:00', earlyMorning)).toBe(false)
  })
})
