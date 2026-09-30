'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'

interface ResourceItem {
  id: string
  name: string
  status: string
  rate: number
}

interface CalendarClientProps {
  resources: ResourceItem[]
  activeSessions: {
    id: string
    resourceName: string
    customerName: string
    startedAt: string
    expectedEndAt?: string
  }[]
  bookings: {
    id: string
    resourceId: string
    resourceName: string
    customerName: string
    startTime: string
    endTime: string
    status: string
  }[]
  customers: { id: string; name: string; phone: string }[]
}

// Grid covers 10:00 – 02:00 (+1 day) = 16 hours
const GRID_START_HOUR = 10
const GRID_TOTAL_HOURS = 16
const HOUR_COLS = Array.from({ length: GRID_TOTAL_HOURS + 1 }, (_, i) => (GRID_START_HOUR + i) % 24)

function timeToGridPct(dateStr: string, refDay: Date): number {
  const t = new Date(dateStr)
  const minutesSinceStart =
    (t.getHours() * 60 + t.getMinutes()) -
    (GRID_START_HOUR * 60)
  // Handle past-midnight times (e.g. 00:00 = 24*60 minutes from day start when grid starts at 10)
  const adj = minutesSinceStart < -GRID_START_HOUR * 60 / 2
    ? minutesSinceStart + 24 * 60
    : minutesSinceStart
  return Math.max(0, Math.min(100, (adj / (GRID_TOTAL_HOURS * 60)) * 100))
}

