#!/usr/bin/env node
/**
 * Importador de las normas PROPIAS de la Universidad de Almería (tarea T-044).
 *
 * Todas son PDF: la UAL no tiene API, el BOUAL solo publica boletines mensuales que agrupan
 * muchas disposiciones, y su página de normativas es un buscador que exige JavaScript. Las
 * URLs de aquí apuntan al documento directo, que es lo único que funciona.
 * Recon y gotchas por documento: `docs/roadmap/build-almeria-aux-admin.md`.
 *
 * Extracción con `pdftotext -layout` (igual que `verify-law-boa.cjs`): sin `-layout` el flujo
 * de columnas saca los apartados desordenados y los pega al artículo anterior.
 *
 * ⚠️ Gotchas respetados:
 *  · T22-C: se usa la URL de la versión de 14/02/2023. La que devuelven los buscadores
 *    (`application/files/7716/2339/8777/…`) es la de 29/10/2019 — mismo articulado, texto
 *    distinto: importarla mete contenido caducado SIN dar ningún error.
 *  · T23: el PDF es la reproducción del BOJA → hay que quitar la maquetación repetida
 *    (cabecera "BOJA Número 40…", "Boletín Oficial de la Junta de Andalucía", depósito legal,
 *    y el código de verificación numérico suelto).
 *  · T22-A y T22-B NO tienen articulado formal (apartados numerados de política) → se importan
 *    como contenedor editorial y NO se trocean con el patrón "Artículo N".
 *
 * Uso:
 *   node scripts/oposiciones/importar-normas-ual.cjs --list
 *   node scripts/oposiciones/importar-normas-ual.cjs <clave> [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

// tema → documento. `articulado:false` = norma sin "Artículo N" (se importa entera).
const NORMAS = {
  t23: {
    tema: 23, articulado: true,
    short_name: 'Regl. Admón. Electrónica UAL',
    name: 'Reglamento de Administración Electrónica de la Universidad de Almería',
    slug: 'reglamento-administracion-electronica-ual',
    url: 'https://www.ual.es/application/files/5216/2339/8556/Reglamento_Administracion_Electronica.pdf',
    fuente: 'BOJA núm. 40, de 2 de marzo de 2021 (Acuerdo del Consejo de Gobierno de 23/02/2021)',
    esperados: 30,
  },
  t12: {
    tema: 12, articulado: true,
    short_name: 'Regl. Concursos Cuerpos Docentes UAL',
    name: 'Reglamento de la Universidad de Almería que regula el procedimiento de los concursos de acceso a los cuerpos docentes universitarios',
    slug: 'reglamento-concursos-cuerpos-docentes-ual',
    url: 'https://www.ual.es/application/files/8217/1110/9514/Normativa_Concurso_Cuerpos_Docentes_Universitarios.pdf',
    fuente: 'Consejo de Gobierno de 21/03/2024 (deroga el de 03/05/2019)',
    esperados: 10,
  },
  t15: {
    tema: 15, articulado: true,
    short_name: 'Regl. Cartas de Servicios UAL',
    name: 'Reglamento de Cartas de Servicios de la Universidad de Almería',
    slug: 'reglamento-cartas-servicios-ual',
    url: 'https://www.ual.es/application/files/4816/1337/4305/spec_reglamento_cartas_de_servicios_2019.pdf',
    fuente: 'Consejo de Gobierno de 03/05/2019',
    esperados: 10,
  },
  t19: {
    tema: 19, articulado: true,
    short_name: 'Normativa Permanencia UAL',
    name: 'Normativa de permanencia de estudiantes en enseñanzas oficiales de la Universidad de Almería',
    slug: 'normativa-permanencia-ual',
    url: 'https://www.ual.es/download_file/162840/83587',
    fuente: 'Consejo de Gobierno de 19/06/2025 y Consejo Social de 23/06/2025',
    esperados: 12,
  },
  t11: {
    tema: 11, modo: 'articulo',
    short_name: 'Bases Ejecución Presupuesto 2026 UAL',
    name: 'Bases de Ejecución Presupuestaria del Presupuesto de la Universidad de Almería para el ejercicio 2026',
    slug: 'bases-ejecucion-presupuesto-2026-ual',
    url: 'https://www.ual.es/application/files/5717/6778/0854/Bases_de_Ejecucion_Presupuesto_2026.pdf',
    fuente: 'Presupuesto UAL 2026 (Consejo Social); el PDF es la sección II del documento presupuestario',
    esperados: 104,
  },
  t22a: {
    // Documento de POLÍTICA: apartados numerados 1-15, sin "Artículo N".
    tema: 22, modo: 'apartado',
    short_name: 'Política Seguridad Información UAL',
    name: 'Política de Seguridad de la Información de la Universidad de Almería',
    slug: 'politica-seguridad-informacion-ual',
    url: 'https://www.ual.es/download_file/51129/78527',
    fuente: 'Consejo de Gobierno de 05/11/2025',
    esperados: 15,
  },
  t22b: {
    // Normas de uso: apartados numerados 1-13 (los 10-13 son disposiciones), sin "Artículo N".
    tema: 22, modo: 'apartado',
    short_name: 'Normas Uso Sistemas Información UAL',
    name: 'Normas de Uso de los Sistemas de Información de la Universidad de Almería',
    slug: 'normas-uso-sistemas-informacion-ual',
    url: 'https://www.ual.es/download_file/38256/78527',
    fuente: 'Consejo de Gobierno de 15/07/2024',
    esperados: 13,
  },
  // ⚠️ Las TRES resoluciones de matrícula son ANUALES: se sustituyen cada curso. Al
  // reimportarlas para 2027-28 hay que crear la norma del curso nuevo, no editar esta.
  t18a: {
    tema: 18, modo: 'articulo',
    short_name: 'Res. Matrícula Grado y Máster UAL 2026-27',
    name: 'Resolución del Rectorado de la Universidad de Almería sobre matrícula oficial en estudios de Grado y Máster para el curso académico 2026-27',
    slug: 'resolucion-matricula-grado-master-ual-2026-27',
    url: 'https://www.ual.es/download_file/bc5839b4-6994-4362-9d8e-92518ba6b145/83587',
    fuente: 'Resolución del Rector de 10/06/2026 (curso 2026-27)',
    esperados: 38,
  },
  t18b: {
    tema: 18, modo: 'articulo',
    short_name: 'Res. Matrícula Doctorado UAL 2026-27',
    name: 'Resolución del Rectorado de la Universidad de Almería sobre matrícula oficial en estudios de Doctorado para el curso académico 2026-27',
    slug: 'resolucion-matricula-doctorado-ual-2026-27',
    url: 'https://www.ual.es/download_file/9b678bf5-5f44-4661-bf33-9d763c617818/83587',
    fuente: 'Resolución del Rector de 09/06/2026 (curso 2026-27)',
    esperados: 15,
  },
  t18c: {
    tema: 18, modo: 'articulo',
    short_name: 'Res. Aspectos Económicos Matrícula UAL 2026-27',
    name: 'Resolución del Rectorado de la Universidad de Almería que regula los aspectos económicos de las matrículas en estudios oficiales para el curso académico 2026-27',
    slug: 'resolucion-aspectos-economicos-matricula-ual-2026-27',
    url: 'https://www.ual.es/download_file/3ffafecd-64be-41f7-b0c2-960c354022f8/83587',
    fuente: 'Resolución del Rector de 10/06/2026, al amparo del Decreto 98/2023 modificado por el Decreto 142/2025 (curso 2026-27)',
    esperados: 21,
  },
  t14: {
    tema: 14, modo: 'articulo',
    short_name: 'Regl. Provisión Puestos PTGAS UAL',
    name: 'Reglamento de provisión de puestos de trabajo del Personal Técnico, de Gestión y de Administración y Servicios funcionario de la Universidad de Almería',
    slug: 'reglamento-provision-puestos-ptgas-ual',
    url: 'https://www.juntadeandalucia.es/boja/2025/244/BOJA25-244-00021-16984-01_00330584.pdf',
    fuente: 'BOJA núm. 244 de 19/12/2025 (Consejo de Gobierno de 12/12/2025)',
    // ⚠️ Existe una modificación posterior: Resolución de 1/06/2026 (BOJA núm. 108, de 8/06/2026,
    // disposición 28). VERIFICADA leyendo el PDF firmado: es un "donde dice / debe decir" que
    // afecta SOLO al apartado 1.3.1 «Titulación Académica Oficial» del ANEXO I (Baremo).
    // El ARTICULADO (arts. 1-27) NO se toca → el texto base es válido tal cual.
    // Si algún día se importa el baremo como contenido, hay que aplicarle esa corrección.
    esperados: 27,
  },
  t22c: {
    tema: 22, articulado: true,
    short_name: 'Normas Protección Datos Concurrencia UAL',
    name: 'Normas de Información en materia de Protección de Datos en los Procesos de Concurrencia Competitiva en la Universidad de Almería',
    slug: 'normas-proteccion-datos-concurrencia-ual',
    // ⚠️ NO usar application/files/7716/2339/8777/… → esa es la versión de 2019, superada.
    url: 'https://www.ual.es/download_file/38253/78527',
    fuente: 'Consejo de Gobierno de 14/02/2023',
    // El recon dijo 5 artículos, pero el PDF vigente tiene 8 (cabeceras verificadas una a
    // una: Objeto, Ámbito, Tratamiento de datos, Publicación de actos, Forma de publicación,
    // Periodo de publicación, Prohibición de difusión, Convocatorias de acción social).
    esperados: 8,
  },
}

// Maquetación a tirar: cabeceras/pies de boletín y códigos de verificación sueltos.
const BASURA = [
  /^Boletín Oficial de la Junta de Andalucía$/i,
  /^BOJA\s+Número\s+\d+/i,
  /^Depósito Legal:/i,
  /^\d{8,}$/,                       // código de verificación numérico suelto
  /^Página\s+núm\.?\s*\d+$/i,
  /^\d+\s*$/,                       // número de página suelto
]

async function bajarPdf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('la respuesta no es un PDF')
  const tmp = path.join(os.tmpdir(), `ual-${process.pid}-${Date.now()}.pdf`)
  fs.writeFileSync(tmp, buf)
  try {
    return execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', '-layout', tmp, '-'],
      { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  } finally { fs.unlinkSync(tmp) }
}

// Líneas del ÍNDICE del PDF: "Artículo 1. Objeto ............ 3". Sin filtrarlas, el
// troceador las toma por cabeceras reales y fabrica artículos FANTASMA con cuerpo vacío
// (medido: el Regl. de Cartas de Servicios daba 20 artículos en vez de 10, 6 de ellos vacíos).
const ES_INDICE = (l) => /\.{4,}/.test(l) || /\.\s*\.\s*\./.test(l)

const limpiar = (txt) => txt.split('\n')
  .map((l) => l.replace(/\s+$/, '').replace(/^\s{2,}/, ''))
  .filter((l) => !BASURA.some((re) => re.test(l.trim())) && !ES_INDICE(l))
  .join('\n').replace(/\n{3,}/g, '\n\n')

/**
 * Trocea por APARTADO numerado ("1. INTRODUCCIÓN") en vez de por artículo. Lo usan las normas
 * de política de la UAL (Política de Seguridad, Normas de Uso), que NO tienen articulado
 * formal. El índice del PDF ya se ha filtrado antes por los puntos de relleno, así que aquí
 * solo llegan las cabeceras del cuerpo.
 */
