#!/usr/bin/env node
/**
 * poblar-law-sections-boe.cjs — puebla `law_sections` (títulos/capítulos) de una ley
 * desde la ESTRUCTURA OFICIAL del BOE consolidado (T-012).
 *
 * Uso:
 *   node scripts/poblar-law-sections-boe.cjs --law "LPRL"              # dry-run
 *   node scripts/poblar-law-sections-boe.cjs --law "LPRL" --apply      # inserta
 *   node scripts/poblar-law-sections-boe.cjs --sweep --limit 40        # dry-run de un lote
 *   node scripts/poblar-law-sections-boe.cjs --sweep --limit 40 --apply
 *
 * Fuente: API de datos abiertos del BOE. Requiere `Accept: application/xml`
 * (con json devuelve 400 — ver reference_extraccion_boletines_oficiales).
 *
 * CONVENCIÓN (verificada contra las 13 leyes ya pobladas, 20/07):
 *   - Se usa el nivel TÍTULO si la ley tiene títulos; si no, CAPÍTULO. Un solo nivel,
 *     sin solapes. Las 13 leyes existentes usan títulos con rúbrica "Título I. <nombre>".
 *
 * ROBUSTEZ (cada punto salió de un fallo real medido con --sweep, 4 iteraciones):
 *   - El nº de artículo se saca del <titulo> del bloque ("Artículo 10"), NUNCA del id:
 *     el BOE desambigua ids repetidos con sufijo (`a1-2` = artículo 10, no el 1). Fiarse
 *     del id daba rangos FALSOS que parecían cuadrar.
 *   - Ids de sección romanos Y textuales (ti / tpreliminar / tprimero).
 *   - Cada artículo se asigna al título precedente más cercano → maneja el anidamiento
 *     (un título con capítulos dentro recibe los artículos de sus capítulos).
 *   - Cruza cada rango con los artículos REALES en BD; si un rango queda vacío o hay
 *     solape, NO inserta esa ley (desalineación → revisión humana), nunca mete basura.
 *   - Idempotente. Nunca usa el "art 0 — Estructura" sintético.
 */
require('dotenv').config({ path: '.env.local' })
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })

const XML = { headers: { Accept: 'application/xml' } }
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const boeId = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]

// La lógica de parseo (qué es título/capítulo/artículo, de dónde sale el nº) vive en el
// módulo PURO lib/laws/parseBoeSections, testeado en __tests__/laws/parseBoeSections.
// Aquí solo queda lo que necesita red (fetch del índice + rúbrica).
const { parseBoeSections, validarSecciones } = require('../lib/laws/parseBoeSections')
const { bloqueVigente } = require('../lib/laws/boeBloqueVigente')
// Normas EUROPEAS (30/07/2026): la API de legislación consolidada es derecho español y
// responde «Identificador no válido» a un id DOUE, así que hasta hoy ninguna entraba aquí
// ([T-228]). Se leen del documento espejo que publica el BOE, con su parser propio.
const { parseDoueSections, lineasDesdeHtml, esIdDoue } = require('../lib/laws/parseDoueSections')

/** Rúbrica descriptiva de un título/capítulo: viene DENTRO de su bloque, tras el
 *  encabezado "TÍTULO I". Fetch extra por sección (por eso se hace solo al aplicar). */
async function rubrica(bid, blockId) {
  try {
    const xml = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, XML)).text()
    // Se reutiliza `bloqueVigente`: elige la <version> por fecha_vigencia y separa las
    // notas editoriales. Para un bloque de sección devuelve rubrica="TÍTULO III" y
    // texto="Del recurso de amparo constitucional", que es justo lo que queremos.
    //
    // POR QUÉ SE CAMBIÓ (26/07/2026, T-140). El regex anterior barría el cuerpo CRUDO del
    // bloque y capturaba hasta 140 caracteres sin punto, con dos consecuencias medidas en
    // la LOTC: (a) se pegaba la nota editorial —"Título III. Del recurso de amparo
    // constitucional **Ténganse en cuenta los artículos…**", "…constitucionales **Véase el
    // art**…"—, que se le muestra al usuario en /leyes/<slug>; y (b) peor, en el Título VI
    // devolvía "Del control previo de inconstitucionalidad", que es la rúbrica **DEROGADA**
    // (la vigente es "De la declaración sobre la constitucionalidad de los tratados
    // internacionales"), porque el cuerpo crudo trae todas las redacciones históricas.
    const b = bloqueVigente(xml)
    const primero = String((b && b.texto) || '').split('\n\n')[0].trim().replace(/\s+/g, ' ')
    if (primero && primero.length >= 3 && primero.length <= 200) return primero
    // Fallback al barrido crudo por si un bloque no trae <version> (no visto, pero el
    // poblador nunca debe quedarse sin rúbrica por una rareza del formato).
    const body = clean(xml)
    const m = body.match(/(?:CAP[IÍ]TULO|T[IÍ]TULO|LIBRO|PARTE)\s+[IVXLCDM]+\.?\s+([^.]{3,140})/i)
    return m ? m[1].trim().replace(/\s+/g, ' ') : null
  } catch { return null }
}

