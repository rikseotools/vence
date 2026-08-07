#!/usr/bin/env node
/**
 * proponer-plazas-boe.cjs — trae del BOE la cláusula que PRUEBA (o desmiente) nuestras plazas.
 *
 * POR QUÉ EXISTE (16/07/2026): 107 oposiciones publicadas afirman plazas sin ningún documento en el
 * corpus que las respalde. 31 de ellas citan un `BOE-A-…`, que es descargable por API. Visitarlas a
 * mano son 29 documentos; esto las encadena.
 *
 * QUÉ NO HACE: decidir. Medido el 16/07, el veredicto NO es automatizable con regex:
 *   · los patrones de prosa cazan la Resolución de la AGE 9 de 9 …
 *   · … y dan CERO en el RD 387/2026, que es una TABLA (el dato está en la estructura de columnas)
 *   · … y fallan en la Orden 1634/2026 de Madrid, que escribe el número en letra: «siete (7) plaza».
 * Así que esto EXTRAE candidatas y las pone delante; el veredicto se lee. Igual que la cita de un hito:
 * se elige leyendo, no con un regex (ver `verificar-convocatorias.md`).
 *
 * LA IDEA: usar NUESTRA cifra como ancla. Si `plazas_libres=1030` y el documento dice «será de 1.030
 * plazas, de las que 186 se reservarán», tenemos prueba Y veredicto (DENTRO) de una vez. Y si nuestra
 * cifra NO aparece por ningún lado, eso también es un hallazgo — de hecho es el más valioso: así se vio
 * que el 1.450 de auxiliar-administrativo-estado no salía de su documento (era de otro ciclo).
 *
 * Uso (desde la raíz):
 *   node scripts/proponer-plazas-boe.cjs            informe de todas
 *   node scripts/proponer-plazas-boe.cjs <slug>     solo una
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SOLO = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'boe-'))

/** El id BOE puede venir en boe_reference o en oep_decreto, mezclado con prosa. */
const boeId = (row) => (`${row.br || ''} ${row.od || ''}`.match(/BOE-A-\d{4}-\d+/) || [null])[0]

/**
 * Trae el documento del BOE y **lo CLONA al corpus** antes de analizarlo. Si ya está, lo lee de la BD
 * y no toca la red.
 *
 * ⚠️ La 1ª versión lo descargaba a un temporal y lo TIRABA: análisis hecho, documento perdido, y a la
 * siguiente pregunta vuelta a descargar. Regla de Manuel (16/07): *"no olvidarte de clonar todo lo que
 * caiga en tus manos para no tener que volver a descargar esos documentos, y ponerles la url y todos
 * los datos en la BD"*. El corpus no es un subproducto del análisis: es el objetivo.
 *
 * `curado=false` a propósito: está en el corpus pero NADIE lo ha leído todavía. `curado` significa
 * "lo he leído y respondo de él", y eso pasa cuando se aplica el veredicto, no al descargarlo. Esa es
 * justo la distinción que `curado` existe para hacer, así que `fuente` se queda en 'manual' (lo dirijo
 * yo) en vez de inventar un valor nuevo: la taxonomía de `fuente` es cerrada A PROPÓSITO y el CHECK me
 * frenó al intentarlo.
 */
