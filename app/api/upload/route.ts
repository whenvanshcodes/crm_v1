import { NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { apiError } from '@/lib/http'

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
])

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'general'
    const replaceKey = (formData.get('replaceKey') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid format. Allowed formats: PNG, JPG, JPEG, WEBP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 5MB' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let result
    if (replaceKey) {
      result = await storage.replace(replaceKey, {
        buffer,
        filename: file.name,
        mimeType: file.type
      }, folder)
    } else {
      result = await storage.upload({
        buffer,
        filename: file.name,
        mimeType: file.type
      }, folder)
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key') || searchParams.get('url') || ''

    if (key) {
      await storage.delete(key)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