async function estructura(bid, { conRubrica = false } = {}) {
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, XML)).text()
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  const { tipo, secciones } = parseBoeSections(bl)
  const out = secciones.map((s) => ({ tipo, blockId: s.blockId, num: s.num, from: s.from, to: s.to }))
  if (conRubrica) for (const s of out) { s.rubrica = await rubrica(bid, s.blockId) }
  return out
}

/** Devuelve {ok, secs, motivo} tras validar contra los artículos reales de la ley. */
async function validar(lawId, secs) {
  // Solo I/O: contar los artículos REALES de cada rango. El criterio vive en el núcleo
  // puro (`validarSecciones`), que está testeado y explica por qué una sección vacía ya
  // no tumba la ley entera (T-064: eran artículos DEROGADOS, no un parser desalineado).
  const conConteo = []
  for (const s of secs) {
    const n = (await sql`SELECT count(*)::int c FROM articles WHERE law_id=${lawId} AND article_number ~ '^[0-9]+$' AND article_number::int BETWEEN ${s.from} AND ${s.to}`)[0].c
    conConteo.push({ ...s, arts: n })
  }
  const r = validarSecciones(conConteo)
  if (r.ok && r.vacias.length) {
    console.log(`     ↳ ${r.vacias.length} sección(es) sin artículos, descartadas (probable derogación): ${r.vacias.map((v) => `${v.num}:${v.from}-${v.to}`).join(', ')}`)
  }
  return r
}

async function insertar(lawId, secs, tipo) {
  const nombreTipo = tipo === 'titulo' ? 'Título' : 'Capítulo'
  // TODO-o-nada: una ley entra entera o no entra. Sin transacción, un slug repetido a
  // mitad dejaba la ley a medias (bug real: RD 137/1993 quedó con 1 de N secciones).
  return sql.begin(async (tx) => {
    let i = 0
    for (const s of secs) {
      const title = s.rubrica ? `${nombreTipo} ${s.num}. ${s.rubrica}` : `${nombreTipo} ${s.num}`
      // slug ÚNICO GLOBAL (law_sections_slug_key): incluye el law_id, si no "titulo-i"
      // colisiona en cuanto una 2ª ley tiene un "Título I".
      // El nº de sección NO es único en las leyes-código: los títulos REINICIAN por libro
      // ("Libro I › Título I", "Libro II › Título I"), así que el Código Civil tiene cuatro
      // "Título I" y el slug colisionaba contra `law_sections_slug_key` (T-064, 26/07). Se
      // desempata con el `blockId` del BOE, que sí es único dentro de la ley (`tprimero`,
      // `tprimero-2`…) y además deja el slug estable entre ejecuciones — cosa que un índice
      // posicional no garantiza si el índice del BOE cambia de orden.
      const sufijo = s.blockId ? `-${String(s.blockId).toLowerCase()}` : ''
      const slug = `${lawId.slice(0, 8)}-${tipo}-${String(s.num).toLowerCase()}${sufijo}`
      await tx`INSERT INTO law_sections (law_id, section_type, section_number, title, description, article_range_start, article_range_end, slug, order_position, is_active, created_at, updated_at)
        VALUES (${lawId}, ${tipo}, ${s.num}, ${title}, NULL, ${s.from}, ${s.to}, ${slug}, ${++i}, true, now(), now())`
    }
    return i
  })
}

/**
 * Estructura de una norma EUROPEA desde el documento espejo del BOE.
 *
 * A diferencia del consolidado español, aquí no hay índice con bloques: se parsea el texto
 * del documento. Por eso el parser es desconfiado (rechaza si detecta índice duplicado o
 * artículos que retroceden) y por eso el resultado pasa igualmente por `validar()` contra
 * los artículos que existen de verdad en la base de datos.
 *
 * La rúbrica viene en el mismo recorrido, así que no hace falta el fetch por sección que sí
 * necesita el camino del BOE.
 */
async function estructuraDoue(did) {
  const html = await (await fetch(`https://www.boe.es/buscar/doc.php?id=${did}`)).text()
  const { tipo, secciones, motivo } = parseDoueSections(lineasDesdeHtml(html))
  if (motivo) return { motivo, secs: [] }
  return { secs: secciones.map((s) => ({ tipo, blockId: null, num: s.num, from: s.from, to: s.to, rubrica: s.rubrica })) }
}

