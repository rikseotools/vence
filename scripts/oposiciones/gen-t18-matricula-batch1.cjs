#!/usr/bin/env node
/**
 * Generación IA — lote 1 del T18 de Aux. Admin. UAL (T-044): las TRES resoluciones de
 * matrícula del curso 2026-27 (Grado y Máster, Doctorado, y aspectos económicos).
 * El tema tenía 14 preguntas sobre 74 artículos.
 *
 * ⚠️ NORMAS ANUALES: se sustituyen cada curso. Al llegar la resolución de 2027-28 hay que
 * crear la norma del curso nuevo e importar sus artículos, NO editar estos. Estas preguntas
 * quedan ligadas al articulado de 2026-27.
 *
 * Sigue `generar-preguntas-con-ia.md` v2.5 con los tres checks endurecidos en esta campaña:
 * longitud simétrica, palabras a 1,25 y uniformidad de sufijo.
 *
 * Uso: node scripts/oposiciones/gen-t18-matricula-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const PROV = 'claude_code_gen_t18_ual'
const GM = 'Res. Matrícula Grado y Máster UAL 2026-27'
const DOC = 'Res. Matrícula Doctorado UAL 2026-27'
const ECO = 'Res. Aspectos Económicos Matrícula UAL 2026-27'

const Q = [
  { ley: GM, art: '1', pos: 0,
    q: 'Según el artículo 1 de la Resolución sobre matrícula oficial en estudios de Grado y Máster de la Universidad de Almería, los plazos de matrícula y de otros procedimientos relacionados:',
    o: ['Se determinarán anualmente por el Rector y se recogerán en el Anexo de esta normativa',
        'Se determinarán anualmente por la Gerencia y se publicarán en la sede electrónica',
        'Se determinarán anualmente por el Consejo Social y se recogerán en el presupuesto',
        'Se determinarán anualmente por el Consejo de Gobierno y se recogerán en la memoria'],
    cita: 'los cuales se determinarán anualmente por el Rector y se recogerán en el Anexo de esta normativa (en adelante, Anexo de Plazos).' },

  { ley: GM, art: '3', pos: 1,
    q: 'Conforme al artículo 3 de la Resolución sobre matrícula de Grado y Máster de la Universidad de Almería, el procedimiento de matrícula se realizará:',
    o: ['De forma presencial en la Secretaría del centro donde se imparta la titulación',
        'Por medios electrónicos, a través de la página web de automatrícula de la UAL',
        'De forma mixta, presencial para el nuevo ingreso y telemática para el resto',
        'Por medios electrónicos, a través del registro electrónico general de la UAL'],
    cita: 'el procedimiento de matrícula en la Universidad de Almería se realizará por medios electrónicos, a través de la página web https://www.ual.es/automatricula (en adelante, web de automatrícula).' },

  { ley: GM, art: '3', pos: 2,
    q: 'Según el artículo 3 de la Resolución sobre matrícula de Grado y Máster de la Universidad de Almería, la tramitación electrónica del procedimiento se ampara en:',
    o: ['El artículo 9, apartado 2, de la Ley 39/2015, del Procedimiento Administrativo Común',
        'El artículo 12, apartado 1, de la Ley 39/2015, del Procedimiento Administrativo Común',
        'El artículo 14, apartado 3, de la Ley 39/2015, del Procedimiento Administrativo Común',
        'El artículo 16, apartado 4, de la Ley 39/2015, del Procedimiento Administrativo Común'],
    cita: 'De conformidad con lo previsto en el artículo 14, apartado 3, de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, el procedimiento de matrícula en la Universidad de Almería se realizará por medios electrónicos.' },

  { ley: GM, art: '6', pos: 3,
    q: 'De acuerdo con el artículo 6 de la Resolución sobre matrícula de Grado y Máster de la Universidad de Almería, tendrán la consideración de DESISTIMIENTO las peticiones de anulación de matrícula en las que el interesado:',
    o: ['Haya realizado alguna actuación de la que se deriven otros derechos académicos',
        'Haya abonado ya los precios públicos correspondientes a todo el curso académico',
        'Haya solicitado la anulación fuera del plazo previsto en el Anexo de Plazos vigente',
        'No haya realizado ninguna actuación académica o administrativa en base a la matrícula'],
    cita: 'Tendrán la consideración de desistimiento, aquellas peticiones de anulación de matrícula en las que el interesado no haya realizado ninguna actuación académica o administrativa en base a la referida matrícula.' },

  { ley: GM, art: '6', pos: 0,
    q: 'Según el artículo 6 de la Resolución sobre matrícula de Grado y Máster de la Universidad de Almería, tendrán la consideración de RENUNCIA las peticiones de anulación de matrícula en las que el interesado:',
    o: ['Haya realizado alguna actuación de la que se deriven otros derechos',
        'No haya realizado ninguna actuación académica ni administrativa previa',
        'Haya presentado la solicitud dentro del plazo reglamentario establecido',
        'Haya obtenido una beca de carácter general del Ministerio competente'],
    cita: 'Tendrán la consideración de renuncia, aquellas peticiones de anulación de matrícula en las que el interesado haya realizado alguna actuación de la que se deriven otros derechos.' },

  { ley: DOC, art: '2', pos: 1,
    q: 'Conforme al artículo 2 de la Resolución sobre matrícula en estudios de Doctorado de la Universidad de Almería, para formalizar matrícula, solicitar certificaciones o la expedición de títulos será requisito:',
    o: ['Haber superado los complementos de formación que se exijan',
        'Estar al corriente de los pagos a la Universidad de Almería',
        'Contar con el informe favorable del director de la tesis',
        'Haber obtenido la admisión definitiva en el programa cursado'],
    cita: 'Para poder formalizar matrícula, solicitar acreditaciones de matrícula, certificaciones académicas, la expedición de títulos universitarios y traslados de expediente, así como para incorporar complementos de formación en el segundo cuatrimestre será requisito estar al corriente de los pagos a la Universidad de Almería.' },

  { ley: DOC, art: '2', pos: 2,
    q: 'Según el artículo 2 de la Resolución sobre matrícula de Doctorado de la Universidad de Almería, la obligación de pago prescribirá en los plazos y condiciones que establezca:',
    o: ['El Decreto de Precios Públicos de la Junta de Andalucía para cada curso',
        'La normativa propia sobre estudios de doctorado de la Universidad de Almería',
        'La Ley General Presupuestaria en vigor o norma que regule la reclamación de deudas',
        'El Reglamento de Administración Electrónica que haya aprobado la Universidad de Almería'],
    cita: 'Esta obligación de pago prescribirá en los plazos y condiciones que establezca la Ley General Presupuestaria en vigor o norma que regule la reclamación de deudas de las Administraciones públicas.' },

  { ley: DOC, art: '8', pos: 3,
    q: 'De acuerdo con el artículo 8 de la Resolución sobre matrícula de Doctorado de la Universidad de Almería, ¿quién resuelve la admisión en los estudios de doctorado?',
    o: ['La Escuela Internacional de Doctorado de la Universidad',
        'El Vicerrectorado con competencias en estudios de doctorado',
        'La Secretaría General, previo informe de la comisión académica',
        'Las comisiones académicas de los programas de doctorado'],
    cita: 'Las comisiones académicas de los programas de doctorado resolverán la admisión en los estudios de doctorado conforme a los requisitos de acceso y los criterios de admisión establecidos por el R.D. 99/2011, de 28 de enero.' },

  { ley: DOC, art: '12', pos: 0,
    q: 'Según el artículo 12 de la Resolución sobre matrícula de Doctorado de la Universidad de Almería, NO se autorizarán solicitudes de simultaneidad de estudios en dos programas de doctorado a los estudiantes:',
    o: ['Cuyo régimen de permanencia sea a tiempo parcial',
        'Que no hayan superado los complementos de formación',
        'Que tengan pendiente de abono algún precio público',
        'Que cursen el programa en modalidad semipresencial'],
    cita: 'No se autorizarán solicitudes de simultaneidad de estudios en dos programas de doctorado a aquellos estudiantes cuyo régimen de permanencia sea a tiempo parcial.' },

  { ley: DOC, art: '12', pos: 1,
    q: 'Conforme al artículo 12 de la Resolución sobre matrícula de Doctorado de la Universidad de Almería, el estudiante que quiera ser admitido en otro programa deberá realizar preinscripción adjuntando:',
    o: ['Informe favorable del Vicerrectorado competente y del director propuesto del programa de destino únicamente',
        'Informe favorable de la comisión académica y directores del programa de origen y también del de destino',
        'Certificación académica personal y justificante de estar al corriente de pago con la Universidad',
        'Informe favorable de la Escuela de Doctorado y memoria justificativa del proyecto de tesis'],
    cita: 'deberán realizar preinscripción conforme a lo establecido en el artículo 9, adjuntando informe favorable de la comisión académica y de los directores del programa en el que esté matriculado, y de la comisión académica y del director propuesto del programa en el que desea simultanear estudios.' },

  { ley: ECO, art: '1', pos: 2,
    q: 'Según el artículo 1 de la Resolución que regula los aspectos económicos de las matrículas de la Universidad de Almería, los precios públicos aplicados en las matrículas oficiales serán los que determine:',
    o: ['El Consejo Social de la Universidad de Almería para cada curso académico',
        'El Consejo de Gobierno de la Universidad, a propuesta de la Gerencia',
        'El Decreto de Precios Públicos de la Junta de Andalucía',
        'El Rectorado mediante resolución anual publicada en el BOJA'],
    cita: 'Los precios públicos aplicados en las matrículas oficiales de la Universidad de Almería para el curso académico 2026-27 serán los que determine el Decreto de Precios Públicos de la Junta de Andalucía.' },

  { ley: ECO, art: '5', pos: 3,
    q: 'De acuerdo con el artículo 5 de la Resolución sobre aspectos económicos de las matrículas de la Universidad de Almería, ¿a quiénes se aplican los precios recogidos en las Tablas 1, 2 y 3 del artículo 3?',
    o: ['A quienes acrediten la nacionalidad española y, además, la residencia de larga duración en España',
        'A las personas nacionales de los estados miembros de la Unión Europea, con exclusión de Suiza',
        'Solo a quienes cuenten con una autorización de estancia por estudios que esté plenamente en vigor',
        'A quienes acrediten nacionalidad española, residencia o estancia por estudios, y a nacionales de la UE o Suiza'],
    cita: 'Les será de aplicación los precios recogidos en las Tablas 1, 2 y 3 del artículo 3 a quienes acrediten la nacionalidad española, a quienes acrediten la condición de residencia en España, temporal o de larga duración, autorización de estancia por estudios, así como a las personas nacionales de estados miembros de la Unión Europea o de Suiza.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} de esa resolución; altera el contenido de la norma.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} de la ${item.ley.replace('Res. ', 'Resolución sobre ')} de la Universidad de Almería.\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

function checks() {
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]}`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const oc = x.o.filter((_, j) => j !== x.pos).map((o) => o.length)
    if (lc / Math.min(...oc) > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO LARGA (${lc} vs ${Math.min(...oc)})`); malos++ }
    else if (Math.max(...oc) / lc > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO CORTA (${lc} vs ${Math.max(...oc)})`); malos++ }
    const pal = x.o.map((o) => o.trim().split(/\s+/).length)
    const pc = pal[x.pos], po = pal.filter((_, j) => j !== x.pos)
    if (Math.max(pc / Math.min(...po), Math.max(...po) / pc) > 1.25) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): PALABRAS ${pc} vs [${po.join(', ')}]`); malos++ }
    const fin = (o) => o.trim().split(/\s+/).slice(-3).join(' ').toLowerCase()
    const f = x.o.map(fin), fo = f.filter((_, j) => j !== x.pos)
    if (new Set(fo).size === 1 && fo[0] !== f[x.pos]) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE SUFIJO`); malos++ }
    // TELL DE PREFIJO: el check de sufijo no lo veía. Caso real: tres distractores empezando
    // por "Solo a…" y la correcta siendo la única inclusiva — se acierta por patrón.
    const ini = (o) => o.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase()
    const p2 = x.o.map(ini), po2 = p2.filter((_, j) => j !== x.pos)
    if (new Set(po2).size === 1 && po2[0] !== p2[x.pos]) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE PREFIJO — los 3 distractores empiezan por "${po2[0]}" y la correcta no`); malos++ }
  })
  if (malos) throw new Error(`${malos} incumplimiento(s)`)
  console.log('✅ checks de sesgo OK')
}

async function main() {
  checks()
  const c = newClient(); await c.connect()
  try {
    await c.query('BEGIN')
    const idx = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n, l.short_name ley FROM articles a JOIN laws l ON l.id=a.law_id
       WHERE l.short_name = ANY($1)`, [[GM, DOC, ECO]])).rows) idx.set(r.ley + '|' + r.n, r.id)
    let n = 0
    for (const item of Q) {
      const aid = idx.get(item.ley + '|' + item.art)
      if (!aid) throw new Error(`no encuentro ${item.ley} art. ${item.art}`)
      if ((await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])).rows.length) continue
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['matricula', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
