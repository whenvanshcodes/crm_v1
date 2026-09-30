import { NextRequest, NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { getVenueReports, getVenueReportsByDays } from '@/lib/services/report'
import { apiError } from '@/lib/http'

export async function GET(req: NextRequest) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST'])
    const daysParam = req.nextUrl.searchParams.get('days')
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 7, 1), 365) : 7
    const reports = days === 7
      ? await getVenueReports(c.venueId!)
      : await getVenueReportsByDays(c.venueId!, days)
    return NextResponse.json(reports)
  } catch (error) {
    return apiError(error)
  }
}
