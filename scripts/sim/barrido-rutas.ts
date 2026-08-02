#!/usr/bin/env npx tsx
/**
 * barrido-rutas.ts — recorrer la app COMO UN USUARIO, ruta por ruta, y decir qué está roto.
 * (T-487, 02/08/2026)
 *
 * ## Qué hueco cubre (y por qué no lo cubría nada)
 *
 * El reparto de Vence Sim está escrito en su runbook: la vigilancia CONTINUA la hacen los `@Cron`
 * de `backend/src/canary-*`, que son **de API**, y el navegador es Vence Sim, **on-demand por
 * diseño**. El motivo de que no hubiera navegador continuo también está escrito: *«Fargate no
 * tiene chromium»*. O sea que **nadie mira la app como la ve una persona salvo cuando alguien lo
 * pide** — y un journey afirma cosas de dominio de UNA pantalla, no de las 168.
 *
 * Esto no es un sistema nuevo: reutiliza la meta-invariante (`lib/sim/invariants`), el mismo bus
 * de observabilidad y las convenciones de `scripts/sim/run.ts`. Lo que añade son las dos piezas
 * que faltaban, y las dos son PURAS y testeadas: el **inventario** (`lib/sim/rutas`) y el
 * **oráculo** (`lib/sim/oraculo`).
 *
 * ## Los dos frenos, que son parte del diseño y no un detalle
 *
 * 1. **No autodenegarse el servicio.** Un barrido interno ya tumbó parte del sitio, y con una sola
 *    réplica no lo degrada: lo para entero. Por eso el ritmo va limitado (`--rpm`, 10 por defecto,
 *    el mismo límite que ya documenta el runbook) y el plan visita **una ruta por FORMA**: 168
 *    visitas en vez de 804, sin perder cobertura de código.
 * 2. **No ensuciar los datos con los que decidimos.** Las rutas que SIRVEN preguntas alimentan
 *    `daily_questions_served`, el ranking y las señales de fraude — abrir preguntas sin
 *    responderlas es la firma de `harvest_no_answer`. Están clasificadas aparte y **fuera por
 *    defecto**: para incluirlas hay que pedirlo (`--clases`), y quien lo pida sabe lo que hace.
 *
 * ## Uso
 *
 *     npm run sim:rutas -- --plan             # QUÉ visitaría (sin abrir navegador ni tocar nada)
 *     npm run sim:rutas                       # lo recorre y juzga
 *     npm run sim:rutas -- --pasada 3 --emit  # rota los ejemplares y publica en observabilidad
 *
 *   --base <url>      contra qué (por defecto, producción)
 *   --plan            solo imprime el plan; no abre navegador
 *   --presupuesto N   tope de visitas de esta pasada (por defecto, todas las formas)
 *   --rpm N           peticiones por minuto (por defecto 10)
 *   --pasada N        qué ejemplar toca de cada forma (rotación determinista)
 *   --clases a,b      publica | autenticada | sirve_preguntas | admin | efimera
 *   --emit            publica en observable_events (lo vigila la regla `sim_ruta_rota`)
 *
 * Exit code: 1 si alguna ruta sale ROTA. Las sospechosas informan y no tumban nada.
 */
import { config as loadEnv } from 'dotenv'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

loadEnv({ path: '.env.local' })

import { inventario, planDeBarrido, pasadasParaCicloCompleto, type ClaseDeRuta, type Visita } from '../../lib/sim/rutas'
import { juzgarVisita, severidadDe, resumen, type JuicioDeRuta } from '../../lib/sim/oraculo'

const REPO = process.cwd()
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const flag = (n: string) => process.argv.includes(n)

const BASE = (arg('--base', process.env.SIM_BASE_URL || 'https://www.vence.es') as string).replace(/\/$/, '')
const RPM = Number(arg('--rpm', '10'))
const PASADA = Number(arg('--pasada', '0'))
const SOLO_PLAN = flag('--plan')
const EMIT = flag('--emit')
const CLASES = (arg('--clases', 'publica') as string).split(',').map((s) => s.trim()) as ClaseDeRuta[]

/** Todas las páginas del router de Next, leídas del disco. La lista NO se mantiene a mano. */
function ficherosDePagina(dir = join(REPO, 'app'), acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) ficherosDePagina(p, acc)
    else if (/^page\.[jt]sx?$/.test(e)) acc.push(p.slice(REPO.length + 1))
  }
  return acc
}

interface Datos {
  valores: Record<string, string | undefined>
  valoresPorForma: Record<string, Record<string, string | undefined>>
  /** slug de oposición → su primer tema activo. Lo consume el resolver por ejemplar. */
  primerTema: Map<string, string>
  oposiciones: Set<string>
}

/**
 * Valores REALES para los segmentos dinámicos. Salen de la BD, nunca inventados: un id inventado
 * da un 404 que el oráculo leería como página rota, y un detector que se autoinventa hallazgos
 * deja de leerse en una semana.
 *
 * Si no hay BD, se devuelve lo que se sepa y el resto de rutas sale como «no visitable» — que es
 * distinto de «visitada y correcta», y así se imprime.
 */
