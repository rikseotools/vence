// Batch b15 — Ley 5/2021 Aragón, Título IV (organismos públicos, entidades de derecho
// público y sociedades mercantiles autonómicas): arts 102,109,115,116,118,119,123-126.
// 15 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b15';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '102', n: '102', co: 1,
    q: 'Según el artículo 102 de la Ley 5/2021 de Aragón, la representación y la defensa en juicio de los organismos públicos corresponderán a:',
    o: [
      'Los abogados del Estado integrados en los Servicios Jurídicos de la Administración General del Estado.',
      'Los letrados integrados en los Servicios Jurídicos del Gobierno de Aragón.',
      'Los letrados de cada organismo público designados por su máximo órgano de dirección.',
      'Los letrados de la Cámara de Cuentas de Aragón, previa autorización del Gobierno.',
    ],
    cita: 'La representación y la defensa en juicio de los organismos públicos corresponderán a los letrados integrados en los Servicios Jurídicos del Gobierno de Aragón.',
    why: 'El artículo 102 atribuye la representación y defensa en juicio de los organismos públicos a los letrados de los Servicios Jurídicos del Gobierno de Aragón.',
    bad: { A: 'No son los abogados del Estado, sino los letrados de los Servicios Jurídicos del Gobierno de Aragón.', C: 'No los designa cada organismo: corresponde a los Servicios Jurídicos del Gobierno de Aragón.', D: 'No corresponde a la Cámara de Cuentas, sino a los Servicios Jurídicos del Gobierno de Aragón.' } },

  { art: '115', n: '115.1', co: 2,
    q: 'Conforme al artículo 115.1 de la Ley 5/2021 de Aragón, las entidades de derecho público tendrán, para el cumplimiento de sus fines:',
    o: [
      'Un patrimonio integrado exclusivamente en el patrimonio general de la Administración de la comunidad autónoma.',
      'Un patrimonio propio cuya gestión corresponde en exclusiva al departamento competente en materia de patrimonio.',
      'Un patrimonio propio, distinto del de la Administración pública, integrado por los bienes y derechos de los que sean titulares.',
      'Un patrimonio propio que no podrá incluir bienes adscritos por la Administración para el cumplimiento de sus fines.',
    ],
    cita: 'Las entidades de derecho público tendrán, para el cumplimiento de sus fines, un patrimonio propio, distinto del de la Administración pública, integrado por el conjunto de bienes y derechos de los que sean titulares.',
    why: 'El artículo 115.1 reconoce a las entidades de derecho público un patrimonio propio y distinto del de la Administración.',
    bad: { A: 'El patrimonio es propio y distinto del de la Administración, no integrado en el general.', B: 'La gestión de sus bienes la ejerce la propia entidad conforme a la normativa de patrimonio, no en exclusiva el departamento.', D: 'El patrimonio puede incluir bienes que la Administración les adscriba para sus fines.' } },

  { art: '118', n: '118.1', co: 0,
    q: 'Según el artículo 118.1 de la Ley 5/2021 de Aragón, la participación minoritaria en el capital social de otras sociedades, aunque no sean mercantiles autonómicas, podrá acordarla:',
    o: [
      'El Gobierno de Aragón, siempre que sirva para el cumplimiento de los objetivos institucionales de la comunidad autónoma.',
      'La persona titular del departamento competente en materia de patrimonio, sin necesidad de informe alguno.',
      'El Gobierno de Aragón, únicamente cuando se trate de sociedades mercantiles autonómicas.',
      'La entidad de gestión competente, previa comunicación al departamento de hacienda.',
    ],
    cita: 'El Gobierno de Aragón podrá acordar la participación minoritaria en el capital social de otras sociedades, aunque estas no tengan la consideración de sociedades mercantiles autonómicas, siempre y cuando dicha participación sirva para el cumplimiento de los objetivos institucionales de la comunidad autónoma.',
    why: 'El artículo 118.1 atribuye al Gobierno de Aragón el acuerdo de participación minoritaria, condicionado a servir a los objetivos institucionales.',
    bad: { B: 'No es el titular de patrimonio sin más: lo acuerda el Gobierno, y se exige informe previo de hacienda (art. 118.2).', C: 'Precisamente cabe aunque no sean sociedades mercantiles autonómicas.', D: 'No lo acuerda la entidad de gestión, sino el Gobierno de Aragón.' } },

  { art: '124', n: '124.1', co: 3,
    q: 'De acuerdo con el artículo 124.1 de la Ley 5/2021 de Aragón, el presupuesto de las sociedades mercantiles autonómicas tendrá carácter:',
    o: [
      'Limitativo de los créditos, conforme a la Ley de Hacienda y a la ley de presupuestos de cada ejercicio.',
      'Vinculante a nivel de capítulo, conforme a la Ley de Hacienda de la comunidad autónoma.',
      'Ejecutivo y de obligado cumplimiento, sin sujeción a la ley de presupuestos de cada ejercicio.',
      'Estimativo, respetando las prescripciones de la Ley de Hacienda y de la ley de presupuestos de cada ejercicio.',
    ],
    cita: 'El presupuesto de las sociedades mercantiles autonómicas tendrá carácter estimativo y respetará las prescripciones que respecto al mismo se establecen en la Ley de Hacienda de la comunidad autónoma y en la ley de presupuestos de cada ejercicio.',
    why: 'El artículo 124.1 atribuye al presupuesto de estas sociedades carácter estimativo, con respeto a la Ley de Hacienda y a la ley de presupuestos.',
    bad: { A: 'El carácter es estimativo, no limitativo de los créditos.', B: 'No es vinculante a nivel de capítulo, sino estimativo.', C: 'Respeta la ley de presupuestos de cada ejercicio; su carácter es estimativo, no ejecutivo de obligado cumplimiento.' } },

  { art: '125', n: '125.1', co: 0,
    q: 'Según el artículo 125.1 de la Ley 5/2021 de Aragón, las sociedades mercantiles autonómicas estarán sometidas:',
    o: [
      'Al régimen de contabilidad pública y al control económico-financiero, conforme a la legislación sobre hacienda y patrimonio de la comunidad autónoma.',
      'Exclusivamente al régimen de contabilidad privada propio de las sociedades mercantiles.',
      'Al control de la Cámara de Cuentas de Aragón, sin sujeción al régimen de contabilidad pública.',
      'Al régimen de contabilidad pública únicamente cuando reciban transferencias con cargo a los presupuestos.',
    ],
    cita: 'Las sociedades mercantiles autonómicas estarán sometidas al régimen de contabilidad pública y al control económico-financiero, de acuerdo con lo establecido en la legislación sobre hacienda y patrimonio de la comunidad autónoma.',
    why: 'El artículo 125.1 somete a estas sociedades al régimen de contabilidad pública y al control económico-financiero conforme a la legislación de hacienda y patrimonio.',
    bad: { B: 'No es solo contabilidad privada: están sometidas a contabilidad pública y control.', C: 'Sí están sometidas al régimen de contabilidad pública, además del control.', D: 'El sometimiento no se condiciona a recibir transferencias.' } },

  { art: '126', n: '126.2', co: 1,
    q: 'Conforme al artículo 126.2 de la Ley 5/2021 de Aragón, para celebrar contratos cuyo valor estimado sea igual o superior a doce millones de euros, las sociedades mercantiles autonómicas necesitarán:',
    o: [
      'La autorización previa de las Cortes de Aragón mediante acuerdo de su pleno.',
      'La autorización previa del Gobierno de Aragón.',
      'El informe favorable de la Cámara de Cuentas de Aragón.',
      'La autorización del departamento de tutela al que estén adscritas, en todo caso.',
    ],
    cita: 'Para la celebración de contratos de cualquier naturaleza jurídica incluidos los patrimoniales, cuyo valor estimado sea igual o superior a doce millones de euros, las sociedades necesitarán la autorización previa del Gobierno de Aragón.',
    why: 'El artículo 126.2 exige autorización previa del Gobierno de Aragón para contratos de valor estimado igual o superior a doce millones de euros.',
    bad: { A: 'No corresponde a las Cortes, sino al Gobierno de Aragón.', C: 'No es un informe de la Cámara de Cuentas, sino autorización del Gobierno.', D: 'La autorización del departamento de tutela opera para cuantías inferiores (art. 126.3), no para el umbral de doce millones.' } },

  { art: '126', n: '126.1', co: 2,
    q: 'Según el artículo 126.1 de la Ley 5/2021 de Aragón, la contratación de las sociedades mercantiles autonómicas se ajustará a:',
    o: [
      'Las normas de derecho privado propias de las sociedades mercantiles de capital.',
      'Las instrucciones internas de contratación que apruebe cada sociedad.',
      'Lo dispuesto en la legislación sobre contratación del sector público.',
      'La normativa de patrimonio de la Comunidad Autónoma de Aragón.',
    ],
    cita: 'La contratación de las sociedades mercantiles autonómicas se ajustará a lo dispuesto en la legislación sobre contratación del sector público.',
    why: 'El artículo 126.1 remite la contratación de estas sociedades a la legislación sobre contratación del sector público.',
    bad: { A: 'No se rige por el derecho privado, sino por la legislación de contratación del sector público.', B: 'No bastan instrucciones internas: rige la legislación de contratación del sector público.', D: 'No es la normativa de patrimonio, sino la de contratación del sector público.' } },

  { art: '123', n: '123.1', co: 3,
    q: 'De acuerdo con el artículo 123.1 de la Ley 5/2021 de Aragón, el patrimonio de las sociedades mercantiles autonómicas se rige por:',
    o: [
      'El derecho administrativo y por la normativa de patrimonio de la Comunidad Autónoma de Aragón.',
      'Exclusivamente la legislación mercantil estatal aplicable a las sociedades de capital.',
      'El derecho público y por las normas de la Ley de Hacienda de la comunidad autónoma.',
      'El derecho privado y por las normas de esta ley y de la normativa de patrimonio de Aragón.',
    ],
    cita: 'El patrimonio de las sociedades mercantiles autonómicas se rige por el derecho privado y por las normas contenidas en esta ley y en la normativa de patrimonio de Aragón.',
    why: 'El artículo 123.1 sujeta el patrimonio de estas sociedades al derecho privado y a las normas de esta ley y de patrimonio de Aragón.',
    bad: { A: 'Se rige por el derecho privado, no por el derecho administrativo.', B: 'No es solo la legislación mercantil estatal: también esta ley y la normativa de patrimonio de Aragón.', C: 'No es derecho público, sino derecho privado (más esta ley y patrimonio de Aragón).' } },

  { art: '123', n: '123.4', co: 0,
    q: 'Según el artículo 123.4 de la Ley 5/2021 de Aragón, el patrimonio que se adscriba a una sociedad mercantil autonómica:',
    o: [
      'Solo podrá ser utilizado para los fines que justificaran su adscripción.',
      'Podrá ser utilizado libremente por la sociedad como si fuera patrimonio propio.',
      'Solo podrá ser utilizado previa autorización del departamento competente en patrimonio.',
      'Podrá ser enajenado por la sociedad conforme al derecho privado en cualquier momento.',
    ],
    cita: 'El patrimonio que se adscriba a una sociedad mercantil autonómica solo podrá ser utilizado para los fines que justificaran su adscripción.',
    why: 'El artículo 123.4 afecta el patrimonio adscrito a los fines que justificaron la adscripción.',
    bad: { B: 'El patrimonio adscrito no es de uso libre: se afecta a los fines de la adscripción.', C: 'La afectación a los fines de la adscripción es directa, sin que se exija esa autorización.', D: 'No puede enajenarse libremente: solo se usa para los fines que justificaron la adscripción.' } },

  { art: '119', n: '119', co: 1,
    q: 'Conforme al artículo 119 de la Ley 5/2021 de Aragón, la Administración y las entidades del sector público, como titulares del capital de las sociedades mercantiles autonómicas, perseguirán en su gestión:',
    o: [
      'La máxima rentabilidad económica y el reparto de dividendos a la Administración titular.',
      'La eficiencia, transparencia y buen gobierno, promoviendo buenas prácticas y códigos de conducta.',
      'La autonomía de gestión plena de la sociedad, sin supervisión del accionista o socio.',
      'La jerarquía, la desconcentración y el control de oportunidad sobre la sociedad mercantil.',
    ],
    cita: 'La Administración de la Comunidad Autónoma de Aragón y las entidades del sector público autonómico [...] perseguirán la eficiencia, transparencia y buen gobierno en la gestión de dichas sociedades mercantiles, para lo cual promoverán las buenas prácticas y códigos de conducta adecuados a la naturaleza de cada entidad.',
    why: 'El artículo 119 fija como principios rectores la eficiencia, transparencia y buen gobierno, con promoción de buenas prácticas y códigos de conducta.',
    bad: { A: 'El objetivo no es la máxima rentabilidad y dividendos, sino eficiencia, transparencia y buen gobierno.', C: 'Existe supervisión general del accionista o socio, no autonomía plena sin supervisión.', D: 'No se rige por jerarquía o control de oportunidad, sino por eficiencia, transparencia y buen gobierno.' } },

  { art: '125', n: '125.2', co: 2,
    q: 'Según el artículo 125.2 de la Ley 5/2021 de Aragón, para comprobar el funcionamiento y la eficacia de las sociedades mercantiles autonómicas en relación con sus objetivos, podrá realizar auditorías:',
    o: [
      'La Cámara de Cuentas de Aragón, con carácter exclusivo.',
      'El departamento de tutela al que estén adscritas las sociedades.',
      'El departamento competente en materia de hacienda.',
      'La intervención general de la Administración General del Estado.',
    ],
    cita: 'El departamento competente en materia de hacienda podrá realizar auditorías con objeto de comprobar el funcionamiento y la eficacia de estas sociedades en relación con el cumplimiento de los objetivos que tengan asignados.',
    why: 'El artículo 125.2 habilita al departamento competente en materia de hacienda a realizar auditorías sobre estas sociedades.',
    bad: { A: 'El precepto habilita al departamento de hacienda, sin atribuirlo en exclusiva a la Cámara de Cuentas.', B: 'No es el departamento de tutela, sino el competente en materia de hacienda.', D: 'No interviene la intervención general del Estado, sino el departamento de hacienda autonómico.' } },

  { art: '126', n: '126.3', co: 3,
    q: 'De acuerdo con el artículo 126.3 de la Ley 5/2021 de Aragón, a falta de previsión en la ley de presupuestos, la cantidad a partir de la cual se necesita autorización del departamento de tutela para contratar:',
    o: [
      'Será siempre la mitad de la cantidad que deba ser autorizada por el Gobierno de Aragón.',
      'La fijará el Gobierno de Aragón y no podrá ser inferior a la mitad de la cantidad general.',
      'Será de doce millones de euros, la misma que requiere la autorización del Gobierno de Aragón.',
      'La fijará la persona titular del departamento de tutela y no podrá ser inferior a un tercio de la que deba autorizar el Gobierno.',
    ],
    cita: 'A falta de esta previsión presupuestaria, la cantidad a partir de la cual será necesaria dicha autorización será la que establezca la persona titular del departamento de tutela, que no podrá ser inferior a un tercio de la cantidad que deba ser autorizada por el Gobierno de Aragón.',
    why: 'El artículo 126.3 atribuye la fijación a la titularidad del departamento de tutela, con un suelo de un tercio de la cantidad que autoriza el Gobierno.',
    bad: { A: 'El suelo es un tercio, no la mitad, y lo fija el departamento de tutela.', B: 'No lo fija el Gobierno: lo fija el departamento de tutela, con suelo de un tercio.', C: 'No son doce millones: esa es la cuantía de autorización del Gobierno (art. 126.2).' } },

  { art: '116', n: '116', co: 0,
    q: 'Según el artículo 116 de la Ley 5/2021 de Aragón, las entidades de derecho público aplicarán el régimen presupuestario, económico-financiero, de contabilidad y de control establecido en:',
    o: [
      'La legislación de hacienda de la Comunidad Autónoma de Aragón.',
      'La legislación básica de hacienda del Estado, en todo caso.',
      'Las normas de contabilidad privada propias de cada entidad.',
      'La normativa de patrimonio de la Comunidad Autónoma de Aragón.',
    ],
    cita: 'Las entidades de derecho público aplicarán el régimen presupuestario, económico-financiero, de contabilidad y de control establecido en legislación de hacienda de la Comunidad Autónoma de Aragón.',
    why: 'El artículo 116 remite el régimen presupuestario y de control de las entidades de derecho público a la legislación de hacienda de la comunidad autónoma.',
    bad: { B: 'La remisión es a la legislación de hacienda autonómica, no a la básica estatal en todo caso.', C: 'No se aplican normas de contabilidad privada propias, sino la legislación de hacienda autonómica.', D: 'No es la normativa de patrimonio, sino la de hacienda de la comunidad autónoma.' } },

  { art: '118', n: '118.2', co: 1,
    q: 'Conforme al artículo 118.2 de la Ley 5/2021 de Aragón, con carácter previo al acuerdo de participación minoritaria en otras sociedades, será necesaria la emisión de informes:',
    o: [
      'Del departamento competente en materia de patrimonio, analizando exclusivamente las implicaciones jurídicas.',
      'Del departamento competente en materia de hacienda, analizando las implicaciones presupuestarias, contables y patrimoniales.',
      'De la Cámara de Cuentas de Aragón, analizando la rentabilidad económica de la inversión.',
      'Del Consejo Consultivo de Aragón, con carácter vinculante para el Gobierno.',
    ],
    cita: 'Con carácter previo a la adopción del acuerdo, será necesaria la emisión de informes del departamento competente en materia de hacienda analizando las implicaciones presupuestarias, contables y patrimoniales de la propuesta.',
    why: 'El artículo 118.2 exige informe previo del departamento de hacienda sobre las implicaciones presupuestarias, contables y patrimoniales.',
    bad: { A: 'El informe es del departamento de hacienda y abarca implicaciones presupuestarias, contables y patrimoniales, no solo jurídicas.', C: 'No es un informe de la Cámara de Cuentas, sino del departamento de hacienda.', D: 'No interviene el Consejo Consultivo, sino el departamento de hacienda.' } },

  { art: '109', n: '109', co: 2,
    q: 'Según el artículo 109 de la Ley 5/2021 de Aragón, los organismos autónomos aplicarán el régimen de contabilidad y de control económico-financiero establecido por:',
    o: [
      'La normativa básica de contabilidad pública del Estado.',
      'Las normas internas que apruebe cada organismo autónomo.',
      'La normativa de hacienda de la comunidad autónoma.',
      'La normativa de patrimonio de la Comunidad Autónoma de Aragón.',
    ],
    cita: 'Los organismos autónomos aplicarán el régimen de contabilidad y de control económico-financiero establecido por la normativa de hacienda de la comunidad autónoma.',
    why: 'El artículo 109 remite la contabilidad y el control de los organismos autónomos a la normativa de hacienda de la comunidad autónoma.',
    bad: { A: 'La remisión es a la normativa de hacienda autonómica, no a la básica estatal.', B: 'No son normas internas de cada organismo, sino la normativa de hacienda autonómica.', D: 'No es la normativa de patrimonio, sino la de hacienda de la comunidad autónoma.' } },
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
