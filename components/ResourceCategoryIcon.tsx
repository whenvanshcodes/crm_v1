'use client'

import React from 'react'
import { Gamepad2, Monitor, CircleDot, Tv } from 'lucide-react'

interface ResourceCategoryIconProps {
  category?: string | null
  name?: string | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function ResourceCategoryIcon({
  category = '',
  name = '',
  size = 16,
  style
}: ResourceCategoryIconProps) {
  const combined = `${category || ''} ${name || ''}`.toLowerCase()

  if (combined.includes('snooker') || combined.includes('pool') || combined.includes('billiards') || combined.includes('table')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8',
          ...style
        }}
        title={category || 'Table'}
      >
        <CircleDot size={size} />
      </span>
    )
  }

  if (combined.includes('pc') || combined.includes('computer') || combined.includes('esports') || combined.includes('rig')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
          ...style
        }}
        title={category || 'PC'}
      >
        <Monitor size={size} />
      </span>
    )
  }

  if (combined.includes('ps5') || combined.includes('xbox') || combined.includes('console') || combined.includes('gaming')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#34d399',
          ...style
        }}
        title={category || 'Console'}
      >
        <Gamepad2 size={size} />
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a78bfa',
        ...style
      }}
      title={category || 'Station'}
    >
      <Tv size={size} />
    </span>
  )
}

export default ResourceCategoryIcon
