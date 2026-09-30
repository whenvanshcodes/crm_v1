import { describe, it, expect, beforeAll } from 'vitest'
import { storage, LocalStorageProvider } from '@/lib/storage'
import { db } from '@/lib/db'
import { createResource, updateResource, bulkCreateResources } from '@/lib/services/resource'
import { createParlourForOwner, updateVenueSettings } from '@/lib/services/venue'
import { POST as uploadPost } from '@/app/api/upload/route'
import fs from 'fs/promises'
import path from 'path'

describe('Optional Images & Storage Abstraction Architecture', () => {
  let testVenueId: string
  let testOwnerId: string

  const ownerCtx = {
    userId: '',
    venueId: '',
    name: 'Test Owner',
    role: 'OWNER' as const
  }

  beforeAll(async () => {
    // Find or create test venue and owner
    let venue = await db.venue.findFirst({
      where: { name: { contains: 'Cue Club' } },
      include: { owner: true }
    })

    if (!venue) {
      venue = await db.venue.create({
        data: {
          name: 'Image Test Parlour',
          phone: '9888888888',
          city: 'Indore'
        },
        include: { owner: true }
      })
    }

    testVenueId = venue.id
    testOwnerId = venue.ownerId || 'test-owner-id'
    ownerCtx.userId = testOwnerId
    ownerCtx.venueId = testVenueId
  })

  describe('1. Storage Abstraction (₹0 External Infrastructure)', () => {
    it('implements upload(), getUrl(), replace(), and delete() locally', async () => {
      const dummyBuffer = Buffer.from('fake-image-bytes-png')
      const uploaded = await storage.upload(
        {
          buffer: dummyBuffer,
          filename: 'test-icon.png',
          mimeType: 'image/png'
        },
        'resources'
      )

      expect(uploaded.url).toMatch(/^\/uploads\/resources\/.*\.png$/)
      expect(uploaded.key).toBeDefined()

      // getUrl test
      const resolvedUrl = storage.getUrl(uploaded.key)
      expect(resolvedUrl).toBe(uploaded.url)

      // replace test
      const replaceBuffer = Buffer.from('new-image-bytes-webp')
      const replaced = await storage.replace(
        uploaded.key,
        {
          buffer: replaceBuffer,
          filename: 'test-icon.webp',
          mimeType: 'image/webp'
        },
        'resources'
      )

      expect(replaced.url).toMatch(/^\/uploads\/resources\/.*\.webp$/)

      // delete test
      const deleteResult = await storage.delete(replaced.key)
      expect(deleteResult).toBe(true)
    })
  })

  describe('2. Resource Creation & Editing — Images 100% Optional', () => {
    it('creates resource without an image (Save works immediately)', async () => {
      const res = await createResource(ownerCtx, {
        name: `Test PS5 No Image ${Date.now()}`,
        categoryName: 'PS5',
        hourlyRate: 150
      })

      expect(res.id).toBeDefined()
      expect(res.imageUrl).toBeNull()
    })

    it('creates resource with optional image', async () => {
      const res = await createResource(ownerCtx, {
        name: `Test PS5 With Image ${Date.now()}`,
        categoryName: 'PS5',
        hourlyRate: 150,
        imageUrl: '/uploads/resources/sample.webp'
      })

      expect(res.id).toBeDefined()
      expect(res.imageUrl).toBe('/uploads/resources/sample.webp')
    })

    it('allows adding, changing, and removing image on existing resource', async () => {
      const initial = await createResource(ownerCtx, {
        name: `Editable Resource ${Date.now()}`,
        categoryName: 'Gaming',
        hourlyRate: 120
      })
      expect(initial.imageUrl).toBeNull()

      // Add image
      const withImg = await updateResource(ownerCtx, initial.id, {
        imageUrl: '/uploads/resources/v1.png'
      })
      expect(withImg.imageUrl).toBe('/uploads/resources/v1.png')

      // Change image
      const changed = await updateResource(ownerCtx, initial.id, {
        imageUrl: '/uploads/resources/v2.webp'
      })
      expect(changed.imageUrl).toBe('/uploads/resources/v2.webp')

      // Remove image (pass empty string or null)
      const removed = await updateResource(ownerCtx, initial.id, {
        imageUrl: ''
      })
      expect(removed.imageUrl).toBeNull()
    })

    it('bulk resource creation functions completely without images', async () => {
      const prefix = `Bulk NoImg ${Date.now().toString().slice(-4)}`
      const resources = await bulkCreateResources(ownerCtx, {
        namePrefix: prefix,
        categoryName: 'PS5',
        quantity: 3,
        hourlyRate: 120
      })

      expect(resources).toHaveLength(3)
      for (const r of resources) {
        expect(r.imageUrl).toBeNull()
      }
    })

    it('bulk resource creation optionally applies a shared image', async () => {
      const prefix = `Bulk WithImg ${Date.now().toString().slice(-4)}`
      const sharedUrl = '/uploads/resources/shared-ps5.webp'
      const resources = await bulkCreateResources(ownerCtx, {
        namePrefix: prefix,
        categoryName: 'PS5',
        quantity: 2,
        hourlyRate: 120,
        imageUrl: sharedUrl
      })

      expect(resources).toHaveLength(2)
      for (const r of resources) {
        expect(r.imageUrl).toBe(sharedUrl)
      }
    })
  })

  describe('3. Parlour & Branch Setup — Zero Image Requirement', () => {
    it('creates parlour without requiring any image', async () => {
      const parlour = await createParlourForOwner(ownerCtx, {
        name: `No Image Parlour ${Date.now()}`,
        phone: '9988776655',
        city: 'Indore'
      })

      expect(parlour.id).toBeDefined()
      expect(parlour.coverImageUrl).toBeNull()
      expect(parlour.logoUrl).toBeNull()
    })

    it('allows updating branding with logo and banner, or clearing them', async () => {
      const updated = await updateVenueSettings(
        ownerCtx,
        {
          logoUrl: '/uploads/parlours/my-logo.png',
          coverImageUrl: '/uploads/parlours/my-cover.webp'
        },
        testVenueId
      )

      expect(updated.logoUrl).toBe('/uploads/parlours/my-logo.png')
      expect(updated.coverImageUrl).toBe('/uploads/parlours/my-cover.webp')

      // Clearing images
      const cleared = await updateVenueSettings(
        ownerCtx,
        {
          logoUrl: '',
          coverImageUrl: ''
        },
        testVenueId
      )

      expect(cleared.logoUrl).toBeNull()
      expect(cleared.coverImageUrl).toBeNull()
    })
  })

  describe('4. Image Upload API Endpoint Validation', () => {
    it('rejects uploads with invalid MIME types (e.g. text or executable)', async () => {
      const formData = new FormData()
      const dummyFile = new File(['plain text'], 'document.txt', { type: 'text/plain' })
      formData.append('file', dummyFile)

      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const res = await uploadPost(request)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('Invalid format')
    })

    it('rejects uploads exceeding 5MB', async () => {
      // 6MB buffer simulation
      const largeBuffer = new Uint8Array(6 * 1024 * 1024)
      const largeFile = new File([largeBuffer], 'large.png', { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', largeFile)

      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const res = await uploadPost(request)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toContain('5MB')
    })

    it('accepts valid PNG, JPG, or WEBP under 5MB', async () => {
      const validFile = new File(['valid-image-bytes'], 'avatar.webp', { type: 'image/webp' })
      const formData = new FormData()
      formData.append('file', validFile)
      formData.append('folder', 'profiles')

      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const res = await uploadPost(request)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.url).toMatch(/^\/uploads\/profiles\/.*\.webp$/)
    })
  })
})
