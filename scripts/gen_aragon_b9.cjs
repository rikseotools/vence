// Batch b9 — Ley 5/2021 Aragón, Capítulo "Competencia y su ejercicio" (arts 9-18)
// Bloque T7 (competencia/delegación/avocación/encomienda/firma). Genera 15
// preguntas como DRAFT (invisible) con auditoría posterior. Manual:
// docs/maintenance/generar-preguntas-con-ia.md (v2.5).
//
// Reglas aplicadas: §2.2 (correcta = cita literal), §2.2-bis (distractores de
// longitud comparable), §2.2-ter (posición uniforme: A4/B4/C4/D3).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TAG = 'piloto_ley_5_2021_aragon_b9';
const ART = {
  9:  '14c8561c-f5b5-4d3e-a9ba-21c6917bc6af',
  10: 'f379c523-d9e5-400f-9aee-0c5355d4c525',
  11: '3abe28ec-c90a-4e94-a005-e545dd381804',
  12: '671de917-f5c7-45b4-8d2c-6443410fd10d',
  13: '00c9f9cf-f3d3-43c7-bd56-55bcafba7803',
  14: 'c617d867-1f53-4e18-96c8-3e0803358603',
  15: 'ce084291-9e6e-4129-868c-cc23d4a3ec3f',
  16: '53f5e4f2-627b-41a3-bb32-16faedbe02ce',
  18: '06a6ea29-a7d1-4741-afb6-a1f8954d07c0',
};
const L = ['A', 'B', 'C', 'D'];

