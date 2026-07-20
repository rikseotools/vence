#!/usr/bin/env node
/**
 * Generación IA — lote 1 de las Bases de Ejecución Presupuestaria 2026 de la UAL (T11 de
 * Aux. Admin. UAL, T-044). El tema tenía 12 preguntas sobre 104 artículos: 92 sin banco.
 *
 * Protocolo anti-colisión aplicado (norma comprobada, sin actividad reciente de otra sesión).
 * Sigue `generar-preguntas-con-ia.md` v2.5 con los checks endurecidos en esta campaña:
 *  · §2.2-bis SIMÉTRICO (la correcta no puede ser ni la más larga ni la más corta)
 *  · medición en PALABRAS además de caracteres
 *  · uniformidad de sufijo (que los distractores no compartan un final que la correcta no tiene)
 *  Los tres nacieron de tells reales que el auditor ciego encontró y el check no veía.
 *
 * ⚠️ NO se genera NINGUNA pregunta desde el art. 1: contiene las tablas presupuestarias
 * aplanadas por `pdftotext` y está marcado `is_verified=false` a la espera de reconstrucción.
 * Inventar o leer mal una cifra de ahí sería exactamente el defecto que el proyecto persigue.
 *
 * Uso: node scripts/oposiciones/gen-t11-bases-ejecucion-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Bases Ejecución Presupuesto 2026 UAL'
const PROV = 'claude_code_gen_t11_ual'

const Q = [
  { art: '2', pos: 0,
    q: 'Según el artículo 2 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, ¿qué carácter tienen las instrucciones y circulares que dicte el Gerente en desarrollo y aplicación de la normativa vigente?',
    o: ['Serán de obligado cumplimiento para la ejecución del presupuesto',
        'Tendrán carácter meramente orientativo para los centros de gasto',
        'Requerirán la ratificación previa del Consejo Social de la Universidad',
        'Vincularán únicamente a los servicios centrales de la Universidad'],
    cita: 'Serán de obligado cumplimiento para la ejecución del presupuesto, las instrucciones y circulares que dicte el Gerente de la Universidad, en desarrollo y aplicación de la normativa vigente.' },

  { art: '9', pos: 1,
    q: 'Conforme al artículo 9 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, ¿a quién corresponde establecer los procesos que proporcionen un grado de seguridad razonable en la fiabilidad de la información financiera?',
    o: ['Al Consejo Social, a propuesta de la Gerencia',
        'Al Gerente de la Universidad de Almería',
        'Al Rector, previo informe del Gabinete Jurídico',
        'A la Intervención, con el visto bueno previo'],
    cita: 'El Gerente deberá establecer los procesos que se estimen adecuados con objeto de proporcionar un grado de seguridad razonable en la fiabilidad de la información financiera, un adecuado cumplimiento de la normativa aplicable y la sujeción a los principios de economía, eficacia y eficiencia.' },

  { art: '9', pos: 2,
    q: 'Según el artículo 9 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, los procesos que debe establecer el Gerente han de asegurar la sujeción a los principios de:',
    o: ['Legalidad, transparencia y publicidad de la gestión pública',
        'Estabilidad presupuestaria, sostenibilidad y prudencia en la gestión',
        'Economía, eficacia y eficiencia en la gestión económica',
        'Unidad de caja, especialidad y no afectación de ingresos'],
    cita: 'con objeto de proporcionar un grado de seguridad razonable en la fiabilidad de la información financiera, un adecuado cumplimiento de la normativa aplicable y la sujeción a los principios de economía, eficacia y eficiencia.' },

  { art: '11', pos: 3,
    q: 'De acuerdo con el artículo 11 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, el aplazamiento o fraccionamiento del pago de cantidades adeudadas a la Universidad se acordará:',
    o: ['Por acuerdo del Consejo Social, previo informe favorable de la Intervención',
        'Por resolución del Rector, previo informe del Consejo de Gobierno',
        'Por acuerdo del Consejo de Gobierno, previo informe de la Gerencia',
        'Por resolución del Gerente, previo informe del Gabinete Jurídico'],
    cita: 'Podrá aplazarse o fraccionarse el pago de las cantidades adeudadas a la Universidad de Almería por resolución del Gerente, previo informe del Gabinete Jurídico.' },

  { art: '13', pos: 0,
    q: 'Según el artículo 13 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, las obligaciones económicas de la Universidad nacen:',
    o: ['De la Ley, de los negocios jurídicos y de los actos o hechos que las generen',
        'Del acuerdo del Consejo Social que apruebe el gasto y de los actos posteriores',
        'De la aprobación del presupuesto anual y de las modificaciones de crédito aprobadas',
        'De los contratos formalizados y de las resoluciones firmes del orden contencioso administrativo'],
    cita: 'Las obligaciones económicas de la Universidad de Almería nacen de la Ley, de los negocios jurídicos y de los actos o hechos que, según Derecho, las generen.' },

  { art: '13', pos: 1,
    q: 'Conforme al artículo 13 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, las obligaciones solo son exigibles a la Universidad cuando resulten de:',
    o: ['La ejecución de sus presupuestos, del acuerdo del Consejo Social o de convenios debidamente suscritos',
        'La ejecución de sus presupuestos, de sentencia firme o de operaciones extrapresupuestarias debidamente autorizadas',
        'La ejecución de sus presupuestos, de resolución del Gerente o de informe previo de la Intervención',
        'La ejecución de sus presupuestos, de sentencia firme o de acuerdos previos del Consejo de Gobierno'],
    cita: 'Las obligaciones solo son exigibles a la Universidad de Almería cuando resulten de la ejecución de sus presupuestos, de sentencia firme o de operaciones extrapresupuestarias debidamente autorizadas.' },

  { art: '13', pos: 2,
    q: 'Según el artículo 13 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, cuando las obligaciones tengan por causa entregas de bienes, prestaciones o servicios:',
    o: ['El pago se efectuará en el plazo máximo previsto en la normativa vigente sobre morosidad',
        'El pago requerirá el informe previo favorable del Gabinete Jurídico de la Universidad',
        'El pago no podrá efectuarse si el acreedor no ha cumplido o garantizado su correlativa obligación',
        'El pago quedará condicionado a la existencia de crédito adecuado y suficiente para atenderlo'],
    cita: 'Si dichas obligaciones tienen por causa entregas de bienes, prestaciones o servicios a la Universidad de Almería, el pago no podrá efectuarse si el acreedor no ha cumplido o garantizado su correlativa obligación.' },

  { art: '14', pos: 3,
    q: 'De acuerdo con el artículo 14 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, las cantidades adeudadas a la Universidad devengarán interés de demora:',
    o: ['Desde la fecha de vencimiento de la deuda, en todos los casos sin excepción',
        'Desde el requerimiento fehaciente de pago practicado al deudor por la Gerencia',
        'Desde el acuerdo de inicio del procedimiento de recaudación en vía ejecutiva',
        'Desde el día siguiente al de su vencimiento, en los casos que las leyes dispongan'],
    cita: 'Las cantidades adeudadas a la Universidad de Almería devengarán interés de demora desde el día siguiente al de su vencimiento, en los casos que las leyes dispongan.' },

  { art: '23', pos: 0,
    q: 'Según el artículo 23 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, sobre el ámbito temporal, el ejercicio presupuestario:',
    o: ['Coincidirá con el año natural',
        'Coincidirá con el curso académico',
        'Abarcará dieciocho meses naturales',
        'Se fijará por el Consejo Social'],
    cita: 'El ejercicio presupuestario coincidirá con el año natural.' },

  { art: '23', pos: 1,
    q: 'Conforme al artículo 23 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, se imputarán al ejercicio las obligaciones económicas reconocidas hasta:',
    o: ['El 31 de diciembre del propio ejercicio, siempre que exista crédito disponible',
        'El 31 de enero siguiente, siempre que correspondan a gastos realizados en el ejercicio',
        'El 30 de junio siguiente, siempre que exista crédito adecuado y suficiente para ello',
        'El 28 de febrero siguiente, previa autorización expresa de la Gerencia de la UAL'],
    cita: 'Las obligaciones económicas reconocidas hasta el 31 de enero siguiente, siempre que correspondan a adquisiciones, obras, servicios, prestaciones o, en general, gastos realizados dentro del ejercicio y con cargo a los respectivos créditos.' },

  { art: '26', pos: 2,
    q: 'Según el artículo 26 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, la declaración de no disponibilidad de créditos por razones de política presupuestaria podrá realizarse:',
    o: ['Por acuerdo del Consejo Social, a propuesta del Rector o del Gerente de la UAL',
        'Por resolución del Gerente, a propuesta del Rector o del Consejo de Gobierno',
        'Por resolución del Rector, a propuesta del Gerente o del Consejo Social',
        'Por acuerdo del Consejo de Gobierno, a propuesta del Gerente o del Rector'],
    cita: 'si por razones de política presupuestaria fuese necesario declarar la no disponibilidad de créditos, esta podrá realizarse por resolución del Rector, a propuesta del Gerente o del Consejo Social.' },

  { art: '28', pos: 3,
    q: 'De acuerdo con el artículo 28 de las Bases de Ejecución Presupuestaria de la Universidad de Almería, los créditos autorizados en los programas de gastos tienen carácter limitativo y vinculante a nivel de:',
    o: ['Programa, capítulo presupuestario y artículo de la clasificación económica',
        'Centro de gasto, capítulo y subconcepto de la clasificación económica',
        'Programa, orgánica y capítulo de la clasificación económica del gasto',
        'Programa, centro de gasto y concepto presupuestario del gasto'],
    cita: 'Los créditos autorizados en los programas de gastos tienen carácter limitativo y vinculante a nivel de programa, centro de gasto, y concepto.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} de las Bases de Ejecución Presupuestaria de la Universidad de Almería; altera el contenido de la norma.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} de las Bases de Ejecución Presupuestaria del Presupuesto 2026 de la Universidad de Almería.\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  if (Q.some((x) => x.art === '1')) throw new Error('el art. 1 tiene tablas aplanadas (is_verified=false) — no generar de ahí')
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]}`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const otras = x.o.filter((_, j) => j !== x.pos).map((o) => o.length)
    if (lc / Math.min(...otras) > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO LARGA`); malos++ }
    else if (Math.max(...otras) / lc > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO CORTA`); malos++ }
    const pal = x.o.map((o) => o.trim().split(/\s+/).length)
    const pc = pal[x.pos], po = pal.filter((_, j) => j !== x.pos)
    if (Math.max(pc / Math.min(...po), Math.max(...po) / pc) > 1.25) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): desequilibrio en PALABRAS — ${pc} vs [${po.join(', ')}]`); malos++ }
    const fin = (o) => o.trim().split(/\s+/).slice(-3).join(' ').toLowerCase()
    const fines = x.o.map(fin), fo = fines.filter((_, j) => j !== x.pos)
    if (new Set(fo).size === 1 && fo[0] !== fines[x.pos]) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE FORMATO — sufijo común en los distractores`); malos++ }
  })
  if (malos) throw new Error(`${malos} incumplimiento(s) de §2.2-bis`)
  console.log('✅ checks de sesgo OK (longitud simétrica, palabras y sufijo)')

  const c = newClient(); await c.connect()
  try {
    await c.query('BEGIN')
    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1 AND a.is_verified`, [LEY])).rows) arts.set(r.n, r.id)
    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`art. ${item.art} no encontrado o no verificado`)
      if ((await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])).rows.length) continue
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['presupuesto', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
