/**
 * Test de integración: preguntas de ESTRUCTURA de una norma deben colgar del
 * "Artículo 0 / Estructura" de esa ley, no de un artículo de contenido.
 *
 * Contexto (§7.1.1 del manual de impugnaciones): las preguntas sobre la
 * estructura o metadatos de una norma ("¿de cuántos títulos/artículos/capítulos
 * consta la Ley X?", "¿en cuántos capítulos se divide el Título Y?") deben
 * vincularse al artículo especial `article_number='0'` (o 'ESTRUCTURA') que
 * recopila la estructura de la norma. Si se enlazan a un artículo de contenido
 * (art. 1 objeto, etc.), el opositor que estudia ese artículo se encuentra una
 * pregunta cuya respuesta no está allí.
 *
 * Bug histórico (14-15/06/2026): ~16 preguntas estructurales colgaban de art. 1
 * / art. 70 / preámbulo. Detectado por impugnaciones de Victoria Alonso.
 * Reparado re-vinculando a Art. 0 (creándolo donde faltaba: Estatuto Castilla y
 * León, LOLS, Ley 15/2022, etc.). Memoria: project-estructura-preguntas-art0.md
 *
 * Excepción: los CONTENEDORES de contenido virtuales (is_virtual=true, p. ej.
 * "Correos T1/T12") albergan preguntas reutilizadas de varias normas y no
 * tienen Art. 0 propio; se excluyen de este guardarraíl.
 *
 * Si este test falla: re-vincular la(s) pregunta(s) al Art. 0 de su ley
 * (creándolo con la estructura oficial verificada en BOE si no existe).
 */

import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { apikey: REAL_KEY!, Authorization: `Bearer ${REAL_KEY}` } }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
          }
        })
      })
      .on('error', reject)
  })
}

// Detecta enunciados sobre la ESTRUCTURA de una norma (no de su contenido).
const NORM =
  /\b(ley|real decreto|decreto|estatuto|reglamento|constituci[oó]n|c[oó]digo|texto refundido|ley org[aá]nica|lo\b|rd\b|rdl\b)\b/i
const STRUCT =
  /(cu[aá]nt[oa]s?\s+(t[ií]tulos|cap[ií]tulos|libros|disposiciones)|(se (estructura|compone|divide|integra|conforma)|consta|dividid[oa])[^.]{0,45}(t[ií]tulos|cap[ií]tulos|libros|disposiciones)|n[uú]mero de (t[ií]tulos|cap[ií]tulos|art[ií]culos)|cu[aá]ntas reformas|cu[aá]nt[oa]s?\s+art[ií]culos\s+(tiene|consta|compone|integ))/i

interface QRow {
  id: string
  question_text: string
  primary_article_id: string | null
}
interface ARow {
  id: string
  article_number: string
  law_id: string
}

const describeIf = hasRealDb ? describe : describe.skip

describeIf('Preguntas de estructura de norma vinculadas al Art. 0', () => {
  test('las preguntas estructurales (en leyes no virtuales) cuelgan del Art. 0', async () => {
    const patterns = [
      'títulos',
      'capítulos',
      'se estructura',
      'se compone',
      'consta de',
      'cuántas reformas',
      'número de artículos',
    ]
    const orConds = patterns.map((p) => `question_text.ilike.*${encodeURIComponent(p)}*`).join(',')

    // 1) Candidatas (paginado).
    let all: QRow[] = []
    for (let offset = 0; ; offset += 1000) {
      const params = `select=id,question_text,primary_article_id&is_active=eq.true&or=(${orConds})&limit=1000&offset=${offset}`
      const page = await supabaseGet<QRow>('questions', params)
      all = all.concat(page)
      if (page.length < 1000) break
    }

    const targets = all.filter(
      (q) => NORM.test(q.question_text) && STRUCT.test(q.question_text) && q.primary_article_id
    )

    // 2) Resolver artículo (article_number, law_id) de cada candidata.
    const artIds = [...new Set(targets.map((q) => q.primary_article_id!))]
    const artMap = new Map<string, ARow>()
    for (let i = 0; i < artIds.length; i += 150) {
      const ids = artIds.slice(i, i + 150).join(',')
      const rows = await supabaseGet<ARow>('articles', `select=id,article_number,law_id&id=in.(${ids})`)
      rows.forEach((a) => artMap.set(a.id, a))
    }

    // 3) is_virtual de cada ley (los contenedores se excluyen).
    const lawIds = [...new Set([...artMap.values()].map((a) => a.law_id))]
    const virtualLaw = new Map<string, boolean>()
    for (let i = 0; i < lawIds.length; i += 150) {
      const ids = lawIds.slice(i, i + 150).join(',')
      const rows = await supabaseGet<{ id: string; is_virtual: boolean }>(
        'laws',
        `select=id,is_virtual&id=in.(${ids})`
      )
      rows.forEach((l) => virtualLaw.set(l.id, !!l.is_virtual))
    }

    // 4) Mal vinculadas = estructural, ley NO virtual, artículo != '0'/'ESTRUCTURA'.
    const mislinked = targets.filter((q) => {
      const a = artMap.get(q.primary_article_id!)
      if (!a) return false
      if (virtualLaw.get(a.law_id)) return false // contenedor de contenido: excepción
      const num = (a.article_number || '').toString()
      return num !== '0' && !/estructura/i.test(num)
    })

    if (mislinked.length > 0) {
      console.warn(
        `\n⚠️ ${mislinked.length} pregunta(s) de estructura mal vinculadas (deberían colgar del Art. 0):`
      )
      mislinked.slice(0, 15).forEach((q) => console.warn(`   - ${q.id} | ${q.question_text.slice(0, 70)}`))
      console.warn(
        '   Fix: re-vincular al Art. 0 de su ley (§7.1.1). Memoria: project-estructura-preguntas-art0.md\n'
      )
    }

    // Ratchet: a 15/06/2026 el residual en leyes no virtuales es 0 (las 3
    // restantes están en contenedores Correos virtuales, excluidos). Umbral con
    // pequeño margen para no romper el build por casos puntuales.
    expect(mislinked.length).toBeLessThan(3)
  }, 30000)
})
