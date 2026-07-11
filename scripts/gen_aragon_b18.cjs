// Batch b18 — Ley 5/2021 Aragón, CIERRE FINAL del gap: arts 42, 66, 68, 146.
// 6 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b18';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '42', n: '42.1', co: 1,
    q: 'Según el artículo 42.1 de la Ley 5/2021 de Aragón, en la normativa reguladora de los procedimientos administrativos electrónicos se deberán establecer, entre otros extremos:',
    o: [
      'Exclusivamente el plazo máximo de resolución y el sentido del silencio administrativo.',
      'Las formas de presentación de solicitudes y documentación, los medios de relación, si algún acto se produce mediante actuación automatizada y la forma de interponer los recursos.',
      'Únicamente la sede electrónica y el sistema de identificación de las personas interesadas.',
      'Solo los órganos competentes para resolver y el régimen de los recursos jurisdiccionales.',
    ],
    cita: 'En la normativa reguladora de los procedimientos administrativos [...] se deberán establecer las formas de presentación de las solicitudes y documentación por parte de las personas interesadas, los medios de relación, si alguno de los actos administrativos se va a producir mediante una actuación administrativa automatizada, y la forma y medios válidos para la interposición de los recursos administrativos correspondientes.',
    why: 'El artículo 42.1 exige fijar las formas de presentación, los medios de relación, la eventual actuación automatizada y la forma de interponer los recursos.',
    bad: { A: 'No se limita al plazo y al silencio: incluye formas de presentación, medios de relación, actuación automatizada y recursos.', C: 'No se reduce a la sede y la identificación: abarca también formas de presentación, medios de relación y recursos.', D: 'No se limita a los órganos competentes ni a los recursos jurisdiccionales, sino a los administrativos y demás extremos del precepto.' } },

  { art: '42', n: '42.4', co: 2,
    q: 'Conforme al artículo 42.4 de la Ley 5/2021 de Aragón, para la tramitación del procedimiento administrativo electrónico, los órganos de la Administración autonómica y sus organismos públicos utilizarán:',
    o: [
      'Libremente las aplicaciones que cada órgano decida desarrollar o adquirir.',
      'Exclusivamente la plataforma de intermediación de datos de la Administración General del Estado.',
      'De forma directa o a través de integración, las herramientas corporativas de administración electrónica.',
      'Las herramientas que apruebe el departamento de hacienda para cada procedimiento.',
    ],
    cita: 'Para la tramitación del procedimiento administrativo electrónico, los órganos de la Administración de la comunidad autónoma y sus organismos públicos utilizaran, de forma directa o a través de integración, las herramientas corporativas de administración electrónica.',
    why: 'El artículo 42.4 obliga a usar, de forma directa o por integración, las herramientas corporativas de administración electrónica.',
    bad: { A: 'No se usan libremente las aplicaciones de cada órgano: se usan las herramientas corporativas.', B: 'No es la plataforma de intermediación estatal, sino las herramientas corporativas de administración electrónica.', D: 'No las aprueba el departamento de hacienda para cada procedimiento: se usan las herramientas corporativas.' } },

  { art: '66', n: '66', co: 0,
    q: 'Según el artículo 66 de la Ley 5/2021 de Aragón, las reclamaciones económico-administrativas se regularán por:',
    o: [
      'Su legislación específica.',
      'La Ley 39/2015, del Procedimiento Administrativo Común.',
      'Las normas de los recursos de alzada y reposición de esta ley.',
      'La normativa autonómica de organización administrativa.',
    ],
    cita: 'Las reclamaciones económico-administrativas se regularán por su legislación específica.',
    why: 'El artículo 66 remite las reclamaciones económico-administrativas a su legislación específica.',
    bad: { B: 'No se rigen por la Ley 39/2015, sino por su legislación específica.', C: 'No se rigen por los recursos de esta ley, sino por su legislación específica.', D: 'No se rigen por la normativa de organización administrativa, sino por su legislación específica.' } },

  { art: '68', n: '68', co: 3,
    q: 'De acuerdo con el artículo 68 de la Ley 5/2021 de Aragón, en las notificaciones de los actos dictados en procedimientos cuyos recursos hayan sido sustituidos por la reclamación o impugnación deberá hacerse:',
    o: [
      'Constar el plazo de tres meses para acudir a la vía judicial.',
      'Referencia al recurso de alzada que en todo caso procede.',
      'Advertencia de que el acto no es susceptible de recurso alguno.',
      'Mención expresa de esta sustitución.',
    ],
    cita: 'En las notificaciones de los actos administrativos emitidos en los procedimientos en los que los recursos administrativos hayan sido sustituidos por la reclamación o impugnación a la que se refiere este capítulo deberá hacerse mención expresa de esta sustitución.',
    why: 'El artículo 68 obliga a hacer mención expresa de la sustitución de los recursos por la reclamación o impugnación.',
    bad: { A: 'El artículo no exige indicar un plazo de tres meses para la vía judicial, sino mención de la sustitución.', B: 'Precisamente el recurso ha sido sustituido; debe mencionarse esa sustitución, no la procedencia de la alzada.', C: 'No se advierte de la inexistencia de recurso, sino de la sustitución por reclamación o impugnación.' } },

  { art: '146', n: '146', co: 0,
    q: 'Según el artículo 146 de la Ley 5/2021 de Aragón, la Administración autonómica actuará, en el ejercicio de sus competencias, con sujeción a los deberes de colaboración y cooperación definidos en:',
    o: [
      'La legislación básica de régimen jurídico del sector público.',
      'El Estatuto de Autonomía de Aragón y su normativa de desarrollo.',
      'La legislación autonómica de organización administrativa.',
      'Los convenios de colaboración suscritos con otras administraciones.',
    ],
    cita: 'La Administración de la Comunidad Autónoma de Aragón actuará, en el ejercicio de sus competencias, con sujeción a los deberes de colaboración y cooperación definidos en la legislación básica de régimen jurídico del sector público.',
    why: 'El artículo 146 remite los deberes de colaboración y cooperación a la legislación básica de régimen jurídico del sector público.',
    bad: { B: 'No es el Estatuto de Autonomía, sino la legislación básica de régimen jurídico del sector público.', C: 'No es la normativa autonómica de organización, sino la legislación básica de régimen jurídico del sector público.', D: 'No son los convenios suscritos, sino la legislación básica de régimen jurídico del sector público.' } },

  { art: '42', n: '42.2', co: 1,
    q: 'Conforme al artículo 42.2 de la Ley 5/2021 de Aragón, podrá limitarse la presentación de solicitudes a la sede electrónica de la Administración aragonesa únicamente cuando:',
    o: [
      'El procedimiento afecte a más de un departamento de la Administración autonómica.',
      'La gestión del procedimiento se realice mediante una herramienta informática que recoja de forma individualizada los datos de las solicitudes y los incorpore en una base de datos.',
      'Así lo acuerde el Gobierno de Aragón para cada procedimiento concreto.',
      'El interesado tenga obligación legal de relacionarse electrónicamente con la Administración.',
    ],
    cita: 'Únicamente cuando la gestión del procedimiento administrativo electrónico se realice a través de una herramienta informática que recoja de forma individualizada los datos de las solicitudes de las personas interesadas y los incorpore en una base de datos se podrá limitar la presentación de dichas solicitudes a la sede electrónica de la Administración Pública aragonesa.',
    why: 'El artículo 42.2 solo permite limitar la presentación a la sede electrónica cuando una herramienta informática individualiza los datos de las solicitudes y los incorpora a una base de datos.',
    bad: { A: 'La limitación no depende de que afecte a varios departamentos, sino de la existencia de esa herramienta informática.', C: 'No depende de un acuerdo del Gobierno para cada procedimiento, sino de la herramienta informática descrita.', D: 'No depende de la obligación de relación electrónica del interesado, sino de la herramienta informática que individualiza los datos.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.n} Ley 5/2021 Aragón**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const nums = [...new Set(Q.map(q => q.art))];
  const { data: arts } = await supabase.from('articles').select('id,article_number').eq('law_id', LAW).in('article_number', nums);
  const idByNum = Object.fromEntries((arts || []).map(a => [String(a.article_number), a.id]));
  const missing = nums.filter(n => !idByNum[n]);
  if (missing.length) return console.error('❌ Faltan artículos:', missing.join(','));

  const dist = [0, 0, 0, 0];
  Q.forEach(q => dist[q.co]++);
  console.log('Distribución correct_option:', dist.map((c, i) => L[i] + ':' + c).join(' '), '(total ' + Q.length + ')');

  const rows = Q.map(item => ({
    question_text: item.q,
    option_a: item.o[0], option_b: item.o[1], option_c: item.o[2], option_d: item.o[3],
    correct_option: item.co,
    explanation: buildExplanation(item),
    difficulty: 'medium', question_type: 'single',
    primary_article_id: idByNum[item.art],
    tags: ['ia_generada', TAG],
    lifecycle_state: 'draft',
    deactivation_reason: 'Pendiente de revisión post-generación IA',
    topic_review_status: 'pending',
  }));

  const { data, error } = await supabase.from('questions').insert(rows).select('id, correct_option');
  if (error) return console.error('❌ INSERT error:', error);
  console.log('✅ Insertadas', data.length, 'preguntas DRAFT con tag', TAG);
  data.forEach((d, i) => console.log('  ', d.id, 'art', Q[i].n, 'correct', L[d.correct_option]));
})();
