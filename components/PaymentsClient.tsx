'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  Plus,
  X,
  Check,
  CircleDollarSign,
  Search,
  Download,
  Calendar
} from 'lucide-react'

interface PaymentItem {
  id: string
  amount: number
  method: string
  status: string
  createdAt: string
  transaction: {
    id: string
    total: number
    session: {
      id: string
      customer: { name: string; phone: string }
      resource: { name: string }
    }
  }
  recordedBy?: { name: string } | null
}

interface UnpaidTransactionItem {
  id: string
  total: number
  paid: number
  customerName: string
  resourceName: string
}

interface PaymentsClientProps {
  payments: PaymentItem[]
  unpaidTransactions: UnpaidTransactionItem[]
  todayTotal: number
}

const DATE_FILTERS = [
  { label: 'All time', value: 'ALL' },
  { label: 'Today', value: 'TODAY' },
  { label: 'Last 7 days', value: '7D' },
  { label: 'Last 30 days', value: '30D' }
]

export default function PaymentsClient({
  payments: initialPayments,
  unpaidTransactions,
  todayTotal
}: PaymentsClientProps) {
  const [payments] = useState<PaymentItem[]>(initialPayments)
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedTxId, setSelectedTxId] = useState(unpaidTransactions[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  const selectedTx = unpaidTransactions.find((tx) => tx.id === selectedTxId)

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoffs: Record<string, number> = {
      TODAY: new Date().setHours(0, 0, 0, 0),
      '7D': now - 7 * 86400000,
      '30D': now - 30 * 86400000
    }

    return payments.filter((p) => {
      // Method filter
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false
      // Date filter
      if (dateFilter !== 'ALL') {
        const cutoff = cutoffs[dateFilter]
        if (cutoff && new Date(p.createdAt).getTime() < cutoff) return false
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        const customer = p.transaction.session.customer
        if (
          !customer.name.toLowerCase().includes(q) &&
          !customer.phone.includes(q) &&
          !p.transaction.session.resource.name.toLowerCase().includes(q) &&
          !(p.recordedBy?.name || '').toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [payments, methodFilter, dateFilter, search])

  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0)

  function handleExportCSV() {
    const headers = ['Date', 'Customer', 'Phone', 'Resource', 'Amount', 'Method', 'Recorded By']
    const rows = filtered.map((p) => [
      new Date(p.createdAt).toLocaleString('en-IN'),
      p.transaction.session.customer.name,
      p.transaction.session.customer.phone,
      p.transaction.session.resource.name,
      p.amount.toFixed(2),
      p.method,
      p.recordedBy?.name || 'Staff'
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const amtNum = Number(amount)
      if (amtNum <= 0) throw new Error('Enter a valid amount')

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTxId,
          amount: amtNum,
          method
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')

      setShowModal(false)
      setNotice('Payment recorded successfully')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span>Collected Today</span>
            <div className="metric-icon purple"><CircleDollarSign size={18} /></div>
          </div>
          <div className="metric-value">{formatCurrency(todayTotal)}</div>
          <div className="metric-sub">Today&apos;s settlement receipts</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Filtered Total</span>
            <div className="metric-icon blue"><CreditCard size={18} /></div>
          </div>
          <div className="metric-value">{formatCurrency(filteredTotal)}</div>
          <div className="metric-sub">{filtered.length} receipts matching filters</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Pending Balance</span>
            <div className="metric-icon orange"><CircleDollarSign size={18} /></div>
          </div>
          <div className="metric-value">
            {formatCurrency(unpaidTransactions.reduce((acc, tx) => acc + (tx.total - tx.paid), 0))}
          </div>
          <div className="metric-sub">{unpaidTransactions.length} unpaid orders</div>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="toolbar">
          <div>
            <h2>
              Payment Ledger <span className="live-count">{filtered.length}</span>
            </h2>
            <p>Manual receipts recorded by staff and reception.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, resource…"
                style={{
                  height: 34,
                  paddingLeft: 28,
                  paddingRight: 10,
                  border: '1px solid #eeedf2',
                  borderRadius: 7,
                  fontSize: 11,
                  width: 180
                }}
              />
            </div>

            {/* Date filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                height: '34px',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: '7px',
                padding: '0 8px',
                fontSize: '11px',
                background: 'var(--panel-bg, #0d1017)',
                color: 'var(--text-primary, #f8fafc)'
              }}
            >
              {DATE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* Method filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              style={{
                height: '34px',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: '7px',
                padding: '0 8px',
                fontSize: '11px',
                background: 'var(--panel-bg, #0d1017)',
                color: 'var(--text-primary, #f8fafc)'
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Export CSV */}
            <button
              className="secondary"
              onClick={handleExportCSV}
              title="Export to CSV"
              style={{ padding: '0 12px', height: 34, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Download size={13} /> CSV
            </button>

            {unpaidTransactions.length > 0 && (
              <button className="primary" onClick={() => setShowModal(true)}>
                <Plus size={15} /> Record payment
              </button>
            )}
          </div>
        </div>

        <div className="simple-table">
          <div className="table-header payment-cols">
            <span>Customer</span>
            <span>Resource</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Recorded By</span>
            <span>Date &amp; Time</span>
          </div>

          {filtered.map((p) => (
            <div className="table-row payment-cols" key={p.id}>
              <span>
                <b>{p.transaction.session.customer.name}</b>
                <small style={{ display: 'block', color: '#999', fontSize: 10 }}>
                  {p.transaction.session.customer.phone}
                </small>
              </span>
              <span>{p.transaction.session.resource.name}</span>
              <span>
                <b style={{ color: '#3aa675' }}>{formatCurrency(p.amount)}</b>
              </span>
              <span>
                <span className="status-pill available">{p.method}</span>
              </span>
              <span>{p.recordedBy?.name || 'Staff'}</span>
              <span>{new Date(p.createdAt).toLocaleString('en-IN')}</span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-mini">
              {search || methodFilter !== 'ALL' || dateFilter !== 'ALL'
                ? 'No payments match your filters.'
                : 'No payment receipts recorded yet.'}
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">PAYMENT ENTRY</div>
                <h2>Record Payment</h2>
              </div>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRecordPayment}>
              {error && (
                <div
                  className="toast"
                  style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}
                >
                  {error}
                </div>
              )}

              <label>
                Select Unpaid Session / Transaction
                <select
                  value={selectedTxId}
                  onChange={(e) => {
                    setSelectedTxId(e.target.value)
                    const found = unpaidTransactions.find((tx) => tx.id === e.target.value)
                    if (found) setAmount(String(found.total - found.paid))
                  }}
                >
                  {unpaidTransactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.customerName} · {tx.resourceName} · Due: {formatCurrency(tx.total - tx.paid)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Payment Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'CASH' | 'UPI' | 'CARD' | 'OTHER')}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label>
                Amount (INR)
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedTx ? selectedTx.total - selectedTx.paid : 99999}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <CreditCard size={15} />
                  <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
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
