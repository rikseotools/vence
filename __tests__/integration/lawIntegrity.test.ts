// lawIntegrity.test.ts — Integridad de leyes DUPLICADAS (DB real).
//
// Clase de bug (07/06/2026, LOTC): existían 2 filas `laws` con short_name
// "LOTC" — la canónica (`lotc`, activa, con topic_scope y 140 preguntas) y una
// vieja duplicada (`lotc-old-duplicate`, inactiva). Una pregunta oficial de
// Admin. Seg. Social colgaba de la fila DUPLICADA, así que el topic_scope
// (que apunta a la canónica) no la veía → el tema "Tribunal Constitucional"
// contaba 0 oficiales propias en vez de 1. El usuario lo detectó, no la obs.
//
// Invariante que blinda la clase (NO afecta a leyes simplemente derogadas, que
// legítimamente quedan inactivas sin hermana activa):
//   1. Ningún short_name tiene MÁS DE UNA ley ACTIVA.
//   2. Si un short_name tiene fila activa Y fila(s) inactiva(s) (DUPLICADO real),
//      ninguna pregunta ACTIVA puede colgar de la fila inactiva: debe estar
//      re-vinculada a la canónica activa.
//
// Si este test falla: hay un duplicado de ley mal resuelto. Re-vincular las
// preguntas a la fila activa (primary_article_id → artículo equivalente de la
// ley activa) y dejar la duplicada dormida. NO “arreglar” bajando is_active a
// ciegas.
//
// NOTA: usa `https` crudo (no @supabase/supabase-js) porque jest mockea el
// cliente Supabase globalmente — mismo patrón que officialExamsCoherence.test.

import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(URL && KEY && !URL.includes('test.supabase.co'))

function restGet<T = unknown>(pathAndQuery: string): Promise<T[]> {
  const url = `${URL}/rest/v1/${pathAndQuery}`
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } }, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (!Array.isArray(parsed)) {
              return reject(new Error(`non-array: ${data.substring(0, 200)}`))
            }
            resolve(parsed as T[])
          } catch {
            reject(new Error(`parse fail: ${data.substring(0, 200)}`))
          }
        })
      })
      .on('error', reject)
  })
}

const d = hasRealDb ? describe : describe.skip

type Law = { id: string; short_name: string; is_active: boolean }

d('Integridad de leyes duplicadas (DB real)', () => {
  let laws: Law[] = []

  beforeAll(async () => {
    // laws son ~850 (< 1000 default REST), no hace falta paginar.
    laws = await restGet<Law>('laws?select=id,short_name,is_active')
    expect(laws.length).toBeGreaterThan(0)
  }, 30_000)

  it('ningún short_name tiene más de UNA ley activa', () => {
    const activeBySn: Record<string, string[]> = {}
    for (const l of laws) {
      if (l.is_active) (activeBySn[l.short_name] ||= []).push(l.id)
    }
    const offenders = Object.entries(activeBySn)
      .filter(([, ids]) => ids.length > 1)
      .map(([sn, ids]) => `${sn} ×${ids.length}`)
    expect(offenders).toEqual([])
  })

  it('ninguna pregunta ACTIVA cuelga de la fila INACTIVA de un short_name duplicado', async () => {
    const bySn: Record<string, Law[]> = {}
    for (const l of laws) (bySn[l.short_name] ||= []).push(l)

    // short_names con fila activa Y inactiva = duplicado real (excluye derogadas).
    const inactiveDupLawIds: string[] = []
    for (const rows of Object.values(bySn)) {
      if (!rows.some((r) => r.is_active)) continue
      for (const r of rows) if (!r.is_active) inactiveDupLawIds.push(r.id)
    }

    if (inactiveDupLawIds.length === 0) return

    const offenders: string[] = []
    for (let i = 0; i < inactiveDupLawIds.length; i += 40) {
      const batch = inactiveDupLawIds.slice(i, i + 40)
      const arts = await restGet<{ id: string }>(
        `articles?select=id&law_id=in.(${batch.join(',')})`,
      )
      const artIds = arts.map((a) => a.id)
      for (let j = 0; j < artIds.length; j += 80) {
        const ab = artIds.slice(j, j + 80)
        const qs = await restGet<{ id: string }>(
          `questions?select=id&is_active=eq.true&primary_article_id=in.(${ab.join(',')})`,
        )
        for (const q of qs) offenders.push(q.id)
      }
    }

    expect(offenders).toEqual([])
  }, 60_000)
})
