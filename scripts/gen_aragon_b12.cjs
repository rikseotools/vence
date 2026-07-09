// Batch b12 — Ley 5/2021 Aragón, arts 49-58 (planes, racionalización, control eficacia,
// derechos electrónicos, formas de actividad, encargos a medios propios, acción concertada).
// 15 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b12';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '49', n: '49.1', co: 1,
    q: 'Según el artículo 49.1 de la Ley 5/2021 de Aragón, los planes se aprobarán:',
    o: [
      'Por decreto del Gobierno de Aragón en todo caso, con independencia de los departamentos a los que afecten.',
      'Por orden del titular del departamento promotor, excepto cuando afecten a varios departamentos, en cuyo caso se aprobarán por Acuerdo del Gobierno de Aragón.',
      'Por Acuerdo del Gobierno de Aragón, excepto cuando afecten a un solo departamento, en cuyo caso bastará una resolución.',
      'Por orden conjunta de los titulares de todos los departamentos afectados y del departamento competente en materia de hacienda.',
    ],
    cita: 'Los planes se aprobarán por orden del titular del departamento promotor de los mismos, excepto cuando se trate de planes que afecten a varios departamentos, en cuyo caso se aprobarán por Acuerdo del Gobierno de Aragón.',
    why: 'El artículo 49.1 fija la orden del titular del departamento promotor como regla, y el Acuerdo del Gobierno cuando el plan afecta a varios departamentos.',
    bad: { A: 'No se aprueban por decreto en todo caso: la regla es la orden del departamento promotor.', C: 'La regla general es la orden del departamento promotor; el Acuerdo del Gobierno es la excepción (varios departamentos).', D: 'No se exige orden conjunta con hacienda para la aprobación del plan.' } },

  { art: '49', n: '49.2', co: 2,
    q: 'Conforme al artículo 49.2 de la Ley 5/2021 de Aragón, cuando del contenido de un plan se deriven consecuencias económicas, este requerirá:',
    o: [
      'La autorización previa del Gobierno de Aragón y el informe del departamento de administración electrónica.',
      'El dictamen del Consejo Consultivo de Aragón sobre la sostenibilidad financiera del plan.',
      'El informe de la dirección general competente en materia de presupuestos, que valorará su sostenibilidad financiera.',
      'El informe de la intervención general y la aprobación posterior de las Cortes de Aragón.',
    ],
    cita: 'Cuando de su contenido se deriven consecuencias económicas, requerirán del informe de la dirección general competente en materia de presupuestos, en el que se analizará y valorará la sostenibilidad financiera del mismo.',
    why: 'El artículo 49.2 exige informe de la dirección general competente en materia de presupuestos sobre la sostenibilidad financiera.',
    bad: { A: 'No se exige autorización del Gobierno ni informe de administración electrónica, sino informe de presupuestos.', B: 'No interviene el Consejo Consultivo: el informe es de la dirección general de presupuestos.', D: 'No se exige aprobación de las Cortes, sino el informe de la dirección general de presupuestos.' } },

  { art: '52', n: '52.1', co: 0,
    q: 'Según el artículo 52.1 de la Ley 5/2021 de Aragón, los órganos administrativos se someterán periódicamente a controles, auditorías o inspecciones para evaluar:',
    o: [
      'Su eficacia en el cumplimiento de los objetivos asignados, así como su eficiencia en la utilización de los recursos disponibles.',
      'Su legalidad formal y material en la adopción de acuerdos, así como el respeto del procedimiento administrativo.',
      'El grado de transparencia y publicidad de su actividad, así como la satisfacción de las personas usuarias.',
      'La sostenibilidad financiera de sus planes y programas, así como la estabilidad presupuestaria de la Administración.',
    ],
    cita: 'Los órganos administrativos se someterán periódicamente a controles, auditorías o inspecciones para evaluar su eficacia en el cumplimiento de los objetivos que les hayan sido asignados, así como su eficiencia en la utilización de los recursos disponibles.',
    why: 'El artículo 52.1 vincula el control a la evaluación de la eficacia (objetivos) y la eficiencia (recursos).',
    bad: { B: 'El control del artículo 52 evalúa eficacia y eficiencia, no la legalidad formal de los acuerdos.', C: 'No evalúa transparencia ni satisfacción de usuarios, sino eficacia y eficiencia.', D: 'No evalúa la sostenibilidad financiera de los planes, sino la eficacia y eficiencia de los órganos.' } },

  { art: '52', n: '52.3', co: 3,
    q: 'De acuerdo con el artículo 52.3 de la Ley 5/2021 de Aragón, los criterios e indicadores para evaluar la eficiencia en la asignación y utilización de recursos se dictarán:',
    o: [
      'Por la persona titular del departamento competente en materia de organización administrativa.',
      'Por la dirección general competente en materia de presupuestos, previo informe de la intervención.',
      'Por Acuerdo del Gobierno de Aragón, a propuesta del consejero competente en materia de hacienda.',
      'Conjuntamente por los consejeros competentes en materia de organización administrativa y hacienda.',
    ],
    cita: 'Los criterios e indicadores para evaluar la eficiencia en la asignación y utilización de recursos se dictarán conjuntamente por los consejeros competentes en materia de organización administrativa y hacienda.',
    why: 'El artículo 52.3 atribuye los criterios de eficiencia a la actuación conjunta de los consejeros de organización administrativa y hacienda.',
    bad: { A: 'La actuación individual del titular de organización administrativa corresponde a los criterios de eficacia, no de eficiencia.', B: 'No los dicta la dirección general de presupuestos, sino conjuntamente los consejeros de organización y hacienda.', C: 'No es un Acuerdo del Gobierno: se dictan conjuntamente por ambos consejeros.' } },

  { art: '53', n: '53.1', co: 0,
    q: 'Según el artículo 53.1 de la Ley 5/2021 de Aragón, en la relación electrónica las personas interesadas dispondrán del Punto de Acceso General de la Administración de la Comunidad Autónoma de Aragón, disponible en:',
    o: [
      'www.aragon.es, donde accederán a la sede electrónica de la Administración y, en su caso, a las sedes asociadas.',
      'sede.aragon.es, donde accederán al Portal de Internet y, en su caso, a los portales asociados.',
      'www.aragon.es, donde realizarán exclusivamente los trámites que no requieran identificación electrónica.',
      'www.administracion.gob.es, punto de acceso general común a todas las administraciones públicas.',
    ],
    cita: 'En la relación electrónica con la Administración pública de la Comunidad Autónoma de Aragón las personas interesadas dispondrán del Punto de Acceso General de la Administración de la Comunidad Autónoma de Aragón, disponible en www.aragon.es, donde accederán a la sede electrónica de la Administración y, en su caso, a las sedes asociadas.',
    why: 'El artículo 53.1 sitúa el Punto de Acceso General en www.aragon.es, dando acceso a la sede electrónica y, en su caso, a las sedes asociadas.',
    bad: { B: 'La dirección es www.aragon.es y da acceso a la sede electrónica y sedes asociadas, no a portales asociados.', C: 'El Punto de Acceso General da acceso a la sede electrónica, no se limita a trámites sin identificación.', D: 'El Punto de Acceso General es el autonómico (www.aragon.es), no el común estatal.' } },

  { art: '56', n: '56', co: 1,
    q: 'Conforme al artículo 56 de la Ley 5/2021 de Aragón, la Administración pública de la Comunidad Autónoma de Aragón podrá realizar su actividad:',
    o: [
      'Únicamente mediante gestión indirecta, con arreglo a la normativa sobre contratos del sector público.',
      'Mediante gestión directa o con medios propios, mediante gestión indirecta, o mediante acuerdos de acción concertada.',
      'Mediante gestión directa o con medios propios y gestión indirecta, quedando excluidos los acuerdos de acción concertada.',
      'Mediante gestión directa, gestión compartida con otras administraciones y delegación en corporaciones de derecho público.',
    ],
    cita: 'La Administración pública de la Comunidad Autónoma de Aragón podrá realizar su actividad de las siguientes formas: a) Mediante gestión directa o con medios propios. b) Mediante gestión indirecta, con arreglo a alguna de las fórmulas establecidas en la normativa sobre contratos del sector público. c) Mediante acuerdos de acción concertada con entidades públicas o con entidades privadas sin ánimo de lucro.',
    why: 'El artículo 56 enumera tres formas: gestión directa o con medios propios, gestión indirecta y acuerdos de acción concertada.',
    bad: { A: 'No es únicamente gestión indirecta: también caben la directa y la acción concertada.', C: 'La acción concertada NO queda excluida: es la letra c) del artículo 56.', D: 'El artículo 56 no menciona gestión compartida ni delegación en corporaciones: son gestión directa, indirecta y acción concertada.' } },

  { art: '56', n: '56.c)', co: 2,
    q: 'Según el artículo 56.c) de la Ley 5/2021 de Aragón, los acuerdos de acción concertada para la prestación de servicios a las personas podrán suscribirse:',
    o: [
      'Únicamente con entidades públicas, para la prestación de servicios de carácter social o sanitario.',
      'Con cualquier entidad privada, tenga o no ánimo de lucro, mediante contrato administrativo de servicios.',
      'Con entidades públicas o con entidades privadas sin ánimo de lucro, conforme a su normativa específica.',
      'Con entidades privadas con ánimo de lucro seleccionadas conforme a la normativa de contratos del sector público.',
    ],
    cita: 'Mediante acuerdos de acción concertada con entidades públicas o con entidades privadas sin ánimo de lucro para la prestación a las personas de servicios conforme a su normativa específica.',
    why: 'La letra c) del artículo 56 admite la acción concertada con entidades públicas o privadas sin ánimo de lucro.',
    bad: { A: 'No se limita a entidades públicas: también con entidades privadas sin ánimo de lucro.', B: 'No con cualquier entidad privada ni mediante contrato: solo entidades sin ánimo de lucro y por acción concertada (no contractual).', D: 'Las entidades privadas han de carecer de ánimo de lucro, y la acción concertada no es un contrato del sector público.' } },

  { art: '57', n: '57.2', co: 3,
    q: 'De acuerdo con el artículo 57.2 de la Ley 5/2021 de Aragón, los encargos de ejecución a medios propios de importe superior a tres millones de euros requerirán:',
    o: [
      'Informe favorable de la intervención general de la Comunidad Autónoma de Aragón.',
      'Autorización previa de las Cortes de Aragón mediante acuerdo de su pleno.',
      'Acuerdo de la dirección general competente en materia de presupuestos.',
      'Autorización previa del Gobierno de Aragón.',
    ],
    cita: 'Los encargos de importe superior a tres millones de euros requerirán autorización previa del Gobierno de Aragón.',
    why: 'El artículo 57.2 exige autorización previa del Gobierno de Aragón para los encargos superiores a tres millones de euros.',
    bad: { A: 'No basta el informe de la intervención: se exige autorización del Gobierno de Aragón.', B: 'No corresponde a las Cortes, sino al Gobierno de Aragón.', C: 'No es un acuerdo de la dirección general de presupuestos, sino autorización del Gobierno de Aragón.' } },

  { art: '57', n: '57.7', co: 0,
    q: 'Según el artículo 57.7 de la Ley 5/2021 de Aragón, en los encargos de ejecución a medios propios podrá efectuarse un anticipo de hasta:',
    o: [
      'El diez por ciento de la primera anualidad correspondiente a cada encargo de ejecución.',
      'El veinte por ciento de la primera anualidad correspondiente a cada encargo de ejecución.',
      'El diez por ciento del importe total del encargo de ejecución, con independencia de su duración.',
      'El treinta por ciento de la primera anualidad, previa autorización del Gobierno de Aragón.',
    ],
    cita: 'Podrá efectuarse un anticipo de hasta el diez por ciento de la primera anualidad correspondiente a cada encargo de ejecución.',
    why: 'El artículo 57.7 fija el anticipo en hasta el diez por ciento de la primera anualidad de cada encargo.',
    bad: { B: 'El anticipo es de hasta el diez por ciento, no del veinte.', C: 'El porcentaje se calcula sobre la primera anualidad, no sobre el importe total del encargo.', D: 'El anticipo ordinario es del diez por ciento de la primera anualidad, no del treinta.' } },

  { art: '58', n: '58', co: 1,
    q: 'Conforme al artículo 58 de la Ley 5/2021 de Aragón, los acuerdos de acción concertada son:',
    o: [
      'Contratos administrativos especiales sujetos a la normativa de contratos del sector público.',
      'Instrumentos organizativos de naturaleza no contractual, con las garantías de no discriminación, transparencia y eficiencia en la utilización de fondos públicos.',
      'Convenios de colaboración de naturaleza contractual sometidos a licitación pública.',
      'Subvenciones nominativas concedidas a entidades sin ánimo de lucro de carácter social.',
    ],
    cita: 'Los acuerdos de acción concertada son instrumentos organizativos de naturaleza no contractual, con las garantías de no discriminación, transparencia y eficiencia en la utilización de fondos públicos.',
    why: 'El artículo 58 define la acción concertada como instrumento organizativo de naturaleza no contractual con garantías de no discriminación, transparencia y eficiencia.',
    bad: { A: 'Su naturaleza es no contractual: no son contratos administrativos especiales.', C: 'No son convenios de naturaleza contractual sometidos a licitación, sino instrumentos no contractuales.', D: 'No son subvenciones nominativas, sino instrumentos organizativos de naturaleza no contractual.' } },

  { art: '50', n: '50.1', co: 2,
    q: 'Según el artículo 50.1 de la Ley 5/2021 de Aragón, son responsables de la racionalización y agilización de los procedimientos administrativos y de las actividades materiales de gestión:',
    o: [
      'Exclusivamente el departamento competente en materia de administración electrónica.',
      'La dirección general competente en materia de organización administrativa.',
      'Los Departamentos de la Administración de la Comunidad Autónoma y sus organismos públicos.',
      'Las Cortes de Aragón, a través de sus órganos de control y fiscalización.',
    ],
    cita: 'Los Departamentos de la Administración de la Comunidad Autónoma y sus organismos públicos serán responsables de la racionalización y agilización de los procedimientos administrativos y de las actividades materiales de gestión.',
    why: 'El artículo 50.1 hace responsables de la racionalización a los Departamentos y sus organismos públicos.',
    bad: { A: 'El departamento de administración electrónica propone criterios, pero la responsabilidad es de los Departamentos y sus organismos públicos.', B: 'No es la dirección general de organización administrativa, sino los Departamentos y sus organismos públicos.', D: 'No corresponde a las Cortes, sino a los Departamentos y sus organismos públicos.' } },

  { art: '51', n: '51', co: 3,
    q: 'De acuerdo con el artículo 51 de la Ley 5/2021 de Aragón, la Administración garantizará que las personas interesadas puedan relacionarse con ella a través de medios electrónicos:',
    o: [
      'Únicamente cuando exista obligación legal de relacionarse electrónicamente con la Administración.',
      'A través de la plataforma de intermediación de datos de la Administración General del Estado.',
      'Puestos a disposición de los ciudadanos en el Portal de Internet www.aragon.es.',
      'Puestos a disposición de los ciudadanos en su sede electrónica.',
    ],
    cita: 'La Administración pública de la Comunidad Autónoma de Aragón garantizará que las personas interesadas puedan relacionarse con esta a través de medios electrónicos puestos a disposición de los ciudadanos en su sede electrónica.',
    why: 'El artículo 51 garantiza la relación electrónica mediante los medios puestos a disposición en la sede electrónica.',
    bad: { A: 'La garantía no se condiciona a que exista obligación legal de relación electrónica.', B: 'El cauce es la sede electrónica, no la plataforma de intermediación estatal.', C: 'Los medios se ponen a disposición en la sede electrónica, no en el Portal de Internet.' } },

  { art: '54', n: '54.1', co: 0,
    q: 'Según el artículo 54.1 de la Ley 5/2021 de Aragón, las personas tienen derecho a acceder a la información pública, a los archivos y registros en los términos y condiciones establecidos en:',
    o: [
      'La Constitución y en la normativa sobre procedimiento administrativo, transparencia y derecho de acceso a la información pública.',
      'Exclusivamente en la normativa autonómica de transparencia de la Comunidad Autónoma de Aragón.',
      'El Estatuto de Autonomía de Aragón y en los reglamentos de los archivos y registros administrativos.',
      'La normativa básica de protección de datos personales y de seguridad de la información.',
    ],
    cita: 'Las personas tienen derecho a acceder a la información pública, a los archivos y registros en los términos y con las condiciones establecidas en la Constitución y en la normativa sobre procedimiento administrativo, transparencia y derecho de acceso a la información pública.',
    why: 'El artículo 54.1 remite a la Constitución y a la normativa de procedimiento administrativo, transparencia y acceso a la información pública.',
    bad: { B: 'No se limita a la normativa autonómica: remite también a la Constitución y a la normativa estatal.', C: 'La remisión es a la Constitución y a la normativa de transparencia y acceso, no al Estatuto y a reglamentos de archivos.', D: 'La remisión no es a la normativa de protección de datos, sino a la de transparencia y acceso a la información pública.' } },

  { art: '55', n: '55.2', co: 1,
    q: 'Conforme al artículo 55.2 de la Ley 5/2021 de Aragón, el cumplimiento por la Administración de las obligaciones de transparencia se llevará a cabo:',
    o: [
      'Sin más límite que la seguridad nacional y la defensa, conforme a la normativa de transparencia.',
      'Con el límite que exige la protección de datos de carácter personal, de acuerdo con la normativa vigente.',
      'Con preferencia, en todo caso, sobre la protección de datos de carácter personal de las personas interesadas.',
      'Con el único límite del secreto profesional de las personas al servicio de la Administración.',
    ],
    cita: 'El cumplimiento por la Administración pública de la comunidad autónoma de las obligaciones de transparencia se llevará a cabo con el límite que exige la protección de datos de carácter personal, de acuerdo con la normativa vigente en materia de protección de datos de carácter personal y de transparencia.',
    why: 'El artículo 55.2 establece la protección de datos personales como límite del cumplimiento de las obligaciones de transparencia.',
    bad: { A: 'El límite que fija el precepto es la protección de datos, no la seguridad nacional y la defensa.', C: 'La transparencia no prevalece en todo caso: tiene como límite la protección de datos.', D: 'El límite es la protección de datos personales, no el secreto profesional del personal.' } },

  { art: '57', n: '57.5', co: 2,
    q: 'Según el artículo 57.5 de la Ley 5/2021 de Aragón, los encargos de ejecución a medios propios se formalizarán por:',
    o: [
      'La dirección general competente en materia de contratación, previa autorización del Gobierno de Aragón.',
      'El órgano de contratación de la entidad que ostente la condición de poder adjudicador en todo caso.',
      'Quienes sean titulares de los departamentos y de las presidencias o direcciones de los organismos públicos y, en los demás supuestos, por el órgano competente de la entidad.',
      'El departamento competente en materia de administración electrónica, mediante orden del consejero.',
    ],
    cita: 'Los encargos se formalizarán por quienes sean titulares de los departamentos y de las presidencias o direcciones de los organismos públicos y, en los demás supuestos, por el órgano competente de la entidad de que se trate.',
    why: 'El artículo 57.5 atribuye la formalización a los titulares de departamentos y presidencias/direcciones de organismos públicos y, en lo demás, al órgano competente de la entidad.',
    bad: { A: 'No la formaliza la dirección general de contratación, sino los titulares de departamentos u organismos.', B: 'No es el órgano de contratación por la condición de poder adjudicador, sino los titulares indicados en el precepto.', D: 'No corresponde al departamento de administración electrónica.' } },
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
