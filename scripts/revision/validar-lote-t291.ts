#!/usr/bin/env npx tsx
/**
 * validar-lote-t291.ts — arnés de control de la campaña T-291 escalón 2 (revisión con agentes de
 * las preguntas activas NUNCA verificadas y sin explicación estructurada).
 *
 * Existe porque el manual (§20.3) mide que los agentes que escriben JSON a escala **degeneran el
 * 40-50% de las veces** (repiten `question_id`, o "saltan" un fichero que ya existía), y porque
 * §15 mide 45% de falsos positivos cuando el orquestador aplica sin control intermedio. Así que
 * NADA de lo que devuelve un agente se aplica sin pasar por aquí.
 *
 * NO decide contenido y NO escribe en la BD: solo lee y verifica. Lo que rechaza, no se aplica.
 *
 * Todos los criterios se importan de donde YA viven — ni una copia:
 *   · `isStructuredExplanation`, `structuredNarrativeStaleLetters` → lib/shuffle/structuredExplanation
 *   · `explanationReferencesLetters`, `optionsReferenceOtherOptions`, `classifyShuffleMode`
 *     → lib/shuffle/classifyShuffleMode
 *   · `citaNoLiteral` → scripts/impugnaciones/validar-explicacion.cjs (criterio ÚNICO de cita
 *     literal, con trinquete en __tests__/impugnaciones/criterioCitaUnico.test.ts)
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/revision/validar-lote-t291.ts
 *   npx tsx --env-file=.env.local scripts/revision/validar-lote-t291.ts --json  (salida máquina)
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  isStructuredExplanation,
  structuredNarrativeStaleLetters,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'
import {
  explanationReferencesLetters,
  optionsReferenceOtherOptions,
  classifyShuffleMode,
} from '@/lib/shuffle/classifyShuffleMode'

const { citaNoLiteral } = require(join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs'))

const BASE = 'scratchpad/t291'
const JSON_OUT = process.argv.includes('--json')

type Veredicto = {
  question_id: string
  article_ok?: boolean
  answer_ok?: boolean
  options_ok?: boolean
  explanation_ok?: boolean
  veredicto: string
  confianza?: string
  notas?: string
  fuente?: string
  clave_deberia_ser?: string | null
  articulo_sugerido?: string | null
}

const VEREDICTOS_VALIDOS = new Set([
  'ok_estructurada', 'defecto_clave', 'defecto_articulo', 'defecto_opciones', 'irresoluble',
])

function main() {
  const lotesDir = join(BASE, 'lotes')
  const veredDir = join(BASE, 'veredictos')
  const estrDir = join(BASE, 'estructuradas')

  const problemasLote: string[] = []
  const esperadas = new Map<string, string>()   // question_id → lote
  for (const f of readdirSync(lotesDir)) {
    for (const q of JSON.parse(readFileSync(join(lotesDir, f), 'utf8'))) {
      esperadas.set(q.question_id, f.replace('.json', ''))
    }
  }

  // ── 1. integridad de los veredictos: un objeto por pregunta, ids únicos, del lote correcto
  const veredictos = new Map<string, Veredicto>()
  const lotesEntregados: string[] = []
  for (const f of existsSync(veredDir) ? readdirSync(veredDir).filter((x) => x.endsWith('.json')) : []) {
    const lote = f.replace('.json', '')
    lotesEntregados.push(lote)
    let arr: Veredicto[]
    try {
      arr = JSON.parse(readFileSync(join(veredDir, f), 'utf8'))
    } catch (e: any) {
      problemasLote.push(`${lote}: JSON ilegible (${e.message})`)
      continue
    }
    if (!Array.isArray(arr)) { problemasLote.push(`${lote}: no es un array`); continue }
    const delLote = [...esperadas.entries()].filter(([, l]) => l === lote).map(([id]) => id)
    const ids = arr.map((v) => v.question_id)
    const unicos = new Set(ids)
    // El tell de la degeneración del §20.3: N objetos con menos ids distintos.
    if (unicos.size !== ids.length) {
      problemasLote.push(`${lote}: DEGENERADO — ${ids.length} objetos pero ${unicos.size} ids distintos`)
    }
    if (unicos.size !== delLote.length) {
      problemasLote.push(`${lote}: cobertura ${unicos.size}/${delLote.length} preguntas del lote`)
    }
    for (const v of arr) {
      if (!esperadas.has(v.question_id)) { problemasLote.push(`${lote}: id ajeno al lote ${v.question_id}`); continue }
      if (!VEREDICTOS_VALIDOS.has(v.veredicto)) problemasLote.push(`${lote}: veredicto desconocido "${v.veredicto}" en ${v.question_id}`)
      if (veredictos.has(v.question_id)) problemasLote.push(`${v.question_id}: veredicto duplicado en dos lotes`)
      veredictos.set(v.question_id, v)
    }
  }

  // ── 2. coherencia veredicto ↔ fichero de explicación
  const conFichero = new Set(
    (existsSync(estrDir) ? readdirSync(estrDir) : []).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')),
  )
  const faltaFichero: string[] = []
  const ficheroDeMas: string[] = []
  for (const [id, v] of veredictos) {
    const limpia = v.veredicto === 'ok_estructurada'
    if (limpia && !conFichero.has(id)) faltaFichero.push(id)
    if (!limpia && conFichero.has(id)) ficheroDeMas.push(id)
  }
  for (const id of conFichero) if (!veredictos.has(id)) ficheroDeMas.push(`${id} (sin veredicto)`)

  return { esperadas, veredictos, conFichero, problemasLote, faltaFichero, ficheroDeMas, lotesEntregados }
}

async function gates(ctx: ReturnType<typeof main>) {
  const avisos: string[] = []
  const db = getDb()
  const ids = [...ctx.conFichero].filter((id) => ctx.veredictos.get(id)?.veredicto === 'ok_estructurada')
  if (!ids.length) return { filas: [], resumen: {} as Record<string, number>, avisos }

  // `${ids}::uuid[]` NO vale aquí: el template de Drizzle interpola el array de JS como `record`
  // y Postgres responde "cannot cast type record to uuid[]". Se pasa como texto y se parte en SQL.
  const rows: any = await db.execute(sql`
    SELECT id, question_text, correct_option, option_a, option_b, option_c, option_d, option_e,
           shuffle_mode, shuffle_safety,
           (SELECT a.content FROM articles a WHERE a.id = q.primary_article_id) AS article_content
      FROM questions q
     WHERE id = ANY(string_to_array(${ids.join(',')}, ',')::uuid[])`)
  const porId = new Map((rows as any[]).map((r: any) => [r.id, r]))

  const filas: Array<{ id: string; ok: boolean; motivos: string[]; shuffle_mode: string }> = []
  for (const id of ids) {
    const q = porId.get(id)
    const motivos: string[] = []
    if (!q) { filas.push({ id, ok: false, motivos: ['no existe / no activa en BD'], shuffle_mode: '?' }); continue }

    const opciones = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
      .filter((v: string | null) => v != null && v !== '')

    // `unknown` a propósito, igual que en `aplicar-explicacion.ts`: si se declara ya como
    // `StructuredExplanation`, el type guard estrecha la rama de error a `never` y no deja ni leer
    // el objeto para explicar qué razón falta — que es justo lo que hay que informar.
    let crudo: unknown = null
    try {
      const raw = JSON.parse(readFileSync(join(BASE, 'estructuradas', `${id}.json`), 'utf8'))
      if (raw && typeof raw === 'object' && !raw.v) raw.v = 1
      crudo = raw
    } catch (e: any) {
      motivos.push(`JSON ilegible (${e.message})`)
    }

    if (crudo) {
      // (a) una razón por CADA opción presente — el gate del aplicador
      if (!isStructuredExplanation(crudo, opciones.length)) {
        const recibidas = Object.keys((crudo as { options?: Record<string, string> })?.options ?? {})
        motivos.push(`estructura incompleta: hacen falta ${opciones.length} razones ("0".."${opciones.length - 1}"), llegaron [${recibidas.join(',')}]`)
      }
      // Los gates siguientes son defensivos: se pasan igual sobre una estructura incompleta, para
      // informar de TODOS los defectos de una vez y no obligar a un segundo viaje.
      const data = crudo as StructuredExplanation
      // (b) razones que nombran letra/posición de otra opción → al barajar mienten
      const razonesSucias = Object.entries(data.options ?? {})
        .filter(([, r]) => explanationReferencesLetters(String(r)))
        .map(([k]) => k)
      if (razonesSucias.length) motivos.push(`razones con letra/posición: ${razonesSucias.join(',')}`)
      // (c) narrativa (intro/outro) con letra clavada — se emite verbatim en cualquier orden
      const narrativa = structuredNarrativeStaleLetters(data)
      if (narrativa.length) motivos.push(`narrativa con letra: ${narrativa.join(',')}`)
      // (d) apertura que duplica lo que pone el render
      if (/^la respuesta correcta es/i.test((data.intro ?? '').trim())) motivos.push('intro empieza por "La respuesta correcta es…"')
      // (e) frame coherente con el enunciado. Es AVISO, no rechazo — igual que en el aplicador: la
      //     heurística confunde el enunciado que PIDE la falsa con el que solo CONTIENE la palabra.
      //     Caso real de esta campaña: «¿Cómo se ha añadido el texto "COPIA FALSA"…?» no pide
      //     señalar ninguna opción falsa, y bloquearla habría sido un falso positivo.
      const pideFalsa = /\b(incorrecta|falsa|no es (?:cierto|correcta|correcto|verdadera?))\b/i.test(q.question_text || '')
      if (pideFalsa && data.frame !== 'select_incorrect') avisos.push(`${id}: el enunciado menciona "falsa/incorrecta" y no lleva frame:select_incorrect — comprobar a mano`)
      if (data.frame && !['select_correct', 'select_incorrect'].includes(data.frame)) motivos.push(`frame desconocido: ${data.frame}`)
      // (f) cita LITERAL contra el texto del artículo — criterio único compartido con impugnaciones
      const cita = data.cita?.texto || data.cita?.bloque
      if (cita && q.article_content) {
        const fallo = citaNoLiteral(String(cita), String(q.article_content))
        // `citaNoLiteral` devuelve un OBJETO con el detalle (no un string): interpolarlo directo
        // imprimía "[object Object]" y dejaba el rechazo sin diagnóstico, que es justo lo que hay
        // que leer para decidir si la desviación es cosmética o tergiversa la norma.
        if (fallo) {
          const detalle = typeof fallo === 'string' ? fallo : JSON.stringify(fallo)
          motivos.push(`cita no literal: ${detalle.slice(0, 300)}`)
        }
      }
    }

    // (g) ¿de verdad podrán barajarse las OPCIONES? La explicación estructurada hace barajable la
    //     EXPLICACIÓN; las opciones las decide su propio texto. Se informa, no bloquea: una
    //     pregunta con opciones no barajables igual merece la explicación nueva.
    const modo = classifyShuffleMode({ A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e } as any)
    const cruzadas = optionsReferenceOtherOptions(opciones)
    const modoEfectivo = cruzadas ? `${modo}+crossref` : modo

    filas.push({ id, ok: motivos.length === 0, motivos, shuffle_mode: modoEfectivo })
  }

  const resumen: Record<string, number> = {}
  for (const f of filas) for (const m of f.motivos) {
    const clave = m.split(':')[0]
    resumen[clave] = (resumen[clave] ?? 0) + 1
  }
  return { filas, resumen, avisos }
}

;(async () => {
  const ctx = main()
  const { filas, resumen, avisos } = await gates(ctx)

  const porVeredicto: Record<string, number> = {}
  for (const v of ctx.veredictos.values()) porVeredicto[v.veredicto] = (porVeredicto[v.veredicto] ?? 0) + 1
  const porConfianza: Record<string, number> = {}
  for (const v of ctx.veredictos.values()) porConfianza[v.confianza ?? '(sin)'] = (porConfianza[v.confianza ?? '(sin)'] ?? 0) + 1

  const salida = {
    lotes_entregados: ctx.lotesEntregados.sort(),
    preguntas_en_cola: ctx.esperadas.size,
    con_veredicto: ctx.veredictos.size,
    por_veredicto: porVeredicto,
    por_confianza: porConfianza,
    integridad: {
      problemas: ctx.problemasLote,
      falta_fichero_estructurada: ctx.faltaFichero,
      fichero_sobrante: ctx.ficheroDeMas,
    },
    gates: {
      candidatas: filas.length,
      pasan: filas.filter((f) => f.ok).length,
      rechazadas: filas.filter((f) => !f.ok).length,
      motivos: resumen,
      barajabilidad_opciones: filas.reduce((acc: Record<string, number>, f) => {
        acc[f.shuffle_mode] = (acc[f.shuffle_mode] ?? 0) + 1; return acc
      }, {}),
    },
    rechazadas_detalle: filas.filter((f) => !f.ok).map((f) => ({ id: f.id, motivos: f.motivos })),
    // Lista explícita de lo APLICABLE: es la entrada del paso siguiente (copiar a un directorio y
    // pasarlo a `aplicar-explicacion.ts --lote`). Deducirla restando en cada consumidor era la
    // forma de que un día se aplicara una rechazada.
    aprobadas: filas.filter((f) => f.ok).map((f) => f.id),
    avisos,
  }

  if (JSON_OUT) { console.log(JSON.stringify(salida, null, 2)); process.exit(0) }

  console.log(`\n📦 lotes entregados: ${salida.lotes_entregados.length}/20 — ${salida.lotes_entregados.join(' ')}`)
  console.log(`   veredictos: ${salida.con_veredicto}/${salida.preguntas_en_cola} preguntas de la cola`)
  console.log('\n🔎 por veredicto:'); console.table(porVeredicto)
  console.log('🎯 confianza declarada:'); console.table(porConfianza)
  if (ctx.problemasLote.length) { console.log('\n⚠️  integridad:'); for (const p of ctx.problemasLote) console.log(`   · ${p}`) }
  if (ctx.faltaFichero.length) console.log(`\n⚠️  ${ctx.faltaFichero.length} marcadas ok_estructurada SIN fichero de explicación`)
  if (ctx.ficheroDeMas.length) console.log(`⚠️  ${ctx.ficheroDeMas.length} ficheros de explicación que NO deberían existir (defecto o sin veredicto)`)
  console.log(`\n🚪 gates sobre las ${filas.length} explicaciones nuevas: ✅ ${salida.gates.pasan} pasan · ❌ ${salida.gates.rechazadas} rechazadas`)
  if (Object.keys(resumen).length) { console.log('   motivos de rechazo:'); console.table(resumen) }
  console.log('   barajabilidad de las OPCIONES (informativo, no bloquea):'); console.table(salida.gates.barajabilidad_opciones)
  for (const r of salida.rechazadas_detalle.slice(0, 15)) console.log(`   ❌ ${r.id} — ${r.motivos.join(' · ')}`)
  if (avisos.length) { console.log(`\n⚠️  ${avisos.length} aviso(s) para mirar a mano (no bloquean):`); for (const a of avisos.slice(0, 10)) console.log(`   · ${a}`) }
  process.exit(0)
})()
