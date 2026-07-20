#!/usr/bin/env node
/**
 * Generación IA — lote 1 del T19 de Aux. Admin. UAL (T-044): Normativa de permanencia de
 * estudiantes en enseñanzas oficiales de la Universidad de Almería (12 artículos).
 *
 * Sigue `docs/maintenance/generar-preguntas-con-ia.md` v2.5, igual que el lote del T13:
 * correcta = cita literal, distractores dentro de ±30% de longitud (§2.2-bis, ratio ≤1,4),
 * posición de la correcta uniforme (§2.2-ter), explicación con blockquote literal.
 *
 * Materia muy examinable para un auxiliar de secretaría: plazos de permanencia, tipos de
 * matrícula, convocatorias. Las CIFRAS son el núcleo → los distractores alteran cifras reales
 * de la propia norma (tabla del art. 9 y del art. 12), que es lo que de verdad discrimina.
 *
 * Entran como `draft`. No se activan hasta pasar auditoría doble + re-verificación (fases 6-9).
 *
 * Uso: node scripts/oposiciones/gen-t19-permanencia-ual-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Normativa Permanencia UAL'
const PROV = 'claude_code_gen_t19_ual'

const Q = [
  { art: '2', pos: 0,
    q: 'Según el artículo 2 de la Normativa de permanencia de estudiantes en enseñanzas oficiales de la Universidad de Almería, dicha normativa será de aplicación a los estudiantes matriculados en las enseñanzas oficiales de:',
    o: ['Grado, Máster y Doctorado',
        'Grado y Máster únicamente',
        'Grado, Máster y títulos propios',
        'Grado, Máster, Doctorado y formación permanente'],
    cita: 'La presente normativa será de aplicación a los estudiantes de la Universidad de Almería matriculados en las enseñanzas oficiales de Grado, Máster y Doctorado.' },

  { art: '3', pos: 1,
    q: 'Conforme al artículo 3 de la Normativa de permanencia de la Universidad de Almería, ¿qué modalidades de matrícula se establecen para las titulaciones de Grado y Máster?',
    o: ['Matrícula ordinaria, matrícula extraordinaria y matrícula condicionada',
        'Matrícula a tiempo completo, matrícula a tiempo parcial y matrícula a tiempo reducido',
        'Matrícula a tiempo completo, matrícula a tiempo parcial y matrícula por compensación',
        'Matrícula a tiempo completo, matrícula reducida y matrícula de continuación de estudios'],
    cita: 'A efectos de la presente normativa, la Universidad de Almería establece para las titulaciones de Grado y Máster las siguientes modalidades de matrícula: a) Matrícula a tiempo completo. b) Matrícula a tiempo parcial. c) Matrícula a tiempo reducido.' },

  { art: '3', pos: 2,
    q: 'De acuerdo con el artículo 3 de la Normativa de permanencia de la Universidad de Almería, la matrícula a tiempo completo, que es la modalidad estándar, deberá formalizarse por:',
    o: ['Entre 30 y 72 créditos, ambos inclusive, y en el caso de dobles títulos el máximo será de 90 créditos',
        'Entre 42 y 84 créditos, ambos inclusive, y en el caso de dobles títulos el máximo será de 102 créditos',
        'Entre 36 y 78 créditos, ambos inclusive, y en el caso de dobles títulos el máximo será de 96 créditos',
        'Entre 24 y 60 créditos, ambos inclusive, y en el caso de dobles títulos el máximo será de 78 créditos'],
    cita: 'Es la modalidad estándar de matrícula, debiendo formalizarse por entre 36 y 78 créditos, ambos inclusive. En el caso de dobles títulos, el máximo a tiempo completo será de 96 créditos.' },

  { art: '5', pos: 3,
    q: 'Según el artículo 5 de la Normativa de permanencia de la Universidad de Almería, entre los supuestos de ampliación de matrícula por encima de los máximos, ¿cuál NO requiere autorización?',
    o: ['Que el estudiante acredite sobredotación intelectual o altas capacidades reconocidas por la administración competente',
        'Que el Rector lo autorice mediante Resolución al concurrir otras circunstancias excepcionales no subsumibles en los demás apartados',
        'Que el estudiante acredite la superación de todas las asignaturas del primer cuatrimestre dentro del plazo de ampliación de matrícula',
        'Que el estudiante se matricule de todos los créditos necesarios para finalizar el plan de estudios que esté cursando'],
    cita: 'a.2) Que el estudiante se matricule de todos los créditos necesarios para finalizar el plan de estudios que esté cursando. Este supuesto no requerirá autorización.' },

  { art: '6', pos: 0,
    q: 'Conforme al artículo 6 de la Normativa de permanencia de la Universidad de Almería, respecto de los estudiantes de nuevo ingreso en un Grado que soliciten matrícula a tiempo parcial, la norma establece que:',
    o: ['En ningún caso se autorizará minorar la matrícula con asignaturas del primer curso a efectos de incluir otras asignaturas de cursos posteriores',
        'Podrá autorizarse minorar la matrícula con asignaturas del primer curso siempre que se sustituyan por otras del mismo número de créditos',
        'Se autorizará minorar la matrícula con asignaturas del primer curso cuando concurran razones de conciliación laboral debidamente acreditadas',
        'La minoración de asignaturas del primer curso corresponderá resolverla al centro responsable del título y no al Rector de la Universidad'],
    cita: 'En ningún caso se autorizará minorar la matrícula con asignaturas del primer curso a efectos de incluir otras asignaturas de cursos posteriores.' },

  { art: '8', pos: 1,
    q: 'Según el artículo 8 de la Normativa de permanencia de la Universidad de Almería, el estudiante que inicie estudios oficiales deberá superar en el primer curso matriculado, al menos:',
    o: ['Doce créditos en Grado o dos asignaturas en Máster, computándose a tal efecto los créditos reconocidos',
        'Seis créditos en Grado o una asignatura en Máster, con independencia de la matrícula formalizada',
        'Dieciocho créditos en Grado o tres asignaturas en Máster, con independencia de la matrícula formalizada',
        'Treinta créditos en Grado o el cincuenta por ciento de las asignaturas matriculadas en Máster'],
    cita: 'El estudiante que inicie estudios conducentes a la obtención de alguno de los títulos oficiales de la Universidad de Almería deberá superar en el primer curso matriculado al menos, seis créditos en Grado o una asignatura en Máster, con independencia de la matrícula formalizada. No se considerarán dentro de este cómputo los créditos reconocidos.' },

  { art: '8', pos: 2,
    q: 'De acuerdo con el artículo 8 de la Normativa de permanencia de la Universidad de Almería, en el cómputo del mínimo de créditos a superar en el primer curso:',
    o: ['Se computarán los créditos reconocidos siempre que procedan de estudios oficiales cursados en otra universidad española',
        'Se computarán los créditos reconocidos únicamente cuando el estudiante los haya obtenido en la propia Universidad de Almería',
        'No se considerarán dentro de este cómputo los créditos reconocidos',
        'Se computarán los créditos reconocidos y también las asignaturas calificadas como "No presentado" en convocatoria ordinaria'],
    cita: 'No se considerarán dentro de este cómputo los créditos reconocidos.' },

  { art: '9', pos: 3,
    q: 'Según la tabla del artículo 9.1 de la Normativa de permanencia de la Universidad de Almería, el número máximo de cursos académicos matriculados para un Grado de 240 créditos será de:',
    o: ['Seis cursos a tiempo completo y ocho cursos a tiempo parcial',
        'Diez cursos a tiempo completo y trece cursos a tiempo parcial',
        'Doce cursos a tiempo completo y dieciséis cursos a tiempo parcial',
        'Ocho cursos a tiempo completo y diez cursos a tiempo parcial'],
    cita: 'Grado de 240 créditos: máximo de cursos a tiempo completo 8; máximo de cursos a tiempo parcial 10.' },

  { art: '9', pos: 0,
    q: 'Conforme al artículo 9.2 de la Normativa de permanencia de la Universidad de Almería, las matrículas a tiempo reducido que hubieran sido autorizadas se computarán, a efectos del tiempo máximo de permanencia:',
    o: ['Como matrículas a tiempo parcial',
        'Como matrículas a tiempo completo',
        'Como medio curso académico',
        'Como matrículas no computables'],
    cita: 'Las matrículas a tiempo reducido que eventualmente pudieran haber sido autorizadas, se computarán, a efectos de lo dispuesto en este artículo, como matrículas a tiempo parcial.' },

  { art: '10', pos: 1,
    q: 'Según el artículo 10 de la Normativa de permanencia de la Universidad de Almería, sobre el agotamiento de los plazos de permanencia en Grado y Máster, no será de aplicación dicho artículo a los estudiantes:',
    o: ['A los que les quede un máximo del cinco por ciento de los créditos necesarios para concluir sus estudios',
        'A los que les queden un máximo del diez por ciento de los créditos necesarios para concluir sus estudios',
        'A los que les quede un máximo del veinte por ciento de los créditos necesarios para concluir sus estudios',
        'A los que les quede únicamente pendiente el Trabajo Fin de Grado o el Trabajo Fin de Máster correspondiente'],
    cita: 'A los estudiantes a los que les queden un máximo del 10% de los créditos necesarios para concluir sus estudios no les será de aplicación el presente artículo.' },

  { art: '11', pos: 2,
    q: 'De acuerdo con el artículo 11 de la Normativa de permanencia de la Universidad de Almería, sobre el número máximo de convocatorias, los estudiantes tendrán derecho a:',
    o: ['Cuatro convocatorias por asignatura, computándose las convocatorias en las que figure como "No presentado"',
        'Cinco convocatorias por asignatura, no computándose las convocatorias en las que figure como "No presentado"',
        'Seis convocatorias por asignatura, no computándose las convocatorias en las que figure como "No presentado"',
        'Ocho convocatorias por asignatura, computándose todas ellas con independencia de la calificación obtenida'],
    cita: 'Los estudiantes tendrán derecho a 6 convocatorias por asignatura, no computándose las convocatorias en las que figure como "No presentado". Excepcionalmente, el Rector podrá conceder una convocatoria más a solicitud del interesado.' },

  { art: '12', pos: 3,
    q: 'Según la tabla del artículo 12 de la Normativa de permanencia de la Universidad de Almería, el máximo de cursos en estudios de Doctorado para estudiantes con diversidad funcional será de:',
    o: ['Cuatro cursos a tiempo completo y siete cursos a tiempo parcial',
        'Cinco cursos a tiempo completo y ocho cursos a tiempo parcial',
        'Ocho cursos a tiempo completo y once cursos a tiempo parcial',
        'Seis cursos a tiempo completo y nueve cursos a tiempo parcial'],
    cita: 'Doctorado (estudiantes con diversidad funcional): máximo de cursos a tiempo completo 6; máximo de cursos a tiempo parcial 9.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} de la Normativa de permanencia de la Universidad de Almería; altera el contenido del precepto.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} de la Normativa de permanencia de estudiantes en enseñanzas oficiales de la Universidad de Almería.\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]} (§2.2-ter)`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const min = Math.min(...x.o.filter((_, j) => j !== x.pos).map((o) => o.length))
    const ratio = lc / min
    if (ratio > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta ${lc} vs distractor más corto ${min} (ratio ${ratio.toFixed(2)}) — §2.2-bis`); malos++ }
  })
  console.log(malos ? `⚠️ ${malos} con desequilibrio` : '✅ equilibrio de longitud OK (§2.2-bis)')

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])).rows) arts.set(r.n, r.id)

    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`no encuentro el artículo ${item.art} de ${LEY}`)
      if ((await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])).rows.length) { console.log('  · duplicada, se salta'); continue }
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['permanencia', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
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
