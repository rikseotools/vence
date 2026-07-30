// lib/api/fraud/watchList.ts
//
// Marca en el perfil a quien se salta el tope rotando cuentas.
//
// ── POR QUÉ AQUÍ Y NO EN UNA COLUMNA NUEVA ──────────────────────────────────
// `fraud_watch_list` YA EXISTE y tiene exactamente la forma que hace falta: una fila por usuario
// (índice único en `user_id`), con motivo, detalle, puntuación, cuentas relacionadas y un
// `confirmed_fraud` para cuando un humano lo valida. Lo que le pasaba es lo mismo que al
// enforcement por dispositivo: se llenó el 17/04/2026 —894 filas— y nadie volvió a escribir en
// ella. Añadir una columna a `user_profiles` habría creado un segundo sitio donde mirar.
//
// ── QUÉ SE ANOTA Y QUÉ NO ───────────────────────────────────────────────────
// Se anota el HECHO medido: "este dispositivo llevaba N preguntas hoy entre varias cuentas cuando
// esta cuenta pidió otra". No se declara a nadie defraudador: `confirmed_fraud` lo pone una
// persona tras revisarlo, igual que en el resto del sistema de fraude (F0 detecta, el humano
// decide). Esa separación es la que evita que un falso positivo se convierta en una sanción.
//
// La escritura es SIEMPRE fire-and-forget desde el camino de respuesta: anotar es una consecuencia
// del bloqueo, nunca una condición para bloquear. Si esto falla, el usuario ya está bloqueado y el
// evento de observabilidad ya se emitió.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
// Los arrays JS NO se interpolan a pelo en Drizzle: `${arr}::uuid[]` genera parámetros sueltos
// (`($1,$2,$3)`) y revienta con "op ANY/ALL requires array". Es el bug que dejó el barrido de
// fraude muerto 6 noches seguidas; hay un guardarraíl que lo prohíbe y me cazó al escribir esto.
import { pgUuidArray } from '@/lib/api/sqlArrays'

export interface MarcaFarmeo {
  userId: string
  /** Total del dispositivo cuando saltó el bloqueo. */
  deviceTotal: number
  /** Qué señal lo cazó: la huella estable o el device_id (que se borra en dos clics). */
  anchor: 'fingerprint_v2' | 'device_id'
  /** Huella o id del dispositivo, ya recortado: no hace falta guardarlo entero. */
  deviceRef: string | null
  /** Otras cuentas vistas en el mismo dispositivo, si se conocen. */
  relatedUsers?: string[]
}

/** Motivo con el que se etiqueta este patrón. Fijo: lo consultan el panel y las métricas. */
export const REASON_DEVICE_FARMING = 'device_farming'

/**
 * Anota (o actualiza) al usuario en la lista de vigilancia.
 *
 * Idempotente por `user_id`: reincidir NO crea filas nuevas, sube la puntuación. Así el panel
 * puede ordenar por reincidencia en vez de por ruido.
 *
 * Si el usuario ya estaba fichado por OTRO motivo (`same_device_vpn`, `same_ip`…), se conserva el
 * motivo original y este se acumula en las notas: perder el histórico para escribir el hallazgo de
 * hoy sería cambiar información por información.
 */
export async function marcarFarmeoEnWatchList(m: MarcaFarmeo): Promise<void> {
  const detalle = {
    kind: REASON_DEVICE_FARMING,
    deviceTotal: m.deviceTotal,
    anchor: m.anchor,
    deviceRef: m.deviceRef,
    at: new Date().toISOString(),
  }
  const nota = `[${detalle.at.slice(0, 16)}] tope de dispositivo superado: ${m.deviceTotal} preguntas hoy entre varias cuentas (${m.anchor})`

  await getAdminDb().execute(sql`
    INSERT INTO fraud_watch_list (user_id, reason, detection_details, suspicion_score, related_users, notes, added_at)
    VALUES (
      ${m.userId}::uuid,
      ${REASON_DEVICE_FARMING},
      ${JSON.stringify(detalle)}::jsonb,
      1,
      ${m.relatedUsers && m.relatedUsers.length ? pgUuidArray(m.relatedUsers) : sql`NULL`},
      ${nota},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      -- El motivo original se respeta: solo se ocupa el hueco si estaba vacío.
      reason = COALESCE(fraud_watch_list.reason, EXCLUDED.reason),
      detection_details = EXCLUDED.detection_details,
      -- Reincidir sube la puntuación en vez de duplicar filas.
      suspicion_score = COALESCE(fraud_watch_list.suspicion_score, 0) + 1,
      related_users = COALESCE(EXCLUDED.related_users, fraud_watch_list.related_users),
      -- Se conservan las últimas 5 anotaciones: suficiente para ver el patrón sin que crezca sin fin.
      notes = left(COALESCE(fraud_watch_list.notes || E'\n', '') || EXCLUDED.notes, 2000)
  `)
}

/**
 * Variante que nunca lanza ni bloquea la respuesta al usuario.
 *
 * El bloqueo ya está decidido cuando se llama a esto; que la anotación falle no puede convertir
 * un 403 correcto en un 500.
 */
export function marcarFarmeoFireAndForget(m: MarcaFarmeo): void {
  void marcarFarmeoEnWatchList(m).catch(() => {})
}
