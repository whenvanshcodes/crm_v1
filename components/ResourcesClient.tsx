'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, X, Layers, Check, AlertCircle } from 'lucide-react'
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

interface ResourcesClientProps {
  resources: ResourceItem[]
  categories: { id: string; name: string }[]
}

export default function ResourcesClient({
  resources: initialResources,
  categories
}: ResourcesClientProps) {
  const [resources, setResources] = useState<ResourceItem[]>(initialResources)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null)

  // Add Form
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('PS5')
  const [rate, setRate] = useState('120')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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

              {/* Status & Edit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
    </div>
  )
}
