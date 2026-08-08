/**
 * sim-title-boundary.ts — SIMULACIÓN end-to-end del detector de off-by-one de
 * frontera de título (fix 24/07/2026, caso Mario/LOSU).
 *
 * Pipeline REAL: DB (epígrafe + topic_scope) → estructura título→rango de la ley
 * (índice del BOE + parseBoeSections) → classifyTitleBoundary → overflow.
 *
 * Uso: npx tsx scripts/scope/sim-title-boundary.ts <position_type> [topic_number]
 *      (--scope 1,2,6 fuerza un scope concreto, para reproducir el caso pre-fix)
 *
 * T-333 (06/08/2026): además del nivel EXTERNO (título si la ley lo tiene, si no capítulo),
 * ahora también prueba SECCIÓN y SUBSECCIÓN — el epígrafe que nombra secciones por su
 * RÚBRICA (nunca por número: "Sección N" no se cita así en la prosa de un temario) quedaba
 * completamente invisible cuando la ley YA tenía títulos, porque el runner solo miraba ese
 * nivel externo. Caso real: Ley 9/2017 Tema 22, cuyo Título Preliminar cubre TODO el rango
 * 1-27 de una pieza — a ese nivel no hay nada que discriminar, y el problema real (la
 * Sección 2.ª "Negocios y contratos excluidos" no está en el epígrafe) solo se ve un peldaño
 * más abajo. `resolverNivelDecisivo` decide cuál de los niveles probados es el que manda.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseBoeSections, parseBoeSectionsMultinivel, parseSeccionesSubsecciones, rubricaVigente } = require('../../lib/laws/parseBoeSections')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { classifyTitleBoundary, classifyByRubricaOnly, resumenBarrida, resolverNivelDecisivo } = require('../../lib/laws/scopeTitleBoundary')
type Seccion = { num: string; from: number; to: number; blockId?: string; rubrica?: string }
type Bloque = { id: string; label: string }

const sql = postgres(process.env.DATABASE_URL as string, { ssl: { rejectUnauthorized: false }, max: 1 })
const clean = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const boeId = (u: string) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]

const bloquesCache = new Map<string, Bloque[]>()
async function bloquesBoe(bid: string): Promise<Bloque[]> {
  if (bloquesCache.has(bid)) return bloquesCache.get(bid)!
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, { headers: { Accept: 'application/xml' } })).text()
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  bloquesCache.set(bid, bl)
  return bl
}

const structCache = new Map<string, Seccion[]>()
async function estructuraBoe(bid: string): Promise<Seccion[]> {
  if (structCache.has(bid)) return structCache.get(bid)!
  const bl = await bloquesBoe(bid)
  const secs: Seccion[] = parseBoeSections(bl).secciones
  structCache.set(bid, secs)
  return secs
}

/**
 * Nivel CAPÍTULO, pero SOLO cuando vive DENTRO de un título (T-467, 07/08/2026) — AGRUPADO
 * por su título padre.
 *
 * `estructuraBoe()` usa `parseBoeSections` (nivel ÚNICO: título si la ley lo tiene, si no
 * capítulo) — así que en una ley con AMBOS niveles, el capítulo queda completamente invisible
 * para el runner: el título se ve como un rango sin partir, y el defecto real (un capítulo
 * dentro de ese título que el epígrafe no nombra) no lo prueba nadie. Caso real: LO 3/2018
 * (auxiliar_administrativo_universidad_carlos_iii T6), Título V con Capítulos I-IV — el runner
 * veía "Título V: 28-39" de una pieza y el Capítulo I (28-32, no nombrado por el epígrafe) se
 * colaba entero.
 *
 * NUNCA se prueban todos los capítulos de la ley en una sola llamada: los números de capítulo
 * son ROMANOS, igual que los de título, y se REINICIAN en cada título ("Título V, Capítulo I" y
 * "Título III, Capítulo I" son el mismo num='I'). Medido en directo (T-467): pasar todos los
 * capítulos juntos hacía que un "Título III" citado por NÚMERO en el epígrafe (para OTRA
 * materia) casara por casualidad con "Capítulo III" de un título totalmente distinto —
 * `allowedTitles` mezcla dos espacios de numeración que no tienen nada que ver. Aislar por
 * título padre, y clasificar cada grupo con `classifyByRubricaOnly` (NUNCA
 * `classifyTitleBoundary`, que sí compara por número) es lo único que evita la colisión.
 *
 * Cuando capítulo es el ÚNICO nivel que existe (sin título por encima), `estructuraBoe()` YA lo
 * devuelve como nivel externo — por eso aquí se exige que `parseBoeSectionsMultinivel` tenga
 * DOS niveles (título Y capítulo) antes de tratarlo como un nivel aparte: si solo se probara
 * "capítulo" sin más, una ley con capítulo como único nivel se testearía DOS VECES (aquí y en
 * `classifyConRubrica`), y `resolverNivelDecisivo` no distingue duplicados de niveles genuinos.
 */
