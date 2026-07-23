// Batch T9 — RD 485/1997 señalización de seguridad y salud (arts 1-6). Preguntas DRAFT.
// Correcta = cita literal del artículo. Distractores equilibrados. Posición uniforme. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const LAW_PREFIX = '793b1dab';
const TAG = 'piloto_rd485_senalizacion_t9';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '1', co: 2,
    q: 'Según el artículo 1 del RD 485/1997, este Real Decreto establece las disposiciones mínimas para:',
    o: ['La comercialización de sustancias y mezclas peligrosas en la empresa.',
        'La regulación de la señalización del tráfico por carretera y ferroviario.',
        'La señalización de seguridad y salud en el trabajo.',
        'La protección de los trabajadores frente a agentes químicos peligrosos.'],
    cita: 'El presente Real Decreto establece las disposiciones mínimas para la señalización de seguridad y salud en el trabajo.',
    why: 'El artículo 1.1 fija el objeto: las disposiciones mínimas de señalización de seguridad y salud en el trabajo.',
    bad: { A: 'La comercialización de sustancias peligrosas se rige por su normativa propia, expresamente excluida (art. 1.3).', B: 'La señalización del tráfico está excluida salvo que se efectúe en los lugares de trabajo (art. 1.4).', D: 'Los agentes químicos tienen su propia normativa; el objeto de este RD es la señalización.' } },

  { art: '1', co: 3,
    q: 'Conforme al artículo 1 del RD 485/1997, la señalización utilizada para la regulación del tráfico por carretera, ferroviario, fluvial, marítimo y aéreo:',
    o: ['Queda plenamente sometida a este Real Decreto en todos los casos.',
        'Se rige exclusivamente por los anexos I a VII de este Real Decreto.',
        'Está regulada por la normativa sobre comercialización de productos peligrosos.',
        'No está sujeta a este Real Decreto, salvo que dichos tráficos se efectúen en los lugares de trabajo.'],
    cita: 'El presente Real Decreto no será aplicable a la señalización utilizada para la regulación del tráfico por carretera, ferroviario, fluvial, marítimo y aéreo, salvo que los mencionados tipos de tráfico se efectúen en los lugares de trabajo.',
    why: 'El artículo 1.4 excluye la señalización de tráfico, salvo cuando ese tráfico se efectúe en los lugares de trabajo.',
    bad: { A: 'No queda sometida en todos los casos: la regla es la exclusión, con la salvedad del tráfico en lugares de trabajo.', B: 'Los anexos regulan la señalización laboral, no la del tráfico general.', C: 'La normativa de productos peligrosos es una exclusión distinta (art. 1.3), no la del tráfico.' } },

  { art: '2', co: 0,
    q: 'Según las definiciones del artículo 2 del RD 485/1997, la señal que prohíbe un comportamiento susceptible de provocar un peligro es la señal de:',
    o: ['Prohibición.', 'Advertencia.', 'Obligación.', 'Salvamento o de socorro.'],
    cita: 'Señal de prohibición: una señal que prohíbe un comportamiento susceptible de provocar un peligro.',
    why: 'El artículo 2.b) define así la señal de prohibición.',
    bad: { B: 'La de advertencia avisa de un riesgo o peligro, no prohíbe.', C: 'La de obligación impone un comportamiento determinado.', D: 'La de salvamento indica salidas de socorro, primeros auxilios o dispositivos de salvamento.' } },

  { art: '2', co: 1,
    q: 'De acuerdo con el artículo 2 del RD 485/1997, la señal que advierte de un riesgo o peligro se denomina señal de:',
    o: ['Prohibición.', 'Advertencia.', 'Obligación.', 'Indicativa.'],
    cita: 'Señal de advertencia: una señal que advierte de un riesgo o peligro.',
    why: 'El artículo 2.c) define la señal de advertencia como la que advierte de un riesgo o peligro.',
    bad: { A: 'La de prohibición prohíbe un comportamiento peligroso.', C: 'La de obligación impone un comportamiento.', D: 'La indicativa da informaciones distintas de las de prohibición, advertencia, obligación o salvamento.' } },

  { art: '2', co: 2,
    q: 'Conforme al artículo 2 del RD 485/1997, la señal que obliga a un comportamiento determinado es la señal de:',
    o: ['Advertencia.', 'Prohibición.', 'Obligación.', 'Salvamento o de socorro.'],
    cita: 'Señal de obligación: una señal que obliga a un comportamiento determinado.',
    why: 'El artículo 2.d) define la señal de obligación como la que obliga a un comportamiento determinado.',
    bad: { A: 'La de advertencia avisa de un riesgo o peligro.', B: 'La de prohibición prohíbe un comportamiento peligroso.', D: 'La de salvamento indica salidas de socorro o dispositivos de salvamento.' } },

  { art: '2', co: 3,
    q: 'Según el artículo 2 del RD 485/1997, la señal que proporciona indicaciones relativas a las salidas de socorro, a los primeros auxilios o a los dispositivos de salvamento es la señal de:',
    o: ['Advertencia.', 'Prohibición.', 'Obligación.', 'Salvamento o de socorro.'],
    cita: 'Señal de salvamento o de socorro: una señal que proporciona indicaciones relativas a las salidas de socorro, a los primeros auxilios o a los dispositivos de salvamento.',
    why: 'El artículo 2.e) define la señal de salvamento o socorro por su relación con salidas de socorro, primeros auxilios y dispositivos de salvamento.',
    bad: { A: 'La de advertencia avisa de un riesgo o peligro.', B: 'La de prohibición prohíbe un comportamiento peligroso.', C: 'La de obligación impone un comportamiento determinado.' } },

  { art: '2', co: 1,
    q: "El artículo 2 del RD 485/1997 define el «color de seguridad» como:",
    o: ['Una imagen que describe una situación u obliga a un comportamiento determinado.',
        'Un color al que se atribuye una significación determinada en relación con la seguridad y salud en el trabajo.',
        'La combinación de una forma geométrica, de colores y de un símbolo que proporciona una información.',
        'Un color emitido por un dispositivo de materiales transparentes o translúcidos iluminados desde atrás.'],
    cita: 'Color de seguridad: un color al que se atribuye una significación determinada en relación con la seguridad y salud en el trabajo.',
    why: 'El artículo 2.i) define el color de seguridad como el color con una significación determinada en relación con la seguridad y salud.',
    bad: { A: 'Eso es el símbolo o pictograma (art. 2.j).', C: 'Eso describe la señal en forma de panel (art. 2.g).', D: 'Eso se aproxima a la señal luminosa (art. 2.k), no al color de seguridad.' } },

  { art: '2', co: 3,
    q: 'Según el artículo 2 del RD 485/1997, una señal sonora codificada, emitida y difundida por medio de un dispositivo apropiado, sin intervención de voz humana o sintética, es una señal:',
    o: ['Verbal.', 'Gestual.', 'Luminosa.', 'Acústica.'],
    cita: 'Señal acústica: una señal sonora codificada, emitida y difundida por medio de un dispositivo apropiado, sin intervención de voz humana o sintética.',
    why: 'El artículo 2.l) define la señal acústica como la sonora codificada emitida sin voz humana o sintética.',
    bad: { A: 'La comunicación verbal SÍ utiliza voz humana o sintética.', B: 'La gestual se basa en movimientos de brazos o manos.', C: 'La luminosa se emite mediante materiales transparentes o translúcidos iluminados.' } },

  { art: '2', co: 0,
    q: 'Conforme al artículo 2 del RD 485/1997, un mensaje verbal predeterminado en el que se utiliza voz humana o sintética se denomina:',
    o: ['Comunicación verbal.', 'Señal acústica.', 'Señal gestual.', 'Señal adicional.'],
    cita: 'Comunicación verbal: un mensaje verbal predeterminado, en el que se utiliza voz humana o sintética.',
    why: 'El artículo 2.m) define la comunicación verbal como el mensaje verbal predeterminado con voz humana o sintética.',
    bad: { B: 'La señal acústica es sonora codificada SIN voz humana o sintética.', C: 'La gestual se basa en movimientos de brazos o manos.', D: 'La adicional acompaña a otra señal para dar información complementaria.' } },

  { art: '2', co: 2,
    q: 'El artículo 2 del RD 485/1997 define la «señal gestual» como:',
    o: ['Un mensaje verbal predeterminado en el que se utiliza voz humana o sintética.',
        'Una señal sonora codificada emitida sin intervención de voz humana.',
        'Un movimiento o disposición de los brazos o de las manos, en forma codificada, para guiar a personas que realicen maniobras peligrosas.',
        'Una señal utilizada junto a otra para facilitar informaciones complementarias.'],
    cita: 'Señal gestual: un movimiento o disposición de los brazos o de las manos en forma codificada para guiar a las personas que estén realizando maniobras que constituyan un riesgo o peligro para los trabajadores.',
    why: 'El artículo 2.n) define la señal gestual como el movimiento codificado de brazos o manos para guiar maniobras peligrosas.',
    bad: { A: 'Eso es la comunicación verbal (art. 2.m).', B: 'Eso es la señal acústica (art. 2.l).', D: 'Eso es la señal adicional (art. 2.h).' } },

  { art: '3', co: 3,
    q: 'Según el artículo 3 del RD 485/1997, el empresario deberá adoptar las medidas precisas para que en los lugares de trabajo exista una señalización de seguridad y salud que cumpla lo establecido en:',
    o: ['El Reglamento de los Servicios de Prevención.',
        'El artículo 18 de la Ley de Prevención de Riesgos Laborales.',
        'La normativa sobre comercialización de productos peligrosos.',
        'Los anexos I a VII del presente Real Decreto.'],
    cita: 'el empresario deberá adoptar las medidas precisas para que en los lugares de trabajo exista una señalización de seguridad y salud que cumpla lo establecido en los anexos I a VII del presente Real Decreto.',
    why: 'El artículo 3 remite a los anexos I a VII para el contenido de la señalización que debe existir en los lugares de trabajo.',
    bad: { A: 'El Reglamento de los Servicios de Prevención regula otra materia.', B: 'El artículo 18 de la LPRL regula la información, no el contenido de la señalización.', C: 'Esa normativa es una exclusión (art. 1.3), no la referencia del artículo 3.' } },

  { art: '4', co: 3,
    q: 'Conforme al artículo 4 del RD 485/1997, la señalización de seguridad y salud:',
    o: ['Sustituye a las medidas técnicas y organizativas de protección colectiva cuando estas resulten costosas.',
        'Puede sustituir a la formación e información de los trabajadores si estos ya conocen las señales.',
        'Es siempre la primera medida preventiva que debe adoptar el empresario.',
        'No deberá considerarse una medida sustitutoria de las medidas técnicas y organizativas de protección colectiva, ni de la formación e información de los trabajadores.'],
    cita: 'La señalización no deberá considerarse una medida sustitutoria de las medidas técnicas y organizativas de protección colectiva... Tampoco deberá considerarse una medida sustitutoria de la formación e información de los trabajadores.',
    why: 'El artículo 4.2 establece que la señalización no sustituye ni a la protección colectiva ni a la formación e información.',
    bad: { A: 'Precisamente NO sustituye a la protección colectiva, ni siquiera por su coste.', B: 'Tampoco sustituye a la formación e información, aunque los trabajadores conozcan las señales.', C: 'Se emplea cuando la protección colectiva no ha eliminado o reducido suficientemente el riesgo, no como primera medida.' } },

  { art: '4', co: 0,
    q: 'Según el artículo 4.1 del RD 485/1997, la señalización deberá utilizarse siempre que el análisis de los riesgos ponga de manifiesto la necesidad de, entre otras:',
    o: ['Alertar a los trabajadores cuando se produzca una situación de emergencia que requiera medidas urgentes de protección o evacuación.',
        'Sancionar a los trabajadores que incumplan las medidas preventivas adoptadas.',
        'Sustituir la formación de los trabajadores en materia preventiva.',
        'Regular la comercialización de los equipos de protección individual.'],
    cita: 'Alertar a los trabajadores cuando se produzca una determinada situación de emergencia que requiera medidas urgentes de protección o evacuación.',
    why: 'El artículo 4.1.b) incluye alertar en situaciones de emergencia que requieran protección o evacuación urgentes entre las finalidades de la señalización.',
    bad: { B: 'La señalización no tiene finalidad sancionadora.', C: 'La señalización no sustituye la formación (art. 4.2).', D: 'La comercialización de EPI no es finalidad de la señalización.' } },

  { art: '5', co: 2,
    q: 'Según el artículo 5 del RD 485/1997, la formación que el empresario proporcionará a los trabajadores en materia de señalización deberá incidir fundamentalmente en:',
    o: ['El coste económico de los distintos sistemas de señalización disponibles.',
        'La fabricación y homologación de las señales en forma de panel.',
        'El significado de las señales, especialmente de los mensajes verbales y gestuales, y en los comportamientos que deban adoptarse.',
        'La regulación del tráfico rodado dentro del centro de trabajo.'],
    cita: 'Dicha formación deberá incidir, fundamentalmente, en el significado de las señales, especialmente de los mensajes verbales y gestuales, y en los comportamientos generales o específicos que deban adoptarse en función de dichas señales.',
    why: 'El artículo 5.2 centra la formación en el significado de las señales (sobre todo verbales y gestuales) y en los comportamientos a adoptar.',
    bad: { A: 'El coste no es el objeto de la formación.', B: 'La fabricación/homologación no es el contenido formativo exigido.', D: 'El tráfico rodado queda fuera del objeto de esta formación.' } },

  { art: '6', co: 1,
    q: 'Conforme al artículo 6 del RD 485/1997, la consulta y participación de los trabajadores sobre las cuestiones reguladas en dicho Real Decreto se realizará de conformidad con:',
    o: ['El artículo 4 de este mismo Real Decreto.',
        'El apartado 2 del artículo 18 de la Ley de Prevención de Riesgos Laborales.',
        'El artículo 34 del Estatuto de los Trabajadores.',
        'El Reglamento de los Servicios de Prevención.'],
    cita: 'La consulta y participación de los trabajadores o sus representantes sobre las cuestiones a las que se refiere este Real Decreto se realizarán de conformidad con lo dispuesto en el apartado 2 del artículo 18 de la Ley de Prevención de Riesgos Laborales.',
    why: 'El artículo 6 remite al artículo 18.2 de la LPRL para la consulta y participación de los trabajadores.',
    bad: { A: 'El artículo 4 fija los criterios de empleo de la señalización, no la consulta.', C: 'El artículo 34 del ET no regula esta consulta preventiva.', D: 'El Reglamento de los Servicios de Prevención regula otra materia.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.art} RD 485/1997, sobre disposiciones mínimas en materia de señalización de seguridad y salud en el trabajo**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const law = await c.query("SELECT id FROM laws WHERE id::text LIKE $1", [LAW_PREFIX + '%']);
    const lawId = law.rows[0].id;
    const arts = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [lawId]);
    const idByNum = Object.fromEntries(arts.rows.map(a => [String(a.article_number), a.id]));

    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.co]++);
    console.log('Distribución correct_option:', dist.map((n, i) => L[i] + ':' + n).join(' '), '(total ' + Q.length + ')');

    let n = 0;
    for (const item of Q) {
      const artId = idByNum[item.art];
      if (!artId) throw new Error('Falta art ' + item.art);
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
           difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.co, buildExplanation(item), artId, ['ia_generada', TAG]]);
      n++;
    }
    console.log('✅ Insertadas', n, 'preguntas DRAFT con tag', TAG);
  } catch (e) {
    console.error('❌ error:', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
