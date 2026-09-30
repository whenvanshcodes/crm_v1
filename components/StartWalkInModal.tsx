'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, Minus, AlertCircle } from 'lucide-react'

export interface WalkInResource {
  id: string
  name: string
  rate: number
  status: string
  categoryName?: string | null
}

export interface WalkInAddOn {
  id: string
  name: string
  price: number
  pricingType: string
  categoryName?: string | null
}

export interface WalkInCustomer {
  id: string
  name: string
  phone: string
  totalVisits?: number
}

interface StartWalkInModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (session: any) => void
  resources: WalkInResource[]
  addOns?: WalkInAddOn[]
  initialCustomers?: WalkInCustomer[]
}

export default function StartWalkInModal({
  isOpen,
  onClose,
  onSuccess,
  resources,
  addOns = [],
  initialCustomers = []
}: StartWalkInModalProps) {
  // 1. Phone & Customer
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [existingCustomer, setExistingCustomer] = useState<WalkInCustomer | null>(null)
  const [showNewCustomerInput, setShowNewCustomerInput] = useState(false)

  // 2. People
  const [people, setPeople] = useState(1)

  // 3. Resource
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')

  // 4. Time
  const [timeMinutes, setTimeMinutes] = useState(60)
  const [showMoreTime, setShowMoreTime] = useState(false)
  const [customTime, setCustomTime] = useState('')

  // 5. Extras
  const [extrasQty, setExtrasQty] = useState<Record<string, number>>({})

  // UI
  const [showPriceDetails, setShowPriceDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)

  // Reset ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setError('')
      setIsSubmitting(false)
      setShowPriceDetails(false)
      setShowMoreTime(false)
      setCustomTime('')
      setPhone('')
      setCustomerName('')
      setExistingCustomer(null)
      setShowNewCustomerInput(false)
      // Smart defaults: 1 hour, 1 person
      setPeople(1)
      setTimeMinutes(60)
      setExtrasQty({})
      // Do NOT auto-select resource - wait for receptionist to tap one!
      setSelectedResourceId('')

      setTimeout(() => phoneInputRef.current?.focus(), 60)
    }
    prevOpenRef.current = isOpen
  }, [isOpen])

  // Instant customer lookup by phone
  useEffect(() => {
    const clean = phone.trim().replace(/\D/g, '')
    if (clean.length < 3) {
      setExistingCustomer(null)
      setShowNewCustomerInput(false)
      return
    }

    // 1. Local instant match
    const local = initialCustomers.find(
      (c) => c.phone.replace(/\D/g, '') === clean
    )
    if (local) {
      setExistingCustomer(local)
      setCustomerName(local.name)
      setShowNewCustomerInput(false)
      return
    }

    // 2. API query if phone >= 5 digits
    if (clean.length >= 5) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/customers?query=${encodeURIComponent(clean)}`)
          if (res.ok) {
            const list = await res.json()
            const match = list.find(
              (c: any) => c.phone.replace(/\D/g, '') === clean
            )
            if (match) {
              setExistingCustomer(match)
              setCustomerName(match.name)
              setShowNewCustomerInput(false)
            } else {
              setExistingCustomer(null)
            }
          }
        } catch {
          // ignore
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [phone, initialCustomers])

  const selectedResource = useMemo(
    () => resources.find((r) => r.id === selectedResourceId),
    [resources, selectedResourceId]
  )

  // Extras applicable to this resource
  const relevantExtras = useMemo(() => {
    if (!selectedResource || !addOns) return []
    const cat = selectedResource.categoryName?.toLowerCase()
    return addOns.filter((a) => {
      if (!a.categoryName) return true
      return a.categoryName.toLowerCase() === cat
    })
  }, [selectedResource, addOns])

  // Pricing calculation
  const { total, baseRate, hourlyExtrasRate, fixedExtrasRate } = useMemo(() => {
    if (!selectedResource) return { total: 0, baseRate: 0, hourlyExtrasRate: 0, fixedExtrasRate: 0 }

    const rate = selectedResource.rate
    let hourlyExtras = 0
    let fixedExtras = 0

    for (const [id, qty] of Object.entries(extrasQty)) {
      if (qty > 0) {
        const item = addOns.find((a) => a.id === id)
        if (item) {
          if (item.pricingType === 'PER_HOUR') {
            hourlyExtras += item.price * qty
          } else {
            fixedExtras += item.price * qty
          }
        }
      }
    }

    const hours = timeMinutes / 60
    const calc = Math.round((rate + hourlyExtras) * hours + fixedExtras)

    return {
      total: calc,
      baseRate: rate,
      hourlyExtrasRate: hourlyExtras,
      fixedExtrasRate: fixedExtras
    }
  }, [selectedResource, extrasQty, addOns, timeMinutes])

  function handleExtraDelta(id: string, delta: number) {
    setExtrasQty((prev) => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [id]: next }
    })
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setError('Please enter a phone number.')
      phoneInputRef.current?.focus()
      return
    }

    if (!selectedResource) {
      setError('Please choose a resource.')
      return
    }

    if (selectedResource.status !== 'AVAILABLE') {
      setError(`${selectedResource.name} is not available. Please choose another.`)
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Ensure customer exists
      const nameToSave = customerName.trim() || existingCustomer?.name || 'Walk-in Customer'
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameToSave, phone: cleanPhone })
      })

      if (!custRes.ok) {
        const err = await custRes.json().catch(() => ({}))
        throw new Error(err.message || 'Could not save customer.')
      }

      const customer = await custRes.json()

      // 2. Build extras payload
      const addOnsPayload = Object.entries(extrasQty)
        .filter(([_, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }))

      // 3. Start live session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          resourceId: selectedResource.id,
          partySize: people,
          expectedDurationMinutes: timeMinutes,
          addOns: addOnsPayload
        })
      })

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}))
        if (sessionRes.status === 409 || errData.code === 'BOOKING_CONFLICT') {
          throw new Error(`${selectedResource.name} is no longer available.`)
        }
        throw new Error(errData.message || 'Failed to start session.')
      }

      const created = await sessionRes.json()
      onSuccess(created)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Could not start session.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Progressive reveal triggers:
  // Step 1: Phone entered (3+ chars) reveals People & Resource
  const phoneEntered = phone.trim().length >= 3
  // Step 2: Resource chosen reveals Time & Extras
  const resourceChosen = Boolean(selectedResource)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 6, 9, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--panel-bg, #0d1017)',
          color: 'var(--text-primary, #f8fafc)',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(124, 92, 255, 0.08)',
          width: '100%',
          maxWidth: 440,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
            <h2
              style={{
                font: '800 16px Manrope',
                margin: 0,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              START SESSION
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              borderRadius: 6
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Counter Form */}
        <form
          onSubmit={handleStart}
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto'
          }}
        >
          {/* Error Message */}
          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================
              1. PHONE (Always visible)
              ======================================================== */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#64748b',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 6
              }}
            >
              PHONE
            </label>
            <input
              ref={phoneInputRef}
              type="tel"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                border: '1.5px solid var(--border-color, #cbd5e1)',
                background: 'var(--input-bg, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none'
              }}
            />

            {/* Customer Recognition or New Customer prompt */}
            {existingCustomer ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.28)',
                  padding: '7px 12px',
                  borderRadius: 6,
                  marginTop: 6,
                  fontSize: 13,
                  color: '#4ade80',
                  fontWeight: 700
                }}
              >
                <span>{existingCustomer.name}</span>
                <span style={{ fontSize: 11, color: '#86efac', fontWeight: 600 }}>
                  {existingCustomer.totalVisits || 1} visits
                </span>
              </div>
            ) : phoneEntered ? (
              <div style={{ marginTop: 6 }}>
                {!showNewCustomerInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerInput(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-accent, #7c5cff)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    + New Customer
                  </button>
                ) : (
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      height: 36,
                      padding: '0 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #94a3b8',
                      background: 'var(--input-bg, #ffffff)',
                      color: 'var(--text-primary, #0f172a)'
                    }}
                  />
                )}
              </div>
            ) : null}
          </div>

          {/* ========================================================
              PROGRESSIVE REVEAL: PEOPLE & RESOURCE
              (Appears as soon as Phone has been started)
              ======================================================== */}
          {phoneEntered && (
            <>
              {/* 2. PEOPLE */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 4
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#64748b',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                >
                  PEOPLE
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setPeople(Math.max(1, people - 1))}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                      background: 'var(--panel-subtle, #11151e)',
                      color: 'var(--text-primary, #f8fafc)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Minus size={15} />
                  </button>
                  <span
                    style={{
                      minWidth: 28,
                      textAlign: 'center',
                      fontSize: 17,
                      fontWeight: 800,
                      color: 'var(--text-primary, #f8fafc)'
                    }}
                  >
                    {people}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeople(people + 1)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                      background: 'var(--panel-subtle, #11151e)',
                      color: 'var(--text-primary, #f8fafc)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* 3. RESOURCE SELECTION */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#94a3b8',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 8
                  }}
                >
                  RESOURCE
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    maxHeight: 180,
                    overflowY: 'auto'
                  }}
                >
                  {resources.map((r) => {
                    const isSelected = selectedResourceId === r.id
                    const isAvailable = r.status === 'AVAILABLE'

                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedResourceId(r.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          opacity: isAvailable ? 1 : 0.45,
                          border: isSelected
                            ? '1.5px solid var(--primary-accent, #7c5cff)'
                            : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                          background: isSelected
                            ? 'rgba(124, 92, 255, 0.14)'
                            : 'var(--panel-subtle, #11151e)',
                          boxShadow: isSelected
                            ? '0 0 16px rgba(124, 92, 255, 0.22)'
                            : 'none',
                          transition: 'all 0.15s ease',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--text-primary, #f8fafc)'
                          }}
                        >
                          {r.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#94a3b8',
                            marginTop: 2
                          }}
                        >
                          ₹{r.rate}/hr
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isAvailable ? '#22c55e' : '#ef4444',
                              boxShadow: isAvailable ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none'
                            }}
                          />
                          <span
                            style={{
                              color: isAvailable ? '#4ade80' : '#f87171'
                            }}
                          >
                            {isAvailable ? 'Free' : 'Busy'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ========================================================
              PROGRESSIVE REVEAL: TIME & EXTRAS
              (Appears as soon as Resource has been selected)
              ======================================================== */}
          {phoneEntered && resourceChosen && (
            <>
              {/* 4. TIME */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#94a3b8',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 6
                  }}
                >
                  TIME
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: '30 MIN', mins: 30 },
                    { label: '1 HOUR', mins: 60 },
                    { label: '2 HOURS', mins: 120 }
                  ].map((t) => {
                    const isSelected = !showMoreTime && timeMinutes === t.mins
                    return (
                      <button
                        key={t.mins}
                        type="button"
                        onClick={() => {
                          setShowMoreTime(false)
                          setTimeMinutes(t.mins)
                        }}
                        style={{
                          flex: 1,
                          height: 38,
                          fontSize: 12,
                          fontWeight: isSelected ? 800 : 600,
                          borderRadius: 6,
                          border: isSelected
                            ? '1.5px solid var(--primary-accent, #7c5cff)'
                            : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                          background: isSelected
                            ? 'var(--primary-accent, #7c5cff)'
                            : 'var(--panel-subtle, #11151e)',
                          boxShadow: isSelected
                            ? '0 0 14px rgba(124, 92, 255, 0.35)'
                            : 'none',
                          color: isSelected
                            ? '#ffffff'
                            : 'var(--text-primary, #f8fafc)',
                          cursor: 'pointer'
                        }}
                      >
                        {t.label}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => setShowMoreTime(!showMoreTime)}
                    style={{
                      height: 38,
                      padding: '0 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: showMoreTime
                        ? '1.5px solid var(--primary-accent, #7c5cff)'
                        : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      background: showMoreTime
                        ? 'rgba(124, 92, 255, 0.15)'
                        : 'var(--panel-subtle, #11151e)',
                      color: 'var(--text-primary, #f8fafc)',
                      cursor: 'pointer'
                    }}
                  >
                    More
                  </button>
                </div>

                {/* More / Custom Time options */}
                {showMoreTime && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      marginTop: 8
                    }}
                  >
                    {[
                      { label: '1.5 HOURS', mins: 90 },
                      { label: '3 HOURS', mins: 180 }
                    ].map((t) => {
                      const isSelected = timeMinutes === t.mins
                      return (
                        <button
                          key={t.mins}
                          type="button"
                          onClick={() => setTimeMinutes(t.mins)}
                          style={{
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: isSelected ? 800 : 600,
                            borderRadius: 6,
                            border: isSelected
                              ? '1.5px solid var(--primary-accent, #7c5cff)'
                              : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                            background: isSelected
                              ? 'var(--primary-accent, #7c5cff)'
                              : 'var(--panel-subtle, #11151e)',
                            boxShadow: isSelected
                              ? '0 0 12px rgba(124, 92, 255, 0.35)'
                              : 'none',
                            color: isSelected
                              ? '#ffffff'
                              : 'var(--text-primary, #f8fafc)',
                            cursor: 'pointer'
                          }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min="15"
                        max="720"
                        placeholder="Mins"
                        value={customTime}
                        onChange={(e) => {
                          setCustomTime(e.target.value)
                          const n = Number(e.target.value)
                          if (n > 0) setTimeMinutes(n)
                        }}
                        style={{
                          width: 58,
                          height: 32,
                          padding: '0 6px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                          background: 'var(--input-bg, #0b0e14)',
                          color: 'var(--text-primary, #f8fafc)'
                        }}
                      />
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>min</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. EXTRAS (Only shown if resource has extras!) */}
              {relevantExtras.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    {relevantExtras.map((extra) => {
                      const qty = extrasQty[extra.id] || 0
                      return (
                        <div
                          key={extra.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#94a3b8',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase'
                              }}
                            >
                              {extra.name}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: '#94a3b8',
                                marginLeft: 6
                              }}
                            >
                              ₹{extra.price}
                              {extra.pricingType === 'PER_HOUR' ? '/hr' : ''}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleExtraDelta(extra.id, -1)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                                background: 'var(--panel-subtle, #11151e)',
                                color: 'var(--text-primary, #f8fafc)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Minus size={13} />
                            </button>
                            <span
                              style={{
                                minWidth: 20,
                                textAlign: 'center',
                                fontSize: 14,
                                fontWeight: 800,
                                color: 'var(--text-primary, #f8fafc)'
                              }}
                            >
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleExtraDelta(extra.id, 1)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                                background: 'var(--panel-subtle, #11151e)',
                                color: 'var(--text-primary, #f8fafc)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 6. TOTAL */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline'
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#94a3b8',
                      letterSpacing: '0.05em'
                    }}
                  >
                    TOTAL
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPriceDetails(!showPriceDetails)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: 11,
                      color: 'var(--primary-accent, #7c5cff)',
                      cursor: 'pointer',
                      marginTop: 2
                    }}
                  >
                    ⓘ Details
                  </button>
                </div>

                <div
                  style={{
                    font: '900 28px Manrope',
                    color: '#4ade80',
                    textShadow: '0 0 16px rgba(74, 222, 128, 0.25)',
                    lineHeight: 1
                  }}
                >
                  ₹{total}
                </div>
              </div>

              {/* Optional Details Breakdown */}
              {showPriceDetails && (
                <div
                  style={{
                    background: 'var(--panel-subtle, #11151e)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    color: 'var(--text-secondary, #94a3b8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {selectedResource?.name || 'Resource'} (₹{baseRate}/hr × {timeMinutes / 60}h)
                    </span>
                    <span>₹{Math.round((baseRate * timeMinutes) / 60)}</span>
                  </div>
                  {hourlyExtrasRate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Extras (₹{hourlyExtrasRate}/hr × {timeMinutes / 60}h)</span>
                      <span>₹{Math.round((hourlyExtrasRate * timeMinutes) / 60)}</span>
                    </div>
                  )}
                  {fixedExtrasRate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Fixed Extras</span>
                      <span>₹{fixedExtrasRate}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 7. START BUTTON */}
              <div style={{ paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    font: '900 16px Manrope',
                    letterSpacing: '0.04em',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                    boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  {isSubmitting ? 'STARTING...' : 'START'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
