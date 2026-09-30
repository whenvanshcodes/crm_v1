import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { checkCredentials } from '@/lib/auth/local'
import { createVenueWithOwner } from '@/lib/services/venue'
import { createResource } from '@/lib/services/resource'
import { createOrGetCustomer, getCustomer } from '@/lib/services/customer'
import { createBooking } from '@/lib/services/booking'
import { startSession, extendSession, endSession } from '@/lib/services/session'
import { recordPayment } from '@/lib/services/payment'
import { getVenueReports } from '@/lib/services/report'
import type { LocalContext } from '@/lib/auth/local'

describe('Full End-to-End Local MVP Business Flow', () => {
  let superAdminCtx: LocalContext
  let ownerCtx: LocalContext
  let venueId: string
  let resourceId: string
  let customerId: string
  let bookingId: string
  let sessionId: string
  let transactionId: string

  beforeAll(async () => {
    const admin = await db.user.findUnique({
      where: { email: 'admin@parlour.local' }
    })
    superAdminCtx = {
      userId: admin!.id,
      venueId: null,
      role: 'SUPER_ADMIN',
      name: admin!.name
    }
  })

  it('Step 1: Super Admin authenticates and creates a new Café and Owner atomically', async () => {
    // Check credentials with bcrypt
    const verifiedAdmin = await checkCredentials('admin@parlour.local', 'demo1234')
    expect(verifiedAdmin).not.toBeNull()
    expect(verifiedAdmin?.role).toBe('SUPER_ADMIN')

    // Create unique test café and owner
    const uniqueSuffix = Date.now().toString().slice(-5)
    const { venue, owner } = await createVenueWithOwner(superAdminCtx, {
      name: `Apex Snooker Lounge ${uniqueSuffix}`,
      phone: `98765${uniqueSuffix}`,
      email: `contact${uniqueSuffix}@apex.local`,
      ownerName: `Vikram Malhotra ${uniqueSuffix}`,
      ownerEmail: `vikram${uniqueSuffix}@apex.local`,
      ownerPassword: 'demo1234'
    })

    expect(venue.id).toBeDefined()
    expect(owner.id).toBeDefined()
    expect(owner.venueId).toBe(venue.id)
    expect(owner.role).toBe('OWNER')

    venueId = venue.id
    ownerCtx = {
      userId: owner.id,
      venueId: venue.id,
      role: 'OWNER',
      name: owner.name
    }
  })

  it('Step 2: Owner authenticates with local credentials', async () => {
    const verifiedOwner = await checkCredentials(
      ownerCtx.userId ? (await db.user.findUnique({ where: { id: ownerCtx.userId } }))!.email : '',
      'demo1234'
    )
    expect(verifiedOwner).not.toBeNull()
    expect(verifiedOwner?.venueId).toBe(venueId)
  })

  it('Step 3: Owner creates a new recreational resource with hourly pricing', async () => {
    const resource = await createResource(ownerCtx, {
      name: 'Rasson Match Snooker 01',
      categoryName: 'Snooker',
      hourlyRate: 500,
      description: 'Championship 12ft table'
    })

    expect(resource.id).toBeDefined()
    expect(resource.venueId).toBe(venueId)
    expect(resource.status).toBe('AVAILABLE')

    resourceId = resource.id
  })

  it('Step 4: Owner registers a customer via phone lookup flow', async () => {
    const customer = await createOrGetCustomer(ownerCtx, {
      name: 'Rohan Deshmukh',
      phone: '+91 98220 54321'
    })

    expect(customer.id).toBeDefined()
    expect(customer.venueId).toBe(venueId)
    expect(customer.phone).toBe('919822054321') // Normalized
    expect(customer.totalVisits).toBe(0)
    expect(customer.totalSpending).toBe(0)

    customerId = customer.id
  })

  it('Step 5: Owner books the resource and system prevents double-booking', async () => {
    const start = new Date(Date.now() + 3600000 * 2)
    const end = new Date(Date.now() + 3600000 * 4) // 2 hour booking

    const booking = await createBooking(ownerCtx, {
      customerId,
      resourceId,
      startTime: start,
      endTime: end,
      notes: 'Prefers tournament balls'
    })

    expect(booking.id).toBeDefined()
    expect(booking.status).toBe('CONFIRMED')
    bookingId = booking.id

    // Attempting conflicting booking must fail
    await expect(
      createBooking(ownerCtx, {
        customerId,
        resourceId,
        startTime: start,
        endTime: end
      })
    ).rejects.toThrow('BOOKING_CONFLICT')
  })

  it('Step 6: Owner starts a session from the booking', async () => {
    const session = await startSession(ownerCtx, {
      customerId,
      resourceId,
      bookingId
    })

    expect(session.id).toBeDefined()
    expect(session.status).toBe('ACTIVE')
    expect(session.startedAt).toBeDefined()
    expect(session.expectedEndAt).toBeDefined()

    sessionId = session.id

    // Verify resource is now marked OCCUPIED
    const resource = await db.resource.findUnique({ where: { id: resourceId } })
    expect(resource?.status).toBe('OCCUPIED')

    // Concurrency check: duplicate session start fails
    await expect(
      startSession(ownerCtx, { customerId, resourceId })
    ).rejects.toThrow('SESSION_CONFLICT')
  })

  it('Step 7: Owner extends the live session', async () => {
    const extended = await extendSession(ownerCtx, sessionId, 60)
    expect(extended.expectedEndAt).toBeDefined()
  })

  it('Step 8: Owner ends session, triggering server-side billing calculation and transaction creation', async () => {
    const result = await endSession(ownerCtx, sessionId, { discount: 50 })

    expect(result.session.status).toBe('COMPLETED')
    expect(result.session.finalAmount).toBeGreaterThan(0)
    expect(result.transaction.id).toBeDefined()
    expect(result.transaction.total).toBe(result.billing.total)
    expect(result.transaction.discount).toBe(50)

    transactionId = result.transaction.id

    // Verify resource released to AVAILABLE
    const resource = await db.resource.findUnique({ where: { id: resourceId } })
    expect(resource?.status).toBe('AVAILABLE')

    // Verify customer visits and spending incremented
    const customer = await db.customer.findUnique({ where: { id: customerId } })
    expect(customer?.totalVisits).toBe(1)
    expect(customer?.totalSpending).toBe(result.billing.total)
  })

  it('Step 9: Owner records payment for the transaction', async () => {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId }
    })
    expect(transaction).not.toBeNull()

    // Test overpayment prevention
    await expect(
      recordPayment(ownerCtx, {
        transactionId,
        amount: transaction!.total + 500, // Exceeds balance!
        method: 'UPI'
      })
    ).rejects.toThrow('VALIDATION_ERROR')

    // Record valid full payment
    const payment = await recordPayment(ownerCtx, {
      transactionId,
      amount: transaction!.total,
      method: 'UPI'
    })

    expect(payment.id).toBeDefined()
    expect(payment.status).toBe('PAID')
    expect(payment.amount).toBe(transaction!.total)
  })

  it('Step 10: Customer profile reflects complete activity and payment history', async () => {
    const profile = await getCustomer(venueId, customerId)

    expect(profile.totalVisits).toBe(1)
    expect(profile.totalSpending).toBeGreaterThan(0)
    expect(profile.bookings.length).toBe(1)
    expect(profile.sessions.length).toBe(1)
    expect(profile.sessions[0].transaction?.payments.length).toBe(1)
  })

  it('Step 11: Venue reports reflect revenue, session counts and payment breakdown', async () => {
    const reports = await getVenueReports(venueId)

    expect(reports.todayRevenue).toBeGreaterThan(0)
    expect(reports.totalSessions).toBe(1)
    expect(reports.completedSessions).toBe(1)
    expect(reports.totalCustomers).toBe(1)
    expect(reports.paymentBreakdown.find((p) => p.method === 'UPI')?.amount).toBeGreaterThan(0)
  })
})
