'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, X, Layers, Check, AlertCircle, Tag, Trash2, CheckCircle2 } from 'lucide-react'
import { SafeImage } from './SafeImage'
import { ResourceCategoryIcon } from './ResourceCategoryIcon'
import { ImageUpload } from './ImageUpload'

export interface ResourceItem {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  status: string
  category?: { id: string; name: string } | null
  pricingRules: { id: string; rate: number; active: boolean }[]
  sessions?: {
    id: string
    startedAt: string
    customer: { id: string; name: string; phone: string }
  }[]
}

export interface AddOnItemData {
  id: string
  name: string
  description?: string | null
  pricingType: string
  price: number
  active: boolean
  categoryName?: string | null
}

const BILLING_TYPES = [
  { value: 'PER_HOUR', label: 'Per Hour (/hr)' },
  { value: 'PER_SESSION', label: 'Per Session (/session)' },
  { value: 'PER_PERSON', label: 'Per Person (/person)' },
  { value: 'FIXED_CHARGE', label: 'Fixed Charge (one-time)' }
]

function formatPricingType(type: string, price: number) {
  switch (type) {
    case 'PER_HOUR':
      return `₹${price}/hr`
    case 'PER_SESSION':
      return `₹${price}/session`
    case 'PER_PERSON':
      return `₹${price}/person`
    case 'FIXED_CHARGE':
      return `₹${price} fixed`
    default:
      return `₹${price}`
  }
}

interface ResourcesClientProps {
  resources: ResourceItem[]
  categories: { id: string; name: string }[]
  initialAddOns?: AddOnItemData[]
}