type GrupoCapitulo = { tituloNum: string; capitulos: Seccion[] }
const capituloAnidadoCache = new Map<string, GrupoCapitulo[]>()
async function gruposCapituloPorTitulo(bid: string): Promise<GrupoCapitulo[]> {
  if (capituloAnidadoCache.has(bid)) return capituloAnidadoCache.get(bid)!
  const bl = await bloquesBoe(bid)
  const { niveles } = parseBoeSectionsMultinivel(bl)
  const titulo = niveles.find((n: { tipo: string }) => n.tipo === 'titulo')
  const capitulo = niveles.find((n: { tipo: string }) => n.tipo === 'capitulo')
  const grupos: GrupoCapitulo[] = []
  if (titulo && capitulo) {
    for (const t of titulo.secciones as Seccion[]) {
      const propios = (capitulo.secciones as Seccion[]).filter((c) => c.from >= t.from && c.to <= t.to)
      if (propios.length) grupos.push({ tituloNum: t.num, capitulos: propios })
    }
  }
  capituloAnidadoCache.set(bid, grupos)
  return grupos
}

/**
 * classify de capítulo ANIDADO: cada grupo (capítulos de UN título) se enriquece con su
 * rúbrica y se clasifica por SEPARADO con `classifyByRubricaOnly` — nunca por número (ver el
 * porqué en `gruposCapituloPorTitulo`). Se fusionan los overflow de todos los grupos del tema
 * en un único resultado, con la MISMA forma que `classifyTitleBoundary` ({applicable, overflow})
 * para que el resto del pipeline (impresión, `resolverNivelDecisivo`) no distinga esta llamada
 * de las demás.
 */
async function classifyCapituloAnidado(bid: string, epigrafe: string, grupos: GrupoCapitulo[], arts: string[]) {
  const overflow: { article: number; titulo: string }[] = []
  let applicable = false
  for (const g of grupos) {
    const enriched: Seccion[] = []
    for (const s of g.capitulos) enriched.push({ ...s, rubrica: s.blockId ? await rubricaBoe(bid, s.blockId) : '' })
    const r = classifyByRubricaOnly(epigrafe, enriched, arts)
    if (r.applicable) applicable = true
    if (r.applicable && r.overflow.length) overflow.push(...r.overflow)
  }
  return { applicable, overflow }
}

// Niveles de Sección/Subsección (T-333), de más fino a más grueso. Independiente de
// `estructuraBoe` (que solo ve el nivel externo, título o capítulo) — ver el porqué en
// lib/laws/parseBoeSections.js (no comparte código con el poblador de `law_sections`).
const seccSubseccCache = new Map<string, { tipo: string; secciones: Seccion[] }[]>()
async function nivelesSeccSubseccBoe(bid: string): Promise<{ tipo: string; secciones: Seccion[] }[]> {
  if (seccSubseccCache.has(bid)) return seccSubseccCache.get(bid)!
  const bl = await bloquesBoe(bid)
  const { niveles } = parseSeccionesSubsecciones(bl)
  seccSubseccCache.set(bid, niveles)
  return niveles
}

