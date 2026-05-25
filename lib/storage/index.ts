// Bloque 5 Fase A — factory de StorageAdapter.
//
// Único punto de entrada para callers. NUNCA importes los adapters concretos
// directamente. Pasa siempre por `getStorage()` para que el swap S3/Supabase
// sea cuestión de env var.

import { S3StorageAdapter } from './s3-adapter'
import { SupabaseStorageAdapter } from './supabase-adapter'
import type { StorageAdapter } from './types'

export type { StorageAdapter, UploadInput, UploadResult, DeleteInput, DeleteResult } from './types'

let cached: StorageAdapter | null = null

function readProvider(): 's3' | 'supabase' {
  const v = (process.env.STORAGE_PROVIDER ?? 'supabase').toLowerCase().trim()
  // Tolerar comentarios en la env var (`s3  # comment`)
  const clean = v.split(/\s+/)[0]
  return clean === 's3' ? 's3' : 'supabase'
}

export function getStorage(): StorageAdapter {
  if (cached) return cached
  cached = readProvider() === 's3' ? new S3StorageAdapter() : new SupabaseStorageAdapter()
  return cached
}

// Útil para tests / smoke: forzar provider concreto sin tocar env.
export function resetStorageCache(): void {
  cached = null
}
