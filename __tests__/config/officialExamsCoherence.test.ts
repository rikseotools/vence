/**
 * Test de coherencia de exámenes oficiales: garantiza que cuando una entry
 * `officialExams[].partes[]` usa el formato estructurado nuevo
 * (`ordinaryCount`/`reserveCount`/`breakdown`), los números cuadran consigo
 * mismos Y con las preguntas realmente cargadas en BD.
 *
 * Entries en formato legacy (solo `description` string) NO disparan estos
 * checks — quedan fuera del invariante hasta que se migren. Ver
 * docs/maintenance/crear-nueva-oposicion.md para el formato preferido.
 *
 * Si este test falla:
 *  - Coherencia interna: revisa que `breakdown[].count` sume `ordinaryCount`.
 *  - Coherencia con BD: o falta importar preguntas, o falta ajustar la config.
 *    NO retoques los números a ciegas; auditar primero (script o admin).
 */

import https from 'https'
import dotenv from 'dotenv'
import { OPOSICIONES } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb =
  !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

// Patrones de exam_source para psychometric_questions (NO tiene columna
// exam_position). Mantener sincronizado con
// lib/api/psychometric-test-data/queries.ts:189.
const PSYCHOMETRIC_EXAM_SOURCE_PATTERNS: Record<string, string> = {
  auxiliar_administrativo_estado: '%Auxiliar Administrativo Estado%',
  auxiliar_administrativo_madrid: '%Auxiliar Administrativo Comunidad de Madrid%',
  auxiliar_administrativo_carm: '%Auxiliar Administrativo CARM Murcia%',
  auxiliar_administrativo_cyl: '%Auxiliar Administrativo CyL%',
  tramitacion_procesal: '%Tramitación Procesal%',
  auxilio_judicial: '%Auxilio Judicial%',
  administrativo_estado: '%Administrativo Estado%',
  policia_nacional: '%Policía Nacional%',
  guardia_civil: '%Guardia Civil%',
}

