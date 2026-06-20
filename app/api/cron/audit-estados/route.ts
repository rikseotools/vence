// app/api/cron/audit-estados/route.ts
// Cron diario: SEGUNDA AUDITORÍA INDEPENDIENTE — coherencia estado_proceso ↔ fechas.
//
// El estado_proceso de las oposiciones lo fijan los signals llm_semantic/seguimiento
// y nunca se re-verifica solo → deriva (casos reales 18/06/2026: baleares
// 'inscripcion_abierta' sin convocatoria viva; osakidetza 'inscripcion_abierta' con
// inscripción ya cerrada y examen inminente; varias abierta con plazo vencido/sin fecha).
// Ninguna excepción lo ve (200 OK, dato incoherente) y ninguna otra auditoría lo mira
// (audit:oposicion = completitud, audit:epigrafe = scope).
//
// COHERENCIA DE FRONT (incidente 20/06/2026): home, SEO /oposiciones/inscripcion-abierta
// y el banner ya NO filtran por estado_proceso sino por FECHAS (isInscripcionAbierta, la
// fuente de verdad) → imposible que se contradigan entre sí. Pero eso abre dos huecos que
// este cron vigila usando EL MISMO predicado que las superficies (no se reimplementa →
// no puede derivar del front):
//   1. estado='inscripcion_abierta' pero las fechas dicen NO-abierta (sin start, sin
//      deadline o vencido) → DESAPARECE del front aunque el estado diga que está abierta.
//   2. fechas dicen abierta pero estado != 'inscripcion_abierta' → APARECE en el front
//      aunque el ciclo diga otra cosa (dato a reconciliar).
//
// Determinista (solo fechas). Versión CLI equivalente: `npm run audit:estados`
// (scripts/audit-estados-convocatoria.cjs). Documentado en
// docs/maintenance/oeps-convocatorias-seguimiento.md §0.bis.
//
// LÍMITE: caza contradicciones de fecha, NO un dato coherente-pero-erróneo (fecha
// falsa pero futura) — eso lo corrige re-leer el boletín (detect-boletines/detect-oep-llm).
//
// Flujo: GHA llama cada noche con Bearer CRON_SECRET → query oposiciones → si hay
// contradicciones (❌) emite `estado_proceso_drift` a observable_events.

import { NextRequest, NextResponse } from 'next/server'
import { emit } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { isInscripcionAbierta, isShowableCatalogada, todayMadrid } from '@/lib/oposiciones/inscripcion'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// estados "post-examen": no pueden tener el examen en el futuro
const POST_EXAMEN = new Set(['examen_realizado', 'resultados', 'nombramientos'])
// nº de contradicciones que escala el evento a 'critical'
const CRITICAL_THRESHOLD = 5
// Una catalogada que YA se muestra al usuario (sin test, enlazando a la oficial) debería
// haber sido verificada por el radar hace poco; si no, su fecha "abierta" puede estar stale.
const CATALOGADA_STALE_DAYS = 30

interface OposRow {
  slug: string
  is_active: boolean
  estado_proceso: string | null
  inscription_deadline: string | null
  inscription_start: string | null
  exam_date: string | null
  exam_date_approximate: boolean | null
  seguimiento_url: string | null
  seguimiento_last_checked: string | null
}

