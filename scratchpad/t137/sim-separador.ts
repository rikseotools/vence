// T-137 · SIMULACIÓN de calibración: ¿debe el PUNTO contar como separador de enumeración?
//
// Hoy `enumerator = hasColon && segments >= 3`, y los segmentos se parten por ";" o ",".
// Muchos epígrafes enumeran con PUNTOS ("El acto administrativo. Concepto. Clases.") y esos
// quedan fuera — el propio caso de esta ficha da NONE por eso.
//
// No escribe nada. Mide sobre TODOS los scopes de temas activos cuántos veredictos cambiarían.
//
// ⚠️ OJO METODOLÓGICO (me pasó en la primera versión): NO vale sumar +30 al score actual, porque
// la regla de «materia acotada en prosa» exige `!enumerator` — al volver enumerador un epígrafe,
// esa regla SE APAGA. Sumar a ciegas inflaba los HIGH. Aquí se recalcula el score ENTERO con
// cada definición, replicando classifyScope sobre las mismas features.
import { Client } from 'pg'
import { parseEpigrafe, consensoBanco } from '../../lib/laws/scopeOverInclusion'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

/** Segmentos contando también el PUNTO como separador, y sin exigir colon. VARIANTE A (cruda). */
function segmentosConPunto(ep: string | null | undefined): number {
  const t = String(ep || '')
  const cuerpo = t.includes(':') ? t.slice(t.indexOf(':') + 1) : t
  return cuerpo
    .split(/[;,.]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length
}

// ── VARIANTE B: la misma, descontando la CITA de la norma ────────────────────────────────
// Artefacto medido en la variante A: «La Ley 19/2013, de 9 de diciembre, de transparencia,
// acceso a la información pública y buen gobierno.» da 4 «segmentos»… que son el NOMBRE de la
// ley, no una enumeración de materias. Contarlos convierte en enumerador a cualquier epígrafe
// que se limite a citar la norma — justo lo contrario de lo que la regla busca (un epígrafe que
// enumera sub-materias mientras el scope mete la ley entera).
const RE_CITA = /\b(?:ley\s+org[áa]nica|ley\s+foral|ley|real\s+decreto(?:\s+legislativo|\s+ley)?|decreto(?:\s+legislativo)?|reglamento|orden|resoluci[óo]n)\s+\d+\/\d{2,4}/i
/** Un trozo que es solo fecha: «de 9 de diciembre», «de 2015». */
const RE_FECHA = /^de\s+\d{1,2}\s+de\s+[a-záéíóú]+$|^de\s+\d{4}$/i

function segmentosMaterias(ep: string | null | undefined): number {
  const t = String(ep || '')
  const cuerpo = t.includes(':') ? t.slice(t.indexOf(':') + 1) : t
  const trozos = cuerpo.split(/[;,.]/).map((s) => s.trim())
  return trozos.filter((s) => {
    if (s.length < 4 || !/[a-záéíóúñ]/i.test(s)) return false
    if (RE_FECHA.test(s)) return false          // «de 9 de diciembre»
    if (RE_CITA.test(s)) return false           // «La Ley 19/2013»
    return true
  }).length
}

type Banda = 'HIGH' | 'MEDIUM' | 'CLEARED' | 'NONE'

/** Réplica fiel de classifyScope, con el enumerador inyectado. */
function bandaCon(
  lawTotal: number, scopedCount: number, epigrafe: string | null, enumerator: boolean,
): { banda: Banda; score: number } {
  const f = parseEpigrafe(epigrafe)
  const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0
  const bigLaw = lawTotal >= 12
  const nearFull = coverage >= 0.9
  const veryBigLaw = lawTotal >= 60
  if (f.wholeLawWords) return { banda: 'CLEARED', score: 0 }
  if (f.titComplete && f.closureWord && nearFull) return { banda: 'CLEARED', score: 0 }
  let score = 0
  if (f.explicitArts.size > 0 && bigLaw && scopedCount >= f.explicitArts.size * 2 && nearFull) score += 60
  if (f.titGap && nearFull && bigLaw) score += 50
  if (bigLaw && nearFull && enumerator) score += 30
  if (veryBigLaw && nearFull && !enumerator && f.acotaMateria) score += 30
  const banda: Banda = score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'NONE'
  return { banda, score }
}

type Row = {
  pt: string; tn: number; ley: string | null; epigrafe: string | null
  article_numbers: string[] | null; law_total: number; ya_ok: boolean
  peer_temas: number; peer_enteros: number; peer_mediana: number | null
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  const { rows } = (await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
           ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total,
           EXISTS (SELECT 1 FROM scope_over_inclusion_adjudications adj
                    WHERE adj.topic_id = ts.topic_id AND adj.law_id = ts.law_id AND adj.verdict = 'ok') AS ya_ok,
           (SELECT count(*) FROM topic_scope p JOIN topics pt ON pt.id=p.topic_id
             WHERE p.law_id=ts.law_id AND pt.is_active) peer_temas,
           (SELECT count(*) FROM topic_scope p JOIN topics pt ON pt.id=p.topic_id
             WHERE p.law_id=ts.law_id AND pt.is_active AND p.article_numbers IS NULL) peer_enteros,
           (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY array_length(p.article_numbers,1))
             FROM topic_scope p JOIN topics pt ON pt.id=p.topic_id
             WHERE p.law_id=ts.law_id AND pt.is_active AND p.article_numbers IS NOT NULL) peer_mediana
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
     WHERE t.is_active = true`)) as unknown as { rows: Row[] }
  await c.end()

  const scopedDe = (r: Row) => r.article_numbers === null
    ? Number(r.law_total)
    : r.article_numbers.filter((x) => /^[0-9]+$/.test(x)).length

  const cambios: Array<{ r: Row; de: Banda; a: Banda; segs: number; cob: number }> = []
  const bandas: { actual: Record<string, number>; crudaA: Record<string, number>; variante: Record<string, number> } =
    { actual: {}, crudaA: {}, variante: {} }

  for (const r of rows) {
    const scoped = scopedDe(r)
    const lawTotal = Number(r.law_total)
    const cob = lawTotal > 0 ? scoped / lawTotal : 0
    const f = parseEpigrafe(r.epigrafe)
    const enumActual = f.hasColon && f.segments >= 3
    const segsA = segmentosConPunto(r.epigrafe)
    const segs = segmentosMaterias(r.epigrafe)
    const enumA = enumActual || segsA >= 3
    const enumB = enumActual || segs >= 3

    const A = bandaCon(lawTotal, scoped, r.epigrafe, enumActual)
    const VA = bandaCon(lawTotal, scoped, r.epigrafe, enumA)
    const B = bandaCon(lawTotal, scoped, r.epigrafe, enumB)
    bandas.actual[A.banda] = (bandas.actual[A.banda] || 0) + 1
    bandas.crudaA[VA.banda] = (bandas.crudaA[VA.banda] || 0) + 1
    bandas.variante[B.banda] = (bandas.variante[B.banda] || 0) + 1
    if (A.banda !== B.banda) cambios.push({ r, de: A.banda, a: B.banda, segs, cob })
  }

  console.log(`scopes de temas activos: ${rows.length}`)
  console.log('\nbandas AHORA            :', bandas.actual)
  console.log('bandas VARIANTE A (cruda):', bandas.crudaA)
  console.log('bandas VARIANTE B (sin cita de la norma):', bandas.variante)
  console.log(`\ncambian de banda: ${cambios.length}`)
  const porTransicion: Record<string, number> = {}
  for (const x of cambios) porTransicion[`${x.de}→${x.a}`] = (porTransicion[`${x.de}→${x.a}`] || 0) + 1
  console.log('transiciones:', porTransicion)
  const nuevosHigh = cambios.filter((x) => x.a === 'HIGH')
  console.log(`ya adjudicados 'ok' entre los que cambian (ruido conocido): ${cambios.filter((x) => x.r.ya_ok).length}`)

  console.log('\n— TODOS los que pasarían a HIGH (los que pingan el badge) —')
  for (const x of nuevosHigh)
    console.log(`  ${x.r.pt} T${x.r.tn} · ${x.r.ley} · ${(x.cob * 100).toFixed(0)}% · ${x.segs} segs${x.r.ya_ok ? ' · YA ok' : ''}\n      «${String(x.r.epigrafe).replace(/\s+/g, ' ').slice(0, 170)}»`)

  // ¿Cuánta de la cola nueva es señal? El consenso del banco lo dice sin opinar: si esa MISMA
  // ley la acotan casi todos los demás temas, tenerla entera aquí es la anomalía.
  const señal: Record<string, number> = {}
  const anomalias: typeof cambios = []
  for (const x of cambios) {
    const v = consensoBanco({
      temas: Number(x.r.peer_temas), enteros: Number(x.r.peer_enteros),
      medianaAcotados: x.r.peer_mediana == null ? null : Number(x.r.peer_mediana),
    })
    señal[v.senal] = (señal[v.senal] || 0) + 1
    if (v.senal === 'anomalia') anomalias.push(x)
  }
  console.log('\nconsenso del banco sobre los que ENTRAN nuevos en la cola:', señal)
  console.log('\n— muestra de los marcados ANOMALIA (la ley entera es la excepción en el banco) —')
  for (const x of anomalias.slice(0, 12))
    console.log(`  ${x.r.pt} T${x.r.tn} · ${x.r.ley} · ${x.r.peer_enteros}/${x.r.peer_temas} enteros · mediana acotados ${x.r.peer_mediana}\n      «${String(x.r.epigrafe).replace(/\s+/g, ' ').slice(0, 150)}»`)

  const caso = cambios.find((x) => x.r.pt === 'oficial_de_gestion_parlamento_de_andalucia' && x.r.tn === 12)
  console.log(`\ncaso de la ficha (Parlamento Andalucía T12 · Ley 22/2009): ${caso ? `${caso.de} → ${caso.a} con ${caso.segs} segmentos` : 'NO cambia de banda'}`)
})().catch((e) => { console.error('ERROR', e.message); process.exit(1) })
