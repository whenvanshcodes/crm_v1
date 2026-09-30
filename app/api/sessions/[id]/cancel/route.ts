import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { cancelSession } from '@/lib/services/session'
import { apiError } from '@/lib/http'

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const { id } = await params
    const session = await cancelSession(c, id)
    return NextResponse.json(session)
  } catch (error) {
    return apiError(error)
  }
}
