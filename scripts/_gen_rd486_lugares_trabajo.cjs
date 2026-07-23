// Batch T9 (ampliación) — RD 486/1997 lugares de trabajo. 16 preguntas DRAFT sobre artículos
// con hueco (def, obligación, orden/limpieza, instalaciones, higiénicos Anexo V, 1º auxilios,
// información/consulta, aire libre). Cita literal. Manual v2.5.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const LAW_PREFIX = '04fa5f20';
const TAG = 'piloto_rd486_lugares_trabajo_t9';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '2', co: 1,
    q: 'Según el artículo 2 del RD 486/1997, se entiende por «lugares de trabajo»:',
    o: ['Únicamente los locales cerrados y edificados del centro de trabajo.',
        'Las áreas del centro de trabajo, edificadas o no, en las que los trabajadores deban permanecer o a las que puedan acceder en razón de su trabajo.',
        'Exclusivamente los puestos de trabajo con pantallas de visualización.',
        'Solo las zonas de producción, excluidos los servicios higiénicos y comedores.'],
    cita: 'se entenderá por lugares de trabajo las áreas del centro de trabajo, edificadas o no, en las que los trabajadores deban permanecer o a las que puedan acceder en razón de su trabajo.',
    why: 'El artículo 2.1 define los lugares de trabajo como las áreas del centro, edificadas o no, donde el trabajador permanece o accede por su trabajo.',
    bad: { A: 'No se limita a los locales cerrados y edificados: incluye áreas no edificadas.', C: 'No se restringe a los puestos con pantallas de visualización.', D: 'Los servicios higiénicos y comedores SÍ se consideran incluidos.' } },
  { art: '2', co: 2,
    q: 'Conforme al artículo 2 del RD 486/1997, se consideran INCLUIDOS en la definición de lugares de trabajo:',
    o: ['Solo las oficinas y despachos administrativos.',
        'Únicamente las naves de producción industrial.',
        'Los servicios higiénicos y locales de descanso, los locales de primeros auxilios y los comedores.',
        'Exclusivamente los aparcamientos y accesos exteriores.'],
    cita: 'Se consideran incluidos en esta definición los servicios higiénicos y locales de descanso, los locales de primeros auxilios y los comedores.',
    why: 'El artículo 2.1 incluye expresamente los servicios higiénicos, locales de descanso, locales de primeros auxilios y comedores.',
    bad: { A: 'No se limita a oficinas y despachos.', B: 'No se limita a naves de producción.', D: 'No se refiere en exclusiva a aparcamientos y accesos.' } },
  { art: '2', co: 3,
    q: 'Según el artículo 2.2 del RD 486/1997, las instalaciones de servicio o protección anejas a los lugares de trabajo:',
    o: ['Quedan excluidas del ámbito del Real Decreto.',
        'Se rigen únicamente por el Código Técnico de la Edificación.',
        'Solo se consideran lugares de trabajo si superan una determinada superficie.',
        'Se considerarán como parte integrante de los mismos.'],
    cita: 'Las instalaciones de servicio o protección anejas a los lugares de trabajo se considerarán como parte integrante de los mismos.',
    why: 'El artículo 2.2 integra las instalaciones de servicio o protección anejas como parte del lugar de trabajo.',
    bad: { A: 'No quedan excluidas, sino integradas.', B: 'No se rigen únicamente por el CTE.', C: 'No depende de una superficie mínima.' } },
  { art: '3', co: 0,
    q: 'Conforme al artículo 3 del RD 486/1997, el empresario deberá adoptar las medidas necesarias para que la utilización de los lugares de trabajo:',
    o: ['No origine riesgos para la seguridad y salud de los trabajadores o, si ello no fuera posible, para que tales riesgos se reduzcan al mínimo.',
        'Genere el máximo rendimiento productivo con independencia del riesgo.',
        'Se ajuste exclusivamente a las normas de calidad ISO aplicables.',
        'Quede supeditada al criterio de cada trabajador.'],
    cita: 'El empresario deberá adoptar las medidas necesarias para que la utilización de los lugares de trabajo no origine riesgos para la seguridad y salud de los trabajadores o, si ello no fuera posible, para que tales riesgos se reduzcan al mínimo.',
    why: 'El artículo 3 impone evitar los riesgos o, si no es posible, reducirlos al mínimo.',
    bad: { B: 'La finalidad es la seguridad y salud, no el máximo rendimiento a costa del riesgo.', C: 'No se limita a normas ISO de calidad.', D: 'No queda al criterio de cada trabajador, sino a las medidas del empresario.' } },
  { art: '5', co: 3,
    q: 'Según el artículo 5 del RD 486/1997, el orden, la limpieza y el mantenimiento de los lugares de trabajo deberá ajustarse a lo dispuesto en:',
    o: ['El anexo IV.', 'El anexo VI.', 'El anexo I.', 'El anexo II.'],
    cita: 'El orden, la limpieza y el mantenimiento de los lugares de trabajo deberá ajustarse a lo dispuesto en el anexo II.',
    why: 'El artículo 5 remite al anexo II para el orden, la limpieza y el mantenimiento.',
    bad: { A: 'El anexo IV regula la iluminación.', B: 'El anexo VI regula los primeros auxilios.', C: 'El anexo I regula las condiciones constructivas.' } },
  { art: '5', co: 1,
    q: 'El artículo 5 del RD 486/1997 dispone que la señalización de los lugares de trabajo deberá cumplir lo dispuesto en:',
    o: ['El Código Técnico de la Edificación.', 'El Real Decreto 485/1997, de 14 de abril.', 'El anexo III del propio Real Decreto.', 'El Reglamento de los Servicios de Prevención.'],
    cita: 'la señalización de los lugares de trabajo deberá cumplir lo dispuesto en el Real Decreto 485/1997, de 14 de abril.',
    why: 'El artículo 5 remite al RD 485/1997 para la señalización.',
    bad: { A: 'El CTE no es la remisión para la señalización.', C: 'La señalización se remite a un RD específico, no al anexo III.', D: 'El Reglamento de los Servicios de Prevención regula otra materia.' } },
  { art: '6', co: 0,
    q: 'Según el artículo 6 del RD 486/1997, las instalaciones de servicio y protección de los lugares de trabajo deberán cumplir las disposiciones mínimas del Real Decreto, así como:',
    o: ['Las que se deriven de las reglamentaciones específicas de seguridad que resulten de aplicación.',
        'Únicamente las normas UNE de carácter voluntario.',
        'Solo las instrucciones del fabricante de cada instalación.',
        'Exclusivamente las ordenanzas municipales del lugar.'],
    cita: 'deberán cumplir las disposiciones mínimas establecidas en el presente Real Decreto, así como las que se deriven de las reglamentaciones específicas de seguridad que resulten de aplicación.',
    why: 'El artículo 6 añade el cumplimiento de las reglamentaciones específicas de seguridad aplicables.',
    bad: { B: 'No se limita a normas UNE voluntarias.', C: 'No se limita a las instrucciones del fabricante.', D: 'No se limita a las ordenanzas municipales.' } },
  { art: '9', co: 2,
    q: 'Según el RD 486/1997 (Anexo V), los vestuarios de los lugares de trabajo estarán provistos de:',
    o: ['Máquinas expendedoras de bebidas y alimentos.',
        'Sistemas de climatización individual por trabajador.',
        'Asientos y de armarios o taquillas individuales con llave.',
        'Cámaras de videovigilancia en su interior.'],
    cita: 'Los vestuarios estarán provistos de asientos y de armarios o taquillas individuales con llave.',
    why: 'El Anexo V exige que los vestuarios cuenten con asientos y armarios o taquillas individuales con llave.',
    bad: { A: 'No se exigen máquinas expendedoras.', B: 'No se exige climatización individual por trabajador.', D: 'No se exige videovigilancia en el interior de los vestuarios.' } },
  { art: '9', co: 3,
    q: 'Conforme al RD 486/1997, se dispondrá de duchas de agua corriente, caliente y fría, cuando:',
    o: ['Lo solicite cualquier trabajador de forma individual.',
        'El centro de trabajo supere los cincuenta trabajadores.',
        'Existan comedores en el centro de trabajo.',
        'Se realicen habitualmente trabajos sucios, contaminantes o que originen elevada sudoración.'],
    cita: 'Dispondrán además de duchas de agua corriente, caliente y fría, cuando se realicen habitualmente trabajos sucios, contaminantes o que originen elevada sudoración.',
    why: 'El Anexo V vincula las duchas de agua caliente y fría a los trabajos sucios, contaminantes o de elevada sudoración.',
    bad: { A: 'No basta la solicitud individual de un trabajador.', B: 'El criterio no es un número mínimo de trabajadores.', C: 'La existencia de comedores no es el criterio para las duchas.' } },
  { art: '9', co: 1,
    q: 'Según el RD 486/1997, los servicios higiénicos y vestuarios de los lugares de trabajo:',
    o: ['Podrán ser mixtos en todo caso, sin separación.',
        'Estarán separados para hombres y mujeres, o se preverá su utilización por separado.',
        'Solo serán obligatorios en centros de más de cien trabajadores.',
        'Podrán ubicarse fuera del centro de trabajo, en la vía pública.'],
    cita: 'Los servicios higiénicos y vestuarios estarán separados para hombres y mujeres, o se preverá su utilización por separado.',
    why: 'El Anexo V exige separación por sexos o, en su defecto, utilización por separado.',
    bad: { A: 'No pueden ser mixtos sin separación ni previsión de uso por separado.', C: 'No dependen de un umbral de cien trabajadores.', D: 'No se ubican en la vía pública.' } },
  { art: '10', co: 0,
    q: 'El artículo 10 del RD 486/1997 establece que los lugares de trabajo dispondrán del material y locales necesarios para la prestación de primeros auxilios, ajustándose a lo establecido en:',
    o: ['El anexo VI.', 'El anexo II.', 'El anexo IV.', 'El anexo I.'],
    cita: 'dispondrán del material y, en su caso, de los locales necesarios para la prestación de primeros auxilios a los trabajadores accidentados, ajustándose a lo establecido en el anexo VI.',
    why: 'El artículo 10 remite al anexo VI para el material y locales de primeros auxilios.',
    bad: { B: 'El anexo II regula el orden, la limpieza y el mantenimiento.', C: 'El anexo IV regula la iluminación.', D: 'El anexo I regula las condiciones constructivas.' } },
  { art: '11', co: 2,
    q: 'Conforme al artículo 11 del RD 486/1997, el empresario deberá garantizar que los trabajadores reciban una información adecuada sobre:',
    o: ['El régimen retributivo aplicable a su puesto.',
        'La evolución de la producción del centro de trabajo.',
        'Las medidas de prevención y protección que hayan de adoptarse en aplicación de este Real Decreto.',
        'El organigrama completo de la empresa.'],
    cita: 'el empresario deberá garantizar que los trabajadores y los representantes de los trabajadores reciban una información adecuada sobre las medidas de prevención y protección que hayan de adoptarse en aplicación del presente Real Decreto.',
    why: 'El artículo 11 exige informar sobre las medidas de prevención y protección aplicables.',
    bad: { A: 'No se refiere al régimen retributivo.', B: 'No se refiere a la evolución de la producción.', D: 'No se refiere al organigrama de la empresa.' } },
  { art: '12', co: 3,
    q: 'La consulta y participación de los trabajadores sobre las cuestiones del RD 486/1997 se realizará (artículo 12) de acuerdo con lo dispuesto en:',
    o: ['El Estatuto de los Trabajadores.', 'El anexo V del propio Real Decreto.', 'El Reglamento de los Servicios de Prevención.', 'El apartado 2 del artículo 18 de la Ley de Prevención de Riesgos Laborales.'],
    cita: 'La consulta y participación de los trabajadores o sus representantes... se realizarán de acuerdo con lo dispuesto en el apartado 2 del artículo 18 de la Ley de Prevención de Riesgos Laborales.',
    why: 'El artículo 12 remite al artículo 18.2 de la LPRL.',
    bad: { A: 'No remite al Estatuto de los Trabajadores.', B: 'El anexo V regula los servicios higiénicos, no la consulta.', C: 'El Reglamento de los Servicios de Prevención regula otra materia.' } },
  { art: 'DAunica', co: 1,
    q: 'Según la disposición adicional única del RD 486/1997, en los trabajos al aire libre deberán tomarse medidas de protección de las personas trabajadoras frente a:',
    o: ['Los riesgos derivados exclusivamente del ruido ambiental.',
        'Cualquier riesgo relacionado con fenómenos meteorológicos adversos, incluyendo temperaturas extremas.',
        'Los riesgos eléctricos de las instalaciones cercanas.',
        'Los riesgos biológicos por contacto con animales.'],
    cita: 'deberán tomarse medidas adecuadas para la protección de las personas trabajadoras frente a cualquier riesgo relacionado con fenómenos meteorológicos adversos, incluyendo temperaturas extremas.',
    why: 'La disposición adicional única protege frente a los fenómenos meteorológicos adversos, incluidas las temperaturas extremas.',
    bad: { A: 'No se limita al ruido ambiental.', C: 'No se refiere en exclusiva a riesgos eléctricos.', D: 'No se refiere a riesgos biológicos por animales.' } },
  { art: 'DAunica', co: 2,
    q: 'Conforme al RD 486/1997, cuando la Agencia Estatal de Meteorología emita un aviso de fenómenos meteorológicos adversos de nivel naranja o rojo y las medidas preventivas no garanticen la protección de las personas trabajadoras, resultará obligatoria:',
    o: ['La suspensión definitiva del contrato de trabajo.',
        'La sustitución del trabajador por otro de la plantilla.',
        'La adaptación de las condiciones de trabajo, incluida la reducción o modificación de las horas de la jornada.',
        'El traslado permanente del centro de trabajo a otra localidad.'],
    cita: 'resultará obligatoria la adaptación de las condiciones de trabajo, incluida la reducción o modificación de las horas de desarrollo de la jornada prevista.',
    why: 'Con aviso naranja o rojo y medidas insuficientes, es obligatoria la adaptación de las condiciones de trabajo (reducción o modificación de la jornada).',
    bad: { A: 'No implica la suspensión definitiva del contrato.', B: 'No consiste en sustituir al trabajador por otro.', D: 'No supone el traslado permanente del centro a otra localidad.' } },
  { art: 'DAunica', co: 0,
    q: 'La disposición adicional única del RD 486/1997, sobre condiciones ambientales en el trabajo al aire libre, será de aplicación a:',
    o: ['Todos los lugares de trabajo, incluidos los del artículo 1.2.',
        'Únicamente los lugares de trabajo cerrados.',
        'Solo las obras de construcción.',
        'Exclusivamente las explotaciones agrarias.'],
    cita: 'Esta disposición adicional será de aplicación a todos los lugares de trabajo, incluidos los del artículo 1.2.',
    why: 'La disposición adicional única se aplica a todos los lugares de trabajo, incluidos los excluidos con carácter general en el artículo 1.2.',
    bad: { B: 'No se limita a los lugares cerrados.', C: 'No se limita a las obras de construcción.', D: 'No se limita a las explotaciones agrarias.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Art. ${item.art} RD 486/1997, sobre disposiciones mínimas de seguridad y salud en los lugares de trabajo**\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const lawId = (await c.query("SELECT id FROM laws WHERE id::text LIKE $1", [LAW_PREFIX + '%'])).rows[0].id;
    const arts = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [lawId]);
    const idByNum = Object.fromEntries(arts.rows.map(a => [String(a.article_number), a.id]));
    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.co]++);
    console.log('Distribución correct_option:', dist.map((n, i) => L[i] + ':' + n).join(' '), '(total ' + Q.length + ')');
    for (const item of Q) {
      if (!idByNum[item.art]) throw new Error('Falta art ' + item.art);
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
           difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.co, buildExplanation(item), idByNum[item.art], ['ia_generada', TAG]]);
    }
    console.log('✅ Insertadas', Q.length, 'preguntas DRAFT con tag', TAG);
  } catch (e) { console.error('❌ error:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
