// lib/api/admin-delete-user/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: DELETE USER
// ============================================

export const deleteUserRequestSchema = z.object({
  userId: z.string().uuid()
})

export type DeleteUserRequest = z.infer<typeof deleteUserRequestSchema>

// ============================================
// ARCHIVED USER DATA (datos con retención legal)
// ============================================
//
// Dump JSONB de las tablas con obligación de conservación fiscal/contable
// que se persiste en deleted_users_log.archived_data antes de borrar las
// filas de las tablas operacionales. Ver Art. 17.3.b RGPD + Art. 30 CdC.

export const archivedUserDataSchema = z.object({
  archived_at: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.unknown()))),
})

export type ArchivedUserData = z.infer<typeof archivedUserDataSchema>

// ============================================
// RESPONSE: DELETE USER
// ============================================

const deletionResultSchema = z.object({
  table: z.string(),
  status: z.enum(['deleted', 'skipped', 'error', 'exception']),
  reason: z.string().optional(),
  error: z.string().optional()
})

export type DeletionResult = z.infer<typeof deletionResultSchema>

export const deleteUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.array(deletionResultSchema)
})

export type DeleteUserResponse = z.infer<typeof deleteUserResponseSchema>

// ============================================
// RESPONSE: BORRADO EN CURSO (202, T-215)
// ============================================
//
// El borrado real (no un reintento de una cuenta ya borrada) puede tardar hasta ~190s —
// más de lo que aguanta cualquier ALB/CloudFront delante de la app — así que el endpoint
// ya no espera: responde 202 y lo ejecuta en `after()`. Sin `success` a propósito (ni true
// ni false describen "todavía no lo sé"): el resultado real se consulta después, vía
// `deleted_users_log.deletion_completed_at` o el evento `admin_delete_user_background` en
// `observable_events` — ver docs/maintenance/eliminacion-cuentas.md §5.

export const deleteUserPendingSchema = z.object({
  pending: z.literal(true),
  userId: z.string().uuid(),
  message: z.string(),
})

export type DeleteUserPending = z.infer<typeof deleteUserPendingSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const deleteUserErrorSchema = z.object({
  success: z.boolean(),
  error: z.string()
})

export type DeleteUserError = z.infer<typeof deleteUserErrorSchema>
