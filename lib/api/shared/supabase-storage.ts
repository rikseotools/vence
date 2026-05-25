// lib/api/shared/supabase-storage.ts
//
// **DEPRECATED** — usar `lib/storage` directamente. Este archivo se mantiene
// solo para no romper imports existentes durante la migración del Bloque 5
// Fase A. Bajo el capó delega en el adapter agnóstico (S3 o Supabase según
// `STORAGE_PROVIDER`).
//
// Cuando todos los callers usen `lib/storage`, este archivo se borrará.

import { getStorage } from '../../storage'

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

export async function uploadFile(
  options: UploadOptions
): Promise<UploadResult | StorageError> {
  return getStorage().upload(options)
}

export async function deleteFiles(
  options: DeleteOptions
): Promise<{ success: true } | StorageError> {
  return getStorage().remove(options)
}

export function getPublicUrl(bucket: string, path: string): string {
  return getStorage().getPublicUrl(bucket, path)
}
