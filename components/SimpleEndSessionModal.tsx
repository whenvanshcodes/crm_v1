'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { calculateSessionBill, type AddOnItem } from '@/lib/services/session'

export interface SimpleSessionData {
  id: string
  startedAt: string
  expectedEndAt?: string | null
  partySize?: number
  customer: { id?: string; name: string; phone?: string }
  resource: { id?: string; name: string }
  pricingRule: { rate: number }
  addOns?: Array<{
    id?: string
    name?: string
    price?: number
    pricingType?: string
    quantity?: number
    addOn?: { name: string; price: number; pricingType: string }
  }>
}

interface SimpleEndSessionModalProps {
  isOpen: boolean
  session: SimpleSessionData | null
  onClose: () => void
  onSuccess: (result: { session: any; billing: any }) => void
}

export default function SimpleEndSessionModal({
  isOpen,
  session,
  onClose,
  onSuccess
}: SimpleEndSessionModalProps) {
  // Step 1: 'CONFIRM' -> Step 2: 'PAYMENT'
  const [step, setStep] = useState<'CONFIRM' | 'PAYMENT'>('CONFIRM')
  const [discount, setDiscount] = useState<number>(0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (isOpen) {
      setStep('CONFIRM')
      setDiscount(0)
      setShowDiscount(false)
      setError('')
      setIsSubmitting(false)
      setNow(Date.now())
    }
  }, [isOpen])

  // Calculate bill for session
  const { bill, elapsedLabel } = useMemo(() => {
    if (!session) return { bill: { total: 0 }, elapsedLabel: '0m' }

    const start = new Date(session.startedAt)
    const end = new Date(now)
    const elapsedMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

    const hours = Math.floor(elapsedMinutes / 60)
    const mins = elapsedMinutes % 60
    const dLabel = hours === 0 ? `${mins}m` : `${hours}h ${mins}m`

    const addOnsItems: AddOnItem[] = (session.addOns || []).map((a) => {
      const name = a.name || a.addOn?.name || 'Extra'
      const price = a.price ?? a.addOn?.price ?? 0
      const pricingType = a.pricingType || a.addOn?.pricingType || 'PER_HOUR'
      const quantity = a.quantity || 1
      return { name, price, pricingType, quantity }
    })

    const calc = calculateSessionBill(
      session.pricingRule?.rate || 120,
      start,
      end,
      discount,
      0,
      addOnsItems,
      session.partySize || 1
    )

    return { bill: calc, elapsedLabel: dLabel }
  }, [session, now, discount])

  if (!isOpen || !session) return null

  async function handleSelectPayment(method: 'CASH' | 'UPI' | 'CARD' | 'OTHER') {
    if (!session) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount: discount > 0 ? discount : undefined,
          paymentMethod: method
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not complete session.')
      }

      const result = await res.json()
      onSuccess(result)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to complete session.')
      setIsSubmitting(false)
    }
  }

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
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--panel-bg, #0d1017)',
          color: 'var(--text-primary, #f8fafc)',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(124, 92, 255, 0.08)',
          width: '100%',
          maxWidth: 360,
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          overflow: 'hidden',
          padding: '24px 20px'
        }}
      >
        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 14
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: CONFIRMATION */}
        {step === 'CONFIRM' ? (
          <div style={{ textAlign: 'center' }}>
            <h2
              style={{
                font: '900 18px Manrope',
                margin: 0,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-primary, #f8fafc)'
              }}
            >
              END SESSION?
            </h2>

            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
              <b>{session.customer.name}</b> · {session.resource.name} · {elapsedLabel}
            </div>

            <div
              style={{
                font: '900 36px Manrope',
                color: '#4ade80',
                textShadow: '0 0 16px rgba(74, 222, 128, 0.25)',
                margin: '18px 0'
              }}
            >
              ₹{bill.total}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  background: 'var(--panel-subtle, #11151e)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: 'var(--text-primary, #f8fafc)'
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => setStep('PAYMENT')}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                END
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: PAYMENT METHOD */
          <div style={{ textAlign: 'center' }}>
            <h2
              style={{
                font: '900 16px Manrope',
                margin: 0,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-primary, #f8fafc)'
              }}
            >
              HOW DID THEY PAY?
            </h2>

            <div
              style={{
                font: '900 30px Manrope',
                color: '#4ade80',
                textShadow: '0 0 16px rgba(74, 222, 128, 0.25)',
                margin: '12px 0 16px'
              }}
            >
              ₹{bill.total}
            </div>

            {/* Optional Discount Toggle */}
            <div style={{ marginBottom: 14 }}>
              {!showDiscount ? (
                <button
                  type="button"
                  onClick={() => setShowDiscount(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    color: 'var(--primary-accent, #7c5cff)',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  + Add Discount
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Discount: ₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    style={{
                      width: 70,
                      height: 30,
                      textAlign: 'center',
                      fontSize: 13,
                      borderRadius: 4,
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                      background: 'var(--input-bg, #0b0e14)',
                      color: 'var(--text-primary, #f8fafc)'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Direct One-Tap Payment Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {(['CASH', 'UPI', 'CARD', 'OTHER'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSelectPayment(method)}
                  style={{
                    height: 48,
                    borderRadius: 8,
                    border: '1.5px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    background: 'var(--panel-subtle, #11151e)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isSubmitting ? '...' : method}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setStep('CONFIRM')}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12,
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
