'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Save,
  Check,
  Building,
  Clock3,
  CreditCard,
  Users,
  Palette,
  Sun,
  Moon,
  Laptop,
  Image as ImageIcon,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Plus,
  Trash2,
  Gamepad2,
  Tag,
  DollarSign
} from 'lucide-react'
import { formatOperatingHours } from '@/lib/venue-hours'
import { applyTheme, getThemePreference, ThemeMode } from '@/lib/theme'
import { ImageUpload } from './ImageUpload'

export interface VenueSettingsData {
  id: string
  name: string
  shortName?: string | null
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  currency: string
  openingTime: string
  closingTime: string
  timezone: string
  logoUrl?: string | null
  coverImageUrl?: string | null
  dashboardHeroUrl?: string | null
  galleryImages?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  taxRate?: number | null
}

interface AddOnItemData {
  id: string
  name: string
  description?: string | null
  pricingType: string
  price: number
  categoryName?: string | null
  active: boolean
}

interface SettingsClientProps {
  venue: VenueSettingsData
}

type SettingsTab =
  | 'GENERAL'
  | 'OPERATIONS'
  | 'RESOURCES'
  | 'PRICING'
  | 'ADDONS'
  | 'PAYMENTS'
  | 'STAFF'
  | 'ROLES'
  | 'APPEARANCE'
  | 'IMAGES'

const fallbackVenue: VenueSettingsData = {
  id: '',
  name: 'Parlour Branch',
  shortName: 'Branch',
  city: 'Indore',
  phone: '',
  email: '',
  address: '',
  currency: 'INR',
  openingTime: '10:00',
  closingTime: '02:00',
  timezone: 'Asia/Kolkata',
  taxRate: 0
}

