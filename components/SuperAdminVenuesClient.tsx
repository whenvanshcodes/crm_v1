'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  Plus,
  X,
  Check,
  Power,
  Palette,
  Clock3,
  MapPin,
  Search,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  GitFork,
  Phone,
  Eye,
  SlidersHorizontal,
  Layers,
  ArrowRight
} from 'lucide-react'

export interface VenueItem {
  id: string
  businessId?: string | null
  business?: {
    id: string
    name: string
    displayName?: string | null
    phone?: string | null
    email?: string | null
  } | null
  name: string
  shortName?: string | null
  city?: string | null
  address?: string | null
  phone: string
  email?: string | null
  openingTime?: string
  closingTime?: string
  primaryColor?: string | null
  secondaryColor?: string | null
  logoUrl?: string | null
  coverImageUrl?: string | null
  dashboardHeroUrl?: string | null
  status: string
  createdAt: string
  owner?: { id: string; name: string; email: string; phone?: string | null } | null
  users: { id: string; name: string; email: string; phone?: string | null }[]
  _count: {
    resources: number
    customers: number
    sessions: number
  }
}

interface ParlourGroup {
  id: string
  name: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  city: string
  branches: VenueItem[]
}

interface SuperAdminVenuesClientProps {
  venues: VenueItem[]
}

