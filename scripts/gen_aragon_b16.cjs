// Batch b16 — Ley 5/2021 Aragón, Título IV (consorcios autonómicos y fundaciones del
// sector público): arts 131,132,137,138,139,140,141,143,144.
// 15 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b16';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '131', n: '131.1', co: 1,
    q: 'Según el artículo 131.1 de la Ley 5/2021 de Aragón, los consorcios autonómicos estarán sujetos al régimen de presupuestación, contabilidad y control:',
    o: [
      'De la entidad consorciada que ostente la posición mayoritaria en el consorcio.',
      'De la Administración de la Comunidad Autónoma de Aragón, sin perjuicio de la normativa de estabilidad presupuestaria y sostenibilidad financiera.',
      'Establecido en exclusiva por sus estatutos y por sus normas internas de funcionamiento.',
      'De la Administración General del Estado, conforme a la legislación básica del sector público.',
    ],
    cita: 'Los consorcios autonómicos estarán sujetos al régimen de presupuestación, contabilidad y control de la Administración de la Comunidad Autónoma de Aragón, sin perjuicio de su sujeción a lo previsto en la normativa de estabilidad presupuestaria y sostenibilidad financiera.',
    why: 'El artículo 131.1 sujeta a los consorcios autonómicos al régimen presupuestario, contable y de control de la Administración autonómica.',
    bad: { A: 'No es el régimen de la entidad consorciada mayoritaria, sino el de la Administración autonómica.', C: 'No se establece en exclusiva por sus estatutos: se aplica el régimen de la Administración autonómica.', D: 'No es el régimen estatal, sino el de la Administración de la Comunidad Autónoma de Aragón.' } },

  { art: '131', n: '131.3', co: 2,
    q: 'Conforme al artículo 131.3 de la Ley 5/2021 de Aragón, la auditoría de las cuentas anuales de los consorcios autonómicos será responsabilidad de:',
    o: [
      'La Cámara de Cuentas de Aragón, con carácter exclusivo.',
      'Una sociedad de auditoría privada contratada por el propio consorcio.',
      'La Intervención General de la Administración de la Comunidad Autónoma de Aragón.',
      'El departamento competente en materia de hacienda de la comunidad autónoma.',
    ],
    cita: 'En todo caso, se llevará a cabo una auditoría de las cuentas anuales que será responsabilidad de la Intervención General de la Administración de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 131.3 atribuye la auditoría de las cuentas anuales de los consorcios a la Intervención General de la Administración autonómica.',
    bad: { A: 'La responsabilidad es de la Intervención General, sin atribuirla en exclusiva a la Cámara de Cuentas.', B: 'No es una auditoría privada contratada por el consorcio, sino de la Intervención General.', D: 'No es el departamento de hacienda, sino la Intervención General de la Administración autonómica.' } },

  { art: '132', n: '132.1', co: 0,
    q: 'Según el artículo 132.1 de la Ley 5/2021 de Aragón, el patrimonio de los consorcios autonómicos se regirá por:',
    o: [
      'Sus estatutos y, con carácter supletorio, por la normativa de patrimonio de Aragón.',
      'La normativa de patrimonio de Aragón y, con carácter supletorio, por sus estatutos.',
      'El derecho privado y por la legislación mercantil estatal aplicable.',
      'La legislación básica del Estado sobre el sector público, en todo caso.',
    ],
    cita: 'El patrimonio de los consorcios autonómicos se regirá por sus estatutos y, con carácter supletorio, por la normativa de patrimonio de Aragón.',
    why: 'El artículo 132.1 hace primar los estatutos del consorcio y deja la normativa de patrimonio de Aragón como supletoria.',
    bad: { B: 'El orden es el inverso: primero los estatutos y, supletoriamente, la normativa de patrimonio de Aragón.', C: 'No se rige por el derecho privado ni la legislación mercantil, sino por sus estatutos.', D: 'No es la legislación básica estatal: son los estatutos y, supletoriamente, el patrimonio de Aragón.' } },

  { art: '132', n: '132.2', co: 3,
    q: 'De acuerdo con el artículo 132.2 de la Ley 5/2021 de Aragón, la contratación de los consorcios autonómicos se regirá por:',
    o: [
      'Sus estatutos y, con carácter supletorio, por el derecho privado.',
      'La normativa de patrimonio de la Comunidad Autónoma de Aragón.',
      'Las instrucciones internas de contratación que apruebe el consorcio.',
      'Las previsiones de la legislación sobre contratación del sector público.',
    ],
    cita: 'La contratación de los consorcios autonómicos se regirá por las previsiones contenidas al respecto en la legislación sobre contratación del sector público.',
    why: 'El artículo 132.2 remite la contratación de los consorcios autonómicos a la legislación sobre contratación del sector público.',
    bad: { A: 'No se rige por sus estatutos y el derecho privado, sino por la legislación de contratación del sector público.', B: 'No es la normativa de patrimonio, sino la de contratación del sector público.', C: 'No bastan instrucciones internas: rige la legislación de contratación del sector público.' } },

  { art: '138', n: '138', co: 0,
    q: 'Según el artículo 138 de la Ley 5/2021 de Aragón, la contratación de las fundaciones del sector público autonómico se ajustará a:',
    o: [
      'Lo dispuesto en la legislación sobre contratación del sector público.',
      'El derecho privado propio de las fundaciones.',
      'La legislación estatal en materia de fundaciones.',
      'Las normas internas que apruebe el patronato de la fundación.',
    ],
    cita: 'La contratación de las fundaciones del sector público autonómico se ajustará a lo dispuesto en la legislación sobre contratación del sector público.',
    why: 'El artículo 138 remite la contratación de las fundaciones del sector público autonómico a la legislación de contratación del sector público.',
    bad: { B: 'No se rige por el derecho privado, sino por la legislación de contratación del sector público.', C: 'No es la legislación de fundaciones, sino la de contratación del sector público.', D: 'No bastan normas internas del patronato: rige la legislación de contratación del sector público.' } },

  { art: '140', n: '140', co: 1,
    q: 'Conforme al artículo 140 de la Ley 5/2021 de Aragón, el patrimonio de las fundaciones públicas de la comunidad autónoma se regirá por:',
    o: [
      'El derecho administrativo y por la normativa de patrimonio de la Comunidad Autónoma de Aragón.',
      'El derecho privado, por las normas de esta ley, la normativa de patrimonio de Aragón y su normativa específica.',
      'Exclusivamente por la legislación estatal en materia de fundaciones.',
      'El derecho público y por las normas de la Ley de Hacienda de la comunidad autónoma.',
    ],
    cita: 'El patrimonio de las fundaciones públicas de la comunidad autónoma se regirá por el derecho privado, por las normas contenidas en esta ley, en la normativa de patrimonio de Aragón y en su normativa específica.',
    why: 'El artículo 140 sujeta el patrimonio de las fundaciones públicas al derecho privado, a esta ley, a la normativa de patrimonio de Aragón y a su normativa específica.',
    bad: { A: 'Se rige por el derecho privado, no por el derecho administrativo.', C: 'No es solo la legislación estatal de fundaciones: también el derecho privado, esta ley y el patrimonio de Aragón.', D: 'No es el derecho público, sino el derecho privado (más esta ley, patrimonio de Aragón y normativa específica).' } },

  { art: '141', n: '141.1', co: 2,
    q: 'Según el artículo 141.1 de la Ley 5/2021 de Aragón, la creación y extinción de fundaciones del sector público autonómico, así como la adquisición y pérdida de la posición mayoritaria, se aprobarán por:',
    o: [
      'Orden del titular del departamento de adscripción, previo informe del protectorado.',
      'Acuerdo del Gobierno de Aragón, previo dictamen vinculante del Consejo Consultivo.',
      'Acuerdo del Gobierno de Aragón, previos informes del departamento competente en materia de hacienda.',
      'Ley de las Cortes de Aragón, a propuesta del departamento competente en hacienda.',
    ],
    cita: 'La creación y extinción de fundaciones del sector público autonómico, así como la adquisición y pérdida de la posición mayoritaria, se aprobarán por acuerdo del Gobierno de Aragón, previos informes del departamento competente en materia de hacienda analizando las implicaciones presupuestarias, contables y patrimoniales de la propuesta.',
    why: 'El artículo 141.1 exige acuerdo del Gobierno de Aragón, previos informes del departamento de hacienda, para crear o extinguir estas fundaciones.',
    bad: { A: 'No es una orden departamental, sino un acuerdo del Gobierno de Aragón, con informe de hacienda.', B: 'El informe previo es del departamento de hacienda, no un dictamen vinculante del Consejo Consultivo.', D: 'No se aprueba por ley de las Cortes, sino por acuerdo del Gobierno de Aragón.' } },

  { art: '141', n: '141.2', co: 3,
    q: 'De acuerdo con el artículo 141.2 de la Ley 5/2021 de Aragón, los estatutos de las fundaciones del sector público autonómico se aprobarán por:',
    o: [
      'Orden del titular del departamento de adscripción, previo informe del departamento de hacienda.',
      'Acuerdo del patronato de la fundación, ratificado posteriormente por el Gobierno de Aragón.',
      'Decreto del Gobierno de Aragón, previo dictamen del Consejo Consultivo de Aragón.',
      'Acuerdo del Gobierno de Aragón, a propuesta del titular del departamento de adscripción, previo informe favorable del que ejerza el protectorado.',
    ],
    cita: 'Los estatutos de las fundaciones del sector público autonómico se aprobarán por acuerdo del Gobierno de Aragón, a propuesta del titular del departamento de adscripción [...], previo informe favorable del departamento que ejerza el protectorado.',
    why: 'El artículo 141.2 atribuye la aprobación de los estatutos al Gobierno de Aragón, a propuesta del departamento de adscripción y con informe favorable del protectorado.',
    bad: { A: 'No es una orden departamental, sino un acuerdo del Gobierno de Aragón.', B: 'No los aprueba el patronato: es un acuerdo del Gobierno de Aragón.', C: 'No es un decreto previo dictamen del Consejo Consultivo, sino un acuerdo del Gobierno con informe del protectorado.' } },

  { art: '143', n: '143', co: 0,
    q: 'Según el artículo 143 de la Ley 5/2021 de Aragón, los miembros del patronato propuestos por la Comunidad Autónoma de Aragón serán designados:',
    o: [
      'A propuesta del Gobierno de Aragón.',
      'A propuesta del titular del departamento de adscripción de la fundación.',
      'Por el protectorado de la fundación, oído el Gobierno de Aragón.',
      'Por el propio patronato de la fundación entre sus miembros.',
    ],
    cita: 'En las fundaciones del sector público autonómico, así como en aquellas otras fundaciones en las que se participe, los miembros del patronato propuestos por la Comunidad Autónoma de Aragón serán designados a propuesta del Gobierno de Aragón.',
    why: 'El artículo 143 atribuye al Gobierno de Aragón la propuesta de designación de los miembros del patronato que corresponden a la comunidad autónoma.',
    bad: { B: 'La propuesta corresponde al Gobierno de Aragón, no al titular del departamento de adscripción.', C: 'No los designa el protectorado, sino que se designan a propuesta del Gobierno de Aragón.', D: 'No los designa el propio patronato: se designan a propuesta del Gobierno de Aragón.' } },

  { art: '144', n: '144', co: 1,
    q: 'Conforme al artículo 144 de la Ley 5/2021 de Aragón, el procedimiento de fusión, disolución, liquidación y extinción de las fundaciones del sector público autonómico:',
    o: [
      'Se regula directamente en esta ley con carácter exhaustivo.',
      'Se podrá regular reglamentariamente.',
      'Se regirá por la legislación estatal de fundaciones en todo caso.',
      'Lo aprobará el patronato de cada fundación en sus estatutos.',
    ],
    cita: 'Reglamentariamente se podrá regular el procedimiento de fusión, disolución, liquidación y extinción de las fundaciones del sector público autonómico.',
    why: 'El artículo 144 remite a un futuro desarrollo reglamentario el procedimiento de fusión, disolución, liquidación y extinción de estas fundaciones.',
    bad: { A: 'No se regula de forma exhaustiva en esta ley: se remite al reglamento.', C: 'No remite sin más a la legislación estatal: prevé desarrollo reglamentario propio.', D: 'No lo aprueba el patronato en sus estatutos: se regula reglamentariamente.' } },

  { art: '137', n: '137', co: 2,
    q: 'Según el artículo 137 de la Ley 5/2021 de Aragón, las fundaciones del sector público autonómico se rigen, entre otras normas, por:',
    o: [
      'Exclusivamente por el ordenamiento jurídico privado, sin sujeción a normativa pública alguna.',
      'Únicamente por la legislación estatal en materia de fundaciones y por sus propios estatutos.',
      'Esta ley, la legislación básica del Estado, la legislación en materia de fundaciones y el ordenamiento jurídico privado.',
      'El derecho administrativo en todas las materias, salvo la contratación, que se rige por el derecho privado.',
    ],
    cita: 'Las fundaciones del sector público autonómico se rigen por lo previsto en esta ley, la legislación básica del Estado sobre el sector público, la legislación estatal en materia de fundaciones, la legislación de la comunidad autónoma que resulte aplicable en materia de fundaciones y por el ordenamiento jurídico privado, salvo en las materias [...] presupuestaria, contable, de control económico-financiero y de contratación del sector público.',
    why: 'El artículo 137 combina esta ley, la legislación básica estatal, la de fundaciones y el ordenamiento privado, con las salvedades de las materias presupuestaria, contable, de control y de contratación.',
    bad: { A: 'No es solo el derecho privado: también esta ley y la legislación básica y de fundaciones.', B: 'No es únicamente la legislación estatal de fundaciones: hay un régimen plural.', D: 'No es el derecho administrativo con carácter general: el ordenamiento privado se aplica salvo las materias públicas tasadas.' } },

  { art: '139', n: '139.2', co: 3,
    q: 'De acuerdo con el artículo 139.2 de la Ley 5/2021 de Aragón, sin perjuicio de las competencias de la Cámara de Cuentas, las fundaciones del sector público autonómico estarán sometidas al control financiero de:',
    o: [
      'La Intervención General de la Administración General del Estado.',
      'El departamento de adscripción de la fundación.',
      'Una sociedad de auditoría privada designada por el protectorado.',
      'La Intervención General de la Administración de la Comunidad Autónoma de Aragón.',
    ],
    cita: 'Las fundaciones del sector público autonómico [...] sin perjuicio de las competencias atribuidas a la Cámara de Cuentas, estarán sometidas al control financiero de la Intervención General de la Administración de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 139.2 somete a estas fundaciones al control financiero de la Intervención General autonómica, sin perjuicio de la Cámara de Cuentas.',
    bad: { A: 'Es la Intervención General autonómica, no la del Estado.', B: 'No es el departamento de adscripción, sino la Intervención General autonómica.', C: 'No es una auditoría privada, sino el control de la Intervención General autonómica.' } },

  { art: '131', n: '131.4', co: 0,
    q: 'Según el artículo 131.4 de la Ley 5/2021 de Aragón, los consorcios autonómicos deberán:',
    o: [
      'Formar parte de los presupuestos e incluirse en la cuenta general de la Administración de la Comunidad Autónoma de Aragón.',
      'Presentar sus cuentas exclusivamente ante la entidad consorciada que ostente la posición mayoritaria.',
      'Quedar excluidos de la cuenta general de la Comunidad Autónoma por su naturaleza consorcial.',
      'Formar parte únicamente de los presupuestos de las administraciones consorciadas no autonómicas.',
    ],
    cita: 'Los consorcios autonómicos deberán formar parte de los presupuestos e incluirse en la cuenta general de la Administración de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 131.4 obliga a integrar los consorcios autonómicos en los presupuestos y en la cuenta general de la Administración autonómica.',
    bad: { B: 'No presentan sus cuentas solo ante la consorciada mayoritaria: se integran en la cuenta general autonómica.', C: 'No quedan excluidos: se incluyen en la cuenta general de la Comunidad Autónoma.', D: 'Se integran en los presupuestos de la Administración autonómica, no solo en los de otras administraciones.' } },

  { art: '139', n: '139.1', co: 1,
    q: 'Conforme al artículo 139.1 de la Ley 5/2021 de Aragón, las fundaciones del sector público autonómico formularán y presentarán sus cuentas anuales de acuerdo con:',
    o: [
      'El Plan General de Contabilidad Pública de la Administración de la comunidad autónoma.',
      'Los principios y normas de la adaptación del Plan General de Contabilidad a las entidades sin fines lucrativos.',
      'Las normas internacionales de información financiera adoptadas por la Unión Europea.',
      'Las normas de contabilidad propias que apruebe el patronato de cada fundación.',
    ],
    cita: 'Las fundaciones del sector público autonómico [...] formularán y presentarán sus cuentas anuales de acuerdo con los principios y normas de contabilidad recogidos en la adaptación del Plan General de Contabilidad a las entidades sin fines lucrativos y disposiciones que lo desarrollan, así como la normativa vigente en materia de fundaciones.',
    why: 'El artículo 139.1 remite las cuentas anuales de estas fundaciones a la adaptación del Plan General de Contabilidad a las entidades sin fines lucrativos.',
    bad: { A: 'No es el Plan General de Contabilidad Pública, sino la adaptación a entidades sin fines lucrativos.', C: 'No son las normas internacionales de información financiera, sino la adaptación a entidades sin fines lucrativos.', D: 'No son normas propias del patronato: rige la adaptación del Plan a entidades sin fines lucrativos.' } },

  { art: '141', n: '141.2', co: 2,
    q: 'Según el artículo 141.2 de la Ley 5/2021 de Aragón, el departamento al que inicialmente se adscriba una fundación del sector público autonómico:',
    o: [
      'No podrá modificarse una vez fijado en los estatutos de la fundación.',
      'Podrá modificarse por orden del titular del departamento de adscripción.',
      'Podrá modificarse por acuerdo del Gobierno de Aragón.',
      'Solo podrá modificarse mediante ley de las Cortes de Aragón.',
    ],
    cita: 'No obstante, por acuerdo del Gobierno de Aragón podrá modificarse el departamento al que se adscriba inicialmente la fundación.',
    why: 'El artículo 141.2 permite modificar el departamento de adscripción inicial por acuerdo del Gobierno de Aragón.',
    bad: { A: 'Sí puede modificarse: por acuerdo del Gobierno de Aragón.', B: 'No basta una orden del titular del departamento: se exige acuerdo del Gobierno de Aragón.', D: 'No se exige ley de las Cortes: basta un acuerdo del Gobierno de Aragón.' } },
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
