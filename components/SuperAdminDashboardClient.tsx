'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  Layers,
  Users,
  Gamepad2,
  Calendar,
  IndianRupee,
  Activity,
  CheckCircle,
  Plus,
  ChevronDown
} from 'lucide-react'

export interface BranchActivityItem {
  id: string
  name: string
  businessName: string
  city: string
  customers: number
  liveSessions: number
  bookings: number
  revenue: number
  occupancy: string
  status: string
}

export interface BranchSetupHealth {
  branchId: string
  branchName: string
  businessName: string
  city: string
  businessCreated: boolean
  branchCreated: boolean
  resourcesAdded: boolean
  pricingRulesSet: boolean
  addOnsConfigured: boolean
  brandingUploaded: boolean
  completionPercentage: number
}

export interface PlatformOverviewData {
  isAll: boolean
  selectedVenueId: string
  activeBusinesses: number
  activeBranches: number
  customersToday: number
  liveSessions: number
  bookingsToday: number
  revenueToday: number
  totalResources: number
  occupiedResources: number
  availableResources: number
  totalStaff: number
  branchActivity: BranchActivityItem[]
  setupHealth?: BranchSetupHealth[]
}

interface SuperAdminDashboardClientProps {
  initialOverview: PlatformOverviewData
  venuesList: Array<{ id: string; name: string }>
}