// Rúbrica (materia) de un título: viene DENTRO del bloque. Fetch extra por bloque →
// solo para los títulos CANDIDATOS a overflow (bounded).
//
// La extracción vive en el núcleo puro (`rubricaVigente`) y NO se hace aquí con un
// match: un bloque del BOE trae todas sus versiones históricas de la más antigua a la
// vigente, así que el primer match devuelve la rúbrica DEROGADA. Este runner leía la
// de 1997 del Título VIII de la LECrim en vez de la de 2015 → la exención por materia
// no saltaba y el título salía como falso positivo. Ver rubricaVigente (26/07/2026).
const rubricaCache = new Map<string, string>()
async function rubricaBoe(bid: string, blockId: string): Promise<string> {
  const key = `${bid}#${blockId}`
  if (rubricaCache.has(key)) return rubricaCache.get(key)!
  let r = ''
  try {
    const xml = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, { headers: { Accept: 'application/xml' } })).text()
    r = rubricaVigente(xml)?.rubrica || ''
  } catch { r = '' }
  rubricaCache.set(key, r)
  return r
}

/** classify con SEGUNDA pasada: enriquece con rúbrica los títulos candidatos y re-clasifica. */
async function classifyConRubrica(bid: string, epigrafe: string, secs: Seccion[], arts: string[], law?: { shortName?: string; name?: string }) {
  const first = classifyTitleBoundary(epigrafe, secs, arts, law)
  if (!first.applicable || !first.overflow.length) return first
  // fetch rúbrica solo de los títulos señalados
  const candNums = new Set(first.overflow.map((o: { titulo: string }) => o.titulo))
  const enriched = secs.map((s) => ({ ...s }))
  for (const s of enriched) {
    if (candNums.has(s.num) && s.blockId && s.rubrica == null) s.rubrica = await rubricaBoe(bid, s.blockId)
  }
  return classifyTitleBoundary(epigrafe, enriched, arts, law)
}

/**
 * classify de Sección/Subsección — NO puede usar la estrategia de `classifyConRubrica`
 * (fetch solo de los "candidatos" que ya salieron por NÚMERO en una primera pasada).
 *
 * T-333: una Sección casi nunca se cita por número en la prosa de un epígrafe ("Sección
 * 2.ª" no es como se escribe un temario) — se cita por su MATERIA. Sin ninguna mención
 * numerada, `allowedTitles` sale vacío y, sin rúbrica AÚN poblada, `porRubrica` también
 * sale falso → `classifyTitleBoundary` devuelve `applicable:false` en la primera pasada, y
 * `classifyConRubrica` corta ahí (`if (!first.applicable...) return first`) sin llegar
 * JAMÁS a pedir ninguna rúbrica. Es el mismo problema que motivó T-223, un peldaño más
 * abajo: aquí no hay candidatos previos que estrechen el fetch, así que se piden TODAS las
 * rúbricas del nivel de una vez — acotado, porque son unas pocas secciones por tema, no
 * todo el catálogo.
 */
async function classifySeccSubsecc(bid: string, epigrafe: string, secs: Seccion[], arts: string[], law?: { shortName?: string; name?: string }) {
  const enriched = []
  for (const s of secs) {
    enriched.push({ ...s, rubrica: s.blockId ? await rubricaBoe(bid, s.blockId) : '' })
  }
  return classifyTitleBoundary(epigrafe, enriched, arts, law)
}

/**
 * Prueba TODOS los niveles disponibles (subsección, sección, y el nivel externo título/
 * capítulo) de más fino a más grueso, y deja que `resolverNivelDecisivo` elija cuál manda.
 * Devuelve también `nivelDecisivo` para poder imprimir CUÁL nivel encontró el hallazgo —
 * sin eso, un hallazgo de sección se leería como si fuera de título (confuso al adjudicar).
 */
