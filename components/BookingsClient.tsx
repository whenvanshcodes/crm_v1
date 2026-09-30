'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Plus,
  Play,
  X,
  Check,
  Ban,
  Clock3,
  Search,
  ArrowUpRight,
  CreditCard,
  AlertCircle,
  Sparkles,
  Phone,
  User as UserIcon,
  ChevronRight,
  Flame,
  Users,
  Gamepad2,
  CheckCircle,
  Clock,
  IndianRupee
} from 'lucide-react'
import { calculateSessionBill, type AddOnItem } from '@/lib/services/session'
import StartWalkInModal from './StartWalkInModal'
import SimpleEndSessionModal from './SimpleEndSessionModal'
import ExtendSessionModal from './ExtendSessionModal'

export interface BookingAddOnItem {
  id: string
  name: string
  price: number
  pricingType: string
  quantity: number
}

export interface BookingItem {
  id: string
  status: string
  startTime: string
  endTime: string
  partySize: number
  groupMembers?: string | null
  notes?: string | null
  priceEstimate?: number | null
  customer: { id: string; name: string; phone: string }
  resource: { id: string; name: string; category?: { name: string } | null }
  addOns?: BookingAddOnItem[]
}

export interface SessionItem {
  id: string
  status: string
  startedAt: string
  endedAt?: string | null
  expectedEndAt?: string | null
  plannedStartAt?: string | null
  plannedEndAt?: string | null
  partySize: number
  groupMembers?: string | null
  bookedAmount?: number | null
  actualAmount?: number | null
  finalAmount?: number | null
  completionStatus?: string | null
  customer: { id: string; name: string; phone: string; totalVisits?: number }
  resource: { id: string; name: string; category?: { name: string } | null }
  pricingRule: { rate: number }
  addOns?: BookingAddOnItem[]
  transaction?: {
    id: string
    total: number
    payments: { id: string; amount: number; method: string }[]
  } | null
}

export interface ResourceOption {
  id: string
  name: string
  categoryName: string
  status: string
  rate: number
  nextBookingAt?: string | null
  nextBookingCustomer?: string | null
}

export interface CustomerOption {
  id: string
  name: string
  phone: string
  totalVisits: number
  totalSpending: number
}

export interface AddOnOption {
  id: string
  name: string
  description?: string
  pricingType: string
  price: number
  categoryName?: string
}

export interface WaitlistEntryItem {
  id: string
  venueId: string
  customerId: string
  partySize: number
  categoryName?: string | null
  preferredTime?: string | null
  notes?: string | null
  status: string
  createdAt: string
  customer: { id: string; name: string; phone: string }
}

interface BookingsClientProps {
  initialBookings: BookingItem[]
  initialActiveSessions: SessionItem[]
  initialCompletedSessions: SessionItem[]
  resources: ResourceOption[]
  customers: CustomerOption[]
  initialAddOns: AddOnOption[]
  initialWaitlist?: WaitlistEntryItem[]
}

