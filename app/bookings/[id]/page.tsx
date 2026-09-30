import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAppContext } from '@/lib/auth/context'
import { getBooking } from '@/lib/services/booking'
import AppShell from '@/components/AppShell'
import BookingDetailClient from '@/components/BookingDetailClient'

export const dynamic = 'force-dynamic'

export default async function BookingDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  let ctx
  try {
    ctx = await getAppContext()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  let booking
  try {
    booking = await getBooking(ctx.venueId!, id)
  } catch {
    notFound()
  }

  return (
    <AppShell
      user={ctx}
      title={`Booking · ${booking.resource.name}`}
      subtitle={`Customer: ${booking.customer.name}`}
      headerAction={
        <Link href="/bookings" className="secondary">
          ← Back to Bookings
        </Link>
      }
    >
      <BookingDetailClient
        booking={{
          ...booking,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          createdAt: booking.createdAt.toISOString()
        }}
      />
    </AppShell>
  )
}
