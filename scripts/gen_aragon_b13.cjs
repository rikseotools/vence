// Batch b13 — Ley 5/2021 Aragón, arts 59-69 (actos administrativos, fin de vía,
// revisión de oficio, revocación, rectificación, recursos, comisiones sustitutivas).
// Bloque T8. 15 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b13';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '59', n: '59.3', co: 1,
    q: 'Según el artículo 59.3 de la Ley 5/2021 de Aragón, los actos administrativos no podrán vulnerar lo establecido en una disposición de carácter general:',
    o: [
      'Salvo cuando procedan de un órgano de rango jerárquico superior a aquel que dictó la norma general.',
      'Aun cuando procedan de un órgano que tenga rango jerárquico superior a aquel que dictó la norma general.',
      'Excepto cuando la disposición general proceda de un órgano de inferior rango jerárquico.',
      'Salvo que el órgano superior derogue expresamente la disposición general en el mismo acto.',
    ],
    cita: 'Los actos administrativos no podrán vulnerar lo establecido en una disposición de carácter general, aun cuando procedan de un órgano que tenga rango jerárquico superior a aquel que dictó la norma general.',
    why: 'El artículo 59.3 consagra la inderogabilidad singular: el acto no puede vulnerar la norma general ni siquiera si lo dicta un órgano superior al que aprobó esta.',
    bad: { A: 'Es justo lo contrario: no puede vulnerarla "aun cuando" proceda de un órgano superior.', C: 'La prohibición no depende del rango del órgano que dictó la disposición general.', D: 'El acto singular no deroga la disposición general; debe respetarla.' } },

  { art: '60', n: '60.1.c)', co: 2,
    q: 'Conforme al artículo 60.1 de la Ley 5/2021 de Aragón, ponen fin a la vía administrativa, entre otros:',
    o: [
      'Los actos resolutorios de un recurso de reposición, cualquiera que sea el órgano que los resuelva.',
      'Los actos de trámite que deciden indirectamente el fondo del asunto en el procedimiento.',
      'Los actos resolutorios de un recurso de alzada, cualquiera que sea el órgano que los resuelva.',
      'Los actos de los máximos órganos de dirección de los organismos públicos, en todo caso.',
    ],
    cita: 'Ponen fin a la vía administrativa [...] los actos resolutorios de un recurso de alzada, cualquiera que sea el órgano que los resuelva.',
    why: 'La letra c) del artículo 60.1 incluye entre los actos que ponen fin a la vía administrativa la resolución del recurso de alzada.',
    bad: { A: 'La resolución del recurso de reposición no es la que se cita en la letra c); es la del recurso de alzada.', B: 'Los actos de trámite no figuran como actos que ponen fin a la vía administrativa.', D: 'Los actos de los máximos órganos de los organismos públicos NO ponen fin a la vía, salvo que una ley lo establezca (art. 60.3).' } },

  { art: '60', n: '60.3', co: 0,
    q: 'Según el artículo 60.3 de la Ley 5/2021 de Aragón, los actos de los máximos órganos de dirección de los organismos públicos:',
    o: [
      'No pondrán fin a la vía administrativa, salvo que una ley establezca lo contrario.',
      'Pondrán fin a la vía administrativa en todo caso, por su condición de máximos órganos de dirección.',
      'Pondrán fin a la vía administrativa, salvo que una ley establezca lo contrario.',
      'No pondrán fin a la vía administrativa, sin excepción posible aunque una ley disponga lo contrario.',
    ],
    cita: 'Los actos de los máximos órganos de dirección de los organismos públicos no pondrán fin a la vía administrativa, salvo que una ley establezca lo contrario.',
    why: 'El artículo 60.3 dispone, como regla, que estos actos no agotan la vía administrativa, salvo previsión legal en contrario.',
    bad: { B: 'No ponen fin a la vía en todo caso: la regla es la contraria.', C: 'La regla es que NO ponen fin a la vía, no que sí lo hagan.', D: 'Sí hay excepción: cuando una ley establezca lo contrario.' } },

  { art: '61', n: '61.a)', co: 3,
    q: 'De acuerdo con el artículo 61.a) de la Ley 5/2021 de Aragón, para la revisión de oficio de disposiciones y actos nulos será necesario:',
    o: [
      'El previo informe favorable de la dirección general competente en materia de presupuestos.',
      'La autorización previa de las Cortes de Aragón mediante acuerdo de su pleno.',
      'El previo dictamen no vinculante del Consejo de Transparencia de Aragón.',
      'El previo dictamen favorable del Consejo Consultivo de Aragón.',
    ],
    cita: 'Cuando se trate de disposiciones y actos nulos [...] será necesario el previo dictamen favorable del Consejo Consultivo de Aragón.',
    why: 'La letra a) del artículo 61 exige, para revisar de oficio actos nulos, el previo dictamen favorable del Consejo Consultivo de Aragón.',
    bad: { A: 'No es un informe de presupuestos, sino el dictamen del Consejo Consultivo.', B: 'No corresponde a las Cortes, sino al Consejo Consultivo.', C: 'El dictamen del Consejo Consultivo debe ser favorable, no un dictamen no vinculante del Consejo de Transparencia.' } },

  { art: '62', n: '62.2', co: 0,
    q: 'Según el artículo 62.2 de la Ley 5/2021 de Aragón, respecto de la revocación de actos desfavorables o de gravamen:',
    o: [
      'Los nulos de pleno derecho podrán revocarse en cualquier momento, y los anulables no podrán revocarse transcurridos cuatro años desde que se dictó el acto.',
      'Los nulos de pleno derecho podrán revocarse en el plazo de cuatro años, y los anulables en cualquier momento.',
      'Tanto los nulos como los anulables podrán revocarse en cualquier momento, sin sujeción a plazo alguno.',
      'Los nulos de pleno derecho podrán revocarse en el plazo de un año, y los anulables en el plazo de cuatro años.',
    ],
    cita: 'Los actos que [...] sean nulos de pleno derecho podrán revocarse en cualquier momento. Aquellos que [...] sean anulables no podrán revocarse una vez transcurridos cuatro años desde que se dictó el acto administrativo.',
    why: 'El artículo 62.2 permite revocar los nulos en cualquier momento y limita la revocación de los anulables a cuatro años desde que se dictó el acto.',
    bad: { B: 'Es al revés: los nulos en cualquier momento; los anulables, dentro de cuatro años.', C: 'Los anulables sí tienen plazo: cuatro años desde que se dictó el acto.', D: 'Los nulos se revocan en cualquier momento (no en un año) y los anulables en cuatro años.' } },

  { art: '63', n: '63', co: 1,
    q: 'Conforme al artículo 63 de la Ley 5/2021 de Aragón, los errores materiales, de hecho o aritméticos existentes en los actos podrán rectificarse:',
    o: [
      'En el plazo de cuatro años desde que se dictó el acto, de oficio o a instancia de parte.',
      'En cualquier momento, de oficio o a instancia de la persona interesada.',
      'Únicamente a instancia de la persona interesada, en el plazo de un mes desde la notificación.',
      'En cualquier momento, pero solo de oficio por el órgano que dictó el acto.',
    ],
    cita: 'Los órganos, autoridades y el personal al servicio de la Administración podrán, en cualquier momento, de oficio o a instancia de la persona interesada, rectificar los errores materiales, de hecho o aritméticos existentes en sus actos.',
    why: 'El artículo 63 permite rectificar los errores materiales en cualquier momento, de oficio o a instancia de la persona interesada.',
    bad: { A: 'La rectificación no está sujeta a un plazo de cuatro años: cabe en cualquier momento.', C: 'No es solo a instancia de parte ni en un mes: cabe de oficio y en cualquier momento.', D: 'También cabe a instancia de la persona interesada, no solo de oficio.' } },

  { art: '64', n: '64.1', co: 2,
    q: 'Según el artículo 64.1 de la Ley 5/2021 de Aragón, cuando el recurso de alzada se interponga ante el propio órgano que dictó el acto, este deberá remitirlo al órgano competente, con su informe y copia del expediente, en el plazo de:',
    o: [
      'Quince días.',
      'Cinco días.',
      'Diez días.',
      'Tres días.',
    ],
    cita: 'Igualmente, se podrá interponer ante el órgano que dictó el acto impugnado, en cuyo caso este deberá remitirlo al competente, para resolverlo en el plazo de diez días, con su informe y con una copia completa y ordenada del expediente.',
    why: 'El artículo 64.1 fija en diez días el plazo de remisión del recurso al órgano competente cuando se interpone ante el que dictó el acto.',
    bad: { A: 'El plazo de remisión es de diez días, no de quince.', B: 'El plazo de remisión es de diez días, no de cinco.', D: 'El plazo de remisión es de diez días, no de tres.' } },

  { art: '64', n: '64.3', co: 3,
    q: 'De acuerdo con el artículo 64.3 de la Ley 5/2021 de Aragón, el recurso potestativo de reposición:',
    o: [
      'Cabrá contra cualquier acto de trámite que decida directa o indirectamente el fondo del asunto.',
      'Será obligatorio antes de acudir a la jurisdicción contencioso-administrativa contra los actos que pongan fin a la vía.',
      'Cabrá contra la desestimación de un recurso de alzada ante el mismo órgano que lo resolvió.',
      'Cabrá contra los actos que pongan fin a la vía administrativa, y en ningún caso contra la desestimación de un recurso de alzada.',
    ],
    cita: 'Cabrá la interposición potestativa del recurso de reposición ante el mismo órgano que los hubiera dictado contra los actos administrativos que pongan fin a la vía administrativa. En ningún caso se podrá interponer recurso de reposición contra la desestimación de un recurso de alzada.',
    why: 'El artículo 64.3 admite la reposición potestativa contra actos que ponen fin a la vía y la prohíbe contra la desestimación de la alzada.',
    bad: { A: 'La reposición procede contra actos que ponen fin a la vía, no contra actos de trámite.', B: 'La reposición es potestativa, no un requisito obligatorio previo al contencioso.', C: 'En ningún caso cabe reposición contra la desestimación de un recurso de alzada.' } },

  { art: '65', n: '65.2', co: 0,
    q: 'Según el artículo 65.2 de la Ley 5/2021 de Aragón, el recurso extraordinario de revisión se interpondrá:',
    o: [
      'Ante el órgano administrativo que dictó el acto recurrido, que también será el competente para resolverlo.',
      'Ante el órgano superior jerárquico del que dictó el acto, que será el competente para resolverlo.',
      'Ante el Consejo Consultivo de Aragón, que emitirá dictamen vinculante antes de su resolución.',
      'Ante la jurisdicción contencioso-administrativa, previa declaración de lesividad del acto.',
    ],
    cita: 'El recurso se interpondrá ante el órgano administrativo que dictó el acto recurrido, que también será el competente para resolverlo.',
    why: 'El artículo 65.2 atribuye la interposición y la resolución del recurso extraordinario de revisión al mismo órgano que dictó el acto.',
    bad: { B: 'No se interpone ante el superior jerárquico, sino ante el órgano que dictó el acto.', C: 'No se interpone ante el Consejo Consultivo, sino ante el órgano que dictó el acto.', D: 'Es un recurso administrativo ante el órgano que dictó el acto, no un recurso judicial.' } },

  { art: '67', n: '67.4', co: 1,
    q: 'Conforme al artículo 67.4 de la Ley 5/2021 de Aragón, la reclamación o impugnación que sustituye al recurso administrativo deberá presentarse:',
    o: [
      'Dentro del plazo de un mes desde la notificación del acto, en todo caso.',
      'Dentro del mismo plazo establecido para la interposición de los correspondientes recursos administrativos.',
      'Dentro del plazo de tres meses desde que el acto sea firme en vía administrativa.',
      'En cualquier momento mientras el acto no haya ganado firmeza en vía administrativa.',
    ],
    cita: 'En todo caso, la reclamación deberá presentarse dentro del mismo plazo establecido para la interposición de los correspondientes recursos administrativos y a ella se acompañarán los documentos requeridos por el ordenamiento para dicha interposición.',
    why: 'El artículo 67.4 sujeta la reclamación sustitutiva al mismo plazo previsto para el recurso administrativo correspondiente.',
    bad: { A: 'El plazo no es un mes fijo, sino el del recurso administrativo que se sustituye.', C: 'No es de tres meses desde la firmeza, sino el del recurso correspondiente.', D: 'No cabe en cualquier momento: rige el plazo del recurso sustituido.' } },

  { art: '69', n: '69.1', co: 2,
    q: 'Según el artículo 69.1 de la Ley 5/2021 de Aragón, las comisiones o tribunales que sustituyen los recursos administrativos estarán compuestos por:',
    o: [
      'Un presidente o presidenta, un mínimo de tres vocales y un secretario o secretaria con voz y voto.',
      'Un presidente o presidenta, dos vocales y un secretario o secretaria que actuará con voz y voto en todo caso.',
      'Un presidente o presidenta, un mínimo de dos vocales y un secretario o secretaria, que actuará con voz y sin voto, salvo que sea también vocal.',
      'Un presidente o presidenta, un mínimo de cuatro vocales y un secretario o secretaria sin voz ni voto.',
    ],
    cita: 'Las comisiones o tribunales [...] estarán compuestos por un presidente o presidenta, un mínimo de dos vocales y un secretario o secretaria, que actuará con voz y sin voto, salvo que sea también vocal del órgano.',
    why: 'El artículo 69.1 fija presidencia, un mínimo de dos vocales y una secretaría con voz y sin voto (salvo que sea también vocal).',
    bad: { A: 'El mínimo es de dos vocales, no de tres, y el secretario actúa sin voto (salvo que sea vocal).', B: 'El secretario actúa con voz y sin voto, salvo que sea también vocal, no con voz y voto en todo caso.', D: 'El mínimo es de dos vocales y el secretario tiene voz; no son cuatro vocales ni un secretario sin voz.' } },

  { art: '69', n: '69.3', co: 3,
    q: 'De acuerdo con el artículo 69.3 de la Ley 5/2021 de Aragón, el mandato de quien ostente la Presidencia, de los dos vocales y de sus suplentes de la comisión o tribunal será de:',
    o: [
      'Cuatro años, y solo podrán ser removidos por su propia voluntad o por notorio incumplimiento de sus obligaciones.',
      'Cinco años, renovable por una sola vez por igual periodo.',
      'Dos años, pudiendo ser removidos libremente por el titular del departamento en cualquier momento.',
      'Dos años, y solo podrán ser removidos por su propia voluntad o por notorio incumplimiento de sus obligaciones.',
    ],
    cita: 'El mandato de quien ostente la Presidencia, de los dos vocales y de sus suplentes será de dos años y solo podrán ser removidos del cargo por su propia voluntad o por notorio incumplimiento de sus obligaciones.',
    why: 'El artículo 69.3 fija un mandato de dos años, con remoción solo por voluntad propia o notorio incumplimiento.',
    bad: { A: 'El mandato es de dos años, no de cuatro.', B: 'El mandato es de dos años, no de cinco renovables.', C: 'No cabe remoción libre: solo por voluntad propia o notorio incumplimiento.' } },

  { art: '60', n: '60.2', co: 0,
    q: 'Según el artículo 60.2 de la Ley 5/2021 de Aragón, los actos y resoluciones de quienes ostenten la titularidad de los Departamentos serán susceptibles de recurso de alzada ante el Gobierno:',
    o: [
      'Cuando una ley así lo establezca expresamente.',
      'En todo caso, por no agotar la vía administrativa ante el Gobierno de Aragón.',
      'Cuando lo acuerde el propio departamento que dictó el acto o la resolución.',
      'Únicamente en materia sancionadora y de responsabilidad patrimonial.',
    ],
    cita: 'Los actos y las resoluciones de quienes ostenten la titularidad de los Departamentos serán susceptibles de recurso de alzada ante el Gobierno cuando una ley así lo establezca expresamente.',
    why: 'El artículo 60.2 condiciona la alzada ante el Gobierno contra actos de la titularidad de los Departamentos a que una ley lo establezca expresamente.',
    bad: { B: 'No cabe en todo caso: solo cuando una ley lo establezca expresamente.', C: 'No depende del acuerdo del propio departamento, sino de una previsión legal expresa.', D: 'No se limita a esas materias: depende de que una ley lo establezca expresamente.' } },

  { art: '62', n: '62.1', co: 1,
    q: 'Conforme al artículo 62.1 de la Ley 5/2021 de Aragón, la Administración podrá revocar sus actos desfavorables o de gravamen siempre que tal revocación:',
    o: [
      'No haya transcurrido el plazo de cuatro años desde que se dictó el acto desfavorable o de gravamen.',
      'No constituya dispensa o exención no permitida por las leyes, ni sea contraria al principio de igualdad, al interés público o al ordenamiento jurídico.',
      'Cuente con el previo dictamen favorable del Consejo Consultivo de Aragón en todos los casos.',
      'Se realice exclusivamente a solicitud de la persona interesada y en su beneficio.',
    ],
    cita: 'La Administración de la comunidad autónoma podrá revocar [...] sus actos, expresos o presuntos, desfavorables o de gravamen siempre que tal revocación no constituya dispensa o exención no permitida por las leyes o sea contraria al principio de igualdad, al interés público o al ordenamiento jurídico.',
    why: 'El artículo 62.1 supedita la revocación de actos desfavorables a que no sea dispensa no permitida ni contraria a la igualdad, el interés público o el ordenamiento jurídico.',
    bad: { A: 'El límite de los cuatro años opera para los anulables del apartado 2, no como condición general del apartado 1.', C: 'El artículo 62.1 no exige dictamen del Consejo Consultivo para revocar actos desfavorables.', D: 'La revocación de actos desfavorables no se limita a la solicitud de la persona interesada.' } },

  { art: '69', n: '69.4', co: 2,
    q: 'Según el artículo 69.4 de la Ley 5/2021 de Aragón, el secretario o secretaria de la comisión o tribunal será:',
    o: [
      'Un funcionario o funcionaria interino designado por el presidente de la comisión o tribunal.',
      'Un vocal de la comisión elegido entre sus miembros por mayoría simple.',
      'Un funcionario o funcionaria de carrera de nivel superior designado por la persona titular del departamento del que emane el acto.',
      'Personal laboral de la Administración designado por el Gobierno de Aragón.',
    ],
    cita: 'El secretario o secretaria será un funcionario o funcionaria de carrera de nivel superior designado por la persona titular del departamento del que emane el acto o la resolución objeto de la reclamación o impugnación.',
    why: 'El artículo 69.4 exige que la secretaría sea un funcionario de carrera de nivel superior designado por la titularidad del departamento.',
    bad: { A: 'Debe ser funcionario de carrera, no interino, y lo designa la titularidad del departamento.', B: 'No se elige entre los vocales: es un funcionario de carrera de nivel superior designado por el departamento.', D: 'No es personal laboral, sino funcionario de carrera de nivel superior.' } },
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
