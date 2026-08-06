#!/usr/bin/env npx tsx
/**
 * ¿La vuelta del test devuelve a la usuaria A SU ARTÍCULO? (T-611) — con navegador real.
 *
 * ── POR QUÉ HACE FALTA NAVEGADOR Y NO BASTA EL TEST DE COMPONENTE ────────────────────────
 *
 * Lo que reportó Ángela (feedback `f57e3001`) no es que falte una función: es que al volver de
 * un test aterrizaba **arriba del tema y con las leyes plegadas**, y tenía que buscar otra vez
 * su artículo. El arreglo tiene DOS mitades y la costura entre ellas es donde vive el defecto:
 *
 *   1. la tarjeta guarda `sessionStorage['temario_return_url']` **con el ancla** del artículo,
 *   2. al cargar el temario con esa ancla, un `useEffect` **despliega la ley** y salta a ella.
 *
 * El jsdom prueba (1) y (2) por separado. Lo que no puede probar es lo único que le importa a
 * la usuaria: que **la tarjeta se vea de verdad**. La ley plegada no es `display:none` en el
 * HTML servido — es estado de React tras hidratar, así que por HTTP la tarjeta "está" aunque
 * sea invisible. Medirlo sin navegador da verde con el bug puesto.
 *
 * Y hay una razón más para que sea navegador: la página es **ISR**. El despliegue se hace en un
 * efecto POST-montaje a propósito (tocar el HTML servido sería un hydration mismatch), así que
 * el comportamiento solo existe después de hidratar.
 *
 * ── QUÉ COMPRUEBA ────────────────────────────────────────────────────────────────────────
 *
 *   A. CONTROL — el tema sin ancla abre con las leyes PLEGADAS (si esto falla, el resto no
 *      demuestra nada: estaríamos midiendo una página que ya lo enseña todo).
 *   B. LA VUELTA — el mismo tema con `#art-<ley>-<n>` deja la tarjeta de ESE artículo VISIBLE.
 *   C. LA SEÑAL — se emite `temario_vuelta_articulo` con `resultado='articulo'`.
 *   D. ANCLA ROTA — con un ancla que no casa, la página NO revienta y la señal dice
 *      `no_encontrado`. Es el caso que la ficha teme ver sostenido en producción.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-vuelta-al-articulo.ts [--url https://www.vence.es]
 *
 * Sale 1 si la vuelta no lleva al artículo. No escribe nada: solo navega.
 */
import { chromium, type Page } from 'playwright'
import postgres from 'postgres'
import { anclaArticulo } from '../../lib/navigation/backToArticleLink'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const BASE = arg('--url', 'https://www.vence.es')

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

/**
 * Un tema REAL con al menos dos leyes (para que «plegada» signifique algo) y un artículo con
 * texto. Se busca en BD en vez de fijarlo a mano: un slug quemado envejece y la simulación
 * acaba probando una página que ya no existe.
 */
async function elegirCaso() {
  const [row] = await sql`
    SELECT o.slug, t.topic_number, l.short_name AS ley, a.article_number AS art
      FROM topics t
      JOIN oposiciones o ON o.slug = replace(t.position_type, '_', '-') AND o.is_active
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN laws l ON l.id = ts.law_id AND l.short_name IS NOT NULL
      JOIN articles a ON a.law_id = l.id AND a.article_number = ANY(ts.article_numbers)
                     AND a.is_active AND coalesce(length(a.content), 0) > 200
     WHERE t.is_active
       AND (SELECT count(DISTINCT ts2.law_id) FROM topic_scope ts2 WHERE ts2.topic_id = t.id) >= 2
       AND a.article_number ~ '^[0-9]+$'
     ORDER BY o.slug, t.topic_number, a.article_number::int
     LIMIT 1`
  return row as { slug: string; topic_number: number; ley: string; art: string } | undefined
}

