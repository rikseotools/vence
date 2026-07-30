// lib/api/fraud/marcaPersistente.ts
//
// La marca de multicuenta que SOBREVIVE al borrado de la cuenta.
//
// ── QUÉ PROBLEMA CIERRA ─────────────────────────────────────────────────────
// `fraud_watch_list.user_id` y `user_devices.user_id` van con `ON DELETE CASCADE`: quien rota
// cuentas solo tiene que pedir la baja para borrar su historial y volver a empezar limpio. Lo
// planteó Manuel — «que no pida eliminar y volverla a crear».
//
// Aquí se marca lo que NO desaparece con la cuenta:
//   · la **huella de hardware v2** (`fp2_…`), que se recalcula del equipo aunque se borre todo el
//     almacén del navegador — a diferencia del `device_id`, que se borra en dos clics;
//   · el **hash SHA-256 de los correos**, que permite reconocer a quien vuelve con el mismo email
//     sin conservar el correo en claro. Si nunca vuelve, el hash no identifica a nadie.
//
// ── POR QUÉ HASH Y NO EL CORREO ─────────────────────────────────────────────
// Conservar datos personales tras una baja solicitada choca con el derecho de supresión (RGPD
// art. 17). El 17.3 ampara conservarlos para prevenir el fraude, pero exige proporcionalidad: el
// hash cumple la función (reconocer una coincidencia) guardando lo mínimo. Y por eso hay
// `retention_until`: 2 años por defecto, no «para siempre».

import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { pgUuidArray, pgTextArray } from '@/lib/api/sqlArrays'

/** Años que se conserva la marca. Ver la nota de RGPD arriba: acotado, no indefinido. */
export const RETENCION_AÑOS = 2

/**
 * Hash estable de un correo.
 *
 * Se normaliza (minúsculas y sin espacios) para que `Juan@Gmail.com ` y `juan@gmail.com` den el
 * mismo hash: si no, cambiar una mayúscula bastaría para esquivar la marca.
 */
export function hashEmail(email: string): string {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')
}

export interface MarcaPersistente {
  /** `device_id` de localStorage. Útil, pero se borra: por eso NO es el ancla principal. */
  deviceId?: string | null
  /** Huella de hardware v2 — el ancla que de verdad aguanta. */
  fingerprint?: string | null
  /** Cuentas implicadas (sus uuid sobreviven aquí aunque se borre el perfil). */
  userIds: string[]
  /** Correos implicados. Se guardan HASHEADOS, nunca en claro. */
  emails: string[]
  motivo: string
}

/**
 * Registra (o actualiza) la marca del dispositivo.
 *
 * Idempotente por `device_id`: reincidir suma sesiones y acumula cuentas en vez de duplicar filas.
 * Los arrays se acumulan con unión, así que una cuenta nueva en el mismo equipo se añade a las que
 * ya constaban — que es justo el rastro que interesa conservar.
 */
export async function marcarPersistente(m: MarcaPersistente): Promise<void> {
  const fpV2 = m.fingerprint?.startsWith('fp2_') ? m.fingerprint : null
  if (!m.deviceId && !fpV2) return // sin ancla no hay nada que marcar

  const hashes = [...new Set(m.emails.filter(Boolean).map(hashEmail))]
  const uids = [...new Set(m.userIds.filter(Boolean))]

  await getAdminDb().execute(sql`
    INSERT INTO fraud_confirmations
      (device_id, fingerprint, user_ids, email_hashes, first_detected_at, last_activity_at,
       session_count, status, notes, retention_until)
    VALUES (
      ${m.deviceId ?? null},
      ${fpV2},
      ${uids.length ? pgUuidArray(uids) : sql`'{}'::uuid[]`},
      ${hashes.length ? pgTextArray(hashes) : sql`'{}'::text[]`},
      now(), now(), 1, 'confirmed', ${m.motivo},
      now() + (${RETENCION_AÑOS} || ' years')::interval
    )
    ON CONFLICT (device_id) WHERE device_id IS NOT NULL DO UPDATE SET
      last_activity_at = now(),
      session_count    = fraud_confirmations.session_count + 1,
      -- La huella solo se rellena, nunca se pisa con null (puede faltar en una pasada suelta).
      fingerprint      = COALESCE(EXCLUDED.fingerprint, fraud_confirmations.fingerprint),
      -- Unión: las cuentas nuevas del mismo equipo se SUMAN al rastro, no lo sustituyen.
      user_ids     = ARRAY(SELECT DISTINCT unnest(fraud_confirmations.user_ids || EXCLUDED.user_ids)),
      email_hashes = ARRAY(SELECT DISTINCT unnest(fraud_confirmations.email_hashes || EXCLUDED.email_hashes)),
      -- Reincidir renueva el plazo: la cuenta atrás corre desde la última vez, no desde la primera.
      retention_until = now() + (${RETENCION_AÑOS} || ' years')::interval
  `)
}

/**
 * ¿Este correo o esta huella ya estaban marcados?
 *
 * Es la consulta que da sentido a todo lo anterior: sirve para reconocer, EN EL REGISTRO, a quien
 * borró su cuenta y vuelve. Devuelve la marca viva (no caducada) o `null`.
 *
 * NO decide nada por su cuenta: quien la llame decide qué hacer con la respuesta. Bloquear un alta
 * por una marca antigua es una decisión de producto, no un detalle técnico.
 */
export async function buscarMarcaPrevia(opts: {
  email?: string | null
  fingerprint?: string | null
}): Promise<{ deviceId: string | null; sesiones: number; desde: Date; motivo: string | null } | null> {
  const hash = opts.email ? hashEmail(opts.email) : null
  const fpV2 = opts.fingerprint?.startsWith('fp2_') ? opts.fingerprint : null
  if (!hash && !fpV2) return null

  const filas = (await getAdminDb().execute(sql`
    SELECT device_id, session_count, first_detected_at, notes
      FROM fraud_confirmations
     WHERE retention_until > now()
       AND (
         (${hash}::text IS NOT NULL AND ${hash} = ANY(email_hashes))
         OR (${fpV2}::text IS NOT NULL AND fingerprint = ${fpV2})
       )
     ORDER BY last_activity_at DESC
     LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>

  const f = Array.isArray(filas) ? filas[0] : (filas as { rows?: unknown[] })?.rows?.[0]
  if (!f) return null
  const r = f as { device_id: string | null; session_count: number; first_detected_at: Date; notes: string | null }
  return {
    deviceId: r.device_id,
    sesiones: Number(r.session_count) || 0,
    desde: r.first_detected_at,
    motivo: r.notes,
  }
}