export default function SuperAdminVenuesClient({
  venues: initialVenues
}: SuperAdminVenuesClientProps) {
  const [venues, setVenues] = useState<VenueItem[]>(initialVenues)
  const [searchQuery, setSearchQuery] = useState('')

  // Create Parlour Wizard State
  const [showWizardModal, setShowWizardModal] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [bizName, setBizName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [branchName, setBranchName] = useState('')
  const [branchCity, setBranchCity] = useState('Indore')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchOpeningTime, setBranchOpeningTime] = useState('10:00')
  const [branchClosingTime, setBranchClosingTime] = useState('23:00')
  const [createdResult, setCreatedResult] = useState<{ businessName: string; branchName: string } | null>(null)

  // Two-Step Add Branch Flow (Global vs Contextual)
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [addBranchStep, setAddBranchStep] = useState<1 | 2 | 3>(1)
  const [isContextualAdd, setIsContextualAdd] = useState(false)
  const [selectedParlourForBranch, setSelectedParlourForBranch] = useState<ParlourGroup | null>(null)
  const [parlourSearchQuery, setParlourSearchQuery] = useState('')

  // Branch form inputs
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchPhone, setNewBranchPhone] = useState('')
  const [newBranchCity, setNewBranchCity] = useState('Indore')
  const [newBranchAddress, setNewBranchAddress] = useState('')
  const [newBranchOpening, setNewBranchOpening] = useState('10:00')
  const [newBranchClosing, setNewBranchClosing] = useState('23:00')
  const [newBranchImage, setNewBranchImage] = useState('')
  const [addedBranchResult, setAddedBranchResult] = useState<{ parlourName: string; branchName: string } | null>(null)

  // Branding Modal State
  const [showBrandingModal, setShowBrandingModal] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<VenueItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editShortName, setEditShortName] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPrimaryColor, setEditPrimaryColor] = useState('#7c5cff')
  const [editSecondaryColor, setEditSecondaryColor] = useState('#080a0f')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('')
  const [editOpeningTime, setEditOpeningTime] = useState('10:00')
  const [editClosingTime, setEditClosingTime] = useState('23:00')

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Group venues by parlour (business)
  const parlourGroups = useMemo<ParlourGroup[]>(() => {
    const map = new Map<string, ParlourGroup>()

    for (const v of venues) {
      const bizId = v.businessId || v.business?.id || v.name.split('—')[0].trim().toLowerCase()
      const bizNameDisplay = v.business?.name || v.name.split('—')[0].trim()
      const owner = v.owner || v.users?.[0] || { name: 'Amit Sharma', email: '', phone: v.phone }

      if (!map.has(bizId)) {
        map.set(bizId, {
          id: v.businessId || v.business?.id || bizId,
          name: bizNameDisplay,
          ownerName: owner.name,
          ownerEmail: owner.email,
          ownerPhone: v.business?.phone || owner.phone || v.phone,
          city: v.city || 'Indore',
          branches: []
        })
      }

      map.get(bizId)!.branches.push(v)
    }

    return Array.from(map.values())
  }, [venues])

  // Filter parlours according to main search query
  const filteredParlours = useMemo(() => {
    if (!searchQuery.trim()) return parlourGroups
    const q = searchQuery.toLowerCase().trim()
    return parlourGroups.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.branches.some((b) => b.name.toLowerCase().includes(q) || (b.city && b.city.toLowerCase().includes(q)))
    )
  }, [parlourGroups, searchQuery])

  // Filter parlours for the Add Branch Step 1 selection modal
  const selectableParlours = useMemo(() => {
    if (!parlourSearchQuery.trim()) return parlourGroups
    const q = parlourSearchQuery.toLowerCase().trim()
    return parlourGroups.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
    )
  }, [parlourGroups, parlourSearchQuery])

  // Open Global Add Branch (Step 1: Select Parlour)
  function handleOpenGlobalAddBranch() {
    setIsContextualAdd(false)
    setSelectedParlourForBranch(null)
    setParlourSearchQuery('')
    setNewBranchName('')
    setNewBranchPhone('')
    setNewBranchCity('Indore')
    setNewBranchAddress('')
    setNewBranchOpening('10:00')
    setNewBranchClosing('23:00')
    setNewBranchImage('')
    setAddBranchStep(1)
    setShowAddBranchModal(true)
  }

  // Open Contextual Add Branch (Skip Step 1 directly to Step 2)
  function handleOpenContextualAddBranch(parlour: ParlourGroup) {
    setIsContextualAdd(true)
    setSelectedParlourForBranch(parlour)
    setNewBranchName('')
    setNewBranchPhone(parlour.ownerPhone || '')
    setNewBranchCity(parlour.city || 'Indore')
    setNewBranchAddress('')
    setNewBranchOpening('10:00')
    setNewBranchClosing('23:00')
    setNewBranchImage('')
    setAddBranchStep(2)
    setShowAddBranchModal(true)
  }

  function handleSelectParlour(parlour: ParlourGroup) {
    setSelectedParlourForBranch(parlour)
    setNewBranchPhone(parlour.ownerPhone || '')
    setNewBranchCity(parlour.city || 'Indore')
    setAddBranchStep(2)
  }

  async function handleAddBranchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedParlourForBranch) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/super-admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_branch',
          businessId: selectedParlourForBranch.id,
          branch: {
            name: newBranchName.trim(),
            phone: newBranchPhone.trim(),
            city: newBranchCity.trim(),
            address: newBranchAddress.trim() || undefined,
            openingTime: newBranchOpening,
            closingTime: newBranchClosing,
            coverImageUrl: newBranchImage.trim() || undefined,
            dashboardHeroUrl: newBranchImage.trim() || undefined
          }
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to add branch')
      }

      setAddedBranchResult({
        parlourName: selectedParlourForBranch.name,
        branchName: newBranchName.trim()
      })
      setAddBranchStep(3)

      const refreshRes = await fetch('/api/super-admin/venues')
      if (refreshRes.ok) setVenues(await refreshRes.json())
    } catch (err: any) {
      setError(err.message || 'Failed to add branch')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetWizard() {
    setBizName('')
    setOwnerName('')
    setOwnerPhone('')
    setOwnerEmail('')
    setBranchName('')
    setBranchCity('Indore')
    setBranchAddress('')
    setBranchOpeningTime('10:00')
    setBranchClosingTime('23:00')
    setCreatedResult(null)
    setCurrentStep(1)
    setError('')
  }

  function handleWizardStep1(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!bizName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      setError('Please fill in parlour name, owner name, and owner phone.')
      return
    }
    setCurrentStep(2)
  }

  async function handleWizardStep2(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!branchName.trim() || !branchCity.trim()) {
      setError('Please fill in branch name and city.')
      return
    }

    setIsSubmitting(true)

    const payload = {
      wizard: true,
      business: {
        name: bizName.trim(),
        displayName: bizName.trim(),
        phone: ownerPhone.trim(),
        email: ownerEmail.trim() || undefined
      },
      owner: {
        name: ownerName.trim(),
        phone: ownerPhone.trim(),
        email: ownerEmail.trim() || `${ownerPhone.trim()}@cueclub.local`,
        password: 'parlour_owner_initial_pass'
      },
      branch: {
        name: branchName.trim(),
        phone: ownerPhone.trim(),
        city: branchCity.trim(),
        address: branchAddress.trim() || undefined,
        openingTime: branchOpeningTime || '10:00',
        closingTime: branchClosingTime || '23:00'
      }
    }

    try {
      const res = await fetch('/api/super-admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create parlour')
      }

      const data = await res.json()
      setCreatedResult({
        businessName: data.business?.name || bizName,
        branchName: data.branch?.name || branchName
      })
      setCurrentStep(3)
      setNotice(`✓ ${bizName} created successfully!`)

      const refreshRes = await fetch('/api/super-admin/venues')
      if (refreshRes.ok) {
        setVenues(await refreshRes.json())
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create parlour')
    } finally {
      setIsSubmitting(false)
    }
  }

  function openBrandingConfig(v: VenueItem) {
    setSelectedVenue(v)
    setEditName(v.name)
    setEditShortName(v.shortName || '')
    setEditCity(v.city || 'Indore')
    setEditAddress(v.address || '')
    setEditPrimaryColor(v.primaryColor || '#7c5cff')
    setEditSecondaryColor(v.secondaryColor || '#080a0f')
    setEditLogoUrl(v.logoUrl || '')
    setEditCoverImageUrl(v.coverImageUrl || '')
    setEditOpeningTime(v.openingTime || '10:00')
    setEditClosingTime(v.closingTime || '23:00')
    setShowBrandingModal(true)
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedVenue) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/super-admin/venues/${selectedVenue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          shortName: editShortName,
          city: editCity,
          address: editAddress,
          primaryColor: editPrimaryColor,
          secondaryColor: editSecondaryColor,
          logoUrl: editLogoUrl,
          coverImageUrl: editCoverImageUrl,
          dashboardHeroUrl: editCoverImageUrl,
          openingTime: editOpeningTime,
          closingTime: editClosingTime
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to update parlour branding')
      }

      setNotice(`Updated settings and branding for "${editName}"`)
      setShowBrandingModal(false)
      const refreshRes = await fetch('/api/super-admin/venues')
      if (refreshRes.ok) setVenues(await refreshRes.json())
    } catch (err: any) {
      setError(err.message || 'Failed to update branding')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleStatus(v: VenueItem) {
    const nextStatus = v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/super-admin/venues/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      if (!res.ok) throw new Error('Status change failed')
      setVenues(venues.map((x) => (x.id === v.id ? { ...x, status: nextStatus } : x)))
      setNotice(`Updated "${v.name}" status to ${nextStatus}`)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {notice && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            color: '#4ade80',
            borderRadius: 10,
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            borderRadius: 10,
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} color="#7c5cff" />
            <h2 style={{ font: '800 20px Manrope', margin: 0, color: 'var(--text-primary)' }}>
              PARLOURS
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Super Admin platform management: manage registered parlours and branch locations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="secondary"
            onClick={handleOpenGlobalAddBranch}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={15} /> + Add Branch
          </button>

          <button
            type="button"
            className="primary"
            onClick={() => {
              setCurrentStep(1)
              setShowWizardModal(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Building2 size={15} /> + Create Parlour
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '8px 14px',
          maxWidth: 480
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search parlours by name or owner..."
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            width: '100%'
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* COMPACT HIERARCHICAL PARLOUR & BRANCH VIEW (Section 4) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredParlours.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--panel-bg)',
              border: '1px dashed var(--border-color)',
              borderRadius: 12
            }}
          >
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
              {searchQuery ? `No parlours matching "${searchQuery}"` : 'No parlours found on platform.'}
            </p>
          </div>
        ) : (
          filteredParlours.map((parlour) => (
            <div
              key={parlour.id}
              style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.2s ease'
              }}
            >
              {/* Parlour Header Card */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--panel-subtle)',
                  borderBottom: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {parlour.name}
                    </h3>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: 'rgba(124, 92, 255, 0.12)',
                        border: '1px solid rgba(124, 92, 255, 0.25)',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#a78bfa'
                      }}
                    >
                      {parlour.branches.length} {parlour.branches.length === 1 ? 'branch' : 'branches'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Owner: <strong style={{ color: 'var(--text-secondary)' }}>{parlour.ownerName}</strong></span>
                    {parlour.ownerPhone && <span>· Phone: {parlour.ownerPhone}</span>}
                    {parlour.city && <span>· Location: {parlour.city}</span>}
                  </div>
                </div>

                {/* Parlour Level Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link
                    href={`/dashboard`}
                    className="secondary"
                    style={{ padding: '6px 12px', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                  >
                    <Eye size={13} style={{ marginRight: 4 }} /> View
                  </Link>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleOpenContextualAddBranch(parlour)}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#7c5cff' }}
                  >
                    <Plus size={13} style={{ marginRight: 3 }} /> + Add Branch
                  </button>
                </div>
              </div>

              {/* Indented Branches Hierarchy */}
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parlour.branches.map((branch, idx) => {
                  const isLast = idx === parlour.branches.length - 1
                  const treePrefix = isLast ? '└─' : '├─'
                  return (
                    <div
                      key={branch.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 8,
                        flexWrap: 'wrap',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            color: '#7c5cff',
                            fontSize: 14,
                            fontWeight: 700,
                            userSelect: 'none'
                          }}
                        >
                          {treePrefix}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              {branch.name}
                            </strong>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              · {branch.city || 'Indore'}
                            </span>
                            <span
                              className={`status-pill ${branch.status.toLowerCase()}`}
                              style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase'
                              }}
                            >
                              {branch.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Hours: {branch.openingTime || '10:00'} – {branch.closingTime || '23:00'} ·{' '}
                            {branch._count.resources} resources
                          </div>
                        </div>
                      </div>

                      {/* Branch Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => openBrandingConfig(branch)}
                          title="Configure Branding & Details"
                        >
                          <Palette size={12} style={{ marginRight: 4 }} /> Branding
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => toggleStatus(branch)}
                          title={branch.status === 'ACTIVE' ? 'Deactivate Branch' : 'Activate Branch'}
                        >
                          <Power
                            size={12}
                            color={branch.status === 'ACTIVE' ? '#ef4444' : '#10b981'}
                            style={{ marginRight: 4 }}
                          />
                          {branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* TWO-STEP ADD BRANCH MODAL (Section 2) */}
      {showAddBranchModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 520,
              width: '92%',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--panel-subtle)'
              }}
            >
              <div>
                <h2 style={{ font: '800 16px Manrope', margin: 0, color: 'var(--text-primary)' }}>
                  ADD BRANCH
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {addBranchStep === 1 && 'Select Parlour'}
                  {addBranchStep === 2 && (
                    <span>
                      <strong style={{ color: '#7c5cff' }}>{selectedParlourForBranch?.name}</strong> · Add a new branch
                    </span>
                  )}
                  {addBranchStep === 3 && 'Branch Created'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  margin: '12px 24px 0',
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  borderRadius: 8,
                  fontSize: 12
                }}
              >
                {error}
              </div>
            )}

            {/* STEP 1: SELECT PARLOUR (Global flow only) */}
            {addBranchStep === 1 && (
              <div style={{ padding: '20px 24px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                  Which parlour do you want to add this branch to?
                </p>

                {/* Search input */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--panel-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 16
                  }}
                >
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={parlourSearchQuery}
                    onChange={(e) => setParlourSearchQuery(e.target.value)}
                    placeholder="Search by parlour name / owner..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>

                {/* Compact Parlour Selection Entries */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    maxHeight: 320,
                    overflowY: 'auto'
                  }}
                >
                  {selectableParlours.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'var(--panel-subtle)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.ownerName} · {p.branches.length} {p.branches.length === 1 ? 'branch' : 'branches'}
                          {p.city ? ` · ${p.city}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleSelectParlour(p)}
                        style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700 }}
                      >
                        SELECT
                      </button>
                    </div>
                  ))}

                  {selectableParlours.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                      No matching parlours found.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowAddBranchModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BRANCH DETAILS (Selected Parlour) */}
            {addBranchStep === 2 && selectedParlourForBranch && (
              <form onSubmit={handleAddBranchSubmit} style={{ padding: '20px 24px' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(124, 92, 255, 0.08)',
                    border: '1px solid rgba(124, 92, 255, 0.2)',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#c4b5fd'
                  }}
                >
                  Adding branch to: <strong style={{ color: '#fff' }}>{selectedParlourForBranch.name}</strong>
                  {selectedParlourForBranch.ownerName && ` (Owner: ${selectedParlourForBranch.ownerName})`}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Branch Name *
                    </label>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g. Vijay Nagar"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Phone
                      </label>
                      <input
                        type="text"
                        value={newBranchPhone}
                        onChange={(e) => setNewBranchPhone(e.target.value)}
                        placeholder="9999990003"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        City *
                      </label>
                      <input
                        type="text"
                        value={newBranchCity}
                        onChange={(e) => setNewBranchCity(e.target.value)}
                        placeholder="Indore"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      placeholder="Street and locality"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Opening Time
                      </label>
                      <input
                        type="time"
                        value={newBranchOpening}
                        onChange={(e) => setNewBranchOpening(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Closing Time
                      </label>
                      <input
                        type="time"
                        value={newBranchClosing}
                        onChange={(e) => setNewBranchClosing(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Optional Branch Image URL
                    </label>
                    <input
                      type="url"
                      value={newBranchImage}
                      onChange={(e) => setNewBranchImage(e.target.value)}
                      placeholder="https://..."
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Images are completely optional. Leave blank if none.
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  {isContextualAdd ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setShowAddBranchModal(false)}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setAddBranchStep(1)}
                    >
                      <ChevronLeft size={14} /> Back
                    </button>
                  )}

                  <button
                    type="submit"
                    className="primary"
                    disabled={isSubmitting}
                    style={{ fontWeight: 700 }}
                  >
                    {isSubmitting ? 'Creating Branch...' : 'Create Branch'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SUCCESS (Section 2 Step 3) */}
            {addBranchStep === 3 && addedBranchResult && (
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#4ade80',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid rgba(34, 197, 94, 0.25)'
                  }}
                >
                  <Check size={26} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                  Branch created successfully.
                </h3>
                <div
                  style={{
                    display: 'inline-block',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    background: 'var(--panel-subtle)',
                    border: '1px solid var(--border-color)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    color: '#c4b5fd',
                    margin: '8px 0 24px',
                    textAlign: 'left'
                  }}
                >
                  <div>{addedBranchResult.parlourName}</div>
                  <div style={{ color: '#4ade80' }}>└── {addedBranchResult.branchName}</div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
                  Branch resources, pricing, and add-ons are managed by the parlour owner/manager.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setShowAddBranchModal(false)
                      setAddBranchStep(1)
                    }}
                    style={{ fontWeight: 700 }}
                  >
                    Return to Manage Parlours
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3-STEP CREATE PARLOUR WIZARD MODAL */}
      {showWizardModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 540,
              width: '92%',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--panel-subtle)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <h2 style={{ font: '800 18px Manrope', margin: 0, color: 'var(--text-primary)' }}>
                    Create Parlour
                  </h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {currentStep === 1 && 'Step 1 of 3: Business & Owner'}
                    {currentStep === 2 && 'Step 2 of 3: Set up your first branch'}
                    {currentStep === 3 && 'Step 3 of 3: Setup Complete'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowWizardModal(false)
                    resetWizard()
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Progress Indicator */}
              <div style={{ display: 'flex', gap: 6, height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2 }}>
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      background: s <= currentStep ? '#7c5cff' : 'transparent',
                      borderRadius: 2,
                      transition: 'background 0.2s ease'
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div
                style={{
                  margin: '12px 24px 0',
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  borderRadius: 8,
                  fontSize: 12
                }}
              >
                {error}
              </div>
            )}

            {/* STEP 1: CREATE PARLOUR */}
            {currentStep === 1 && (
              <form onSubmit={handleWizardStep1} style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label>
                    Parlour Name *
                    <input
                      type="text"
                      value={bizName}
                      onChange={(e) => setBizName(e.target.value)}
                      placeholder="e.g. Cue Club"
                      required
                    />
                  </label>

                  <label>
                    Owner Name *
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Amit Sharma"
                      required
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label>
                      Owner Phone *
                      <input
                        type="text"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                        placeholder="e.g. 9999990001"
                        required
                      />
                    </label>

                    <label>
                      Owner Email (Optional)
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@cueclub.in"
                      />
                    </label>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setShowWizardModal(false)
                      resetWizard()
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary" style={{ fontWeight: 700 }}>
                    Continue <ChevronRight size={15} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: FIRST BRANCH */}
            {currentStep === 2 && (
              <form onSubmit={handleWizardStep2} style={{ padding: '20px 24px' }}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                    Set up your first branch
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Enter initial location details for {bizName}.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <label>
                      Branch Name *
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. Vijay Nagar"
                        required
                      />
                    </label>

                    <label>
                      City *
                      <input
                        type="text"
                        value={branchCity}
                        onChange={(e) => setBranchCity(e.target.value)}
                        placeholder="e.g. Indore"
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Address
                    <input
                      type="text"
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="e.g. 102 Scheme 54, Near Velocity III"
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label>
                      Opening Time
                      <input
                        type="time"
                        value={branchOpeningTime}
                        onChange={(e) => setBranchOpeningTime(e.target.value)}
                      />
                    </label>

                    <label>
                      Closing Time
                      <input
                        type="time"
                        value={branchClosingTime}
                        onChange={(e) => setBranchClosingTime(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  <button type="button" className="secondary" onClick={() => setCurrentStep(1)}>
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button type="submit" className="primary" disabled={isSubmitting} style={{ fontWeight: 700 }}>
                    {isSubmitting ? 'Creating Parlour...' : 'Create Parlour'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SUCCESS */}
            {currentStep === 3 && (
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#4ade80',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid rgba(34, 197, 94, 0.25)'
                  }}
                >
                  <Check size={30} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                  ✓ {createdResult?.businessName || bizName} created
                </h3>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                  {createdResult?.branchName || branchName} branch is ready.
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
                  Resources and pricing can now be configured by the parlour owner.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setShowWizardModal(false)
                      resetWizard()
                    }}
                    style={{ fontWeight: 700 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BRANDING EDIT MODAL */}
      {showBrandingModal && selectedVenue && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxWidth: 540,
              width: '92%',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--panel-subtle)'
              }}
            >
              <h2 style={{ font: '800 16px Manrope', margin: 0, color: 'var(--text-primary)' }}>
                Configure Branch Details & Branding
              </h2>
              <button
                type="button"
                onClick={() => setShowBrandingModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBranding} style={{ padding: '20px 24px' }}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Branch Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Primary Brand Colour
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={editPrimaryColor}
                      onChange={(e) => setEditPrimaryColor(e.target.value)}
                      style={{ width: 42, height: 38, padding: 2, background: 'transparent', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={editPrimaryColor}
                      onChange={(e) => setEditPrimaryColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Secondary Colour
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                      style={{ width: 42, height: 38, padding: 2, background: 'transparent', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Optional Cover Image URL
                </label>
                <input
                  type="url"
                  value={editCoverImageUrl}
                  onChange={(e) => setEditCoverImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={editOpeningTime}
                    onChange={(e) => setEditOpeningTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={editClosingTime}
                    onChange={(e) => setEditClosingTime(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border-color)'
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowBrandingModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={isSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Branding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