/** ¿Se VE la tarjeta de ese artículo? (no «existe en el DOM»: se ve). */
async function tarjetaVisible(page: Page, ancla: string): Promise<boolean> {
  // Selector por ATRIBUTO, no `#id`: el ancla lleva puntos y barras («art-lo-3-2007-3» es
  // benigna, pero «art-rd-legisl-5-2015-8.2» no) y `CSS.escape` es un global del navegador que
  // aquí, en Node, no existe.
  const el = page.locator(`[id="${ancla.replace(/"/g, '\\"')}"]`).first()
  if ((await el.count()) === 0) return false
  return el.isVisible()
}

/** Captura los `temario_vuelta_articulo` que la página emite al cargar. */
function capturarSenal(page: Page): { resultados: string[] } {
  const out = { resultados: [] as string[] }
  page.on('request', (r) => {
    if (!/observability|ingest|events/i.test(r.url())) return
    const body = r.postData() || ''
    if (!body.includes('temario_vuelta_articulo')) return
    const m = /"resultado"\s*:\s*"([a-z_]+)"/.exec(body)
    out.resultados.push(m ? m[1] : '(sin resultado)')
  })
  return out
}

let fallos = 0
const check = (ok: boolean, texto: string, extra = '') => {
  console.log(`   ${ok ? '✅' : '❌'} ${texto}${extra ? ' — ' + extra : ''}`)
  if (!ok) fallos++
}

;(async () => {
  const caso = await elegirCaso()
  if (!caso) {
    console.log('⚠️  sin caso que medir (ningún tema activo con 2+ leyes y artículo con texto)')
    await sql.end()
    return
  }
  const ancla = anclaArticulo(caso.ley, caso.art)
  const url = `${BASE}/${caso.slug}/temario/tema-${caso.topic_number}`
  console.log(`\n🌐 ${url}\n   caso: ${caso.ley} art. ${caso.art} → ancla #${ancla}\n`)
  if (!ancla) {
    console.log('❌ no se pudo construir el ancla para ese caso')
    await sql.end()
    process.exit(1)
  }

  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext()

    // A. CONTROL — sin ancla, la ley abre PLEGADA.
    console.log('A) sin ancla: el tema abre con las leyes plegadas')
    const p1 = await ctx.newPage()
    await p1.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    const visibleSinAncla = await tarjetaVisible(p1, ancla)
    check(!visibleSinAncla, 'la tarjeta NO se ve todavía (si se viera, el resto no probaría nada)')
    await p1.close()

    // B + C. LA VUELTA — con el ancla, la ley se despliega y la tarjeta se ve.
    console.log('\nB) con el ancla de la vuelta: aterriza en ESE artículo')
    const p2 = await ctx.newPage()
    const senal = capturarSenal(p2)
    await p2.goto(`${url}#${ancla}`, { waitUntil: 'networkidle', timeout: 60000 })
    await p2.waitForTimeout(2500) // el despliegue va en un efecto tras hidratar
    check(await tarjetaVisible(p2, ancla), 'la tarjeta del artículo se VE')
    console.log('\nC) la señal que vigila esto en producción')
    check(senal.resultados.includes('articulo'), `temario_vuelta_articulo = 'articulo'`,
      senal.resultados.length ? senal.resultados.join(',') : 'no se emitió ninguna')
    await p2.close()

    // D. ANCLA ROTA — ni revienta ni miente.
    console.log('\nD) ancla que no casa: no revienta y lo dice')
    const p3 = await ctx.newPage()
    const senal3 = capturarSenal(p3)
    const errores: string[] = []
    p3.on('pageerror', (e) => errores.push(e.message))
    await p3.goto(`${url}#art-inventada-9999`, { waitUntil: 'networkidle', timeout: 60000 })
    await p3.waitForTimeout(2000)
    check(errores.length === 0, 'la página no lanza excepción', errores[0] || '')
    check(senal3.resultados.includes('no_encontrado'), `la señal dice 'no_encontrado'`,
      senal3.resultados.join(',') || 'no se emitió ninguna')
    await p3.close()
  } finally {
    await browser.close()
    await sql.end()
  }

  console.log(fallos === 0
    ? '\n✅ la vuelta lleva al artículo\n'
    : `\n❌ ${fallos} comprobación(es) fallidas — la vuelta NO cumple lo que reportó Ángela\n`)
  process.exit(fallos === 0 ? 0 : 1)
})()