export default function BookingsClient({
  initialBookings,
  initialActiveSessions,
  initialCompletedSessions,
  resources,
  customers,
  initialAddOns,
  initialWaitlist = []
}: BookingsClientProps) {
  const [bookings, setBookings] = useState<BookingItem[]>(initialBookings)
  const [activeSessions, setActiveSessions] = useState<SessionItem[]>(initialActiveSessions)
  const [completedSessions, setCompletedSessions] = useState<SessionItem[]>(
    initialCompletedSessions
  )
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntryItem[]>(initialWaitlist)
  const [addOnsList] = useState<AddOnOption[]>(initialAddOns)

  const walkInResources = React.useMemo(
    () =>
      resources.map((r) => ({
        id: r.id,
        name: r.name,
        rate: r.rate,
        status: r.status,
        categoryName: r.categoryName
      })),
    [resources]
  )

  const [activeTab, setActiveTab] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'WAITLIST' | 'COMPLETED' | 'CANCELLED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(Date.now())

  // Modals
  const [walkInModalOpen, setWalkInModalOpen] = useState(false)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [bookingMode, setBookingMode] = useState<'WALKIN' | 'SCHEDULE'>('SCHEDULE')
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [extendModalOpen, setExtendModalOpen] = useState(false)
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [targetSession, setTargetSession] = useState<SessionItem | null>(null)

  // Handle URL query parameters for immediate quick actions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search
      if (search.includes('new=walkin')) {
        setWalkInModalOpen(true)
      } else if (search.includes('new=booking')) {
        setBookingMode('SCHEDULE')
        setBookingModalOpen(true)
      }
    }
  }, [])

  // Booking Form State
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [partySize, setPartySize] = useState(1)
  const [groupMembers, setGroupMembers] = useState('')
  const [selectedResourceId, setSelectedResourceId] = useState(resources[0]?.id || '')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10))
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [notes, setNotes] = useState('')
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<{ [id: string]: number }>({})
  const [assigningWaitlistId, setAssigningWaitlistId] = useState<string | null>(null)

  function setAddOnQty(id: string, delta: number) {
    setSelectedAddOnIds((prev) => {
      const current = prev[id] || 0
      const nextVal = Math.max(0, current + delta)
      if (nextVal === 0) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: nextVal }
    })
  }

  // Waitlist Form State
  const [waitlistPhone, setWaitlistPhone] = useState('')
  const [waitlistCustomerName, setWaitlistCustomerName] = useState('')
  const [waitlistPartySize, setWaitlistPartySize] = useState(1)
  const [waitlistCategory, setWaitlistCategory] = useState('')
  const [waitlistNotes, setWaitlistNotes] = useState('')

  // Conflict handling
  const [conflictError, setConflictError] = useState('')
  const [conflictAlternatives, setConflictAlternatives] = useState<Array<{ id: string; name: string }>>([])

  // Customer Return Insight State
  const [customerInsight, setCustomerInsight] = useState<{
    name: string
    hasHistory: boolean
    lastVisitAt?: string | null
    favouriteCategory?: string | null
    typicalGroupSize?: number | null
  } | null>(null)

  // End Session Form State
  const [endDiscount, setEndDiscount] = useState<number>(0)
  const [endPaymentMethod, setEndPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH')

  // Extend Modal State
  const [extendMinutes, setExtendMinutes] = useState(30)
  const [maxAvailableExtension, setMaxAvailableExtension] = useState<number | null>(null)
  const [extensionConflictInfo, setExtensionConflictInfo] = useState<string | null>(null)

  // UI status
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ticking timer every second for accurate duration & time left
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-dismiss notification
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4000)
      return () => clearTimeout(t)
    }
  }, [notice])

  // Lookup customer insights as phone changes
  useEffect(() => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length >= 6) {
      fetch(`/api/customers?phone=${encodeURIComponent(clean)}&insights=true`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.name) {
            setCustomerName(data.name)
            setCustomerInsight(data)
            if (data.typicalGroupSize && data.typicalGroupSize > 1) {
              setPartySize(data.typicalGroupSize)
            }
          } else {
            setCustomerInsight(null)
          }
        })
        .catch(() => setCustomerInsight(null))
    } else {
      setCustomerInsight(null)
    }
  }, [phone])

  const selectedResource = resources.find((r) => r.id === selectedResourceId) || resources[0]

  // Filter add-ons applicable to selected resource category
  const applicableAddOns = addOnsList.filter((a) => {
    if (!a.categoryName) return true
    return (
      selectedResource &&
      a.categoryName.toLowerCase() === selectedResource.categoryName.toLowerCase()
    )
  })

  // Calculate live hourly rate & estimated bill in booking modal
  const baseRate = selectedResource?.rate || 120
  const selectedAddOnsItems: AddOnItem[] = Object.entries(selectedAddOnIds)
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => {
      const addon = addOnsList.find((a) => a.id === id)
      return {
        id,
        name: addon?.name || 'Add-on',
        price: addon?.price || 0,
        pricingType: addon?.pricingType || 'PER_HOUR',
        quantity: qty
      }
    })

  const previewBill = calculateSessionBill(
    baseRate,
    new Date(),
    new Date(Date.now() + durationMinutes * 60 * 1000),
    0,
    0,
    selectedAddOnsItems,
    partySize
  )

  function toggleAddOn(id: string) {
    setSelectedAddOnIds((prev) => {
      const current = prev[id] || 0
      if (current > 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
  }

  // Filter queries
  const query = searchQuery.toLowerCase().trim()

  const filteredActiveSessions = activeSessions.filter((s) => {
    if (!query) return true
    return (
      s.customer.name.toLowerCase().includes(query) ||
      s.customer.phone.includes(query) ||
      s.resource.name.toLowerCase().includes(query)
    )
  })

  const filteredUpcomingBookings = bookings.filter((b) => {
    if (b.status === 'CANCELLED' || b.status === 'COMPLETED') return false
    if (!query) return true
    return (
      b.customer.name.toLowerCase().includes(query) ||
      b.customer.phone.includes(query) ||
      b.resource.name.toLowerCase().includes(query)
    )
  })

  const filteredCompletedSessions = completedSessions.filter((s) => {
    if (!query) return true
    return (
      s.customer.name.toLowerCase().includes(query) ||
      s.customer.phone.includes(query) ||
      s.resource.name.toLowerCase().includes(query)
    )
  })

  const filteredCancelledBookings = bookings.filter((b) => {
    if (b.status !== 'CANCELLED') return false
    if (!query) return true
    return (
      b.customer.name.toLowerCase().includes(query) ||
      b.customer.phone.includes(query) ||
      b.resource.name.toLowerCase().includes(query)
    )
  })

  const activeWaitlist = waitlistEntries.filter((w) => w.status === 'WAITING' || w.status === 'SKIPPED')
  const filteredWaitlist = activeWaitlist.filter((w) => {
    if (!query) return true
    return (
      w.customer.name.toLowerCase().includes(query) ||
      w.customer.phone.includes(query) ||
      (w.categoryName && w.categoryName.toLowerCase().includes(query))
    )
  })

  // Open Smart Extend Modal
  async function openExtend(session: SessionItem) {
    setTargetSession(session)
    setExtendMinutes(30)
    setExtendModalOpen(true)
    setExtensionConflictInfo(null)
    setMaxAvailableExtension(null)

    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`)
      if (res.ok) {
        const data = await res.json()
        setMaxAvailableExtension(data.maxMinutes)
        if (data.conflictReason) {
          setExtensionConflictInfo(data.conflictReason)
        }
      }
    } catch {
      // Ignore
    }
  }

  // Open End & Bill Modal
  function openEndSession(session: SessionItem) {
    setTargetSession(session)
    setEndDiscount(0)
    setEndPaymentMethod('CASH')
    setEndModalOpen(true)
  }

  // Submit Booking / Walk-in
  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setConflictError('')
    setConflictAlternatives([])

    try {
      // 1. Resolve or create customer
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName, phone })
      })

      if (!custRes.ok) {
        const err = await custRes.json()
        throw new Error(err.message || 'Unable to register customer.')
      }

      const customer = await custRes.json()

      const addOnsPayload = Object.entries(selectedAddOnIds)
        .filter(([_, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }))

      if (bookingMode === 'WALKIN') {
        // Direct Walk-in Session
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.id,
            resourceId: selectedResourceId,
            expectedDurationMinutes: durationMinutes,
            partySize,
            groupMembers: groupMembers || undefined,
            addOns: addOnsPayload
          })
        })

        if (!sessionRes.ok) {
          const err = await sessionRes.json()
          if (sessionRes.status === 409 || err.code === 'BOOKING_CONFLICT') {
            setConflictError(err.message || 'Resource is occupied or conflicting with a scheduled booking.')
            setConflictAlternatives(err.alternatives || [])
            return
          }
          throw new Error(err.message || 'Could not start session.')
        }

        const newSession = await sessionRes.json()
        setActiveSessions([newSession, ...activeSessions])
        if (assigningWaitlistId) {
          fetch(`/api/waitlist/${assigningWaitlistId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ASSIGNED' })
          }).catch(() => {})
          setWaitlistEntries((prev) => prev.map((w) => (w.id === assigningWaitlistId ? { ...w, status: 'ASSIGNED' } : w)))
        }
        setNotice(`Live session started for ${customer.name} on ${selectedResource.name}!`)
        setBookingModalOpen(false)
        resetBookingForm()
      } else {
        // Advance Booking
        const start = new Date(`${scheduleDate}T${scheduleTime}:00`)
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

        const bookingRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.id,
            resourceId: selectedResourceId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            partySize,
            groupMembers: groupMembers || undefined,
            notes,
            priceEstimate: previewBill.total,
            addOns: addOnsPayload
          })
        })

        if (!bookingRes.ok) {
          const err = await bookingRes.json()
          if (bookingRes.status === 409 || err.error === 'BOOKING_CONFLICT') {
            setConflictError(err.message || 'Selected slot is unavailable.')
            setConflictAlternatives(err.alternatives || [])
            return
          }
          throw new Error(err.message || 'Could not create booking.')
        }

        const newBooking = await bookingRes.json()
        setBookings([newBooking, ...bookings])
        if (assigningWaitlistId) {
          fetch(`/api/waitlist/${assigningWaitlistId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ASSIGNED' })
          }).catch(() => {})
          setWaitlistEntries((prev) => prev.map((w) => (w.id === assigningWaitlistId ? { ...w, status: 'ASSIGNED' } : w)))
        }
        setNotice(`Booking confirmed for ${customer.name} on ${selectedResource.name}!`)
        setBookingModalOpen(false)
        resetBookingForm()
      }
    } catch (err: any) {
      setError(err.message || 'Action failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetBookingForm() {
    setPhone('')
    setCustomerName('')
    setPartySize(1)
    setGroupMembers('')
    setNotes('')
    setSelectedAddOnIds({})
    setConflictError('')
    setConflictAlternatives([])
    setCustomerInsight(null)
    setAssigningWaitlistId(null)
  }

  // Handle Smart Extension confirmation
  async function handleConfirmExtend(e: React.FormEvent) {
    e.preventDefault()
    if (!targetSession) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/sessions/${targetSession.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: extendMinutes })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Extension failed')
      }

      const updated = await res.json()
      setActiveSessions(activeSessions.map((s) => (s.id === targetSession.id ? updated : s)))
      setNotice(`Extended session for ${updated.customer.name} by +${extendMinutes}m!`)
      setExtendModalOpen(false)
    } catch (err: any) {
      setError(err.message || 'Could not extend session')
    } finally {
      setIsSubmitting(false)
    }
  }

  function formatDigitalTimer(startedAt: string): string {
    const elapsedSec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    const hrs = Math.floor(elapsedSec / 3600)
    const mins = Math.floor((elapsedSec % 3600) / 60)
    const secs = elapsedSec % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function formatRemainingTime(expectedEndAt?: string | null): { text: string; isOvertime: boolean } {
    if (!expectedEndAt) return { text: 'Running', isOvertime: false }
    const endMs = new Date(expectedEndAt).getTime()
    const diffMinutes = Math.round((endMs - now) / 60000)
    if (diffMinutes < 0) {
      return { text: `${Math.abs(diffMinutes)} min over`, isOvertime: true }
    }
    return { text: `${diffMinutes} min left`, isOvertime: false }
  }

  // Quick Multi-Option Extension (+15m, +30m, +60m)
  async function handleQuickExtend(session: SessionItem, minutes: number = 30) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setNotice(`⚠️ ${err.message || 'Cannot extend session.'}`)
        return
      }

      const updated = await res.json()
      setActiveSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, expectedEndAt: updated.expectedEndAt } : s))
      )
      setNotice(`✓ +${minutes}m added for ${session.customer.name}!`)
    } catch {
      setNotice('⚠️ Failed to extend session.')
    }
  }

  // Handle End Session & Mark Paid (Atomic Checkout)
  async function handleConfirmEndSession(e: React.FormEvent) {
    e.preventDefault()
    if (!targetSession) return
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/sessions/${targetSession.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount: endDiscount,
          paymentMethod: endPaymentMethod
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Could not end session')
      }

      const { session: endedSession, billing } = await res.json()
      setActiveSessions(activeSessions.filter((s) => s.id !== targetSession.id))
      setCompletedSessions([endedSession, ...completedSessions])
      setNotice(
        `Session ended for ${endedSession.customer.name}! Billed ₹${billing.total} (${endedSession.completionStatus.replace('_', ' ')}).`
      )
      setEndModalOpen(false)
    } catch (err: any) {
      setError(err.message || 'Failed to complete session')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Start an advance booking
  async function handleStartBooking(booking: BookingItem) {
    setIsSubmitting(true)
    setError('')
    try {
      const durationMins = Math.round(
        (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000
      )
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: booking.customer.id,
          resourceId: booking.resource.id,
          bookingId: booking.id,
          expectedDurationMinutes: durationMins,
          partySize: booking.partySize,
          groupMembers: booking.groupMembers || undefined
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Could not start booked session')
      }

      const session = await res.json()
      setActiveSessions([session, ...activeSessions])
      setBookings(bookings.map((b) => (b.id === booking.id ? { ...b, status: 'COMPLETED' } : b)))
      setNotice(`Started session for booking #${booking.id.slice(-6)}!`)
    } catch (err: any) {
      setError(err.message || 'Failed to start booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cancel Booking
  async function handleCancelBooking(bookingId: string) {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      })
      if (!res.ok) throw new Error('Cancellation failed')
      setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b)))
      setNotice('Booking cancelled.')
    } catch (err: any) {
      setError(err.message || 'Could not cancel booking')
    }
  }

  // Update Booking Status (e.g. ARRIVED, NO_SHOW)
  async function handleMarkBookingStatus(bookingId: string, status: 'ARRIVED' | 'NO_SHOW') {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error(`Could not update booking status to ${status}`)
      setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)))
      setNotice(`Booking marked as ${status === 'ARRIVED' ? 'Customer Arrived' : 'No-Show'}!`)
    } catch (err: any) {
      setError(err.message || 'Status update failed')
    }
  }

  // Submit to Waitlist
  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: waitlistCustomerName, phone: waitlistPhone })
      })
      if (!custRes.ok) {
        const err = await custRes.json()
        throw new Error(err.message || 'Could not register customer for waitlist')
      }
      const customer = await custRes.json()

      const wlRes = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          partySize: waitlistPartySize,
          categoryName: waitlistCategory || undefined,
          notes: waitlistNotes || undefined
        })
      })
      if (!wlRes.ok) {
        const err = await wlRes.json()
        throw new Error(err.message || 'Could not add to waitlist')
      }
      const created = await wlRes.json()
      setWaitlistEntries([...waitlistEntries, created])
      setNotice(`Added ${customer.name} to waitlist!`)
      setWaitlistModalOpen(false)
      setWaitlistPhone('')
      setWaitlistCustomerName('')
      setWaitlistPartySize(1)
      setWaitlistCategory('')
      setWaitlistNotes('')
    } catch (err: any) {
      setError(err.message || 'Waitlist action failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Assign Waitlist Entry to Walk-in or Booking
  function handleAssignWaitlist(entry: WaitlistEntryItem) {
    setAssigningWaitlistId(entry.id)
    setPhone(entry.customer.phone)
    setCustomerName(entry.customer.name)
    setPartySize(entry.partySize)
    if (entry.categoryName) {
      const matched = resources.find(
        (r) => r.categoryName.toLowerCase() === entry.categoryName?.toLowerCase()
      )
      if (matched) setSelectedResourceId(matched.id)
    }
    setBookingMode('WALKIN')
    setBookingModalOpen(true)
  }

  // Skip Waitlist Entry
  async function handleSkipWaitlist(id: string) {
    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SKIPPED' })
      })
      if (!res.ok) throw new Error('Could not skip waitlist entry')
      setWaitlistEntries(waitlistEntries.map((w) => (w.id === id ? { ...w, status: 'SKIPPED' } : w)))
      setNotice('Waitlist entry marked as skipped.')
    } catch (err: any) {
      setError(err.message || 'Skip failed')
    }
  }

  // Remove Waitlist Entry
  async function handleRemoveWaitlist(id: string) {
    if (!confirm('Remove this entry from waitlist?')) return
    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REMOVED' })
      })
      if (!res.ok) throw new Error('Could not remove waitlist entry')
      setWaitlistEntries(waitlistEntries.filter((w) => w.id !== id))
      setNotice('Removed from waitlist.')
    } catch (err: any) {
      setError(err.message || 'Remove failed')
    }
  }

  return (
    <div>
      {/* Toast Notifications */}
      {notice && (
        <div style={{ padding: '10px 16px', background: '#dcfce7', color: '#166534', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>×</button>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>×</button>
        </div>
      )}

      {/* Primary Action & Navigation Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={activeTab === 'ALL' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('ALL')}
            style={{ fontSize: 13 }}
          >
            All
          </button>
          <button
            type="button"
            className={activeTab === 'LIVE' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('LIVE')}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Live Now ({activeSessions.length})
          </button>
          <button
            type="button"
            className={activeTab === 'UPCOMING' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('UPCOMING')}
            style={{ fontSize: 13 }}
          >
            Upcoming ({filteredUpcomingBookings.length})
          </button>
          <button
            type="button"
            className={activeTab === 'WAITLIST' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('WAITLIST')}
            style={{ fontSize: 13 }}
          >
            Waitlist ({filteredWaitlist.length})
          </button>
          <button
            type="button"
            className={activeTab === 'COMPLETED' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('COMPLETED')}
            style={{ fontSize: 13 }}
          >
            Completed ({completedSessions.length})
          </button>
          <button
            type="button"
            className={activeTab === 'CANCELLED' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('CANCELLED')}
            style={{ fontSize: 13 }}
          >
            Cancelled ({filteredCancelledBookings.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search customer / phone / resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, height: 38, width: '100%' }}
            />
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              resetBookingForm()
              setBookingMode('SCHEDULE')
              setBookingModalOpen(true)
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', fontWeight: 700 }}
          >
            <span>+ Booking</span>
          </button>

          <button
            type="button"
            className="primary"
            onClick={() => setWalkInModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px', fontWeight: 800 }}
          >
            <Plus size={16} /> + Start Walk-in
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              setWaitlistPhone('')
              setWaitlistCustomerName('')
              setWaitlistPartySize(1)
              setWaitlistCategory('')
              setWaitlistNotes('')
              setWaitlistModalOpen(true)
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', fontWeight: 700 }}
          >
            <Users size={13} /> + Add to Waitlist
          </button>
        </div>
      </div>

      {/* SECTION 1: LIVE NOW */}
      {(activeTab === 'ALL' || activeTab === 'LIVE') && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <h2 style={{ font: '800 16px Manrope', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              LIVE NOW ({filteredActiveSessions.length} active {filteredActiveSessions.length === 1 ? 'session' : 'sessions'} running)
            </h2>
          </div>

          {filteredActiveSessions.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
              <Clock3 size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>No live sessions running.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Start a walk-in or launch an upcoming booking to monitor live timers.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16
              }}
            >
              {filteredActiveSessions.map((session) => {
                const startMs = new Date(session.startedAt).getTime()
                const plannedEndMs = session.expectedEndAt ? new Date(session.expectedEndAt).getTime() : startMs + 60 * 60 * 1000
                const elapsedMinutes = Math.max(1, Math.floor((now - startMs) / 60000))
                const remainingMinutes = Math.floor((plannedEndMs - now) / 60000)
                const isOvertime = remainingMinutes < 0

                // Real-time bill estimate
                const liveAddOns: AddOnItem[] = (session.addOns || []).map((a) => ({
                  name: a.name,
                  price: a.price,
                  pricingType: a.pricingType,
                  quantity: a.quantity
                }))

                const liveBill = calculateSessionBill(
                  session.pricingRule.rate,
                  new Date(session.startedAt),
                  new Date(now),
                  0,
                  0,
                  liveAddOns,
                  session.partySize
                )

                const plannedDurationMins = session.plannedEndAt
                  ? Math.round((new Date(session.plannedEndAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
                  : Math.round((plannedEndMs - startMs) / 60000)

                const formatMins = (m: number) => {
                  const abs = Math.abs(m)
                  if (abs < 60) return `${abs}m`
                  return `${Math.floor(abs / 60)}h ${abs % 60}m`
                }

                const digitalTime = formatDigitalTimer(session.startedAt)
                const remaining = formatRemainingTime(session.expectedEndAt)

                return (
                  <div
                    key={session.id}
                    style={{
                      background: 'var(--panel-bg, #0d1017)',
                      border: remaining.isOvertime
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      borderLeft: remaining.isOvertime ? '4px solid #ef4444' : '4px solid #7c5cff',
                      borderRadius: 12,
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      boxShadow: remaining.isOvertime
                        ? '0 4px 20px rgba(239, 68, 68, 0.15)'
                        : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(124, 92, 255, 0.08)'
                    }}
                  >
                    {/* Top: Status & Running Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: remaining.isOvertime ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: remaining.isOvertime ? '#f87171' : '#4ade80',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase'
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: remaining.isOvertime ? '#ef4444' : '#22c55e',
                            boxShadow: remaining.isOvertime ? '0 0 8px #ef4444' : '0 0 8px #22c55e'
                          }}
                        />
                        {remaining.isOvertime ? 'OVERTIME' : 'LIVE'}
                      </div>

                      <div
                        style={{
                          font: '900 18px Manrope',
                          color: '#4ade80',
                          textShadow: '0 0 12px rgba(74, 222, 128, 0.25)'
                        }}
                      >
                        ₹{liveBill.total}
                      </div>
                    </div>

                    {/* Customer & Resource info */}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary, #f8fafc)' }}>
                        {session.customer.name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                        {session.resource.name} · {session.partySize} {session.partySize === 1 ? 'person' : 'people'}
                      </div>
                    </div>

                    {/* Visually Dominant Digital Timer */}
                    <div
                      style={{
                        background: 'var(--panel-subtle, #11151e)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
                        borderRadius: 10,
                        padding: '12px 16px',
                        textAlign: 'center'
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 26,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          color: 'var(--text-primary, #f8fafc)',
                          textShadow: '0 0 16px rgba(124, 92, 255, 0.3)'
                        }}
                      >
                        {digitalTime}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: remaining.isOvertime ? '#f87171' : 'var(--text-muted, #94a3b8)',
                          marginTop: 2
                        }}
                      >
                        {remaining.text}
                      </div>
                    </div>

                    {/* Controls: Quick Extend Chips + EXTEND + END SESSION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {[15, 30, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleQuickExtend(session, mins)}
                            style={{
                              height: 32,
                              borderRadius: 6,
                              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                              background: 'var(--panel-subtle, #11151e)',
                              color: 'var(--text-primary, #f8fafc)',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title={`Extend by +${mins}m`}
                          >
                            +{mins}m
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            setTargetSession(session)
                            setExtendModalOpen(true)
                          }}
                          style={{
                            height: 32,
                            borderRadius: 6,
                            border: '1px solid rgba(124, 92, 255, 0.3)',
                            background: 'rgba(124, 92, 255, 0.12)',
                            color: '#c4b5fd',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          title="Open full extension options"
                        >
                          EXTEND
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEndSession(session)}
                        style={{
                          width: '100%',
                          height: 36,
                          borderRadius: 8,
                          border: 'none',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          letterSpacing: '0.04em'
                        }}
                      >
                        END SESSION
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: UPCOMING BOOKINGS */}
      {(activeTab === 'ALL' || activeTab === 'UPCOMING') && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ font: '800 16px Manrope', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            UPCOMING BOOKINGS ({filteredUpcomingBookings.length})
          </h2>

          {filteredUpcomingBookings.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
              <CalendarDays size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>No upcoming bookings scheduled.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Advance reservations made by customers will appear here ready to launch.
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-header" style={{ gridTemplateColumns: '1.4fr 1.2fr 1.4fr 1fr 1fr 1.2fr' }}>
                <span>CUSTOMER</span>
                <span>RESOURCE</span>
                <span>DATE & TIME</span>
                <span>DURATION</span>
                <span>ESTIMATE</span>
                <span style={{ textAlign: 'right' }}>ACTIONS</span>
              </div>

              {filteredUpcomingBookings.map((b) => {
                const start = new Date(b.startTime)
                const end = new Date(b.endTime)
                const durMins = Math.round((end.getTime() - start.getTime()) / 60000)
                const durStr = durMins >= 60 ? `${Math.floor(durMins / 60)}h ${durMins % 60}m` : `${durMins}m`

                return (
                  <div
                    key={b.id}
                    className="table-row"
                    style={{ gridTemplateColumns: '1.4fr 1.2fr 1.4fr 1fr 1fr 1.2fr', padding: '12px 16px', alignItems: 'center' }}
                  >
                    <div>
                      <b>{b.customer.name}</b>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {b.customer.phone} · 👥 {b.partySize} {b.partySize === 1 ? 'person' : 'people'}
                      </div>
                    </div>

                    <div>
                      <b>{b.resource.name}</b>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {b.addOns && b.addOns.length > 0
                          ? `Add-ons: ${b.addOns.map((a) => `${a.name} ×${a.quantity}`).join(', ')}`
                          : 'No add-ons'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div>{durStr}</div>

                    <div>
                      <div style={{ fontWeight: 700, color: '#10b981' }}>
                        ₹{b.priceEstimate || 0}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-block',
                          marginTop: 3,
                          textTransform: 'uppercase',
                          background:
                            b.status === 'ARRIVED'
                              ? '#dcfce7'
                              : b.status === 'NO_SHOW'
                              ? '#fee2e2'
                              : '#e0f2fe',
                          color:
                            b.status === 'ARRIVED'
                              ? '#166534'
                              : b.status === 'NO_SHOW'
                              ? '#991b1b'
                              : '#0369a1'
                        }}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {b.status !== 'ARRIVED' && b.status !== 'NO_SHOW' && (
                        <>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleMarkBookingStatus(b.id, 'ARRIVED')}
                            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', border: '1px solid #86efac' }}
                            title="Mark Customer Arrived"
                          >
                            ✓ Arrived
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleMarkBookingStatus(b.id, 'NO_SHOW')}
                            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5' }}
                            title="Mark No-Show"
                          >
                            ✗ No-Show
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleStartBooking(b)}
                        style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Play size={12} /> Start
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleCancelBooking(b.id)}
                        style={{ padding: '5px 8px', fontSize: 12 }}
                        title="Cancel Booking"
                      >
                        <Ban size={12} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: WAITLIST QUEUE */}
      {(activeTab === 'ALL' || activeTab === 'WAITLIST') && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ font: '800 16px Manrope', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              WAITLIST QUEUE ({filteredWaitlist.length})
            </h2>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setWaitlistPhone('')
                setWaitlistCustomerName('')
                setWaitlistPartySize(1)
                setWaitlistCategory('')
                setWaitlistNotes('')
                setWaitlistModalOpen(true)
              }}
              style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={13} /> Add Customer to Waitlist
            </button>
          </div>

          {filteredWaitlist.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
              <Users size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>Waitlist is currently empty.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                When tables are full, add walk-in parties to the waitlist queue.
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-header" style={{ gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 1.4fr' }}>
                <span>CUSTOMER</span>
                <span>PARTY SIZE</span>
                <span>PREFERRED CATEGORY</span>
                <span>WAITING SINCE</span>
                <span>STATUS</span>
                <span style={{ textAlign: 'right' }}>ACTIONS</span>
              </div>

              {filteredWaitlist.map((w) => {
                const waitMins = Math.max(0, Math.floor((now - new Date(w.createdAt).getTime()) / 60000))
                const waitStr = waitMins >= 60 ? `${Math.floor(waitMins / 60)}h ${waitMins % 60}m ago` : `${waitMins}m ago`

                return (
                  <div
                    key={w.id}
                    className="table-row"
                    style={{ gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 1.4fr', padding: '12px 16px', alignItems: 'center' }}
                  >
                    <div>
                      <b>{w.customer.name}</b>
                      <div style={{ fontSize: 11, color: '#888' }}>{w.customer.phone}</div>
                    </div>

                    <div style={{ fontWeight: 600 }}>
                      👥 {w.partySize} {w.partySize === 1 ? 'person' : 'people'}
                    </div>

                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {w.categoryName || 'Any available'}
                      </span>
                      {w.notes && <div style={{ fontSize: 11, color: '#888' }}>{w.notes}</div>}
                    </div>

                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {waitStr}
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          background: w.status === 'SKIPPED' ? '#fef3c7' : '#e0f2fe',
                          color: w.status === 'SKIPPED' ? '#92400e' : '#0369a1'
                        }}
                      >
                        {w.status}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleAssignWaitlist(w)}
                        style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Play size={12} /> Assign & Start
                      </button>

                      {w.status === 'WAITING' && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleSkipWaitlist(w.id)}
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          title="Skip Entry"
                        >
                          Skip
                        </button>
                      )}

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleRemoveWaitlist(w.id)}
                        style={{ padding: '5px 8px', fontSize: 12 }}
                        title="Remove from Waitlist"
                      >
                        <X size={12} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: RECENTLY COMPLETED SESSIONS */}
      {(activeTab === 'ALL' || activeTab === 'COMPLETED') && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ font: '800 16px Manrope', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            RECENTLY COMPLETED SESSIONS ({filteredCompletedSessions.length})
          </h2>

          {filteredCompletedSessions.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
              <CheckCircle size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>No completed sessions yet.</div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-header" style={{ gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1fr 1fr 1fr' }}>
                <span>CUSTOMER</span>
                <span>RESOURCE</span>
                <span>BOOKED VS ACTUAL</span>
                <span>FINAL BILL</span>
                <span>PAYMENT</span>
                <span>STATUS</span>
              </div>

              {filteredCompletedSessions.map((session) => {
                const plannedMins = session.plannedEndAt
                  ? Math.round((new Date(session.plannedEndAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
                  : 60
                const actualMins = session.endedAt
                  ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
                  : 0

                const pMethod = session.transaction?.payments?.[0]?.method || 'CASH'
                const pStatus = session.transaction?.payments?.[0] ? 'PAID' : 'COMPLETED'
                const statusTag = session.completionStatus || 'COMPLETED'

                return (
                  <div
                    key={session.id}
                    className="table-row"
                    style={{ gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1fr 1fr 1fr', padding: '12px 16px', alignItems: 'center' }}
                  >
                    <div>
                      <b>{session.customer.name}</b>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {session.customer.phone} · 👥 {session.partySize || 1} people
                      </div>
                    </div>

                    <div>
                      <b>{session.resource.name}</b>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {actualMins}m actual
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        Booked: {plannedMins}m (₹{session.bookedAmount || session.finalAmount || 0})
                      </div>
                    </div>

                    <div style={{ fontWeight: 800, color: '#10b981' }}>
                      ₹{session.finalAmount || 0}
                    </div>

                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{pMethod}</span>
                      <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>{pStatus}</div>
                    </div>

                    <div>
                      <span
                        className={`status-pill ${
                          statusTag === 'ENDED_EARLY' ? 'blue' : statusTag === 'RAN_OVER' ? 'orange' : 'green'
                        }`}
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {statusTag.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: CANCELLED BOOKINGS */}
      {activeTab === 'CANCELLED' && (
        <div>
          <h2 style={{ font: '800 16px Manrope', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            CANCELLED BOOKINGS ({filteredCancelledBookings.length})
          </h2>

          {filteredCancelledBookings.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
              No cancelled bookings.
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              {filteredCancelledBookings.map((b) => (
                <div key={b.id} className="table-row" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <b>{b.customer.name}</b> ({b.customer.phone})
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {b.resource.name} · {new Date(b.startTime).toLocaleString()}
                    </div>
                  </div>
                  <span className="status-pill cancelled">CANCELLED</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: NEW BOOKING / WALK-IN */}
      {bookingModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 580, width: '94%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ font: '800 18px Manrope', margin: 0 }}>New Booking & Session</h2>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Quick customer registration, resource allocation, and add-on billing.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher: Walk-in vs Advance Schedule */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setBookingMode('WALKIN')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: bookingMode === 'WALKIN' ? '#ffffff' : 'transparent',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: bookingMode === 'WALKIN' ? '#0f172a' : '#64748b'
                }}
              >
                ⚡ Walk-in (Start Now)
              </button>
              <button
                type="button"
                onClick={() => setBookingMode('SCHEDULE')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: bookingMode === 'SCHEDULE' ? '#ffffff' : 'transparent',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: bookingMode === 'SCHEDULE' ? '#0f172a' : '#64748b'
                }}
              >
                📅 Advance Booking
              </button>
            </div>

            {/* Conflict Warning & Alternatives Banner */}
            {conflictError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                  Scheduling Conflict
                </div>
                <div style={{ color: '#b91c1c', marginBottom: 8 }}>{conflictError}</div>
                {conflictAlternatives.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>Select available alternative:</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {conflictAlternatives.map((alt) => (
                        <button
                          key={alt.id}
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setSelectedResourceId(alt.id)
                            setConflictError('')
                            setConflictAlternatives([])
                          }}
                          style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
                        >
                          → {alt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              {/* 1. CUSTOMER: Phone First */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  CUSTOMER PHONE *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  required
                  autoFocus
                  style={{ fontSize: 15, padding: '9px 12px' }}
                />
              </div>

              {/* Existing Customer Identified vs New Customer Name */}
              {customerInsight && customerInsight.hasHistory ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#166534', fontSize: 14 }}>
                      {customerName}
                    </div>
                    <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                      {(customerInsight as any).totalVisits ? `${(customerInsight as any).totalVisits} visits` : 'Returning customer'}
                      {customerInsight.favouriteCategory ? ` · Plays: ${customerInsight.favouriteCategory}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '3px 8px',
                      borderRadius: 6
                    }}
                  >
                    IDENTIFIED
                  </span>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    CUSTOMER NAME *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name"
                    required
                    style={{ fontSize: 14, padding: '9px 12px' }}
                  />
                </div>
              )}

              {/* 2. PLAYERS: Stepper */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  PLAYERS
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setPartySize(Math.max(1, partySize - 1))}
                    style={{ width: 36, height: 36, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: 17, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>
                    {partySize}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setPartySize(partySize + 1)}
                    style={{ width: 36, height: 36, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 3. RESOURCE: Compact Selectable Resources */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  RESOURCE *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 8,
                    maxHeight: 180,
                    overflowY: 'auto',
                    padding: 2
                  }}
                >
                  {resources.map((r) => {
                    const isSelected = selectedResourceId === r.id
                    const isAvailable = r.status === 'AVAILABLE'
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedResourceId(r.id)}
                        style={{
                          border: isSelected ? '2px solid #10b981' : '1px solid var(--border-color, #cbd5e1)',
                          background: isSelected ? '#f0fdf4' : 'var(--panel-bg, #ffffff)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>₹{r.rate}/hr</div>
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 4,
                            fontWeight: 600,
                            color: isAvailable ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {isAvailable ? '🟢 Available' : r.status === 'MAINTENANCE' ? '🔧 Maintenance' : '🔴 Busy'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 4. EXTRAS: Quantity Controls */}
              {applicableAddOns.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    EXTRAS
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {applicableAddOns.map((addon) => {
                      const qty = selectedAddOnIds[addon.id] || 0
                      const unitText = addon.pricingType === 'PER_HOUR' ? 'each/hour' : 'each'
                      return (
                        <div
                          key={addon.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: qty > 0 ? 'var(--accent-glow-subtle, rgba(124, 92, 255, 0.15))' : 'var(--panel-subtle, #11151e)',
                            border: qty > 0 ? '1px solid var(--primary-accent, #7c5cff)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                            padding: '6px 12px',
                            borderRadius: 8
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{addon.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>₹{addon.price} {unitText}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setAddOnQty(addon.id, -1)}
                              style={{ width: 28, height: 28, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              −
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setAddOnQty(addon.id, 1)}
                              style={{ width: 28, height: 28, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Schedule Date & Time if not walkin */}
              {bookingMode === 'SCHEDULE' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>DATE *</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>START TIME *</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* 5. DURATION: Quick Buttons + Custom */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  DURATION
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: '30m', mins: 30 },
                    { label: '1h', mins: 60 },
                    { label: '1.5h', mins: 90 },
                    { label: '2h', mins: 120 },
                    { label: '3h', mins: 180 }
                  ].map((d) => (
                    <button
                      key={d.mins}
                      type="button"
                      className={durationMinutes === d.mins ? 'primary' : 'secondary'}
                      onClick={() => setDurationMinutes(d.mins)}
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
                    >
                      {d.label}
                    </button>
                  ))}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="15"
                      max="720"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      style={{ width: 62, padding: '4px 6px', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: '#888' }}>mins</span>
                  </div>
                </div>
              </div>

              {/* 6. PRICE: Clean Display */}
              <div
                style={{
                  background: 'var(--panel-subtle, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 18
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>₹{previewBill.hourlyRate}/hr</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedAddOnsItems.length > 0
                      ? `${selectedAddOnsItems.map((a) => `${a.quantity} ${a.name.toLowerCase()}`).join(', ')} · `
                      : ''}
                    {durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 8,
                    borderTop: '1px solid var(--border-color, #e2e8f0)',
                    paddingTop: 8
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>TOTAL</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>₹{previewBill.total}</span>
                </div>
              </div>

              {/* 7. PRIMARY CTA */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setBookingModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={isSubmitting}
                  style={{ padding: '9px 24px', fontWeight: 800 }}
                >
                  {isSubmitting
                    ? 'Processing...'
                    : bookingMode === 'WALKIN'
                    ? 'START SESSION'
                    : 'CONFIRM BOOKING'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SMART EXTENSION */}
      {extendModalOpen && targetSession && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ font: '800 16px Manrope', margin: 0 }}>Extend Live Session</h2>
              <button
                type="button"
                onClick={() => setExtendModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#334155', marginBottom: 14 }}>
              <b>{targetSession.customer.name}</b> · {targetSession.resource.name}
            </div>

            {/* Max Available Extension Banner */}
            {maxAvailableExtension !== null && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#166534' }}>
                  Maximum available extension: {maxAvailableExtension} minutes
                </div>
                {extensionConflictInfo && (
                  <div style={{ color: '#15803d', marginTop: 2 }}>{extensionConflictInfo}</div>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmExtend}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Select Extension Time</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {[15, 30, 45, 60].map((m) => {
                    const isDisabled = maxAvailableExtension !== null && m > maxAvailableExtension
                    return (
                      <button
                        key={m}
                        type="button"
                        className={extendMinutes === m ? 'primary' : 'secondary'}
                        onClick={() => setExtendMinutes(m)}
                        disabled={isDisabled}
                        style={{ padding: '6px 12px', fontSize: 13, opacity: isDisabled ? 0.4 : 1 }}
                      >
                        +{m} min
                      </button>
                    )
                  })}
                  {maxAvailableExtension !== null && maxAvailableExtension > 0 && maxAvailableExtension < 60 && (
                    <button
                      type="button"
                      className={extendMinutes === maxAvailableExtension ? 'primary' : 'secondary'}
                      onClick={() => setExtendMinutes(maxAvailableExtension)}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      +{maxAvailableExtension} min (Max)
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Custom Minutes</label>
                <input
                  type="number"
                  min="5"
                  max={maxAvailableExtension ?? 180}
                  value={extendMinutes}
                  onChange={(e) => setExtendMinutes(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setExtendModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Extending...' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SIMPLE END SESSION */}
      <SimpleEndSessionModal
        isOpen={endModalOpen}
        session={targetSession}
        onClose={() => setEndModalOpen(false)}
        onSuccess={({ session: endedSession, billing }) => {
          setActiveSessions((prev) => prev.filter((s) => s.id !== endedSession.id))
          setCompletedSessions((prev) => [endedSession, ...prev])
          setNotice(
            `Session ended for ${endedSession.customer.name}! Billed ₹${billing?.total || endedSession.finalAmount || 0}.`
          )
          setEndModalOpen(false)
        }}
      />

      {/* MODAL 4: ADD TO WAITLIST */}
      {waitlistModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ font: '800 17px Manrope', margin: 0 }}>Add to Waitlist</h2>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Queue a waiting party when stations are full.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaitlistModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWaitlistSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    value={waitlistPhone}
                    onChange={(e) => {
                      setWaitlistPhone(e.target.value)
                      const clean = e.target.value.replace(/\D/g, '')
                      if (clean.length >= 6) {
                        const found = customers.find((c) => c.phone.replace(/\D/g, '').includes(clean))
                        if (found) setWaitlistCustomerName(found.name)
                      }
                    }}
                    placeholder="Customer phone"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input
                    type="text"
                    value={waitlistCustomerName}
                    onChange={(e) => setWaitlistCustomerName(e.target.value)}
                    placeholder="Customer name"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label>Group Size *</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={waitlistPartySize}
                    onChange={(e) => setWaitlistPartySize(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category Preference</label>
                  <select
                    value={waitlistCategory}
                    onChange={(e) => setWaitlistCategory(e.target.value)}
                  >
                    <option value="">Any available game / table</option>
                    {Array.from(new Set(resources.map((r) => r.categoryName))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Notes (Optional)</label>
                <input
                  type="text"
                  value={waitlistNotes}
                  onChange={(e) => setWaitlistNotes(e.target.value)}
                  placeholder="e.g. Willing to play Pool if PS5 takes too long"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setWaitlistModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', fontWeight: 700 }}
                >
                  {isSubmitting ? 'Adding...' : '+ Add to Waitlist Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ultra-Fast Start Walk-in Modal */}
      <StartWalkInModal
        isOpen={walkInModalOpen}
        onClose={() => setWalkInModalOpen(false)}
        onSuccess={(createdSession) => {
          const formatted: SessionItem = {
            id: createdSession.id,
            status: createdSession.status || 'ACTIVE',
            startedAt: createdSession.startedAt || new Date().toISOString(),
            expectedEndAt: createdSession.expectedEndAt || null,
            plannedStartAt: createdSession.plannedStartAt || createdSession.startedAt,
            plannedEndAt: createdSession.plannedEndAt || null,
            partySize: createdSession.partySize || 1,
            groupMembers: createdSession.groupMembers || null,
            customer: createdSession.customer,
            resource: createdSession.resource,
            pricingRule: createdSession.pricingRule || { rate: 120 },
            addOns: createdSession.addOns || []
          }
          setActiveSessions((prev) => [formatted, ...prev.filter((s) => s.id !== createdSession.id)])
          setActiveTab('LIVE')
          setNotice(`Live session started for ${createdSession.customer?.name} on ${createdSession.resource?.name}!`)
        }}
        resources={walkInResources}
        addOns={addOnsList}
        initialCustomers={customers}
      />

      {/* Extend Session Modal */}
      <ExtendSessionModal
        isOpen={extendModalOpen}
        session={
          targetSession
            ? {
                id: targetSession.id,
                expectedEndAt: targetSession.expectedEndAt,
                startedAt: targetSession.startedAt,
                customer: targetSession.customer,
                resource: targetSession.resource,
                pricingRule: targetSession.pricingRule,
                addOns: (targetSession.addOns || []).map((a) => ({
                  quantity: a.quantity,
                  addOn: { name: a.name, price: a.price, pricingType: a.pricingType }
                }))
              }
            : null
        }
        onClose={() => setExtendModalOpen(false)}
        onSuccess={(updatedSession, message) => {
          setActiveSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? { ...s, expectedEndAt: updatedSession.expectedEndAt } : s))
          )
          setNotice(message)
        }}
      />
    </div>
  )
}
