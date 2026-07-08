// Batch b14 — Ley 5/2021 Aragón, arts 145-158 (relaciones interadministrativas:
// principios, convenios, comisiones bilaterales, cooperación). Bloque T6.
// 15 preguntas DRAFT, article_id por número. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW = '0f9c58e5-e9af-4380-b374-7d599ac4fb62';
const TAG = 'piloto_ley_5_2021_aragon_b14';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '147', n: '147.2', co: 1,
    q: 'Según el artículo 147.2 de la Ley 5/2021 de Aragón, los protocolos generales de actuación o instrumentos similares de contenido programático o declarativo no vinculante:',
    o: [
      'Tienen la consideración de convenios y deben inscribirse en el Registro Electrónico de Convenios.',
      'No tienen la consideración de convenios; con carácter previo a su celebración, corresponde al Gobierno de Aragón autorizarlos.',
      'No tienen la consideración de convenios y no precisan autorización ni control previo alguno.',
      'Tienen la consideración de convenios cuando suponen compromisos jurídicos concretos y exigibles.',
    ],
    cita: 'No tienen la consideración de convenios los protocolos generales de actuación o instrumentos similares, cuyo contenido sea de carácter programático o declarativo no vinculante, que no supongan la formalización de compromisos jurídicos concretos y exigibles. Con carácter previo a su celebración, corresponde al Gobierno de Aragón autorizar los protocolos generales de actuación o instrumentos similares.',
    why: 'El artículo 147.2 niega a los protocolos generales la condición de convenios y exige autorización previa del Gobierno de Aragón.',
    bad: { A: 'No tienen la consideración de convenios, precisamente.', C: 'Sí precisan control previo: el Gobierno de Aragón debe autorizarlos.', D: 'Si suponen compromisos jurídicos concretos y exigibles ya no serían protocolos generales, sino convenios.' } },

  { art: '147', n: '147.4', co: 2,
    q: 'Conforme al artículo 147.4 de la Ley 5/2021 de Aragón, los convenios:',
    o: [
      'Podrán tener por objeto prestaciones propias de los contratos, ajustándose a la normativa de contratación.',
      'Podrán tener por objeto prestaciones propias de los contratos menores del sector público.',
      'No podrán tener por objeto prestaciones propias de los contratos.',
      'No podrán tener por objeto el otorgamiento de subvenciones públicas en ningún caso.',
    ],
    cita: 'Los convenios no podrán tener por objeto prestaciones propias de los contratos. En tal caso, su naturaleza y régimen jurídico se ajustará a lo previsto en normativa relativa a la contratación del sector público que resulte de aplicación.',
    why: 'El artículo 147.4 prohíbe que los convenios tengan por objeto prestaciones propias de los contratos.',
    bad: { A: 'Es justo lo contrario: no podrán tener por objeto prestaciones propias de los contratos.', B: 'Tampoco las de los contratos menores: ninguna prestación propia de los contratos.', D: 'El convenio sí puede instrumentar subvenciones (art. 147.5); lo excluido son las prestaciones contractuales.' } },

  { art: '149', n: '149.1.i)', co: 0,
    q: 'Según el artículo 149.1.i) de la Ley 5/2021 de Aragón, el plazo de vigencia de los convenios:',
    o: [
      'Deberá ser determinado y no superior a cuatro años, salvo que una norma disponga un plazo mayor, prorrogable hasta cuatro años adicionales.',
      'Deberá ser determinado y no superior a seis años, salvo que una norma disponga un plazo mayor, prorrogable hasta seis años adicionales.',
      'Será indefinido, salvo que el propio convenio establezca expresamente un plazo determinado de vigencia.',
      'Deberá ser determinado y no superior a cuatro años, sin posibilidad de prórroga en ningún caso.',
    ],
    cita: 'El plazo de vigencia del convenio [...] deberá ser determinado y no superior a cuatro años, salvo que una norma disponga un plazo mayor. [...] los firmantes podrán acordar unánimemente su prórroga por un periodo de hasta cuatro años adicionales.',
    why: 'La letra i) del artículo 149.1 fija un plazo determinado máximo de cuatro años (salvo norma con plazo mayor), prorrogable hasta cuatro años más.',
    bad: { B: 'El plazo máximo y la prórroga son de cuatro años, no de seis.', C: 'El plazo debe ser determinado y no superior a cuatro años, no indefinido.', D: 'Sí cabe prórroga: hasta cuatro años adicionales si el convenio lo prevé.' } },

  { art: '150', n: '150.1', co: 3,
    q: 'De acuerdo con el artículo 150.1 de la Ley 5/2021 de Aragón, con carácter previo a su celebración, corresponde autorizar los convenios de la Administración autonómica y sus organismos públicos a:',
    o: [
      'La persona titular del departamento promotor del convenio.',
      'La dirección general competente en materia de presupuestos.',
      'Las Cortes de Aragón mediante acuerdo de su pleno.',
      'El Gobierno de Aragón.',
    ],
    cita: 'Con carácter previo a su celebración corresponde al Gobierno de Aragón autorizar los convenios de la Administración de la Comunidad Autónoma de Aragón y sus organismos públicos dependientes o adscritos.',
    why: 'El artículo 150.1 atribuye al Gobierno de Aragón la autorización previa de los convenios.',
    bad: { A: 'No autoriza el titular del departamento promotor, sino el Gobierno de Aragón.', B: 'No es la dirección general de presupuestos: la autorización previa es del Gobierno.', C: 'No corresponde a las Cortes, sino al Gobierno de Aragón.' } },

  { art: '150', n: '150.5', co: 0,
    q: 'Según el artículo 150.5 de la Ley 5/2021 de Aragón, los convenios que adopten la Administración autonómica y sus organismos públicos con sujetos de derecho público y privado:',
    o: [
      'No implicarán la cesión de la titularidad de sus competencias.',
      'Implicarán la cesión de la titularidad de las competencias cuando así se prevea en el convenio.',
      'Implicarán la cesión del ejercicio de sus competencias, pero no de su titularidad.',
      'No implicarán la cesión del ejercicio de sus competencias, salvo autorización del Gobierno.',
    ],
    cita: 'Los convenios que adopten la Administración de la Comunidad Autónoma y sus organismos públicos con sujetos de derecho público y privado no implicarán la cesión de la titularidad de sus competencias.',
    why: 'El artículo 150.5 aclara que los convenios no transfieren la titularidad de las competencias.',
    bad: { B: 'No hay cesión de la titularidad de las competencias, ni aunque lo prevea el convenio.', C: 'El precepto excluye la cesión de la titularidad, sin afirmar la cesión del ejercicio.', D: 'Lo que el artículo excluye es la cesión de la titularidad de las competencias.' } },

  { art: '151', n: '151.4', co: 1,
    q: 'Conforme al artículo 151.4 de la Ley 5/2021 de Aragón, los convenios se perfeccionan y son eficaces:',
    o: [
      'Con su inscripción en el Registro Electrónico de Convenios de la Comunidad Autónoma de Aragón.',
      'Con la prestación del consentimiento de las partes mediante la firma del convenio.',
      'Con su publicación en el «Boletín Oficial de Aragón» tras la firma de las partes.',
      'Con la autorización previa del Gobierno de Aragón otorgada con carácter previo a la firma.',
    ],
    cita: 'Los convenios [...] se perfeccionan y son eficaces con la prestación del consentimiento de las partes mediante la firma de dicho convenio.',
    why: 'El artículo 151.4 vincula el perfeccionamiento y la eficacia del convenio a la firma (prestación del consentimiento).',
    bad: { A: 'La inscripción en el Registro es a efectos de publicidad, no de perfeccionamiento.', C: 'La publicación en el «Boletín Oficial de Aragón» no determina el perfeccionamiento; este es la firma.', D: 'La autorización previa es un trámite anterior; el convenio se perfecciona con la firma.' } },

  { art: '151', n: '151.4', co: 2,
    q: 'Según el artículo 151.4 de la Ley 5/2021 de Aragón, la suscripción, extinción, prórroga o modificación de los convenios se inscribirá en el Registro Electrónico de Convenios, a efectos de su publicidad, en el plazo de:',
    o: [
      'Tres meses a partir de la firma.',
      'Quince días a partir de la firma.',
      'Un mes a partir de la firma.',
      'Dos meses a partir de la autorización del Gobierno.',
    ],
    cita: 'La suscripción, extinción, prórroga o modificación de los convenios se inscribirá, a efectos de su publicidad, en el Registro Electrónico de Convenios de la Comunidad Autónoma de Aragón en el plazo de un mes a partir de la firma.',
    why: 'El artículo 151.4 fija en un mes a partir de la firma el plazo de inscripción en el Registro de Convenios.',
    bad: { A: 'El plazo de inscripción es de un mes, no de tres meses.', B: 'El plazo de inscripción es de un mes, no de quince días.', D: 'El plazo es de un mes a partir de la firma, no de dos meses desde la autorización.' } },

  { art: '151', n: '151.7', co: 3,
    q: 'De acuerdo con el artículo 151.7 de la Ley 5/2021 de Aragón, los convenios que impliquen compromisos económicos superiores a trescientos mil euros se remitirán a la Cámara de Cuentas de Aragón dentro de:',
    o: [
      'El mes siguiente a su suscripción.',
      'Los seis meses siguientes a su suscripción.',
      'Los tres meses siguientes a la autorización del Gobierno.',
      'Los tres meses siguientes a su suscripción.',
    ],
    cita: 'Los convenios que impliquen compromisos económicos superiores a trescientos mil euros [...] se deberán remitir electrónicamente por el titular del centro directivo promotor a la Cámara de Cuentas de Aragón dentro de los tres meses siguientes a su suscripción.',
    why: 'El artículo 151.7 fija en tres meses desde la suscripción el plazo de remisión a la Cámara de Cuentas para convenios superiores a trescientos mil euros.',
    bad: { A: 'El plazo es de tres meses, no de un mes.', B: 'El plazo es de tres meses, no de seis.', C: 'El cómputo es desde la suscripción del convenio, no desde la autorización del Gobierno.' } },

  { art: '153', n: '153.1', co: 0,
    q: 'Según el artículo 153.1 de la Ley 5/2021 de Aragón, la Comisión Bilateral de Cooperación Aragón-Estado es:',
    o: [
      'El instrumento principal y permanente de relación entre la comunidad autónoma y el Estado para instrumentar la colaboración mutua en el ejercicio de las respectivas competencias.',
      'Un órgano consultivo de carácter temporal creado para cada transferencia de funciones y servicios del Estado a Aragón.',
      'El órgano bilateral de relación entre el Estado y Aragón en materia de financiación autonómica específica aragonesa.',
      'El órgano paritario encargado de aprobar las transferencias de funciones y servicios del Estado a Aragón.',
    ],
    cita: 'La Comisión Bilateral de Cooperación Aragón-Estado es el instrumento principal y permanente de relación entre la comunidad autónoma y el Estado para instrumentar la colaboración mutua en el ejercicio de las respectivas competencias.',
    why: 'El artículo 153.1 define la Comisión Bilateral como el instrumento principal y permanente de relación Aragón-Estado.',
    bad: { B: 'No es un órgano temporal de transferencias, sino el instrumento principal y permanente de relación.', C: 'La financiación autonómica corresponde a la Comisión Mixta de Asuntos Económico-Financieros (art. 154).', D: 'Las transferencias corresponden a la Comisión Mixta de Transferencias (art. 155).' } },

  { art: '153', n: '153.3', co: 1,
    q: 'Conforme al artículo 153.3 de la Ley 5/2021 de Aragón, la Comisión Bilateral de Cooperación Aragón-Estado se reunirá en sesión plenaria:',
    o: [
      'Al menos dos veces al año, con presidencia permanente del Estado.',
      'Al menos una vez al año, con presidencia alternativa por periodos de un año natural.',
      'Cuando lo solicite cualquiera de las partes, con presidencia permanente de Aragón.',
      'Al menos una vez al trimestre, con presidencia alternativa por periodos de dos años.',
    ],
    cita: 'La Comisión Bilateral se reunirá, al menos, una vez al año en sesión plenaria. La presidencia será alternativa por periodos temporales de un año natural correspondiendo los pares al Estado y los impares a Aragón.',
    why: 'El artículo 153.3 fija al menos una reunión plenaria anual y presidencia alternativa por años naturales.',
    bad: { A: 'Es al menos una vez al año, y la presidencia es alternativa, no permanente del Estado.', C: 'Se reúne al menos una vez al año (no solo a petición), con presidencia alternativa.', D: 'La reunión es al menos anual y la alternancia de presidencia es por un año natural, no por dos.' } },

  { art: '154', n: '154.1', co: 2,
    q: 'Según el artículo 154.1 de la Ley 5/2021 de Aragón, la Comisión Mixta de Asuntos Económico-Financieros es el órgano bilateral de relación entre el Estado y Aragón en materia de:',
    o: [
      'Transferencia de funciones y servicios del Estado a Aragón.',
      'Coordinación de las conferencias sectoriales del Estado.',
      'Financiación autonómica específica aragonesa.',
      'Cooperación general en el ejercicio de las respectivas competencias.',
    ],
    cita: 'La Comisión Mixta de Asuntos Económico-Financieros es el órgano bilateral de relación entre las administraciones del Estado y de Aragón en las materias sobre financiación autonómica específicas aragonesas.',
    why: 'El artículo 154.1 vincula la Comisión Mixta de Asuntos Económico-Financieros a la financiación autonómica específica aragonesa.',
    bad: { A: 'Las transferencias corresponden a la Comisión Mixta de Transferencias (art. 155).', B: 'No se ocupa de coordinar conferencias sectoriales, sino de la financiación autonómica.', D: 'La cooperación general corresponde a la Comisión Bilateral de Cooperación (art. 153).' } },

  { art: '155', n: '155', co: 3,
    q: 'De acuerdo con el artículo 155 de la Ley 5/2021 de Aragón, la Comisión Mixta de Transferencias, que se reúne cuando se pretenda la transferencia de funciones y servicios:',
    o: [
      'Estará presidida de forma permanente por el Estado y aprobará sus normas por mayoría.',
      'Estará integrada mayoritariamente por representantes del Estado y se regirá por la legislación básica.',
      'Estará integrada de forma paritaria y se regirá por el reglamento que apruebe el Gobierno de Aragón.',
      'Estará integrada de forma paritaria y aprobará sus propias normas de funcionamiento.',
    ],
    cita: 'Esta Comisión Mixta estará integrada de forma paritaria y aprobará sus propias normas de funcionamiento de acuerdo con el Estatuto de Autonomía de Aragón.',
    why: 'El artículo 155 establece la composición paritaria de la Comisión Mixta de Transferencias y su autonomía para aprobar sus normas de funcionamiento.',
    bad: { A: 'La composición es paritaria, no de presidencia permanente del Estado.', B: 'No es de mayoría estatal: es paritaria.', C: 'Aprueba sus propias normas de funcionamiento; no las aprueba el Gobierno de Aragón.' } },

  { art: '157', n: '157.2', co: 0,
    q: 'Según el artículo 157.2 de la Ley 5/2021 de Aragón, en las conferencias sectoriales Aragón estará representada por:',
    o: [
      'El miembro del Gobierno que sea competente por razón de la materia.',
      'La persona titular de la secretaría general técnica designada por el departamento competente.',
      'La persona titular de la Presidencia del Gobierno de Aragón en todo caso.',
      'El jefe de servicio designado por la dirección general competente por razón de la materia.',
    ],
    cita: 'En las conferencias sectoriales Aragón estará representada por el miembro del Gobierno que sea competente por razón de la materia.',
    why: 'El artículo 157.2 atribuye la representación en las conferencias sectoriales al miembro del Gobierno competente por la materia.',
    bad: { B: 'La secretaría general técnica representa a Aragón en las comisiones sectoriales, no en las conferencias.', C: 'No es la Presidencia en todo caso, sino el miembro del Gobierno competente por la materia.', D: 'Los jefes de servicio participan en los grupos de trabajo, no representan en la conferencia sectorial.' } },

  { art: '145', n: '145.1', co: 1,
    q: 'Conforme al artículo 145.1 de la Ley 5/2021 de Aragón, la Administración autonómica se relaciona con las demás administraciones públicas de acuerdo, entre otros, con los principios de:',
    o: [
      'Jerarquía, desconcentración, descentralización y autotutela administrativa.',
      'Lealtad institucional, colaboración, cooperación, coordinación y solidaridad interterritorial.',
      'Subordinación, tutela financiera y control de oportunidad de la actuación local.',
      'Supremacía autonómica, exclusividad competencial y reserva de ley orgánica.',
    ],
    cita: 'La Administración de la Comunidad Autónoma de Aragón se relaciona con las demás administraciones públicas de acuerdo a los principios de lealtad institucional, competencia, colaboración, cooperación, coordinación, eficiencia, responsabilidad, igualdad [...], solidaridad interterritorial, así como a todos aquellos principios recogidos en la Constitución, el Estatuto de Autonomía de Aragón y legislación básica aplicable.',
    why: 'El artículo 145.1 enumera principios como lealtad institucional, colaboración, cooperación, coordinación y solidaridad interterritorial.',
    bad: { A: 'Jerarquía y desconcentración son principios de organización interna, no de relación interadministrativa del art. 145.1.', C: 'El artículo no se basa en la subordinación ni en el control de oportunidad de lo local.', D: 'No menciona supremacía autonómica ni exclusividad competencial: la relación es de lealtad y cooperación.' } },

  { art: '158', n: '158.2', co: 2,
    q: 'Según el artículo 158.2 de la Ley 5/2021 de Aragón, las aplicaciones de la Administración de la Comunidad Autónoma de Aragón:',
    o: [
      'Estarán a disposición exclusivamente de los organismos públicos de la propia Comunidad Autónoma de Aragón.',
      'Solo podrán cederse a otra administración mediante convenio y previo pago del coste de su desarrollo.',
      'Estarán a disposición de cualquier administración que lo solicite y serán declaradas, con carácter general, como de fuentes abiertas.',
      'Serán declaradas, con carácter general, de uso reservado por motivos de seguridad de la información.',
    ],
    cita: 'Las aplicaciones de la Administración de la Comunidad Autónoma de Aragón estarán a disposición de cualquier administración que lo solicite y serán declaradas, con carácter general, como de fuentes abiertas.',
    why: 'El artículo 158.2 pone las aplicaciones a disposición de cualquier administración solicitante y las declara, con carácter general, de fuentes abiertas.',
    bad: { A: 'No es uso exclusivo autonómico: están a disposición de cualquier administración solicitante.', B: 'No se exige convenio ni pago: se ponen a disposición y son de fuentes abiertas.', D: 'Con carácter general son de fuentes abiertas, no de uso reservado.' } },
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
