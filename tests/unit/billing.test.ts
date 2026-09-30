import { describe, it, expect } from 'vitest'
import { calculateSessionBill } from '@/lib/services/session'
import { normalizePhone } from '@/lib/services/customer'

describe('Billing Engine & Calculations', () => {
  it('calculates standard 60-minute session correctly', () => {
    const start = new Date('2026-09-30T10:00:00Z')
    const end = new Date('2026-09-30T11:00:00Z')
    const bill = calculateSessionBill(420, start, end)

    expect(bill.durationMinutes).toBe(60)
    expect(bill.subtotal).toBe(420)
    expect(bill.discount).toBe(0)
    expect(bill.total).toBe(420)
  })

  it('enforces minimum half-hour charge for quick sessions under 30 minutes', () => {
    const start = new Date('2026-09-30T10:00:00Z')
    const end = new Date('2026-09-30T10:12:00Z') // 12 minutes
    const bill = calculateSessionBill(420, start, end)

    expect(bill.durationMinutes).toBe(12)
    // 420 / 2 = 210
    expect(bill.subtotal).toBe(210)
    expect(bill.total).toBe(210)
  })

  it('calculates 90-minute session with proportional billing', () => {
    const start = new Date('2026-09-30T10:00:00Z')
    const end = new Date('2026-09-30T11:30:00Z') // 90 minutes
    const bill = calculateSessionBill(400, start, end)

    expect(bill.durationMinutes).toBe(90)
    // 90 * 400 / 60 = 600
    expect(bill.subtotal).toBe(600)
    expect(bill.total).toBe(600)
  })

  it('correctly applies authorized discount', () => {
    const start = new Date('2026-09-30T10:00:00Z')
    const end = new Date('2026-09-30T12:00:00Z') // 120 minutes (800)
    const bill = calculateSessionBill(400, start, end, 150)

    expect(bill.subtotal).toBe(800)
    expect(bill.discount).toBe(150)
    expect(bill.total).toBe(650)
  })

  it('caps discount so final total never drops below zero', () => {
    const start = new Date('2026-09-30T10:00:00Z')
    const end = new Date('2026-09-30T11:00:00Z')
    const bill = calculateSessionBill(400, start, end, 9999)

    expect(bill.discount).toBe(400)
    expect(bill.total).toBe(0)
  })

  describe('Section 77 Master Specification Pricing Scenarios', () => {
    it('Scenario 1 (Normal): Booked 60m, used 60m at ₹120/hr', () => {
      const start = new Date('2026-09-30T14:00:00Z')
      const end = new Date('2026-09-30T15:00:00Z')
      const bill = calculateSessionBill(120, start, end)

      expect(bill.durationMinutes).toBe(60)
      expect(bill.baseCharge).toBe(120)
      expect(bill.addOnsCharge).toBe(0)
      expect(bill.total).toBe(120)
    })

    it('Scenario 2 (Early End): Booked 120m, ended at 45m -> billed for 45m actual usage, NOT 120m', () => {
      const start = new Date('2026-09-30T14:00:00Z')
      const end = new Date('2026-09-30T14:45:00Z') // Customer leaves at 45 mins
      const bill = calculateSessionBill(120, start, end)

      expect(bill.durationMinutes).toBe(45)
      // 45 / 60 * 120 = 90
      expect(bill.baseCharge).toBe(90)
      expect(bill.total).toBe(90)
      expect(bill.total).not.toBe(240) // Must NOT charge for full 120m booked
    })

    it('Scenario 3 (Extension): Booked 60m, extended by 30m, total 90m billed at ₹120/hr', () => {
      const start = new Date('2026-09-30T14:00:00Z')
      const end = new Date('2026-09-30T15:30:00Z') // Extended to 90 mins
      const bill = calculateSessionBill(120, start, end)

      expect(bill.durationMinutes).toBe(90)
      // 90 / 60 * 120 = 180
      expect(bill.baseCharge).toBe(180)
      expect(bill.total).toBe(180)
    })

    it('Scenario 4 (Runs Over): Booked 60m, ended at 75m -> billed for 75m actual elapsed time', () => {
      const start = new Date('2026-09-30T14:00:00Z')
      const end = new Date('2026-09-30T15:15:00Z') // Overtime 15 mins
      const bill = calculateSessionBill(120, start, end)

      expect(bill.durationMinutes).toBe(75)
      // 75 / 60 * 120 = 150
      expect(bill.baseCharge).toBe(150)
      expect(bill.total).toBe(150)
    })

    it('Scenario 5 (Add-on Early End & Generic Pricing Types): PS5 + Hourly Remote + Fixed Snack ended early', () => {
      const start = new Date('2026-09-30T14:00:00Z')
      const end = new Date('2026-09-30T15:00:00Z') // Ended early at 60m instead of 120m

      const addOns = [
        { name: 'Extra Remote', price: 60, pricingType: 'PER_HOUR', quantity: 1 },
        { name: 'Snack Combo', price: 100, pricingType: 'FIXED_CHARGE', quantity: 1 },
        { name: 'VR Headset Per Person', price: 50, pricingType: 'PER_PERSON', quantity: 1 }
      ]

      const bill = calculateSessionBill(120, start, end, 0, 0, addOns, 3) // party size 3

      expect(bill.durationMinutes).toBe(60)
      // PS5 for 60m: 120
      expect(bill.baseCharge).toBe(120)
      // Extra Remote (PER_HOUR for 60m): 60
      // Snack Combo (FIXED_CHARGE): 100
      // VR Headset (PER_PERSON for 3 people): 50 * 3 = 150
      // Add-ons charge: 60 + 100 + 150 = 310
      expect(bill.addOnsCharge).toBe(310)
      expect(bill.total).toBe(430)
    })
  })
})

describe('Customer Phone Normalization', () => {
  it('strips all non-digit formatting characters from phone numbers', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('919876543210')
    expect(normalizePhone('(080) 2345-6789')).toBe('08023456789')
    expect(normalizePhone('  98765 43210  ')).toBe('9876543210')
  })
})
