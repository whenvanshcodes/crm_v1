'use client'

import React, { useRef, useState } from 'react'
import { Upload, X, RefreshCw, AlertCircle } from 'lucide-react'
import { SafeImage } from './SafeImage'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  folder?: 'resources' | 'parlours' | 'profiles' | 'gallery'
  label?: string
  aspectRatio?: 'square' | 'wide'
  disabled?: boolean
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export function ImageUpload({
  value,
  onChange,
  folder = 'resources',
  label = 'Upload Image (Optional)',
  aspectRatio = 'square',
  disabled = false
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)

    // Format validation
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setErrorMessage('Invalid format. Please use PNG, JPG, JPEG, or WEBP.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Size validation
    if (file.size > MAX_SIZE) {
      setErrorMessage('File exceeds 5MB size limit.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      if (value && value.startsWith('/uploads/')) {
        formData.append('replaceKey', value)
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image')
      }

      onChange(data.url)
    } catch (err: any) {
      setErrorMessage(err.message || 'Image upload failed. You can proceed without an image.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemove() {
    setErrorMessage(null)
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      {/* Validation Error banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 11,
            color: '#f87171'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} /> {errorMessage}
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 800,
              padding: 0
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* When Image Exists: Preview + Change + Remove */}
      {value ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            borderRadius: 8,
            padding: '8px 12px'
          }}
        >
          {/* Thumbnail preview */}
          <div
            style={{
              width: aspectRatio === 'wide' ? 68 : 44,
              height: 44,
              borderRadius: 6,
              overflow: 'hidden',
              flexShrink: 0,
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <SafeImage
              src={value}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fallback={
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>IMG</span>
              }
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-primary, #f8fafc)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              Image attached
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              Optional enhancement
            </div>
          </div>

          {/* Action buttons: Change & Remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 9px',
                borderRadius: 5,
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={11} className={isUploading ? 'spin' : ''} />
              Change
            </button>

            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={handleRemove}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '5px 8px',
                borderRadius: 5,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#f87171',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Remove image"
            >
              <X size={12} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* When No Image: Compact, unobtrusive trigger */
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 38,
            padding: '0 14px',
            borderRadius: 8,
            border: '1px dashed var(--border-color, rgba(255, 255, 255, 0.18))',
            background: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-secondary, #94a3b8)',
            fontSize: 12,
            fontWeight: 700,
            cursor: isUploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Upload size={13} style={{ color: '#818cf8' }} />
          <span>{isUploading ? 'Uploading...' : label}</span>
        </button>
      )}
    </div>
  )
}

export default ImageUpload
