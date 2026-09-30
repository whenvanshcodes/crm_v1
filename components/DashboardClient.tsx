'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import StartWalkInModal, { WalkInResource, WalkInAddOn, WalkInCustomer } from './StartWalkInModal'
import SimpleEndSessionModal, { SimpleSessionData } from './SimpleEndSessionModal'
import ExtendSessionModal from './ExtendSessionModal'

export interface ResourceItem {
  id: string
  name: string
  status: string
  category?: { name: string } | null
  pricingRules?: { rate: number; active: boolean }[]
}

export interface ActiveSessionItem {
  id: string
  startedAt: string
  expectedEndAt?: string | null
  partySize?: number
  customer: { id: string; name: string; phone: string }
  resource: { id: string; name: string }
  pricingRule: { rate: number }
  addOns?: Array<{ addOn: { name: string; price: number; pricingType: string }; quantity: number }>
}

export interface UpcomingBookingItem {
  id: string
  startTime: string
  endTime: string
  status: string
  customer: { name: string; phone?: string }
  resource: { name: string }
  partySize?: number
}

export interface AttentionAlerts {
  overtime: Array<{
    id: string
    resourceName: string
    customerName: string
    overtimeMinutes: number
  }>
  endingSoon: Array<{
    id: string
    resourceName: string
    customerName: string
    minutesLeft: number
  }>
  startingSoon: Array<{
    id: string
    resourceName: string
    customerName: string
    minutesUntilStart: number
  }>
  maintenance: Array<{
    id: string
    name: string
    status: string
  }>
}

interface DashboardClientProps {
  venueInfo: {
    name: string
    shortName?: string | null
    city?: string | null
    primaryColor?: string | null
  }
  userName: string
  metrics: {
    todayRevenue: number
    activeSessionsCount: number
    todaySessionsCount: number
    todayCustomersCount: number
    availableResourcesCount: number
    totalResourcesCount: number
    upcomingBookingsCount: number
  }
  activeSessions: ActiveSessionItem[]
  resources: ResourceItem[]
  upcomingBookings: UpcomingBookingItem[]
  attentionAlerts?: AttentionAlerts
  addOns?: any[]
  initialCustomers?: any[]
}

