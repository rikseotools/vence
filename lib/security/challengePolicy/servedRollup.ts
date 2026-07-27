// lib/security/challengePolicy/servedRollup.ts
//
// Espejo DURADERO del contador de preguntas servidas.
//
// El contador vive en Redis (`questionsServed.ts`, claves `captcha:served:*`,
// TTL 26 h) porque el gate anti-scraping necesita leerlo en O(1) en cada carga.
// Eso está bien para RETAR, pero no para DETECTAR: a las 26 h la evidencia
// desaparece, y la ventana de detección del barrido antifraude es de 30 DÍAS.
//
// Aquí se replica el MISMO contador, con los MISMOS sujetos, en Postgres
// (`daily_questions_served`). No es una segunda fuente de verdad para el gate:
// el gate sigue leyendo Redis. Esto es la pista de auditoría.
//
// CORRECCIÓN 27/07: una versión anterior de este comentario justificaba la copia
// diciendo que el sweep "corre en GitHub Actions, fuera de la VPC, y no ve
// ElastiCache". Era FALSO — el sweep corre como @Cron dentro del backend en
// Fargate, o sea DENTRO de la VPC. La razón de verdad, que es la decisiva, está
// arriba: **el TTL de Redis es de 26 h y la ventana de detección es de 30 días**.
// Desde Redis esa ventana no se puede reconstruir, viva donde viva el proceso.
//
// POR QUÉ IMPORTA (auditoría 27/07/2026): todo lo que medía consumo miraba
// `daily_question_usage`, que cuenta respuestas GUARDADAS. La cosecha no
// responde. El 16/05/2026 un usuario tuvo ese contador en 2 mientras se le
// servían 5.495 preguntas.
//
// Contrato: fire-and-forget, jamás lanza, jamás bloquea al usuario. Si esto
// falla lo único que se pierde es visibilidad.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { emitFireAndForget } from '@/lib/observability/emit'
import type { GateSubject } from './questionsServed'

export type SubjectKind = 'user' | 'ip' | 'device'

/**
 * Deriva el tipo de sujeto de su clave. Las claves las construye
 * `gateSubjects()`: uuid en crudo (usuario), `ip:<ip>` o `device:<id>`.
 * Puro y total: cualquier cosa no prefijada se considera usuario, que es como
 * se construyen hoy las claves de usuario.
 */
export function subjectKindOf(subjectKey: string): SubjectKind {
  if (subjectKey.startsWith('ip:')) return 'ip'
  if (subjectKey.startsWith('device:')) return 'device'
  return 'user'
}

/**
 * Filas a escribir para un lote de sujetos. Puro → testeable sin BD.
 * Descarta claves vacías y cantidades no positivas (nada que contabilizar).
 */
export function rollupRowsFor(
  subjects: GateSubject[],
  n: number,
): Array<{ subjectKey: string; subjectKind: SubjectKind; served: number }> {
  if (!Number.isFinite(n) || n <= 0) return []
  const seen = new Set<string>()
  const rows: Array<{ subjectKey: string; subjectKind: SubjectKind; served: number }> = []
  for (const s of subjects) {
    const key = s?.key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({ subjectKey: key, subjectKind: subjectKindOf(key), served: Math.floor(n) })
  }
  return rows
}

/**
 * Suma `n` servidas a cada sujeto en el rollup del día (UTC, como las claves de
 * Redis). UPSERT: la fila del día se acumula.
 *
 * `CURRENT_DATE` en el servidor de BD, no en Node: el rollup y las consultas de
 * los detectores comparten así el mismo huso, sin desfases de medianoche entre
 * lambdas en zonas distintas.
 */
export async function persistServedRollup(
  subjects: GateSubject[],
  n: number,
): Promise<void> {
  const rows = rollupRowsFor(subjects, n)
  if (!rows.length) return

  try {
    const values = sql.join(
      rows.map(
        (r) => sql`(${r.subjectKey}, ${r.subjectKind}, CURRENT_DATE, ${r.served}, now())`,
      ),
      sql`, `,
    )
    await getAdminDb().execute(sql`
      INSERT INTO daily_questions_served (subject_key, subject_kind, usage_date, served, updated_at)
      VALUES ${values}
      ON CONFLICT (subject_key, usage_date) DO UPDATE
        SET served = daily_questions_served.served + EXCLUDED.served,
            updated_at = now()
    `)
  } catch (err) {
    // Nunca propaga: es telemetría de seguridad, no el camino del usuario.
    //
    // Pero SÍ se denuncia. Un writer de detección que falla en silencio es el
    // peor de los mundos: los detectores siguen consultando, no ven nada, y el
    // panel da verde porque "no hay hallazgos". Es el mismo falso verde que ya
    // mordió en la verificación de leyes. Con este evento, un fallo sostenido
    // aparece en /admin/salud-sistema por el catch-all de señales error/warn.
    const message = (err as Error)?.message ?? String(err)
    console.warn('[servedRollup] no persistido:', message)
    emitFireAndForget({
      source: 'vercel',
      severity: 'error',
      eventType: 'served_rollup_write_failed',
      endpoint: 'lib/security/challengePolicy/servedRollup',
      errorMessage: message,
      metadata: { subjects: rows.length, served: n },
    })
  }
}
