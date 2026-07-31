#!/usr/bin/env node
/**
 * Construye el INPUT de la auditoría ciega (Paso 7 del manual
 * `docs/maintenance/generar-preguntas-con-ia.md`) para un batch generado.
 *
 * Uso:
 *   node scripts/auditar-batch-input.cjs <batch_id> <salida.json> [--split N]
 *
 * Vuelca `{preguntas: [...], articulos_referenciados: [...]}`:
 *
 *   - `preguntas`: enunciado, opciones, clave y explicación de cada pregunta
 *     del batch, con el texto LITERAL de su artículo.
 *   - `articulos_referenciados`: los artículos que las EXPLICACIONES citan por
 *     su número ("conforme al artículo 21.4", "es el supuesto del art. 120"),
 *     resueltos dentro de las mismas leyes que toca el batch.
 *
 * Por qué lo segundo, que es la razón de ser de este script: si el auditor no
 * tiene el artículo al que remite un bullet, no puede verificarlo y lo devuelve
 * como ISSUE. Pasó el 25/07/2026 dos veces en el mismo día —batch
 * `gen_atc_t208_2026-07-25` (arts. 120, 134 y 101.3) y el de tasas del T215
 * (arts. 7.3, 17, 21.4 y 24)— y las SIETE remisiones eran exactas: ruido puro,
 * una ronda de reparación tirada cada vez. La regla estaba escrita en el manual
 * desde la primera; lo que fallaba era depender de acordarse de aplicarla.
 *
 * `--split N` parte la salida en N ficheros (`<salida>.1.json`, …) para repartir
 * el lote entre auditores independientes sin que se vean entre ellos.
 */
const fs = require('fs')
const path = require('path')
// `postgres` del paquete raíz, como el resto de scripts (está en package.json:dependencies).
// NO resolver contra `backend/node_modules` por ruta absoluta: el CI no instala las deps del
// backend, así que el test que importa este módulo (numerosCitados) tumbaba la suite unit
// entera en GHA — y con ella el gate de CI que exige el deploy. Fallaba igual en cualquier
// worktree recién creado sin el symlink de `backend/node_modules`.
const pg = require('postgres')

/**
 * Artículos citados por una explicación, **de la ley de la propia pregunta**.
 *
 *   "artículo 21.4", "art. 120", "arts. 16 y 17" → ['21','120','16','17']
 *
 * Descarta las citas que nombran OTRA norma a continuación ("el apartado 2 del
 * artículo 4 de la Ley 10/2010…"): resolverlas contra la ley de la pregunta
 * adjunta un artículo que no tiene nada que ver. Pasó en el batch T204, donde
 * una cita a la Ley 10/2010 de blanqueo arrastró el art. 4 de la Ley General
 * Tributaria y el auditor avisó de que el adjunto no pintaba nada.
 *
 * "de este Texto Refundido" y "de esta ley" SÍ pasan: remiten al mismo cuerpo.
 */
// OJO con la variante SIN nombre propio: "del artículo 31 de la CITADA Ley Orgánica".
// El guardarraíl original exigía que tras "de la" viniera ya "Ley|Real Decreto|…", así que
// "de la citada Ley Orgánica" NO casaba y la cita se resolvía contra la ley de la pregunta:
// el auditor recibía el art. 31 de la Ley 19/2013 (régimen sancionador de altos cargos) como
// si fuera el art. 31 de la LOPDGDD (registro de actividades de tratamiento). Un artículo
// HOMÓNIMO POR NÚMERO de otra materia es peor que no adjuntar nada: da falsa confianza.
// Lo cazaron las DOS auditorías ciegas del lote gen_l19_6bis_20260726 (26/07/2026).
const OTRA_NORMA = /^\s*(?:,\s*)?(?:de (?:la|el)|del|de las|de los)\s+(?:citad[ao]\s+|mencionad[ao]\s+|referid[ao]\s+|propi[ao]\s+|misma\s+)?(?:Ley|Real Decreto|Reglamento|Decreto|Orden|Directiva|Constituci[óo]n|Texto Refundido|Estatuto|C[óo]digo)\b/i

