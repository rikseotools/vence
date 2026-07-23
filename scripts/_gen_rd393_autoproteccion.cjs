// T8 refuerzo — RD 393/2007 (Norma Básica de Autoprotección). Crea la norma con su texto LITERAL
// (definiciones Anexo III + capítulos Anexo II + objeto/ámbito/obligaciones) y 10 preguntas DRAFT.
// Fuente: BOE-A-2007-6237 (texto consolidado). Cita literal en la correcta. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const SLUG = 'rd-393-2007-norma-basica-autoproteccion';
const TAG = 'piloto_rd393_autoproteccion_t8';
const L = ['A', 'B', 'C', 'D'];

const ARTICLES = [
  { n: '1', title: 'Objeto, ámbito de aplicación y obligaciones de los titulares',
    content: `Se aprueba la Norma Básica de Autoprotección de los centros, establecimientos y dependencias, dedicados a actividades que puedan dar origen a situaciones de emergencia (artículo 1).

Las disposiciones de este real decreto se aplicarán a todas las actividades comprendidas en el anexo I de la Norma Básica de Autoprotección (artículo 2.1).

Entre las obligaciones de los titulares de las actividades figuran: elaborar el Plan de Autoprotección conforme al contenido mínimo del Anexo II; presentarlo al órgano competente; desarrollar su implantación y mantenimiento; informar y formar al personal; facilitar su integración en planes de ámbito superior; y informar con antelación sobre la realización de simulacros (artículo 1.4).` },
  { n: 'anexo-iii', title: 'Definiciones (Anexo III)',
    content: `**Autoprotección:** «Sistema de acciones y medidas, adoptadas por los titulares de las actividades, públicas o privadas, con sus propios medios y recursos, dentro de su ámbito de competencias, encaminadas a prevenir y controlar los riesgos sobre las personas y los bienes, a dar respuesta adecuada a las posibles situaciones de emergencia y a garantizar la integración de estas actuaciones en el sistema público de protección civil.»

**Plan de Autoprotección:** «Marco orgánico y funcional previsto para una actividad, centro, establecimiento, espacio, instalación o dependencia, con el objeto de prevenir y controlar los riesgos sobre las personas y los bienes y dar respuesta adecuada a las posibles situaciones de emergencias, en la zona bajo responsabilidad del titular, garantizando la integración de éstas actuaciones en el sistema público de protección civil.»

**Plan de actuación en emergencias:** «Documento perteneciente al plan de autoprotección en el que se prevé la organización de la respuesta ante situaciones de emergencias clasificadas, las medidas de protección e intervención a adoptar, y los procedimientos y secuencia de actuación para dar respuesta a las posibles emergencias.»` },
  { n: 'anexo-ii', title: 'Contenido mínimo del Plan de Autoprotección (Anexo II)',
    content: `El contenido mínimo del Plan de Autoprotección se estructura en 9 capítulos:

1. Identificación de los titulares y del emplazamiento de la actividad.
2. Descripción detallada de la actividad y del medio físico en el que se desarrolla.
3. Inventario, análisis y evaluación de riesgos.
4. Inventario y descripción de las medidas y medios de autoprotección.
5. Programa de mantenimiento de instalaciones.
6. Plan de actuación ante emergencias.
7. Integración del plan de autoprotección en otros de ámbito superior.
8. Implantación del Plan de Autoprotección.
9. Mantenimiento de la eficacia y actualización del Plan de Autoprotección.` },
];