export default function DashboardClient({
  venueInfo,
  metrics: initialMetrics,
  activeSessions: initialActiveSessions,
  resources,
  upcomingBookings,
  attentionAlerts,
  addOns = [],
  initialCustomers = []
}: DashboardClientProps) {
  const [now, setNow] = useState(Date.now())
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [endModalSession, setEndModalSession] = useState<ActiveSessionItem | null>(null)
  const [extendTarget, setExtendTarget] = useState<ActiveSessionItem | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>(initialActiveSessions)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  // Sync initial sessions
  useEffect(() => {
    setActiveSessions(initialActiveSessions)
  }, [initialActiveSessions])

  const walkInResources = React.useMemo(
    () =>
      resources.map((r) => ({
        id: r.id,
        name: r.name,
        rate: r.pricingRules?.[0]?.rate || 120,
        status: r.status,
        categoryName: r.category?.name || null
      })),
    [resources]
  )

  // Update timer every 1 second for smooth precision clock
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  function formatDurationMinutes(startedAt: string): string {
    const elapsedMinutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000))
    const hours = Math.floor(elapsedMinutes / 60)
    const mins = elapsedMinutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }

  function formatDigitalTimer(startedAt: string): string {
    const elapsedSec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    const hrs = Math.floor(elapsedSec / 3600)
    const mins = Math.floor((elapsedSec % 3600) / 60)
    const secs = elapsedSec % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function formatRemainingTime(expectedEndAt?: string | null): { text: string; isOvertime: boolean } {
    if (!expectedEndAt) return { text: 'Running', isOvertime: false }
    const endMs = new Date(expectedEndAt).getTime()
    const diffMinutes = Math.round((endMs - now) / 60000)
    if (diffMinutes < 0) {
      return { text: `${Math.abs(diffMinutes)} min over`, isOvertime: true }
    }
    return { text: `${diffMinutes} min left`, isOvertime: false }
  }

  function calculateRunningAmount(session: ActiveSessionItem): number {
    const startMs = new Date(session.startedAt).getTime()
    const elapsedMinutes = Math.max(1, Math.ceil((now - startMs) / 60000))
    const baseRate = session.pricingRule?.rate || 120
    let totalHourlyRate = baseRate

    if (session.addOns && session.addOns.length > 0) {
      for (const a of session.addOns) {
        if (a.addOn.pricingType === 'PER_HOUR') {
          totalHourlyRate += a.addOn.price * (a.quantity || 1)
        }
      }
    }

    return Math.round((elapsedMinutes * totalHourlyRate) / 60)
  }

  // Quick Multi-Option Extension (+15m, +30m, +60m)
  async function handleQuickExtend(session: ActiveSessionItem, minutes: number = 30) {
    setExtendingId(session.id)
    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setNotice(`⚠️ ${err.message || 'Cannot extend session.'}`)
        return
      }

      const updated = await res.json()
      setActiveSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, expectedEndAt: updated.expectedEndAt } : s))
      )
      setNotice(`✓ +${minutes}m added for ${session.customer.name}!`)
    } catch {
      setNotice('⚠️ Failed to extend session.')
    } finally {
      setExtendingId(null)
    }
  }

  // Map resources to operational status
  const resourceStatuses = resources.map((res) => {
    const active = activeSessions.find((s) => s.resource.id === res.id)
    if (active) {
      return {
        ...res,
        state: 'PLAYING',
        statusLabel: 'Playing',
        dot: '🔴'
      }
    }

    if (res.status === 'MAINTENANCE' || res.status === 'DISABLED') {
      return {
        ...res,
        state: 'MAINTENANCE',
        statusLabel: 'Maintenance',
        dot: '🔧'
      }
    }

    const nextBooking = upcomingBookings.find((b) => b.resource.name === res.name)
    if (nextBooking) {
      return {
        ...res,
        state: 'UPCOMING',
        statusLabel: formatTime(nextBooking.startTime),
        dot: '🟡'
      }
    }

    return {
      ...res,
      state: 'AVAILABLE',
      statusLabel: 'Free',
      dot: '🟢'
    }
  })

  const totalAlerts =
    (attentionAlerts?.overtime.length || 0) +
    (attentionAlerts?.endingSoon.length || 0) +
    (attentionAlerts?.startingSoon.length || 0) +
    (attentionAlerts?.maintenance.length || 0)

  // Empty state: No resources set up
  if (resources.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '40px 20px' }}>
        <h2 style={{ font: '900 24px Manrope', marginBottom: 8 }}>Set up your resources</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
          Add your first gaming console, PC, or table to start running sessions.
        </p>
        <Link
          href="/resources"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#10b981',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            fontWeight: 800,
            textDecoration: 'none',
            fontSize: 14
          }}
        >
          <Plus size={16} /> + Add Resource
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            padding: '10px 16px',
            background: notice.startsWith('⚠️') ? '#fef3c7' : '#dcfce7',
            color: notice.startsWith('⚠️') ? '#92400e' : '#166534',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ========================================================
          1. HEADER: CUE CLUB / Branch 1  [ + START ]
          ======================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border-color, #e2e8f0)'
        }}
      >
        <div>
          <div
            style={{
              font: '900 22px Manrope',
              color: 'var(--text-primary, #0f172a)',
              letterSpacing: '-0.02em'
            }}
          >
            {venueInfo.name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
            {venueInfo.shortName || venueInfo.city || 'Counter'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/bookings?new=booking"
            style={{
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary, #f8fafc)',
              textDecoration: 'none',
              background: 'var(--panel-subtle, #11151e)'
            }}
          >
            + Booking
          </Link>

          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Plus size={16} />
            <span>+ START</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. TODAY SUMMARY: 4 CLEAN NUMBERS ONLY
          ======================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12
        }}
      >
        <div
          style={{
            background: 'var(--panel-bg, #0d1017)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            Revenue
          </div>
          <div style={{ font: '900 24px Manrope', color: '#4ade80', textShadow: '0 0 16px rgba(74, 222, 128, 0.2)', marginTop: 4 }}>
            ₹{Math.round(metrics.todayRevenue).toLocaleString('en-IN')}
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel-bg, #0d1017)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            Sessions
          </div>
          <div style={{ font: '900 24px Manrope', color: 'var(--text-primary, #f8fafc)', marginTop: 4 }}>
            {metrics.todaySessionsCount}
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel-bg, #0d1017)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            Customers
          </div>
          <div style={{ font: '900 24px Manrope', color: 'var(--text-primary, #f8fafc)', marginTop: 4 }}>
            {metrics.todayCustomersCount}
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel-bg, #0d1017)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            Live
          </div>
          <div style={{ font: '900 24px Manrope', color: 'var(--primary-accent, #7c5cff)', textShadow: '0 0 16px rgba(124, 92, 255, 0.3)', marginTop: 4 }}>
            {activeSessions.length}
          </div>
        </div>
      </div>

      {/* ========================================================
          3. TODAY'S ATTENTION: ONLY SHOWN IF ALERTS EXIST
          ======================================================== */}
      {totalAlerts > 0 && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
            ATTENTION:
          </span>
          {attentionAlerts?.overtime.map((o) => (
            <span
              key={o.id}
              style={{
                fontSize: 12,
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.18)',
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 600
              }}
            >
              🔴 {o.resourceName} overtime (+{o.overtimeMinutes}m) · {o.customerName}
            </span>
          ))}
          {attentionAlerts?.endingSoon.map((es) => (
            <span
              key={es.id}
              style={{
                fontSize: 12,
                color: '#fde047',
                background: 'rgba(234, 179, 8, 0.18)',
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 600
              }}
            >
              ⏳ {es.resourceName} ending in {es.minutesLeft}m · {es.customerName}
            </span>
          ))}
        </div>
      )}

      {/* ========================================================
          4. LIVE: COUNTER ROWS
          ======================================================== */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#64748b',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}
          >
            LIVE ({activeSessions.length})
          </div>
          {activeSessions.length > 0 && (
            <Link
              href="/bookings"
              style={{ fontSize: 11, fontWeight: 700, color: '#6d5ce8', textDecoration: 'none' }}
            >
              Bookings & Sessions →
            </Link>
          )}
        </div>

        {activeSessions.length === 0 ? (
          <div
            style={{
              background: 'var(--panel-bg, #0d1017)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center',
              color: '#94a3b8'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>No live sessions right now.</div>
            <button
              type="button"
              onClick={() => setWalkInOpen(true)}
              style={{
                marginTop: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 6,
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              + START
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14
            }}
          >
            {activeSessions.map((s) => {
              const running = calculateRunningAmount(s)
              const digitalTime = formatDigitalTimer(s.startedAt)
              const remaining = formatRemainingTime(s.expectedEndAt)

              return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--panel-bg, #0d1017)',
                    border: remaining.isOvertime
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    borderLeft: remaining.isOvertime ? '4px solid #ef4444' : '4px solid #7c5cff',
                    borderRadius: 12,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: remaining.isOvertime
                      ? '0 4px 20px rgba(239, 68, 68, 0.15)'
                      : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(124, 92, 255, 0.08)'
                  }}
                >
                  {/* Top: Status & Running Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: remaining.isOvertime ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: remaining.isOvertime ? '#f87171' : '#4ade80',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: remaining.isOvertime ? '#ef4444' : '#22c55e',
                          boxShadow: remaining.isOvertime ? '0 0 8px #ef4444' : '0 0 8px #22c55e'
                        }}
                      />
                      {remaining.isOvertime ? 'OVERTIME' : 'LIVE'}
                    </div>

                    <div
                      style={{
                        font: '900 18px Manrope',
                        color: '#4ade80',
                        textShadow: '0 0 12px rgba(74, 222, 128, 0.25)'
                      }}
                    >
                      ₹{running}
                    </div>
                  </div>

                  {/* Customer & Resource info */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary, #f8fafc)' }}>
                      {s.customer.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                      {s.resource.name} · {s.partySize || 1} {(s.partySize || 1) === 1 ? 'person' : 'people'}
                    </div>
                  </div>

                  {/* Visually Dominant Digital Timer */}
                  <div
                    style={{
                      background: 'var(--panel-subtle, #11151e)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
                      borderRadius: 10,
                      padding: '12px 16px',
                      textAlign: 'center'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 26,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        color: 'var(--text-primary, #f8fafc)',
                        textShadow: '0 0 16px rgba(124, 92, 255, 0.3)'
                      }}
                    >
                      {digitalTime}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: remaining.isOvertime ? '#f87171' : 'var(--text-muted, #94a3b8)',
                        marginTop: 2
                      }}
                    >
                      {remaining.text}
                    </div>
                  </div>

                  {/* Controls: Quick Extend Chips + EXTEND + END SESSION */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {[15, 30, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          disabled={extendingId === s.id}
                          onClick={() => handleQuickExtend(s, mins)}
                          style={{
                            height: 32,
                            borderRadius: 6,
                            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                            background: 'var(--panel-subtle, #11151e)',
                            color: 'var(--text-primary, #f8fafc)',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: extendingId === s.id ? 'not-allowed' : 'pointer'
                          }}
                          title={`Extend by +${mins}m`}
                        >
                          +{mins}m
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setExtendTarget(s)}
                        style={{
                          height: 32,
                          borderRadius: 6,
                          border: '1px solid rgba(124, 92, 255, 0.3)',
                          background: 'rgba(124, 92, 255, 0.12)',
                          color: '#c4b5fd',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Open full extension options"
                      >
                        EXTEND
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEndModalSession(s)}
                      style={{
                        width: '100%',
                        height: 36,
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        letterSpacing: '0.04em'
                      }}
                    >
                      END SESSION
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          5. NEXT & 6. RESOURCES (Operational Columns)
          ======================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: 16
        }}
      >
        {/* NEXT (Upcoming) */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#94a3b8',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: 8
            }}
          >
            NEXT ({upcomingBookings.length})
          </div>

          {upcomingBookings.length === 0 ? (
            <div
              style={{
                background: 'var(--panel-bg, #0d1017)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: 8,
                padding: '16px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 12
              }}
            >
              No reservations queued.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingBookings.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: 'var(--panel-bg, #0d1017)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    borderRadius: 6,
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary-accent, #7c5cff)' }}>
                      {formatTime(b.startTime)}
                    </span>
                    <span style={{ color: '#94a3b8' }}>·</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>{b.customer.name}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontWeight: 600 }}>
                    {b.resource.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESOURCES STATUS */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#94a3b8',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between'
            }}
          >
            <span>RESOURCES</span>
            <Link
              href="/resources"
              style={{ color: 'var(--primary-accent, #7c5cff)', fontWeight: 700, textDecoration: 'none' }}
            >
              List →
            </Link>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 220,
              overflowY: 'auto'
            }}
          >
            {resourceStatuses.map((r) => (
              <div
                key={r.id}
                style={{
                  background: 'var(--panel-bg, #0d1017)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                  {r.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{r.dot}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        r.state === 'AVAILABLE'
                          ? '#4ade80'
                          : r.state === 'PLAYING'
                          ? '#f87171'
                          : '#fbbf24'
                    }}
                  >
                    {r.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Start Walk-in Modal */}
      <StartWalkInModal
        isOpen={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onSuccess={(createdSession) => {
          const formatted: ActiveSessionItem = {
            id: createdSession.id,
            startedAt: createdSession.startedAt || new Date().toISOString(),
            expectedEndAt: createdSession.expectedEndAt || null,
            partySize: createdSession.partySize || 1,
            customer: createdSession.customer,
            resource: createdSession.resource,
            pricingRule: createdSession.pricingRule || { rate: 120 },
            addOns: createdSession.addOns || []
          }
          setActiveSessions((prev) => [formatted, ...prev.filter((s) => s.id !== createdSession.id)])
          setMetrics((prev) => ({
            ...prev,
            todaySessionsCount: prev.todaySessionsCount + 1,
            activeSessionsCount: prev.activeSessionsCount + 1
          }))
          setNotice(`Live session started for ${createdSession.customer?.name} on ${createdSession.resource?.name}!`)
        }}
        resources={walkInResources}
        addOns={addOns}
        initialCustomers={initialCustomers}
      />

      {/* Simple End Session Modal */}
      <SimpleEndSessionModal
        isOpen={Boolean(endModalSession)}
        session={endModalSession}
        onClose={() => setEndModalSession(null)}
        onSuccess={({ session: endedSession, billing }) => {
          setActiveSessions((prev) => prev.filter((s) => s.id !== endedSession.id))
          setMetrics((prev) => ({
            ...prev,
            todayRevenue: prev.todayRevenue + (billing?.total || endedSession.finalAmount || 0),
            activeSessionsCount: Math.max(0, prev.activeSessionsCount - 1)
          }))
          setNotice(`Session ended for ${endedSession.customer?.name}. Total: ₹${billing?.total || endedSession.finalAmount || 0}`)
        }}
      />

      {/* Extend Session Modal */}
      <ExtendSessionModal
        isOpen={Boolean(extendTarget)}
        session={extendTarget}
        onClose={() => setExtendTarget(null)}
        onSuccess={(updatedSession, message) => {
          setActiveSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? { ...s, expectedEndAt: updatedSession.expectedEndAt } : s))
          )
          setNotice(message)
        }}
      />
    </div>
  )
}