function trocearApartados(txt) {
  const RE = /^\s*(\d{1,2})\.\s+([A-ZÁÉÍÓÚÑ][^\n]*)$/
  const arts = []
  let actual = null
  let siguiente = 1   // solo abre apartado el número que toca (1, luego 2, luego 3…)
  for (const l of txt.split('\n')) {
    const m = l.match(RE)
    // Evita que un "1." de una lista interna abra un apartado falso a mitad de un bloque.
    if (m && parseInt(m[1]) === siguiente) {
      if (actual) arts.push(actual)
      actual = { num: m[1], titulo: m[2].replace(/\s*\.+\s*$/, '').trim(), cuerpo: [] }
      siguiente++
    } else if (actual) actual.cuerpo.push(l)
  }
  if (actual) arts.push(actual)
  return arts.map((a) => ({ ...a, cuerpo: a.cuerpo.join('\n').trim() }))
}

/** Trocea por cabecera "Artículo N. Rúbrica." (admite "N bis"). */
function trocear(txt) {
  // Separador: punto O DOS PUNTOS. La Normativa de Permanencia de la UAL escribe
  // "Artículo 4: Tipo de matrícula de Doctorado" (con dos puntos) y solo ese; exigir punto
  // se saltaba ese artículo en silencio y dejaba 11 de 12.
  const RE = /^\s*Art[íi]culo\s+(\d+(?:\s+bis|\s+ter)?)\s*[.:]\s*(.*)$/i
  const lineas = txt.split('\n')
  const arts = []
  let actual = null
  for (const l of lineas) {
    const m = l.match(RE)
    // Una REMISIÓN en prosa ("…lo previsto en el artículo 38.4 de la Ley Orgánica 2/2023…")
    // casa con el patrón de cabecera y fabrica un artículo fantasma que se traga el resto del
    // documento (medido: art. 38 falso de 15.377 chars en la resolución de aspectos económicos).
    // Una rúbrica real NUNCA empieza por un dígito: eso delata que lo capturado es el decimal
    // del apartado, no un título.
    const esRemision = m && /^\d/.test((m[2] || '').trim())
    if (m && !esRemision) {
      if (actual) arts.push(actual)
      actual = { num: m[1].replace(/\s+/g, ' ').trim(), titulo: (m[2] || '').replace(/\.$/, '').trim(), cuerpo: [] }
    } else if (actual) actual.cuerpo.push(l)
  }
  if (actual) arts.push(actual)
  // El ÚLTIMO artículo se traga la cola del documento (disposiciones adicionales,
  // transitorias, derogatoria y finales), que no forman parte de su texto. Se corta ahí:
  // sin esto el art. 30 del Regl. de Admón. Electrónica salía con 5.278 chars en vez de ~1.000.
  const CORTE = /^\s*(DISPOSICI[ÓO]N|DISPOSICIONES)\s+(ADICIONAL|TRANSITORIA|DEROGATORIA|FINAL|ADICIONALES|TRANSITORIAS|FINALES)/i
  const cortados = arts.map((a, i) => {
    let lineas = a.cuerpo
    if (i === arts.length - 1) {
      const idx = lineas.findIndex((l) => CORTE.test(l))
      if (idx > -1) lineas = lineas.slice(0, idx)
    }
    return { ...a, cuerpo: lineas.join('\n').trim() }
  })
  // Si un número sale repetido (índice que se coló, o el artículo citado en una remisión),
  // nos quedamos con la aparición de cuerpo MÁS LARGO: esa es la de verdad.
  const porNum = new Map()
  for (const a of cortados) {
    const prev = porNum.get(a.num)
    if (!prev || a.cuerpo.length > prev.cuerpo.length) porNum.set(a.num, a)
  }
  return [...porNum.values()].sort((x, y) => parseFloat(x.num) - parseFloat(y.num))
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list')) {
    Object.entries(NORMAS).forEach(([k, n]) =>
      console.log(`${k.padEnd(6)} T${String(n.tema).padStart(2)}  ${n.esperados} arts esperados  ${n.short_name}`))
    return
  }
  const clave = args.find((a) => !a.startsWith('--'))
  const DRY = args.includes('--dry-run')
  const n = NORMAS[clave]
  if (!n) throw new Error(`clave desconocida "${clave}" — usa --list`)

  console.log(`→ ${n.short_name}\n  ${n.url}`)
  const crudo = await bajarPdf(n.url)
  const texto = limpiar(crudo)
  const arts = (n.modo === 'apartado') ? trocearApartados(texto) : trocear(texto)
  console.log(`  troceado: ${arts.length} artículo(s) (esperados ${n.esperados})`)
  if (arts.length !== n.esperados) {
    console.log('  ⚠️  el número NO coincide con lo verificado en el recon — revisar antes de aplicar')
  }
  arts.forEach((a) => console.log(`   · art. ${String(a.num).padEnd(6)} ${String(a.cuerpo.length).padStart(5)} chars  ${a.titulo.slice(0, 58)}`))
  const vacios = arts.filter((a) => a.cuerpo.length < 40)
  if (vacios.length) throw new Error(`${vacios.length} artículo(s) con cuerpo casi vacío (arts ${vacios.map((v) => v.num).join(', ')}) — no importo a ciegas`)

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    let law = (await c.query('SELECT id FROM laws WHERE short_name=$1', [n.short_name])).rows[0]
    if (law) console.log(`  · la ley ya existía (${law.id})`)
    else {
      law = (await c.query(
        `INSERT INTO laws (name, short_name, type, slug, is_virtual, boe_url, scope)
         VALUES ($1,$2,'regulation',$3,false,$4,'regional') RETURNING id`,
        [n.name, n.short_name, n.slug, n.url])).rows[0]
      console.log(`  · ley creada (${law.id})`)
    }

    let nuevos = 0
    for (const a of arts) {
      const ya = await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [law.id, a.num])
      if (ya.rows.length) continue
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified,
                               verification_date, embedding_stale)
         VALUES ($1,$2,$3,$4,true,true,CURRENT_DATE,true)`,
        [law.id, a.num, a.titulo, a.cuerpo])
      nuevos++
    }
    console.log(`  · ${nuevos} artículo(s) importados`)

    const t = (await c.query(
      `SELECT id FROM topics WHERE position_type='auxiliar_administrativo_universidad_almeria' AND topic_number=$1`,
      [n.tema])).rows[0]
    if (!t) console.log(`  ⚠️  no encuentro el T${n.tema} — scope sin enganchar`)
    else {
      const ex = await c.query('SELECT id FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [t.id, law.id])
      if (ex.rows.length) console.log(`  · T${n.tema} ya tenía la ley escopada`)
      else {
        await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
          [t.id, law.id, arts.map((a) => a.num)])
        console.log(`  · T${n.tema} escopado a ${arts.length} artículo(s)`)
      }
    }

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
