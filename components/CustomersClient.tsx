'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Search,
  Plus,
  X,
  Check,
  Phone,
  Clock3
} from 'lucide-react'

interface CustomerItem {
  id: string
  name: string
  phone: string
  totalVisits: number
  totalSpending: number
  lastVisitAt?: string | null
  createdAt: string
}

interface CustomersClientProps {
  customers: CustomerItem[]
}

export default function CustomersClient({
  customers: initialCustomers
}: CustomersClientProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search.replace(/\D/g, ''))
  )

  const initials = (str: string) =>
    str
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add customer')

      setShowModal(false)
      setNotice('Customer created successfully')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Customer creation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="panel table-panel">
        <div className="toolbar">
          <div>
            <h2>
              Customer Directory <span className="live-count">{customers.length}</span>
            </h2>
            <p>Your local venue customer relationships and spending records.</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="searchbox">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or phone..."
              />
            </div>
            <button className="primary" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add customer
            </button>
          </div>
        </div>

        <div className="simple-table">
          <div className="table-header customer-cols">
            <span>Customer</span>
            <span>Phone</span>
            <span>Visits</span>
            <span>Total Spent</span>
            <span>Last Visit</span>
          </div>

          {filtered.map((c) => (
            <div className="table-row customer-cols" key={c.id}>
              <span className="customer-cell">
                <i>{initials(c.name)}</i>
                <Link href={`/customers/${c.id}`}>
                  <b>{c.name}</b>
                </Link>
              </span>
              <span>{c.phone}</span>
              <span>{c.totalVisits}</span>
              <span>{formatCurrency(c.totalSpending)}</span>
              <span>
                {c.lastVisitAt
                  ? new Date(c.lastVisitAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short'
                    })
                  : '—'}
              </span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-mini">No customers found.</div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">NEW CUSTOMER</div>
                <h2>Register Customer</h2>
              </div>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddCustomer}>
              {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

              <label>
                Full Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Arjun Mehta"
                />
              </label>

              <label>
                Phone Number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="e.g. +91 98765 43210"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSubmitting}>
                  <Plus size={15} />
                  <span>{isSubmitting ? 'Registering...' : 'Register Customer'}</span>
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
