import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { calculateSessionBill, startSession, extendSession, endSession } from '@/lib/services/session'
import { bulkCreateResources } from '@/lib/services/resource'
import type { LocalContext } from '@/lib/auth/local'

describe('Core Gaming Parlour Operations & Mandatory Specifications', () => {
  let ownerCtx: LocalContext
  let customerId: string
  let testVenueId: string

  beforeAll(async () => {
    const owner = await db.user.findUnique({ where: { email: 'owner.a@parlour.local' } })
    if (!owner) throw new Error('Seed owner missing')

    testVenueId = owner.venueId || 'seed-a'
    ownerCtx = {
      userId: owner.id,
      venueId: testVenueId,
      role: 'OWNER',
      name: owner.name
    }

    const cust = await db.customer.upsert({
      where: { venueId_phone: { venueId: testVenueId, phone: '9876543210' } },
      update: {},
      create: {
        venueId: testVenueId,
        name: 'Amit Sharma',
        phone: '9876543210'
      }
    })
    customerId = cust.id
  })

  describe('Mandatory Add-on Quantity Pricing Calculation', () => {
    it('calculates correct hourly rates and totals for 0, 1, and 2 extra controllers', () => {
      const baseRate = 120 // PS5 ₹120/hr
      const extraControllerPrice = 60 // ₹60/hr
      const start = new Date('2026-09-30T10:00:00Z')
      const end2h = new Date('2026-09-30T12:00:00Z') // 2 hours

      // Quantity 0
      const bill0 = calculateSessionBill(baseRate, start, end2h, 0, 0, [])
      expect(bill0.hourlyRate).toBe(120)
      expect(bill0.total).toBe(240) // 120 * 2

      // Quantity 1
      const addOns1 = [
        { name: 'Extra Controller', price: extraControllerPrice, pricingType: 'PER_HOUR', quantity: 1 }
      ]
      const bill1 = calculateSessionBill(baseRate, start, end2h, 0, 0, addOns1)
      expect(bill1.hourlyRate).toBe(180) // 120 + 60
      expect(bill1.total).toBe(360) // 180 * 2

      // Quantity 2
      const addOns2 = [
        { name: 'Extra Controller', price: extraControllerPrice, pricingType: 'PER_HOUR', quantity: 2 }
      ]
      const bill2 = calculateSessionBill(baseRate, start, end2h, 0, 0, addOns2)
      expect(bill2.hourlyRate).toBe(240) // 120 + 60 * 2
      expect(bill2.total).toBe(480) // 240 * 2 = 480
    })
  })

  describe('Mandatory Early-End and Overtime Billing', () => {
    it('Mandatory Early-End: Booked 2h (₹360), actual 1h -> final bill ₹180', () => {
      const rate = 180 // ₹180/hr so 2h = ₹360
      const start = new Date('2026-09-30T10:00:00Z')
      const actualEnd1h = new Date('2026-09-30T11:00:00Z') // 1 hour

      const bill = calculateSessionBill(rate, start, actualEnd1h)
      expect(bill.durationMinutes).toBe(60)
      expect(bill.total).toBe(180)
    })

    it('Mandatory Overtime: Booked 2h (₹360), actual 2h20m -> final bill ₹420', () => {
      const rate = 180 // ₹180/hr
      const start = new Date('2026-09-30T10:00:00Z')
      const actualEnd2h20m = new Date('2026-09-30T12:20:00Z') // 140 minutes

      const bill = calculateSessionBill(rate, start, actualEnd2h20m)
      expect(bill.durationMinutes).toBe(140)
      // 140 * 180 / 60 = 420
      expect(bill.total).toBe(420)
    })
  })

  describe('Mandatory Session Extension & Planned Data Preservation', () => {
    it('preserves planned_duration_minutes and planned_end_at when extending session', async () => {
      // Create a test resource
      const resource = await db.resource.create({
        data: {
          venueId: testVenueId,
          name: `Extend Test PS5 ${Date.now()}`,
          status: 'AVAILABLE'
        }
      })
      const rule = await db.pricingRule.create({
        data: {
          venueId: testVenueId,
          resourceId: resource.id,
          unit: 'HOUR',
          rate: 120,
          active: true
        }
      })

      // Start 2-hour session (120 minutes)
      const session = await startSession(ownerCtx, {
        customerId,
        resourceId: resource.id,
        pricingRuleId: rule.id,
        expectedDurationMinutes: 120,
        partySize: 3
      })

      const originalPlannedStart = session.plannedStartAt
      const originalPlannedEnd = session.plannedEndAt
      const originalPlannedDuration = session.plannedDurationMinutes

      expect(originalPlannedDuration).toBe(120)
      expect(originalPlannedEnd).toBeDefined()

      // Extend by +30m
      const extended = await extendSession(ownerCtx, session.id, 30)

      // Expected:
      // Extension is recorded
      expect(extended.extensionHistory).toBeDefined()
      const history = JSON.parse(extended.extensionHistory || '[]')
      expect(history.length).toBe(1)
      expect(history[0].minutes).toBe(30)

      // Original planned duration and planned end remain unchanged
      expect(extended.plannedDurationMinutes).toBe(originalPlannedDuration)
      expect(new Date(extended.plannedEndAt!).getTime()).toBe(new Date(originalPlannedEnd!).getTime())

      // expectedEndAt must be updated
      expect(new Date(extended.expectedEndAt!).getTime()).toBeGreaterThan(new Date(originalPlannedEnd!).getTime())

      // Clean up
      await endSession(ownerCtx, session.id, { paymentMethod: 'CASH' })
      await db.payment.deleteMany({ where: { venueId: testVenueId } })
      await db.transaction.deleteMany({ where: { venueId: testVenueId } })
      await db.session.delete({ where: { id: session.id } })
      await db.pricingRule.delete({ where: { id: rule.id } })
      await db.resource.delete({ where: { id: resource.id } })
    })
  })

  describe('Bulk Resource Creation', () => {
    it('creates 5 resources with formatted names, pricing, and category', async () => {
      const suffix = Date.now().toString().slice(-4)
      const prefix = `Bulk Lounge ${suffix}`

      const created = await bulkCreateResources(ownerCtx, {
        categoryName: 'PlayStation 5',
        namePrefix: prefix,
        quantity: 5,
        hourlyRate: 120
      })

      expect(created.length).toBe(5)
      expect(created[0].name).toBe(`${prefix} 01`)
      expect(created[1].name).toBe(`${prefix} 02`)
      expect(created[2].name).toBe(`${prefix} 03`)
      expect(created[3].name).toBe(`${prefix} 04`)
      expect(created[4].name).toBe(`${prefix} 05`)

      for (const res of created) {
        expect(res.pricingRules[0].rate).toBe(120)
        expect(res.status).toBe('AVAILABLE')
      }

      // Clean up created resources
      for (const res of created) {
        await db.pricingRule.deleteMany({ where: { resourceId: res.id } })
        await db.resource.delete({ where: { id: res.id } })
      }
    })

    it('rejects duplicate resource names within the same branch', async () => {
      const suffix = Date.now().toString().slice(-4)
      const prefix = `Dup PS5 ${suffix}`

      // Create single first
      const first = await db.resource.create({
        data: {
          venueId: testVenueId,
          name: `${prefix} 01`,
          status: 'AVAILABLE'
        }
      })

      // Attempt to bulk create overlapping names
      await expect(
        bulkCreateResources(ownerCtx, {
          categoryName: 'PlayStation 5',
          namePrefix: prefix,
          quantity: 3,
          hourlyRate: 120
        })
      ).rejects.toThrow('DUPLICATE_NAME')

      // Clean up
      await db.resource.delete({ where: { id: first.id } })
    })

    it('validates quantity boundaries and pricing', async () => {
      await expect(
        bulkCreateResources(ownerCtx, {
          categoryName: 'PlayStation 5',
          namePrefix: 'Invalid Qty',
          quantity: 0,
          hourlyRate: 120
        })
      ).rejects.toThrow('INVALID_QUANTITY')

      await expect(
        bulkCreateResources(ownerCtx, {
          categoryName: 'PlayStation 5',
          namePrefix: 'Invalid Price',
          quantity: 3,
          hourlyRate: -10
        })
      ).rejects.toThrow('INVALID_PRICING')
    })
  })
})
