import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const passwordHash = await hash('demo1234', 12)

  // 1. Wipe all operational data to guarantee zero fake activity
  await db.payment.deleteMany({})
  await db.transaction.deleteMany({})
  await db.sessionAddOn.deleteMany({})
  await db.session.deleteMany({})
  await db.bookingAddOn.deleteMany({})
  await db.booking.deleteMany({})
  await db.waitlistEntry.deleteMany({})
  await db.customer.deleteMany({})
  await db.maintenanceBlock.deleteMany({})
  await db.auditLog.deleteMany({})

  // 2. Super Admin (Platform Owner)
  const admin = await db.user.upsert({
    where: { email: 'admin@parlour.local' },
    update: { passwordHash, role: 'SUPER_ADMIN' },
    create: {
      name: 'Platform Admin',
      email: 'admin@parlour.local',
      passwordHash,
      role: 'SUPER_ADMIN'
    }
  })

  // 3. Business: CUE CLUB
  const business = await db.business.upsert({
    where: { id: 'cue-club-biz' },
    update: {
      name: 'Cue Club',
      displayName: 'Cue Club Gaming & Billiards Lounge',
      phone: '9999990001',
      email: 'contact@cueclub.local',
      website: 'https://cueclub.local'
    },
    create: {
      id: 'cue-club-biz',
      name: 'Cue Club',
      displayName: 'Cue Club Gaming & Billiards Lounge',
      phone: '9999990001',
      email: 'contact@cueclub.local',
      website: 'https://cueclub.local'
    }
  })

  // 4. Owner: AMIT SHARMA
  const ownerA = await db.user.upsert({
    where: { email: 'owner.a@parlour.local' },
    update: { passwordHash, role: 'OWNER', name: 'Amit Sharma', phone: '9999990001' },
    create: {
      name: 'Amit Sharma',
      email: 'owner.a@parlour.local',
      phone: '9999990001',
      passwordHash,
      role: 'OWNER'
    }
  })

  // Link Owner to Business
  await db.business.update({
    where: { id: business.id },
    data: { ownerId: ownerA.id }
  })

  // 5. Exactly Two Branches for Cue Club
  const branchesConfig = [
    {
      id: 'seed-a',
      name: 'Cue Club — Branch 1',
      shortName: 'Branch 1',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452010',
      address: '102 Scheme 54, Vijay Nagar, Indore',
      phone: '9999990001',
      email: 'branch1@cueclub.local',
      openingTime: '10:00',
      closingTime: '02:00',
      currency: 'INR',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      coverImageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80',
      dashboardHeroUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80',
      ownerId: ownerA.id,
      businessId: business.id
    },
    {
      id: 'seed-b',
      name: 'Cue Club — Branch 2',
      shortName: 'Branch 2',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      address: 'Plot 45, AB Road, New Palasia, Indore',
      phone: '9999990002',
      email: 'branch2@cueclub.local',
      openingTime: '11:00',
      closingTime: '03:00',
      currency: 'INR',
      primaryColor: '#6366f1',
      secondaryColor: '#1e1b4b',
      coverImageUrl: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?auto=format&fit=crop&w=1200&q=80',
      dashboardHeroUrl: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?auto=format&fit=crop&w=1200&q=80',
      ownerId: ownerA.id,
      businessId: business.id
    }
  ]

  // Clean old venues other than seed-a and seed-b
  await db.venue.deleteMany({
    where: {
      id: { notIn: ['seed-a', 'seed-b'] }
    }
  })

  for (const b of branchesConfig) {
    const venue = await db.venue.upsert({
      where: { id: b.id },
      update: {
        businessId: b.businessId,
        name: b.name,
        shortName: b.shortName,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        address: b.address,
        phone: b.phone,
        email: b.email,
        openingTime: b.openingTime,
        closingTime: b.closingTime,
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        coverImageUrl: b.coverImageUrl,
        dashboardHeroUrl: b.dashboardHeroUrl,
        ownerId: b.ownerId
      },
      create: {
        id: b.id,
        businessId: b.businessId,
        name: b.name,
        shortName: b.shortName,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        address: b.address,
        phone: b.phone,
        email: b.email,
        openingTime: b.openingTime,
        closingTime: b.closingTime,
        currency: b.currency,
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        coverImageUrl: b.coverImageUrl,
        dashboardHeroUrl: b.dashboardHeroUrl,
        ownerId: b.ownerId
      }
    })

    // Set Owner's primary venueId to Branch 1
    if (b.id === 'seed-a') {
      await db.user.update({ where: { id: ownerA.id }, data: { venueId: venue.id } })
    }

    // 6. Resources & Categories (Realistic parlour resources)
    const categoriesConfig = [
      {
        name: 'PlayStation 5',
        description: 'Sony PS5 Next-Gen Consoles with 4K HDR displays',
        resources: [
          { name: 'PS5 Lounge 01', rate: 120, imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80' },
          { name: 'PS5 Lounge 02', rate: 120, imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80' }
        ]
      },
      {
        name: 'Snooker',
        description: 'Standard and Championship tournament snooker tables',
        resources: [
          { name: 'Snooker Table 01', rate: 400, imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=600&q=80' },
          { name: 'Snooker Table 02 (Championship)', rate: 500, imageUrl: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?auto=format&fit=crop&w=600&q=80' }
        ]
      },
      {
        name: 'Pool',
        description: 'American 8-ball and 9-ball billiard tables',
        resources: [
          { name: 'Pool Table 01', rate: 300, imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=600&q=80' }
        ]
      },
      {
        name: 'Gaming PC',
        description: 'High-FPS Esports Gaming Rigs with 240Hz monitors',
        resources: [
          { name: 'Gaming PC 01', rate: 100, imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80' }
        ]
      }
    ]

    for (const cat of categoriesConfig) {
      const category = await db.resourceCategory.upsert({
        where: { venueId_name: { venueId: venue.id, name: cat.name } },
        update: { description: cat.description },
        create: { venueId: venue.id, name: cat.name, description: cat.description }
      })

      for (const res of cat.resources) {
        const resource = await db.resource.upsert({
          where: { venueId_name: { venueId: venue.id, name: res.name } },
          update: { imageUrl: res.imageUrl, status: 'AVAILABLE', categoryId: category.id },
          create: {
            venueId: venue.id,
            categoryId: category.id,
            name: res.name,
            imageUrl: res.imageUrl,
            status: 'AVAILABLE'
          }
        })

        const existingRule = await db.pricingRule.findFirst({
          where: { venueId: venue.id, resourceId: resource.id }
        })

        if (!existingRule) {
          await db.pricingRule.create({
            data: {
              venueId: venue.id,
              resourceId: resource.id,
              unit: 'HOUR',
              rate: res.rate
            }
          })
        } else {
          await db.pricingRule.update({
            where: { id: existingRule.id },
            data: { rate: res.rate, unit: 'HOUR' }
          })
        }
      }
    }

    // 7. Generic Add-Ons for each branch
    const addOnsConfig = [
      {
        name: 'Extra Controller',
        description: 'Extra DualSense wireless controller for multiplayer',
        pricingType: 'PER_HOUR',
        price: 60,
        categoryName: 'PlayStation 5'
      },
      {
        name: 'Headset',
        description: 'Spatial audio noise-isolating gaming headset',
        pricingType: 'PER_HOUR',
        price: 30,
        categoryName: 'PlayStation 5'
      },
      {
        name: 'Premium Cue',
        description: 'Championship-grade Ash wood cue stick',
        pricingType: 'PER_SESSION',
        price: 100,
        categoryName: 'Snooker'
      }
    ]

    for (const addon of addOnsConfig) {
      const existingAddOn = await db.addOn.findFirst({
        where: { venueId: venue.id, name: addon.name }
      })

      if (existingAddOn) {
        await db.addOn.update({
          where: { id: existingAddOn.id },
          data: {
            description: addon.description,
            price: addon.price,
            pricingType: addon.pricingType,
            categoryName: addon.categoryName,
            active: true
          }
        })
      } else {
        await db.addOn.create({
          data: {
            venueId: venue.id,
            name: addon.name,
            description: addon.description,
            price: addon.price,
            pricingType: addon.pricingType,
            categoryName: addon.categoryName,
            active: true
          }
        })
      }
    }
  }

  console.log('✓ Database seeded successfully:')
  console.log('  - Business: Cue Club (1 business)')
  console.log('  - Owner: Amit Sharma (owner.a@parlour.local)')
  console.log('  - Branches: Cue Club — Branch 1 & Cue Club — Branch 2 (exactly 2 branches)')
  console.log('  - PS5: ₹120/hr, Extra Remote: ₹60/hr')
  console.log('  - Zero customers, zero bookings, zero sessions, zero payments, ₹0 revenue')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
