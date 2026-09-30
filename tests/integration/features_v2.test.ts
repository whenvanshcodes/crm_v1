import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { createBooking, updateBookingStatus } from '@/lib/services/booking'
import { startSession, extendSession, endSession, getMaxAvailableExtension } from '@/lib/services/session'
import { createAddOn, listAddOns } from '@/lib/services/addon'
import { createParlourWithWizard, addBranchToBusiness, getSuperAdminOverview } from '@/lib/services/venue'
import { addToWaitlist, listWaitlist, updateWaitlistStatus } from '@/lib/services/waitlist'
import type { LocalContext } from '@/lib/auth/local'

describe('Features V2: Party Size, Generic Add-ons, Smart Extensions & Wizard', () => {
  let ownerCtx: LocalContext
  let adminCtx: LocalContext
  let customerId: string
  let resourceId: string
  let resourceCategoryId: string
  let testVenueId: string

  beforeAll(async () => {
    const [owner, admin] = await Promise.all([
      db.user.findUnique({ where: { email: 'owner.a@parlour.local' } }),
      db.user.findUnique({ where: { email: 'admin@parlour.local' } })
    ])

    if (!owner || !admin) {
      throw new Error('Seed users missing. Run pnpm db:seed first.')
    }

    testVenueId = owner.venueId!

    ownerCtx = {
      userId: owner.id,
      venueId: testVenueId,
      role: 'OWNER',
      name: owner.name
    }

    adminCtx = {
      userId: admin.id,
      venueId: null,
      role: 'SUPER_ADMIN',
      name: admin.name
    }

    // Create a dedicated test customer
    const cust = await db.customer.upsert({
      where: { venueId_phone: { venueId: testVenueId, phone: '9988776655' } },
      update: {},
      create: {
        venueId: testVenueId,
        name: 'V2 Test Gamer',
        phone: '9988776655'
      }
    })
    customerId = cust.id

    // Resolve or create a resource for testing
    let resource = await db.resource.findFirst({
      where: { venueId: testVenueId, status: 'AVAILABLE' },
      include: { pricingRules: true }
    })

    if (!resource) {
      const cat = await db.resourceCategory.upsert({
        where: { venueId_name: { venueId: testVenueId, name: 'V2 Test Category' } },
        update: {},
        create: { venueId: testVenueId, name: 'V2 Test Category' }
      })
      resource = await db.resource.create({
        data: {
          venueId: testVenueId,
          categoryId: cat.id,
          name: 'V2 Test Snooker Table',
          status: 'AVAILABLE'
        },
        include: { pricingRules: true }
      })
      await db.pricingRule.create({
        data: {
          venueId: testVenueId,
          resourceId: resource.id,
          unit: 'HOUR',
          rate: 180
        }
      })
    }

    resourceId = resource.id
    resourceCategoryId = resource.categoryId!
  })

  it('1. Booking & Session support party size and group companion names', async () => {
    const start = new Date(Date.now() + 3600000 * 200) // far future
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    const booking = await createBooking(ownerCtx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end,
      partySize: 4,
      groupMembers: 'Karan, Pooja, Aman'
    })

    expect(booking.partySize).toBe(4)
    expect(booking.groupMembers).toBe('Karan, Pooja, Aman')

    // Clean up test booking
    await db.booking.delete({ where: { id: booking.id } })
  })

  it('2. Generic Add-ons CRUD and inclusion in active sessions', async () => {
    // Create add-on: Controller (PER_HOUR)
    const remoteAddon = await createAddOn(ownerCtx, {
      name: 'V2 Extra Controller',
      price: 60,
      pricingType: 'PER_HOUR',
      categoryName: 'ACCESSORY'
    })

    expect(remoteAddon.id).toBeDefined()
    expect(remoteAddon.pricingType).toBe('PER_HOUR')

    // Create add-on: Headset (FIXED_CHARGE)
    const snackAddon = await createAddOn(ownerCtx, {
      name: 'V2 Gamer Snack Pack',
      price: 150,
      pricingType: 'FIXED_CHARGE',
      categoryName: 'FOOD'
    })

    const list = await listAddOns(ownerCtx.venueId!)
    expect(list.some((a) => a.id === remoteAddon.id)).toBe(true)
    expect(list.some((a) => a.id === snackAddon.id)).toBe(true)

    // Start session with add-ons
    const session = await startSession(ownerCtx, {
      customerId,
      resourceId,
      expectedDurationMinutes: 60,
      partySize: 2,
      addOns: [
        { addOnId: remoteAddon.id, quantity: 2 },
        { addOnId: snackAddon.id, quantity: 1 }
      ]
    })

    expect(session.id).toBeDefined()
    expect(session.addOns.length).toBe(2)
    expect(session.partySize).toBe(2)

    // End session with UPI payment
    const endResult = await endSession(ownerCtx, session.id, {
      paymentMethod: 'UPI'
    })

    expect(endResult.session.status).toBe('COMPLETED')
    expect(endResult.billing.addOnsCharge).toBeGreaterThan(0)
    expect(endResult.payment?.method).toBe('UPI')
  })

  it('3. Smart Extension calculates limits based on upcoming bookings and rejects overextension', async () => {
    // Start active session planned for 60 mins
    const session = await startSession(ownerCtx, {
      customerId,
      resourceId,
      expectedDurationMinutes: 60
    })

    // Create an upcoming booking starting 45 mins after session's expected end
    const bookingStart = new Date(session.expectedEndAt!.getTime() + 45 * 60 * 1000)
    const bookingEnd = new Date(bookingStart.getTime() + 60 * 60 * 1000)

    const upcomingBooking = await createBooking(ownerCtx, {
      customerId,
      resourceId,
      startTime: bookingStart,
      endTime: bookingEnd
    })

    // Check available extension limit
    const extensionInfo = await getMaxAvailableExtension(ownerCtx, session.id)
    expect(extensionInfo.maxMinutes).toBe(45)

    // Attempting to extend by 60 mins must fail due to 45 min ceiling
    await expect(
      extendSession(ownerCtx, session.id, 60)
    ).rejects.toThrow('Maximum available extension is 45 minutes')

    // Extending by 30 mins must succeed
    const extended = await extendSession(ownerCtx, session.id, 30)
    expect(extended.expectedEndAt).toBeDefined()

    // End and clean up
    await endSession(ownerCtx, session.id, { paymentMethod: 'CASH' })
    await db.booking.delete({ where: { id: upcomingBooking.id } })
  })

  it('4. Super Admin 9-Step Wizard creates Parlour and Add Branch expands business', async () => {
    const suffix = Date.now().toString().slice(-4)
    const businessName = `Wizard Gaming ${suffix}`

    // Execute Wizard
    const wizardResult = await createParlourWithWizard(adminCtx, {
      business: {
        name: businessName,
        phone: `9112233${suffix}`,
        email: `contact@wizard${suffix}.local`
      },
      owner: {
        name: `Owner ${suffix}`,
        email: `wizard.owner.${suffix}@parlour.local`,
        phone: `9112233${suffix}`,
        password: 'Password123!'
      },
      branch: {
        name: `${businessName} — Flagship`,
        city: 'Indore',
        phone: `9112233${suffix}`,
        openingTime: '10:00',
        closingTime: '02:00',
        primaryColor: '#6366f1'
      },
      resources: [
        { name: 'Snooker Table Alpha', categoryName: 'Snooker', rate: 250 }
      ],
      addOns: [
        { name: 'Pro Cue Stick', price: 50, pricingType: 'PER_SESSION' }
      ]
    })

    expect(wizardResult.business.name).toBe(businessName)
    expect(wizardResult.owner.email).toBe(`wizard.owner.${suffix}@parlour.local`)
    expect(wizardResult.branch.name).toBe(`${businessName} — Flagship`)

    // Add second branch to this business
    const branch2Result = await addBranchToBusiness(adminCtx, {
      businessId: wizardResult.business.id,
      branch: {
        name: `${businessName} — Branch 2`,
        city: 'Bhopal',
        phone: `9112234${suffix}`,
        openingTime: '11:00',
        closingTime: '01:00'
      }
    })

    expect(branch2Result.branch.businessId).toBe(wizardResult.business.id)
    expect(branch2Result.branch.name).toBe(`${businessName} — Branch 2`)

    // Verify Business has 2 branches in database
    const businessInDb = await db.business.findUnique({
      where: { id: wizardResult.business.id },
      include: { venues: true }
    })

    expect(businessInDb?.venues.length).toBe(2)
  })

  it('4b. Super Admin 3-Step Business Creation: creates Business, Owner, First Branch with NO resources, NO bookings, NO sessions, NO payments', async () => {
    const suffix = Date.now().toString().slice(-4)
    const businessName = `Zero Resource Parlour ${suffix}`

    const result = await createParlourWithWizard(adminCtx, {
      business: {
        name: businessName,
        phone: `9223344${suffix}`,
        email: `zero.${suffix}@parlour.local`
      },
      owner: {
        name: `Owner Zero ${suffix}`,
        email: `zero.owner.${suffix}@parlour.local`,
        phone: `9223344${suffix}`,
        password: 'Password123!'
      },
      branch: {
        name: `${businessName} — First Branch`,
        city: 'Indore',
        phone: `9223344${suffix}`,
        openingTime: '10:00',
        closingTime: '02:00'
      }
    })

    expect(result.business.id).toBeDefined()
    expect(result.owner.id).toBeDefined()
    expect(result.branch.id).toBeDefined()

    // Verify 0 resources, 0 bookings, 0 customers, 0 sessions, 0 payments
    const [resourcesCount, bookingsCount, customersCount, sessionsCount, paymentsCount] = await Promise.all([
      db.resource.count({ where: { venueId: result.branch.id } }),
      db.booking.count({ where: { venueId: result.branch.id } }),
      db.customer.count({ where: { venueId: result.branch.id } }),
      db.session.count({ where: { venueId: result.branch.id } }),
      db.payment.count({ where: { venueId: result.branch.id } })
    ])

    expect(resourcesCount).toBe(0)
    expect(bookingsCount).toBe(0)
    expect(customersCount).toBe(0)
    expect(sessionsCount).toBe(0)
    expect(paymentsCount).toBe(0)
  })

  it('5. Waitlist entries can be created, listed, skipped, assigned, and removed', async () => {
    // Add to waitlist
    const entry = await addToWaitlist(ownerCtx, {
      customerId,
      partySize: 4,
      categoryName: 'Snooker',
      notes: 'Prefers Table 1'
    })

    expect(entry.status).toBe('WAITING')
    expect(entry.partySize).toBe(4)
    expect(entry.categoryName).toBe('Snooker')

    // List waitlist
    const list = await listWaitlist(testVenueId)
    const found = list.find((w) => w.id === entry.id)
    expect(found).toBeDefined()
    expect(found?.customer.id).toBe(customerId)

    // Skip waitlist entry
    const skipped = await updateWaitlistStatus(ownerCtx, entry.id, 'SKIPPED')
    expect(skipped.status).toBe('SKIPPED')

    // Assign waitlist entry
    const assigned = await updateWaitlistStatus(ownerCtx, entry.id, 'ASSIGNED')
    expect(assigned.status).toBe('ASSIGNED')

    // Clean up
    await updateWaitlistStatus(ownerCtx, entry.id, 'REMOVED')
    const activeList = await listWaitlist(testVenueId)
    expect(activeList.find((w) => w.id === entry.id)).toBeUndefined()
  })

  it('6. Booking status transitions to ARRIVED and NO_SHOW', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const end = new Date(future.getTime() + 60 * 60 * 1000)

    const booking = await createBooking(ownerCtx, {
      customerId,
      resourceId,
      startTime: future,
      endTime: end,
      partySize: 2
    })

    expect(booking.status).toBe('CONFIRMED')

    // Mark ARRIVED
    const arrived = await updateBookingStatus(ownerCtx, booking.id, 'ARRIVED')
    expect(arrived.status).toBe('ARRIVED')

    // Mark NO_SHOW
    const noShow = await updateBookingStatus(ownerCtx, booking.id, 'NO_SHOW')
    expect(noShow.status).toBe('NO_SHOW')

    // Clean up
    await updateBookingStatus(ownerCtx, booking.id, 'CANCELLED')
  })

  it('7. Super Admin Overview calculates branch setup health checklist and completion %', async () => {
    const overview = await getSuperAdminOverview('all')
    expect(overview.setupHealth).toBeDefined()
    expect(overview.setupHealth!.length).toBeGreaterThan(0)

    for (const item of overview.setupHealth!) {
      expect(item.branchId).toBeDefined()
      expect(item.branchName).toBeDefined()
      expect(typeof item.businessCreated).toBe('boolean')
      expect(typeof item.branchCreated).toBe('boolean')
      expect(typeof item.resourcesAdded).toBe('boolean')
      expect(typeof item.pricingRulesSet).toBe('boolean')
      expect(typeof item.completionPercentage).toBe('number')
      expect(item.completionPercentage).toBeGreaterThanOrEqual(0)
      expect(item.completionPercentage).toBeLessThanOrEqual(100)
    }
  })
})