const Q = [
  { art: 'anexo-iii', co: 0,
    q: 'Según el RD 393/2007, el sistema de acciones y medidas adoptadas por los titulares de las actividades, con sus propios medios y recursos, para prevenir y controlar los riesgos sobre las personas y los bienes y dar respuesta a las emergencias, se denomina:',
    o: ['Autoprotección.', 'Plan de actuación en emergencias.', 'Protección civil.', 'Prevención de riesgos laborales.'],
    cita: 'Autoprotección: Sistema de acciones y medidas, adoptadas por los titulares de las actividades... con sus propios medios y recursos... encaminadas a prevenir y controlar los riesgos sobre las personas y los bienes, a dar respuesta adecuada a las posibles situaciones de emergencia...',
    why: 'Es la definición de autoprotección del Anexo III.',
    bad: { B: 'El plan de actuación en emergencias es un documento del plan de autoprotección, no el sistema de acciones y medidas.', C: 'La protección civil es el sistema público en el que se integra la autoprotección, no el sistema de medios propios del titular.', D: 'La prevención de riesgos laborales se rige por la Ley 31/1995 y tiene otro objeto.' } },
  { art: 'anexo-iii', co: 1,
    q: 'Conforme al RD 393/2007, el «marco orgánico y funcional previsto para una actividad, centro, establecimiento, espacio, instalación o dependencia» para prevenir y controlar los riesgos y dar respuesta a las emergencias es el:',
    o: ['Plan de actuación en emergencias.', 'Plan de Autoprotección.', 'Plan territorial de protección civil.', 'Plan de emergencia exterior.'],
    cita: 'Plan de Autoprotección: Marco orgánico y funcional previsto para una actividad, centro, establecimiento, espacio, instalación o dependencia, con el objeto de prevenir y controlar los riesgos sobre las personas y los bienes y dar respuesta adecuada a las posibles situaciones de emergencias...',
    why: 'Es la definición de Plan de Autoprotección del Anexo III.',
    bad: { A: 'El plan de actuación en emergencias es un documento que forma parte del plan de autoprotección.', C: 'Los planes territoriales corresponden a la protección civil de las administraciones, no al titular de la actividad.', D: 'El plan de emergencia exterior es un instrumento distinto, propio de determinadas actividades de riesgo.' } },
  { art: 'anexo-iii', co: 3,
    q: 'Según el RD 393/2007, el documento perteneciente al plan de autoprotección en el que se prevé la organización de la respuesta ante situaciones de emergencias clasificadas es el:',
    o: ['Plan de Autoprotección.', 'Manual de seguridad.', 'Plan de evacuación.', 'Plan de actuación en emergencias.'],
    cita: 'Plan de actuación en emergencias: Documento perteneciente al plan de autoprotección en el que se prevé la organización de la respuesta ante situaciones de emergencias clasificadas, las medidas de protección e intervención a adoptar...',
    why: 'Es la definición de plan de actuación en emergencias del Anexo III.',
    bad: { A: 'El plan de autoprotección es el marco general; el de actuación en emergencias es un documento dentro de él.', B: 'La norma no define un «manual de seguridad» con ese contenido.', C: 'El plan de evacuación no es la denominación que emplea la norma para ese documento.' } },
  { art: 'anexo-iii', co: 0,
    q: 'De acuerdo con la definición de autoprotección del RD 393/2007, las actuaciones de los titulares deben garantizar su integración en:',
    o: ['El sistema público de protección civil.', 'El Sistema Nacional de Salud.', 'La Inspección de Trabajo y Seguridad Social.', 'El Catálogo Nacional de actividades peligrosas.'],
    cita: '...y a garantizar la integración de estas actuaciones en el sistema público de protección civil.',
    why: 'La definición de autoprotección exige garantizar la integración en el sistema público de protección civil.',
    bad: { B: 'No se integra en el Sistema Nacional de Salud.', C: 'La Inspección de Trabajo no es el sistema de integración que cita la norma.', D: 'La integración es en el sistema público de protección civil, no en un catálogo de actividades.' } },
  { art: 'anexo-ii', co: 2,
    q: 'El contenido mínimo del Plan de Autoprotección se establece en el Anexo II del RD 393/2007, estructurado en:',
    o: ['5 capítulos.', '7 capítulos.', '9 capítulos.', '12 capítulos.'],
    cita: 'El contenido mínimo del Plan de Autoprotección se estructura en 9 capítulos (Anexo II).',
    why: 'El Anexo II ordena el contenido mínimo del Plan de Autoprotección en 9 capítulos.',
    bad: { A: 'No son 5 capítulos.', B: 'No son 7 capítulos.', D: 'No son 12 capítulos.' } },
  { art: 'anexo-ii', co: 3,
    q: 'Según el Anexo II del RD 393/2007, el capítulo 6 del contenido mínimo del Plan de Autoprotección es:',
    o: ['Inventario, análisis y evaluación de riesgos.', 'Programa de mantenimiento de instalaciones.', 'Implantación del Plan de Autoprotección.', 'Plan de actuación ante emergencias.'],
    cita: 'Capítulo 6. Plan de actuación ante emergencias (Anexo II).',
    why: 'El capítulo 6 del Anexo II es el «Plan de actuación ante emergencias».',
    bad: { A: 'El inventario, análisis y evaluación de riesgos es el capítulo 3.', B: 'El programa de mantenimiento de instalaciones es el capítulo 5.', C: 'La implantación del Plan de Autoprotección es el capítulo 8.' } },
  { art: 'anexo-ii', co: 0,
    q: 'Conforme al Anexo II del RD 393/2007, el primer capítulo del contenido mínimo del Plan de Autoprotección se dedica a:',
    o: ['La identificación de los titulares y del emplazamiento de la actividad.', 'El inventario y descripción de los medios de autoprotección.', 'La descripción detallada de la actividad y del medio físico.', 'La evaluación de los riesgos de la actividad.'],
    cita: 'Capítulo 1. Identificación de los titulares y del emplazamiento de la actividad (Anexo II).',
    why: 'El capítulo 1 del Anexo II es la identificación de los titulares y del emplazamiento de la actividad.',
    bad: { B: 'El inventario y descripción de medios de autoprotección es el capítulo 4.', C: 'La descripción detallada de la actividad y del medio físico es el capítulo 2.', D: 'El inventario, análisis y evaluación de riesgos es el capítulo 3.' } },
  { art: '1', co: 1,
    q: 'El RD 393/2007 aprueba la Norma Básica de Autoprotección de los centros, establecimientos y dependencias dedicados a actividades que:',
    o: ['Empleen a más de cincuenta trabajadores.', 'Puedan dar origen a situaciones de emergencia.', 'Manipulen productos alimentarios.', 'Se ubiquen en edificios de titularidad pública.'],
    cita: 'Se aprueba la Norma Básica de Autoprotección de los centros, establecimientos y dependencias, dedicados a actividades que puedan dar origen a situaciones de emergencia.',
    why: 'El artículo 1 vincula la Norma Básica a las actividades que puedan dar origen a situaciones de emergencia.',
    bad: { A: 'El criterio no es el número de trabajadores.', C: 'No se limita a actividades de manipulación de alimentos.', D: 'No se restringe a edificios de titularidad pública.' } },
  { art: '1', co: 2,
    q: 'Según el RD 393/2007, sus disposiciones se aplicarán a todas las actividades comprendidas en:',
    o: ['El Reglamento de los Servicios de Prevención.', 'El Código Técnico de la Edificación.', 'El Anexo I de la Norma Básica de Autoprotección.', 'El Anexo II del propio Real Decreto.'],
    cita: 'Las disposiciones de este real decreto se aplicarán a todas las actividades comprendidas en el anexo I de la Norma Básica de Autoprotección.',
    why: 'El artículo 2.1 delimita el ámbito por las actividades del Anexo I de la Norma Básica.',
    bad: { A: 'El Reglamento de los Servicios de Prevención regula otra materia.', B: 'El CTE regula la edificación, no el ámbito de esta norma.', D: 'El Anexo II fija el contenido del plan, no el ámbito de aplicación (que es el Anexo I).' } },
  { art: '1', co: 1,
    q: 'Entre las obligaciones de los titulares de las actividades, el RD 393/2007 incluye expresamente:',
    o: ['Contratar un seguro de responsabilidad civil obligatorio.', 'Informar con antelación sobre la realización de simulacros.', 'Comunicar mensualmente los riesgos a la Inspección de Trabajo.', 'Designar un delegado de prevención por cada centro.'],
    cita: 'Entre las obligaciones de los titulares... informar con antelación sobre la realización de simulacros (artículo 1.4).',
    why: 'El artículo 1.4 incluye informar con antelación sobre los simulacros entre las obligaciones del titular.',
    bad: { A: 'La norma no impone ese seguro de responsabilidad civil como obligación de autoprotección.', C: 'No establece una comunicación mensual de riesgos a la Inspección de Trabajo.', D: 'El delegado de prevención es una figura de la LPRL, no una obligación de esta norma.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **RD 393/2007, Norma Básica de Autoprotección**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    let lawId;
    const ex = await c.query('SELECT id FROM laws WHERE slug=$1', [SLUG]);
    if (ex.rowCount) { lawId = ex.rows[0].id; }
    else {
      const law = await c.query(
        `INSERT INTO laws (name, short_name, type, slug, is_virtual, scope, is_active, verification_status, boe_url, description)
         VALUES ($1,$2,'regulation',$3,false,'national',true,'no_monitoreable',$4,$5) RETURNING id`,
        ['Real Decreto 393/2007, de 23 de marzo, por el que se aprueba la Norma Básica de Autoprotección de los centros, establecimientos y dependencias dedicados a actividades que puedan dar origen a situaciones de emergencia',
         'RD 393/2007', SLUG, 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-6237',
         'Norma Básica de Autoprotección. Contenido extraído del texto consolidado del BOE (BOE-A-2007-6237).']);
      lawId = law.rows[0].id;
      console.log('✅ ley RD 393/2007 creada:', lawId);
    }
    for (const a of ARTICLES) {
      const has = await c.query('SELECT 1 FROM articles WHERE law_id=$1 AND article_number=$2', [lawId, a.n]);
      if (!has.rowCount) await c.query('INSERT INTO articles (law_id, article_number, title, content, is_active) VALUES ($1,$2,$3,$4,true)', [lawId, a.n, a.title, a.content]);
    }
    const arts = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [lawId]);
    const idByNum = Object.fromEntries(arts.rows.map(a => [String(a.article_number), a.id]));

    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.co]++);
    console.log('Distribución correct_option:', dist.map((n, i) => L[i] + ':' + n).join(' '));

    for (const item of Q) {
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
           difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.co, buildExplanation(item), idByNum[item.art], ['ia_generada', TAG]]);
    }
    // añadir la ley al scope de T8
    const t8 = (await c.query("SELECT id FROM topics WHERE position_type='ordenanza_ayuntamiento_cordoba' AND topic_number=8")).rows[0].id;
    const inScope = await c.query('SELECT 1 FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [t8, lawId]);
    if (!inScope.rowCount) await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, include_full_title, include_full_chapter, weight) VALUES ($1,$2,NULL,false,false,1.0)', [t8, lawId]);

    await c.query('COMMIT');
    console.log('✅ 10 preguntas DRAFT RD 393/2007 + añadida al scope de T8');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
