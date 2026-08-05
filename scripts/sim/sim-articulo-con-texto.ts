#!/usr/bin/env npx tsx
/**
 * ¿El temario enseña ALGO QUE LEER en cada artículo? (T-596) — con navegador real.
 *
 * Un test de texto no sirve aquí: el defecto era de RENDER. La BD tenía el contenido, el
 * `topic_scope` era correcto y la puerta de temario daba verde — y aun así la página servía el
 * artículo mudo. Solo mirando la página se ve.
 *
 * Comprueba, sobre la página REAL, que ningún artículo se sirve con el número pelado teniendo su
 * contenido en la base. El caso que lo originó: tema 2 de Diputación de Córdoba, tramo 109→117 en
 * blanco, con el art. 116 guardando 1.898 caracteres.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-articulo-con-texto.ts [--url https://www.vence.es]
 *
 * Sale 1 si encuentra artículos mudos que SÍ tienen texto en BD (el bug), 0 si todos se leen.
 * ⚠️ Contra producción NO pasa hasta que el arreglo esté desplegado: en rojo antes del deploy y en
 * verde después es exactamente la prueba de que mide lo que dice medir.
 */
import { chromium } from 'playwright'
import postgres from 'postgres'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const BASE = arg('--url', 'https://www.vence.es')

/** Casos anclados al bug real. Añadir aquí una página nueva es una línea. */
const CASOS = [
  { slug: 'auxiliar-administrativo-diputacion-cordoba', tema: 'tema-2', ley: 'CE' },
]

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

/** Números de artículo que la página sirve, y si su tarjeta lleva texto o va muda. */
function extraer(html: string): { num: string; conTexto: boolean }[] {
  const re = /flex-shrink-0">Art\. <!-- -->([0-9a-zA-Z.]+)<\/span>([\s\S]{0,40})/g
  const out: { num: string; conTexto: boolean }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push({ num: m[1], conTexto: m[2].includes('<h3') })
  return out
}

async function main() {
  const navegador = await chromium.launch()
  const ctx = await navegador.newContext({ locale: 'es-ES' })
  let fallos = 0

  for (const caso of CASOS) {
    const url = `${BASE}/${caso.slug}/temario/${caso.tema}`
    const page = await ctx.newPage()
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(2500)
    const html = await page.content()
    await page.close()

    const servidos = extraer(html)
    console.log(`\n📄 ${url}\n   HTTP ${res?.status()} · ${servidos.length} artículo(s) servidos`)
    if (!servidos.length) { console.log('   ⚠️ no se reconoció ninguna tarjeta: ¿cambió el marcado?'); fallos++; continue }

    const mudos = servidos.filter(a => !a.conTexto).map(a => a.num)
    if (!mudos.length) { console.log('   ✅ todos con algo que leer'); continue }

    // Un artículo mudo solo es defecto si en la BD SÍ hay texto: si no lo hay, es deuda de
    // contenido y la vigila el kind `articulo_servido_sin_texto`, no esto.
    const conTextoEnBd = await sql<Array<{ article_number: string; n: number }>>`
      SELECT a.article_number, length(btrim(coalesce(a.content,'')))::int AS n
        FROM articles a JOIN laws l ON l.id = a.law_id
       WHERE l.short_name = ${caso.ley} AND a.is_active
         AND a.article_number = ANY(${mudos})
         AND length(btrim(coalesce(a.content,''))) >= 50`

    if (conTextoEnBd.length) {
      fallos++
      console.log(`   ❌ ${conTextoEnBd.length} artículo(s) MUDOS teniendo texto en BD (el bug de T-596):`)
      for (const r of conTextoEnBd.slice(0, 10)) console.log(`      art. ${r.article_number} → ${r.n} caracteres guardados y ni una línea servida`)
    } else {
      console.log(`   ✅ los ${mudos.length} sin texto tampoco lo tienen en BD (deuda de contenido, no de render)`)
    }
  }

  await navegador.close()
  await sql.end()
  console.log(fallos ? `\n❌ ${fallos} caso(s) con artículos mudos\n` : '\n✅ el temario se lee\n')
  process.exit(fallos ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
