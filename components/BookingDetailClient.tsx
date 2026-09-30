'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Play,
  Ban,
  Check,
  Clock3
} from 'lucide-react'

interface BookingDetailClientProps {
  booking: {
    id: string
    status: string
    startTime: string
    endTime: string
    notes?: string | null
    priceEstimate?: number | null
    createdAt: string
    customer: { id: string; name: string; phone: string }
    resource: { id: string; name: string }
  }
}

export default function BookingDetailClient({ booking: initialBooking }: BookingDetailClientProps) {
  const [booking, setBooking] = useState(initialBooking)
  const [notice, setNotice] = useState('')

  async function handleStartSession() {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: booking.customer.id,
          resourceId: booking.resource.id,
          bookingId: booking.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start session')

      window.location.assign(`/sessions/${data.id}`)
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Could not start session')
    }
  }

  async function handleUpdateStatus(status: string) {
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      setNotice(`Booking status updated to ${status}`)
      setBooking((prev) => ({ ...prev, status }))
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <>
      <div className="dashboard-grid" style={{ maxWidth: '850px' }}>
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head">
            <div>
              <h2>Reservation Details</h2>
              <p>ID: {booking.id}</p>
            </div>
            <span className={`status-pill ${booking.status.toLowerCase()}`}>
              {booking.status}
            </span>
          </div>

          <div className="bill-summary" style={{ marginTop: '16px' }}>
            <div>
              <span>Customer</span>
              <b>
                <Link href={`/customers/${booking.customer.id}`}>
                  {booking.customer.name} ({booking.customer.phone})
                </Link>
              </b>
            </div>
            <div>
              <span>Resource</span>
              <b>
                <Link href={`/resources`}>{booking.resource.name}</Link>
              </b>
            </div>
            <div>
              <span>Start Time</span>
              <b>{new Date(booking.startTime).toLocaleString('en-IN')}</b>
            </div>
            <div>
              <span>End Time</span>
              <b>{new Date(booking.endTime).toLocaleString('en-IN')}</b>
            </div>
            <div>
              <span>Created On</span>
              <b>{new Date(booking.createdAt).toLocaleString('en-IN')}</b>
            </div>
            {booking.notes && (
              <div>
                <span>Notes</span>
                <b>{booking.notes}</b>
              </div>
            )}
          </div>

          {booking.status === 'CONFIRMED' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
              <button className="primary" onClick={handleStartSession}>
                <Play size={15} /> Check-in & Start Session
              </button>
              <button
                className="secondary"
                onClick={() => handleUpdateStatus('NO_SHOW')}
              >
                Mark as No-Show
              </button>
              <button
                className="danger"
                onClick={() => handleUpdateStatus('CANCELLED')}
              >
                <Ban size={15} /> Cancel Booking
              </button>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="toast">
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}
    </>
  )
}