// …pero "del Reglamento" A SECAS remite al MISMO cuerpo **cuando la norma del lote ES ella misma
// un reglamento** (todo Real Decreto que aprueba uno). Sin esa excepción, "el artículo 41 del
// Reglamento" se descartaba como cita externa y el auditor se quedaba SIN el artículo que la
// viñeta invocaba — justo lo que este anexo existe para dar. Medido el 31/07/2026 en
// `gen_rd203_t331_2026-07-31`: adjuntó 7 de los 8 citados, y el que faltó (41) era el único
// escrito así; los arts. 42 y 47 se salvaron de rebote porque otras viñetas los nombraban sin
// ese inciso, o sea que el fallo estaba tapado por la redundancia.
//
// ⚠️ LA CONDICIÓN «la ley del lote es un reglamento» NO ES ADORNO, y costó un falso positivo el
// MISMO día: la primera versión aplicaba la excepción siempre, y el lote siguiente
// (`gen_lopdgdd_t115_2026-07-31`, sobre la LO 3/2018) cita a cada paso "el artículo 60 del
// Reglamento" refiriéndose al **Reglamento (UE) 2016/679**. Resultado: se adjuntaron los arts.
// 56, 60 y 65 de la LEY ORGÁNICA —"Acción exterior", "Admisión a trámite de las reclamaciones"—
// como si fueran los citados. Es exactamente el fallo del artículo HOMÓNIMO que esta guarda
// existe para impedir, y adjuntar el artículo equivocado es PEOR que no adjuntar ninguno.
//
// Doble corte, por tanto: (1) la ley del lote tiene que ser un reglamento, y (2) el reglamento
// citado tiene que venir SIN IDENTIFICAR. En cuanto se identifica —"del Reglamento (UE)
// 2016/679", "del Reglamento General de Protección de Datos", "del Reglamento de ejecución",
// "del Reglamento n.º 1/2005", "del Reglamento delegado"— cuenta como otra norma siempre.
const REGLAMENTO_SIN_IDENTIFICAR =
  /^\s*(?:,\s*)?(?:de (?:la|el)|del|de las|de los)\s+(?:citad[ao]\s+|mencionad[ao]\s+|referid[ao]\s+|propi[ao]\s+|misma\s+)?Reglamento\b(?!\s*(?:\(|n[.ºo°]|n[úu]m|\d|de (?:ejecuci[óo]n|desarrollo|la|los|las)|delegado|general|europeo|comunitario))/i

/**
 * `leyEsReglamento`: si la norma del lote es ella misma un reglamento. Se deriva del NOMBRE de
 * la ley (`esLeyReglamento`), no se adivina. Por defecto **false** = comportamiento estricto de
 * siempre: ante la duda, no adjuntar.
 */
function numerosCitados(texto, { leyEsReglamento = false } = {}) {
  const t = String(texto || '')
  const out = new Set()
  // El sufijo de REFORMA forma parte del número: de "artículo 75 bis.1" hay que sacar
  // "75 bis", no "75". Sin él se adjuntaba el artículo 75 —otro precepto— y el auditor,
  // sin el texto que la glosa citaba, devolvía un ISSUE inventado: pasó el 26/07/2026 con
  // el art. 75 bis.1 de la LBRL, cuya glosa era exacta.
  const re = /\b(?:art[íi]culos?|arts?\.)\s*([0-9]+(?:\s*(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\.[0-9]+)*(?:\s*(?:,|\by\b|\be\b)\s*[0-9]+(?:\s*(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\.[0-9]+)*)*)/gi
  for (const m of t.matchAll(re)) {
    const sigue = t.slice(m.index + m[0].length, m.index + m[0].length + 40)
    const mismoCuerpo = leyEsReglamento && REGLAMENTO_SIN_IDENTIFICAR.test(sigue)
    if (OTRA_NORMA.test(sigue) && !mismoCuerpo) continue
    // El separador debe ir con frontera de palabra: partir por una "e" suelta
    // troceaba "127 octies" en "127 octi" + "s".
    for (const n of m[1].split(/\s*(?:,|\by\b|\be\b)\s*/)) {
      // "75 bis.1" → "75 bis" (el apartado se descarta, el sufijo NO).
      const base = n.split('.')[0].trim().replace(/\s+/g, ' ')
      if (base) out.add(base)
    }
  }
  return [...out]
}

/**
 * ¿La norma del lote es ella misma un reglamento? Se mira el NOMBRE oficial: un Real Decreto que
 * "aprueba el Reglamento de…" lo es; una Ley Orgánica no, por mucho que sus explicaciones citen
 * el Reglamento (UE) 2016/679 a cada paso.
 */
function esLeyReglamento(nombreLey) {
  return /\breglamento\b/i.test(String(nombreLey || ''))
}

module.exports = { numerosCitados, esLeyReglamento }
if (require.main !== module) return


const args = process.argv.slice(2)
const [BATCH, OUT] = args.filter((a) => !a.startsWith('--'))
const splitIdx = args.indexOf('--split')
const SPLIT = splitIdx >= 0 ? parseInt(args[splitIdx + 1], 10) : 1
if (!BATCH || !OUT) {
  console.error('uso: node scripts/auditar-batch-input.cjs <batch_id> <salida.json> [--split N]')
  process.exit(1)
}

const url = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })


;(async () => {
  const Q = await s`
    SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
           q.explanation, a.article_number, a.title AS article_title, a.content, a.law_id, l.short_name AS ley,
           l.name AS ley_nombre
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE ${BATCH} = ANY(q.tags)
    ORDER BY a.law_id, a.article_number`
  if (!Q.length) { console.error(`❌ el batch ${BATCH} no tiene preguntas`); process.exit(2) }

  const preguntas = Q.map((q) => ({
    id: q.id,
    ley: q.ley,
    articulo: q.article_number,
    titulo_articulo: q.article_title,
    texto_articulo: q.content,
    enunciado: q.question_text,
    opciones: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
    clave: 'ABCD'[q.correct_option],
    explicacion: q.explanation,
  }))

  // Artículos que citan las explicaciones. OJO: se calculan POR TROZO, no sobre
  // el batch entero. Cada auditor solo ve su fichero, así que un artículo que
  // viaja en la otra mitad para él no existe — y ese descuido es exactamente el
  // que produjo los avisos de "no verificable" del 25/07.
  const idx = new Map(Q.map((q, i) => [preguntas[i].id, q]))
  const cache = new Map()
  const traer = async (law_id, n) => {
    const k = `${law_id}|${n}`
    if (!cache.has(k)) {
      const r = await s`SELECT a.article_number, a.title, a.content, l.short_name AS ley
                        FROM articles a JOIN laws l ON l.id = a.law_id
                        WHERE a.law_id = ${law_id} AND a.article_number = ${n}`
      cache.set(k, r.length ? { ley: r[0].ley, articulo: r[0].article_number, titulo: r[0].title, texto: r[0].content } : null)
    }
    return cache.get(k)
  }

  const trozos = SPLIT > 1
    ? Array.from({ length: SPLIT }, (_, i) => preguntas.filter((_, j) => j % SPLIT === i))
    : [preguntas]

  let totalRef = 0
  for (const [i, p] of trozos.entries()) {
    const enEsteTrozo = new Set(p.map((x) => `${idx.get(x.id).law_id}|${x.articulo}`))
    const refs = []
    const vistos = new Set()
    for (const x of p) {
      const law_id = idx.get(x.id).law_id
      for (const n of numerosCitados(x.explicacion, { leyEsReglamento: esLeyReglamento(idx.get(x.id).ley_nombre) })) {
        const k = `${law_id}|${n}`
        if (enEsteTrozo.has(k) || vistos.has(k)) continue
        vistos.add(k)
        const art = await traer(law_id, n)
        if (art) refs.push(art)
      }
    }
    const file = SPLIT > 1 ? OUT.replace(/\.json$/, `.${i + 1}.json`) : OUT
    fs.writeFileSync(file, JSON.stringify({ preguntas: p, articulos_referenciados: refs }, null, 1))
    console.log(`   ${file} — ${p.length} preguntas + ${refs.length} artículo(s) referenciado(s)`)
    totalRef += refs.length
  }
  console.log(`\n✅ ${preguntas.length} preguntas · ${totalRef} adjunto(s) de referencia en total`)
  if (!totalRef) console.log('   (ninguna explicación remite a un artículo que falte en su trozo)')
  await s.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
