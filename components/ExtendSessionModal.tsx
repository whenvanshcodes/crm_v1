'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Clock, AlertTriangle, CheckCircle, IndianRupee } from 'lucide-react'

export interface ExtendSessionTarget {
  id: string
  expectedEndAt?: string | null
  startedAt: string
  customer: { id?: string; name: string; phone?: string }
  resource: { id: string; name: string; rate?: number }
  addOns?: Array<{
    quantity: number
    addOn: { name: string; price: number; pricingType: string }
  }>
  pricingRule?: { rate: number } | null
}

interface ExtendSessionModalProps {
  isOpen: boolean
  session: ExtendSessionTarget | null
  onClose: () => void
  onSuccess: (updatedSession: any, message: string) => void
}

export default function ExtendSessionModal({
  isOpen,
  session,
  onClose,
  onSuccess
}: ExtendSessionModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30)
  const [isCustom, setIsCustom] = useState(false)
  const [customInput, setCustomInput] = useState('45')

  const [loadingInfo, setLoadingInfo] = useState(false)
  const [maxMinutes, setMaxMinutes] = useState<number>(180)
  const [conflictReason, setConflictReason] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fetch server max allowed extension on open
  useEffect(() => {
    if (!isOpen || !session) return

    setSelectedMinutes(30)
    setIsCustom(false)
    setCustomInput('45')
    setError('')
    setConflictReason(null)
    setMaxMinutes(180)
    setLoadingInfo(true)

    fetch(`/api/sessions/${session.id}/extend`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not fetch extension limits')
        return res.json()
      })
      .then((data) => {
        if (typeof data.maxMinutes === 'number') {
          setMaxMinutes(data.maxMinutes)
          if (data.conflictReason) {
            setConflictReason(data.conflictReason)
          }
        }
      })
      .catch(() => {
        // Fallback gracefully
        setMaxMinutes(180)
      })
      .finally(() => {
        setLoadingInfo(false)
      })
  }, [isOpen, session])

  const activeMinutes = isCustom ? Math.max(1, parseInt(customInput, 10) || 1) : selectedMinutes

  // Calculate current end date
  const currentEndDate = useMemo(() => {
    if (!session) return new Date()
    return session.expectedEndAt ? new Date(session.expectedEndAt) : new Date()
  }, [session])

  // Calculate new projected end date
  const newEndDate = useMemo(() => {
    return new Date(currentEndDate.getTime() + activeMinutes * 60 * 1000)
  }, [currentEndDate, activeMinutes])

  // Calculate additional charge based on session's hourly rates
  const additionalCharge = useMemo(() => {
    if (!session) return 0
    let hourlyTotal = session.pricingRule?.rate || session.resource.rate || 120

    if (session.addOns && session.addOns.length > 0) {
      for (const a of session.addOns) {
        if (a.addOn.pricingType === 'PER_HOUR') {
          hourlyTotal += a.addOn.price * (a.quantity || 1)
        }
      }
    }

    return Math.round((hourlyTotal * activeMinutes) / 60)
  }, [session, activeMinutes])

  const isConflict = activeMinutes > maxMinutes

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!session || isConflict) return

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: activeMinutes })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Extension failed')
      }

      const updated = await res.json()
      onSuccess(updated, `✓ Extended session for ${session.customer.name} by +${activeMinutes}m!`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to extend session')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !session) return null

  function formatClock(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        style={{
          maxWidth: 440,
          width: '92%',
          background: 'var(--panel-bg, #0d1017)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: 14,
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(124, 92, 255, 0.12)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--panel-subtle, #11151e)'
          }}
        >
          <div>
            <h2
              style={{
                font: '800 16px Manrope',
                margin: 0,
                color: 'var(--text-primary, #f8fafc)',
                letterSpacing: '0.02em'
              }}
            >
              EXTEND SESSION
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
              {session.customer.name} · {session.resource.name}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirm} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 16
              }}
            >
              {error}
            </div>
          )}

          {/* Current End Time */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--panel-subtle, #11151e)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
              borderRadius: 8,
              marginBottom: 16
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Current end:</span>
            <strong style={{ fontSize: 13, color: 'var(--text-primary, #f8fafc)' }}>
              {formatClock(currentEndDate)}
            </strong>
          </div>

          {/* Extension Options: +15m, +30m, +60m, Custom */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-muted, #94a3b8)',
                textTransform: 'uppercase',
                marginBottom: 8,
                display: 'block'
              }}
            >
              Extend by:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[15, 30, 60].map((mins) => {
                const isSelected = !isCustom && selectedMinutes === mins
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setIsCustom(false)
                      setSelectedMinutes(mins)
                    }}
                    style={{
                      height: 40,
                      borderRadius: 8,
                      border: isSelected
                        ? '1px solid #7c5cff'
                        : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      background: isSelected
                        ? 'rgba(124, 92, 255, 0.2)'
                        : 'var(--panel-subtle, #11151e)',
                      color: isSelected ? '#c4b5fd' : 'var(--text-primary, #f8fafc)',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    +{mins}m
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setIsCustom(true)}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: isCustom
                    ? '1px solid #7c5cff'
                    : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  background: isCustom
                    ? 'rgba(124, 92, 255, 0.2)'
                    : 'var(--panel-subtle, #11151e)',
                  color: isCustom ? '#c4b5fd' : 'var(--text-primary, #f8fafc)',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Custom
              </button>
            </div>

            {/* Custom Input */}
            {isCustom && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'var(--panel-subtle, #11151e)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRadius: 8
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Extend by:</span>
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  style={{
                    width: 70,
                    height: 32,
                    textAlign: 'center',
                    background: 'var(--panel-bg, #0d1017)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                    borderRadius: 6,
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: 14,
                    fontWeight: 700
                  }}
                  autoFocus
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>minutes</span>
              </div>
            )}
          </div>

          {/* New End Time & Additional Charge Preview */}
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--panel-subtle, #11151e)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>New end:</span>
              <strong style={{ fontSize: 14, color: '#c4b5fd' }}>
                {formatClock(newEndDate)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Additional charge:</span>
              <strong style={{ fontSize: 16, color: '#4ade80', font: '900 16px Manrope' }}>
                ₹{additionalCharge}
              </strong>
            </div>
          </div>

          {/* Conflict / Availability Notice */}
          {isConflict ? (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f87171',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 20
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Unavailable:</strong> {conflictReason || `Maximum extension is ${maxMinutes} minutes.`}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: 8,
                fontSize: 12,
                color: '#4ade80',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 20
              }}
            >
              <CheckCircle size={14} />
              <span>Available until {formatClock(newEndDate)}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 14,
              borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
            }}
          >
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={isSubmitting || isConflict || activeMinutes < 1}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 800,
                opacity: isConflict ? 0.4 : 1,
                cursor: isConflict ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Extending...' : 'EXTEND'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
