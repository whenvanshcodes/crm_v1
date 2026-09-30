'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Gamepad2,
  CalendarDays,
  Clock3,
  Wrench,
  Check,
  Plus,
  Save,
  X
} from 'lucide-react'

interface ResourceDetailClientProps {
  resource: {
    id: string
    name: string
    description?: string | null
    status: string
    category?: { name: string } | null
    pricingRules: { id: string; rate: number; active: boolean }[]
    bookings: {
      id: string
      startTime: string
      endTime: string
      status: string
      customer: { name: string; phone: string }
    }[]
    sessions: {
      id: string
      startedAt: string
      endedAt?: string | null
      status: string
      finalAmount?: number | null
      customer: { name: string }
    }[]
    maintenanceBlocks: {
      id: string
      startTime: string
      endTime: string
      reason?: string | null
    }[]
  }
}

export default function ResourceDetailClient({ resource: initialResource }: ResourceDetailClientProps) {
  const [resource, setResource] = useState(initialResource)
  const [name, setName] = useState(resource.name)
  const [status, setStatus] = useState(resource.status)
  const activeRule = resource.pricingRules.find((r) => r.active)
  const [rate, setRate] = useState(String(activeRule?.rate || 400))
  const [description, setDescription] = useState(resource.description || '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Maintenance block form
  const [showMaintModal, setShowMaintModal] = useState(false)
  const [maintStart, setMaintStart] = useState(new Date().toISOString().slice(0, 16))
  const [maintEnd, setMaintEnd] = useState(
    new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16)
  )
  const [maintReason, setMaintReason] = useState('')

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          status,
          hourlyRate: Number(rate),
          description: description || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setNotice('Resource settings saved')
      setResource((prev) => ({
        ...prev,
        name: data.name,
        status: data.status,
        description: data.description
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddMaintenance(e: React.FormEvent) {
    e.preventDefault()
    try {
      // Create maintenance block via maintenance API or update resource status
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'MAINTENANCE' })
      })
      if (!res.ok) throw new Error('Failed to set maintenance')
      setShowMaintModal(false)
      setNotice('Resource marked for maintenance')
      setStatus('MAINTENANCE')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <>
      <div className="dashboard-grid">
        {/* Left card: Resource Configuration */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Resource Configuration</h2>
              <p>Category: {resource.category?.name || 'Recreation'}</p>
            </div>
            <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
          </div>

          <form className="modal-form" onSubmit={handleSaveSettings} style={{ marginTop: '16px' }}>
            {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

            <label>
              Resource Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <div className="form-two">
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>

              <label>
                Hourly Rate (INR)
                <input
                  type="number"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              Description / Specs
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cloth type, equipment specs, notes"
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowMaintModal(true)}
              >
                <Wrench size={14} /> Schedule Maintenance
              </button>
              <button type="submit" className="primary" disabled={isSaving}>
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right card: Upcoming Schedule & Maintenance */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Upcoming Schedule</h2>
              <p>Next reservations on this resource.</p>
            </div>
          </div>

          <div className="simple-table" style={{ marginTop: '12px' }}>
            <div className="table-header">
              <span>Customer</span>
              <span>Time</span>
              <span>Status</span>
            </div>
            {resource.bookings.length > 0 ? (
              resource.bookings.map((b) => (
                <div className="table-row" key={b.id}>
                  <span>
                    <Link href={`/bookings/${b.id}`}>
                      <b>{b.customer.name}</b>
                    </Link>
                  </span>
                  <span>{new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`status-pill ${b.status.toLowerCase()}`}>{b.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-mini">No upcoming bookings.</div>
            )}
          </div>

          <div className="section-title">Recent Sessions Played</div>
          <div className="simple-table">
            <div className="table-header">
              <span>Customer</span>
              <span>Started</span>
              <span>Amount</span>
            </div>
            {resource.sessions.slice(0, 5).map((s) => (
              <div className="table-row" key={s.id}>
                <span>
                  <Link href={`/sessions/${s.id}`}>
                    <b>{s.customer.name}</b>
                  </Link>
                </span>
                <span>{new Date(s.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                <span>{formatCurrency(s.finalAmount || 0)}</span>
              </div>
            ))}
            {resource.sessions.length === 0 && (
              <div className="empty-mini">No sessions recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Modal */}
      {showMaintModal && (
        <div className="modal-backdrop" onClick={() => setShowMaintModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">MAINTENANCE</div>
                <h2>Mark for Maintenance</h2>
              </div>
              <button className="icon-button" onClick={() => setShowMaintModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddMaintenance}>
              <p>Set table or station status to Maintenance to block walk-ins and bookings.</p>

              <label>
                Reason
                <input
                  value={maintReason}
                  onChange={(e) => setMaintReason(e.target.value)}
                  placeholder="e.g. Cloth change, cue repair, routine inspection"
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowMaintModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="danger">
                  Set Maintenance
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