async function _GET(request: NextRequest) {
  // Auth: solo GHA con CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  // Madrid, NO UTC: las superficies derivan "abierta hoy" con todayMadrid(); auditar con
  // toISOString() (UTC) compararía con el día equivocado en madrugada → falsos positivos.
  const hoy = todayMadrid()
  const db = getAdminDb()

  const result = await db.execute(sql`
    SELECT slug, is_active, estado_proceso, inscription_deadline,
           inscription_start, exam_date, exam_date_approximate,
           seguimiento_url, seguimiento_last_checked
    FROM oposiciones
  `)
  const rows = result as unknown as OposRow[]

  const errors: string[] = []
  const warns: string[] = []

  for (const o of rows) {
    const e = o.estado_proceso
    const dl = o.inscription_deadline
    const ex = o.exam_date
    const tag = `${o.slug}${o.is_active ? ' [PUBLICADA]' : ''}`
    if (!e) {
      warns.push(`${tag} → estado_proceso vacío`)
      continue
    }
    if (e === 'inscripcion_abierta') {
      if (!dl) warns.push(`${tag} → inscripcion_abierta SIN fecha de cierre`)
      else if (dl < hoy) errors.push(`${tag} → inscripcion_abierta con plazo VENCIDO (${dl})`)
    }
    if (e === 'convocada' && dl && dl < hoy) {
      warns.push(`${tag} → convocada con plazo de inscripción ya vencido (${dl})`)
    }
    if (e === 'inscripcion_cerrada' && dl && dl > hoy) {
      warns.push(`${tag} → inscripcion_cerrada pero el plazo (${dl}) aún no ha vencido`)
    }
    if (e === 'pendiente_examen') {
      if (!ex) warns.push(`${tag} → pendiente_examen SIN fecha de examen`)
      else if (ex < hoy && !o.exam_date_approximate) errors.push(`${tag} → pendiente_examen con examen YA PASADO (${ex})`)
    }
    if (POST_EXAMEN.has(e) && ex && ex > hoy) {
      errors.push(`${tag} → '${e}' con examen FUTURO (${ex})`)
    }
    if (o.inscription_start && dl && o.inscription_start > dl) {
      warns.push(`${tag} → inscription_start (${o.inscription_start}) posterior al deadline (${dl})`)
    }

    // Coherencia de FRONT. Mismo predicado que home/SEO/banner → si diverge del
    // estado_proceso, el dato está mal en algún lado.
    if (o.is_active) {
      // PUBLICADAS (lo que el usuario ve con test).
      const abiertaPorFechas = isInscripcionAbierta(o, hoy)
      if (e === 'inscripcion_abierta' && !abiertaPorFechas) {
        // Antes salía por estado; ahora el front filtra por fechas → DESAPARECE.
        const motivo = !o.inscription_start ? 'sin inscription_start'
          : !dl ? 'sin deadline' : `plazo vencido (${dl})`
        errors.push(`${tag} → estado 'inscripcion_abierta' pero NO abierta-por-fechas (${motivo}) → invisible en el front`)
      } else if (abiertaPorFechas && e !== 'inscripcion_abierta') {
        // Sale en el front (fechas mandan) aunque el ciclo diga otra cosa → reconciliar estado.
        warns.push(`${tag} → abierta-por-fechas pero estado='${e}' → aparece en el front; reconciliar estado`)
      }
    } else if (isShowableCatalogada(o, hoy)) {
      // CATALOGADAS visibles en /oposiciones/inscripcion-abierta (sin test, enlace oficial).
      // Ahora son superficie de usuario → hay que vigilar su dato (antes no se mostraban).
      if (e !== 'inscripcion_abierta') {
        warns.push(`${tag} → CATALOGADA visible en el front (abierta por fechas) pero estado='${e}' → reconciliar`)
      }
      // Frescura: si el radar nunca/hace mucho la verificó, su fecha "abierta" no tiene
      // garantía (el audit es determinista, no puede detectar "coherente pero stale").
      const lc = o.seguimiento_last_checked
      if (!lc) {
        warns.push(`${tag} → CATALOGADA visible en el front pero el radar NUNCA la verificó (seguimiento_last_checked NULL) → fecha sin garantía`)
      } else {
        const days = Math.floor((Date.parse(hoy) - Date.parse(lc)) / 86_400_000)
        if (days > CATALOGADA_STALE_DAYS) {
          warns.push(`${tag} → CATALOGADA visible en el front pero el radar no la verifica hace ${days}d (>${CATALOGADA_STALE_DAYS}) → posible fecha stale`)
        }
      }
    }
  }

  if (errors.length > 0) {
    await emit({
      source: 'vercel',
      severity: errors.length >= CRITICAL_THRESHOLD ? 'critical' : 'warn',
      eventType: 'estado_proceso_drift',
      endpoint: '/api/cron/audit-estados',
      errorMessage: `Coherencia estado↔fecha: ${errors.length} contradicciones (+${warns.length} sospechas)`,
      metadata: { errorCount: errors.length, warnCount: warns.length, errors: errors.slice(0, 20) },
    })
    console.warn(`⚠️ [AuditEstados] ${errors.length} contradicciones estado↔fecha — emitido a observable_events`)
  } else {
    console.log(`✅ [AuditEstados] OK — ${rows.length} oposiciones, 0 contradicciones (${warns.length} sospechas)`)
  }

  return NextResponse.json({
    success: true,
    duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    stats: { checked: rows.length, errors: errors.length, warns: warns.length },
    errors,
    warns,
  })
}

export const GET = withErrorLogging('/api/cron/audit-estados', _GET)
