// lib/api/shared/supabase-storage.ts
// Wrapper tipado para Supabase Storage.
// Nada lo importa aún — se usará en futuras migraciones.

import { getServiceClient } from './auth'

// ============================================
// Tipos
// ============================================

export interface UploadOptions {
  bucket: string
  path: string
  data: ArrayBuffer | Buffer
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

export interface UploadResult {
  success: true
  publicUrl: string
  path: string
}

export interface StorageError {
  success: false
  error: string
}

export interface DeleteOptions {
  bucket: string
  paths: string[]
}

// ============================================
// Operaciones
// ============================================

export async function uploadFile(
  options: UploadOptions
): Promise<UploadResult | StorageError> {
  const supabase = getServiceClient()

  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .upload(options.path, options.data, {
      cacheControl: options.cacheControl ?? '3600',
      upsert: options.upsert ?? false,
      contentType: options.contentType,
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(options.bucket).getPublicUrl(options.path)

  return { success: true, publicUrl, path: options.path }
}

export async function deleteFiles(
  options: DeleteOptions
): Promise<{ success: true } | StorageError> {
  const supabase = getServiceClient()

  const { error } = await supabase.storage
    .from(options.bucket)
    .remove(options.paths)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getServiceClient()
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path)
  return publicUrl
}
