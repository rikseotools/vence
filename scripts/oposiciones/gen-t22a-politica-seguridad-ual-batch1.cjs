#!/usr/bin/env node
/**
 * Generación IA — lote 1 de la Política de Seguridad de la Información de la UAL
 * (T22 del temario de Aux. Admin. UAL, tarea T-044). Última norma de la UAL sin banco.
 * Documento de política: 15 APARTADOS numerados, sin articulado formal.
 *
 * Protocolo anti-colisión aplicado: comprobada a 0 preguntas, anunciada en la tabla del
 * documento de build, detector de duplicados al terminar.
 *
 * Sigue `generar-preguntas-con-ia.md` v2.5. El check de longitud ABORTA (no avisa).
 * Núcleo examinable: los ROLES del apartado 7 (quién es cada responsable), que es donde
 * un opositor se juega la pregunta — los distractores cruzan los cargos entre sí.
 *
 * Uso: node scripts/oposiciones/gen-t22a-politica-seguridad-ual-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Política Seguridad Información UAL'
const PROV = 'claude_code_gen_t22a_ual'

const Q = [
  { art: '2', pos: 0,
    q: 'Según el apartado 2 de la Política de Seguridad de la Información de la Universidad de Almería, y conforme a sus Estatutos, la Universidad de Almería se define como:',
    o: ['Una institución de derecho público, dotada de personalidad jurídica y patrimonio propio, a la que corresponde el servicio público de la educación superior',
        'Un organismo autónomo de la Junta de Andalucía, dotado de personalidad jurídica propia, adscrito a la consejería competente en materia de universidades',
        'Una entidad de derecho privado vinculada a la Administración autonómica, con patrimonio propio y sometida al derecho administrativo en su actuación',
        'Un consorcio público de investigación con personalidad jurídica diferenciada, integrado por la Administración General del Estado y la autonómica'],
    cita: 'Según se refleja en los Estatutos, la Universidad de Almería es una institución de derecho público, dotada de personalidad jurídica y patrimonio propio, a la que corresponde el servicio público de la educación superior mediante la docencia, el estudio y la investigación, con plena autonomía y de acuerdo con la Constitución Española y las leyes.' },

  { art: '3', pos: 1,
    q: 'Conforme al principio básico de "Responsabilidad determinada" del apartado 3 de la Política de Seguridad de la Información de la UAL, ¿qué figura determina los requisitos de seguridad de la información tratada?',
    o: ['El Responsable del Sistema, que tiene la responsabilidad sobre la prestación de los servicios de la Universidad',
        'El Responsable de la Información, que determina los requisitos de seguridad de la información tratada',
        'El Responsable de la Seguridad, que determina las decisiones para satisfacer los requisitos de seguridad',
        'El Responsable del Servicio, que determina los requisitos de seguridad de los servicios prestados'],
    cita: 'Responsable de la Información, que determina los requisitos de seguridad de la información tratada.' },

  { art: '3', pos: 2,
    q: 'Según el apartado 3 de la Política de Seguridad de la Información de la UAL, ¿qué figura tiene la responsabilidad sobre la prestación de los servicios?',
    o: ['El Responsable de la Información, que determina los requisitos de seguridad de la información tratada',
        'El Responsable de la Seguridad, que determina las decisiones para satisfacer los requisitos de seguridad',
        'El Responsable del Sistema, que tiene la responsabilidad sobre la prestación de los servicios',
        'El Responsable del Servicio, que determina los requisitos de seguridad de los servicios prestados'],
    cita: 'Responsable del Sistema, que tiene la responsabilidad sobre la prestación de los servicios.' },

  { art: '3', pos: 3,
    q: 'De acuerdo con el principio de "Alcance estratégico" del apartado 3 de la Política de Seguridad de la Información de la UAL, la seguridad de la información debe contar con:',
    o: ['El compromiso y apoyo del Área de Tecnologías de la Información y las Comunicaciones en todas las áreas de la Universidad',
        'El compromiso y apoyo del personal técnico de seguridad en las áreas de gestión administrativa y tecnológica de la Universidad',
        'El compromiso y apoyo del Consejo de Gobierno en las áreas de investigación y docencia de la Universidad',
        'El compromiso y apoyo de todos los niveles directivos de la Universidad en todas las áreas'],
    cita: 'Alcance estratégico. La seguridad de la información debe contar con el compromiso y apoyo de todos los niveles directivos de la Universidad en todas las áreas (gestión administrativa y tecnológica, investigación y docencia).' },

  { art: '3', pos: 0,
    q: 'Según el principio de "Seguridad integral" del apartado 3 de la Política de Seguridad de la Información de la UAL, la seguridad se entenderá como:',
    o: ['Un proceso integral constituido por todos los elementos técnicos, humanos, materiales y organizativos, relacionados con los sistemas TIC',
        'Un conjunto de medidas técnicas y organizativas aplicables únicamente a los sistemas TIC que traten datos de carácter personal',
        'Una actuación coyuntural sobre los elementos técnicos y materiales que se revisará cada vez que se produzca un incidente grave',
        'Un procedimiento de control aplicable a los elementos humanos y materiales una vez desplegados y puestos en producción los sistemas'],
    cita: 'Seguridad integral: La seguridad se entenderá como un proceso integral constituido por todos los elementos técnicos, humanos, materiales y organizativos, relacionados con los sistemas TIC, procurando evitar cualquier actuación puntual o tratamiento coyuntural.' },

  { art: '4', pos: 1,
    q: 'Conforme al apartado 4 de la Política de Seguridad de la Información de la UAL, el objetivo de la seguridad de la información es:',
    o: ['Garantizar la disponibilidad de los sistemas TIC y la continuidad del servicio, actuando preventivamente y reaccionando con presteza ante los incidentes que se produzcan',
        'Garantizar la calidad de la información y la prestación continuada de los servicios, actuando preventivamente, supervisando la actividad diaria y reaccionando con presteza a los incidentes',
        'Garantizar el cumplimiento del Esquema Nacional de Seguridad mediante auditorías periódicas, supervisando la actividad diaria y reaccionando con presteza a los incidentes',
        'Garantizar la confidencialidad de los datos personales tratados, actuando preventivamente, supervisando la actividad diaria y reaccionando a las brechas de seguridad'],
    cita: 'El objetivo de la seguridad de la información es garantizar la calidad de la información y la prestación continuada de los servicios, actuando preventivamente, supervisando la actividad diaria y reaccionando con presteza a los incidentes.' },

  { art: '4', pos: 2,
    q: 'Según el apartado 4 de la Política de Seguridad de la Información de la UAL, al referirse a la plena concienciación de todos los usuarios, ¿quiénes integran ese colectivo?',
    o: ['El personal técnico, de gestión y de administración y servicios, y el personal docente e investigador con funciones de responsabilidad',
        'El personal docente e investigador y el estudiantado matriculado en enseñanzas oficiales, así como el personal de administración y servicios',
        'El personal docente e investigador, personal técnico, de gestión y de administración y servicios, estudiantado y cualesquiera otros relacionados con los sistemas de información',
        'El personal con acceso autorizado a los sistemas de información y los proveedores externos con contrato en vigor con la Universidad'],
    cita: 'Lograr la plena concienciación de todos los usuarios respecto a la seguridad de la información: Estos están integrados por el personal docente e investigador, personal técnico, de gestión y de administración y servicios, estudiantado y cualesquiera otros relacionados con los sistemas de información de la universidad.' },

  { art: '5', pos: 3,
    q: 'De acuerdo con el apartado 5 (Alcance) de la Política de Seguridad de la Información de la UAL, esta política se aplicará a todos los usuarios con acceso autorizado a los sistemas:',
    o: ['Siempre que ostenten la condición de empleados públicos al servicio de la Universidad de Almería',
        'Salvo que su relación con la Universidad se rija por el derecho privado o por un contrato mercantil',
        'Únicamente cuando accedan a sistemas que traten información sujeta al Esquema Nacional de Seguridad',
        'Sean o no empleados públicos y con independencia de la naturaleza de su relación jurídica con la universidad'],
    cita: 'Esta Política de seguridad de la información se aplicará a los sistemas de información de la Universidad de Almería relacionados con el ejercicio de sus competencias y a todos los usuarios con acceso autorizado a los mismos, sean o no empleados públicos y con independencia de la naturaleza de su relación jurídica con la universidad.' },

  { art: '5', pos: 0,
    q: 'Según el apartado 5 de la Política de Seguridad de la Información de la UAL, respecto de los usuarios con acceso autorizado a los sistemas, la norma establece que:',
    o: ['Todos ellos tienen la obligación de conocer y cumplir esta Política y la normativa de seguridad derivada',
        'Todos ellos deberán suscribir un compromiso individual de confidencialidad antes de acceder a los sistemas',
        'Todos ellos serán objeto de una acreditación previa expedida por el responsable de seguridad competente',
        'Todos ellos deberán superar una acción formativa anual en materia de seguridad de la información'],
    cita: 'Todos ellos tienen la obligación de conocer y cumplir esta Política y la normativa de seguridad derivada.' },

  { art: '7', pos: 1,
    q: 'Conforme al apartado 7.1 de la Política de Seguridad de la Información de la UAL, ¿quién tendrá el rol de responsable de la información de la Organización?',
    o: ['El Director del Área de Tecnologías de la Información y las Comunicaciones de la Universidad',
        'El Secretario General',
        'El miembro del Equipo de Gobierno con competencias en TIC',
        'El Delegado de protección de datos de la Universidad de Almería'],
    cita: 'El Secretario General tendrá el rol de responsable de la información de la Organización.' },

  { art: '7', pos: 2,
    q: 'Según el apartado 7.2 de la Política de Seguridad de la Información de la UAL, ¿quién tendrá el rol de responsable de los servicios TIC de la Organización?',
    o: ['El Director del Área de Tecnologías de la Información y las Comunicaciones de la Universidad',
        'El Secretario General de la Universidad de Almería',
        'El miembro del Equipo de Gobierno con competencias en TIC',
        'El Delegado de protección de datos de la Universidad de Almería'],
    cita: 'El miembro del Equipo de Gobierno con competencias en TIC tendrá el rol de responsable de los servicios TIC de la Organización.' },

  { art: '7', pos: 3,
    q: 'De acuerdo con el apartado 7.3 de la Política de Seguridad de la Información de la UAL, ¿quién tendrá el rol de responsable de seguridad?',
    o: ['El Secretario General, que además es responsable de la información de la Organización',
        'El miembro del Equipo de Gobierno con competencias en TIC de la Universidad de Almería',
        'El Delegado de protección de datos, integrado en la Comisión de Seguridad Informática',
        'El Director del Área de Tecnologías de la Información y las Comunicaciones'],
    cita: 'El Director del Área de Tecnologías de la Información y las Comunicaciones tendrá el rol de responsable de seguridad.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el apartado ${item.art} de la Política de Seguridad de la Información de la Universidad de Almería; altera el contenido de la norma.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el apartado ${item.art} de la Política de Seguridad de la Información de la Universidad de Almería (aprobada en Consejo de Gobierno de 05/11/2025).\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]}`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const min = Math.min(...x.o.filter((_, j) => j !== x.pos).map((o) => o.length))
    if (lc / min > 1.4) { console.log(`  ⚠️ Q${i + 1} (ap ${x.art}): ratio ${(lc / min).toFixed(2)} — correcta ${lc}, distractor más corto ${min}`); malos++ }
  })
  if (malos) throw new Error(`${malos} pregunta(s) incumplen §2.2-bis — corrige antes de insertar`)
  console.log('✅ equilibrio de longitud OK (§2.2-bis)')

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const previas = await c.query(
      `SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id
       JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])
    if (previas.rows[0].n > 0) throw new Error(`la norma ya tiene ${previas.rows[0].n} preguntas — otra sesión se adelantó, abortando`)

    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])).rows) arts.set(r.n, r.id)

    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`no encuentro el apartado ${item.art}`)
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['politica-seguridad', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
