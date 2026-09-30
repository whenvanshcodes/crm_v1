'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Gamepad2,
  CreditCard,
  BarChart3,
  Shield,
  Settings,
  Command,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building,
  Check,
  Plus,
  Sun,
  Moon,
  Laptop,
  Layers,
  User as UserIcon
} from 'lucide-react'
import { applyTheme, getThemePreference, ThemeMode } from '@/lib/theme'
import { SafeImage } from './SafeImage'

export interface VenueOption {
  id: string
  name: string
  shortName: string | null
  city: string | null
  status: string
  primaryColor: string | null
  logoUrl?: string | null
}

export interface UserContextData {
  userId: string
  name: string
  email?: string | null
  phone?: string | null
  role: string
  venueId: string | null
  venueName?: string
  activeVenue?: {
    id: string
    name: string
    shortName: string | null
    city: string | null
    address: string | null
    phone: string
    email: string | null
    currency: string
    openingTime: string
    closingTime: string
    primaryColor: string | null
    secondaryColor: string | null
    logoUrl: string | null
    coverImageUrl: string | null
    dashboardHeroUrl: string | null
  } | null
  venues?: VenueOption[]
  activeSessionsCount?: number
}

interface AppShellProps {
  user: UserContextData
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
  children: React.ReactNode
}