async function valoresReales(): Promise<Datos> {
  const oposiciones = new Set<string>()
  const primerTema = new Map<string, string>()
  // GLOBALES: solo los parámetros que significan lo mismo en toda la app.
  const valores: Record<string, string | undefined> = {}
  // POR FORMA: todo lo demás. `[slug]` es a la vez tema del temario, artículo de ayuda y curso —
  // un único valor global daría 404 falsos en dos de cada tres.
  const valoresPorForma: Record<string, Record<string, string | undefined>> = {}
  if (!process.env.DATABASE_URL) return { valores, valoresPorForma, primerTema, oposiciones }

  const postgres = (await import('postgres')).default
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  try {
    for (const r of await sql`SELECT slug FROM oposiciones WHERE slug IS NOT NULL`) oposiciones.add(r.slug)
    // Solo para los `[oposicion]` LITERALES (11 rutas). No pisa la rotación de los directorios.
    const [act] = await sql`SELECT slug FROM oposiciones WHERE is_active = true ORDER BY slug LIMIT 1`
    if (act) valores.oposicion = act.slug

    // Primer tema activo de CADA oposición. No se fija uno global a propósito: 128 empiezan en el
    // tema 1 y 3 empiezan en el 101, así que un valor universal daría 404 falsos en esas tres —
    // y solo en las pasadas que las tocaran, que es la peor forma de fallar (intermitente).
    // El `position_type` es el slug con guiones bajos; no hay columna que los una, así que la
    // equivalencia va explícita aquí.
    for (const r of await sql`
      SELECT position_type, MIN(topic_number)::int AS primero
        FROM topics WHERE is_active = true GROUP BY position_type`) {
      primerTema.set(String(r.position_type).replace(/_/g, '-'), String(r.primero))
    }

    const [ley] = await sql`SELECT slug FROM laws WHERE is_active = true AND slug IS NOT NULL ORDER BY slug LIMIT 1`
    if (ley) {
      valores.law = ley.slug
      valores.lawId = ley.slug
      const [art] = await sql`
        SELECT a.article_number FROM articles a JOIN laws l ON l.id = a.law_id
         WHERE a.is_active = true AND l.slug = ${ley.slug} AND a.article_number ~ '^[0-9]+$'
         ORDER BY a.article_number::int LIMIT 1`
      if (art) valores.articleNumber = art.article_number
    }
  } finally {
    try { await sql.end({ timeout: 5 }) } catch { /* el barrido no depende de cerrar bien */ }
  }
  return { valores, valoresPorForma, primerTema, oposiciones }
}

/**
 * Los valores que dependen del EJEMPLAR que ha tocado esta pasada, no de la forma.
 *
 * El slug del temario tiene la forma `tema-N` y lo parsea la propia página con una expresión que
 * solo acepta eso; sacarlo de otra tabla sería inventárselo.
 */
function resolverPorEjemplar(primerTema: Map<string, string>) {
  return ({ oposicion }: { oposicion: string | null }) => {
    const n = oposicion ? primerTema.get(oposicion) : undefined
    return n ? { numero: n, slug: 'tema-' + n } : {}
  }
}

/** Ritmo: el freno que impide que esto se comporte como el barrido que ya tumbó parte del sitio. */
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function visitar(page: any, v: Visita): Promise<JuicioDeRuta> {
  const erroresConsola: string[] = []
  const peticionesFallidas: Array<{ url: string; status: number }> = []
  // El mensaje de consola de una subpetición fallida NO dice cuál falló («Failed to load resource:
  // …401»), así que se anota la URL desde la respuesta. Sin eso, el hallazgo no se puede triar y
  // el detector acaba en la papelera por inútil, no por falso.
  const onConsole = (m: any) => {
    if (m.type() !== 'error') return
    const u = m.location?.()?.url
    erroresConsola.push(u ? `${m.text()} [${u}]` : m.text())
  }
  const onPageError = (e: any) => erroresConsola.push(String(e?.message || e))
  const onResponse = (r: any) => { if (r.status() >= 500) peticionesFallidas.push({ url: r.url(), status: r.status() }) }

  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResponse)
  let status: number | null = null
  let textoVisible = ''
  try {
    const resp = await page.goto(BASE + v.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    status = resp ? resp.status() : null
    // Se espera a que la página se asiente: juzgar el HTML inicial daría por vacía cualquier
    // pantalla que pinte tras hidratar, que son casi todas.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    textoVisible = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  } catch (e: any) {
    erroresConsola.push('navegación: ' + String(e?.message || e).slice(0, 200))
  } finally {
    page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResponse)
  }
  return juzgarVisita({ url: v.url, status, textoVisible, erroresConsola, peticionesFallidas })
}