async function traerYClonar(c, id, convocatoriaId) {
  const ya = (await c.query(
    `SELECT extracted_text texto, titulo, url FROM convocatoria_documentos
      WHERE convocatoria_id = $1 AND referencia = $2`, [convocatoriaId, id])).rows[0]
  if (ya) return { ...ya, deCache: true }

  const xml = await fetch(`https://www.boe.es/diario_boe/xml.php?id=${id}`).then((r) => r.text())
  const rel = (xml.match(/<url_pdf[^>]*>([^<]+)/) || [])[1]?.trim()
  const titulo = (xml.match(/<titulo[^>]*>([\s\S]*?)<\/titulo>/) || [])[1]
    ?.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
  const fecha = (xml.match(/<fecha_publicacion[^>]*>(\d{8})/) || [])[1]
  if (!rel) return { texto: '', titulo, url: null }
  const url = rel.startsWith('http') ? rel : `https://www.boe.es${rel}`

  const pdf = path.join(TMP, `${id}.pdf`)
  execSync(`curl -sL "${url}" -o "${pdf}"`)
  let texto = ''
  try { texto = execSync(`pdftotext -layout "${pdf}" -`, { maxBuffer: 64 * 1024 * 1024 }).toString() } catch { /* sin pdftotext */ }
  if (texto.trim().length < 200) return { texto: '', titulo, url }

  const hash = require('crypto').createHash('sha256').update(texto).digest('hex')
  const iso = fecha ? `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}` : null
  await c.query(
    `INSERT INTO convocatoria_documentos (convocatoria_id, tipo, url, titulo, boletin, referencia,
       fecha_publicacion, content_hash, extracted_text, fuente, fetched_at, curado)
     VALUES ($1,'otro',$2,$3,'BOE',$4,$5,$6,$7,'manual',now(),false)
     ON CONFLICT DO NOTHING`, [convocatoriaId, url, titulo || id, id, iso, hash, texto])
  return { texto, titulo, url, deCache: false }
}

/**
 * Las formas en que un boletín escribe la cifra (dígitos, con separador de millar y en letra, en los
 * dos géneros) las da el NÚCLEO COMPARTIDO. Aquí vivía una tercera copia de la tabla de numerales
 * —con `U[1] = 'un'` en vez de `'uno'`, y sin paridad con nada— y no era inocua (T-209, 30/07):
 *
 *   · «un» es también el ARTÍCULO indeterminado. Para una convocatoria de 1 plaza, esta herramienta
 *     daba por candidata cualquier «**un** plazo de veinte días» con la palabra «plaza» cerca: ruido
 *     con pinta de prueba, y es justo lo que no puede hacer algo que existe para verificar.
 *   · y a la vez se perdía «**una** plaza», que es como se escribe de verdad.
 *
 * Medido antes de unificar: de las 177 cifras de plazas del catálogo, 13 se escriben distinto con una
 * tabla o con la otra, y solo 3 convocatorias vigentes de oposición activa llevan una de ellas. La
 * apócope de los compuestos («treinta y un plazas») no aparece en NINGÚN documento donde el núcleo no
 * vea ya la cifra, así que no se añade: en un detector de evidencia, una forma más sin ganancia medida
 * es solo riesgo de verde falso. Detalle en `lib/convocatoria/cifraEnTexto.cjs`.
 */
const { formasDeCifra } = require('../lib/convocatoria/cifraEnTexto.cjs')
const formas = (n) => formasDeCifra(n)

/**
 * Fragmentos donde NUESTRA cifra aparece hablando de plazas.
 *
 * ⚠️ Un boletín está PLAGADO de números que no son plazas: «Ley 31/2022», «artículo 20.Dos.4»,
 * «BOE núm. 306», «Pág. 171». La 1ª versión buscó el 31 de auxiliar-archivos-estado y devolvió tres
 * fragmentos de la **Ley 31/2022** — ruido con pinta de prueba, que es lo peor que puede dar una
 * herramienta de verificación. Se excluyen las formas de CITA NORMATIVA y se exige que «plaza» esté
 * CERCA, no en el mismo párrafo largo.
 */
