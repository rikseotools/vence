// Bloque 5 Fase A — interfaz agnóstica de almacenamiento de objetos.
// Implementaciones: SupabaseStorageAdapter (provider actual), S3StorageAdapter
// (target en AWS). Factory en `./index.ts` decide cuál instanciar según la
// env var STORAGE_PROVIDER ('s3' | 'supabase').
//
// Filosofía agnóstica: el código de aplicación NUNCA importa @supabase/* ni
// @aws-sdk/* directamente. Habla solo con esta interfaz. Swap = cambio de
// env var, no rewrite.

export interface UploadInput {
  bucket: string
  path: string
  data: ArrayBuffer | Buffer | Uint8Array
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

export interface UploadOk {
  success: true
  publicUrl: string
  path: string
}

export interface StorageErr {
  success: false
  error: string
}

export type UploadResult = UploadOk | StorageErr
export type DeleteResult = { success: true } | StorageErr

export interface DeleteInput {
  bucket: string
  paths: string[]
}

export interface StorageAdapter {
  /** Provider name — útil para logs y métricas. */
  readonly provider: 's3' | 'supabase'

  /** Sube un objeto al bucket. Devuelve la URL pública. */
  upload(input: UploadInput): Promise<UploadResult>

  /** Borra uno o varios objetos del mismo bucket. */
  remove(input: DeleteInput): Promise<DeleteResult>

  /** Resuelve la URL pública para un objeto (no comprueba existencia). */
  getPublicUrl(bucket: string, path: string): string
}