async function classifyMultinivel(bid: string, epigrafe: string, secsExternas: Seccion[], arts: string[], law?: { shortName?: string; name?: string }) {
  const seccSubsecc = await nivelesSeccSubseccBoe(bid)
  const porNivel: { tipo: string; resultado: ReturnType<typeof classifyTitleBoundary> }[] = []
  for (const n of seccSubsecc) { // ya vienen de más fino (subsección) a más grueso (sección)
    porNivel.push({ tipo: n.tipo, resultado: await classifySeccSubsecc(bid, epigrafe, n.secciones, arts, law) })
  }
  // T-467: CAPÍTULO cuando vive DENTRO de un título — más fino que el nivel externo (título),
  // más grueso que sección/subsección (que anidan dentro del capítulo). AISLADO por título
  // padre y clasificado SOLO por rúbrica (`classifyCapituloAnidado`/`classifyByRubricaOnly`,
  // nunca `classifyTitleBoundary`): los números romanos de capítulo y título comparten
  // alfabeto y se reinician en cada título, así que comparar por NÚMERO produce falsos
  // positivos/exenciones por casualidad entre títulos distintos (medido en directo). Lista
  // vacía (capítulo = único nivel, o ley sin capítulos) → no añade nada, y el nivel externo ya
  // lo cubre — sin duplicar el test.
  const gruposCapitulo = await gruposCapituloPorTitulo(bid)
  if (gruposCapitulo.length) {
    porNivel.push({ tipo: 'capitulo', resultado: await classifyCapituloAnidado(bid, epigrafe, gruposCapitulo, arts) })
  }
  porNivel.push({ tipo: 'externo', resultado: await classifyConRubrica(bid, epigrafe, secsExternas, arts, law) })
  const decision = resolverNivelDecisivo(porNivel)
  return { decision, porNivel }
}

