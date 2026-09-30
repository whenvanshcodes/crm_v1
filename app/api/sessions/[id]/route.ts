import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { getSession } from '@/lib/services/session'
import { apiError } from '@/lib/http'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext()
    const { id } = await params
    const session = await getSession(c.venueId!, id)
    return NextResponse.json(session)
  } catch (error) {
    return apiError(error)
  }
}