export default function ResourcesClient({
  resources: initialResources,
  categories,
  initialAddOns = []
}: ResourcesClientProps) {
  const [resources, setResources] = useState<ResourceItem[]>(initialResources)
  const [addOns, setAddOns] = useState<AddOnItemData[]>(initialAddOns)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null)
  const [addOnModalResource, setAddOnModalResource] = useState<ResourceItem | null>(null)
  const [showGlobalAddOnModal, setShowGlobalAddOnModal] = useState(false)

  // Add Form
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('PS5')
  const [rate, setRate] = useState('120')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Add-on Form state (for Resource Add-on Modal & Header Modal)
  const [addOnName, setAddOnName] = useState('')
  const [addOnPrice, setAddOnPrice] = useState('60')
  const [addOnType, setAddOnType] = useState('PER_HOUR')
  const [addOnCategory, setAddOnCategory] = useState('')
  const [isSubmittingAddOn, setIsSubmittingAddOn] = useState(false)
  const [addOnNotice, setAddOnNotice] = useState('')
  const [addOnError, setAddOnError] = useState('')

  // Inline Add-on state inside Single Resource Create / Edit Modals
  const [showInlineAddOn, setShowInlineAddOn] = useState(false)
  const [inlineAddOnName, setInlineAddOnName] = useState('')
  const [inlineAddOnPrice, setInlineAddOnPrice] = useState('60')
  const [inlineAddOnType, setInlineAddOnType] = useState('PER_HOUR')
  const [isSubmittingInlineAddOn, setIsSubmittingInlineAddOn] = useState(false)

  // Bulk Form
  const [bulkCategory, setBulkCategory] = useState('PS5')
  const [bulkPrefix, setBulkPrefix] = useState('PS5 Lounge')
  const [bulkQty, setBulkQty] = useState(6)
  const [bulkRate, setBulkRate] = useState('120')
  const [bulkImageUrl, setBulkImageUrl] = useState<string | null>(null)

  // Edit Form
  const [editName, setEditName] = useState('')
  const [editRate, setEditRate] = useState('120')
  const [editStatus, setEditStatus] = useState('AVAILABLE')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Unique categories
  const allCategoryNames = Array.from(
    new Set([
      ...categories.map((c) => c.name),
      ...resources.map((r) => r.category?.name).filter((n): n is string => Boolean(n))
    ])
  )

  const filtered =
    filterCategory === 'ALL'
      ? resources
      : resources.filter((r) => r.category?.name === filterCategory)

  function getCategoryAddOns(catName?: string | null) {
    if (!catName) return addOns
    const lower = catName.trim().toLowerCase()
    return addOns.filter((a) => !a.categoryName || a.categoryName.trim().toLowerCase() === lower)
  }

  async function handleCreateAddOnSubmit(
    categoryToUse: string,
    nameToUse: string,
    priceToUse: number,
    typeToUse: string
  ) {
    if (!nameToUse.trim()) throw new Error('Please enter an add-on name')
    if (isNaN(priceToUse) || priceToUse < 0) throw new Error('Please enter a valid price')

    const res = await fetch('/api/add-ons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameToUse.trim(),
        price: priceToUse,
        pricingType: typeToUse,
        categoryName: categoryToUse ? categoryToUse.trim() : undefined
      })
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create add-on')

    setAddOns((prev) => [data, ...prev])
    return data
  }

  async function handleDeleteAddOn(id: string) {
    if (!confirm('Deactivate this add-on?')) return
    try {
      const res = await fetch(`/api/add-ons/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to deactivate add-on')
      setAddOns((prev) => prev.filter((a) => a.id !== id))
      setNotice('✓ Add-on deactivated')
    } catch (err: any) {
      setError(err.message || 'Error deactivating add-on')
    }
  }

  // Create single resource
  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          categoryName: categoryName.trim(),
          hourlyRate: Number(rate),
          imageUrl: imageUrl || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create resource')

      setResources((prev) => [...prev, { ...data, sessions: [] }])
      setShowAddModal(false)
      setName('')
      setImageUrl(null)
      setNotice(`✓ ${data.name} added!`)
    } catch (err: any) {
      setError(err.message || 'Failed to create')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk create
  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/resources/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: bulkCategory.trim(),
          namePrefix: bulkPrefix.trim(),
          quantity: Number(bulkQty),
          hourlyRate: Number(bulkRate),
          imageUrl: bulkImageUrl || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to bulk create')

      setResources((prev) => [...prev, ...data.map((r: any) => ({ ...r, sessions: [] }))])
      setShowAddModal(false)
      setBulkImageUrl(null)
      setNotice(`✓ Created ${data.length} resources!`)
    } catch (err: any) {
      setError(err.message || 'Failed to bulk create')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit
  function handleOpenEdit(r: ResourceItem) {
    setEditingResource(r)
    setEditName(r.name)
    const activeRate = r.pricingRules.find((pr) => pr.active)?.rate ?? 120
    setEditRate(String(activeRate))
    setEditStatus(r.status)
    setEditImageUrl(r.imageUrl || null)
    setError('')
  }

  // Save Edit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingResource) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/resources/${editingResource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          status: editStatus,
          hourlyRate: Number(editRate),
          imageUrl: editImageUrl ?? ''
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setResources((prev) =>
        prev.map((r) => (r.id === editingResource.id ? { ...r, ...data } : r))
      )
      setEditingResource(null)
      setNotice(`✓ ${editName} updated!`)
    } catch (err: any) {
      setError(err.message || 'Update failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick toggle status
  async function handleToggleStatus(r: ResourceItem) {
    const nextStatus = r.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE'
    try {
      const res = await fetch(`/api/resources/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })

      if (!res.ok) throw new Error('Status update failed')

      setResources((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, status: nextStatus } : item))
      )
      setNotice(`Status changed to ${nextStatus}`)
    } catch {
      setNotice('Could not change status')
    }
  }

  // Empty state
  if (resources.length === 0) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: '30px 16px' }}>
        <h2 style={{ font: '900 22px Manrope', marginBottom: 6 }}>Set up your resources</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
          Add gaming consoles, PCs, or pool tables for this parlour.
        </p>
        <button
          type="button"
          onClick={() => {
            setAddMode('single')
            setShowAddModal(true)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#10b981',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> + Add Resource
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            padding: '8px 14px',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header: RESOURCES & [+ Add] */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-color, #e2e8f0)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2
            style={{
              font: '900 20px Manrope',
              margin: 0,
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}
          >
            RESOURCES
          </h2>

          {/* Tiny Filter if > 4 resources */}
          {allCategoryNames.length > 1 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                height: 30,
                fontSize: 12,
                fontWeight: 600,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--panel-bg, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All ({resources.length})</option>
              {allCategoryNames.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setAddOnCategory(filterCategory !== 'ALL' ? filterCategory : (allCategoryNames[0] || 'PS5'))
              setAddOnName('')
              setAddOnPrice('60')
              setAddOnType('PER_HOUR')
              setAddOnError('')
              setAddOnNotice('')
              setShowGlobalAddOnModal(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: '1px solid rgba(168, 85, 247, 0.4)',
              background: 'rgba(168, 85, 247, 0.08)',
              color: '#c084fc',
              cursor: 'pointer'
            }}
            title="Create an add-on (accessories, extra controllers, headsets)"
          >
            <Tag size={13} /> + Add-on
          </button>

          <button
            type="button"
            onClick={() => {
              setAddMode('bulk')
              setShowAddModal(true)
            }}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'transparent',
              color: 'var(--text-primary, #0f172a)',
              cursor: 'pointer'
            }}
          >
            + Bulk
          </button>

          <button
            type="button"
            onClick={() => {
              setAddMode('single')
              setShowAddModal(true)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 800,
              borderRadius: 6,
              border: 'none',
              background: '#10b981',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} /> + Add
          </button>
        </div>
      </div>

      {/* Resource List: Pure Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((r) => {
          const rateVal = r.pricingRules.find((pr) => pr.active)?.rate ?? 120
          const isPlaying = (r.sessions && r.sessions.length > 0) || r.status === 'OCCUPIED'
          const isMaint = r.status === 'MAINTENANCE' || r.status === 'DISABLED'

          const statusText = isPlaying ? 'Playing' : isMaint ? 'Maintenance' : 'Free'
          const dotColor = isPlaying ? '#ef4444' : isMaint ? '#f59e0b' : '#10b981'

          return (
            <div
              key={r.id}
              style={{
                background: 'var(--panel-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              {/* Name & Rate with optional thumbnail/category icon fallback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
                  }}
                >
                  {r.imageUrl ? (
                    <SafeImage
                      src={r.imageUrl}
                      alt={r.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      fallback={<ResourceCategoryIcon category={r.category?.name} name={r.name} size={15} />}
                    />
                  ) : (
                    <ResourceCategoryIcon category={r.category?.name} name={r.name} size={15} />
                  )}
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: 'var(--text-primary, #0f172a)'
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                    ₹{rateVal}/hr
                  </div>
                </div>
              </div>

              {/* Status, Add-ons & Edit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Resource Add-ons Button */}
                <button
                  type="button"
                  onClick={() => {
                    setAddOnModalResource(r)
                    setAddOnName('')
                    setAddOnPrice('60')
                    setAddOnType('PER_HOUR')
                    setAddOnError('')
                    setAddOnNotice('')
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    background: 'rgba(168, 85, 247, 0.1)',
                    color: '#c084fc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Manage add-ons for ${r.name}`}
                >
                  <Tag size={12} />
                  <span>Add-ons</span>
                  {(() => {
                    const rAddOns = getCategoryAddOns(r.category?.name)
                    return rAddOns.length > 0 ? (
                      <span
                        style={{
                          background: '#a855f7',
                          color: '#ffffff',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '0 5px',
                          borderRadius: 8,
                          marginLeft: 2
                        }}
                      >
                        {rAddOns.length}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.8 }}>+</span>
                    )
                  })()}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Click to toggle status"
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dotColor,
                      display: 'inline-block'
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isPlaying ? '#b91c1c' : isMaint ? '#b45309' : '#15803d'
                    }}
                  >
                    {statusText}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(r)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--panel-subtle, #f8fafc)',
                    color: 'var(--text-primary, #0f172a)',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false)
          }}
        >
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 400,
              padding: '20px',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ font: '900 16px Manrope', margin: 0, textTransform: 'uppercase' }}>
                {addMode === 'single' ? 'Add Resource' : 'Bulk Create Resources'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12
                }}
              >
                {error}
              </div>
            )}

            {addMode === 'single' ? (
              <form onSubmit={handleCreateSingle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS5 03"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      marginTop: 4
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PS5"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        marginTop: 4
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Rate (₹/hr)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        marginTop: 4
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Photo (Optional)
                  </label>
                  <div style={{ marginTop: 4 }}>
                    <ImageUpload
                      value={imageUrl}
                      onChange={setImageUrl}
                      folder="resources"
                      label="Optional Upload Image"
                    />
                  </div>
                </div>

                {/* Add-ons for Category */}
                <div
                  style={{
                    background: 'var(--panel-subtle, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                    borderRadius: 8,
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Add-ons ({getCategoryAddOns(categoryName).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowInlineAddOn(!showInlineAddOn)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#c084fc',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {showInlineAddOn ? 'Cancel' : '+ Add Add-on'}
                    </button>
                  </div>

                  {getCategoryAddOns(categoryName).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {getCategoryAddOns(categoryName).map((a) => (
                        <span
                          key={a.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(168, 85, 247, 0.12)',
                            color: '#c084fc',
                            border: '1px solid rgba(168, 85, 247, 0.25)'
                          }}
                        >
                          {a.name} ({formatPricingType(a.pricingType, a.price)})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      No add-ons for "{categoryName}" yet. Click "+ Add Add-on" to attach accessories.
                    </div>
                  )}

                  {showInlineAddOn && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px dashed var(--border-color, rgba(255,255,255,0.1))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Add-on name (e.g. Extra Controller)"
                        value={inlineAddOnName}
                        onChange={(e) => setInlineAddOnName(e.target.value)}
                        style={{
                          height: 34,
                          padding: '0 8px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'var(--panel-bg, #ffffff)',
                          color: 'var(--text-primary, #0f172a)'
                        }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          type="number"
                          placeholder="Price (₹)"
                          min="0"
                          value={inlineAddOnPrice}
                          onChange={(e) => setInlineAddOnPrice(e.target.value)}
                          style={{
                            height: 34,
                            padding: '0 8px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--panel-bg, #ffffff)',
                            color: 'var(--text-primary, #0f172a)'
                          }}
                        />
                        <select
                          value={inlineAddOnType}
                          onChange={(e) => setInlineAddOnType(e.target.value)}
                          style={{
                            height: 34,
                            padding: '0 6px',
                            fontSize: 11,
                            borderRadius: 6,
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--panel-bg, #ffffff)',
                            color: 'var(--text-primary, #0f172a)'
                          }}
                        >
                          {BILLING_TYPES.map((bt) => (
                            <option key={bt.value} value={bt.value}>
                              {bt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={isSubmittingInlineAddOn}
                        onClick={async () => {
                          if (!inlineAddOnName.trim()) return
                          setIsSubmittingInlineAddOn(true)
                          try {
                            await handleCreateAddOnSubmit(
                              categoryName,
                              inlineAddOnName,
                              parseFloat(inlineAddOnPrice) || 0,
                              inlineAddOnType
                            )
                            setInlineAddOnName('')
                            setInlineAddOnPrice('60')
                            setShowInlineAddOn(false)
                          } catch (err: any) {
                            setError(err.message || 'Failed to add add-on')
                          } finally {
                            setIsSubmittingInlineAddOn(false)
                          }
                        }}
                        style={{
                          height: 32,
                          borderRadius: 6,
                          border: 'none',
                          background: '#a855f7',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        {isSubmittingInlineAddOn ? 'Saving...' : `+ Attach to ${categoryName}`}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Prefix
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS5 Lounge"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      marginTop: 4
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      required
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        marginTop: 4
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Quantity (1–30)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={bulkQty}
                      onChange={(e) => setBulkQty(Number(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        marginTop: 4
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Rate (₹/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={bulkRate}
                    onChange={(e) => setBulkRate(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      marginTop: 4
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Shared Photo (Optional)
                  </label>
                  <div style={{ marginTop: 4 }}>
                    <ImageUpload
                      value={bulkImageUrl}
                      onChange={setBulkImageUrl}
                      folder="resources"
                      label="Optional image for all created resources"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {isSubmitting ? 'Creating...' : `Create ${bulkQty}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingResource && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingResource(null)
          }}
        >
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 380,
              padding: '20px',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ font: '900 16px Manrope', margin: 0, textTransform: 'uppercase' }}>
                Edit {editingResource.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 10px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                    marginTop: 4
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Rate (₹/hr)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 10px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                    marginTop: 4
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setEditStatus('AVAILABLE')}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: editStatus === 'AVAILABLE' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      background: editStatus === 'AVAILABLE' ? '#f0fdf4' : '#fff',
                      color: editStatus === 'AVAILABLE' ? '#166534' : '#475569',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    ● Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('MAINTENANCE')}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: editStatus === 'MAINTENANCE' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                      background: editStatus === 'MAINTENANCE' ? '#fffbeb' : '#fff',
                      color: editStatus === 'MAINTENANCE' ? '#92400e' : '#475569',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    ● Maintenance
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Photo (Optional)
                </label>
                <div style={{ marginTop: 4 }}>
                  <ImageUpload
                    value={editImageUrl}
                    onChange={setEditImageUrl}
                    folder="resources"
                    label="Optional Upload Image"
                  />
                </div>
              </div>

              {/* Add-ons for editing resource */}
              <div
                style={{
                  background: 'var(--panel-subtle, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  borderRadius: 8,
                  padding: '10px 12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Add-ons ({getCategoryAddOns(editingResource.category?.name).length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const res = editingResource
                      setEditingResource(null)
                      setAddOnModalResource(res)
                      setAddOnName('')
                      setAddOnPrice('60')
                      setAddOnType('PER_HOUR')
                      setAddOnError('')
                      setAddOnNotice('')
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c084fc',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Manage Add-ons →
                  </button>
                </div>

                {getCategoryAddOns(editingResource.category?.name).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {getCategoryAddOns(editingResource.category?.name).map((a) => (
                      <span
                        key={a.id}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.25)'
                        }}
                      >
                        {a.name} ({formatPricingType(a.pricingType, a.price)})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    No add-ons linked yet. Click "Manage Add-ons →" to add extra controllers, headsets, or cues.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#10b981',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOURCE ADD-ONS MODAL */}
      {addOnModalResource && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOnModalResource(null)
          }}
        >
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 450,
              padding: '22px',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ font: '900 17px Manrope', margin: 0, textTransform: 'uppercase' }}>
                    Add-ons: {addOnModalResource.name}
                  </h3>
                  <span
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#a855f7',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6
                    }}
                  >
                    {addOnModalResource.category?.name || 'General'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Manage and attach extra accessories or perks for this resource.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOnModalResource(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error or Notice */}
            {addOnError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12
                }}
              >
                {addOnError}
              </div>
            )}
            {addOnNotice && (
              <div
                style={{
                  background: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12
                }}
              >
                {addOnNotice}
              </div>
            )}

            {/* Existing Add-ons List */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                Current Add-ons ({getCategoryAddOns(addOnModalResource.category?.name).length})
              </div>

              {getCategoryAddOns(addOnModalResource.category?.name).length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 8,
                    background: 'var(--panel-subtle, #f8fafc)',
                    border: '1px dashed var(--border-color, #cbd5e1)',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#64748b'
                  }}
                >
                  No add-ons attached yet. Add extra controllers, headsets, or cues below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {getCategoryAddOns(addOnModalResource.category?.name).map((addon) => (
                    <div
                      key={addon.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--panel-subtle, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border-color, rgba(255,255,255,0.08))'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary, #0f172a)' }}>
                          {addon.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                            {formatPricingType(addon.pricingType, addon.price)}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#94a3b8',
                              background: 'rgba(148, 163, 184, 0.1)',
                              padding: '1px 6px',
                              borderRadius: 4
                            }}
                          >
                            {addon.pricingType.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAddOn(addon.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.8
                        }}
                        title="Deactivate add-on"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add Form */}
            <div
              style={{
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                paddingTop: 16
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginBottom: 10 }}>
                + Add New Add-on for {addOnModalResource.category?.name || 'this Resource'}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setAddOnError('')
                  setAddOnNotice('')
                  setIsSubmittingAddOn(true)
                  try {
                    await handleCreateAddOnSubmit(
                      addOnModalResource.category?.name || '',
                      addOnName,
                      parseFloat(addOnPrice) || 0,
                      addOnType
                    )
                    setAddOnNotice(`✓ "${addOnName}" added to ${addOnModalResource.name}!`)
                    setAddOnName('')
                    setAddOnPrice('60')
                  } catch (err: any) {
                    setAddOnError(err.message || 'Error adding add-on')
                  } finally {
                    setIsSubmittingAddOn(false)
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Add-on Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Extra Controller, VR Headset, Cue"
                    value={addOnName}
                    onChange={(e) => setAddOnName(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      marginTop: 4,
                      background: 'var(--panel-bg, #ffffff)',
                      color: 'var(--text-primary, #0f172a)'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="60"
                      value={addOnPrice}
                      onChange={(e) => setAddOnPrice(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 10px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        marginTop: 4,
                        background: 'var(--panel-bg, #ffffff)',
                        color: 'var(--text-primary, #0f172a)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Billing Type *
                    </label>
                    <select
                      value={addOnType}
                      onChange={(e) => setAddOnType(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        background: 'var(--panel-bg, #ffffff)',
                        color: 'var(--text-primary, #0f172a)',
                        marginTop: 4,
                        cursor: 'pointer'
                      }}
                    >
                      {BILLING_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {bt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAddOn}
                  style={{
                    marginTop: 6,
                    height: 38,
                    borderRadius: 6,
                    border: 'none',
                    background: '#a855f7',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Plus size={15} />
                  {isSubmittingAddOn ? 'Adding...' : `Add Add-on to ${addOnModalResource.category?.name || 'Resource'}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL ADD-ON MODAL */}
      {showGlobalAddOnModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGlobalAddOnModal(false)
          }}
        >
          <div
            style={{
              background: 'var(--panel-bg, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 420,
              padding: '20px',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ font: '900 16px Manrope', margin: 0, textTransform: 'uppercase' }}>
                Add New Add-on
              </h3>
              <button
                type="button"
                onClick={() => setShowGlobalAddOnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {addOnError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12
                }}
              >
                {addOnError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setIsSubmittingAddOn(true)
                setAddOnError('')
                try {
                  await handleCreateAddOnSubmit(
                    addOnCategory === 'ALL' ? '' : addOnCategory,
                    addOnName,
                    parseFloat(addOnPrice) || 0,
                    addOnType
                  )
                  setShowGlobalAddOnModal(false)
                  setNotice(`✓ Add-on "${addOnName}" created!`)
                  setAddOnName('')
                  setAddOnPrice('60')
                } catch (err: any) {
                  setAddOnError(err.message || 'Error creating add-on')
                } finally {
                  setIsSubmittingAddOn(false)
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Category *
                </label>
                <select
                  value={addOnCategory}
                  onChange={(e) => setAddOnCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 8px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--panel-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    marginTop: 4
                  }}
                >
                  <option value="">All Categories (General Add-on)</option>
                  {allCategoryNames.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Add-on Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Controller, VR Headset, Snooker Cue"
                  value={addOnName}
                  onChange={(e) => setAddOnName(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 10px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                    marginTop: 4,
                    background: 'var(--panel-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="60"
                    value={addOnPrice}
                    onChange={(e) => setAddOnPrice(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      marginTop: 4,
                      background: 'var(--panel-bg, #ffffff)',
                      color: 'var(--text-primary, #0f172a)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Billing Type *
                  </label>
                  <select
                    value={addOnType}
                    onChange={(e) => setAddOnType(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: 'var(--panel-bg, #ffffff)',
                      color: 'var(--text-primary, #0f172a)',
                      marginTop: 4,
                      cursor: 'pointer'
                    }}
                  >
                    {BILLING_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>
                        {bt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowGlobalAddOnModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAddOn}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#a855f7',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  {isSubmittingAddOn ? 'Saving...' : 'Create Add-on'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
