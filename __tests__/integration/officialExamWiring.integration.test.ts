/**
 * @jest-environment node
 *
 * Test de INTEGRACIÓN: cableado de exámenes oficiales.
 *
 * Caza el fallo real del 25/06/2026 (build IIPP): se pobló
 * `question_official_exams` con miles de filas para una oposición, pero el
 * filtro "solo oficiales" / modo Convocatoria NO las mostraba porque la
 * oposición no estaba cableada en el resolutor (`oposicionToExamPosition`,
 * derivado de OPOSICIONES). Resultado: preguntas oficiales en BD, invisibles.
 *
 * INVARIANTE: toda `oposicion_type` presente en `question_official_exams` debe
 * resolver vía `oposicionToExamPosition` (= estar en OPOSICIONES con su slug).
 * Si no → el filtro de oficiales de esa oposición está roto (datos invisibles).
 *
 * Usa el módulo `https` (NO @supabase/supabase-js: jest mockea global.fetch).
 * Si no hay credenciales reales en .env.local, el nivel BD se salta.
 */
import https from 'https'
import dotenv from 'dotenv'
import { oposicionToExamPosition } from '@/lib/api/official-exams/queries'

dotenv.config({ path: '.env.local', override: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(URL && SERVICE_KEY && !URL.includes('test.supabase.co'))

function restGet<T = unknown>(pathAndQuery: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${URL}/rest/v1/${pathAndQuery}`,
        { headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` } },
        (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => {
            const status = res.statusCode ?? 0
            if (status < 200 || status >= 300) return reject(new Error(`HTTP ${status}: ${body.slice(0, 200)}`))
            try {
              const parsed = JSON.parse(body)
              if (!Array.isArray(parsed)) return reject(new Error(`no-array: ${body.slice(0, 200)}`))
              resolve(parsed as T)
            } catch { reject(new Error(`parse fail: ${body.slice(0, 200)}`)) }
          })
        },
      )
      .on('error', reject)
  })
}

describe('Cableado de exámenes oficiales (question_official_exams ↔ resolutor)', () => {
  const maybe = hasRealDb ? it : it.skip

  maybe('toda oposicion_type en question_official_exams resuelve vía oposicionToExamPosition', async () => {
    // Recolectar las oposicion_type distintas (paginado estable por id).
    const distinct = new Set<string>()
    let from = 0
    const PAGE = 1000
    for (let i = 0; i < 30; i++) {
      const rows = await restGet<{ oposicion_type: string | null }[]>(
        `question_official_exams?select=oposicion_type&order=id&offset=${from}&limit=${PAGE}`,
      )
      if (rows.length === 0) break
      for (const r of rows) if (r.oposicion_type) distinct.add(r.oposicion_type)
      if (rows.length < PAGE) break
      from += PAGE
    }

    expect(distinct.size).toBeGreaterThan(0)

    // Huérfanos LEGACY conocidos: oposicion_type con preguntas oficiales sueltas pero
    // sin oposición implementada (no son live). Documentados para no bloquear CI; una
    // oposición NUEVA sin cablear SÍ debe fallar. gestion-estado: 7 preguntas, sin fila
    // en `oposiciones` ni en OPOSICIONES config (detectado 25/06/2026).
    const KNOWN_ORPHANS = new Set(['gestion-estado'])

    const noWired = [...distinct].filter((slug) => !oposicionToExamPosition[slug] && !KNOWN_ORPHANS.has(slug))
    if (noWired.length > 0) {
      throw new Error(
        `Oposiciones con preguntas oficiales en BD pero SIN cablear en oposicionToExamPosition ` +
          `(filtro "solo oficiales" roto, datos invisibles): ${noWired.join(', ')}. ` +
          `Añadir su slug a OPOSICIONES en lib/config/oposiciones.ts.`,
      )
    }
  }, 30000)

  // Anti-regresión estático: el resolutor debe cubrir las oposiciones live conocidas.
  it('oposicionToExamPosition incluye las oposiciones con examen oficial conocidas', () => {
    for (const slug of ['auxilio-judicial', 'ayudante-instituciones-penitenciarias', 'tramitacion-procesal']) {
      expect(oposicionToExamPosition[slug]).toBeDefined()
    }
  })
})
