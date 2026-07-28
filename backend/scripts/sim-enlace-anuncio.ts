/**
 * sim-enlace-anuncio.ts — ¿cuántos candidatos del sumario salen ya CON el enlace a su
 * anuncio concreto? [T-221]
 *
 * QUÉ PRUEBA: hasta el 28/07/2026 la señal de un boletín solo podía citar la URL del
 * SUMARIO DEL DÍA (o de la página de listado), porque el HTML se aplanaba a texto ANTES
 * de trocearlo y el enlace de cada anuncio se perdía. Medido en RDS ese día: de 133
 * señales aplicadas en 7 días, **19 con documento clonado (14%)**. Y clonar el sumario
 * NO es la solución: un sumario entero "respalda" cualquier cifra (antipatrón T-147(c)).
 *
 * Esta simulación corre los adapters REALES sobre los últimos días y mide la cobertura
 * de enlaces por boletín, ANTES de encender nada.
 *
 * NO ESCRIBE NADA y NO LLAMA AL LLM (el parseo es determinista; el LLM solo filtraría).
 * Coste: 0 € — solo fetch a los boletines.
 *
 * Uso (desde backend/):
 *   npx tsx scripts/sim-enlace-anuncio.ts [--dias 5] [--boletin dogv,bocyl] [--verificar]
 *
 *   --verificar  además hace un HEAD a una muestra de URLs para ver que resuelven.
 *                (Un 200 no prueba que el documento sea el correcto — eso lo prueba el
 *                canary comparando el contenido —, pero un 404 sí prueba que está mal.)
 *   --con-bd     mide la CADENA ENTERA: pregunta a RDS si `boletin_doc_key` reconoce cada
 *                enlace, que es la condición que el `apply` exige para registrar el
 *                documento. Un enlace que el doc_key no sabe parsear NO deja provenance,
 *                así que sin esta pasada el % de arriba se lee más optimista de lo que es.
 */
import { BOLETIN_ADAPTERS, type BoletinAdapter } from '../src/detect-boletines/boletines'
import { CCAA_BOLETIN_ADAPTERS } from '../src/detect-boletines/ccaa-boletines'

const args = process.argv.slice(2)
const flag = (n: string, def: string) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const DIAS = Number(flag('dias', '5'))
const SOLO = flag('boletin', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const VERIFICAR = args.includes('--verificar')
const CON_BD = args.includes('--con-bd')

const TODOS: BoletinAdapter[] = [...BOLETIN_ADAPTERS, ...CCAA_BOLETIN_ADAPTERS]

type Fila = { boletin: string; candidatos: number; conUrl: number; muestra: string[]; urls: string[] }

async function main() {
  const adapters = SOLO.length ? TODOS.filter((a) => SOLO.includes(a.key)) : TODOS
  console.log(
    `\n🔎 Simulación de enlaces al anuncio — ${adapters.length} boletines · ${DIAS} día(s) · SIN escribir\n`,
  )

  const filas: Fila[] = []
  for (const adapter of adapters) {
    const fila: Fila = { boletin: adapter.key, candidatos: 0, conUrl: 0, muestra: [], urls: [] }
    // Los `dateless` sirven siempre el mismo sumario: escanearlos N veces es tirar fetches.
    const dias = adapter.dateless ? 1 : DIAS
    for (let d = 0; d < dias; d++) {
      const fecha = new Date()
      fecha.setUTCDate(fecha.getUTCDate() - d)
      let hit: Awaited<ReturnType<BoletinAdapter['scan']>> = null
      try {
        hit = await adapter.scan(fecha)
      } catch (e) {
        console.log(`   ⚠️  ${adapter.key} ${fecha.toISOString().slice(0, 10)}: ${String(e)}`)
      }
      if (!hit) continue
      for (const c of hit.candidatos) {
        fila.candidatos++
        if (c.url) {
          fila.conUrl++
          fila.urls.push(c.url)
          if (fila.muestra.length < 2) fila.muestra.push(`${c.titulo.slice(0, 70)}… → ${c.url}`)
        } else if (fila.muestra.length < 2) {
          fila.muestra.push(`${c.titulo.slice(0, 70)}… → (SIN ENLACE)`)
        }
      }
    }
    if (fila.candidatos > 0) filas.push(fila)
    process.stdout.write('.')
  }

  console.log('\n')
  const tot = filas.reduce((a, f) => a + f.candidatos, 0)
  const con = filas.reduce((a, f) => a + f.conUrl, 0)
  console.table(
    filas
      .sort((a, b) => b.candidatos - a.candidatos)
      .map((f) => ({
        boletín: f.boletin,
        candidatos: f.candidatos,
        'con enlace': f.conUrl,
        '%': f.candidatos ? `${Math.round((f.conUrl / f.candidatos) * 100)}%` : '—',
      })),
  )
  console.log(
    `TOTAL: ${con}/${tot} candidatos con enlace al anuncio (${tot ? Math.round((con / tot) * 100) : 0}%) · antes del arreglo: 0%\n`,
  )

  for (const f of filas) {
    if (!f.muestra.length) continue
    console.log(`### ${f.boletin}`)
    f.muestra.forEach((m) => console.log(`   ${m}`))
  }

  if (CON_BD) {
    const { Client } = await import('pg')
    const dotenv = await import('dotenv')
    const path = await import('path')
    const fs = await import('fs')
    for (const p of ['.env.local', '../.env.local']) {
      if (fs.existsSync(path.resolve(p))) { dotenv.config({ path: path.resolve(p) }); break }
    }
    const c = new Client({
      connectionString: (process.env.DATABASE_URL ?? '').split('?')[0],
      ssl: { rejectUnauthorized: false },
    })
    await c.connect()
    console.log('\n🔗 ¿reconoce `boletin_doc_key` el enlace? (condición para que el apply registre el documento)')
    const resumen: Array<Record<string, unknown>> = []
    for (const f of filas) {
      if (!f.urls.length) continue
      const r = await c.query<{ ok: number }>(
        `SELECT count(*) FILTER (WHERE boletin_doc_key(u) ~ '^(BOE|BOCM|DOGV|BOCYL|DOGC|BOC|BOJA|DOG|MIA)-')::int AS ok
           FROM unnest($1::text[]) u`,
        [f.urls],
      )
      const ok = Number(r.rows[0].ok)
      resumen.push({
        boletín: f.boletin,
        'con enlace': f.urls.length,
        'doc_key OK': ok,
        veredicto: ok === f.urls.length ? '✅ deja documento' : ok === 0 ? '❌ sin parser de doc_key' : '⚠️ parcial',
      })
    }
    console.table(resumen)
    const totalOk = resumen.reduce((a, r) => a + Number(r['doc_key OK']), 0)
    console.log(
      `CADENA COMPLETA: ${totalOk}/${tot} candidatos acabarían con documento registrado (${tot ? Math.round((totalOk / tot) * 100) : 0}%)\n`,
    )
    await c.end()
  }

  if (VERIFICAR) {
    console.log('\n🌐 Verificando que las URLs resuelven (muestra)…')
    const urls = filas.flatMap((f) =>
      f.muestra.filter((m) => m.includes('→ http')).map((m) => m.split('→ ')[1]),
    )
    for (const u of urls.slice(0, 12)) {
      try {
        const r = await fetch(u, { method: 'HEAD', redirect: 'follow' })
        console.log(`   ${r.status === 200 ? '✅' : '❌'} ${r.status} ${u}`)
      } catch (e) {
        console.log(`   ❌ ERR ${u} — ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
