import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { customerInput } from '@/lib/validation/customers'
import {
  listCustomers,
  createOrGetCustomer,
  getCustomerWithInsights
} from '@/lib/services/customer'
import { apiError } from '@/lib/http'

export async function GET(request: Request) {
  try {
    const c = await requireContext(undefined, request)
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone')
    const withInsights = url.searchParams.get('insights') === 'true'

    if (phone && withInsights) {
      const insightData = await getCustomerWithInsights(c.venueId!, phone)
      return NextResponse.json(insightData)
    }

    const search = url.searchParams.get('search') || phone || undefined
    const customers = await listCustomers(c.venueId!, search)
    return NextResponse.json(customers)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const c = await requireContext(['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'], request)
    const input = customerInput.parse(await request.json())
    const customer = await createOrGetCustomer(c, {
      name: input.name,
      phone: input.phone
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