export default function SuperAdminDashboardClient({
  initialOverview,
  venuesList
}: SuperAdminDashboardClientProps) {
  const [overview, setOverview] = useState<PlatformOverviewData>(initialOverview)
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  async function handleVenueChange(venueId: string) {
    setSelectedVenueId(venueId)
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/stats?venueId=${venueId}`)
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  return (
    <div>
      {/* Top Controls: Global Selector & Wizard Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
          padding: '16px 20px',
          background: 'var(--panel-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SCOPE VIEW:
          </span>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
              value={selectedVenueId}
              onChange={(e) => handleVenueChange(e.target.value)}
              disabled={loading}
              style={{
                appearance: 'none',
                background: 'var(--input-bg, #f8fafc)',
                border: '1px solid var(--border-color, #cbd5e1)',
                padding: '8px 36px 8px 14px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Parlours (Global Platform Aggregate)</option>
              {venuesList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#64748b'
              }}
            />
          </div>
        </div>

        <Link
          href="/super-admin/venues"
          className="primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700
          }}
        >
          <Plus size={15} /> + Create Parlour
        </Link>
      </div>

      {/* 10 Required Platform Overview Metrics */}
      <h2 style={{ font: '800 15px Manrope', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #64748b)' }}>
        {overview.isAll ? 'PLATFORM OVERVIEW' : 'BRANCH OVERVIEW'}
      </h2>

      <div
        className="metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 32
        }}
      >
        <div className="metric">
          <div className="metric-top">
            <span>ACTIVE BUSINESSES</span>
            <div className="metric-icon purple"><Building2 size={16} /></div>
          </div>
          <div className="metric-value">{overview.activeBusinesses}</div>
          <div className="metric-sub">Registered tenant businesses</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>ACTIVE BRANCHES</span>
            <div className="metric-icon blue"><Layers size={16} /></div>
          </div>
          <div className="metric-value">{overview.activeBranches}</div>
          <div className="metric-sub">Operational locations</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>CUSTOMERS TODAY</span>
            <div className="metric-icon green"><Users size={16} /></div>
          </div>
          <div className="metric-value">{overview.customersToday}</div>
          <div className="metric-sub">Registered visits today</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>LIVE SESSIONS</span>
            <div className="metric-icon orange"><Activity size={16} /></div>
          </div>
          <div className="metric-value">{overview.liveSessions}</div>
          <div className="metric-sub">Currently playing</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>BOOKINGS TODAY</span>
            <div className="metric-icon blue"><Calendar size={16} /></div>
          </div>
          <div className="metric-value">{overview.bookingsToday}</div>
          <div className="metric-sub">Scheduled for today</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>REVENUE TODAY</span>
            <div className="metric-icon green"><IndianRupee size={16} /></div>
          </div>
          <div className="metric-value">{formatCurrency(overview.revenueToday)}</div>
          <div className="metric-sub">Finalized actual payments</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>TOTAL RESOURCES</span>
            <div className="metric-icon purple"><Gamepad2 size={16} /></div>
          </div>
          <div className="metric-value">{overview.totalResources}</div>
          <div className="metric-sub">Snooker, PS5, PCs, etc.</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>OCCUPIED</span>
            <div className="metric-icon orange"><Activity size={16} /></div>
          </div>
          <div className="metric-value">{overview.occupiedResources}</div>
          <div className="metric-sub">In live session</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>AVAILABLE</span>
            <div className="metric-icon green"><CheckCircle size={16} /></div>
          </div>
          <div className="metric-value">{overview.availableResources}</div>
          <div className="metric-sub">Ready for walk-in</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>TOTAL STAFF</span>
            <div className="metric-icon blue"><Users size={16} /></div>
          </div>
          <div className="metric-value">{overview.totalStaff}</div>
          <div className="metric-sub">Owners, managers & attendants</div>
        </div>
      </div>

      {/* Real Branch Activity Table */}
      <div className="panel table-panel">
        <div className="toolbar" style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '14px 20px' }}>
          <div>
            <h2 style={{ font: '800 16px Manrope', margin: '0 0 2px 0' }}>BRANCH ACTIVITY</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
              Real-time operational status across parlour locations.
            </p>
          </div>
        </div>

        {overview.branchActivity.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            No branches registered in scope.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 18px' }}>BRANCH</th>
                  <th style={{ padding: '12px 18px' }}>CUSTOMERS</th>
                  <th style={{ padding: '12px 18px' }}>LIVE SESSIONS</th>
                  <th style={{ padding: '12px 18px' }}>BOOKINGS</th>
                  <th style={{ padding: '12px 18px' }}>REVENUE</th>
                  <th style={{ padding: '12px 18px' }}>OCCUPANCY</th>
                  <th style={{ padding: '12px 18px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {overview.branchActivity.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                        {b.businessName} · {b.city}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>{b.customers}</td>
                    <td style={{ padding: '14px 18px' }}>
                      {b.liveSessions > 0 ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>● {b.liveSessions} active</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>{b.bookings}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#10b981' }}>
                      {formatCurrency(b.revenue)}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>{b.occupancy}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        className={`status-pill ${b.status.toLowerCase()}`}
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parlour Setup Health & Onboarding Checklist */}
      <div className="panel table-panel" style={{ marginTop: 24 }}>
        <div className="toolbar" style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', padding: '14px 20px' }}>
          <div>
            <h2 style={{ font: '800 16px Manrope', margin: '0 0 2px 0' }}>
              PARLOUR SETUP HEALTH & ONBOARDING
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
              Readiness and configuration checklist per branch (Section 5).
            </p>
          </div>
        </div>

        {(!overview.setupHealth || overview.setupHealth.length === 0) ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            No branch onboarding records in scope.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 18px' }}>BRANCH / PARLOUR</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>BUSINESS</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>BRANCH</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>RESOURCES</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>PRICING RULES</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>ADD-ONS</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>BRANDING</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>COMPLETION</th>
                </tr>
              </thead>
              <tbody>
                {overview.setupHealth.map((item) => (
                  <tr
                    key={item.branchId}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        {item.branchName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                        {item.businessName} · {item.city}
                      </div>
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.businessCreated ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Done</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.branchCreated ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Done</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.resourcesAdded ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Added</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Missing</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.pricingRulesSet ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Active</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Missing</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.addOnsConfigured ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Set</span>
                      ) : (
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>Optional</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {item.brandingUploaded ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Uploaded</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Default</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 64,
                            height: 6,
                            background: '#e2e8f0',
                            borderRadius: 3,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${item.completionPercentage}%`,
                              height: '100%',
                              background: item.completionPercentage === 100 ? '#10b981' : item.completionPercentage >= 60 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 800, color: item.completionPercentage === 100 ? '#10b981' : 'var(--text-primary)' }}>
                          {item.completionPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
