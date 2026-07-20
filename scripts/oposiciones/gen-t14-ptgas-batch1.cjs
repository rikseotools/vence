#!/usr/bin/env node
/**
 * Generación IA — lote 1 del T14 de Aux. Admin. UAL (T-044): Reglamento de provisión de
 * puestos de trabajo del PTGAS de la Universidad de Almería (27 arts). Tenía 14 preguntas.
 * Último tema fino con margen real; con este lote se cierra la campaña de banco de Almería.
 *
 * Sigue `generar-preguntas-con-ia.md` v2.5 con los CINCO checks endurecidos en esta campaña:
 * longitud simétrica, palabras (1,25), sufijo uniforme y prefijo uniforme.
 *
 * Uso: node scripts/oposiciones/gen-t14-ptgas-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Regl. Provisión Puestos PTGAS UAL'
const PROV = 'claude_code_gen_t14_ual'

const Q = [
  { art: '12', pos: 1,
    q: 'Según el artículo 12 del Reglamento de provisión de puestos de trabajo del PTGAS de la Universidad de Almería, sobre la remoción del puesto obtenido por concurso, la Junta de Personal emitirá informe en el plazo de:',
    o: ['Quince días hábiles',
        'Diez días hábiles',
        'Un mes natural',
        'Veinte días naturales'],
    cita: 'La propuesta definitiva se comunicará a la Junta de Personal que emitirá informe en el plazo de diez días hábiles.' },

  { art: '14', pos: 0,
    q: 'Conforme al artículo 14 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, ¿quién dicta la resolución de nombramiento una vez elevada la propuesta?',
    o: ['El Rectorado de la Universidad de Almería, mediante la oportuna resolución',
        'La Gerencia de la Universidad, previa comunicación a la Junta de Personal',
        'El Consejo de Gobierno de la Universidad de Almería en pleno',
        'La Junta de Personal, a propuesta del Gerente de la Universidad'],
    cita: 'el Gerente, previa comunicación a la Junta de Personal, elevará la propuesta de nombramiento al Rectorado de la Universidad de Almería para que dicte resolución de nombramiento.' },

  { art: '14', pos: 0,
    q: 'De acuerdo con el artículo 14 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, el nombramiento debe producirse en el plazo máximo de:',
    o: ['Un mes desde la finalización del plazo de presentación de solicitudes',
        'Quince días desde la finalización del plazo de presentación de solicitudes',
        'Dos meses desde la finalización del plazo de presentación de solicitudes',
        'Tres meses desde la finalización del plazo de presentación de solicitudes'],
    cita: 'El nombramiento debe producirse en el plazo máximo de un mes desde la finalización del plazo de presentación de solicitudes.' },

  { art: '15', pos: 2,
    q: 'Según el artículo 15 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, los funcionarios nombrados para puestos de libre designación podrán ser cesados:',
    o: ['Mediante acuerdo del Consejo de Gobierno, previa audiencia del interesado',
        'Únicamente por la comisión de una falta disciplinaria muy grave',
        'Con carácter discrecional, mediante resolución motivada del Rector',
        'Mediante resolución de la Gerencia, oída la Junta de Personal'],
    cita: 'Los funcionarios nombrados para puestos de trabajo de libre designación podrán ser cesados con carácter discrecional, mediante resolución motivada del Rector.' },

  { art: '15', pos: 1,
    q: 'Conforme al artículo 15 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, en caso de cese, el funcionario será adscrito provisionalmente a un puesto no inferior en más de:',
    o: ['Tres niveles al grado personal consolidado',
        'Dos niveles al grado personal consolidado',
        'Un nivel al grado personal consolidado',
        'Cuatro niveles al grado personal consolidado'],
    cita: 'los funcionarios afectados serán adscritos provisionalmente a un puesto de trabajo correspondiente a su cuerpo o escala no inferior en más de dos niveles al grado personal consolidado, ni inferior al nivel del último puesto obtenido por concurso.' },

  { art: '16', pos: 3,
    q: 'Según el artículo 16 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, la adjudicación de puestos a los funcionarios de nuevo ingreso se efectuará:',
    o: ['Por sorteo público, si reúnen los requisitos objetivos de la relación de puestos de trabajo',
        'Por designación de la Gerencia, atendiendo a las necesidades permanentes del servicio universitario',
        'Según la antigüedad acreditada, si reúnen los requisitos objetivos del puesto de trabajo',
        'Según el orden de las pruebas, si reúnen los requisitos objetivos de la relación de puestos'],
    cita: 'La adjudicación de puestos de trabajo a los funcionarios de nuevo ingreso se efectuará de acuerdo con las peticiones de los interesados, según el orden obtenido en las pruebas de selección, siempre que reúnan los requisitos objetivos determinados en la relación de puestos de trabajo.' },

  { art: '17', pos: 2,
    q: 'De acuerdo con el artículo 17 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, la movilidad por motivos de salud a un puesto en distinto Servicio o Unidad la acuerda:',
    o: ['El Rector, previo informe del Comité de Seguridad y Salud Laboral',
        'El Consejo de Gobierno, a propuesta del servicio de prevención propio',
        'La Gerencia, previo protocolo del Comité de Seguridad y Salud Laboral',
        'La Junta de Personal, oído el servicio de prevención de la Universidad'],
    cita: 'La Gerencia podrá adscribir al personal a puestos de trabajo en distinto Servicio o Unidad, motivado por razones de salud, a través del siguiente procedimiento: a) Previa solicitud del interesado se iniciará el protocolo establecido en el Comité de Seguridad y Salud Laboral.' },

  { art: '18', pos: 0,
    q: 'Según el artículo 18 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, sobre la movilidad de las víctimas de violencia de género o acoso laboral, la Gerencia facilitará e informará favorablemente:',
    o: ['El traslado en Comisión de Servicio a otros puestos o Administraciones Públicas',
        'La excedencia voluntaria por interés particular durante un año prorrogable',
        'La adaptación del puesto de trabajo que la víctima venga desempeñando actualmente',
        'La reducción de la jornada de trabajo con disminución proporcional de las retribuciones'],
    cita: 'La Gerencia de la Universidad de Almería facilitará e informará favorablemente el traslado en Comisión de Servicio a otros puestos de trabajo u otras Administraciones Públicas a las víctimas de violencia de género o acoso laboral en los términos establecidos en el texto refundido del Estatuto Básico del Empleado Público.' },

  { art: '19', pos: 3,
    q: 'Conforme al artículo 19 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, la Gerencia podrá autorizar la permuta definitiva entre puestos de trabajo, oída la Junta de Personal y las Centrales Sindicales, en el plazo máximo de:',
    o: ['El plazo de dos meses',
        'El plazo de tres meses',
        'El plazo de quince días',
        'El plazo de un mes'],
    cita: 'La Gerencia podrá autorizar, oída la Junta de Personal y Centrales Sindicales, en el plazo máximo de un mes, la permuta definitiva entre puestos de trabajo.' },

  { art: '20', pos: 1,
    q: 'Según el artículo 20 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, para suprimir un puesto de trabajo, alterar o modificar su contenido será necesario:',
    o: ['Emitir un informe de la Junta de Personal',
        'Realizar con carácter previo un Plan de Empleo',
        'Obtener la autorización previa del Consejo Social de la UAL',
        'Aprobar la modificación de la relación de puestos'],
    cita: 'Para suprimir un puesto de trabajo, alterar o modificar su contenido, será necesario realizar un Plan de Empleo.' },

  { art: '20', pos: 0,
    q: 'De acuerdo con el artículo 20 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, ¿a través de qué procedimiento podrán ser destinados a otro puesto los funcionarios cuyo puesto sea objeto de supresión como consecuencia de un Plan de Empleo?',
    o: ['Por el procedimiento de reasignación de efectivos',
        'Por el procedimiento de comisión de servicios forzosa',
        'Por el procedimiento de atribución temporal de funciones',
        'Por el procedimiento de adscripción provisional de puestos'],
    cita: 'Los funcionarios cuyo puesto de trabajo sea objeto de supresión como consecuencia de un Plan de Empleo podrán ser destinados a otro puesto de trabajo por el procedimiento de reasignación de efectivos.' },

  { art: '23', pos: 2,
    q: 'Según el artículo 23 del Reglamento de provisión de puestos del PTGAS de la Universidad de Almería, cabrá destinar con carácter forzoso a un funcionario en comisión de servicios cuando, celebrado el proceso de provisión de una vacante o ausencia:',
    o: ['El puesto lleve más de un año vacante sin haberse convocado su provisión',
        'La Junta de Personal informe favorablemente sobre la provisión forzosa del puesto vacante',
        'Ésta se declare desierta y sea urgente e inaplazable para el servicio su provisión',
        'El Plan de Empleo prevea expresamente la cobertura forzosa de ese puesto'],
    cita: 'Una vez celebrado el proceso de provisión de una vacante o ausencia, ésta se declare desierta y sea urgente e inaplazable para el servicio su provisión, podrá destinarse con carácter forzoso al funcionario que preste servicios en la Universidad de Almería y que reúna los requisitos del puesto.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} del Reglamento de provisión de puestos de trabajo del PTGAS de la Universidad de Almería; altera el contenido de la norma.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} del Reglamento de provisión de puestos de trabajo del Personal Técnico, de Gestión y de Administración y Servicios funcionario de la Universidad de Almería.\n\nPor qué las demás no:\n${otras}`
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
    const ends = (o) => o.trim().split(/\s+/).slice(-3).join(' ').toLowerCase()
    const fe = x.o.map(ends), foe = fe.filter((_, j) => j !== x.pos)
    if (new Set(foe).size === 1 && foe[0] !== fe[x.pos]) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE SUFIJO`); malos++ }
    const ini = (o) => o.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase()
    const pi = x.o.map(ini), poi = pi.filter((_, j) => j !== x.pos)
    if (new Set(poi).size === 1 && poi[0] !== pi[x.pos]) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE PREFIJO`); malos++ }
  })
  // CHECK ANTI-SECUENCIA (nace de un tell real del auditor 20/07): el reparto uniforme
  // (3 de cada) no basta si la SECUENCIA de la clave es periódica (D,A,B,C,D,A,B,C…), que
  // se acierta sin saber la materia. Se rechaza si hay periodo 2, 3 o 4 exacto.
  const seq = Q.map((x) => x.pos)
  for (const per of [2, 3, 4]) {
    let periodico = seq.length > per
    for (let k = per; k < seq.length; k++) if (seq[k] !== seq[k - per]) { periodico = false; break }
    if (periodico) { console.log(`  ⚠️ SECUENCIA PERIÓDICA de la clave (periodo ${per}): ${seq.join(',')}`); malos++ }
  }
  if (malos) throw new Error(`${malos} incumplimiento(s)`)
  console.log('✅ 6 checks de sesgo OK (incl. anti-secuencia de la clave)')
}

async function main() {
  checks()
  const c = newClient(); await c.connect()
  try {
    await c.query('BEGIN')
    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])).rows) arts.set(r.n, r.id)
    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`art. ${item.art} no encontrado`)
      if ((await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])).rows.length) continue
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['ptgas', 'provision-puestos', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