/**
 * Publica en el bus que ya usa todo el proyecto. **Sin esto sería un silo**: un barrido cuyo
 * resultado muere en la terminal de quien lo ejecuta no es una comprobación, es una anécdota —
 * el mismo modo de fallo que el gate de creación de oposiciones, que revisaba diez fases y no
 * escribía una sola fila.
 *
 * Lo vigila la regla `sim_ruta_rota` (`backend/src/alerts/alert-rules.ts`) y sale en
 * /admin/salud-sistema.
 */
async function emitir(juicios: JuicioDeRuta[], pasada: number) {
  if (!process.env.DATABASE_URL) { console.warn('⚠️  --emit sin DATABASE_URL: no se publica'); return }
  const postgres = (await import('postgres')).default
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  try {
    for (const j of juicios) {
      // Las sanas no se publican una a una: 168 filas verdes por pasada ahogarían el bus. Lo que
      // interesa de una pasada correcta es que corrió, y eso lo dice el evento de resumen.
      if (j.veredicto === 'ok') continue
      await sql`
        INSERT INTO observable_events (source, severity, event_type, endpoint, error_message, metadata)
        VALUES ('fargate', ${severidadDe(j)}, 'sim_ruta_rota', ${j.url},
                ${j.motivos.join(' · ').slice(0, 500)},
                ${sql.json({ veredicto: j.veredicto, puntoCiego: j.puntoCiego, motivos: j.motivos, pasada, base: BASE })})`
    }
    const r = resumen(juicios)
    await sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, error_message, metadata)
      VALUES ('fargate', 'info', 'sim_barrido_pasada', '/sim/barrido-rutas',
              ${`${r.total} rutas · ${r.rotas} rotas · ${r.sospechosas} sospechosas`},
              ${sql.json({ total: r.total, ok: r.ok, rotas: r.rotas, sospechosas: r.sospechosas, puntosCiegos: r.puntosCiegos, pasada, base: BASE })})`
  } finally { try { await sql.end({ timeout: 5 }) } catch {} }
}

async function main() {
  const { valores, valoresPorForma, primerTema, oposiciones } = await valoresReales()
  const formas = inventario(ficherosDePagina(), oposiciones)
  const presupuesto = Number(arg('--presupuesto', String(formas.length)))
  const { visitas, fuera } = planDeBarrido(formas, {
    valores, valoresPorForma, resolver: resolverPorEjemplar(primerTema),
    presupuesto, pasada: PASADA, clases: CLASES,
  })
  const ciclo = pasadasParaCicloCompleto(formas, CLASES)

  console.log(`\n▶ Barrido de rutas — ${BASE}`)
  console.log(`   ${formas.length} formas de ruta (de ${formas.reduce((n, f) => n + f.ejemplares.length, 0)} páginas)`)
  console.log(`   clases: ${CLASES.join(', ')} · pasada ${PASADA} · ${visitas.length} visitas a ${RPM}/min`)
  console.log(`   ciclo completo de DATOS: ${ciclo} pasada(s)\n`)
  // Lo que NO se mira se dice siempre: un barrido que trunca en silencio se lee como completo.
  if (fuera.length) {
    console.log(`⚠️  ${fuera.length} fuera de esta pasada:`)
    for (const f of fuera.slice(0, 10)) console.log(`     · ${f}`)
    if (fuera.length > 10) console.log(`     …y ${fuera.length - 10} más`)
    console.log('')
  }

  if (SOLO_PLAN) {
    for (const v of visitas) console.log(`   ${v.url}   [${v.clase}] ${v.motivo}`)
    console.log(`\n(--plan: no se ha abierto ningún navegador ni tocado ${BASE})`)
    return 0
  }

  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const juicios: JuicioDeRuta[] = []
  const intervalo = Math.ceil(60_000 / Math.max(1, RPM))
  try {
    for (const [i, v] of visitas.entries()) {
      const t0 = Date.now()
      const j = await visitar(page, v)
      juicios.push(j)
      const icono = j.veredicto === 'rota' ? '❌' : j.veredicto === 'sospechosa' ? '⚠️ ' : '✅'
      console.log(`${icono} ${v.url}${j.motivos.length ? '  → ' + j.motivos[0] : ''}`)
      if (i < visitas.length - 1) await esperar(Math.max(0, intervalo - (Date.now() - t0)))
    }
  } finally {
    await ctx.close().catch(() => {}); await browser.close().catch(() => {})
  }

  const r = resumen(juicios)
  console.log(`\n${r.rotas ? '❌' : '✅'} ${r.total} rutas · ${r.ok} ok · ${r.rotas} ROTAS · ${r.sospechosas} sospechosas · ${r.puntosCiegos} punto(s) ciego(s)`)
  for (const d of r.detalle) console.log(`   ${d.veredicto === 'rota' ? '❌' : '⚠️ '} ${d.url} — ${d.motivos.join(' · ')}`)
  if (EMIT) await emitir(juicios, PASADA)
  return r.rotas ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌ barrido:', e); process.exit(1) })