async function main() {
  const [pt, topicArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const forced = (process.argv.find((a) => a.startsWith('--scope=')) || '').replace('--scope=', '')
  if (!pt) { console.error('uso: sim-title-boundary.ts <position_type> [topic_number] [--scope=1,2,6]'); process.exit(2) }

  const temas = await sql`
    SELECT id, topic_number, bloque_number, title, epigrafe FROM topics
    WHERE position_type = ${pt} AND is_active = true ${topicArg ? sql`AND topic_number = ${Number(topicArg)}` : sql``}
    ORDER BY topic_number`

  // Un "✅ sin overflow" solo significa algo si de verdad se evaluó ALGO. Sin estos
  // contadores el runner devuelve el mismo verde cuando (a) el position_type no
  // existe —un typo basta—, (b) la ley no tiene id del BOE, o (c) el índice del BOE
  // no se pudo descargar. El caso (c) es el peligroso en una barrida bank-wide: si
  // el BOE limita el ritmo a mitad, TODAS las oposiciones restantes saldrían
  // "limpias" y serían indistinguibles de un banco sano. (T-121, 26/07/2026)
  let flagged = 0, evaluados = 0, sinBoeId = 0, sinArts = 0, fetchFail = 0, noAplicable = 0, nulosExpandidos = 0
  for (const t of temas) {
    const scopes = await sql`
      SELECT l.id AS law_id, l.short_name, l.name AS law_name, l.boe_url, ts.article_numbers,
             ts.article_numbers IS NULL AS es_null
        FROM topic_scope ts JOIN laws l ON l.id = ts.law_id WHERE ts.topic_id = ${t.id}`
    for (const s of scopes) {
      const bid = boeId(s.boe_url)
      if (!bid) { sinBoeId++; continue }
      // `article_numbers = NULL` significa TODA LA LEY, no "sin artículos". Tratarlo como
      // lista vacía hacía que el runner SALTARA justo los scopes con más papeletas de
      // sobre-inclusión: medido, 473 scopes NULL con id del BOE en el banco, y 58 de los 64
      // de `guardia_civil` — o sea que este runner opinaba sobre 6. Es el MISMO punto ciego
      // que ya se arregló hoy en el detector de sobre-inclusión y en su guarda determinista:
      // tres sitios, el mismo NULL. (26/07/2026)
      let arts: string[]
      if (forced && topicArg) arts = forced.split(',')
      else if (s.es_null) {
        arts = (await sql`
          SELECT article_number FROM articles WHERE law_id = ${s.law_id} AND is_active = true
        `).map((a) => String((a as { article_number: string }).article_number))
        nulosExpandidos++
      } else arts = s.article_numbers || []
      if (!arts.length) { sinArts++; continue }
      let secs: Seccion[]
      try { secs = await estructuraBoe(bid) } catch { fetchFail++; continue }
      // T-129: se pasa la LEY para atar los títulos del epígrafe a su norma y no aplicar
      // "(Constitución, Título VIII)" al Estatuto de Andalucía.
      // T-333: prueba TAMBIÉN sección/subsección, no solo el nivel externo.
      const law = { shortName: s.short_name, name: s.law_name }
      const { decision, porNivel } = await classifyMultinivel(bid, t.epigrafe, secs, arts, law)
      evaluados++
      if (!decision) { noAplicable++; continue }
      // Se imprimen TODOS los niveles con overflow, no solo el "decisivo" — MEDIDO (06/08,
      // T-333) que el nivel más fino no siempre acierta: un epígrafe que PARAFRASEA en corto
      // el tema de un capítulo ("Afiliación y cotización") en vez de citar literal la rúbrica
      // de cada sección puede fallar la coincidencia por rúbrica y parecer overflow cuando en
      // realidad es una referencia legítima, solo que corta (caso real: TRLGSS T15, Sección
      // 1.ª del Cap. III "Afiliación al sistema y altas, bajas..." casi no comparte frase con
      // el epígrafe "Afiliación y cotización" y sale como candidato aunque esos artículos SÍ
      // están en el scope corregido en producción). Por eso esto es SOLO adjudicación humana
      // —igual que T-223 concluyó para capítulos por rúbrica— y nunca un recorte automático.
      const niveladosConOverflow = porNivel.filter((p) => p.resultado.applicable && p.resultado.overflow.length)
      if (niveladosConOverflow.length) {
        flagged++
        console.log(`🔴 T${t.topic_number} (${t.title}) · ${s.short_name}`)
        for (const p of niveladosConOverflow) {
          // 'externo' = título, o capítulo cuando ES el único nivel de la ley (parseBoeSections
          // de nivel único). 'capitulo' (T-467) = capítulo ANIDADO dentro de un título — nivel
          // propio, con su propia etiqueta, para no leerlo como si fuera sección/subsección.
          const etiquetaNivel = p.tipo === 'externo' ? 'título/capítulo' : p.tipo === 'capitulo' ? 'capítulo' : p.tipo
          const etiquetaArticulo = etiquetaNivel === 'título/capítulo' ? 'Título'
            : etiquetaNivel === 'capítulo' ? 'Capítulo' : 'Sección/Subsección'
          const permitidos = (p.resultado as { allowedTitles?: string[] }).allowedTitles
          console.log(`   [nivel: ${etiquetaNivel}] permitidos: ${permitidos && permitidos.length ? permitidos.join(', ') : '(por rúbrica)'}`)
          for (const o of p.resultado.overflow) console.log(`     art.${o.article} → ${etiquetaArticulo} ${o.titulo} (NO en el epígrafe)`)
        }
      }
    }
  }

  // El veredicto ("¿significa algo este resultado?") lo decide el NÚCLEO PURO
  // `resumenBarrida` en lib/laws/scopeTitleBoundary.js, testeado aparte — aquí solo
  // se imprime. Sin esto, un typo en el position_type o un BOE que no responde
  // producían el mismo "✅ Sin overflow" que un banco sano (T-121).
  console.log(
    `\n📊 ${temas.length} tema(s) · ${evaluados} scope(s) evaluado(s)` +
    ` · ${nulosExpandidos} con scope NULL expandido a toda la ley` +
    ` · omitidos: ${sinBoeId} sin id BOE, ${sinArts} sin artículos, ${fetchFail} sin índice descargable` +
    ` · ${noAplicable} con epígrafe no mapeable a títulos`,
  )
  const veredicto = resumenBarrida({ temas: temas.length, evaluados, fetchFail, flagged })
  switch (veredicto.veredicto) {
    case 'sin_temas':
      console.log(`⚠️  0 temas activos para position_type='${pt}' — ¿typo? NO es un "sin overflow".`); break
    case 'nada_evaluado':
      console.log('⚠️  NADA evaluado — este resultado no dice nada sobre la salud del scope.'); break
    case 'incompleto':
      console.log(`⚠️  INCONCLUYENTE: ${fetchFail} scope(s) sin poder consultar el BOE. "Sin overflow" NO se puede afirmar.`); break
    case 'con_hallazgos':
      if (fetchFail) console.log(`⚠️  cobertura incompleta (${fetchFail} sin índice), pero los ${flagged} hallazgos SÍ son reales.`)
      console.log(`${flagged} overflow(s) detectado(s).`); break
    default:
      console.log('✅ Sin overflow de frontera de título.')
  }
  await sql.end()
  if (veredicto.exitCode) process.exit(veredicto.exitCode)
}
main().catch((e) => { console.error(e); process.exit(1) })