// Cada pregunta: art, enunciado, opciones [A,B,C,D], correcta (0-3), cita literal, por qué correcta, por qué las demás (map por letra)
const Q = [
  { art: 9, n: '9.1', co: 0,
    q: 'Según el artículo 9.1 de la Ley 5/2021 de Aragón, la competencia:',
    o: [
      'Es irrenunciable y se ejercerá por los órganos administrativos que la tengan atribuida como propia, salvo los casos de delegación o avocación.',
      'Es renunciable y se ejercerá por los órganos administrativos que la tengan atribuida como propia, salvo los casos de encomienda de gestión.',
      'Es irrenunciable y se ejercerá por el superior jerárquico común de los órganos administrativos, salvo los casos de delegación de firma o suplencia.',
      'Es delegable en todo caso y se ejercerá por los órganos administrativos que la tengan atribuida como propia o por avocación de los inferiores.',
    ],
    cita: 'La competencia es irrenunciable y se ejercerá por los órganos administrativos que la tengan atribuida como propia, salvo los casos de delegación o avocación.',
    why: 'El artículo 9.1 proclama la irrenunciabilidad de la competencia y su ejercicio por el órgano que la tiene atribuida como propia, con la sola salvedad de delegación o avocación.',
    bad: { B: 'La competencia es irrenunciable, no renunciable, y las salvedades son delegación o avocación, no la encomienda de gestión.', C: 'La ejerce el órgano que la tiene atribuida como propia, no el superior jerárquico común; las salvedades son delegación o avocación.', D: 'La competencia no es delegable "en todo caso": es irrenunciable y solo se exceptúan delegación y avocación.' } },

  { art: 9, n: '9.4', co: 2,
    q: 'Conforme al artículo 9.4 de la Ley 5/2021 de Aragón, si alguna disposición atribuye la competencia a la Administración sin especificar el órgano que debe ejercerla, la facultad de instruir y resolver los expedientes corresponde:',
    o: [
      'Al órgano superior jerárquico común competente por razón de la materia y del territorio.',
      'A la persona titular del departamento competente por razón de la materia y del territorio.',
      'A los órganos inferiores competentes por razón de la materia y del territorio.',
      'A los órganos colegiados competentes por razón de la materia y del territorio.',
    ],
    cita: 'Si alguna disposición atribuye la competencia a la Administración, sin especificar el órgano que debe ejercerla, se entenderá que la facultad de instruir y resolver los expedientes corresponde a los órganos inferiores competentes por razón de la materia y del territorio.',
    why: 'El artículo 9.4 atribuye por defecto la instrucción y resolución a los órganos inferiores competentes por razón de la materia y del territorio.',
    bad: { A: 'El superior jerárquico común solo resuelve si existiera más de un órgano inferior competente; el supuesto por defecto recae en los órganos inferiores.', B: 'El precepto no remite a la persona titular del departamento, sino a los órganos inferiores competentes por materia y territorio.', D: 'No se refiere a órganos colegiados, sino a los órganos inferiores competentes por razón de la materia y del territorio.' } },

  { art: 10, n: '10.1', co: 1,
    q: 'De acuerdo con el artículo 10.1 de la Ley 5/2021 de Aragón, los órganos administrativos podrán delegar el ejercicio de las competencias que tengan atribuidas:',
    o: [
      'En otros órganos de la misma Administración, siempre que sean jerárquicamente dependientes de ellos.',
      'En otros órganos de la misma Administración, aun cuando no sean jerárquicamente dependientes.',
      'En otros órganos de distinta Administración, aun cuando no sean jerárquicamente dependientes.',
      'Únicamente en sus organismos públicos vinculados o dependientes de la misma Administración.',
    ],
    cita: 'Los órganos administrativos podrán delegar el ejercicio de las competencias que tengan atribuidas en otros órganos de la misma Administración, aun cuando no sean jerárquicamente dependientes.',
    why: 'El artículo 10.1 admite la delegación en otros órganos de la misma Administración aunque no exista dependencia jerárquica.',
    bad: { A: 'Precisamente no se exige dependencia jerárquica: cabe delegar "aun cuando no sean jerárquicamente dependientes".', C: 'La delegación es en órganos de la misma Administración, no de distinta Administración.', D: 'No se limita a los organismos públicos vinculados o dependientes; cabe en otros órganos de la misma Administración.' } },

  { art: 10, n: '10.3', co: 3,
    q: 'Según el artículo 10.3 de la Ley 5/2021 de Aragón, cuando la norma reguladora de un procedimiento prevea como trámite preceptivo la emisión de un dictamen o informe, la delegación de la competencia para resolver:',
    o: [
      'No es posible en ningún caso, pues la exigencia de dictamen o informe preceptivo impide siempre delegar la competencia para resolver.',
      'Es posible en todo momento, incluso después de que se haya emitido el dictamen o informe preceptivo acerca del procedimiento.',
      'Solo es posible una vez que se haya emitido el dictamen o informe preceptivo acerca del procedimiento.',
      'Es posible pese a esa exigencia, pero no podrá delegarse una vez que se haya emitido el dictamen o informe preceptivo.',
    ],
    cita: 'No constituye impedimento para que pueda delegarse la competencia para resolver un procedimiento la circunstancia de que la norma reguladora del mismo prevea, como trámite preceptivo, la emisión de un dictamen o informe; no obstante, no podrá delegarse la competencia para resolver un procedimiento una vez que en el correspondiente procedimiento se haya emitido un dictamen o informe preceptivo acerca del mismo.',
    why: 'El artículo 10.3 permite delegar pese a la exigencia de dictamen preceptivo, salvo que este ya se haya emitido en el procedimiento concreto.',
    bad: { A: 'La mera previsión de dictamen o informe preceptivo no impide delegar; el impedimento surge cuando ya se ha emitido.', B: 'No cabe delegar "en todo momento": una vez emitido el dictamen o informe preceptivo no podrá delegarse.', C: 'Es justo al revés: una vez emitido el dictamen o informe preceptivo ya no podrá delegarse.' } },

  { art: 10, n: '10.4 y 10.5', co: 0,
    q: 'Conforme al artículo 10 de la Ley 5/2021 de Aragón, respecto de la delegación de competencias:',
    o: [
      'Será revocable en cualquier momento por el órgano que la haya conferido y no perderá su eficacia por cambio del titular del órgano delegante.',
      'Será revocable únicamente por el superior jerárquico común y no perderá su eficacia por cambio del titular del órgano delegante.',
      'Será irrevocable durante su plazo de vigencia y no perderá su eficacia por cambio del titular del órgano delegante.',
      'Será revocable en cualquier momento por el órgano que la haya conferido, pero perderá su eficacia por cambio del titular del órgano delegante.',
    ],
    cita: 'La delegación será revocable en cualquier momento por el órgano que la haya conferido. Las delegaciones de competencias no perderán su eficacia por cambio del titular del órgano delegante.',
    why: 'Los apartados 4 y 5 del artículo 10 establecen que la delegación es revocable en cualquier momento por el órgano que la confirió y que no decae por cambio del titular del delegante.',
    bad: { B: 'La revocación corresponde al órgano que confirió la delegación, no al superior jerárquico común.', C: 'La delegación es revocable en cualquier momento, no irrevocable durante su vigencia.', D: 'No pierde su eficacia por cambio del titular del órgano delegante; sigue siendo eficaz.' } },

  { art: 12, n: '12.1', co: 1,
    q: 'Según el artículo 12.1 de la Ley 5/2021 de Aragón, NO podrán ser objeto de delegación, entre otras, las competencias relativas a:',
    o: [
      'La resolución de los procedimientos sancionadores incoados por los órganos jerárquicamente inferiores.',
      'La resolución de recursos en los órganos administrativos que hayan dictado los actos objeto de recurso.',
      'La tramitación de los expedientes de contratación de los organismos públicos vinculados o dependientes.',
      'La firma de las resoluciones y actos administrativos dictados en materias de la propia competencia.',
    ],
    cita: 'En ningún caso podrán ser objeto de delegación las competencias relativas a: [...] c) La resolución de recursos en los órganos administrativos que hayan dictado los actos objeto de recurso.',
    why: 'La letra c) del artículo 12.1 prohíbe delegar la resolución de recursos en el propio órgano que dictó el acto recurrido.',
    bad: { A: 'La resolución de procedimientos sancionadores no figura entre las prohibiciones tasadas del artículo 12.1.', C: 'La tramitación de expedientes de contratación no se incluye en la lista de competencias indelegables del artículo 12.1.', D: 'La delegación de firma se regula en el artículo 18; no es una de las competencias indelegables del artículo 12.1.' } },

  { art: 12, n: '12.2', co: 2,
    q: 'De acuerdo con el artículo 12.2 de la Ley 5/2021 de Aragón, las competencias que se ejerzan por delegación:',
    o: [
      'Podrán delegarse libremente en otros órganos jerárquicamente dependientes del órgano delegado.',
      'No podrán delegarse en ningún caso, ni siquiera mediando autorización expresa de una ley.',
      'No podrán delegarse, salvo autorización expresa de una ley.',
      'Podrán delegarse previa autorización expresa de la persona titular del departamento competente.',
    ],
    cita: 'Salvo autorización expresa de una ley, no podrán delegarse las competencias que se ejerzan por delegación.',
    why: 'El artículo 12.2 prohíbe la subdelegación de competencias ejercidas por delegación, salvo que una ley lo autorice expresamente.',
    bad: { A: 'No cabe subdelegar "libremente": la regla es la prohibición salvo autorización expresa de una ley.', B: 'Sí cabe excepción: la autorización expresa de una ley permite delegar las competencias ejercidas por delegación.', D: 'La excepción exige autorización expresa de una ley, no la autorización de la persona titular del departamento.' } },

  { art: 13, n: '13.3', co: 3,
    q: 'Según el artículo 13.3 de la Ley 5/2021 de Aragón, las delegaciones de competencias y su revocación deberán publicarse en:',
    o: [
      'El «Boletín Oficial del Estado».',
      'El «Boletín Oficial del Estado» y, además, en el «Boletín Oficial de Aragón».',
      'El portal de transparencia del Gobierno de Aragón.',
      'El «Boletín Oficial de Aragón».',
    ],
    cita: 'Las delegaciones de competencias y su revocación deberán publicarse en el «Boletín Oficial de Aragón».',
    why: 'El artículo 13.3 ordena la publicación de las delegaciones y su revocación en el «Boletín Oficial de Aragón».',
    bad: { A: 'La publicación se realiza en el «Boletín Oficial de Aragón», no en el «Boletín Oficial del Estado».', B: 'El precepto no exige publicación en el «Boletín Oficial del Estado»; basta el «Boletín Oficial de Aragón».', C: 'El medio previsto es el «Boletín Oficial de Aragón», no el portal de transparencia.' } },

  { art: 13, n: '13.4', co: 0,
    q: 'Conforme al artículo 13.4 de la Ley 5/2021 de Aragón, las resoluciones administrativas que se adopten por delegación:',
    o: [
      'Indicarán expresamente esta circunstancia y se considerarán dictadas por el órgano delegante.',
      'Indicarán expresamente esta circunstancia y se considerarán dictadas por el órgano delegado.',
      'No precisarán indicar esta circunstancia y se considerarán dictadas por el órgano delegante.',
      'Indicarán esta circunstancia solo a petición del interesado y se considerarán dictadas por el órgano delegado.',
    ],
    cita: 'Las resoluciones administrativas que se adopten por delegación indicarán expresamente esta circunstancia y se considerarán dictadas por el órgano delegante.',
    why: 'El artículo 13.4 obliga a indicar expresamente la delegación y atribuye la autoría de la resolución al órgano delegante.',
    bad: { B: 'Se consideran dictadas por el órgano delegante, no por el delegado.', C: 'Sí debe indicarse expresamente la circunstancia de la delegación.', D: 'La indicación es siempre obligatoria, no solo a petición del interesado, y la resolución se imputa al órgano delegante.' } },

  { art: 14, n: '14.4', co: 1,
    q: 'Según el artículo 14.4 de la Ley 5/2021 de Aragón, las resoluciones que dicte una corporación de derecho público en uso de la delegación de competencias acordada por la Administración autonómica:',
    o: [
      'Agotarán la vía administrativa y solo serán susceptibles de recurso contencioso-administrativo ante los tribunales.',
      'No agotarán la vía administrativa y serán susceptibles de recurso de alzada ante la persona titular del departamento que corresponda por razón de la materia.',
      'No agotarán la vía administrativa y serán susceptibles de recurso potestativo de reposición ante la propia corporación delegada.',
      'Agotarán la vía administrativa y serán susceptibles de recurso extraordinario de revisión ante el Gobierno de Aragón.',
    ],
    cita: 'Las resoluciones que dicte la corporación en uso de la delegación acordada no agotarán la vía administrativa y serán susceptibles de recurso de alzada ante la persona titular del departamento a quien corresponda por razón de la materia.',
    why: 'El artículo 14.4 dispone que tales resoluciones no agotan la vía administrativa y caben en alzada ante la persona titular del departamento competente por la materia.',
    bad: { A: 'No agotan la vía administrativa, por lo que cabe recurso de alzada, no directamente el contencioso-administrativo.', C: 'El recurso procedente es la alzada ante la persona titular del departamento, no la reposición ante la corporación.', D: 'No agotan la vía administrativa ni se prevé recurso extraordinario de revisión ante el Gobierno de Aragón.' } },

  { art: 15, n: '15.1', co: 2,
    q: 'De acuerdo con el artículo 15.1 de la Ley 5/2021 de Aragón, la avocación por los órganos jerárquicamente superiores del conocimiento de un asunto cuando circunstancias de índole técnica, económica, social, jurídica o territorial lo hagan conveniente:',
    o: [
      'No requerirá autorización alguna, por tratarse de una potestad propia e inherente al superior jerárquico.',
      'Requerirá la autorización previa del Gobierno de Aragón en todos los supuestos de avocación.',
      'Requerirá la autorización expresa de la persona titular del departamento.',
      'Requerirá únicamente la conformidad del órgano inferior que venía conociendo del asunto.',
    ],
    cita: 'La avocación requerirá la autorización expresa de la persona titular del departamento.',
    why: 'El artículo 15.1 supedita la avocación a la autorización expresa de la persona titular del departamento.',
    bad: { A: 'La avocación no es incondicionada: exige autorización expresa de la persona titular del departamento.', B: 'La autorización corresponde a la persona titular del departamento, no al Gobierno de Aragón.', D: 'No basta la conformidad del órgano inferior; se exige autorización expresa de la persona titular del departamento.' } },

  { art: 15, n: '15.3', co: 3,
    q: 'Según el artículo 15.3 de la Ley 5/2021 de Aragón, contra el acuerdo de avocación:',
    o: [
      'Cabrá recurso de alzada ante el órgano superior jerárquico del que lo dictó.',
      'Cabrá recurso potestativo de reposición ante el propio órgano que avocó el asunto.',
      'No cabrá recurso alguno, ni siquiera con ocasión del que se interponga contra la resolución del procedimiento.',
      'No cabrá recurso, aunque podrá impugnarse en el que, en su caso, se interponga contra la resolución del procedimiento.',
    ],
    cita: 'Contra el acuerdo de avocación no cabrá recurso, aunque podrá impugnarse en el que, en su caso, se interponga contra la resolución del procedimiento.',
    why: 'El artículo 15.3 excluye el recurso autónomo contra la avocación, pero permite impugnarla al recurrir la resolución del procedimiento.',
    bad: { A: 'No cabe recurso autónomo de alzada contra el acuerdo de avocación.', B: 'Tampoco cabe recurso potestativo de reposición contra el acuerdo de avocación.', C: 'Sí podrá impugnarse, pero con ocasión del recurso contra la resolución del procedimiento.' } },

  { art: 16, n: '16.2', co: 0,
    q: 'Conforme al artículo 16.2 de la Ley 5/2021 de Aragón, la encomienda de gestión:',
    o: [
      'No supone cesión de la titularidad de la competencia ni de los elementos sustantivos de su ejercicio.',
      'Supone la cesión de la titularidad de la competencia, pero no de los elementos sustantivos de su ejercicio.',
      'No supone cesión de la titularidad de la competencia, pero sí de los elementos sustantivos de su ejercicio.',
      'Supone la cesión tanto de la titularidad de la competencia como de los elementos sustantivos de su ejercicio.',
    ],
    cita: 'La encomienda de gestión no supone cesión de la titularidad de la competencia ni de los elementos sustantivos de su ejercicio.',
    why: 'El artículo 16.2 deja claro que la encomienda de gestión no transfiere ni la titularidad de la competencia ni los elementos sustantivos de su ejercicio.',
    bad: { B: 'No hay cesión de la titularidad de la competencia.', C: 'Tampoco se ceden los elementos sustantivos del ejercicio de la competencia.', D: 'No se cede ni la titularidad ni los elementos sustantivos del ejercicio.' } },

  { art: 16, n: '16.4', co: 1,
    q: 'Según el artículo 16.4 de la Ley 5/2021 de Aragón, las encomiendas de gestión:',
    o: [
      'Podrán tener por objeto prestaciones propias de los contratos regulados en la legislación de contratos del sector público.',
      'No podrán tener por objeto prestaciones propias de los contratos regulados en la legislación de contratos del sector público.',
      'No podrán tener por objeto actividades de carácter material o técnico de la competencia de los órganos administrativos.',
      'Solo podrán tener por objeto prestaciones propias de los contratos menores regulados en la legislación de contratos del sector público.',
    ],
    cita: 'Las encomiendas de gestión no podrán tener por objeto prestaciones propias de los contratos regulados en la legislación de contratos del sector público.',
    why: 'El artículo 16.4 excluye que la encomienda de gestión recaiga sobre prestaciones propias de los contratos del sector público.',
    bad: { A: 'Es justo lo contrario: no podrán tener por objeto prestaciones propias de los contratos del sector público.', C: 'La encomienda recae precisamente sobre actividades de carácter material o técnico (art. 16.1); lo excluido son las prestaciones contractuales.', D: 'La exclusión alcanza a las prestaciones propias de los contratos del sector público, sin que se admitan los contratos menores.' } },

  { art: 18, n: '18.2', co: 2,
    q: 'De acuerdo con el artículo 18.2 de la Ley 5/2021 de Aragón, la delegación de firma:',
    o: [
      'Alterará la competencia del órgano delegante y, para su validez, será necesaria su publicación en el «Boletín Oficial de Aragón».',
      'No alterará la competencia del órgano delegante, pero para su validez será necesaria su publicación.',
      'No alterará la competencia del órgano delegante y para su validez no será necesaria su publicación.',
      'Alterará la competencia del órgano delegante, aunque para su validez no será necesaria su publicación.',
    ],
    cita: 'La delegación de firma no alterará la competencia del órgano delegante y para su validez no será necesaria su publicación.',
    why: 'El artículo 18.2 establece que la delegación de firma no altera la competencia del delegante y no precisa publicación para ser válida.',
    bad: { A: 'Ni altera la competencia del órgano delegante ni exige publicación para su validez.', B: 'No es necesaria la publicación para la validez de la delegación de firma.', D: 'La delegación de firma no altera la competencia del órgano delegante.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.n} Ley 5/2021 Aragón**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  // sanity: distribución de posiciones
  const dist = [0, 0, 0, 0];
  Q.forEach(q => dist[q.co]++);
  console.log('Distribución correct_option:', dist.map((c, i) => L[i] + ':' + c).join(' '), '(total ' + Q.length + ')');

  const rows = Q.map(item => ({
    question_text: item.q,
    option_a: item.o[0],
    option_b: item.o[1],
    option_c: item.o[2],
    option_d: item.o[3],
    correct_option: item.co,
    explanation: buildExplanation(item),
    difficulty: 'medium',
    question_type: 'single',
    primary_article_id: ART[item.art],
    tags: ['ia_generada', TAG],
    lifecycle_state: 'draft',
    deactivation_reason: 'Pendiente de revisión post-generación IA',
    topic_review_status: 'pending',
  }));

  const { data, error } = await supabase.from('questions').insert(rows).select('id, primary_article_id, correct_option');
  if (error) return console.error('❌ INSERT error:', error);
  console.log('✅ Insertadas', data.length, 'preguntas DRAFT con tag', TAG);
  data.forEach((d, i) => console.log('  ', d.id, 'art', Q[i].n, 'correct', L[d.correct_option]));
})();
