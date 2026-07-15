// lib/api/admin-delete-user/queries.ts
//
// Eliminación GDPR de usuarios.
//
// 🆕 2026-06-26: el borrado de datos lo hace AHORA la función SQL
// `public.delete_user_account(uuid)` (migración 20260626_delete_user_account_fn.sql)
// en UNA sola transacción server-side. Motivo: el flujo anterior hacía ~52 DELETE
// secuenciales sin transacción → 504 CloudFront + borrado parcial + riesgo de
// machacar el archivo legal al reintentar. Ver docs/maintenance/eliminacion-cuentas.md §6.
//
// La función:
//   1. Archiva pagos (retención legal) en deleted_users_log.archived_data — IDEMPOTENTE
//      (solo si archived_data IS NULL): un reintento nunca borra el archivo legal.
//   2. Borra TODAS las tablas public con user_id (barrido dinámico por information_schema,
//      sin listas que mantener) + las hijas por CASCADE de user_profiles.
//   3. NO toca auth.users — eso lo hace el endpoint via el puerto agnóstico `authAdmin`.
//
// AGNOSTICISMO (docs/roadmap/agnosticismo-supabase.md): la función es PL/pgSQL plano
// (Postgres puro, portable a RDS/Aurora/Neon) y se invoca por Drizzle/`getAdminDb()`,
// nunca por `supabase.rpc()`.

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { DeletionResult, ArchivedUserData } from './schemas'

// ============================================
// CONFIGURACIÓN DE TABLAS (retención legal)
// ============================================
//
// Usada SOLO por el helper de archivado manual de abajo (fallback). El borrado
// normal lo cubre la función SQL; aquí se mantiene la lista de tablas con
// obligación legal por si se necesita archivar fuera de la función.
const TABLES_WITH_LEGAL_RETENTION: Array<{ table: string; column: string }> = [
  // Registros contables de pagos (obligación fiscal 4-6 años).
  // Ver Art. 30 Código de Comercio, Art. 66 LGT.
  { table: 'payment_settlements', column: 'user_id' },
]

// ============================================
// BORRADO DE DATOS — vía función SQL atómica
// ============================================
//
// Una sola llamada (1 round-trip) que archiva + borra en una transacción.
// REQUISITO: la fila de deleted_users_log (con deletion_reason) debe existir
// ANTES — la función la usa para escribir archived_data y falla si no está.

export async function deleteUserData(userId: string): Promise<DeletionResult[]> {
  const db = getAdminDb()
  try {
    await db.execute(sql`SELECT public.delete_user_account(${userId}::uuid)`)
    console.log('🗑️ delete_user_account OK para usuario:', userId)
    return [{ table: '_delete_user_account', status: 'deleted' }]
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('❌ delete_user_account falló para', userId, ':', msg)
    return [{ table: '_delete_user_account', status: 'error', error: msg }]
  }
}

// ============================================
// REGISTRO DE AUDITORÍA PREVIO (requisito de delete_user_account + email RGPD durable)
// ============================================
//
// `delete_user_account()` EXIGE que la fila de `deleted_users_log` (con `deletion_reason`)
// EXISTA antes de invocarla: escribe `archived_data` en ella y falla si no está. Además,
// el email de esa fila es la fuente DURABLE del correo de confirmación RGPD (Art. 12.3)
// cuando el reintento ocurre tras borrar `user_profiles`. Antes NADA en la app la insertaba
// → todo borrado admin fallaba y requería SQL manual (bug 14/07/2026). Esto lo cierra.

export interface DeletionLogProfile {
  email: string
  fullName?: string | null
  planType?: string | null
  targetOposicion?: string | null
  registeredAt?: string | null // ISO (created_at del perfil)
}

/**
 * Construye un `deletion_reason` de auditoría (función PURA → unit-testeable sin BD).
 * Recoge el snapshot del perfil, quién y cuándo, y la base legal.
 */
export function buildDeletionReason(
  profile: DeletionLogProfile,
  opts: { adminEmail?: string | null; at?: string } = {}
): string {
  const at = opts.at ?? new Date().toISOString()
  return (
    `Borrado de cuenta iniciado desde el panel de administración` +
    `${opts.adminEmail ? ` por ${opts.adminEmail}` : ''} el ${at}. ` +
    `Snapshot del perfil en el momento del borrado: email=${profile.email}, ` +
    `nombre=${profile.fullName ?? 'n/d'}, plan=${profile.planType ?? 'n/d'}, ` +
    `oposición=${profile.targetOposicion ?? 'n/d'}, alta=${profile.registeredAt ?? 'n/d'}. ` +
    `Base legal: ejercicio del derecho de supresión (RGPD Art. 17) / baja administrativa. ` +
    `Esta fila se crea con carácter previo al borrado como registro de auditoría y para ` +
    `conservar el email destinatario del correo de confirmación RGPD (Art. 12.3), que debe ` +
    `seguir disponible aunque user_profiles ya no exista.`
  )
}

