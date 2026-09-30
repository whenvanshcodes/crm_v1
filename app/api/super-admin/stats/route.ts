import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { getSuperAdminOverview } from '@/lib/services/venue'
import { apiError } from '@/lib/http'

export async function GET(request: Request) {
  try {
    await requireContext(['SUPER_ADMIN'])
    const { searchParams } = new URL(request.url)
    const venueId = searchParams.get('venueId') || undefined
    const stats = await getSuperAdminOverview(venueId)
    return NextResponse.json(stats)
  } catch (error) {
    return apiError(error)
  }
}
