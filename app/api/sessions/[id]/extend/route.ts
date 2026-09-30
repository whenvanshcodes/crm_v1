import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { extendSession, getMaxAvailableExtension } from '@/lib/services/session'
import { apiError } from '@/lib/http'

const extendInput = z.object({
  minutes: z.coerce.number().min(1).default(60)
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    const { id } = await params
    const info = await getMaxAvailableExtension(c, id)
    return NextResponse.json(info)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'])
    const { id } = await params
    let minutes = 60
    try {
      const body = await request.json()
      const parsed = extendInput.safeParse(body)
      if (parsed.success) minutes = parsed.data.minutes
    } catch {
      // Body is empty or optional, default to 60 minutes
    }
    const session = await extendSession(c, id, minutes)
    return NextResponse.json(session)
  } catch (error: any) {
    if (error.message && error.message.startsWith('CONFLICT:')) {
      return NextResponse.json(
        { error: 'EXTENSION_CONFLICT', message: error.message },
        { status: 409 }
      )
    }
    return apiError(error)
  }
}