function supabaseCount(table: string, params: string): Promise<number> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}&select=id`
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            apikey: REAL_KEY!,
            Authorization: `Bearer ${REAL_KEY}`,
            Prefer: 'count=exact',
            'Range-Unit': 'items',
            Range: '0-0',
          },
        },
        (res) => {
          const contentRange = res.headers['content-range'] as string | undefined
          // formato: "0-0/<total>" o "*/0" si no hay filas
          if (contentRange) {
            const total = contentRange.split('/')[1]
            if (total && total !== '*') return resolve(Number(total))
          }
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            try {
              const arr = JSON.parse(data)
              resolve(Array.isArray(arr) ? arr.length : 0)
            } catch {
              reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
            }
          })
        }
      )
      .on('error', reject)
  })
}

// Recolectar todas las convocatorias con formato estructurado.
// Una convocatoria se considera estructurada si TODAS sus partes tienen
// `ordinaryCount` definido (mezclar legacy y estructurado en la misma
// convocatoria daría sumas falsas).
type StructuredConv = {
  slug: string
  positionType: string
  date: string
  title: string
  totalOrdinary: number
  totalReserve: number
}

const STRUCTURED_CONVOCATORIAS: StructuredConv[] = []
for (const op of OPOSICIONES) {
  if (!op.officialExams) continue
  for (const conv of op.officialExams) {
    const allStructured = conv.partes.every((p) => p.ordinaryCount !== undefined)
    if (!allStructured) continue
    const totalOrdinary = conv.partes.reduce(
      (s, p) => s + (p.ordinaryCount ?? 0),
      0
    )
    const totalReserve = conv.partes.reduce(
      (s, p) => s + (p.reserveCount ?? 0),
      0
    )
    STRUCTURED_CONVOCATORIAS.push({
      slug: op.slug,
      positionType: op.positionType,
      date: conv.date,
      title: conv.title,
      totalOrdinary,
      totalReserve,
    })
  }
}

describe('Official Exams Coherence', () => {
  describe('Coherencia interna de partes estructuradas', () => {
    for (const op of OPOSICIONES) {
      if (!op.officialExams) continue
      for (const conv of op.officialExams) {
        for (const parte of conv.partes) {
          if (parte.ordinaryCount === undefined) continue

          test(`${op.slug} ${conv.date} ${parte.id}: breakdown.sum === ordinaryCount`, () => {
            if (parte.breakdown && parte.breakdown.length > 0) {
              const sum = parte.breakdown.reduce((s, b) => s + b.count, 0)
              expect(sum).toBe(parte.ordinaryCount)
            }
          })
        }
      }
    }
  })

  describe('Coherencia config vs BD (suma de partes = preguntas reales)', () => {
    if (!hasRealDb) {
      test.skip('Saltado: NEXT_PUBLIC_SUPABASE_URL no configurado', () => {})
      return
    }

    if (STRUCTURED_CONVOCATORIAS.length === 0) {
      test('Aún no hay convocatorias en formato estructurado — nada que validar', () => {
        expect(true).toBe(true)
      })
      return
    }

    test.each(
      STRUCTURED_CONVOCATORIAS.map((c) => [c.slug, c.date, c.title, c] as const)
    )(
      '%s %s (%s): suma config = preguntas activas BD',
      async (_slug, _date, _title, conv) => {
        const expectedTotal = conv.totalOrdinary + conv.totalReserve

        // `questions` filtra por exam_position; `psychometric_questions` no
        // tiene esa columna y se filtra por exam_source ILIKE patrón.
        // NO filtramos por is_active: la config representa el examen oficial
        // completo (todas las preguntas que cayeron), incluyendo las
        // retired_irreparable por errata oficial documentada.
        const questionsFilters =
          `exam_date=eq.${conv.date}` +
          `&exam_position=eq.${conv.positionType}` +
          `&is_official_exam=eq.true`

        const psyPattern = PSYCHOMETRIC_EXAM_SOURCE_PATTERNS[conv.positionType]
        const psyFilters =
          `exam_date=eq.${conv.date}` +
          (psyPattern
            ? `&exam_source=ilike.${encodeURIComponent(psyPattern)}`
            : '') +
          `&is_official_exam=eq.true`

        const [legCount, psyCount] = await Promise.all([
          supabaseCount('questions', questionsFilters),
          // Si la oposición no tiene mapeo de psicotécnicas, asumimos 0.
          psyPattern ? supabaseCount('psychometric_questions', psyFilters) : 0,
        ])
        const bdTotal = legCount + psyCount

        expect({ expected: expectedTotal, bd: bdTotal }).toEqual({
          expected: expectedTotal,
          bd: expectedTotal,
        })
      },
      30_000
    )
  })

  /**
   * Smoke test: cubre TODAS las convocatorias (estructurada o legacy) de
   * oposiciones que tienen mapeo en `oposicionToExamPosition` (i.e. han sido
   * confirmadas como expuestas por el endpoint /api/v2/official-exams/questions).
   *
   * Bug detectado 23/05/2026: al importar el examen 23 mayo 2026 se usó
   * `exam_position='auxiliar-administrativo-estado'` (guión) cuando el código
   * espera `'auxiliar_administrativo_estado'` (underscore). Las preguntas
   * existían en BD pero el endpoint devolvía 0 — bug invisible.
   *
   * Este smoke test detecta exactamente ese patrón: para cada convocatoria
   * listada en `oposiciones.ts`, el conteo BD debe ser > 0. No verifica
   * conteo exacto (eso lo hace el bloque estructurado de arriba), solo que
   * el endpoint sea capaz de servir alguna pregunta. Útil para entries
   * legacy que aún no se han migrado al formato estructurado.
   *
   * Mapeo de slug → positionType replica `oposicionToExamPosition` de
   * `lib/api/official-exams/queries.ts`. Mantener sincronizado.
   */
  describe('Smoke: cada convocatoria expuesta devuelve > 0 preguntas en BD', () => {
    if (!hasRealDb) {
      test.skip('Saltado: NEXT_PUBLIC_SUPABASE_URL no configurado', () => {})
      return
    }

    // Replica de oposicionToExamPosition en queries.ts.
    // Solo las oposiciones aquí listadas se exponen via /api/v2/official-exams.
    const slugToExamPosition: Record<string, string> = {
      'auxiliar-administrativo-estado': 'auxiliar_administrativo_estado',
      'auxiliar-administrativo-madrid': 'auxiliar_administrativo_madrid',
      'auxiliar-administrativo-cyl': 'auxiliar_administrativo_cyl',
      'auxiliar-administrativo-carm': 'auxiliar_administrativo_carm',
      'auxiliar-administrativo-extremadura': 'auxiliar_administrativo_extremadura',
      'auxiliar-administrativo-canarias': 'auxiliar_administrativo_canarias',
      'tramitacion-procesal': 'tramitacion_procesal',
      'auxilio-judicial': 'auxilio_judicial',
      'administrativo-estado': 'administrativo_estado',
      'gestion-procesal': 'cuerpo_gestion_administracion_civil',
      'auxiliar-administrativo-andalucia': 'auxiliar_administrativo_andalucia',
      'auxiliar-administrativo-valencia': 'auxiliar_administrativo_valencia',
      'auxiliar-administrativo-ayuntamiento-valencia':
        'auxiliar_administrativo_ayuntamiento_valencia',
      'policia-nacional': 'policia_nacional',
      'guardia-civil': 'guardia_civil',
    }

    type SmokeCase = {
      slug: string
      positionType: string
      date: string
      title: string
    }

    const SMOKE_CASES: SmokeCase[] = []
    for (const op of OPOSICIONES) {
      if (!op.officialExams) continue
      const examPosition = slugToExamPosition[op.slug]
      if (!examPosition) continue // oposición no expuesta vía /api/v2/official-exams
      for (const conv of op.officialExams) {
        SMOKE_CASES.push({
          slug: op.slug,
          positionType: examPosition,
          date: conv.date,
          title: conv.title,
        })
      }
    }

    if (SMOKE_CASES.length === 0) {
      test('No hay convocatorias expuestas — nada que validar', () => {
        expect(true).toBe(true)
      })
      return
    }

    test.each(SMOKE_CASES.map((c) => [c.slug, c.date, c.title, c] as const))(
      '%s %s (%s): BD devuelve > 0 preguntas (legi+psico)',
      async (_slug, _date, _title, sc) => {
        const questionsFilters =
          `exam_date=eq.${sc.date}` +
          `&exam_position=eq.${sc.positionType}` +
          `&is_official_exam=eq.true`

        const psyPattern = PSYCHOMETRIC_EXAM_SOURCE_PATTERNS[sc.positionType]
        const psyFilters =
          `exam_date=eq.${sc.date}` +
          (psyPattern
            ? `&exam_source=ilike.${encodeURIComponent(psyPattern)}`
            : '') +
          `&is_official_exam=eq.true`

        const [legCount, psyCount] = await Promise.all([
          supabaseCount('questions', questionsFilters),
          psyPattern ? supabaseCount('psychometric_questions', psyFilters) : 0,
        ])
        const bdTotal = legCount + psyCount

        // Diagnóstico claro: si esto falla, casi seguro es:
        //  - exam_position con guión en lugar de underscore
        //  - exam_date con formato/zona incorrecto
        //  - is_official_exam = false
        //  - oposicion no añadida a oposicionToExamPosition en queries.ts
        expect({
          slug: sc.slug,
          date: sc.date,
          legCount,
          psyCount,
          bdTotal,
        }).toMatchObject({
          slug: sc.slug,
          date: sc.date,
          bdTotal: expect.any(Number),
        })
        expect(bdTotal).toBeGreaterThan(0)
      },
      30_000
    )
  })
})
