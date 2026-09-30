'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Clock3,
  Plus,
  ArrowDownRight,
  Activity,
  X,
  CreditCard,
  Check
} from 'lucide-react'

interface SessionItem {
  id: string
  status: string
  startedAt: string
  endedAt?: string | null
  expectedEndAt?: string | null
  finalAmount?: number | null
  customer: { id: string; name: string; phone: string }
  resource: { id: string; name: string }
  pricingRule: { rate: number }
  transaction?: {
    id: string
    total: number
    payments: { id: string; amount: number; method: string }[]
  } | null
}

interface ResourceItem {
  id: string
  name: string
  status: string
  pricingRules: { rate: number }[]
}

interface CustomerItem {
  id: string
  name: string
  phone: string
  totalVisits: number
  totalSpending: number
}

interface SessionsClientProps {
  activeSessions: SessionItem[]
  recentSessions: SessionItem[]
  availableResources: ResourceItem[]
  customers: CustomerItem[]
}

export default function SessionsClient({
  activeSessions: initialActive,
  recentSessions,
  availableResources,
  customers
}: SessionsClientProps) {
  const [activeSessions, setActiveSessions] = useState<SessionItem[]>(initialActive)
  const [now, setNow] = useState(Date.now())
  const [modal, setModal] = useState<'' | 'walkin' | 'checkout' | 'extend'>('')
  const [activeSessionTarget, setActiveSessionTarget] = useState<SessionItem | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Walk-in form state
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '')
  const [selectedResourceId, setSelectedResourceId] = useState(
    availableResources[0]?.id || ''
  )

  // Checkout form state
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH')

  // Extend form state
  const [extendMinutes, setExtendMinutes] = useState(60)

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  // Auto-dismiss notice
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500)
      return () => clearTimeout(t)
    }
  }, [notice])

  const phoneMatch = customers.find(
    (c) => phone.replace(/\D/g, '').length >= 6 && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
  )

  function formatDuration(start: string, end?: string | null): string {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : now
    const elapsedMinutes = Math.max(0, Math.floor((endTime - startTime) / 60000))
    const hours = Math.floor(elapsedMinutes / 60)
    const mins = elapsedMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  function calculateCurrentAmount(start: string, rate: number): number {
    const elapsedMinutes = Math.max(1, Math.ceil((now - new Date(start).getTime()) / 60000))
    return Math.max(Math.round(rate / 2), Math.round((elapsedMinutes * rate) / 60))
  }

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  // Start Walk-In Session
  async function handleStartSession(e: React.FormEvent) {
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
        const cust = await custRes.json()
        if (!custRes.ok) throw new Error(cust.error || 'Failed to create customer')
        customerId = cust.id
      }

      if (!customerId) throw new Error('Please select or specify a customer')

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          resourceId: selectedResourceId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start session')

      setModal('')
      setNotice('Session started successfully')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start session')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Extend Session
  async function handleExtendSession(session: SessionItem, minutes: number = 60) {
    setError('')
    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not extend session')

      setNotice(`Session extended by ${minutes} minutes`)
      window.location.reload()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Extension conflict')
    }
  }

  // Initiate End Session (triggers server calculation, then opens checkout modal)
  async function handleEndSession(session: SessionItem) {
    setError('')
    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to end session')

      // Set target session with updated transaction
      const endedSession: SessionItem = {
        ...session,
        status: 'COMPLETED',
        endedAt: data.session.endedAt,
        finalAmount: data.billing.total,
        transaction: data.transaction
      }
      setActiveSessionTarget(endedSession)
      setPaymentAmount(String(data.billing.total))
      setModal('checkout')
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Unable to end session')
    }
  }

  // Record Payment on Checkout
  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSessionTarget?.transaction) return
    setError('')
    setIsSubmitting(true)

    try {
      const amount = Number(paymentAmount)
      if (amount <= 0) throw new Error('Invalid payment amount')

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: activeSessionTarget.transaction.id,
          amount,
          method: paymentMethod
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')

      setModal('')
      setNotice('Payment recorded successfully')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment recording failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>
              Live Sessions <span className="live-count">{activeSessions.length}</span>
            </h2>
            <p>Server-authoritative timers remain completely accurate across browser refreshes.</p>
          </div>
          <button className="primary" onClick={() => setModal('walkin')}>
            <Plus size={16} /> Start walk-in
          </button>
        </div>

        {activeSessions.length > 0 ? (
          <div className="session-cards">
            {activeSessions.map((s) => {
              const liveAmt = calculateCurrentAmount(s.startedAt, s.pricingRule.rate)
              return (
                <div className="session-card" key={s.id}>
                  <div className="session-card-top">
                    <span className="active-label">
                      <i /> IN PROGRESS
                    </span>
                    <span className="session-start">
                      Started{' '}
                      {new Date(s.startedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <h3>
                    <Link
                      href={`/sessions/${s.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {s.customer.name}
                    </Link>
                  </h3>
                  <p>
                    {s.resource.name} · {formatCurrency(s.pricingRule.rate)}/hour
                  </p>

                  <div className="session-live-stats">
                    <div>
                      <small>ELAPSED</small>
                      <strong>{formatDuration(s.startedAt)}</strong>
                    </div>
                    <div>
                      <small>CURRENT BILL</small>
                      <strong>{formatCurrency(liveAmt)}</strong>
                    </div>
                  </div>

                  <div className="session-buttons">
                    <button
                      className="secondary"
                      onClick={() => handleExtendSession(s, 60)}
                    >
                      ＋ Extend 1 hr
                    </button>
                    <button className="primary" onClick={() => handleEndSession(s)}>
                      End session <ArrowDownRight size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Clock3 size={36} />
            <h3>No active sessions</h3>
            <p>Start a walk-in or check in a booking to begin a live session with timer.</p>
            <button className="primary" onClick={() => setModal('walkin')}>
              <Plus size={16} /> Start a session
            </button>
          </div>
        )}

        {/* Recent Sessions Table */}
        <div className="section-title">Recent Completed Sessions</div>
        <div className="simple-table">
          <div className="table-header">
            <span>Customer</span>
            <span>Resource</span>
            <span>Duration</span>
            <span>Total Bill</span>
            <span>Status</span>
          </div>
          {recentSessions.map((s) => (
            <div className="table-row" key={s.id}>
              <span>
                <Link href={`/sessions/${s.id}`}>
                  <b>{s.customer.name}</b>
                </Link>
              </span>
              <span>{s.resource.name}</span>
              <span>{formatDuration(s.startedAt, s.endedAt)}</span>
              <span>{formatCurrency(s.finalAmount || s.transaction?.total || 0)}</span>
              <span className={`status-pill ${s.status.toLowerCase()}`}>{s.status}</span>
            </div>
          ))}
          {recentSessions.length === 0 && (
            <div className="empty-mini">No completed sessions yet.</div>
          )}
        </div>
      </div>

      {/* Start Walk-in Modal */}
      {modal === 'walkin' && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">WALK-IN PLAY</div>
                <h2>Start New Session</h2>
              </div>
              <button className="icon-button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleStartSession}>
              <p>Enter a phone number to find a returning customer, or register a new one.</p>

              {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

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
                    Found returning customer: <b>{phoneMatch.name}</b> · {phoneMatch.totalVisits} visits · Total spent: {formatCurrency(phoneMatch.totalSpending)}
                  </span>
                </div>
              ) : phone ? (
                <label>
                  Customer Name
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    placeholder="Full name for customer"
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
                Available Resource
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                >
                  {availableResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {formatCurrency(r.pricingRules[0]?.rate || 400)}/hr
                    </option>
                  ))}
                </select>
              </label>

              <div className="modal-note">
                <Clock3 size={15} />
                <span>Timer starts using authoritative server time and tracks minute-by-minute.</span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal('')}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <Activity size={15} />
                  <span>{isSubmitting ? 'Starting...' : 'Start Session'}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Checkout / Payment Modal */}
      {modal === 'checkout' && activeSessionTarget && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">BILLING & SETTLEMENT</div>
                <h2>Session Checkout</h2>
              </div>
              <button className="icon-button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>

            <form className="checkout" onSubmit={handleRecordPayment}>
              {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

              <div className="bill-summary">
                <div>
                  <span>Customer</span>
                  <b>{activeSessionTarget.customer.name}</b>
                </div>
                <div>
                  <span>Resource</span>
                  <b>{activeSessionTarget.resource.name}</b>
                </div>
                <div>
                  <span>Duration</span>
                  <b>{formatDuration(activeSessionTarget.startedAt, activeSessionTarget.endedAt)}</b>
                </div>
                <div>
                  <span>Hourly Rate</span>
                  <b>{formatCurrency(activeSessionTarget.pricingRule.rate)}/hr</b>
                </div>
                <div className="bill-total">
                  <span>Total Amount Due</span>
                  <b>{formatCurrency(activeSessionTarget.finalAmount || 0)}</b>
                </div>
              </div>

              <label>
                Payment Method
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as 'CASH' | 'UPI' | 'CARD' | 'OTHER')
                  }
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label>
                Amount to Collect
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={activeSessionTarget.finalAmount || 99999}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal('')}
                >
                  Close
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <CreditCard size={15} />
                  <span>{isSubmitting ? 'Recording...' : `Record Payment ${formatCurrency(Number(paymentAmount || 0))}`}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Global Toast Notice */}
      {notice && (
        <div className="toast">
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}
    </>
  )
}
