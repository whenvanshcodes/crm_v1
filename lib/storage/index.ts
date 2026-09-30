import fs from 'fs/promises'
import path from 'path'

export interface StorageResult {
  url: string
  key: string
}

export interface StorageProvider {
  upload(
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder?: string
  ): Promise<StorageResult>
  replace(
    key: string,
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder?: string
  ): Promise<StorageResult>
  delete(key: string): Promise<boolean>
  getUrl(key: string): string
}

/**
 * LocalStorageProvider
 * ₹0 external cost storage for local MVP development & production.
 * Stores uploaded assets in the `public/uploads` directory.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), 'public', 'uploads')
  }

  private sanitizeFolder(folder: string): string {
    return folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general'
  }

  private getExtension(filename: string, mimeType: string): string {
    const ext = path.extname(filename).toLowerCase()
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return ext
    }
    if (mimeType.includes('png')) return '.png'
    if (mimeType.includes('webp')) return '.webp'
    return '.jpg'
  }

  async upload(
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder: string = 'general'
  ): Promise<StorageResult> {
    const safeFolder = this.sanitizeFolder(folder)
    const ext = this.getExtension(file.filename, file.mimeType)
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`
    const relativeKey = `${safeFolder}/${uniqueName}`
    const targetDir = path.join(this.baseDir, safeFolder)
    const fullPath = path.join(this.baseDir, relativeKey)

    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(fullPath, file.buffer)

    const url = `/uploads/${relativeKey.replace(/\\/g, '/')}`
    return { url, key: relativeKey }
  }

  async replace(
    key: string,
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder: string = 'general'
  ): Promise<StorageResult> {
    if (key) {
      await this.delete(key)
    }
    return this.upload(file, folder)
  }

  async delete(key: string): Promise<boolean> {
    if (!key) return false
    try {
      // Normalize key to strip leading /uploads/ or slashes
      const cleanKey = key.replace(/^\/?uploads\//, '').replace(/^\/+/, '')
      const fullPath = path.join(this.baseDir, cleanKey)

      // Prevent directory traversal
      const resolved = path.resolve(fullPath)
      if (!resolved.startsWith(path.resolve(this.baseDir))) {
        return false
      }

      await fs.unlink(fullPath)
      return true
    } catch {
      // If file doesn't exist or deletion fails, silently succeed (optional asset)
      return false
    }
  }

  getUrl(key: string): string {
    if (!key) return ''
    if (key.startsWith('http://') || key.startsWith('https://')) return key
    const cleanKey = key.replace(/^\/?uploads\//, '').replace(/^\/+/, '')
    return `/uploads/${cleanKey.replace(/\\/g, '/')}`
  }
}

/**
 * SupabaseStorageProvider
 * Pre-wired architecture for future cloud migration without breaking local MVP.
 */
export class SupabaseStorageProvider implements StorageProvider {
  private bucket: string

  constructor(bucketName: string = 'parlour-assets') {
    this.bucket = bucketName
  }

  async upload(
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder: string = 'general'
  ): Promise<StorageResult> {
    // Falls back to local if Supabase credentials are not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return storageFallback.upload(file, folder)
    }
    // Future Supabase storage SDK upload integration
    return storageFallback.upload(file, folder)
  }

  async replace(
    key: string,
    file: { buffer: Buffer; filename: string; mimeType: string },
    folder: string = 'general'
  ): Promise<StorageResult> {
    return storageFallback.replace(key, file, folder)
  }

  async delete(key: string): Promise<boolean> {
    return storageFallback.delete(key)
  }

  getUrl(key: string): string {
    return storageFallback.getUrl(key)
  }
}

const storageFallback = new LocalStorageProvider()

// Default singleton instance: ₹0 external infrastructure local MVP
export const storage: StorageProvider =
  process.env.STORAGE_PROVIDER === 'supabase' && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new SupabaseStorageProvider()
    : new LocalStorageProvider()
