// app/api/v2/admin/fraud/scripts/route.ts
// Detección de COSECHA de preguntas (scraping del banco). Tier admin.
//
// Reescrito 27/07/2026. La versión anterior listaba "usuarios sin dispositivo
// registrado" ordenados por preguntas RESPONDIDAS (`daily_question_usage`), y
// por eso era ciega al modo real de scraping: cosechar no requiere responder.
// Medido en prod: un usuario tuvo ese contador en 2 el 16/05/2026 mientras se le
// servían 5.495 preguntas.
//
// Ahora el volumen sale de `daily_questions_served` (rollup duradero de SERVIDAS)
// y la señal es el RATIO respondidas/servidas, clasificado por el MISMO núcleo
// puro que usa `scripts/fraud-sweep.cjs` (lib/security/harvestSignals.js) — para
// que el panel y las alertas no puedan volver a divergir.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { pgUuidArray } from '@/lib/api/sqlArrays'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyHarvest } = require('@/lib/security/harvestSignals')

export const maxDuration = 25

/** Misma ventana que el sweep (FRAUD_WINDOW_DAYS): lo que alerta y lo que se ve
 *  en el panel tienen que ser lo mismo o el revisor no encuentra la señal. */
const WINDOW_DAYS = 30

/** Tope diario del plan free (lib/api/daily-limit/config.ts). */
const FREE_DAILY_LIMIT = 25

function rows(r: unknown): any[] {
  return (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows || []) as any[]
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const db = getAdminDb()

  // Servidas por usuario en la ventana. subject_kind='user' → subject_key es el uuid.
  const served = rows(await db.execute(sql`
    SELECT subject_key AS user_id, sum(served)::int AS served, max(usage_date)::text AS last_usage,
           count(DISTINCT usage_date)::int AS active_days
      FROM daily_questions_served
     WHERE subject_kind = 'user' AND usage_date >= CURRENT_DATE - ${WINDOW_DAYS}::int
     GROUP BY 1
     ORDER BY 2 DESC
     LIMIT 500
  `))

  // FALSO VERDE: sin rollup no es que no haya cosechadores, es que no miramos.
  // El panel debe decirlo en vez de mostrar una lista vacía tranquilizadora.
  if (!served.length) {
    return NextResponse.json({
      success: true,
      scripts: [],
      blind: true,
      reason: 'daily_questions_served sin datos en la ventana: el contador de servidas no está escribiendo',
      windowDays: WINDOW_DAYS,
    })
  }

  const ids = served.map(s => s.user_id).filter((v: string) => /^[0-9a-f-]{36}$/i.test(v))
  if (!ids.length) return NextResponse.json({ success: true, scripts: [], windowDays: WINDOW_DAYS })

  const profiles = rows(await db.execute(sql`
    SELECT id, email, full_name, plan_type FROM user_profiles WHERE id = ANY(${pgUuidArray(ids)})
  `))
  // Denominador desde `test_questions`, NO de `daily_question_usage`: ese contador
  // solo se incrementa en el camino del límite diario y los PREMIUM lo esquivan
  // (medido 27/07: 77 premium con 5.598 respuestas ese día y contador 0). Usarlo
  // marcaba como cosechador a todo premium activo — falso positivo estructural.
  const answered = rows(await db.execute(sql`
    SELECT user_id, count(*)::int AS answered
      FROM test_questions
     WHERE user_id = ANY(${pgUuidArray(ids)})
       AND created_at > now() - (${WINDOW_DAYS}::int || ' days')::interval
       AND user_answer IS NOT NULL AND user_answer <> '' AND user_answer <> 'BLANK'
     GROUP BY 1
  `))
  const pageViews = rows(await db.execute(sql`
    SELECT user_id, count(*)::int AS page_views
      FROM user_interactions
     WHERE user_id = ANY(${pgUuidArray(ids)}) AND event_type = 'page_view'
       AND created_at > now() - (${WINDOW_DAYS}::int || ' days')::interval
     GROUP BY 1
  `))
  const devices = rows(await db.execute(sql`
    SELECT DISTINCT user_id FROM user_devices WHERE user_id = ANY(${pgUuidArray(ids)})
  `))
  // Tope diario del plan free: si lo topó, el ratio bajo lo causamos NOSOTROS
  // (un free que arma un test de 100 solo puede contestar 25 → ratio <= 0,25 por
  // construcción). Ver la nota de `answerCapped` en lib/security/harvestSignals.js.
  const capped = rows(await db.execute(sql`
    SELECT user_id, max(questions_answered)::int AS max_dia
      FROM daily_question_usage
     WHERE user_id = ANY(${pgUuidArray(ids)}) AND usage_date >= CURRENT_DATE - ${WINDOW_DAYS}::int
     GROUP BY 1
  `))

  const profileMap = new Map<string, any>(profiles.map(p => [p.id, p]))
  const answeredMap = new Map<string, number>(answered.map(a => [a.user_id, Number(a.answered)]))
  const pvMap = new Map<string, number>(pageViews.map(p => [p.user_id, Number(p.page_views)]))
  const deviceSet = new Set<string>(devices.map(d => d.user_id))
  const cappedSet = new Set<string>(capped.filter(x => Number(x.max_dia) >= FREE_DAILY_LIMIT).map(x => x.user_id))

  const scripts = served
    .map(s => {
      const uid = s.user_id
      const p = profileMap.get(uid)
      const input = {
        served: Number(s.served),
        answered: answeredMap.get(uid) ?? 0,
        pageViews: pvMap.get(uid) ?? 0,
        hasDevice: deviceSet.has(uid),
        answerCapped: cappedSet.has(uid),
        // Días distintos con servidas: un volumen que se agota en una sesión es
        // el perfil del que prueba y no vuelve, no el de una cosecha (T-179).
        activeDays: Number(s.active_days),
      }
      const verdict = classifyHarvest(input)
      if (!verdict) return null
      return {
        user_id: uid,
        email: p?.email || '?',
        full_name: p?.full_name || '',
        plan_type: p?.plan_type || 'free',
        served: input.served,
        answered: input.answered,
        answer_ratio: Number(verdict.ratio.toFixed(4)),
        page_views: input.pageViews,
        has_device: input.hasDevice,
        kind: verdict.kind,
        severity: verdict.severity,
        reasons: verdict.reasons,
        last_usage: s.last_usage,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ success: true, scripts, windowDays: WINDOW_DAYS })
}

export const GET = withErrorLogging('/api/v2/admin/fraud/scripts', _GET)
