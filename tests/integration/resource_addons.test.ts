import { describe, it, expect, beforeAll } from 'vitest'
import { db } from '@/lib/db'
import { createAddOn, listAddOns, updateAddOn } from '@/lib/services/addon'
import { createResource, listResources } from '@/lib/services/resource'
import type { LocalContext } from '@/lib/auth/local'

describe('Resource Direct Add-ons Management', () => {
  let ctx: LocalContext
  let venueId: string

  beforeAll(async () => {
    // Find an active venue or owner
    const venue = await db.venue.findFirst({
      where: { status: 'ACTIVE' },
      include: { owner: true }
    })

    if (!venue) {
      throw new Error('No active venue found for testing')
    }

    venueId = venue.id
    ctx = {
      userId: venue.ownerId || 'test-user',
      role: 'OWNER',
      venueId: venue.id,
      venueName: venue.name,
      businessId: venue.businessId || undefined
    }
  })

  const runId = Date.now()
  const categoryName = `PS5-AddOn-${runId}`

  it('1. Creates a resource and attaches add-ons directly for its category', async () => {
    // Create a new resource in this category
    const resource = await createResource(ctx, {
      name: `PS5 Unit ${runId}`,
      categoryName,
      hourlyRate: 150
    })

    expect(resource).toBeDefined()
    expect(resource.name).toBe(`PS5 Unit ${runId}`)

    // Initially no add-ons for this category
    const initialAddOns = await listAddOns(venueId, categoryName)
    const matchingInitial = initialAddOns.filter((a) => a.categoryName === categoryName)
    expect(matchingInitial.length).toBe(0)

    // Add-on 1: Extra Controller (PER_HOUR)
    const addon1 = await createAddOn(ctx, {
      name: 'Extra DualSense Controller',
      price: 60,
      pricingType: 'PER_HOUR',
      categoryName
    })

    expect(addon1.name).toBe('Extra DualSense Controller')
    expect(addon1.price).toBe(60)
    expect(addon1.pricingType).toBe('PER_HOUR')
    expect(addon1.categoryName).toBe(categoryName)

    // Add-on 2: Pulse 3D Headset (PER_SESSION)
    const addon2 = await createAddOn(ctx, {
      name: 'Pulse 3D Wireless Headset',
      price: 50,
      pricingType: 'PER_SESSION',
      categoryName
    })

    expect(addon2.pricingType).toBe('PER_SESSION')

    // Add-on 3: VR 2 Headset (FIXED_CHARGE)
    const addon3 = await createAddOn(ctx, {
      name: 'PS VR2 Headset',
      price: 120,
      pricingType: 'FIXED_CHARGE',
      categoryName
    })

    expect(addon3.pricingType).toBe('FIXED_CHARGE')

    // Add-on 4: Tournament Entry (PER_PERSON)
    const addon4 = await createAddOn(ctx, {
      name: 'Tournament Pass',
      price: 100,
      pricingType: 'PER_PERSON',
      categoryName
    })

    expect(addon4.pricingType).toBe('PER_PERSON')

    // Verify all 4 add-ons appear when querying for this resource's category
    const categoryAddOns = await listAddOns(venueId, categoryName)
    const filteredForCat = categoryAddOns.filter((a) => a.categoryName === categoryName)
    expect(filteredForCat.length).toBe(4)
  })

  it('2. Deactivates an add-on from a resource', async () => {
    const addOns = await listAddOns(venueId, categoryName)
    const target = addOns.find((a) => a.categoryName === categoryName && a.name === 'PS VR2 Headset')
    expect(target).toBeDefined()

    // Deactivate
    const updated = await updateAddOn(ctx, target!.id, { active: false })
    expect(updated.active).toBe(false)

    // Check listAddOns excludes deactivated add-on
    const activeList = await listAddOns(venueId, categoryName)
    expect(activeList.some((a) => a.id === target!.id)).toBe(false)
  })
})