export default function AppShell({
  user,
  title,
  subtitle,
  headerAction,
  children
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [addParlourOpen, setAddParlourOpen] = useState(false)
  const [newParlourLoading, setNewParlourLoading] = useState(false)
  const [newParlourData, setNewParlourData] = useState({
    name: '',
    shortName: '',
    city: 'Indore',
    phone: '',
    address: '',
    primaryColor: '#10b981'
  })

  const venueRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTheme(getThemePreference())

    function handleClickOutside(e: MouseEvent) {
      if (venueRef.current && !venueRef.current.contains(e.target as Node)) {
        setVenueDropdownOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleThemeChange(newTheme: ThemeMode) {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  async function handleSwitchVenue(venueId: string) {
    try {
      const res = await fetch('/api/auth/switch-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId })
      })
      if (res.ok) {
        setVenueDropdownOpen(false)
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to switch venue', err)
    }
  }

  async function handleCreateParlour(e: React.FormEvent) {
    e.preventDefault()
    setNewParlourLoading(true)
    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParlourData)
      })
      if (res.ok) {
        setAddParlourOpen(false)
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create parlour')
      }
    } catch {
      alert('Error creating parlour')
    } finally {
      setNewParlourLoading(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN'
  const currentVenueName =
    user.activeVenue?.name || user.venueName || (isSuperAdmin ? 'Platform Admin' : 'My Parlour')
  const currentVenueCity = user.activeVenue?.city || 'Indore'
  const brandShortName = user.activeVenue?.shortName || currentVenueName
  const brandPrimaryColor = user.activeVenue?.primaryColor || '#6d5ce8'

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navGroups = isSuperAdmin
    ? [
        {
          group: 'Platform',
          items: [
            { name: 'Super Admin', href: '/super-admin', icon: Shield },
            { name: 'Manage Parlours', href: '/super-admin/venues', icon: Building },
            { name: 'My Parlours Portfolio', href: '/my-parlours', icon: Layers }
          ]
        },
        {
          group: 'Operations',
          items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            {
              name: 'Bookings & Sessions',
              href: '/bookings',
              icon: CalendarDays,
              count: user.activeSessionsCount
            },
            { name: 'Customers', href: '/customers', icon: Users },
            { name: 'Resources', href: '/resources', icon: Gamepad2 },
            { name: 'Reports', href: '/reports', icon: BarChart3 }
          ]
        },
        {
          group: 'Settings',
          items: [{ name: 'Parlour Settings', href: '/settings', icon: Settings }]
        }
      ]
    : [
        {
          group: 'Operations',
          items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            {
              name: 'Bookings & Sessions',
              href: '/bookings',
              icon: CalendarDays,
              count: user.activeSessionsCount
            },
            { name: 'Customers', href: '/customers', icon: Users },
            { name: 'Resources', href: '/resources', icon: Gamepad2 },
            { name: 'Reports', href: '/reports', icon: BarChart3 }
          ]
        },
        {
          group: 'Settings',
          items: [
            { name: 'Parlour Settings', href: '/settings', icon: Settings },
            ...(user.role === 'OWNER'
              ? [{ name: 'My Parlours', href: '/my-parlours', icon: Layers }]
              : [])
          ]
        }
      ]

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })

  const currentPathSegment = pathname.split('/')[1] || 'dashboard'
  const computedTitle =
    title ||
    (currentPathSegment === 'bookings'
      ? 'Bookings & Sessions'
      : currentPathSegment === 'settings'
      ? 'Parlour Settings'
      : currentPathSegment === 'my-parlours'
      ? 'My Parlours'
      : currentPathSegment.charAt(0).toUpperCase() +
        currentPathSegment.slice(1).replace('-', ' '))

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'show' : ''}`}>
        <div className="brand">
          <div
            className="brandmark"
            style={{
              background: brandPrimaryColor,
              boxShadow: `0 4px 12px ${brandPrimaryColor}40`
            }}
          >
            <SafeImage
              src={user.activeVenue?.logoUrl}
              alt="Logo"
              style={{ width: 22, height: 22, objectFit: 'contain' }}
              fallback={<Command size={19} />}
            />
          </div>
          <div className="brandname">
            {brandShortName}
            <span>.</span>
            <small>{(user.activeVenue?.city || 'PARLOUR').toUpperCase()} · OPERATIONS</small>
          </div>
          <button
            className="close-mobile icon-button"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Venue Switcher Dropdown */}
        <div style={{ position: 'relative' }} ref={venueRef}>
          <div
            className="venue-select"
            style={{ cursor: 'pointer' }}
            onClick={() => setVenueDropdownOpen(!venueDropdownOpen)}
          >
            <span
              className="venue-icon"
              style={{
                background: `${brandPrimaryColor}18`,
                color: brandPrimaryColor
              }}
            >
              {currentVenueName[0]}
            </span>
            <span>
              <b>{currentVenueName}</b>
              <small>{currentVenueCity} ▾</small>
            </span>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </div>

          {venueDropdownOpen && (
            <div
              className="dropdown-menu"
              style={{ top: '100%', left: 0, right: 0, marginTop: -18 }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: '#8f95a5'
                }}
              >
                AVAILABLE PARLOURS
              </div>
              {user.venues && user.venues.length > 0 ? (
                user.venues.map((v) => {
                  const isCurrent = v.id === user.venueId
                  return (
                    <button
                      key={v.id}
                      className={`dropdown-item ${isCurrent ? 'active' : ''}`}
                      onClick={() => handleSwitchVenue(v.id)}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: v.primaryColor || '#10b981'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: isCurrent ? 700 : 500 }}>{v.name}</div>
                        <small style={{ opacity: 0.7 }}>{v.city || 'Indore'}</small>
                      </div>
                      {isCurrent && <Check size={14} />}
                    </button>
                  )
                })
              ) : (
                <div style={{ padding: '8px 14px', fontSize: '11px', color: '#888' }}>
                  {currentVenueName}
                </div>
              )}

              <div className="dropdown-divider" />

              {(user.role === 'OWNER' || isSuperAdmin) && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setVenueDropdownOpen(false)
                    setAddParlourOpen(true)
                  }}
                  style={{ color: '#6d5ce8', fontWeight: 600 }}
                >
                  <Plus size={14} />
                  <span>+ Add another parlour</span>
                </button>
              )}

              <Link
                href={isSuperAdmin ? '/super-admin/venues' : '/my-parlours'}
                className="dropdown-item"
                onClick={() => setVenueDropdownOpen(false)}
              >
                <Layers size={14} />
                <span>Manage parlours</span>
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        {navGroups.map((grp) => (
          <div className="nav-group" key={grp.group}>
            <div className="nav-label">{grp.group}</div>
            {grp.items.map((item) => {
              const Icon = item.icon
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  item.href !== '/super-admin' &&
                  pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="nav-count">{item.count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}

        {/* Sidebar Bottom Profile trigger */}
        <div className="sidebar-bottom">
          <div
            className="profile"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            title="Profile Menu"
          >
            <div className="avatar">{initials}</div>
            <span>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </span>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        {/* Top Header */}
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="breadcrumbs">
            <span>{currentVenueName}</span>
            <b>/</b>
            <span>{computedTitle}</span>
          </div>

          <div className="top-actions">
            <span className="today-label">{todayFormatted}</span>

            {/* Profile Dropdown Container */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <div
                className="top-avatar"
                style={{ cursor: 'pointer' }}
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                {initials}
              </div>

              {profileDropdownOpen && (
                <div
                  className="dropdown-menu"
                  style={{ top: '100%', right: 0, marginTop: 10, minWidth: 230 }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary, #f8fafc)' }}>{user.name}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2 }}>
                      {user.email || user.phone || user.role}
                    </div>
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(124, 92, 255, 0.16)',
                        color: 'var(--primary-accent, #7c5cff)',
                        fontWeight: 600,
                        marginTop: 6
                      }}
                    >
                      {user.role}
                    </div>
                  </div>

                  <Link
                    href="/settings"
                    className="dropdown-item"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <UserIcon size={14} />
                    <span>My Profile</span>
                  </Link>

                  {(user.role === 'OWNER' || isSuperAdmin) && (
                    <Link
                      href="/my-parlours"
                      className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Layers size={14} />
                      <span>My Business</span>
                    </Link>
                  )}

                  {/* Appearance Mode */}
                  <div style={{ padding: '8px 14px', fontSize: '10px' }}>
                    <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
                      APPEARANCE
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        background: 'var(--panel-subtle, #11151e)',
                        borderRadius: 6,
                        padding: 2,
                        gap: 2,
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
                      }}
                    >
                      <button
                        onClick={() => handleThemeChange('light')}
                        style={{
                          flex: 1,
                          border: 0,
                          padding: '5px 0',
                          borderRadius: 5,
                          background: theme === 'light' ? 'var(--panel-bg, #fff)' : 'none',
                          color: theme === 'light' ? 'var(--text-primary, #000)' : 'var(--text-secondary, #94a3b8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: theme === 'light' ? 700 : 400
                        }}
                      >
                        <Sun size={12} /> Light
                      </button>
                      <button
                        onClick={() => handleThemeChange('dark')}
                        style={{
                          flex: 1,
                          border: 0,
                          padding: '5px 0',
                          borderRadius: 5,
                          background: theme === 'dark' ? 'var(--primary-accent, #7c5cff)' : 'none',
                          color: theme === 'dark' ? '#fff' : 'var(--text-secondary, #94a3b8)',
                          boxShadow: theme === 'dark' ? '0 0 10px rgba(124, 92, 255, 0.35)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: theme === 'dark' ? 700 : 400
                        }}
                      >
                        <Moon size={12} /> Dark
                      </button>
                      <button
                        onClick={() => handleThemeChange('system')}
                        style={{
                          flex: 1,
                          border: 0,
                          padding: '5px 0',
                          borderRadius: 5,
                          background: theme === 'system' ? 'var(--panel-bg, #0d1017)' : 'none',
                          color: theme === 'system' ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: theme === 'system' ? 700 : 400
                        }}
                      >
                        <Laptop size={12} /> System
                      </button>
                    </div>
                  </div>

                  <Link
                    href="/settings"
                    className="dropdown-item"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <Settings size={14} />
                    <span>Account Settings</span>
                  </Link>

                  <div className="dropdown-divider" />

                  <button
                    className="dropdown-item"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    style={{ color: '#ef4444' }}
                  >
                    <LogOut size={14} />
                    <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">
          <div className="page-head">
            <div>
              <div className="eyebrow">
                {isSuperAdmin
                  ? 'PLATFORM MANAGEMENT'
                  : `${currentVenueName.toUpperCase()} · ${currentVenueCity.toUpperCase()}`}
              </div>
              <h1>{computedTitle}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {headerAction && <div className="head-actions">{headerAction}</div>}
          </div>

          {children}
        </div>
      </main>

      {/* Modal: Add Another Parlour */}
      {addParlourOpen && (
        <div className="modal-backdrop" onClick={() => setAddParlourOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Create New Parlour</h2>
                <p style={{ margin: 0, color: '#888', fontSize: 11 }}>
                  Add another recreational parlour to your portfolio
                </p>
              </div>
              <button className="icon-button" onClick={() => setAddParlourOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateParlour} className="modal-form">
              <label>
                Parlour Name *
                <input
                  required
                  placeholder="e.g. Royal Cue Lounge"
                  value={newParlourData.name}
                  onChange={(e) =>
                    setNewParlourData({ ...newParlourData, name: e.target.value })
                  }
                />
              </label>

              <div className="form-two">
                <label>
                  Short Name
                  <input
                    placeholder="e.g. Royal Cue"
                    value={newParlourData.shortName}
                    onChange={(e) =>
                      setNewParlourData({ ...newParlourData, shortName: e.target.value })
                    }
                  />
                </label>
                <label>
                  City
                  <input
                    required
                    placeholder="e.g. Indore"
                    value={newParlourData.city}
                    onChange={(e) =>
                      setNewParlourData({ ...newParlourData, city: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="form-two">
                <label>
                  Contact Phone *
                  <input
                    required
                    placeholder="e.g. 9876543210"
                    value={newParlourData.phone}
                    onChange={(e) =>
                      setNewParlourData({ ...newParlourData, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Brand Accent Colour
                  <input
                    type="color"
                    value={newParlourData.primaryColor}
                    onChange={(e) =>
                      setNewParlourData({ ...newParlourData, primaryColor: e.target.value })
                    }
                    style={{ padding: 4, height: 38 }}
                  />
                </label>
              </div>

              <label>
                Full Address
                <input
                  placeholder="Street address, landmark, area"
                  value={newParlourData.address}
                  onChange={(e) =>
                    setNewParlourData({ ...newParlourData, address: e.target.value })
                  }
                />
              </label>

              <div className="modal-note">
                <Building size={16} />
                <span>
                  Initializes standard Snooker & Pool categories with 1 active table. You can add
                  more resources in Settings.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setAddParlourOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={newParlourLoading}>
                  {newParlourLoading ? 'Creating...' : 'Create Parlour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
