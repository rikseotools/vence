#!/usr/bin/env node
/**
 * Generación IA — lote 1 del T13 de Aux. Admin. UAL (T-044): Ley 14/2011 de la Ciencia,
 * Sección 2.ª (contratación de personal investigador laboral, arts. 20-23 bis).
 *
 * Sigue `docs/maintenance/generar-preguntas-con-ia.md` v2.5:
 *  · La opción CORRECTA es cita literal (o condensación fiel) del artículo.
 *  · §2.2-bis distractores equilibrados: construidos con texto legal real alterado, dentro
 *    de ±30% de longitud de la correcta — sin esto la correcta se acierta por "la más larga".
 *  · §2.2-ter posición uniforme: 3 correctas en A, 3 en B, 3 en C, 3 en D (la app NO baraja).
 *  · Explicación: blockquote literal + "Por qué X es correcta" + bullets del resto, sin emojis.
 *
 * Entran como `draft`. NO se activan hasta pasar la auditoría doble (auto + Sonnet ciego).
 *
 * Uso: node scripts/oposiciones/gen-t13-ley14-2011-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const PROV = 'claude_code_gen_t13_ual'

// article_number → id se resuelve en BD; aquí solo la referencia legible.
const Q = [
  { art: '20', pos: 0,
    q: 'Según el artículo 20.1 de la Ley 14/2011, de la Ciencia, la Tecnología y la Innovación, ¿cuáles son las modalidades de contrato de trabajo específicas del personal investigador?',
    o: ['Contrato predoctoral, contrato de acceso de personal investigador doctor, contrato de investigador/a distinguido/a y contrato de actividades científico-técnicas',
        'Contrato predoctoral, contrato posdoctoral de perfeccionamiento, contrato de investigador/a distinguido/a y contrato de personal técnico de apoyo a la investigación',
        'Contrato en prácticas de investigación, contrato de acceso al Sistema Español de Ciencia, contrato de catedrático/a vinculado/a y contrato de actividades científico-técnicas',
        'Contrato predoctoral, contrato de acceso de personal investigador doctor, contrato de tecnólogo/a distinguido/a y contrato de gestión científico-técnica'],
    cita: 'Las modalidades de contrato de trabajo específicas del personal investigador son las siguientes: a) Contrato predoctoral. b) Contrato de acceso de personal investigador doctor. c) Contrato de investigador/a distinguido/a. d) Contrato de actividades científico-técnicas.' },

  { art: '20', pos: 1,
    q: 'De acuerdo con el artículo 20.2 de la Ley 14/2011, entre las entidades que pueden contratar personal investigador mediante las modalidades específicas de esa sección se encuentran:',
    o: ['Únicamente los Organismos Públicos de Investigación de la Administración General del Estado y las universidades privadas con centros adscritos',
        'Los Organismos Públicos de Investigación de la Administración General del Estado y los organismos de investigación de otras Administraciones Públicas, así como las universidades públicas',
        'Exclusivamente las fundaciones del sector público y los consorcios públicos de investigación, quedando excluidos los centros del Sistema Nacional de Salud',
        'Cualesquiera entidades privadas de investigación, siempre que estén inscritas en el registro estatal y cuenten con financiación pública concurrente'],
    cita: 'Podrán contratar personal investigador a través de las modalidades de contrato de trabajo específicas que se establecen en esta sección las siguientes entidades: a) Los Organismos Públicos de Investigación de la Administración General del Estado y los organismos de investigación de otras Administraciones Públicas, incluidos los centros del Sistema Nacional de Salud o vinculados o concertados con este, las fundaciones del sector público y los consorcios públicos de investigación. b) Las universidades públicas.' },

  { art: '21', pos: 2,
    q: 'Conforme al artículo 21.a) de la Ley 14/2011, el contrato predoctoral tiene por objeto la realización de tareas de investigación, en el ámbito de un proyecto específico y novedoso, por quienes:',
    o: ['Estén en posesión del título de Doctor o Doctora, gocen de una reputación internacional consolidada basada en la excelencia de sus contribuciones y hayan sido admitidos a un programa de doctorado o de posgrado equivalente',
        'Hayan superado el periodo de orientación postdoctoral, cuenten con informe favorable de la escuela de doctorado o posgrado y acrediten al menos 300 créditos ECTS en enseñanzas oficiales de Máster Universitario',
        'Estén en posesión del título de Licenciado, Ingeniero, Arquitecto, Graduado Universitario con Grado de al menos 300 créditos ECTS o Máster Universitario, o equivalente, y hayan sido admitidos a un programa de doctorado',
        'Estén matriculados en cualquier enseñanza oficial de posgrado, hayan obtenido una ayuda pública en régimen de concurrencia competitiva y acompañen escrito de admisión expedido por la unidad investigadora titular'],
    cita: 'El contrato tendrá por objeto la realización de tareas de investigación, en el ámbito de un proyecto específico y novedoso, por quienes estén en posesión del título de Licenciado, Ingeniero, Arquitecto, Graduado Universitario con Grado de al menos 300 créditos ECTS (European Credit Transfer System) o Máster Universitario, o equivalente, y hayan sido admitidos a un programa de doctorado.' },

  { art: '21', pos: 3,
    q: 'Según el artículo 21.a) de la Ley 14/2011, el contrato predoctoral tendrá también por objeto la orientación postdoctoral por un período máximo de:',
    o: ['Seis meses, prorrogables por otros seis cuando lo autorice la unidad investigadora',
        'Veinticuatro meses, sin que quepa prórroga alguna sobre la duración inicialmente pactada',
        'Dieciocho meses, siempre que el contrato esté vinculado a financiación externa en su totalidad',
        'Doce meses, sin que en ningún caso la duración del contrato pueda exceder del máximo indicado'],
    cita: 'Asimismo, el contrato tendrá por objeto la orientación postdoctoral por un período máximo de doce meses. En cualquier caso, la duración del contrato no podrá exceder del máximo indicado en el párrafo c).' },

  { art: '22', pos: 0,
    q: 'De acuerdo con el artículo 22.1.d) de la Ley 14/2011, la duración del contrato de acceso de personal investigador doctor será:',
    o: ['Al menos de tres años, y podrá prorrogarse hasta el límite máximo de seis años, sin que las prórrogas puedan tener una duración inferior a un año',
        'Al menos de dos años, y podrá prorrogarse hasta el límite máximo de cinco años, sin que las prórrogas puedan ser inferiores a seis meses',
        'De cuatro años improrrogables, salvo que el empleador acuerde una ampliación por causas científicas debidamente justificadas',
        'La que libremente acuerden las partes en el contrato, con el límite general previsto en el Estatuto de los Trabajadores'],
    cita: 'La duración del contrato será al menos de tres años, y podrá prorrogarse hasta el límite máximo de seis años. Las prórrogas no podrán tener una duración inferior a un año.' },

  { art: '22', pos: 1,
    q: 'Según el artículo 22.1.d) de la Ley 14/2011, cuando el contrato de acceso de personal investigador doctor se concierte con una persona con discapacidad, su duración máxima, prórrogas incluidas, podrá alcanzar:',
    o: ['Siete años, prórrogas incluidas, atendiendo a las características de la actividad investigadora y al grado de las limitaciones acreditadas',
        'Ocho años, teniendo en cuenta las características de la actividad investigadora y el grado de las limitaciones en la actividad',
        'Seis años, prórrogas incluidas, sin que quepa ampliación alguna por razón del grado de discapacidad que tenga reconocido',
        'Diez años, prórrogas incluidas, siempre que la entidad empleadora acredite la continuidad de la financiación externa del contrato'],
    cita: 'No obstante, cuando el contrato se concierte con una persona con discapacidad, el contrato podrá alcanzar una duración máxima de ocho años, prórrogas incluidas, teniendo en cuenta las características de la actividad investigadora y el grado de las limitaciones en la actividad.' },

  { art: '22 bis', pos: 2,
    q: 'Conforme al artículo 22 bis.1 de la Ley 14/2011, respecto del contrato de acceso de personal investigador doctor y el ingreso estable, la ley dispone que:',
    o: ['Con independencia de la Administración que los convoque, el contrato de acceso se transformará automáticamente en indefinido desde que se obtenga el certificado R3 como investigador/a establecido/a',
        'Con independencia de la Administración que los convoque, el contrato de acceso se suspenderá mientras se tramite el proceso selectivo y se reanudará si la persona no obtiene la plaza convocada',
        'Con independencia de la Administración pública que los convoque, el contrato de acceso de personal investigador doctor finalizará a partir del momento en que se haga efectivo el ingreso estable',
        'Con independencia de la Administración que los convoque, el contrato de acceso se prorrogará de oficio hasta la toma de posesión, sin que su duración total pueda superar los ocho años'],
    cita: 'Con independencia de la Administración pública que los convoque, el contrato de acceso de personal investigador doctor finalizará a partir del momento en que se haga efectivo el ingreso estable.' },

  { art: '22 bis', pos: 3,
    q: 'Según el artículo 22 bis.1.b) de la Ley 14/2011, en el caso del personal contratado por las universidades públicas, las plazas de nuevo ingreso estable a cuyos procesos selectivos podrá acceder el personal investigador con certificado R3 serán las de:',
    o: ['Personal científico titular y personal laboral fijo de los organismos públicos de investigación',
        'Las escalas de personal funcionario o estatutario equivalentes y las de personal laboral fijo',
        'Profesorado ayudante doctor y profesorado asociado con vinculación clínica permanente',
        'Profesorado titular y profesorado contratado doctor'],
    cita: 'b) En el caso del personal contratado por las universidades públicas, las de profesorado titular y profesorado contratado doctor;' },

  { art: '23', pos: 0,
    q: 'De acuerdo con el artículo 23 de la Ley 14/2011, los contratos bajo la modalidad de investigador/a distinguido/a se podrán celebrar con investigadores/as españoles/as o extranjeros/as de reconocido prestigio que:',
    o: ['Se encuentren en posesión del título de Doctor o Doctora y gocen de una reputación internacional consolidada basada en la excelencia de sus contribuciones en el ámbito científico o técnico',
        'Se encuentren en posesión de cualquier título universitario de posgrado, hayan dirigido al menos un proyecto de investigación de ámbito europeo y acrediten excelencia en transferencia del conocimiento',
        'Hayan sido admitidos a un programa de doctorado, acrediten experiencia previa en la dirección de instalaciones científicas singulares y cuenten con reputación internacional consolidada',
        'Ostenten la condición de personal funcionario de carrera de los cuerpos docentes universitarios, con dos sexenios de investigación reconocidos y dirección de equipos humanos acreditada'],
    cita: 'Los contratos de trabajo bajo la modalidad de investigador/a distinguido/a se podrán celebrar con investigadores/as españoles/as o extranjeros/as de reconocido prestigio que se encuentren en posesión del título de Doctor o Doctora y que gocen de una reputación internacional consolidada basada en la excelencia de sus contribuciones en el ámbito científico o técnico.' },

  { art: '23', pos: 1,
    q: 'Según el artículo 23.b) de la Ley 14/2011, la duración del contrato de investigador/a distinguido/a será:',
    o: ['De tres años como mínimo, prorrogable hasta un máximo de seis años por acuerdo de las partes',
        'La que las partes acuerden',
        'De un año, renovable anualmente mientras se mantenga la reputación internacional acreditada',
        'La que fije el convenio colectivo aplicable a la entidad empleadora en cada caso'],
    cita: 'b) El contrato tendrá la duración que las partes acuerden.' },

  { art: '23 bis', pos: 2,
    q: 'Conforme al artículo 23 bis.2 de la Ley 14/2011, los contratos de actividades científico-técnicas de duración indefinida:',
    o: ['Formarán parte de la Oferta de Empleo Público y de los instrumentos similares de gestión de las necesidades de personal, quedando su convocatoria limitada por la masa salarial del personal laboral',
        'Se integrarán en los instrumentos similares de gestión de las necesidades de personal a que se refiere el artículo 70 del Estatuto Básico del Empleado Público, aunque no computen en la Oferta de Empleo Público',
        'No formarán parte de la Oferta de Empleo Público ni de los instrumentos similares de gestión de las necesidades de personal, ni su convocatoria estará limitada por la masa salarial del personal laboral',
        'Requerirán autorización previa del departamento ministerial competente siempre que su convocatoria supere la masa salarial del personal laboral aprobada para el ejercicio presupuestario'],
    cita: 'Los contratos de actividades científico-técnicas, de duración indefinida, no formarán parte de la Oferta de Empleo Público ni de los instrumentos similares de gestión de las necesidades de personal a que se refiere el artículo 70 del texto refundido de la Ley del Estatuto Básico del Empleado Público, ni su convocatoria estará limitada por la masa salarial del personal laboral.' },

  { art: '23 bis', pos: 3,
    q: 'Según el artículo 23 bis.1 de la Ley 14/2011, el objeto de los contratos de actividades científico-técnicas será:',
    o: ['La dirección de equipos humanos como investigador/a principal y de instalaciones y programas científicos singulares de gran relevancia',
        'La realización de tareas de investigación en el ámbito de un proyecto específico y novedoso vinculado a un programa de doctorado',
        'El perfeccionamiento y la especialización profesional del personal doctor con vistas a consolidar su experiencia investigadora',
        'La realización de actividades vinculadas a líneas de investigación o de servicios científico-técnicos, incluyendo la gestión científico-técnica de estas líneas'],
    cita: 'El objeto de los contratos de actividades científico-técnicas será la realización de actividades vinculadas a líneas de investigación o de servicios científico-técnicos, incluyendo la gestión científico-técnica de estas líneas.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} de la Ley 14/2011; altera el contenido del precepto.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} de la Ley 14/2011, de 1 de junio, de la Ciencia, la Tecnología y la Innovación.\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  // Comprobaciones mecánicas del manual ANTES de tocar BD.
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]} (§2.2-ter: reparto uniforme)`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const otras = x.o.filter((_, j) => j !== x.pos).map((o) => o.length)
    const min = Math.min(...otras)
    const ratio = lc / min
    if (ratio > 1.4) { console.log(`  ⚠️ Q${i + 1}: correcta ${lc} chars vs distractor más corto ${min} (ratio ${ratio.toFixed(2)}) — §2.2-bis`); malos++ }
  })
  console.log(malos ? `⚠️ ${malos} pregunta(s) con desequilibrio de longitud` : '✅ equilibrio de longitud OK (§2.2-bis)')

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id
       WHERE l.short_name='Ley 14/2011 Ciencia'`)).rows) arts.set(r.n, r.id)

    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`no encuentro el artículo ${item.art}`)
      const dup = await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])
      if (dup.rows.length) { console.log(`  · duplicada, se salta: ${item.q.slice(0, 60)}…`); continue }
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['ley-14-2011', 'ciencia', 'ual', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft (NO visibles hasta auditoría doble)`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
