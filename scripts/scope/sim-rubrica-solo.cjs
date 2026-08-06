#!/usr/bin/env node
/**
 * sim-rubrica-solo.cjs — SIMULACIÓN bank-wide del arreglo T-223: capítulos/títulos que el
 * epígrafe nombra SOLO por su RÚBRICA (sin decir "Capítulo N"/"Título N" en ningún sitio).
 *
 * Antes de este fix, `classifyTitleBoundary` se callaba entero (`applicable:false`) en cuanto
 * `epigrafeTitles(epigrafe)` no encontraba ni un solo "Título N"/"Capítulo N" LITERAL — daba
 * igual que el epígrafe nombrara secciones concretas por su materia. Caso raíz: Decreto
 * 53/1989 EAP Murcia T9 (feedback de Luisa), epígrafe "funciones y organización del Equipo…",
 * estructura Cap.II "Funciones…" + Cap.III "Organización".
 *
 * Este runner aísla EXACTAMENTE ese hueco (no repite lo que `sim-title-boundary.ts` ya cubre:
 * ahí el epígrafe SÍ nombra números) y usa la estructura YA POBLADA en `law_sections` — no
 * hace fetch al BOE, así que cubre TAMBIÉN leyes regionales sin id BOE-A- (el caso real es
 * BORM). Por eso es bank-wide de verdad: 330 leyes con law_sections capitulo/titulo medidas
 * el 06/08/2026, frente a las ~pocas decenas con id BOE-A- que ve `sim-title-boundary.ts`.
 *
 * NO escribe nada — solo lee (VENCE_LECTOR_URL) y reporta, para MEDIR precisión antes de
 * decidir si esto entra en el badge (lección T-113/T-047: la banda que pinga el badge exige
 * precisión alta, no solo recall).
 *
 * ⚠️ MEDIDO el 06/08/2026, y la conclusión es NO ENCENDERLO EN BADGE TODAVÍA: sobre 3.501
 * (tema,ley) evaluados, 556 pasan a `applicable` en leyes de UN SOLO nivel (sin la ambigüedad
 * título/capítulo de abajo) y 468 dan overflow. Inspeccionando 20+ a mano, la inmensa mayoría
 * son FALSOS POSITIVOS con un patrón sistemático: el epígrafe describe el TEMA en prosa propia
 * (no reutiliza el texto de las rúbricas oficiales) y solo UNA sección casa por coincidencia de
 * vocabulario — el resto de la ley se marca overflow aunque nadie la haya juzgado de más. Y el
 * capítulo que más se cuela como falso positivo es justo "Disposiciones/Normas generales" (el
 * mismo punto ciego ya documentado para el Título Preliminar en `epigrafeNamesRubrica`): un
 * caso de ratio alto (RD 1002/2010, 4/5 secciones casadas) TAMBIÉN lo marca, y probablemente
 * sea correcto no marcarlo. El matcher por NÚMERO (`epigrafeTitles`) es una señal fuerte porque
 * nombrar "Título N" es un acto deliberado; el matcher por RÚBRICA es solape de vocabulario, más
 * débil, y a escala de banco no alcanza la precisión que exige una banda que pinga el badge. Sí
 * sirve para el caso ESTRECHO para el que nació (epígrafe corto que enumera EXHAUSTIVAMENTE 2-3
 * materias, caso Decreto 53/1989) y como candidatos de adjudicación humana — no para auto-flag.
 *
 * Uso: DATABASE_URL="$VENCE_LECTOR_URL?sslmode=require" node scripts/scope/sim-rubrica-solo.cjs [--sample=20] [--pt=<position_type>] [--mono]
 *      --mono restringe a leyes de un solo nivel (título O capítulo, nunca los dos) — evita el
 *      falso positivo de granularidad medido en RDL 8/2015 (ver comentario en `secciones()`).
 */
const path = require('path')
const { classifyTitleBoundary, epigrafeTitles } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'scopeTitleBoundary.js'))

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const fs = require('fs')
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
}
const pg = require('postgres')
const sql = pg(getUrl(), { ssl: 'require', max: 3 })

const sampleN = Number((process.argv.find((a) => a.startsWith('--sample=')) || '--sample=25').split('=')[1])
const ptFilter = (process.argv.find((a) => a.startsWith('--pt=')) || '').split('=')[1]
const soloMono = process.argv.includes('--mono')

