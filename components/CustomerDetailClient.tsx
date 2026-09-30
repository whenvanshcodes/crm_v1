'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  Edit2,
  CalendarDays,
  Clock3,
  CreditCard,
  Check,
  X,
  Award,
  Gamepad2,
  TrendingUp,
  StickyNote
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface CustomerDetailProps {
  customer: {
    id: string
    name: string
    phone: string
    totalVisits: number
    totalSpending: number
    lastVisitAt?: string | null
    createdAt: string
    bookings: {
      id: string
      startTime: string
      endTime: string
      status: string
      resource: { name: string }
    }[]
    sessions: {
      id: string
      startedAt: string
      endedAt?: string | null
      status: string
      finalAmount?: number | null
      resource: { name: string; category?: { name: string } | null }
      transaction?: {
        total: number
        payments: { id: string; amount: number; method: string; createdAt: string }[]
      } | null
    }[]
  }
}

export default function CustomerDetailClient({ customer: initialCustomer }: CustomerDetailProps) {
  const [customer, setCustomer] = useState(initialCustomer)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone)
  const [notes, setNotes] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  function formatDuration(start: string, end?: string | null): string {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const mins = Math.max(1, Math.floor((endTime - startTime) / 60000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  // Build last-30-days spending trend from sessions
  const spendingTrend = (() => {
    const map: Record<string, number> = {}
    const now = Date.now()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      map[key] = 0
    }
    for (const s of customer.sessions) {
      if (!s.endedAt) continue
      const d = new Date(s.endedAt)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in map) map[key] += s.finalAmount || s.transaction?.total || 0
    }
    return Object.entries(map).map(([day, value]) => ({ day, value }))
  })()

  // Preferred categories from sessions
  const catCounts: Record<string, number> = {}
  for (const s of customer.sessions) {
    const cat = (s.resource as { category?: { name: string } | null }).category?.name || 'General'
    catCounts[cat] = (catCounts[cat] || 0) + 1
  }
  const preferredCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // Avg spend per session
  const avgSpend = customer.totalVisits > 0
    ? Math.round(customer.totalSpending / customer.totalVisits)
    : 0

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setNotice('Customer profile updated')
      setCustomer((prev) => ({ ...prev, name: data.name, phone: data.phone }))
      setShowEditModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-hide notice
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(t)
  }, [notice])

  return (
    <>
      {/* Metrics Row */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span>Total Spending</span>
            <div className="metric-icon purple"><CreditCard size={18} /></div>
          </div>
          <div className="metric-value">{formatCurrency(customer.totalSpending)}</div>
          <div className="metric-sub">Lifetime value · Avg {formatCurrency(avgSpend)}/visit</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Total Visits</span>
            <div className="metric-icon blue"><Clock3 size={18} /></div>
          </div>
          <div className="metric-value">{customer.totalVisits}</div>
          <div className="metric-sub">Sessions completed</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Phone</span>
            <div className="metric-icon green"><Users size={18} /></div>
          </div>
          <div className="metric-value" style={{ fontSize: '18px' }}>{customer.phone}</div>
          <div className="metric-sub">Verified customer ID</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Last Visit</span>
            <div className="metric-icon orange"><CalendarDays size={18} /></div>
          </div>
          <div className="metric-value" style={{ fontSize: '18px' }}>
            {customer.lastVisitAt
              ? new Date(customer.lastVisitAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short'
                })
              : 'First visit'}
          </div>
          <div className="metric-sub">
            Member since {new Date(customer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Loyalty + Profile Actions Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '14px 0',
          flexWrap: 'wrap'
        }}
      >
        {/* Customer Visit Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            background: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            color: '#065f46',
            fontWeight: 700,
            fontSize: 13
          }}
        >
          <Award size={15} />
          {customer.totalVisits > 0 ? `${customer.totalVisits} Visits` : 'New Customer'}
        </div>

        {/* Preferred Categories */}
        {preferredCategories.map(([cat, count]) => (
          <div
            key={cat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#f5f4f9',
              fontSize: 11,
              fontWeight: 600,
              color: '#555'
            }}
          >
            <Gamepad2 size={12} /> {cat} ({count})
          </div>
        ))}

        <div style={{ flex: 1 }} />

        <button className="secondary" style={{ fontSize: 12 }} onClick={() => setShowNotesModal(true)}>
          <StickyNote size={14} /> Notes
        </button>
        <button className="secondary" onClick={() => setShowEditModal(true)}>
          <Edit2 size={14} /> Edit Customer
        </button>
      </div>

      {/* Spending Trend Sparkline */}
      {spendingTrend.some((d) => d.value > 0) && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <div>
              <h2>Spending Trend</h2>
              <p>Revenue per session over the last 30 days.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#10b981', fontWeight: 600, fontSize: 13 }}>
              <TrendingUp size={15} />
              {formatCurrency(customer.totalSpending)} total
            </div>
          </div>
          <div style={{ height: 140, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendingTrend}>
                <defs>
                  <linearGradient id="custSpendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#aaa' }}
                  interval={6}
                />
                <Tooltip formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Spent']} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#custSpendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History Grids */}
      <div className="dashboard-grid">
        {/* Sessions History */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Session History</h2>
              <p>Recreational play sessions.</p>
            </div>
          </div>

          <div className="simple-table" style={{ marginTop: '12px' }}>
            <div className="table-header">
              <span>Date</span>
              <span>Resource</span>
              <span>Duration</span>
              <span>Billed</span>
              <span>Status</span>
            </div>
            {customer.sessions.length > 0 ? (
              customer.sessions.map((s) => (
                <div className="table-row" key={s.id}>
                  <span>
                    <Link href={`/sessions/${s.id}`}>
                      <b>
                        {new Date(s.startedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </b>
                    </Link>
                  </span>
                  <span>{s.resource.name}</span>
                  <span>{formatDuration(s.startedAt, s.endedAt)}</span>
                  <span>{formatCurrency(s.finalAmount || s.transaction?.total || 0)}</span>
                  <span className={`status-pill ${s.status.toLowerCase()}`}>{s.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-mini">No sessions played yet.</div>
            )}
          </div>
        </div>

        {/* Bookings History */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Booking History</h2>
              <p>Past and upcoming reservations.</p>
            </div>
          </div>

          <div className="simple-table" style={{ marginTop: '12px' }}>
            <div className="table-header">
              <span>Date</span>
              <span>Resource</span>
              <span>Time</span>
              <span>Status</span>
            </div>
            {customer.bookings.length > 0 ? (
              customer.bookings.map((b) => (
                <div className="table-row" key={b.id}>
                  <span>
                    <Link href={`/bookings/${b.id}`}>
                      <b>
                        {new Date(b.startTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </b>
                    </Link>
                  </span>
                  <span>{b.resource.name}</span>
                  <span>
                    {new Date(b.startTime).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <span className={`status-pill ${b.status.toLowerCase()}`}>{b.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-mini">No bookings recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">EDIT PROFILE</div>
                <h2>Edit Customer</h2>
              </div>
              <button className="icon-button" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateCustomer}>
              {error && (
                <div
                  className="toast"
                  style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}
                >
                  {error}
                </div>
              )}

              <label>
                Full Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>

              <label>
                Phone Number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Notes Modal (read/write placeholder — notes stored client-side for now) */}
      {showNotesModal && (
        <div className="modal-backdrop" onClick={() => setShowNotesModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">CUSTOMER NOTES</div>
                <h2>Staff Notes</h2>
              </div>
              <button className="icon-button" onClick={() => setShowNotesModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-form">
              <label>
                Private notes (staff only)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prefers Table 2. Always pays cash. Regulars with friends on weekends."
                  rows={5}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
              <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                Notes are saved locally for this session. Persistent notes storage coming soon.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setShowNotesModal(false)}>Close</button>
                <button
                  className="primary"
                  onClick={() => {
                    setShowNotesModal(false)
                    setNotice('Notes saved locally')
                  }}
                >
                  Save Notes
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="toast">
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}
    </>
  )
}
