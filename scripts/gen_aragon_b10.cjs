// Batch b10 — Ley 5/2021 Aragón, arts 23-34 (órganos colegiados, abstención, recusación)
// Bloque T7. 15 preguntas DRAFT. Manual: docs/maintenance/generar-preguntas-con-ia.md (v2.5).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TAG = 'piloto_ley_5_2021_aragon_b10';
const ART = {
  23: 'f54b13c0-cc3b-47ab-b641-2f055f68f598',
  25: '2aa468de-1175-4499-bd86-83f12b579c1d',
  26: '01240574-71a5-4ede-b38b-67ed669e5b1e',
  27: 'f736e993-ec25-4026-82d9-8acf4e3bc845',
  29: 'aa5a60df-442b-4bc2-98fd-9bf2052bf2fc',
  30: '81a31c16-a0a5-46fe-92ae-6a8813f38444',
  31: 'f6df7c0c-7919-4622-9c62-ca0e87832782',
  33: '3fbfffca-9bf3-4098-9112-6d5faf7b83e6',
  34: 'c3ea4732-700a-45eb-bc4c-5865c74b955e',
};
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: 23, n: '23.1', co: 1,
    q: 'Según el artículo 23.1 de la Ley 5/2021 de Aragón, son órganos colegiados aquellos que se creen formalmente y estén integrados por:',
    o: [
      'Dos o más personas, a las que se atribuyan funciones administrativas de decisión, propuesta, asesoramiento, seguimiento o control.',
      'Tres o más personas, a las que se atribuyan funciones administrativas de decisión, propuesta, asesoramiento, seguimiento o control.',
      'Cinco o más personas, a las que se atribuyan funciones de decisión, propuesta, asesoramiento o control presupuestario.',
      'Tres o más personas, siempre que ejerzan exclusivamente funciones de decisión y propuesta en materia económica.',
    ],
    cita: 'Son órganos colegiados aquellos que se creen formalmente y estén integrados por tres o más personas, a los que se atribuyan funciones administrativas de decisión, propuesta, asesoramiento, seguimiento o control.',
    why: 'El artículo 23.1 exige tres o más personas y la atribución de funciones de decisión, propuesta, asesoramiento, seguimiento o control.',
    bad: { A: 'El umbral son tres o más personas, no dos.', C: 'No se exigen cinco personas ni se limita el control al ámbito presupuestario.', D: 'Las funciones no se limitan a decisión y propuesta en materia económica; incluyen asesoramiento, seguimiento o control.' } },

  { art: 25, n: '25.1.d)', co: 2,
    q: 'Conforme al artículo 25.1 de la Ley 5/2021 de Aragón, corresponde a quien ostente la presidencia del órgano colegiado, entre otras funciones:',
    o: [
      'Ejercer el voto de calidad solo en las sesiones extraordinarias, a efectos de adoptar acuerdos por mayoría absoluta.',
      'Abstenerse de votar para garantizar la imparcialidad, dirimiendo los empates mediante una segunda votación.',
      'Dirimir con su voto los empates, a efectos de adoptar acuerdos, excepto en los órganos del artículo 24.3, en los que el voto será dirimente si así lo establecen sus normas.',
      'Dirimir los empates únicamente cuando lo soliciten la mayoría de los miembros presentes en la sesión.',
    ],
    cita: 'Dirimir con su voto los empates, a efectos de adoptar acuerdos, excepto si se trata de los órganos colegiados a que se refiere el artículo 24.3, en los que el voto será dirimente si así lo establecen sus propias normas.',
    why: 'La letra d) del artículo 25.1 atribuye a la presidencia el voto de calidad para dirimir empates, con la salvedad de los órganos del artículo 24.3.',
    bad: { A: 'El voto de calidad no se limita a las sesiones extraordinarias ni exige mayoría absoluta.', B: 'La presidencia no se abstiene: dirime los empates con su voto.', D: 'El voto dirimente no depende de que lo soliciten la mayoría de los miembros presentes.' } },

  { art: 25, n: '25.2', co: 0,
    q: 'Según el artículo 25.2 de la Ley 5/2021 de Aragón, en casos de vacante, ausencia, enfermedad u otra causa legal, quien ostente la Presidencia del órgano colegiado será sustituido por:',
    o: [
      'La persona titular de la Vicepresidencia que corresponda y, en su defecto, por el miembro del órgano de mayor jerarquía, antigüedad y edad, por este orden.',
      'El miembro del órgano colegiado de mayor edad y, en su defecto, por la persona titular de la Vicepresidencia que corresponda.',
      'La persona titular de la Secretaría del órgano y, en su defecto, por el miembro de mayor antigüedad en el cargo.',
      'El miembro del órgano colegiado que designe el pleno atendiendo a su jerarquía, antigüedad y edad, por este orden.',
    ],
    cita: 'En casos de vacante, ausencia, enfermedad u otra causa legal, quien ostente la Presidencia será sustituido por la persona titular de la Vicepresidencia que corresponda y, en su defecto, por el miembro del órgano colegiado de mayor jerarquía, antigüedad y edad, por este orden.',
    why: 'El artículo 25.2 fija el orden de sustitución: primero la Vicepresidencia y, en su defecto, el miembro de mayor jerarquía, antigüedad y edad.',
    bad: { B: 'El primer llamado es la Vicepresidencia, no el miembro de mayor edad.', C: 'La sustitución no recae en la Secretaría, sino en la Vicepresidencia y, en su defecto, en el miembro de mayor jerarquía, antigüedad y edad.', D: 'El orden lo fija la ley (Vicepresidencia y, en su defecto, jerarquía/antigüedad/edad), no una designación del pleno.' } },

  { art: 26, n: '26.1.a)', co: 3,
    q: 'De acuerdo con el artículo 26.1 de la Ley 5/2021 de Aragón, los miembros del órgano colegiado tienen derecho a recibir la convocatoria con el orden del día con una antelación mínima de:',
    o: [
      'Tres días.',
      'Cinco días.',
      'Diez días.',
      'Dos días.',
    ],
    cita: 'Recibir, con una antelación mínima de dos días, la convocatoria conteniendo el orden del día de las reuniones.',
    why: 'La letra a) del artículo 26.1 reconoce el derecho a recibir la convocatoria con una antelación mínima de dos días.',
    bad: { A: 'La antelación mínima es de dos días, no de tres.', B: 'La antelación mínima es de dos días, no de cinco.', C: 'La antelación mínima es de dos días, no de diez.' } },

  { art: 26, n: '26.1.d)', co: 0,
    q: 'Según el artículo 26.1.d) de la Ley 5/2021 de Aragón, en relación con el derecho al voto de los miembros del órgano colegiado:',
    o: [
      'No podrán abstenerse en las votaciones quienes, por su cualidad de autoridades o personal al servicio de las administraciones públicas, tengan la condición de miembros natos de órganos colegiados, en virtud del cargo que desempeñan.',
      'Podrán abstenerse libremente en las votaciones todos los miembros, incluidos quienes tengan la condición de miembros natos del órgano por razón del cargo.',
      'No podrán formular voto particular quienes tengan la condición de miembros natos del órgano por razón del cargo que desempeñan.',
      'Deberán abstenerse en las votaciones quienes tengan la condición de miembros natos del órgano por razón del cargo que desempeñan.',
    ],
    cita: 'No podrán abstenerse en las votaciones quienes por su cualidad de autoridades o personal al servicio de las administraciones públicas, tengan la condición de miembros natos de órganos colegiados, en virtud del cargo que desempeñan.',
    why: 'La letra d) del artículo 26.1 prohíbe abstenerse en las votaciones a los miembros natos que lo son por su cualidad de autoridades o personal al servicio de las administraciones públicas.',
    bad: { B: 'Los miembros natos no pueden abstenerse en las votaciones.', C: 'Lo que la norma impide a estos miembros es abstenerse en la votación, no formular voto particular.', D: 'No se les obliga a abstenerse: se les prohíbe abstenerse.' } },

  { art: 27, n: '27.2', co: 1,
    q: 'Conforme al artículo 27.2 de la Ley 5/2021 de Aragón, corresponde al secretario o secretaria del órgano colegiado:',
    o: [
      'Dirimir con su voto los empates y velar por la legalidad material de las actuaciones del órgano colegiado.',
      'Velar por la legalidad formal y material de las actuaciones del órgano y garantizar que se respetan los procedimientos y reglas de constitución y adopción de acuerdos.',
      'Ostentar la representación del órgano y asegurar el cumplimiento de las leyes en sus actuaciones.',
      'Aprobar las actas de las sesiones y resolver los recursos que se interpongan contra los acuerdos del órgano.',
    ],
    cita: 'Corresponderá al secretario o secretaria velar por la legalidad formal y material de las actuaciones del órgano colegiado y garantizar que los procedimientos y reglas de constitución y adopción de acuerdos son respetados.',
    why: 'El artículo 27.2 atribuye a la Secretaría velar por la legalidad formal y material y garantizar el respeto de los procedimientos y reglas de constitución y adopción de acuerdos.',
    bad: { A: 'Dirimir los empates corresponde a la Presidencia (art. 25.1.d), no a la Secretaría.', C: 'Ostentar la representación del órgano corresponde a la Presidencia (art. 25.1.a).', D: 'La Secretaría redacta y autoriza las actas, pero no resuelve recursos contra los acuerdos del órgano.' } },

  { art: 29, n: '29.5', co: 2,
    q: 'De acuerdo con el artículo 29.5 de la Ley 5/2021 de Aragón, salvo que la norma de creación o funcionamiento del órgano establezca otra distinta, los acuerdos de los órganos colegiados serán adoptados por:',
    o: [
      'Mayoría absoluta de votos.',
      'Mayoría de dos tercios de los miembros.',
      'Mayoría simple de votos.',
      'Unanimidad de los miembros presentes.',
    ],
    cita: 'Los acuerdos serán adoptados por mayoría simple de votos, salvo que la norma de creación o funcionamiento del órgano establezca otra distinta.',
    why: 'El artículo 29.5 establece la mayoría simple como regla general para la adopción de acuerdos, salvo previsión distinta.',
    bad: { A: 'La regla general es la mayoría simple, no la absoluta.', B: 'No se exige mayoría de dos tercios como regla general.', D: 'No se exige unanimidad para adoptar acuerdos como regla general.' } },

  { art: 29, n: '29.4', co: 3,
    q: 'Según el artículo 29.4 de la Ley 5/2021 de Aragón, podrá ser objeto de deliberación o acuerdo un asunto que no figure incluido en el orden del día cuando:',
    o: [
      'Lo solicite al menos un tercio de los miembros y la presidencia declare la urgencia del asunto.',
      'Asistan la mitad de los miembros del órgano y se declare la urgencia por mayoría absoluta de los presentes.',
      'Lo autorice la persona titular de la Secretaría tras comprobar la urgencia y la trascendencia del asunto.',
      'Asistan todos los miembros del órgano colegiado y sea declarada la urgencia del asunto por el voto favorable de la mayoría.',
    ],
    cita: 'No podrá ser objeto de deliberación o acuerdo ningún asunto que no figure incluido en el orden del día, salvo que asistan todos los miembros del órgano colegiado y sea declarada la urgencia del asunto por el voto favorable de la mayoría.',
    why: 'El artículo 29.4 exige, para tratar un asunto no incluido en el orden del día, la asistencia de todos los miembros y la declaración de urgencia por mayoría.',
    bad: { A: 'No basta un tercio de los miembros: deben asistir todos.', B: 'No basta la mitad de los miembros: deben asistir todos y declararse la urgencia por mayoría.', C: 'No es la Secretaría quien lo autoriza; se exige asistencia de todos los miembros y declaración de urgencia por mayoría.' } },

  { art: 29, n: '29.6', co: 0,
    q: 'Conforme al artículo 29.6 de la Ley 5/2021 de Aragón, cuando los miembros del órgano colegiado voten en contra o se abstengan:',
    o: [
      'Quedarán exentos de la responsabilidad que, en su caso, pueda derivarse de los acuerdos.',
      'Quedarán exentos de responsabilidad solo si formulan voto particular por escrito en el plazo de dos días.',
      'Responderán solidariamente de los acuerdos adoptados salvo que hagan constar su oposición en el acta.',
      'Quedarán exentos de responsabilidad únicamente cuando su voto en contra conste en la certificación del acuerdo.',
    ],
    cita: 'Cuando los miembros del órgano voten en contra o se abstengan, quedarán exentos de la responsabilidad que, en su caso, pueda derivarse de los acuerdos.',
    why: 'El artículo 29.6 exime de responsabilidad por los acuerdos a los miembros que votan en contra o se abstienen, sin condición adicional.',
    bad: { B: 'La exención no se condiciona a formular voto particular en dos días.', C: 'No responden solidariamente: quedan exentos por el voto en contra o la abstención.', D: 'La exención deriva del voto en contra o la abstención, no de su constancia en la certificación.' } },

  { art: 30, n: '30.4', co: 1,
    q: 'Según el artículo 30.4 de la Ley 5/2021 de Aragón, los miembros que discrepen del acuerdo mayoritario podrán formular voto particular por escrito en el plazo de:',
    o: [
      'Tres días.',
      'Dos días.',
      'Cinco días.',
      'Diez días.',
    ],
    cita: 'Los miembros que discrepen del acuerdo mayoritario podrán formular voto particular por escrito en el plazo de dos días, que se incorporará al texto aprobado.',
    why: 'El artículo 30.4 fija en dos días el plazo para formular voto particular por escrito.',
    bad: { A: 'El plazo es de dos días, no de tres.', C: 'El plazo es de dos días, no de cinco.', D: 'El plazo es de dos días, no de diez.' } },

  { art: 31, n: '31.2', co: 2,
    q: 'De acuerdo con el artículo 31.2 de la Ley 5/2021 de Aragón, los acuerdos adoptados por delegación de un órgano colegiado deberán adoptarse con:',
    o: [
      'La mayoría absoluta de los miembros del órgano delegado.',
      'Las mayorías que libremente fije el órgano en quien se delega.',
      'Las mismas mayorías que se requieran para el órgano delegante.',
      'La mayoría de dos tercios de los miembros del órgano delegante.',
    ],
    cita: 'Los acuerdos adoptados por delegación deberán adoptarse con las mismas mayorías que se requieran para el órgano delegante.',
    why: 'El artículo 31.2 exige que los acuerdos por delegación se adopten con las mismas mayorías del órgano delegante.',
    bad: { A: 'No se exige la mayoría absoluta del órgano delegado, sino la mayoría propia del delegante.', B: 'Las mayorías no se fijan libremente: son las del órgano delegante.', D: 'No se exige una mayoría de dos tercios, sino la que corresponda al órgano delegante.' } },

  { art: 33, n: '33.1', co: 3,
    q: 'Según el artículo 33.1 de la Ley 5/2021 de Aragón, las autoridades y el personal al servicio de la Administración en quienes concurra un motivo de abstención:',
    o: [
      'Podrán seguir interviniendo en el procedimiento siempre que lo comuniquen a su superior inmediato.',
      'Se abstendrán de intervenir y lo comunicarán al órgano colegiado, que resolverá sobre su sustitución.',
      'Se abstendrán de intervenir en el procedimiento sin necesidad de comunicarlo a su superior inmediato.',
      'Se abstendrán de intervenir en el procedimiento y lo comunicarán a su superior inmediato, quien resolverá lo procedente.',
    ],
    cita: 'Las autoridades y el personal al servicio de la Administración en quienes se den algunas de las circunstancias señaladas se abstendrán de intervenir en el procedimiento y lo comunicarán a su superior inmediato, quien resolverá lo procedente.',
    why: 'El artículo 33.1 obliga a abstenerse y a comunicarlo al superior inmediato, que resolverá lo procedente.',
    bad: { A: 'No pueden seguir interviniendo: deben abstenerse.', B: 'La comunicación se dirige al superior inmediato, no al órgano colegiado.', C: 'Debe comunicarse al superior inmediato, no basta con abstenerse.' } },

  { art: 33, n: '33.4', co: 0,
    q: 'Conforme al artículo 33.4 de la Ley 5/2021 de Aragón, la actuación de autoridades y personal al servicio de la Administración en quienes concurran motivos de abstención:',
    o: [
      'No implicará, necesariamente y en todo caso, la invalidez de los actos en que hayan intervenido.',
      'Implicará, en todo caso, la nulidad de pleno derecho de los actos en que hayan intervenido.',
      'Implicará siempre la anulabilidad de los actos en que hayan intervenido, salvo convalidación posterior.',
      'No tendrá ninguna consecuencia sobre la validez ni sobre la responsabilidad de quienes hayan intervenido.',
    ],
    cita: 'La actuación de autoridades y personal al servicio de la Administración pública en quienes concurran motivos de abstención no implicará, necesariamente y en todo caso, la invalidez de los actos en que hayan intervenido.',
    why: 'El artículo 33.4 establece que la intervención pese a un motivo de abstención no determina por sí sola y en todo caso la invalidez de los actos.',
    bad: { B: 'La norma no impone la nulidad de pleno derecho en todo caso.', C: 'Tampoco impone la anulabilidad en todo caso; la invalidez no es automática.', D: 'Sí puede haber consecuencias: la no abstención da lugar a la responsabilidad que proceda (art. 33.5).' } },

  { art: 34, n: '34.4', co: 1,
    q: 'Según el artículo 34.4 de la Ley 5/2021 de Aragón, si la persona recusada niega la causa de recusación, el superior resolverá en el plazo de:',
    o: [
      'Cinco días, previos los informes y comprobaciones que considere oportunos.',
      'Tres días, previos los informes y comprobaciones que considere oportunos.',
      'Diez días, previa audiencia de la persona recusada y del interesado.',
      'Dos días, sin necesidad de practicar informe ni comprobación alguna.',
    ],
    cita: 'Si la persona recusada niega la causa de recusación, el superior resolverá en el plazo de tres días, previos los informes y comprobaciones que considere oportunos.',
    why: 'El artículo 34.4 fija en tres días el plazo para que el superior resuelva, previos los informes y comprobaciones oportunos.',
    bad: { A: 'El plazo es de tres días, no de cinco.', C: 'El plazo es de tres días, no de diez.', D: 'El plazo es de tres días y el superior puede practicar informes y comprobaciones.' } },

  { art: 34, n: '34.5', co: 2,
    q: 'De acuerdo con el artículo 34.5 de la Ley 5/2021 de Aragón, contra las resoluciones adoptadas en materia de recusación:',
    o: [
      'Cabrá recurso de alzada ante el órgano superior jerárquico del que las dictó en el plazo de un mes.',
      'Cabrá recurso potestativo de reposición ante el mismo órgano que resolvió la recusación.',
      'No cabrá recurso, sin perjuicio de poder alegar la recusación al interponer el recurso que proceda contra el acto que ponga fin al procedimiento.',
      'No cabrá recurso alguno, ni siquiera con ocasión del recurso contra el acto que ponga fin al procedimiento.',
    ],
    cita: 'Contra las resoluciones adoptadas en esta materia no cabrá recurso, sin perjuicio de la posibilidad de alegar la recusación al interponer el recurso que proceda contra el acto que ponga fin al procedimiento.',
    why: 'El artículo 34.5 excluye el recurso autónomo, pero permite alegar la recusación al recurrir el acto que pone fin al procedimiento.',
    bad: { A: 'No cabe recurso de alzada autónomo contra la resolución de recusación.', B: 'Tampoco cabe recurso potestativo de reposición autónomo.', D: 'Sí cabe alegar la recusación al interponer el recurso contra el acto que pone fin al procedimiento.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.n} Ley 5/2021 Aragón**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const dist = [0, 0, 0, 0];
  Q.forEach(q => dist[q.co]++);
  console.log('Distribución correct_option:', dist.map((c, i) => L[i] + ':' + c).join(' '), '(total ' + Q.length + ')');

  const rows = Q.map(item => ({
    question_text: item.q,
    option_a: item.o[0], option_b: item.o[1], option_c: item.o[2], option_d: item.o[3],
    correct_option: item.co,
    explanation: buildExplanation(item),
    difficulty: 'medium', question_type: 'single',
    primary_article_id: ART[item.art],
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
