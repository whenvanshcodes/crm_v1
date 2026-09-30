/**
 * Helper utilities for venue operating hours, with full support for overnight schedules (e.g. 10:00 AM to 02:00 AM next day).
 */

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  const hours = parseInt(parts[0] || '0', 10)
  const minutes = parseInt(parts[1] || '0', 10)
  return hours * 60 + minutes
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  let hours = parseInt(parts[0] || '0', 10)
  const minutes = parts[1] ? parts[1].padStart(2, '0') : '00'
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

export function formatOperatingHours(
  openingTime: string = '10:00',
  closingTime: string = '02:00'
): {
  display: string
  isOvernight: boolean
  formattedOpen: string
  formattedClose: string
  openUntilLabel: string
} {
  const openMins = parseTimeToMinutes(openingTime)
  const closeMins = parseTimeToMinutes(closingTime)
  const isOvernight = closeMins <= openMins

  const formattedOpen = formatTime12h(openingTime)
  const formattedClose = formatTime12h(closingTime)

  const display = isOvernight
    ? `${formattedOpen} – ${formattedClose} (Next Day)`
    : `${formattedOpen} – ${formattedClose}`

  const openUntilLabel = `Open until ${formattedClose}${isOvernight ? ' (Next day)' : ''}`

  return {
    display,
    isOvernight,
    formattedOpen,
    formattedClose,
    openUntilLabel
  }
}

export function isCurrentlyOpen(
  openingTime: string = '10:00',
  closingTime: string = '02:00',
  currentTime: Date = new Date()
): boolean {
  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes()
  const openMins = parseTimeToMinutes(openingTime)
  const closeMins = parseTimeToMinutes(closingTime)

  if (closeMins <= openMins) {
    // Overnight: e.g. 10:00 AM (600) to 02:00 AM (120)
    // Open if after 10:00 AM OR before 02:00 AM
    return currentMins >= openMins || currentMins < closeMins
  }

  // Same day: e.g. 10:00 AM (600) to 10:00 PM (1320)
  return currentMins >= openMins && currentMins < closeMins
}