export default function SettingsClient({ venue: initialVenue }: SettingsClientProps) {
  const [venue, setVenue] = useState<VenueSettingsData>(initialVenue || fallbackVenue)
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL')

  // GENERAL
  const [name, setName] = useState(initialVenue?.name || fallbackVenue.name)
  const [shortName, setShortName] = useState(initialVenue?.shortName || '')
  const [city, setCity] = useState(initialVenue?.city || 'Indore')
  const [address, setAddress] = useState(initialVenue?.address || '')
  const [phone, setPhone] = useState(initialVenue?.phone || '')
  const [email, setEmail] = useState(initialVenue?.email || '')
  const [currency, setCurrency] = useState(initialVenue?.currency || 'INR')
  const [openingTime, setOpeningTime] = useState(initialVenue?.openingTime || '10:00')
  const [closingTime, setClosingTime] = useState(initialVenue?.closingTime || '02:00')
  const [timezone, setTimezone] = useState(initialVenue?.timezone || 'Asia/Kolkata')

  // OPERATIONS
  const [taxRate, setTaxRate] = useState(String(initialVenue?.taxRate || 0))

  // APPEARANCE & IMAGES
  const [logoUrl, setLogoUrl] = useState(initialVenue?.logoUrl || '')
  const [coverImageUrl, setCoverImageUrl] = useState(initialVenue?.coverImageUrl || '')
  const [dashboardHeroUrl, setDashboardHeroUrl] = useState(initialVenue?.dashboardHeroUrl || '')
  const [primaryColor, setPrimaryColor] = useState(initialVenue?.primaryColor || '#10b981')
  const [secondaryColor, setSecondaryColor] = useState(initialVenue?.secondaryColor || '#0f172a')
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemePreference())

  // ADD-ONS
  const [addOns, setAddOns] = useState<AddOnItemData[]>([])
  const [loadingAddOns, setLoadingAddOns] = useState(false)
  const [showNewAddOnModal, setShowNewAddOnModal] = useState(false)
  const [newAddOnName, setNewAddOnName] = useState('')
  const [newAddOnPrice, setNewAddOnPrice] = useState('60')
  const [newAddOnType, setNewAddOnType] = useState('PER_HOUR')
  const [newAddOnCategory, setNewAddOnCategory] = useState('')
  const [newAddOnDescription, setNewAddOnDescription] = useState('')

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const hoursPreview = formatOperatingHours(openingTime, closingTime)

  function handleThemeToggle(mode: ThemeMode) {
    setThemeMode(mode)
    applyTheme(mode)
  }

  // Load add-ons when switching to ADDONS tab
  useEffect(() => {
    if (activeTab === 'ADDONS') {
      loadAddOns()
    }
  }, [activeTab])

  async function loadAddOns() {
    setLoadingAddOns(true)
    try {
      const res = await fetch('/api/add-ons')
      if (res.ok) {
        setAddOns(await res.json())
      }
    } finally {
      setLoadingAddOns(false)
    }
  }

  async function handleCreateAddOn(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/add-ons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAddOnName,
          price: parseFloat(newAddOnPrice) || 0,
          pricingType: newAddOnType,
          categoryName: newAddOnCategory || undefined,
          description: newAddOnDescription || undefined
        })
      })
      if (!res.ok) throw new Error('Failed to create add-on')
      setNotice(`Add-on "${newAddOnName}" created successfully!`)
      setShowNewAddOnModal(false)
      setNewAddOnName('')
      setNewAddOnDescription('')
      loadAddOns()
    } catch (err: any) {
      setError(err.message || 'Error creating add-on')
    }
  }

  async function handleDeleteAddOn(id: string) {
    if (!confirm('Deactivate this add-on?')) return
    try {
      const res = await fetch(`/api/add-ons/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to deactivate add-on')
      setNotice('Add-on deactivated.')
      loadAddOns()
    } catch (err: any) {
      setError(err.message || 'Error deactivating add-on')
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const res = await fetch('/api/venues', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          shortName: shortName || undefined,
          city,
          address: address || undefined,
          phone,
          email: email || undefined,
          currency,
          openingTime,
          closingTime,
          timezone,
          taxRate: parseFloat(taxRate) || 0,
          logoUrl: logoUrl,
          coverImageUrl: coverImageUrl,
          dashboardHeroUrl: dashboardHeroUrl || coverImageUrl || '',
          primaryColor,
          secondaryColor
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')

      setNotice('Parlour settings saved successfully!')
      setVenue(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      {/* Toast Notice */}
      {notice && (
        <div className="toast" style={{ marginBottom: 16 }}>
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* 10 Organized Settings Tabs */}
      <div className="tab-nav" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {(
          [
            ['GENERAL', 'General'],
            ['OPERATIONS', 'Operations'],
            ['RESOURCES', 'Resources'],
            ['PRICING', 'Pricing'],
            ['ADDONS', 'Add-ons'],
            ['PAYMENTS', 'Payments'],
            ['STAFF', 'Staff'],
            ['ROLES', 'Roles & Permissions'],
            ['APPEARANCE', 'Appearance'],
            ['IMAGES', 'Images']
          ] as const
        ).map(([tabKey, tabLabel]) => (
          <button
            key={tabKey}
            type="button"
            className={`tab-btn ${activeTab === tabKey ? 'active' : ''}`}
            onClick={() => setActiveTab(tabKey)}
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      <div className="panel settings-panel" style={{ maxWidth: 860 }}>
        <form onSubmit={handleSaveSettings}>
          {error && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'GENERAL' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>General Parlour Information</h2>
                  <p>Legal parlour name, location, contact details, and currency.</p>
                </div>
              </div>

              <div className="settings-form">
                <label>
                  Parlour / Branch Name *
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Cue Club — Branch 1"
                  />
                </label>

                <label>
                  Short Name
                  <input
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    placeholder="e.g. Branch 1"
                  />
                </label>

                <label>
                  City *
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    placeholder="Indore"
                  />
                </label>

                <label>
                  Contact Phone Number *
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="9999990001"
                  />
                </label>

                <label>
                  Contact Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@cueclub.local"
                  />
                </label>

                <label>
                  Address
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="102 Scheme 54, Vijay Nagar"
                  />
                </label>

                <label>
                  Operating Currency
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                  </select>
                </label>

                <label>
                  Timezone
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Kolkata"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATIONS */}
          {activeTab === 'OPERATIONS' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Operations & Overnight Hours</h2>
                  <p>Operating schedule and tax configuration. Supports overnight schedules.</p>
                </div>
              </div>

              <div className="settings-form">
                <label>
                  Daily Opening Time (HH:MM)
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                  />
                </label>

                <label>
                  Daily Closing Time (Overnight supported)
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                  />
                </label>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--text-primary, #f8fafc)' }}>
                    <b>Schedule Preview:</b> {hoursPreview.display}{' '}
                    {hoursPreview.isOvernight && (
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>
                        (Overnight past midnight supported)
                      </span>
                    )}
                  </div>
                </div>

                <label>
                  Default Tax / GST Rate (%)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: RESOURCES */}
          {activeTab === 'RESOURCES' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Resources & Gaming Devices</h2>
                  <p>Snooker tables, pool tables, PlayStation 5 consoles, and gaming PCs.</p>
                </div>
                <Link href="/resources" className="primary" style={{ fontSize: 12, padding: '6px 12px' }}>
                  Manage Resources →
                </Link>
              </div>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                All devices and tables are managed under the Resources workspace. You can configure individual status, maintenance blocks, and images.
              </p>
            </div>
          )}

          {/* TAB 4: PRICING */}
          {activeTab === 'PRICING' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Base Pricing Engine</h2>
                  <p>Reusable hourly and per-session pricing rules for resources.</p>
                </div>
                <Link href="/resources" className="secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                  Configure Resource Rates →
                </Link>
              </div>
              <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 16, borderRadius: 8, fontSize: 13, color: 'var(--text-primary, #f8fafc)' }}>
                <div><b>Standard Pricing Rules:</b></div>
                <ul style={{ margin: '8px 0 0 18px', color: 'var(--text-secondary, #94a3b8)' }}>
                  <li>Hourly Rate: minute-level proportional billing for actual usage.</li>
                  <li>Overtime Billing: automatically bills additional time if customer plays past booked duration.</li>
                  <li>Early End: bills actual time played upon checkout.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: ADD-ONS */}
          {activeTab === 'ADDONS' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Generic Add-ons</h2>
                  <p>Extra equipment and accessories (e.g. Extra Remote ₹60/hr, Headset ₹30/hr).</p>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowNewAddOnModal(true)}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  <Plus size={14} /> + New Add-on
                </button>
              </div>

              {loadingAddOns ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading add-ons...</div>
              ) : addOns.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', borderRadius: 8 }}>
                  No add-ons registered. Click "+ New Add-on" to create accessories like Extra Remotes or Headsets.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {addOns.map((addon) => (
                    <div
                      key={addon.id}
                      style={{
                        background: 'var(--panel-subtle, #11151e)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                        padding: 14,
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <b style={{ fontSize: 14 }}>{addon.name}</b>
                          <span style={{ fontSize: 11, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>
                            {addon.pricingType.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', margin: '4px 0' }}>
                          ₹{addon.price}/{addon.pricingType === 'PER_HOUR' ? 'hr' : 'session'}
                        </div>
                        {addon.categoryName && (
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Applies to: {addon.categoryName}
                          </div>
                        )}
                        {addon.description && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            {addon.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddOn(addon.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={13} /> Deactivate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PAYMENTS */}
          {activeTab === 'PAYMENTS' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Payment Methods</h2>
                  <p>Accepted manual payment types for session checkout.</p>
                </div>
              </div>

              <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 16, borderRadius: 8, fontSize: 13, color: 'var(--text-primary, #f8fafc)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>ONE SESSION · ONE BILL · ONE PAYMENT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
                  {['Cash', 'UPI', 'Card', 'Other'].map((m) => (
                    <div key={m} style={{ background: 'var(--panel-bg, #0d1017)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8, textAlign: 'center', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                      ✓ {m}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                  Split payment has been completely removed to provide lightning-fast, streamlined reception checkout.
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: STAFF */}
          {activeTab === 'STAFF' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Staff Management</h2>
                  <p>Owners, Managers, Receptionists, and Game Attendants.</p>
                </div>
                <Link href="/staff" className="primary" style={{ fontSize: 12, padding: '6px 12px' }}>
                  Manage Staff Workspace →
                </Link>
              </div>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                Staff credentials and branch assignments are managed in the Staff section.
              </p>
            </div>
          )}

          {/* TAB 8: ROLES & PERMISSIONS */}
          {activeTab === 'ROLES' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Roles & Permissions Hierarchy</h2>
                  <p>Security and authorization policies across the parlour OS.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-primary, #f8fafc)' }}>
                <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8 }}>
                  <b>SUPER ADMIN (Platform Owner):</b> Manages businesses, branches, global stats, branding. Does not operate sessions.
                </div>
                <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8 }}>
                  <b>OWNER (Business Level):</b> Multi-branch access, reports, finances, parlour configuration, staff management.
                </div>
                <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8 }}>
                  <b>MANAGER (Branch Level):</b> Day-to-day operations, resources, bookings, customer CRM, financial reports.
                </div>
                <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8 }}>
                  <b>RECEPTIONIST:</b> Quick walk-ins, phone lookup, start/extend/end sessions, take payments.
                </div>
                <div style={{ background: 'var(--panel-subtle, #11151e)', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))', padding: 12, borderRadius: 8 }}>
                  <b>GAME ATTENDANT:</b> Assisted play, timer monitoring, game assists.
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: APPEARANCE */}
          {activeTab === 'APPEARANCE' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Appearance & Dark Mode</h2>
                  <p>Theme settings and custom brand color palette.</p>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  APPLICATION THEME
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={themeMode === mode ? 'primary' : 'secondary'}
                      onClick={() => handleThemeToggle(mode)}
                      style={{ padding: '8px 16px', fontSize: 13, textTransform: 'capitalize' }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-form">
                <label>
                  Brand Primary Accent Colour
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: 44, height: 38, padding: 3, cursor: 'pointer' }}
                    />
                    <input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#10b981"
                      style={{ flex: 1 }}
                    />
                  </div>
                </label>

                <label>
                  Brand Secondary Dark Colour
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{ width: 44, height: 38, padding: 3, cursor: 'pointer' }}
                    />
                    <input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#0f172a"
                      style={{ flex: 1 }}
                    />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 10: IMAGES */}
          {activeTab === 'IMAGES' && (
            <div>
              <div className="panel-head" style={{ marginBottom: 16 }}>
                <div>
                  <h2>Brand Imagery & Hero Banners</h2>
                  <p>Logos, hero headers, and dashboard cover imagery.</p>
                </div>
              </div>

              <div className="settings-form">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                    Parlour Logo (Optional)
                  </label>
                  <ImageUpload
                    value={logoUrl}
                    onChange={(val) => setLogoUrl(val || '')}
                    folder="parlours"
                    label="Upload Parlour Logo (Optional)"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                    Dashboard Hero / Cover Banner (Optional)
                  </label>
                  <ImageUpload
                    value={coverImageUrl}
                    onChange={(val) => setCoverImageUrl(val || '')}
                    folder="parlours"
                    label="Upload Cover Banner (Optional)"
                    aspectRatio="wide"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions" style={{ marginTop: 24 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Changes take effect immediately across all branches and devices.
            </span>
            <button
              type="submit"
              className="primary"
              disabled={isSaving}
              style={{ padding: '8px 20px', fontWeight: 700 }}
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* NEW ADD-ON MODAL */}
      {showNewAddOnModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ font: '800 16px Manrope', margin: 0 }}>Add New Add-on</h2>
              <button
                type="button"
                onClick={() => setShowNewAddOnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateAddOn}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Add-on Name *</label>
                <input
                  type="text"
                  value={newAddOnName}
                  onChange={(e) => setNewAddOnName(e.target.value)}
                  placeholder="e.g. Extra Remote"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={newAddOnPrice}
                    onChange={(e) => setNewAddOnPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Pricing Type</label>
                  <select
                    value={newAddOnType}
                    onChange={(e) => setNewAddOnType(e.target.value)}
                  >
                    <option value="PER_HOUR">Per Hour</option>
                    <option value="PER_SESSION">Per Session</option>
                    <option value="PER_PERSON">Per Person</option>
                    <option value="FIXED_CHARGE">Fixed Charge</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Target Service (Category Name, optional)</label>
                <input
                  type="text"
                  value={newAddOnCategory}
                  onChange={(e) => setNewAddOnCategory(e.target.value)}
                  placeholder="e.g. PlayStation 5 (leave blank for all)"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={newAddOnDescription}
                  onChange={(e) => setNewAddOnDescription(e.target.value)}
                  placeholder="Additional wireless controller"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowNewAddOnModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Create Add-on
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
