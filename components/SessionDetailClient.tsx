'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Clock3,
  CreditCard,
  Gamepad2,
  Users,
  Check,
  ArrowDownRight,
  X
} from 'lucide-react'

interface SessionDetailClientProps {
  session: {
    id: string
    status: string
    startedAt: string
    endedAt?: string | null
    expectedEndAt?: string | null
    finalAmount?: number | null
    customer: { id: string; name: string; phone: string }
    resource: { id: string; name: string }
    pricingRule: { rate: number; unit: string }
    transaction?: {
      id: string
      subtotal: number
      discount: number
      tax: number
      total: number
      payments: {
        id: string
        amount: number
        method: string
        status: string
        createdAt: string
      }[]
    } | null
  }
}

export default function SessionDetailClient({ session }: SessionDetailClientProps) {
  const [now, setNow] = useState(Date.now())
  const [modal, setModal] = useState<'' | 'checkout' | 'payment'>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session.status === 'ACTIVE') {
      const timer = setInterval(() => setNow(Date.now()), 5000)
      return () => clearInterval(timer)
    }
  }, [session.status])

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500)
      return () => clearTimeout(t)
    }
  }, [notice])

  const startTime = new Date(session.startedAt).getTime()
  const endTime = session.endedAt ? new Date(session.endedAt).getTime() : now
  const elapsedMinutes = Math.max(0, Math.floor((endTime - startTime) / 60000))
  const hours = Math.floor(elapsedMinutes / 60)
  const mins = elapsedMinutes % 60
  const elapsedFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

  const currentLiveAmount = Math.max(
    Math.round(session.pricingRule.rate / 2),
    Math.round((Math.max(1, elapsedMinutes) * session.pricingRule.rate) / 60)
  )

  const paidTotal =
    session.transaction?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const totalBill = session.finalAmount || session.transaction?.total || currentLiveAmount
  const outstanding = Math.max(0, totalBill - paidTotal)

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  async function handleExtend(minutes: number) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extension conflict')
      setNotice(`Session extended by ${minutes} minutes`)
      window.location.reload()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Extension conflict')
    }
  }

  async function handleEnd() {
    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to end session')
      setNotice('Session ended and billed successfully')
      window.location.reload()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Unable to end session')
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this session without billing?')) return
    try {
      const res = await fetch(`/api/sessions/${session.id}/cancel`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to cancel session')
      setNotice('Session cancelled')
      window.location.reload()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Unable to cancel')
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!session.transaction) return
    setError('')
    setIsSubmitting(true)

    try {
      const amount = Number(paymentAmount)
      if (amount <= 0 || amount > outstanding) {
        throw new Error('Invalid payment amount')
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: session.transaction.id,
          amount,
          method: paymentMethod
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')

      setModal('')
      setNotice('Payment recorded')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment recording failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="dashboard-grid">
        {/* Left card: Session Overview & Timer */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Session Overview</h2>
              <p>ID: {session.id}</p>
            </div>
            <span className={`status-pill ${session.status.toLowerCase()}`}>
              {session.status}
            </span>
          </div>

          <div className="bill-summary" style={{ marginTop: '16px' }}>
            <div>
              <span>Resource</span>
              <b>
                <Link href={`/resources`}>{session.resource.name}</Link>
              </b>
            </div>
            <div>
              <span>Customer</span>
              <b>
                <Link href={`/customers/${session.customer.id}`}>
                  {session.customer.name} ({session.customer.phone})
                </Link>
              </b>
            </div>
            <div>
              <span>Started At</span>
              <b>{new Date(session.startedAt).toLocaleString('en-IN')}</b>
            </div>
            {session.expectedEndAt && (
              <div>
                <span>Expected End</span>
                <b>{new Date(session.expectedEndAt).toLocaleTimeString('en-IN')}</b>
              </div>
            )}
            {session.endedAt && (
              <div>
                <span>Ended At</span>
                <b>{new Date(session.endedAt).toLocaleString('en-IN')}</b>
              </div>
            )}
            <div>
              <span>Duration</span>
              <b>{elapsedFormatted} ({elapsedMinutes} minutes)</b>
            </div>
            <div>
              <span>Hourly Rate</span>
              <b>{formatCurrency(session.pricingRule.rate)}/hour</b>
            </div>
            <div className="bill-total">
              <span>{session.status === 'ACTIVE' ? 'Current Estimate' : 'Total Billed'}</span>
              <b>{formatCurrency(totalBill)}</b>
            </div>
          </div>

          {session.status === 'ACTIVE' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="secondary" onClick={() => handleExtend(30)}>
                + 30m
              </button>
              <button className="secondary" onClick={() => handleExtend(60)}>
                + 1h
              </button>
              <button className="primary" onClick={handleEnd} style={{ flex: 1 }}>
                End Session <ArrowDownRight size={15} />
              </button>
              <button className="danger" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Right card: Transaction and Payment Ledger */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Settlement & Payments</h2>
              <p>Outstanding balance and recorded receipts.</p>
            </div>
            {session.transaction && outstanding > 0 && (
              <button
                className="primary"
                onClick={() => {
                  setPaymentAmount(String(outstanding))
                  setModal('payment')
                }}
              >
                <CreditCard size={15} /> Collect Payment
              </button>
            )}
          </div>

          <div className="bill-summary" style={{ marginTop: '16px' }}>
            <div>
              <span>Subtotal</span>
              <b>{formatCurrency(session.transaction?.subtotal || totalBill)}</b>
            </div>
            <div>
              <span>Discount</span>
              <b>{formatCurrency(session.transaction?.discount || 0)}</b>
            </div>
            <div>
              <span>Tax</span>
              <b>{formatCurrency(session.transaction?.tax || 0)}</b>
            </div>
            <div>
              <span>Total Paid</span>
              <b style={{ color: '#3aa675' }}>{formatCurrency(paidTotal)}</b>
            </div>
            <div className="bill-total">
              <span>Outstanding Due</span>
              <b style={{ color: outstanding > 0 ? '#b91c1c' : '#3aa675' }}>
                {formatCurrency(outstanding)}
              </b>
            </div>
          </div>

          <div className="section-title">Payments Recorded</div>
          <div className="simple-table">
            <div className="table-header">
              <span>Date</span>
              <span>Method</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {session.transaction?.payments && session.transaction.payments.length > 0 ? (
              session.transaction.payments.map((p) => (
                <div className="table-row" key={p.id}>
                  <span>{new Date(p.createdAt).toLocaleTimeString('en-IN')}</span>
                  <span>{p.method}</span>
                  <span><b>{formatCurrency(p.amount)}</b></span>
                  <span className={`status-pill ${p.status.toLowerCase()}`}>{p.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-mini">No payments recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {modal === 'payment' && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">RECEIPT</div>
                <h2>Record Payment</h2>
              </div>
              <button className="icon-button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRecordPayment}>
              {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

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
                Amount to Collect (Due: {formatCurrency(outstanding)})
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={outstanding}
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
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <CreditCard size={15} />
                  <span>{isSubmitting ? 'Recording...' : `Confirm Payment`}</span>
                </button>
              </div>
            </form>
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
