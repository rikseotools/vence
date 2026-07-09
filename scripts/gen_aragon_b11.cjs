// Batch b11 — Ley 5/2021 Aragón, arts 35-46 (potestad sancionadora, resp. patrimonial,
// administración electrónica, dato único, colaboración). 15 preguntas DRAFT.
// Resuelve article_id por número (evita transcripción de UUID). Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b11';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '35', n: '35.1', co: 1,
    q: 'Según el artículo 35.1 de la Ley 5/2021 de Aragón, la potestad sancionadora se ejercerá:',
    o: [
      'Cuando haya sido reconocida por una norma reglamentaria, conforme a los principios de la Ley 39/2015 y con el procedimiento de la Ley 40/2015.',
      'Cuando haya sido expresamente reconocida por una norma con rango de ley, de acuerdo con los principios de la Ley 40/2015 y con el procedimiento de la Ley 39/2015.',
      'En todo caso por cualquier órgano administrativo, conforme a los principios y al procedimiento establecidos en la Ley 40/2015.',
      'Cuando lo acuerde el Gobierno de Aragón, de acuerdo con los principios de la Ley 39/2015 y con el procedimiento de la Ley 40/2015.',
    ],
    cita: 'La potestad sancionadora se ejercerá cuando haya sido expresamente reconocida por una norma con rango de ley, de acuerdo con los principios establecidos en la Ley 40/2015, de Régimen Jurídico del Sector Público, y con aplicación del procedimiento previsto en la Ley 39/2015, del Procedimiento Administrativo Común.',
    why: 'El artículo 35.1 exige reconocimiento por norma con rango de ley, los principios de la Ley 40/2015 y el procedimiento de la Ley 39/2015.',
    bad: { A: 'No basta una norma reglamentaria: se exige norma con rango de ley; además, los principios son de la 40/2015 y el procedimiento de la 39/2015.', C: 'No la ejerce cualquier órgano en todo caso: requiere reconocimiento por ley y atribución expresa.', D: 'No depende de un acuerdo del Gobierno, sino del reconocimiento por norma con rango de ley.' } },

  { art: '35', n: '35.3.a)', co: 2,
    q: 'Conforme al artículo 35.3 de la Ley 5/2021 de Aragón, salvo previsión legal o reglamentaria expresa, la imposición de sanciones de cuantía hasta doce mil euros corresponde a:',
    o: [
      'La persona titular de la dirección general u órganos asimilados competentes por razón de la materia.',
      'Quien ostente la titularidad del departamento competente por razón de la materia.',
      'Quienes ostenten la titularidad de la dirección del servicio provincial u órganos asimilados competentes por razón de la materia.',
      'El secretario general técnico del departamento competente por razón de la materia.',
    ],
    cita: 'Hasta doce mil euros a quienes ostenten la titularidad de la dirección del servicio provincial u órganos asimilados que resulten competentes por razón de la materia.',
    why: 'La letra a) del artículo 35.3 atribuye las sanciones de hasta doce mil euros a la dirección del servicio provincial u órganos asimilados.',
    bad: { A: 'La dirección general corresponde al tramo superior a doce mil y hasta treinta mil euros (letra b).', B: 'La titularidad del departamento se reserva a las sanciones superiores a treinta mil euros (letra c).', D: 'El secretario general técnico no es el órgano sancionador de este tramo de cuantía.' } },

  { art: '35', n: '35.3.c)', co: 0,
    q: 'Según el artículo 35.3 de la Ley 5/2021 de Aragón, salvo previsión específica, la imposición de sanciones cuya cuantía supere los treinta mil euros queda reservada, en todo caso, a:',
    o: [
      'Quienes ostenten la titularidad de los departamentos.',
      'Quienes ostenten la titularidad de la dirección general competente por la materia.',
      'El Gobierno de Aragón, a propuesta del departamento competente.',
      'Quienes ostenten la titularidad de la dirección del servicio provincial.',
    ],
    cita: 'En todo caso, queda reservada a quienes ostenten la titularidad de los departamentos la imposición de sanciones cuya cuantía supere los treinta mil euros.',
    why: 'La letra c) del artículo 35.3 reserva a la titularidad de los departamentos las sanciones superiores a treinta mil euros.',
    bad: { B: 'La dirección general corresponde al tramo de doce mil a treinta mil euros, no al superior.', C: 'La competencia se reserva a la titularidad del departamento, no al Gobierno de Aragón.', D: 'La dirección del servicio provincial sanciona hasta doce mil euros, no por encima de treinta mil.' } },

  { art: '35', n: '35.3.b)', co: 3,
    q: 'De acuerdo con el artículo 35.3 de la Ley 5/2021 de Aragón, las sanciones cuya cuantía supere los doce mil euros y hasta treinta mil euros corresponden a:',
    o: [
      'Quien ostente la titularidad de la dirección del servicio provincial competente por razón de la materia.',
      'Quien ostente la titularidad del departamento competente por razón de la materia.',
      'El secretario general técnico competente por razón de la materia.',
      'La persona titular de la dirección general u órganos asimilados competentes por razón de la materia.',
    ],
    cita: 'Sanciones cuya cuantía supere los doce mil euros hasta treinta mil euros a la persona titular de la dirección general u órganos asimilados que resulten competentes por razón de la materia.',
    why: 'La letra b) del artículo 35.3 atribuye el tramo de doce mil a treinta mil euros a la dirección general u órganos asimilados.',
    bad: { A: 'La dirección del servicio provincial sanciona hasta doce mil euros (letra a).', B: 'La titularidad del departamento se reserva a las sanciones superiores a treinta mil euros (letra c).', C: 'El secretario general técnico no es el órgano sancionador de este tramo.' } },

  { art: '36', n: '36.2', co: 0,
    q: 'Según el artículo 36.2 de la Ley 5/2021 de Aragón, en los procedimientos de responsabilidad patrimonial la resolución competerá, en todo caso, salvo que una ley atribuya la competencia al Gobierno, a:',
    o: [
      'Quien sea titular del departamento correspondiente por razón de la materia.',
      'Quien sea titular de la dirección general correspondiente por razón de la materia.',
      'El Gobierno de Aragón en todo caso, a propuesta del departamento competente.',
      'Quien sea titular de la secretaría general técnica del departamento competente.',
    ],
    cita: 'La resolución competerá, en todo caso, a quien sea titular del departamento correspondiente por razón de la materia, salvo que una ley atribuya la competencia al Gobierno.',
    why: 'El artículo 36.2 atribuye la resolución a la titularidad del departamento competente por la materia, salvo atribución legal al Gobierno.',
    bad: { B: 'La competencia es de la titularidad del departamento, no de la dirección general.', C: 'El Gobierno solo resuelve cuando una ley se lo atribuya; la regla general es la titularidad del departamento.', D: 'No corresponde a la secretaría general técnica, sino a la titularidad del departamento.' } },

  { art: '38', n: '38.2', co: 1,
    q: 'Conforme al artículo 38.2 de la Ley 5/2021 de Aragón, la sede electrónica de la Administración pública de la Comunidad Autónoma de Aragón:',
    o: [
      'Será múltiple, una por cada departamento de la Administración autonómica y sus organismos autónomos.',
      'Será única, y su ámbito de aplicación es el conjunto de departamentos de la Administración autonómica, sus organismos autónomos y entidades de derecho público.',
      'Será única, pero su ámbito de aplicación se limita a los departamentos, excluyendo a los organismos autónomos.',
      'Será propia de cada organismo autónomo y entidad de derecho público, con una sede común solo para los departamentos.',
    ],
    cita: 'La sede electrónica de la Administración pública de la Comunidad Autónoma de Aragón será única y su ámbito de aplicación es el conjunto de departamentos de la Administración de la comunidad autónoma, sus organismos autónomos y entidades de derecho público.',
    why: 'El artículo 38.2 declara la sede única y la extiende a departamentos, organismos autónomos y entidades de derecho público.',
    bad: { A: 'La sede es única, no múltiple por departamento.', C: 'El ámbito no excluye a los organismos autónomos: los incluye.', D: 'No hay sede propia por organismo: la sede es única para todo el ámbito.' } },

  { art: '39', n: '39.1', co: 2,
    q: 'Según el artículo 39.1 de la Ley 5/2021 de Aragón, el Portal de Internet de la Administración pública de la Comunidad Autónoma de Aragón es:',
    o: [
      'www.aragon.es, sede electrónica única desde la que se realizan todos los trámites que requieren autentificación.',
      'sede.aragon.es, punto de entrada electrónico que permite el acceso a la información publicada y a los trámites.',
      'www.aragon.es, punto de entrada electrónico que permite el acceso a la información publicada y a la sede electrónica.',
      'www.gobiernodearagon.es, punto de acceso general a la información y a las sedes asociadas de los departamentos.',
    ],
    cita: 'El Portal de Internet de la Administración pública de la Comunidad Autónoma de Aragón es www.aragon.es, punto de entrada electrónico de su titularidad que permite el acceso a través de Internet a la información publicada y a la sede electrónica de la Administración pública de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 39.1 identifica el Portal como www.aragon.es, punto de entrada que da acceso a la información publicada y a la sede electrónica.',
    bad: { A: 'El Portal no es la sede electrónica; los trámites con autentificación se hacen desde la sede (art. 39.5).', B: 'La dirección del Portal es www.aragon.es, no sede.aragon.es.', D: 'La dirección del Portal es www.aragon.es, no www.gobiernodearagon.es.' } },

  { art: '39', n: '39.5', co: 3,
    q: 'De acuerdo con el artículo 39.5 de la Ley 5/2021 de Aragón, los trámites electrónicos y publicaciones oficiales que requieran autentificación tendrán que realizarse:',
    o: [
      'Desde el Portal de Internet de la Administración pública de la Comunidad Autónoma de Aragón.',
      'Indistintamente desde la sede electrónica o desde el Portal de Internet de la Administración autonómica.',
      'Desde los portales asociados creados por los departamentos competentes en la materia.',
      'Desde la sede de la Administración Pública de la Comunidad Autónoma de Aragón, y no desde el Portal de Internet.',
    ],
    cita: 'Los trámites electrónicos y publicaciones oficiales que requieran autentificación tendrán que realizarse desde la sede de la Administración Pública de la Comunidad Autónoma de Aragón y no desde el Portal de Internet de la Administración Pública de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 39.5 reserva los trámites con autentificación a la sede electrónica, excluyendo el Portal de Internet.',
    bad: { A: 'Es justo lo contrario: no se hacen desde el Portal, sino desde la sede.', B: 'No es indistinto: deben realizarse desde la sede, no desde el Portal.', C: 'Deben realizarse desde la sede de la Administración autonómica, no desde los portales asociados.' } },

  { art: '40', n: '40.1', co: 0,
    q: 'Según el artículo 40.1 de la Ley 5/2021 de Aragón, la sede electrónica y sedes asociadas utilizarán como sistema de identificación y firma de los usuarios:',
    o: [
      'Cl@ve, Sistema de Identificación y Firma Electrónica utilizado por la Administración General del Estado, o sistema equivalente que se desarrolle por esta.',
      'Exclusivamente el certificado electrónico reconocido emitido por la Fábrica Nacional de Moneda y Timbre.',
      'Un sistema propio de identificación y firma desarrollado por la Comunidad Autónoma de Aragón.',
      'El DNI electrónico como único medio de identificación y firma admitido en la sede electrónica.',
    ],
    cita: 'La sede electrónica y sedes asociadas de la Administración pública de la Comunidad Autónoma de Aragón utilizarán como sistema de identificación y firma de los usuarios Cl@ve, Sistema de Identificación y Firma Electrónica utilizado por la Administración general del Estado, o sistema equivalente que se desarrolle por esta.',
    why: 'El artículo 40.1 fija Cl@ve (o sistema equivalente) como sistema de identificación y firma de los usuarios.',
    bad: { B: 'No se limita al certificado de la FNMT; el sistema es Cl@ve o equivalente.', C: 'No es un sistema propio de Aragón, sino Cl@ve, el de la Administración General del Estado.', D: 'No se limita al DNI electrónico como único medio.' } },

  { art: '41', n: '41.3', co: 1,
    q: 'Conforme al artículo 41.3 de la Ley 5/2021 de Aragón, en caso de discrepancia entre la información de los portales o sedes asociadas y la del Catálogo de Servicios, se considerará información válida frente a terceros:',
    o: [
      'La que conste en la sede electrónica general de la Administración autonómica.',
      'La que conste en el Catálogo de Servicios.',
      'La que conste en el «Boletín Oficial de Aragón» en la fecha de su publicación.',
      'La que conste en el portal o sede asociada del departamento responsable del servicio.',
    ],
    cita: 'En caso de discrepancia, se considerará información válida frente a terceros la que conste en el Catálogo de Servicios.',
    why: 'El artículo 41.3 hace prevalecer, frente a terceros, la información del Catálogo de Servicios en caso de discrepancia.',
    bad: { A: 'Prevalece el Catálogo de Servicios, no la sede electrónica general.', C: 'La norma remite al Catálogo de Servicios como información válida, no al «Boletín Oficial de Aragón».', D: 'En caso de discrepancia no prevalece el portal o sede asociada, sino el Catálogo de Servicios.' } },

  { art: '43', n: '43.1', co: 2,
    q: 'Según el artículo 43.1 de la Ley 5/2021 de Aragón, se entiende por actuación administrativa automatizada:',
    o: [
      'Cualquier acto realizado a través de medios electrónicos en el que intervenga de forma directa un empleado público.',
      'Cualquier acto que aplique criterios subjetivos de decisión, de forma individualizada o colectiva, mediante medios electrónicos.',
      'Cualquier acto o actuación realizada íntegramente a través de medios electrónicos en el marco de un procedimiento, en la que no haya intervenido de forma directa un empleado público.',
      'La ejecución de procesos fragmentados dentro de un mismo acto realizada a través de medios electrónicos.',
    ],
    cita: 'Se entiende por actuación administrativa automatizada cualquier acto o actuación realizada íntegramente a través de medios electrónicos por la Administración pública en el marco de procedimiento administrativo y en la que no haya intervenido de forma directa un empleado público.',
    why: 'El artículo 43.1 define la actuación automatizada como la realizada íntegramente por medios electrónicos sin intervención directa de un empleado público.',
    bad: { A: 'Es justo lo contrario: no debe intervenir de forma directa un empleado público.', B: 'No se considera automatizada cuando se aplican criterios subjetivos de decisión (art. 43.3).', D: 'La ejecución de procesos fragmentados se excluye expresamente de la actuación automatizada (art. 43.3).' } },

  { art: '43', n: '43.2', co: 3,
    q: 'De acuerdo con el artículo 43.2 de la Ley 5/2021 de Aragón, el sistema de firma para la actuación administrativa automatizada en la Administración autonómica será:',
    o: [
      'La firma electrónica del empleado público que tramite la actuación administrativa automatizada.',
      'El sello electrónico de la persona titular del departamento competente en administración electrónica.',
      'El certificado electrónico de la sede desde la que se realice la actuación automatizada.',
      'El sello de órgano, que se utilizará exclusivamente para los supuestos de actuación administrativa automatizada.',
    ],
    cita: 'El sistema de firma para la actuación administrativa automatizada en la Administración de la Comunidad Autónoma de Aragón será el sello de órgano. El sello de órgano como método de firma se utilizará exclusivamente para los supuestos de actuación administrativa automatizada.',
    why: 'El artículo 43.2 fija el sello de órgano como sistema de firma de la actuación automatizada, de uso exclusivo para esos supuestos.',
    bad: { A: 'En la actuación automatizada no interviene un empleado público, por lo que no firma con su firma electrónica.', B: 'El sistema es el sello de órgano, no el sello del titular del departamento.', C: 'El sistema de firma es el sello de órgano, no el certificado de la sede.' } },

  { art: '44', n: '44.3', co: 0,
    q: 'Según el artículo 44.3 de la Ley 5/2021 de Aragón, el objetivo de dato único y compartido conlleva que la información:',
    o: [
      'Se introduzca una sola vez en origen, se mantenga depurada y actualizada por los órganos responsables, y se pueda gestionar o consultar desde cualquier punto o sistema que lo requiera.',
      'Se introduzca en cada departamento que la necesite y se mantenga actualizada de forma independiente por cada uno de ellos.',
      'Se introduzca una sola vez por el departamento competente en administración electrónica, que será su único responsable.',
      'Se introduzca y consulte exclusivamente a través de la plataforma de intermediación estatal de datos.',
    ],
    cita: 'El objetivo de dato único y compartido conlleva que la información se introduzca una sola vez en origen, se mantenga depurada y actualizada por los órganos responsables, y se pueda gestionar o consultar desde cualquier punto o sistema que así lo requiera.',
    why: 'El artículo 44.3 define el dato único: introducción una sola vez en origen, mantenimiento por los órganos responsables y consulta desde cualquier punto.',
    bad: { B: 'El dato no se introduce en cada departamento por separado, sino una sola vez en origen.', C: 'Los responsables del mantenimiento son los órganos responsables de los datos, no en exclusiva el departamento de administración electrónica.', D: 'La plataforma de intermediación estatal es para verificación, no el cauce exclusivo de introducción y consulta.' } },

  { art: '46', n: '46.1', co: 1,
    q: 'Conforme al artículo 46.1 de la Ley 5/2021 de Aragón, la actuación de los órganos de la Administración autonómica y de sus organismos públicos se fundamentará en los principios de:',
    o: [
      'Jerarquía, desconcentración y coordinación.',
      'Colaboración, auxilio y mutua información.',
      'Eficacia, economía y celeridad.',
      'Transparencia, participación y objetividad.',
    ],
    cita: 'La actuación de los órganos de la Administración de la comunidad autónoma y de sus organismos públicos se fundamentará en los principios de colaboración, auxilio y mutua información.',
    why: 'El artículo 46.1 fundamenta la actuación en los principios de colaboración, auxilio y mutua información.',
    bad: { A: 'El artículo 46.1 cita colaboración, auxilio y mutua información, no jerarquía/desconcentración/coordinación.', C: 'No menciona eficacia, economía y celeridad, sino colaboración, auxilio y mutua información.', D: 'No menciona transparencia, participación y objetividad en este precepto.' } },

  { art: '45', n: '45.2', co: 2,
    q: 'Según el artículo 45.2 de la Ley 5/2021 de Aragón, la Política de Protección de Datos y la Política de Seguridad de la Información se aprobará por:',
    o: [
      'Orden del departamento competente en materia de administración electrónica, con aplicación directa a la Administración.',
      'Acuerdo del Consejo de Transparencia de Aragón, con aplicación supletoria a los organismos públicos.',
      'Decreto del Gobierno de Aragón, y será de aplicación directa a la Administración pública de la Comunidad Autónoma de Aragón.',
      'Ley de las Cortes de Aragón, previa propuesta del departamento competente en protección de datos.',
    ],
    cita: 'La Política de Protección de Datos y la Política de Seguridad de la Información se aprobará por decreto del Gobierno de Aragón y será de aplicación directa a la Administración pública de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 45.2 exige aprobación por decreto del Gobierno de Aragón, con aplicación directa a la Administración autonómica.',
    bad: { A: 'No se aprueba por orden departamental, sino por decreto del Gobierno de Aragón.', B: 'No es un acuerdo del Consejo de Transparencia, sino un decreto del Gobierno de Aragón.', D: 'No se aprueba por ley de las Cortes, sino por decreto del Gobierno de Aragón.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.n} Ley 5/2021 Aragón**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  // Resolver article_id por número (evita transcribir UUID)
  const nums = [...new Set(Q.map(q => q.art))];
  const { data: arts } = await supabase.from('articles').select('id,article_number').eq('law_id', LAW).in('article_number', nums);
  const idByNum = Object.fromEntries((arts || []).map(a => [String(a.article_number), a.id]));
  const missing = nums.filter(n => !idByNum[n]);
  if (missing.length) return console.error('❌ Faltan artículos en BD:', missing.join(','));

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