function candidatas(texto, plazas) {
  const x = texto.replace(/\s+/g, ' ')
  const out = []
  for (const f of formas(plazas)) {
    const esLetra = /[a-záéíóú]/i.test(f)
    // Dígitos: (?![\d./]) mata "31/2022" y (?<![\d./]) mata "…/31".
    // Letra: fronteras de palabra, y tolerante a acentos/mayúsculas («Ocho plazas», «veintiséis»).
    const re = esLetra
      ? new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[áa]/gi, '[áa]').replace(/[ée]/gi, '[ée]').replace(/[íi]/gi, '[íi]').replace(/[óo]/gi, '[óo]').replace(/[úu]/gi, '[úu]')}\\b`, 'gi')
      : new RegExp(`(?<![\\d./])${f.replace('.', '\\.')}(?![\\d./])`, 'g')
    for (const m of [...x.matchAll(re)]) {
      const antes = x.slice(Math.max(0, m.index - 60), m.index)
      // «Ley 31/2022», «Real Decreto 387/2026», «núm. 306», «artículo 31», «Pág. 171»
      if (!esLetra && /\b(ley|real decreto|decreto|orden|resoluci[óo]n|art[íi]culo|art\.|n[úu]m\.?|p[áa]g\.?|apartado)\s*$/i.test(antes)) continue
      const frag = x.slice(Math.max(0, m.index - 150), m.index + 200).trim()
      // «plaza» a menos de ~90 car. de la cifra: si está en la otra punta del párrafo, no la describe.
      const cerca = x.slice(Math.max(0, m.index - 90), m.index + 90)
      if (/plaza|vacante|puesto/i.test(cerca)) out.push(frag)
    }
  }
  return [...new Set(out)].slice(0, 3)
}

/** Señales del veredicto. NO deciden: acompañan a la cita para que la lectura sea rápida. */
function pistas(texto) {
  const x = texto.replace(/\s+/g, ' ')
  const p = []
  if (/de las que [\d.]+ se reservar|de las cuales [\d.]+ se reservar/i.test(x)) p.push('DENTRO? ("de las que N se reservarán")')
  if (/del total de las convocadas/i.test(x)) p.push('DENTRO? ("del total de las convocadas")')
  if (/se distribuir[áa]n en los siguientes turnos/i.test(x)) p.push('APARTE? ("se distribuirán en los siguientes turnos")')
  if (/Total\s+plazas/i.test(x)) p.push('TABLA: mira si «cupo general + reserva = Total plazas» → DENTRO')
  return p
}

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  const rows = (await c.query(`
    SELECT o.slug, cv.id cv_id, cv."año" anio, cv.plazas_libres l, cv.plazas_discapacidad d,
           cv.boe_reference br, cv.oep_decreto od
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE cv.is_current AND o.is_active AND cv.plazas_libres IS NOT NULL AND NOT cv.plazas_prevision
       -- Sin documento O con el cupo sin verificar. ⚠️ La 1ª versión solo miraba "sin documento" y una
       -- fila desaparecía del informe EN CUANTO se clonaba su documento — justo antes de poder leerla.
       -- El trabajo no es descargar: es verificar.
       AND (NOT EXISTS (SELECT 1 FROM convocatoria_documentos d WHERE d.convocatoria_id = cv.id)
            OR cv.plazas_discapacidad_incluidas IS NULL)
       ${SOLO ? 'AND o.slug = $1' : ''}
     ORDER BY cv.plazas_libres DESC`, SOLO ? [SOLO] : [])).rows
  const conBoe = rows.filter(boeId)
  console.log(`\n${conBoe.length} oposición(es) con referencia BOE y sin documento\n`)

  let clonados = 0
  for (const r of conBoe) {
    const id = boeId(r)
    // El documento se clona por CICLO: el mismo BOE puede probar dos oposiciones distintas y cada
    // convocatoria necesita su prueba colgando de ella.
    const doc = await traerYClonar(c, id, r.cv_id)
    if (doc.texto && !doc.deCache) clonados++
    console.log(`── ${r.slug}  (ciclo ${r.anio}, L=${r.l} D=${r.d ?? '—'})`)
    console.log(`   ${id}: ${(doc.titulo || '?').slice(0, 95)}`)
    console.log(`   ${doc.deCache ? '↷ ya en el corpus (sin tocar la red)' : doc.texto ? '⬇ clonado al corpus (curado=false: falta leerlo)' : ''}`)
    if (!doc.texto) { console.log('   ⚠️  sin texto extraíble\n'); continue }
    const cs = candidatas(doc.texto, r.l)
    if (!cs.length) {
      // El hallazgo MÁS valioso: afirmamos una cifra que su propio documento no dice.
      console.log(`   ❌ nuestras ${r.l} plazas NO aparecen en su documento → ¿de qué ciclo salió?`)
    } else {
      for (const f of cs) console.log(`   · "${f.slice(0, 200)}"`)
    }
    const p = pistas(doc.texto)
    if (p.length) console.log(`   pistas: ${p.join(' | ')}`)
    console.log(`   url: ${doc.url}\n`)
  }
  console.log(`═══ ${clonados} documento(s) nuevos en el corpus. Ya no hay que volver a descargarlos.`)
  await c.end()
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