async function procesarLey(l, { apply }) {
  const bid = boeId(l.boe_url)
  const did = bid ? null : esIdDoue(l.boe_url)
  if (!bid && !did) return { slug: l.short_name, estado: 'no_boe' }
  const ya = (await sql`SELECT count(*)::int n FROM law_sections WHERE law_id=${l.id}`)[0].n
  if (ya > 0) return { slug: l.short_name, estado: 'ya_poblada', n: ya }
  let secs
  if (did) {
    const r = await estructuraDoue(did)
    if (r.motivo) return { slug: l.short_name, estado: 'rechazada', motivo: r.motivo, n: 0 }
    secs = r.secs
  } else {
    secs = await estructura(bid, { conRubrica: apply })
  }
  const v = await validar(l.id, secs)
  if (!v.ok) return { slug: l.short_name, estado: 'rechazada', motivo: v.motivo, n: secs.length }
  if (!apply) return { slug: l.short_name, estado: 'lista', n: secs.length, tipo: secs[0].tipo }
  // ⚠️ `v.secs`, NO `secs` (arreglado 30/07/2026). Se insertaban TODAS las secciones,
  // incluidas las que el validador acababa de descartar por no tener artículos: el propio
  // script imprimía «1 sección(es) sin artículos, descartadas» y acto seguido la metía. El
  // resultado en pantalla es un filtro por capítulo que existe y devuelve cero preguntas
  // (el capítulo derogado del RD 208/1996, por ejemplo). Validar y luego ignorar lo
  // validado deja el mensaje diciendo una cosa y la base de datos otra.
  const n = await insertar(l.id, v.secs, v.secs[0].tipo)
  return { slug: l.short_name, estado: 'insertada', n, tipo: secs[0].tipo }
}

;(async () => {
  const apply = process.argv.includes('--apply')
  const sweep = process.argv.includes('--sweep')
  const limit = parseInt(process.argv[process.argv.indexOf('--limit') + 1] || '40', 10)

  let leyes
  if (sweep) {
    leyes = await sql`
      SELECT DISTINCT l.short_name, l.id, l.boe_url, (SELECT count(*)::int FROM articles a WHERE a.law_id=l.id) arts
      FROM laws l JOIN topic_scope ts ON ts.law_id=l.id JOIN topics t ON t.id=ts.topic_id AND t.is_active=true
      WHERE l.is_active=true AND coalesce(l.is_virtual,false)=false AND l.boe_url ~ 'BOE-A-'
        -- Umbral 5, antes 20 (T-227, 28/07/2026). El >=20 daba por hecho que una ley corta
        -- no tiene estructura, y NO es verdad: al probar una a una las 84 leyes cortas que
        -- el barrido nunca miraba, 17 tenían capítulos o títulos de verdad — la más pequeña,
        -- el RD 127/2015, con 6 artículos y 3 capítulos. Se quedaban fuera sin fallar ni
        -- aparecer en ningún informe, que es la peor forma de quedarse fuera.
        -- El 5 no protege de nada que no proteja ya el validador (rangos con artículos
        -- reales, sin solapes, nunca inserta basura): solo evita bajarse del BOE leyes de
        -- 2-3 artículos donde el resultado no podría ser útil (el botón de Títulos exige
        -- >=2 secciones). Es ahorro de peticiones, no una salvaguarda.
        AND (SELECT count(*) FROM articles a WHERE a.law_id=l.id) >= 5
        AND (SELECT count(*) FROM law_sections s WHERE s.law_id=l.id) = 0
      ORDER BY arts DESC LIMIT ${limit}`
  } else {
    const law = process.argv[process.argv.indexOf('--law') + 1] || ''
    if (!law) { console.error('uso: --law "<short_name>" [--apply]  |  --sweep --limit N [--apply]'); process.exit(1) }
    leyes = await sql`SELECT short_name, id, boe_url FROM laws WHERE short_name=${law} AND is_active=true`
    if (!leyes.length) { console.error(`ley no encontrada: ${law}`); process.exit(1) }
  }

  const cont = { insertada: 0, lista: 0, rechazada: 0, ya_poblada: 0, no_boe: 0 }
  for (const l of leyes) {
    const r = await procesarLey(l, { apply }).catch((e) => ({ slug: l.short_name, estado: 'error', motivo: e.message.slice(0, 40) }))
    cont[r.estado] = (cont[r.estado] || 0) + 1
    const tag = { insertada: '✅', lista: '·', rechazada: '⚠️', ya_poblada: '=', no_boe: '×', error: '✗' }[r.estado] || '?'
    console.log(`  ${tag} ${String(r.slug).slice(0, 44).padEnd(46)} ${r.estado}${r.n != null ? ` (${r.n}${r.tipo ? ' ' + r.tipo : ''})` : ''}${r.motivo ? ' — ' + r.motivo : ''}`)
  }
  console.log('\nresumen:', JSON.stringify(cont))
  await sql.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