function durationToWidthPct(startStr: string, endStr: string): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const mins = Math.max(15, (end.getTime() - start.getTime()) / 60000)
  return Math.min(95, (mins / (GRID_TOTAL_HOURS * 60)) * 100)
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function CalendarClient({
  resources,
  activeSessions,
  bookings,
  customers
}: CalendarClientProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [now, setNow] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '')
  const [selectedResourceId, setSelectedResourceId] = useState(resources[0]?.id || '')
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  )
  const [endTime, setEndTime] = useState(
    new Date(Date.now() + 7200000).toISOString().slice(0, 16)
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tick every 30s to update current-time indicator
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const isToday = sameDay(viewDate, new Date())
  const nowPct = isToday ? timeToGridPct(now.toISOString(), viewDate) : -1

  const phoneMatch = customers.find(
    (c) => phone.replace(/\D/g, '').length >= 6 && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
  )

  function prevDay() {
    setViewDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }
  function nextDay() {
    setViewDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }
  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); setViewDate(d)
  }

  // Filter bookings for the viewed day
  const dayBookings = bookings.filter((b) => {
    const bDate = new Date(b.startTime)
    return sameDay(bDate, viewDate) &&
      (b.status === 'CONFIRMED' || b.status === 'SCHEDULED' || b.status === 'ARRIVED')
  })

  // Active sessions are always "today"
  const dayActiveSessions = isToday ? activeSessions : []

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      let customerId = selectedCustomerId
      if (phoneMatch) {
        customerId = phoneMatch.id
      } else if (phone && customerName) {
        const custRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: customerName, phone })
        })
        const custData = await custRes.json()
        if (!custRes.ok) throw new Error(custData.error || 'Failed to create customer')
        customerId = custData.id
      }

      if (!customerId) throw new Error('Please select or create a customer')

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          resourceId: selectedResourceId,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          notes: notes || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const dayLabel = viewDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <>
      <div className="panel calendar-panel">
        {/* Date Navigation */}
        <div
          className="panel-head"
          style={{ borderBottom: '1px solid #f0eff4', paddingBottom: 14, marginBottom: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="icon-button" onClick={prevDay} title="Previous day">
              <ChevronLeft size={16} />
            </button>
            <div>
              <h2 style={{ margin: 0 }}>
                {isToday ? 'Today — ' : ''}{dayLabel}
              </h2>
              <p style={{ margin: 0 }}>
                Floor timeline · {GRID_START_HOUR}:00 to {(GRID_START_HOUR + GRID_TOTAL_HOURS) % 24 || GRID_START_HOUR + GRID_TOTAL_HOURS}:00
              </p>
            </div>
            <button className="icon-button" onClick={nextDay} title="Next day">
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button className="secondary" style={{ fontSize: 11, padding: '4px 10px', height: 30 }} onClick={goToday}>
                Go to Today
              </button>
            )}
          </div>
          <button className="primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Booking
          </button>
        </div>

        {/* Timeline Grid */}
        <div
          style={{
            overflowX: 'auto',
            marginTop: 0
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `120px repeat(${GRID_TOTAL_HOURS}, minmax(56px, 1fr))`,
              minWidth: 900
            }}
          >
            {/* Header row */}
            <div
              style={{
                padding: '8px 10px',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--text-secondary, #94a3b8)',
                background: 'var(--panel-subtle, #11151e)',
                borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRight: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
              }}
            >
              RESOURCE
            </div>
            {HOUR_COLS.slice(0, GRID_TOTAL_HOURS).map((h) => (
              <div
                key={h}
                style={{
                  padding: '8px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: h === now.getHours() && isToday ? 'var(--primary-accent, #7c5cff)' : 'var(--text-secondary, #94a3b8)',
                  background: 'var(--panel-subtle, #11151e)',
                  borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRight: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))',
                  textAlign: 'center'
                }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}

            {/* Resource rows */}
            {resources.map((r) => {
              const rSessions = dayActiveSessions.filter((s) => s.resourceName === r.name)
              const rBookings = dayBookings.filter((b) => b.resourceName === r.name)

              return (
                <React.Fragment key={r.id}>
                  {/* Resource label cell */}
                  <div
                    style={{
                      padding: '10px',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      borderRight: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      background: 'var(--panel-bg, #0d1017)',
                      color: 'var(--text-primary, #f8fafc)'
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background:
                          r.status === 'OCCUPIED' ? '#ef4444'
                          : r.status === 'AVAILABLE' ? '#22c55e'
                          : r.status === 'MAINTENANCE' ? '#f59e0b'
                          : '#64748b',
                        boxShadow: r.status === 'AVAILABLE' ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none'
                      }}
                    />
                    <span style={{ lineHeight: 1.2 }}>{r.name}</span>
                  </div>

                  {/* Timeline track spanning all hour columns */}
                  <div
                    style={{
                      gridColumn: `span ${GRID_TOTAL_HOURS}`,
                      position: 'relative',
                      height: 52,
                      borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      background: r.status === 'MAINTENANCE' ? 'rgba(245, 158, 11, 0.08)' : 'var(--panel-bg, #0d1017)'
                    }}
                  >
                    {/* Hour column separators */}
                    {HOUR_COLS.slice(0, GRID_TOTAL_HOURS).map((h, i) => (
                      <div
                        key={h}
                        style={{
                          position: 'absolute',
                          left: `${(i / GRID_TOTAL_HOURS) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: 'var(--border-color, rgba(255, 255, 255, 0.05))'
                        }}
                      />
                    ))}

                    {/* Current time indicator */}
                    {nowPct >= 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${nowPct}%`,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: '#ef4444',
                          zIndex: 10,
                          opacity: 0.6
                        }}
                      />
                    )}

                    {/* Maintenance overlay */}
                    {r.status === 'MAINTENANCE' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 4,
                          background: '#fef3c7',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#92400e',
                          gap: 5
                        }}
                      >
                        🔧 Maintenance
                      </div>
                    )}

                    {/* Active sessions (live, red) */}
                    {rSessions.map((s) => {
                      const leftPct = timeToGridPct(s.startedAt, viewDate)
                      const endStr = s.expectedEndAt || new Date(Date.now() + 3600000).toISOString()
                      const widthPct = durationToWidthPct(s.startedAt, endStr)
                      return (
                        <Link
                          key={s.id}
                          href={`/sessions/${s.id}`}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: 6,
                            bottom: 6,
                            background: 'rgba(239, 68, 68, 0.16)',
                            border: '1.5px solid rgba(239, 68, 68, 0.4)',
                            boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)',
                            borderRadius: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingLeft: 8,
                            overflow: 'hidden',
                            textDecoration: 'none',
                            zIndex: 2
                          }}
                          title={`LIVE: ${s.customerName}`}
                        >
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ● {s.customerName}
                          </span>
                          <span style={{ fontSize: 9, color: '#fca5a5' }}>Live</span>
                        </Link>
                      )
                    })}

                    {/* Scheduled/confirmed bookings (blue/purple) */}
                    {rBookings.map((b) => {
                      const leftPct = timeToGridPct(b.startTime, viewDate)
                      const widthPct = durationToWidthPct(b.startTime, b.endTime)
                      const isArrived = b.status === 'ARRIVED'
                      return (
                        <Link
                          key={b.id}
                          href={`/bookings/${b.id}`}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: 6,
                            bottom: 6,
                            background: isArrived ? 'rgba(34, 197, 94, 0.16)' : 'rgba(124, 92, 255, 0.16)',
                            border: isArrived ? '1.5px solid rgba(34, 197, 94, 0.4)' : '1.5px solid rgba(124, 92, 255, 0.4)',
                            boxShadow: isArrived ? '0 0 10px rgba(34, 197, 94, 0.15)' : '0 0 10px rgba(124, 92, 255, 0.2)',
                            borderRadius: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingLeft: 8,
                            overflow: 'hidden',
                            textDecoration: 'none',
                            zIndex: 2
                          }}
                          title={`${b.status}: ${b.customerName} — ${new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isArrived ? '#4ade80' : '#c4b5fd',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {b.customerName}
                          </span>
                          <span style={{ fontSize: 9, color: isArrived ? '#86efac' : 'var(--primary-accent, #7c5cff)' }}>
                            {new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </Link>
                      )
                    })}

                    {/* Empty state for available rows with no activity */}
                    {rSessions.length === 0 && rBookings.length === 0 && r.status === 'AVAILABLE' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: '10px 0',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 12,
                          fontSize: 10,
                          color: '#ccc',
                          fontStyle: 'italic'
                        }}
                      >
                        Available
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            padding: '10px 14px',
            borderTop: '1px solid #f0eff4',
            marginTop: 0,
            fontSize: 11,
            color: '#666'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fca5a5', border: '1px solid #fca5a5' }} />
            Live session
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#c4b5fd', border: '1px solid #c4b5fd' }} />
            Confirmed booking
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#86efac', border: '1px solid #86efac' }} />
            Customer arrived
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef3c7', border: '1px solid #fcd34d' }} />
            Maintenance
          </span>
          {isToday && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 2, height: 12, background: '#ef4444', opacity: 0.6 }} />
              Now
            </span>
          )}
        </div>

        {/* Summary bar: bookings count for viewed day */}
        <div
          style={{
            padding: '8px 14px',
            background: '#f9f9fb',
            borderTop: '1px solid #f0eff4',
            fontSize: 12,
            color: '#666',
            display: 'flex',
            gap: 16
          }}
        >
          <span>
            <b style={{ color: '#222' }}>{dayActiveSessions.length}</b> active sessions
          </span>
          <span>
            <b style={{ color: '#222' }}>{dayBookings.length}</b> bookings scheduled
          </span>
          <span>
            <b style={{ color: '#222' }}>{resources.filter(r => r.status === 'AVAILABLE').length}</b> resources available
          </span>
        </div>
      </div>

      {/* New Booking Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">SCHEDULING</div>
                <h2>New Booking</h2>
              </div>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateBooking}>
              <p>Reserve an available resource for an existing or new customer.</p>

              {error && (
                <div
                  className="toast"
                  style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}
                >
                  {error}
                </div>
              )}

              <label>
                Customer Phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </label>

              {phoneMatch ? (
                <div className="modal-note">
                  <span>
                    Existing customer: <b>{phoneMatch.name}</b> ({phoneMatch.phone})
                  </span>
                </div>
              ) : phone ? (
                <label>
                  Customer Name
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    placeholder="Full name for this new customer"
                  />
                </label>
              ) : (
                <label>
                  Or Select Customer
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Resource
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id} disabled={r.status === 'MAINTENANCE'}>
                      {r.name} · ₹{r.rate}/hr{r.status === 'MAINTENANCE' ? ' (Maintenance)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-two">
                <label>
                  Start Time
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </label>
                <label>
                  End Time
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label>
                Notes (Optional)
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special requests or table preferences"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <CalendarDays size={15} />
                  <span>{isSubmitting ? 'Confirming...' : 'Confirm Booking'}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
