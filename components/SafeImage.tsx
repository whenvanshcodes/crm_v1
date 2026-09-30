'use client'

import React, { useState } from 'react'

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  alt: string
  fallback?: React.ReactNode
}

/**
 * SafeImage ensures that no broken image icons, undefined, null,
 * or failed image URLs are ever displayed in the UI.
 * If the image fails to load or the source is falsy, it immediately
 * renders the provided fallback (or nothing if fallback is omitted).
 */
export function SafeImage({
  src,
  alt,
  fallback = null,
  style,
  className,
  ...props
}: SafeImageProps) {
  const [failed, setFailed] = useState(false)

  const isValidSrc =
    Boolean(src) &&
    typeof src === 'string' &&
    src.trim() !== '' &&
    src !== 'null' &&
    src !== 'undefined'

  if (!isValidSrc || failed) {
    return <>{fallback}</>
  }

  return (
    <img
      src={src!}
      alt={alt}
      style={style}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  )
}

export default SafeImage