async function main() {
  const scopes = await sql`
    SELECT t.id AS topic_id, t.position_type AS pt, t.topic_number AS tn, t.epigrafe,
           l.id AS law_id, l.short_name AS ley,
           ts.article_numbers,
           ts.article_numbers IS NULL AS es_null
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
      JOIN laws l ON l.id = ts.law_id
     WHERE t.is_active = true
       AND EXISTS (
         SELECT 1 FROM law_sections ls
          WHERE ls.law_id = ts.law_id AND ls.is_active AND ls.section_type IN ('capitulo', 'titulo')
       )
       ${ptFilter ? sql`AND t.position_type = ${ptFilter}` : sql``}
     ORDER BY t.position_type, t.topic_number`

  console.log(`${scopes.length} (tema, ley) con law_sections poblado`)

  const secsCache = new Map()
  // ⚠️ MISMA CONVENCIÓN que `parseBoeSections` (lib/laws/parseBoeSections.js): un NIVEL por
  // ley, TÍTULO si existe, si no CAPÍTULO — nunca los dos a la vez. Descubierto simulando: bank
  // real, algunas leyes tienen filas de AMBOS niveles en `law_sections` (p.ej. RDL 8/2015, 6
  // títulos + 50 capítulos que RESTART su numeración dentro de cada título), y sin filtrar por
  // nivel, `find()` casaba el artículo con el título ANCHO (menos preciso) en vez del capítulo
  // (la rúbrica que de verdad casa con el epígrafe) — falso positivo de overflow, no del
  // detector. Ver hallazgo medido en la entrega de T-223.
  async function secciones(lawId) {
    if (secsCache.has(lawId)) return secsCache.get(lawId)
    const rows = await sql`
      SELECT section_type, section_number AS num, article_range_start AS "from", article_range_end AS "to", title AS rubrica
        FROM law_sections WHERE law_id = ${lawId} AND is_active AND section_type IN ('capitulo', 'titulo')
       ORDER BY order_position`
    const nivel = rows.some((r) => r.section_type === 'titulo') ? 'titulo' : 'capitulo'
    const filtered = rows.filter((r) => r.section_type === nivel)
    const mono = new Set(rows.map((r) => r.section_type)).size === 1
    const result = { filtered, mono }
    secsCache.set(lawId, result)
    return result
  }

  let evaluados = 0, yaAplicaba = 0, ciegoAntes = 0, aplicaAhoraPorRubrica = 0, conOverflow = 0
  let monoApplic = 0, monoOverflow = 0, multiApplic = 0, multiOverflow = 0
  const hallazgos = []

  for (const r of scopes) {
    const { filtered: secs, mono } = await secciones(r.law_id)
    if (!secs.length) continue
    if (soloMono && !mono) continue
    let arts
    if (r.es_null) {
      const rows = await sql`SELECT article_number FROM articles WHERE law_id = ${r.law_id} AND is_active = true`
      arts = rows.map((a) => String(a.article_number))
    } else {
      arts = r.article_numbers || []
    }
    if (!arts.length) continue
    evaluados++

    const numerados = epigrafeTitles(r.epigrafe || '').length > 0
    if (numerados) { yaAplicaba++; continue } // eso ya lo cubre sim-title-boundary.ts, no es el hueco de T-223

    const res = classifyTitleBoundary(r.epigrafe, secs, arts)
    if (!res.applicable) { ciegoAntes++; continue } // sigue sin aplicar (ninguna rúbrica casó): correcto, no hay señal

    aplicaAhoraPorRubrica++
    if (mono) monoApplic++; else multiApplic++
    if (res.overflow.length) {
      conOverflow++
      if (mono) monoOverflow++; else multiOverflow++
      hallazgos.push({
        pt: r.pt, tn: r.tn, ley: r.ley, epigrafe: r.epigrafe,
        overflow: res.overflow, totalScoped: arts.length, mono,
      })
    }
  }

  console.log(`\n📊 evaluados=${evaluados}`)
  console.log(`   · ${yaAplicaba} ya los cubre epigrafeTitles (números explícitos) — no es el hueco de T-223`)
  console.log(`   · ${ciegoAntes} siguen sin aplicar (ninguna rúbrica casó) — sin cambio de comportamiento`)
  console.log(`   · ${aplicaAhoraPorRubrica} AHORA aplican SOLO por rúbrica (el hueco que cierra T-223)`)
  console.log(`     — mono-nivel (SOLO título o SOLO capítulo, sin ambigüedad de granularidad): ${monoApplic} aplican, ${monoOverflow} con overflow`)
  console.log(`     — multi-nivel (título Y capítulo a la vez, granularidad puede no casar con el epígrafe): ${multiApplic} aplican, ${multiOverflow} con overflow`)
  console.log(`   · ${conOverflow} de esos, CON overflow (candidato a hallazgo real)`)

  console.log(`\n── MUESTRA (hasta ${sampleN}) para juicio de precisión — mirar epígrafe vs overflow a mano ──\n`)
  for (const h of hallazgos.slice(0, sampleN)) {
    console.log(`${h.pt} T${h.tn} · ${h.ley} (${h.overflow.length}/${h.totalScoped} scoped en overflow)`)
    console.log(`  epígrafe: ${h.epigrafe}`)
    console.log(`  overflow: ${h.overflow.map((o) => `art.${o.article}(Cap/Tít ${o.titulo})`).join(', ')}`)
    console.log()
  }

  if (hallazgos.length > sampleN) console.log(`… y ${hallazgos.length - sampleN} más (usa --sample=N para ver más).`)

  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
