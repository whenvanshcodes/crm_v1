'use client'

import React, { useState } from 'react'
import {
  Shield,
  Plus,
  X,
  Check,
  UserCheck,
  UserX
} from 'lucide-react'

interface StaffItem {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  status: string
  createdAt: string
}

interface StaffClientProps {
  staff: StaffItem[]
  currentRole: string
}

export default function StaffClient({ staff: initialStaff, currentRole }: StaffClientProps) {
  const [staff, setStaff] = useState<StaffItem[]>(initialStaff)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'MANAGER' | 'RECEPTIONIST' | 'STAFF'>('RECEPTIONIST')
  const [password, setPassword] = useState('demo1234')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOwner = currentRole === 'OWNER'

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          role,
          password
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add staff member')

      setShowModal(false)
      setNotice('Team member added successfully')
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(user: StaffItem) {
    if (user.role === 'OWNER') return
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    try {
      const res = await fetch(`/api/staff/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      setNotice(`${user.name} is now ${nextStatus}`)
      setStaff((prev) =>
        prev.map((s) => (s.id === user.id ? { ...s, status: nextStatus } : s))
      )
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const initials = (str: string) =>
    str
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <>
      <div className="panel table-panel">
        <div className="toolbar">
          <div>
            <h2>
              Team Members <span className="live-count">{staff.length}</span>
            </h2>
            <p>Manage staff access, roles, and status for your venue.</p>
          </div>

          {isOwner && (
            <button className="primary" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add team member
            </button>
          )}
        </div>

        <div className="simple-table">
          <div className="table-header staff-cols">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {staff.map((s) => (
            <div className="table-row staff-cols" key={s.id}>
              <span className="customer-cell">
                <i>{initials(s.name)}</i>
                <b>{s.name}</b>
              </span>
              <span>{s.email}</span>
              <span>
                <span className="status-pill active">{s.role}</span>
              </span>
              <span>
                <span className={`status-pill ${s.status.toLowerCase()}`}>
                  {s.status}
                </span>
              </span>
              <span>
                {s.role !== 'OWNER' && isOwner && (
                  <button
                    className="secondary"
                    style={{ padding: '4px 8px', fontSize: '9px' }}
                    onClick={() => handleToggleStatus(s)}
                  >
                    {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="info-banner" style={{ marginTop: '20px' }}>
          <Shield size={16} />
          <span>
            Role-based security is active. Venue owners can invite managers, receptionists, and staff.
          </span>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">TEAM INVITATION</div>
                <h2>Add Team Member</h2>
              </div>
              <button className="icon-button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddStaff}>
              {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e' }}>{error}</div>}

              <label>
                Full Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Priya Sharma"
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="priya@venue.com"
                />
              </label>

              <label>
                Phone Number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </label>

              <div className="form-two">
                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as 'MANAGER' | 'RECEPTIONIST' | 'STAFF')
                    }
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </label>

                <label>
                  Temporary Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </div>

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
                  <span>{isSubmitting ? 'Adding...' : 'Add Team Member'}</span>
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