/**
 * Inserta la fila de `deleted_users_log` ANTES del borrado, de forma IDEMPOTENTE
 * (no hay unique index en `original_user_id` → `WHERE NOT EXISTS`, no `ON CONFLICT`).
 * Lanza si falta el email (`deleted_users_log.email` es NOT NULL): el caller DEBE
 * fail-closed (no borrar sin registro de auditoría). Devuelve si insertó o ya existía.
 */
export async function ensureDeletionLogRow(
  userId: string,
  profile: DeletionLogProfile,
  opts: { deletionReason?: string; requestedVia?: string; adminEmail?: string | null } = {}
): Promise<{ inserted: boolean; existed: boolean }> {
  if (!profile?.email) {
    throw new Error(
      'ensureDeletionLogRow: email requerido (deleted_users_log.email es NOT NULL) — no se puede auditar el borrado'
    )
  }
  const db = getAdminDb()
  const reason = opts.deletionReason ?? buildDeletionReason(profile, { adminEmail: opts.adminEmail })
  // `pg_advisory_xact_lock` en el FROM serializa dos borrados concurrentes del MISMO
  // userId (no hay unique index en original_user_id → sin él, dos `WHERE NOT EXISTS`
  // simultáneos insertarían 2 filas). El lock se toma al producir la fila y se libera
  // al terminar el statement; el 2º call bloquea, y al desbloquear ya ve la fila → 0 filas.
  const res = await db.execute(sql`
    INSERT INTO public.deleted_users_log
      (original_user_id, email, full_name, plan_type, target_oposicion, registered_at, deletion_reason, requested_via)
    SELECT ${userId}::uuid, ${profile.email}, ${profile.fullName ?? null}, ${profile.planType ?? null},
           ${profile.targetOposicion ?? null}, ${profile.registeredAt ?? null}::timestamptz,
           ${reason}, ${opts.requestedVia ?? 'admin_panel'}
    FROM (SELECT pg_advisory_xact_lock(hashtext('deluser:' || ${userId}::text)::bigint)) AS _lock
    WHERE NOT EXISTS (
      SELECT 1 FROM public.deleted_users_log WHERE original_user_id = ${userId}::uuid
    )
    RETURNING id
  `)
  const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows || [])
  return { inserted: rows.length > 0, existed: rows.length === 0 }
}

// ============================================
// FALLBACK MANUAL: archivar datos con retención legal
// ============================================
//
// Ya NO se usa en el flujo normal (la función SQL archiva internamente de forma
// idempotente). Se conserva exportado para diagnósticos / archivado manual.
// archiveUserLegalData solo LEE; persistArchivedData escribe en deleted_users_log.

export async function archiveUserLegalData(userId: string): Promise<ArchivedUserData> {
  const db = getAdminDb()
  const archived: ArchivedUserData = {
    archived_at: new Date().toISOString(),
    tables: {},
  }

  for (const { table, column } of TABLES_WITH_LEGAL_RETENTION) {
    try {
      const result = await db.execute(
        sql.raw(`SELECT * FROM ${table} WHERE ${column} = '${userId}'`)
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (result as any).rows ?? (result as any)
      if (Array.isArray(rows) && rows.length > 0) {
        archived.tables[table] = rows
        console.log(`📦 Archivadas ${rows.length} filas de ${table}`)
      }
    } catch (err) {
      console.error(`❌ Error archivando ${table}:`, err)
    }
  }

  return archived
}

export async function persistArchivedData(
  userId: string,
  archived: ArchivedUserData
): Promise<void> {
  const db = getAdminDb()
  const archivedJson = JSON.stringify(archived)

  try {
    // Idempotente: solo escribe si aún no hay archivo (no machaca uno previo).
    await db.execute(
      sql`UPDATE deleted_users_log
          SET archived_data = ${archivedJson}::jsonb
          WHERE original_user_id = ${userId}
            AND archived_data IS NULL`
    )
    console.log(`📦 archived_data persistida en deleted_users_log`)
  } catch (err) {
    console.error(`❌ Error persistiendo archived_data:`, err)
    throw err
  }
}
