'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Clock3,
  Users,
  Gamepad2,
  Plus,
  Check,
  MapPin,
  Settings,
  X
} from 'lucide-react'
import { formatOperatingHours } from '@/lib/venue-hours'

export interface ParlourCardData {
  id: string
  name: string
  shortName: string | null
  city: string
  address: string | null
  phone: string
  status: string
  currency: string
  openingTime: string
  closingTime: string
  primaryColor: string
  coverImageUrl: string | null
  dashboardHeroUrl: string | null
  todayRevenue: number
  totalRevenue: number
  activeSessions: number
  totalSessions: number
  totalCustomers: number
  resourcesCount: number
  utilization: number
  averageGroupSize?: number
  peakHours?: string
}

export interface PortfolioSummary {
  businessName: string
  totalRevenue: number
  totalSessions: number
  totalCustomers: number
  activeParlours: number
  averageOccupancy: string
}

interface MyParloursClientProps {
  venues: ParlourCardData[]
  summary: PortfolioSummary
  currentVenueId: string | null
}

export default function MyParloursClient({
  venues,
  summary,
  currentVenueId
}: MyParloursClientProps) {
  const router = useRouter()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  // Phase 5: Add Branch Drawer State
  const [showAddDrawer, setShowAddDrawer] = useState(false)
  const [drawerStep, setDrawerStep] = useState<1 | 2>(1)
  const [branchName, setBranchName] = useState('')
  const [city, setCity] = useState('Indore')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [openingTime, setOpeningTime] = useState('10:00')
  const [closingTime, setClosingTime] = useState('02:00')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const activeBranch = venues.find((v) => v.id === currentVenueId) || venues[0]
  const needsOnboarding = activeBranch && activeBranch.resourcesCount === 0

  async function handleOpenDashboard(venueId: string) {
    setSwitchingId(venueId)
    try {
      const res = await fetch('/api/auth/switch-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId })
      })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleOpenSettings(venueId: string) {
    setSwitchingId(venueId)
    try {
      const res = await fetch('/api/auth/switch-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId })
      })
      if (res.ok) {
        router.push('/settings')
        router.refresh()
      }
    } finally {
      setSwitchingId(null)
    }
  }

  function handleContinueToStep2(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!branchName.trim() || !city.trim()) {
      setError('Branch name and city are required.')
      return
    }
    setDrawerStep(2)
  }

  async function handleCreateBranch(goToResources: boolean) {
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchName.trim(),
          city: city.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || '9999990001',
          openingTime: openingTime || '10:00',
          closingTime: closingTime || '02:00'
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create branch')
      }

      const newBranch = await res.json()
      setShowAddDrawer(false)
      setDrawerStep(1)
      setBranchName('')
      setAddress('')

      if (goToResources) {
        await fetch('/api/auth/switch-venue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venueId: newBranch.id })
        })
        router.push('/resources')
        router.refresh()
      } else {
        setNotice('✓ Branch created. Add resources whenever you\'re ready.')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create branch')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      {notice && (
        <div className="toast">
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Business Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ font: '800 22px Manrope', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {summary.businessName}
          </h1>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {venues.length} Branches · Combined Owner Workspace
          </span>
        </div>
        <button
          className="primary"
          onClick={() => {
            setDrawerStep(1)
            setError('')
            setShowAddDrawer(true)
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={15} />
          <span>+ Add Branch</span>
        </button>
      </div>

      {/* Phase 6: Owner Onboarding Banner if active branch has 0 resources */}
      {needsOnboarding && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            color: '#fff',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 12px rgba(30, 27, 75, 0.2)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#a5b4fc', textTransform: 'uppercase' }}>
              WELCOME TO {summary.businessName}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 8px', color: '#fff' }}>
              Let&apos;s set up your branch: {activeBranch.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#c7d2fe', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#34d399' }}>● Branch details</span>
              <span>→</span>
              <span>○ Resources</span>
              <span>→</span>
              <span>○ Pricing</span>
              <span>→</span>
              <span>○ Extras</span>
              <span>→</span>
              <span>○ Ready</span>
            </div>
          </div>

          <button
            className="primary"
            onClick={() => router.push('/resources')}
            style={{
              background: '#10b981',
              borderColor: '#059669',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: 13
            }}
          >
            Configure Resources →
          </button>
        </div>
      )}

      {/* Combined Portfolio Statistics */}
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 28 }}>
        <div className="metric">
          <div className="metric-top">
            <span>COMBINED REVENUE</span>
            <div className="metric-icon purple">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="metric-value">₹{summary.totalRevenue.toLocaleString()}</div>
          <div className="metric-sub">Across all {venues.length} branches</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>COMBINED SESSIONS</span>
            <div className="metric-icon blue">
              <Clock3 size={16} />
            </div>
          </div>
          <div className="metric-value">{summary.totalSessions}</div>
          <div className="metric-sub">Lifetime sessions played</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>COMBINED CUSTOMERS</span>
            <div className="metric-icon green">
              <Users size={16} />
            </div>
          </div>
          <div className="metric-value">{summary.totalCustomers}</div>
          <div className="metric-sub">Across all branches</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>AVERAGE OCCUPANCY</span>
            <div className="metric-icon orange">
              <Gamepad2 size={16} />
            </div>
          </div>
          <div className="metric-value">{summary.averageOccupancy}</div>
          <div className="metric-sub">{summary.activeParlours} active branches</div>
        </div>
      </div>

      {/* Parlour Cards Grid */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ font: '700 16px Manrope', margin: 0 }}>MY PARLOURS</h2>
          <span style={{ fontSize: 11, color: '#888' }}>
            Switch between venues to view and operate individual parlour records
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: 20
          }}
        >
          {venues.map((v) => {
            const isCurrent = v.id === currentVenueId
            const hoursInfo = formatOperatingHours(v.openingTime, v.closingTime)

            return (
              <div
                key={v.id}
                className="panel"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  border: isCurrent ? '2px solid #6d5ce8' : '1px solid #eeedf2',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                {/* Banner / Cover Header */}
                <div
                  style={{
                    height: 120,
                    background: v.coverImageUrl
                      ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${v.coverImageUrl})`
                      : `linear-gradient(135deg, ${v.primaryColor}, #0f172a)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(6px)',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <MapPin size={11} /> {v.city}
                    </span>

                    {isCurrent ? (
                      <span
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 9,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Check size={11} /> ACTIVE WORKSPACE
                      </span>
                    ) : (
                      <span
                        style={{
                          background: v.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: v.status === 'ACTIVE' ? '#34d399' : '#f87171',
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 9,
                          fontWeight: 700
                        }}
                      >
                        {v.status}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 style={{ font: '800 18px Manrope', margin: 0, color: '#fff' }}>
                      {v.name}
                    </h3>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
                      {hoursInfo.display}
                    </div>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div style={{ padding: '16px 18px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 10,
                      background: '#faf9fc',
                      padding: '10px 12px',
                      borderRadius: 8,
                      marginBottom: 16
                    }}
                  >
                    <div>
                      <small style={{ fontSize: 9, color: '#888', display: 'block' }}>
                        TODAY'S REV
                      </small>
                      <b style={{ font: '700 14px Manrope', color: '#10b981' }}>
                        ₹{v.todayRevenue}
                      </b>
                    </div>
                    <div>
                      <small style={{ fontSize: 9, color: '#888', display: 'block' }}>
                        ACTIVE NOW
                      </small>
                      <b style={{ font: '700 14px Manrope', color: '#6d5ce8' }}>
                        {v.activeSessions}
                      </b>
                    </div>
                    <div>
                      <small style={{ fontSize: 9, color: '#888', display: 'block' }}>
                        UTILIZATION
                      </small>
                      <b style={{ font: '700 14px Manrope' }}>{v.utilization}%</b>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
                    <div><b>Resources:</b> {v.resourcesCount} active tables / consoles</div>
                    <div><b>Total Customers:</b> {v.totalCustomers} records</div>
                    <div><b>Address:</b> {v.address || `${v.city}, India`}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="primary"
                      onClick={() => handleOpenDashboard(v.id)}
                      disabled={switchingId === v.id}
                      style={{
                        flex: 1,
                        padding: '9px 0',
                        fontSize: 11,
                        background: isCurrent ? '#6d5ce8' : '#1e293b'
                      }}
                    >
                      <ArrowUpRight size={13} />
                      <span>{switchingId === v.id ? 'Opening...' : isCurrent ? 'Current Dashboard' : 'Open Dashboard'}</span>
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleOpenSettings(v.id)}
                      disabled={switchingId === v.id}
                      style={{ padding: '9px 12px', fontSize: 11 }}
                      title="Configure Parlour Settings"
                    >
                      <Settings size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Branch Performance Comparison (Section 50) */}
      <div className="panel table-panel" style={{ marginTop: 28 }}>
        <div className="toolbar" style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '16px 20px' }}>
          <div>
            <h2 style={{ font: '800 16px Manrope', margin: '0 0 2px 0' }}>
              BRANCH PERFORMANCE COMPARISON
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
              Side-by-side branch operational metrics and capacity utilization across locations (Section 50).
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 18px' }}>BRANCH</th>
                <th style={{ padding: '12px 16px' }}>TODAY&apos;S REV</th>
                <th style={{ padding: '12px 16px' }}>TOTAL REV</th>
                <th style={{ padding: '12px 16px' }}>CUSTOMERS</th>
                <th style={{ padding: '12px 16px' }}>SESSIONS (LIVE / TOTAL)</th>
                <th style={{ padding: '12px 16px' }}>OCCUPANCY</th>
                <th style={{ padding: '12px 16px' }}>AVG GROUP</th>
                <th style={{ padding: '12px 16px' }}>PEAK HOURS</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => {
                const isCurrent = v.id === currentVenueId
                return (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      background: isCurrent ? 'rgba(109, 92, 232, 0.03)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {v.name}
                        {isCurrent && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>
                            CURRENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                        {v.city} · {v.resourcesCount} tables/stations
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#10b981' }}>
                      ₹{v.todayRevenue.toLocaleString()}
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      ₹{v.totalRevenue.toLocaleString()}
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      {v.totalCustomers}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 700, color: v.activeSessions > 0 ? '#10b981' : 'inherit' }}>
                        {v.activeSessions} active
                      </span>
                      <span style={{ color: '#888', fontSize: 11 }}> / {v.totalSessions} total</span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${v.utilization}%`, height: '100%', background: '#6d5ce8' }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{v.utilization}%</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      👥 {v.averageGroupSize ?? 2.5}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b' }}>
                      {v.peakHours || '18:00 – 23:00'}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        className={`status-pill ${v.status.toLowerCase()}`}
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      >
                        {v.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className={isCurrent ? 'secondary' : 'primary'}
                        onClick={() => handleOpenDashboard(v.id)}
                        disabled={switchingId === v.id}
                        style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700 }}
                      >
                        {switchingId === v.id ? 'Switching...' : isCurrent ? 'Active' : 'Switch →'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 5: Add Branch Drawer Modal */}
      {showAddDrawer && (
        <div className="modal-backdrop" onClick={() => setShowAddDrawer(false)}>
          <div
            className="modal"
            style={{ maxWidth: 480, width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {drawerStep === 1 ? 'Add New Branch' : 'Set Up Branch Resources'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {drawerStep === 1
                    ? 'Step 1 of 2: Location and operating hours'
                    : 'Step 2 of 2: Configure stations & tables'}
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setShowAddDrawer(false)
                  setDrawerStep(1)
                }}
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div
                className="toast"
                style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#dc2626', margin: '12px 16px 0' }}
              >
                {error}
              </div>
            )}

            {drawerStep === 1 && (
              <form onSubmit={handleContinueToStep2} className="modal-form" style={{ padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label>
                    Branch Name *
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="e.g. Palasia, Vijay Nagar"
                      required
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <label>
                      City *
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Indore"
                        required
                      />
                    </label>

                    <label>
                      Branch Phone
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9999990002"
                      />
                    </label>
                  </div>

                  <label>
                    Address
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 14 MG Road"
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label>
                      Opening Time
                      <input
                        type="time"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                      />
                    </label>
                    <label>
                      Closing Time
                      <input
                        type="time"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowAddDrawer(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary">
                    Continue →
                  </button>
                </div>
              </form>
            )}

            {drawerStep === 2 && (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#ede9fe',
                    color: '#6d5ce8',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 14px'
                  }}
                >
                  <Gamepad2 size={26} />
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>
                  Add resources now?
                </h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
                  You can set up consoles, tables, and rates immediately, or create the branch now and add resources whenever you&apos;re ready.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="primary"
                    disabled={isSubmitting}
                    onClick={() => handleCreateBranch(true)}
                    style={{ padding: '10px 0', fontSize: 13, fontWeight: 700 }}
                  >
                    {isSubmitting ? 'Creating...' : '+ Add Resources Now'}
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={isSubmitting}
                    onClick={() => handleCreateBranch(false)}
                    style={{ padding: '10px 0', fontSize: 13 }}
                  >
                    I&apos;ll do this later
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
