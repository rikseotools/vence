// Batch b17 — Ley 5/2021 Aragón, cierre de gap (artículos sueltos):
// 11,17,19,20,21,22,24,28,32,37,47,48,148,156,152. 15 preguntas DRAFT.
// article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b17';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '11', n: '11.3', co: 1,
    q: 'Según el artículo 11.3 de la Ley 5/2021 de Aragón, las competencias de las personas titulares de las secretarías generales técnicas, direcciones generales, delegaciones territoriales, jefaturas de servicio y direcciones de servicios provinciales serán delegables:',
    o: [
      'Sin necesidad de autorización alguna, por tratarse de competencias propias.',
      'Previa autorización expresa de la persona titular del departamento del que dependan.',
      'Previa autorización del Gobierno de Aragón en todos los casos.',
      'Únicamente en favor de órganos jerárquicamente dependientes de ellas.',
    ],
    cita: 'Las competencias de las personas titulares de las secretarías generales técnicas, de las direcciones generales, de las delegaciones territoriales, de las jefaturas de servicio y de las direcciones de servicios provinciales serán delegables previa autorización expresa de la persona titular del departamento del que dependan.',
    why: 'El artículo 11.3 supedita esa delegación a la autorización expresa de la persona titular del departamento del que dependan.',
    bad: { A: 'Se exige autorización expresa del titular del departamento, no es delegación libre.', C: 'La autorización es del titular del departamento, no del Gobierno de Aragón.', D: 'La delegación no se limita a órganos jerárquicamente dependientes.' } },

  { art: '17', n: '17.2', co: 2,
    q: 'Conforme al artículo 17.2 de la Ley 5/2021 de Aragón, el órgano competente para formalizar las encomiendas de gestión es:',
    o: [
      'La persona titular de la secretaría general técnica del departamento encomendante.',
      'El Gobierno de Aragón, en todo caso, mediante acuerdo.',
      'La persona titular del departamento o del órgano máximo de dirección del organismo público o consorcio encomendante.',
      'La dirección general competente por razón de la materia del organismo encomendado.',
    ],
    cita: 'El órgano competente para formalizar las encomiendas de gestión es la persona titular del departamento o del órgano máximo de dirección del organismo público o consorcio encomendante.',
    why: 'El artículo 17.2 atribuye la formalización a la titularidad del departamento o del órgano máximo de dirección del organismo o consorcio encomendante.',
    bad: { A: 'No es la secretaría general técnica, sino la titularidad del departamento o del órgano máximo de dirección.', B: 'El Gobierno solo autoriza previamente cuando la encomienda es con un órgano ajeno a la Administración autonómica, no formaliza en todo caso.', D: 'No es la dirección general del organismo encomendado, sino el órgano encomendante indicado en el precepto.' } },

  { art: '19', n: '19.2', co: 0,
    q: 'Según el artículo 19.2 de la Ley 5/2021 de Aragón, la suplencia:',
    o: [
      'No implicará alteración de la competencia y para su validez no será necesaria su publicación.',
      'Implicará alteración de la competencia y para su validez será necesaria su publicación.',
      'No implicará alteración de la competencia, pero para su validez será necesaria su publicación.',
      'Implicará alteración de la competencia, aunque para su validez no será necesaria su publicación.',
    ],
    cita: 'La suplencia no implicará alteración de la competencia y para su validez no será necesaria su publicación.',
    why: 'El artículo 19.2 establece que la suplencia no altera la competencia y no precisa publicación para su validez.',
    bad: { B: 'Ni altera la competencia ni exige publicación para su validez.', C: 'No es necesaria la publicación para la validez de la suplencia.', D: 'La suplencia no altera la competencia del órgano.' } },

  { art: '20', n: '20.2.a)', co: 3,
    q: 'De acuerdo con el artículo 20.2 de la Ley 5/2021 de Aragón, las personas titulares de los departamentos se sustituirán:',
    o: [
      'Entre sí, sin necesidad de designación previa de suplente.',
      'Por el consejero o consejera de mayor antigüedad en el cargo.',
      'Entre sí, previa designación de suplente por el propio Gobierno de Aragón en pleno.',
      'Entre sí, previa designación de suplente por la Presidencia del Gobierno.',
    ],
    cita: 'Las personas titulares de los departamentos se sustituirán entre sí, previa designación de suplente por la Presidencia del Gobierno.',
    why: 'La letra a) del artículo 20.2 establece la sustitución recíproca de los titulares de departamentos, previa designación de suplente por la Presidencia del Gobierno.',
    bad: { A: 'Sí se exige designación previa de suplente por la Presidencia del Gobierno.', B: 'No se atiende a la antigüedad: la designación la hace la Presidencia del Gobierno.', C: 'La designación de suplente la hace la Presidencia del Gobierno, no el Gobierno en pleno.' } },

  { art: '21', n: '21.7', co: 0,
    q: 'Según el artículo 21.7 de la Ley 5/2021 de Aragón, los conflictos de atribuciones solo podrán suscitarse:',
    o: [
      'Entre órganos de la misma Administración no relacionados jerárquicamente y respecto a asuntos sobre los que no haya finalizado el procedimiento.',
      'Entre órganos de distintas Administraciones, cualquiera que sea su relación jerárquica.',
      'Entre órganos jerárquicamente relacionados, mientras no haya finalizado el procedimiento.',
      'Entre órganos de la misma Administración, incluso una vez finalizado el procedimiento administrativo.',
    ],
    cita: 'Los conflictos de atribuciones solo podrán suscitarse entre órganos de la misma Administración no relacionados jerárquicamente y respecto a asuntos sobre los que no haya finalizado el procedimiento administrativo.',
    why: 'El artículo 21.7 limita los conflictos a órganos de la misma Administración no jerárquicos y a asuntos no finalizados.',
    bad: { B: 'Han de ser de la misma Administración, no de distintas.', C: 'Han de ser órganos NO relacionados jerárquicamente.', D: 'El procedimiento no debe haber finalizado.' } },

  { art: '22', n: '22.1', co: 1,
    q: 'Conforme al artículo 22.1 de la Ley 5/2021 de Aragón, los conflictos de atribuciones que se susciten entre los departamentos de la Administración autonómica serán resueltos por:',
    o: [
      'El Gobierno de Aragón mediante acuerdo de su pleno.',
      'La persona titular de la Presidencia.',
      'La persona titular del departamento de mayor antigüedad.',
      'El órgano superior jerárquico común de ambos departamentos.',
    ],
    cita: 'Los conflictos de atribuciones que se susciten entre los departamentos de la Administración de la comunidad autónoma serán resueltos por la persona titular de la Presidencia.',
    why: 'El artículo 22.1 atribuye a la persona titular de la Presidencia la resolución de los conflictos entre departamentos.',
    bad: { A: 'No los resuelve el Gobierno en pleno, sino la persona titular de la Presidencia.', C: 'No se atiende a la antigüedad: resuelve la persona titular de la Presidencia.', D: 'No es un superior jerárquico común: resuelve la Presidencia.' } },

  { art: '24', n: '24.1', co: 2,
    q: 'Según el artículo 24.1 de la Ley 5/2021 de Aragón, los órganos colegiados de la Administración autonómica se regirán por:',
    o: [
      'Exclusivamente por sus normas o convenios de creación y por sus reglamentos de régimen interior.',
      'La legislación autonómica de organización administrativa, con exclusión de la legislación básica estatal.',
      'La legislación básica del Estado, las disposiciones de esta sección, sus normas o convenios de creación y sus reglamentos de régimen interior.',
      'El derecho privado y, con carácter supletorio, por la legislación básica del Estado.',
    ],
    cita: 'Los órganos colegiados de la Administración de la Comunidad Autónoma se regirán por la legislación básica del Estado, por las disposiciones contenidas en esta sección, por sus normas o convenios de creación y por sus reglamentos de régimen interior.',
    why: 'El artículo 24.1 combina la legislación básica estatal, esta sección, las normas o convenios de creación y los reglamentos de régimen interior.',
    bad: { A: 'No es solo por sus normas de creación: también la legislación básica estatal y esta sección.', B: 'No se excluye la legislación básica estatal: es la primera fuente citada.', D: 'No se rigen por el derecho privado, sino por la legislación básica estatal y las demás fuentes citadas.' } },

  { art: '28', n: '28.a)', co: 3,
    q: 'De acuerdo con el artículo 28 de la Ley 5/2021 de Aragón, la persona titular de la Secretaría del órgano colegiado asistirá a las reuniones:',
    o: [
      'Con voz y voto en todo caso, por su condición de secretaría del órgano.',
      'Sin voz ni voto, limitándose a levantar acta de la sesión.',
      'Con voz, pero sin voto, sin excepción alguna.',
      'Con voz, pero sin voto, y con voz y voto si la secretaría la ostenta un miembro del órgano.',
    ],
    cita: 'Asistir a las reuniones con voz, pero sin voto, y con voz y voto si la secretaría del órgano la ostenta un miembro del mismo.',
    why: 'La letra a) del artículo 28 atribuye a la secretaría voz sin voto, salvo que sea también miembro del órgano, en cuyo caso tiene voz y voto.',
    bad: { A: 'No tiene voto en todo caso: solo si es además miembro del órgano.', B: 'Tiene voz, no se limita a levantar acta sin voz.', C: 'Hay excepción: con voz y voto si la secretaría la ostenta un miembro del órgano.' } },

  { art: '32', n: '32.d)', co: 0,
    q: 'Según el artículo 32 de la Ley 5/2021 de Aragón, en determinados órganos colegiados con participación de intereses sociales, el titular de la Presidencia podrá considerar válidamente constituido el órgano:',
    o: [
      'Con independencia del número de miembros presentes, cuando lo estén los representantes de la Administración autonómica y los portavoces de las organizaciones de intereses sociales.',
      'Solo cuando estén presentes la mitad más uno de la totalidad de sus miembros.',
      'Cuando estén presentes todos los representantes de las organizaciones de intereses sociales.',
      'Únicamente cuando lo autorice expresamente el Gobierno de Aragón para esa sesión.',
    ],
    cita: 'El titular de la Presidencia podrá considerar válidamente constituido el órgano, con independencia del número de miembros presentes, cuando lo estén los representantes de la Administración de la comunidad autónoma y de las organizaciones representativas de los intereses sociales a quienes se haya atribuido expresamente la condición de portavoces.',
    why: 'La letra d) del artículo 32 permite la válida constitución, sea cual sea el número de presentes, si están los representantes de la Administración autonómica y los portavoces de los intereses sociales.',
    bad: { B: 'No se exige la mitad más uno: basta con los representantes de la Administración y los portavoces.', C: 'No se exige la presencia de todos los representantes sociales, sino de los portavoces.', D: 'No requiere autorización del Gobierno para cada sesión.' } },

  { art: '37', n: '37', co: 1,
    q: 'Conforme al artículo 37 de la Ley 5/2021 de Aragón, la Administración autonómica garantizará su funcionamiento electrónico de acuerdo, entre otros, con los principios de:',
    o: [
      'Jerarquía, desconcentración y tutela tecnológica.',
      'Neutralidad tecnológica, no discriminación tecnológica e interoperabilidad.',
      'Reserva tecnológica, exclusividad de plataforma y dependencia de proveedor.',
      'Autotutela, discrecionalidad técnica y secreto de los sistemas.',
    ],
    cita: 'La Administración pública de la Comunidad Autónoma de Aragón adoptará las medidas necesarias para garantizar su funcionamiento electrónico de acuerdo con los principios de transparencia, publicidad, eficiencia, modernización, responsabilidad, usabilidad, calidad, seguridad, disponibilidad, accesibilidad, no discriminación tecnológica, neutralidad tecnológica e interoperabilidad.',
    why: 'El artículo 37 cita, entre otros, los principios de neutralidad tecnológica, no discriminación tecnológica e interoperabilidad.',
    bad: { A: 'Jerarquía y desconcentración son principios de organización interna, no del funcionamiento electrónico del art. 37.', C: 'Los principios son de no discriminación y neutralidad tecnológica, no de reserva ni dependencia de proveedor.', D: 'El artículo no menciona autotutela ni secreto de los sistemas, sino transparencia, seguridad e interoperabilidad.' } },

  { art: '47', n: '47.2', co: 2,
    q: 'Según el artículo 47.2 de la Ley 5/2021 de Aragón, en el ejercicio de sus competencias cada órgano deberá ponderar:',
    o: [
      'Exclusivamente sus fines propios, conforme al principio de especialidad.',
      'Únicamente los fines del departamento del que dependa jerárquicamente.',
      'No solo sus fines propios, sino también los de la Administración de la comunidad autónoma en su conjunto.',
      'Solo los fines fijados anualmente por la ley de presupuestos.',
    ],
    cita: 'Cada órgano deberá ponderar, en el ejercicio de sus competencias, no solo sus fines propios, sino también los de la Administración de la comunidad autónoma en su conjunto, y se facilitará preferentemente la prestación conjunta de servicios a los interesados.',
    why: 'El artículo 47.2 obliga a ponderar tanto los fines propios como los de la Administración autonómica en su conjunto.',
    bad: { A: 'No solo los fines propios: también los del conjunto de la Administración autonómica.', B: 'No se limita a los del departamento: abarca los de la Administración en su conjunto.', D: 'No se reduce a los fines presupuestarios anuales.' } },

  { art: '48', n: '48.5', co: 3,
    q: 'De acuerdo con el artículo 48.5 de la Ley 5/2021 de Aragón, los planes y programas, el grado de cumplimiento de sus objetivos y los resultados obtenidos serán:',
    o: [
      'Evaluados al final de cada legislatura y remitidos a las Cortes de Aragón.',
      'Evaluados por la Cámara de Cuentas y publicados en el «Boletín Oficial de Aragón».',
      'Evaluados anualmente y comunicados únicamente al departamento de hacienda.',
      'Evaluados periódicamente y publicados en el Portal de Transparencia.',
    ],
    cita: 'Los planes y programas [...], el grado de cumplimiento de los objetivos fijados en los mismos, así como los resultados obtenidos, serán evaluados periódicamente y publicados en el Portal de Transparencia, junto con los indicadores de medida y valoración.',
    why: 'El artículo 48.5 exige evaluación periódica y publicación en el Portal de Transparencia.',
    bad: { A: 'La evaluación es periódica, no al final de cada legislatura; la publicación es en el Portal de Transparencia.', B: 'No es la Cámara de Cuentas ni el «Boletín Oficial de Aragón»: evaluación periódica y Portal de Transparencia.', C: 'No es solo comunicación al departamento de hacienda: se publica en el Portal de Transparencia.' } },

  { art: '148', n: '148.2', co: 0,
    q: 'Según el artículo 148.2 de la Ley 5/2021 de Aragón, de la celebración de un convenio con otra u otras comunidades autónomas deberá informarse a las Cortes de Aragón y a las Cortes Generales en el plazo de:',
    o: [
      'Un mes a contar desde la fecha de su firma.',
      'Tres meses a contar desde la fecha de su firma.',
      'Quince días a contar desde la fecha de su firma.',
      'Un mes a contar desde su inscripción en el Registro de Convenios.',
    ],
    cita: 'De la celebración de estos convenios deberá informarse a las Cortes de Aragón y a las Cortes Generales en el plazo de un mes a contar desde la fecha de su firma.',
    why: 'El artículo 148.2 fija en un mes desde la firma el plazo para informar a las Cortes de Aragón y a las Cortes Generales.',
    bad: { B: 'El plazo es de un mes, no de tres meses.', C: 'El plazo es de un mes, no de quince días.', D: 'El cómputo es desde la firma, no desde la inscripción en el Registro.' } },

  { art: '156', n: '156.1', co: 1,
    q: 'Conforme al artículo 156.1 de la Ley 5/2021 de Aragón, la Administración autonómica podrá constituir con otras administraciones públicas:',
    o: [
      'Únicamente consorcios para la consecución de finalidades de interés común.',
      'Consorcios, organizaciones personificadas de gestión para finalidades de interés común, o empresas públicas.',
      'Exclusivamente empresas públicas de capital íntegramente autonómico.',
      'Fundaciones del sector público y agrupaciones de interés económico.',
    ],
    cita: 'La Administración de la Comunidad Autónoma de Aragón podrá constituir con otras administraciones públicas consorcios, organizaciones personificadas de gestión para la consecución de finalidades de interés común, o empresas públicas, de acuerdo con la normativa reguladora de estas organizaciones.',
    why: 'El artículo 156.1 permite constituir consorcios, organizaciones personificadas de gestión o empresas públicas con otras administraciones.',
    bad: { A: 'No solo consorcios: también organizaciones personificadas de gestión o empresas públicas.', C: 'No solo empresas públicas: también consorcios y organizaciones de gestión.', D: 'El precepto no se refiere a fundaciones ni a agrupaciones de interés económico, sino a consorcios, organizaciones de gestión o empresas públicas.' } },

  { art: '152', n: '152', co: 2,
    q: 'Según el artículo 152 de la Ley 5/2021 de Aragón, los convenios se extinguirán por las causas y su resolución producirá los efectos previstos en:',
    o: [
      'Exclusivamente en la legislación de patrimonio de la Comunidad Autónoma de Aragón.',
      'Únicamente en el propio convenio y en sus adendas de modificación.',
      'La legislación básica estatal, en el propio convenio o en las leyes.',
      'La normativa autonómica de contratación del sector público.',
    ],
    cita: 'Los convenios se extinguirán por las causas y su resolución producirá los efectos que se prevén en la legislación básica estatal, en el propio convenio o en las leyes.',
    why: 'El artículo 152 remite las causas de extinción y los efectos de la resolución a la legislación básica estatal, al propio convenio o a las leyes.',
    bad: { A: 'No es la legislación de patrimonio, sino la legislación básica estatal, el convenio o las leyes.', B: 'No solo el propio convenio: también la legislación básica estatal y las leyes.', D: 'No es la normativa de contratación, sino la legislación básica estatal, el convenio o las leyes.' } },
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
