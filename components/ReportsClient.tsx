'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  CircleDollarSign,
  CreditCard,
  Activity,
  Gamepad2,
  Users,
  Award,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts'

interface ReportsData {
  todayRevenue: number
  weeklyRevenue: number
  monthlyRevenue: number
  totalSessions: number
  activeSessions: number
  completedSessions: number
  totalCustomers: number
  totalResources: number
  occupiedResources: number
  utilizationPercentage: number
  averageSessionDuration: number
  averageBookedDuration: number
  averageGroupSize: number
  earlyEndSessions: number
  extendedSessions: number
  ranOverSessions: number
  bookedHours: number
  actualHours: number
  peakHours: string
  noShows?: number
  cancellations?: number
  popularResources: { id: string; name: string; status: string; sessionCount: number }[]
  topCustomers: { id: string; name: string; phone: string; visits: number; spending: number }[]
  paymentBreakdown: { method: string; amount: number; count: number }[]
  dailyTrend: { day: string; value: number }[]
  categoryRevenue?: { name: string; revenue: number }[]
  rangeDays?: number
}

interface ReportsClientProps {
  reports: ReportsData
}

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 }
]

const CAT_COLORS = ['#6d5ce8', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

const defaultReports: ReportsData = {
  todayRevenue: 0,
  weeklyRevenue: 0,
  monthlyRevenue: 0,
  totalSessions: 0,
  activeSessions: 0,
  completedSessions: 0,
  totalCustomers: 0,
  totalResources: 0,
  occupiedResources: 0,
  utilizationPercentage: 0,
  averageSessionDuration: 0,
  averageBookedDuration: 0,
  averageGroupSize: 1,
  earlyEndSessions: 0,
  extendedSessions: 0,
  ranOverSessions: 0,
  bookedHours: 0,
  actualHours: 0,
  peakHours: 'N/A',
  popularResources: [],
  topCustomers: [],
  paymentBreakdown: [],
  dailyTrend: []
}

export default function ReportsClient({ reports: initialReports }: ReportsClientProps) {
  const [reports, setReports] = useState<ReportsData>(initialReports || defaultReports)
  const [selectedDays, setSelectedDays] = useState(initialReports?.rangeDays ?? 7)
  const [loading, setLoading] = useState(false)

  const formatCurrency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  const fetchReports = useCallback(async (days: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data)
      }
    } catch {
      // silently keep old data
    } finally {
      setLoading(false)
    }
  }, [])

  function handleRangeChange(days: number) {
    setSelectedDays(days)
    fetchReports(days)
  }

  const activeReports = reports || defaultReports
  const totalPaymentsAmount = (activeReports.paymentBreakdown || []).reduce((acc, m) => acc + m.amount, 0)
  const catRevenue = activeReports.categoryRevenue ?? []

  return (
    <>
      {/* Date Range Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Analytics window:
        </span>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => handleRangeChange(opt.days)}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: selectedDays === opt.days ? '1.5px solid var(--primary-accent, #7c5cff)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              background: selectedDays === opt.days ? 'rgba(124, 92, 255, 0.16)' : 'var(--panel-bg, #0d1017)',
              color: selectedDays === opt.days ? 'var(--primary-accent, #7c5cff)' : 'var(--text-secondary, #94a3b8)',
              boxShadow: selectedDays === opt.days ? '0 0 10px rgba(124, 92, 255, 0.2)' : 'none',
              fontWeight: selectedDays === opt.days ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {opt.label}
          </button>
        ))}
        {loading && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Refreshing…
          </span>
        )}
      </div>

      {/* 4 Primary Financial & Occupancy Metrics */}
      <div className="metrics" style={{ marginBottom: 20 }}>
        <div className="metric">
          <div className="metric-top">
            <span>Today&apos;s Revenue</span>
            <div className="metric-icon purple">
              <CircleDollarSign size={18} />
            </div>
          </div>
          <div className="metric-value">{formatCurrency(reports.todayRevenue)}</div>
          <div className="metric-sub">Finalized actual payments</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Monthly Revenue</span>
            <div className="metric-icon blue">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="metric-value">{formatCurrency(reports.monthlyRevenue)}</div>
          <div className="metric-sub">Past 30 days total</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Resource Occupancy</span>
            <div className="metric-icon green">
              <Gamepad2 size={18} />
            </div>
          </div>
          <div className="metric-value">{reports.utilizationPercentage}%</div>
          <div className="metric-sub">
            {reports.occupiedResources} of {reports.totalResources} currently occupied
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Completed Sessions</span>
            <div className="metric-icon orange">
              <Activity size={18} />
            </div>
          </div>
          <div className="metric-value">{reports.completedSessions}</div>
          <div className="metric-sub">{reports.totalCustomers} registered customers</div>
        </div>
      </div>

      {/* Advanced Operational Metrics Grid */}
      <div
        className="metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24
        }}
      >
        <div className="metric">
          <div className="metric-top">
            <span>AVG GROUP SIZE</span>
            <div className="metric-icon blue"><Users size={16} /></div>
          </div>
          <div className="metric-value">{reports.averageGroupSize} people</div>
          <div className="metric-sub">Per booking &amp; session</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>AVG SESSION TIME</span>
            <div className="metric-icon green"><Clock size={16} /></div>
          </div>
          <div className="metric-value">{reports.averageSessionDuration} min</div>
          <div className="metric-sub">Avg booked: {reports.averageBookedDuration} min</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>BOOKED VS ACTUAL</span>
            <div className="metric-icon purple"><Activity size={16} /></div>
          </div>
          <div className="metric-value">{reports.actualHours}h used</div>
          <div className="metric-sub">{reports.bookedHours}h planned</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>EARLY END SESSIONS</span>
            <div className="metric-icon blue"><TrendingDown size={16} /></div>
          </div>
          <div className="metric-value">{reports.earlyEndSessions}</div>
          <div className="metric-sub">Billed actual usage</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>EXTENDED SESSIONS</span>
            <div className="metric-icon green"><TrendingUp size={16} /></div>
          </div>
          <div className="metric-value">{reports.extendedSessions}</div>
          <div className="metric-sub">Customer requested more time</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>RAN OVER TIME</span>
            <div className="metric-icon orange"><AlertTriangle size={16} /></div>
          </div>
          <div className="metric-value">{reports.ranOverSessions}</div>
          <div className="metric-sub">Exceeded planned duration</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>PEAK HOURS</span>
            <div className="metric-icon purple"><Clock size={16} /></div>
          </div>
          <div className="metric-value" style={{ fontSize: 16 }}>{reports.peakHours}</div>
          <div className="metric-sub">Highest occupancy window</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>NO-SHOWS</span>
            <div className="metric-icon orange"><AlertTriangle size={16} /></div>
          </div>
          <div className="metric-value">{reports.noShows ?? 0}</div>
          <div className="metric-sub">Bookings missed</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>CANCELLATIONS</span>
            <div className="metric-icon blue"><TrendingDown size={16} /></div>
          </div>
          <div className="metric-value">{reports.cancellations ?? 0}</div>
          <div className="metric-sub">Cancelled reservations</div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="panel" style={{ marginBottom: '18px' }}>
        <div className="panel-head">
          <div>
            <h2>Revenue Trend — Last {selectedDays} Days</h2>
            <p>Daily receipts from recorded payments.</p>
          </div>
        </div>
        <div style={{ height: '240px', marginTop: '16px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={reports.dailyTrend}>
              <defs>
                <linearGradient id="reportsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6d5ce8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6d5ce8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={selectedDays > 30 ? Math.floor(selectedDays / 10) : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#0d1017',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 12
                }}
                formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#7c5cff"
                strokeWidth={2.5}
                fill="url(#reportsFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Revenue Breakdown */}
      {catRevenue.length > 0 && (
        <div className="panel" style={{ marginBottom: '18px' }}>
          <div className="panel-head">
            <div>
              <h2>Revenue by Category</h2>
              <p>Which game types generated the most revenue in this period.</p>
            </div>
          </div>
          <div style={{ height: '220px', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catRevenue} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => `₹${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d1017',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: '#f8fafc',
                    fontSize: 12
                  }}
                  formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {catRevenue.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdown Grid: Payment Methods, Popular Resources */}
      <div className="dashboard-grid">
        {/* Payment Methods */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Payment Method Breakdown</h2>
              <p>Settlement distribution across channels.</p>
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            {reports.paymentBreakdown.map((pm) => {
              const pct =
                totalPaymentsAmount > 0
                  ? Math.round((pm.amount / totalPaymentsAmount) * 100)
                  : 0
              return (
                <div className="payment-line" key={pm.method}>
                  <span>
                    <b>{pm.method}</b> ({pm.count} transactions)
                  </span>
                  <b>{formatCurrency(pm.amount)}</b>
                  <div className="progress">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Popular Resources */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Popular Resources</h2>
              <p>Tables and stations by session volume.</p>
            </div>
          </div>

          <div className="simple-table" style={{ marginTop: '14px' }}>
            <div className="table-header">
              <span>Resource</span>
              <span>Status</span>
              <span>Sessions Played</span>
            </div>
            {reports.popularResources.map((r) => (
              <div className="table-row" key={r.id}>
                <span><b>{r.name}</b></span>
                <span>
                  <span className={`status-pill ${r.status.toLowerCase()}`}>
                    {r.status}
                  </span>
                </span>
                <span><b>{r.sessionCount}</b></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="panel" style={{ marginTop: '18px' }}>
        <div className="panel-head">
          <div>
            <h2>Top Customers by Spending</h2>
            <p>Most valuable recurring patrons.</p>
          </div>
        </div>

        <div className="simple-table" style={{ marginTop: '14px' }}>
          <div className="table-header customer-cols">
            <span>Customer</span>
            <span>Phone</span>
            <span>Visits</span>
            <span>Lifetime Spending</span>
            <span>Loyalty</span>
          </div>

          {reports.topCustomers.map((c, i) => (
            <div className="table-row customer-cols" key={c.id}>
              <span>
                <Link href={`/customers/${c.id}`}><b>{c.name}</b></Link>
              </span>
              <span>{c.phone}</span>
              <span>{c.visits}</span>
              <span><b style={{ color: '#3aa675' }}>{formatCurrency(c.spending)}</b></span>
              <span>
                <span className="status-pill active">
                  {i === 0 ? '👑 VIP' : i < 3 ? '★ Gold' : 'Member'}
                </span>
              </span>
            </div>
          ))}
          {reports.topCustomers.length === 0 && (
            <div className="empty-mini">No customer visits recorded yet.</div>
          )}
        </div>
      </div>
    </>
  )
}
