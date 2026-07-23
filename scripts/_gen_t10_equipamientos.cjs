// T10 — Preguntas sobre equipamientos municipales del Ayto. de Córdoba (ley virtual aabce5d6).
// Solo HECHOS ESTABLES verificados en fuentes oficiales (cordoba.es, participa.cordoba.es, ssm.cordoba.es).
// Distractores de otras ciudades / otras instalaciones → sin ambigüedad. Preguntas DRAFT.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const LAW_SLUG = 'equipamientos-municipales-ayuntamiento-cordoba';
const TAG = 'piloto_equipamientos_cordoba_t10';
const L = ['A', 'B', 'C', 'D'];

// Contenido corregido del art 4 (servicios sociales) con las 9 zonas oficiales del directorio
const ART4_CONTENT = `Los **Centros de Servicios Sociales Comunitarios** del Ayuntamiento de Córdoba se organizan en **Zonas de Trabajo Social**, que prácticamente coinciden con la delimitación de los distritos municipales.

Existen **9 Zonas de Trabajo Social**: Norte, Levante, Fuensanta, La Ribera, Sur, Poniente Sur, Poniente Norte-La Foggara, Moreras y Periferia (esta última con subsedes en las pedanías: Alcolea, Villarrubia, Santa Cruz, Cerro Muriano, El Higuerón y Trassierra).

Los servicios sociales comunitarios constituyen el primer nivel de atención del Sistema Público de Servicios Sociales y son la puerta de entrada al sistema para la ciudadanía.`;

const Q = [
  // Organización territorial (art 1)
  { art: '1', co: 1,
    q: 'En el Ayuntamiento de Córdoba, ¿qué órgano organiza los centros cívicos de los barrios de su zona?',
    o: ['El Pleno del Ayuntamiento.', 'Las Juntas Municipales de Distrito.', 'La Diputación Provincial de Córdoba.', 'La Junta de Andalucía.'],
    cita: 'Las Juntas Municipales de Distrito... organizan los centros cívicos de los barrios de su zona.',
    why: 'Son las Juntas Municipales de Distrito las que organizan los centros cívicos de su zona.',
    bad: { A: 'El Pleno es el órgano de representación política del municipio, no el que gestiona los centros cívicos de cada zona.', C: 'La Diputación Provincial no gestiona los centros cívicos municipales de la ciudad.', D: 'La Junta de Andalucía es la Administración autonómica, ajena a la organización de estos centros cívicos.' } },
  { art: '1', co: 2,
    q: 'En la organización territorial del municipio de Córdoba, cada distrito está formado por:',
    o: ['Una única pedanía.', 'Todo el término municipal.', 'Uno o varios barrios.', 'Una sola calle principal.'],
    cita: 'Un distrito es una de las zonas en que se divide la ciudad; en cada distrito hay uno o varios barrios.',
    why: 'Cada distrito se compone de uno o varios barrios.',
    bad: { A: 'Un distrito no equivale a una única pedanía.', B: 'El distrito es una zona de la ciudad, no todo el término municipal.', D: 'Un distrito agrupa barrios, no una sola calle.' } },

  // Centros cívicos (arts 2, 3)
  { art: '2', co: 0,
    q: 'Los Centros Cívicos Municipales del Ayuntamiento de Córdoba dependen de:',
    o: ['Las Juntas Municipales de Distrito.', 'La Delegación de Cultura.', 'El Instituto Municipal de Deportes.', 'La Gerencia de Urbanismo.'],
    cita: 'Los Centros Cívicos Municipales son edificios situados en los barrios de la ciudad, dependientes de las Juntas Municipales de Distrito.',
    why: 'Los centros cívicos dependen de las Juntas Municipales de Distrito.',
    bad: { B: 'No dependen de la Delegación de Cultura.', C: 'No dependen del Instituto Municipal de Deportes.', D: 'No dependen de la Gerencia de Urbanismo.' } },
  { art: '2', co: 3,
    q: '¿Cuál de los siguientes servicios municipales se presta de forma territorializada en los Centros Cívicos de Córdoba?',
    o: ['La recaudación de impuestos estatales.', 'La expedición del DNI.', 'La gestión del padrón de la Seguridad Social.', 'La Oficina de Atención al Ciudadano.'],
    cita: 'En los centros cívicos se prestan servicios municipales territorializados como: Participación Ciudadana, Servicios Sociales, Biblioteca, Igualdad y la Oficina de Atención al Ciudadano.',
    why: 'La Oficina de Atención al Ciudadano es uno de los servicios territorializados que se prestan en los centros cívicos.',
    bad: { A: 'La recaudación de impuestos estatales corresponde a la Agencia Tributaria, no a los centros cívicos.', B: 'La expedición del DNI es competencia de la Policía Nacional.', C: 'El padrón de la Seguridad Social no se gestiona en los centros cívicos.' } },
  { art: '3', co: 1,
    q: '¿En qué plaza se encuentra el Centro Cívico Municipal Centro del Ayuntamiento de Córdoba?',
    o: ['En la Plaza de las Tendillas.', 'En la Plaza de la Corredera.', 'En la Plaza del Potro.', 'En la Plaza de Colón.'],
    cita: 'El Centro Cívico Municipal Centro está en la plaza de la Corredera.',
    why: 'El Centro Cívico Municipal Centro se ubica en la plaza de la Corredera.',
    bad: { A: 'La Plaza de las Tendillas no es la ubicación de este centro cívico.', C: 'La Plaza del Potro alberga el Museo Julio Romero de Torres, no este centro cívico.', D: 'La Plaza de Colón no es la sede del Centro Cívico Centro.' } },
  { art: '3', co: 2,
    q: 'El Centro Cívico Municipal Levante del Ayuntamiento de Córdoba está situado en:',
    o: ['La Ronda del Marrubial.', 'La Avenida Cruz de Juárez.', 'La Plaza Mahatma Gandhi.', 'El Camino Viejo de Almodóvar.'],
    cita: 'El Centro Cívico Municipal Levante está en la Plaza Mahatma Gandhi.',
    why: 'El Centro Cívico Municipal Levante se ubica en la Plaza Mahatma Gandhi.',
    bad: { A: 'En la Ronda del Marrubial está el Centro Cívico Lepanto.', B: 'En la Avenida Cruz de Juárez está el Centro Cívico Norte.', D: 'En el Camino Viejo de Almodóvar está el Centro Cívico Poniente Sur.' } },
  { art: '3', co: 0,
    q: '¿Cuál de los siguientes Centros Cívicos Municipales de Córdoba se localiza en la barriada de Alcolea?',
    o: ['Chari Navarro.', 'Rafael Villar.', 'Vallehermoso.', 'Fuensanta.'],
    cita: 'El Centro Cívico Municipal Chari Navarro está en la Plaza de la Cerería, en Alcolea.',
    why: 'El Centro Cívico Chari Navarro es el de Alcolea.',
    bad: { B: 'El Centro Cívico Rafael Villar está en El Higuerón.', C: 'El Centro Cívico Vallehermoso está en el pasaje Candelaria Heredia (zona urbana).', D: 'El Centro Cívico Fuensanta está en la calle Arquitecto Sáenz de Santamaría.' } },
  { art: '3', co: 3,
    q: '¿Cuál de los siguientes es un Centro Cívico Municipal del Ayuntamiento de Córdoba?',
    o: ['El Mercado de la Corredera.', 'El Estadio Municipal El Arcángel.', 'El Teatro Góngora.', 'El Centro Cívico Moreras.'],
    cita: 'El Ayuntamiento de Córdoba cuenta, entre otros, con el Centro Cívico Municipal Moreras.',
    why: 'Moreras es uno de los Centros Cívicos Municipales del Ayuntamiento de Córdoba.',
    bad: { A: 'El Mercado de la Corredera es un mercado, no un centro cívico.', B: 'El Estadio El Arcángel es una instalación deportiva.', C: 'El Teatro Góngora es un teatro municipal, no un centro cívico.' } },

  // Servicios sociales (art 4)
  { art: '4', co: 2,
    q: 'Los Centros de Servicios Sociales Comunitarios del Ayuntamiento de Córdoba se organizan en:',
    o: ['Distritos sanitarios.', 'Áreas de gobierno.', 'Zonas de Trabajo Social.', 'Mancomunidades de municipios.'],
    cita: 'Los Centros de Servicios Sociales Comunitarios del Ayuntamiento de Córdoba se organizan en Zonas de Trabajo Social.',
    why: 'Se organizan en Zonas de Trabajo Social, que casi coinciden con los distritos municipales.',
    bad: { A: 'Los distritos sanitarios corresponden a la organización de la sanidad, no de los servicios sociales municipales.', B: 'Las áreas de gobierno son una estructura política municipal distinta.', D: 'Las mancomunidades agrupan municipios; aquí se trata de zonas dentro de la ciudad.' } },
  { art: '4', co: 0,
    q: '¿En cuántas Zonas de Trabajo Social se organizan los Centros de Servicios Sociales Comunitarios del municipio de Córdoba?',
    o: ['9.', '3.', '15.', '21.'],
    cita: 'Existen 9 Zonas de Trabajo Social en el municipio de Córdoba.',
    why: 'El municipio de Córdoba cuenta con 9 Zonas de Trabajo Social.',
    bad: { B: 'No son 3 zonas.', C: 'No son 15 zonas.', D: 'No son 21 zonas.' } },
  { art: '4', co: 1,
    q: 'Los servicios sociales comunitarios del Ayuntamiento de Córdoba constituyen:',
    o: ['El nivel especializado del sistema sanitario.', 'El primer nivel de atención del Sistema Público de Servicios Sociales.', 'Un órgano de gobierno del Ayuntamiento.', 'Un servicio exclusivo de la Diputación Provincial.'],
    cita: 'Los servicios sociales comunitarios constituyen el primer nivel de atención del Sistema Público de Servicios Sociales y son la puerta de entrada al sistema para la ciudadanía.',
    why: 'Constituyen el primer nivel de atención y la puerta de entrada al Sistema Público de Servicios Sociales.',
    bad: { A: 'No son un nivel del sistema sanitario, sino de los servicios sociales.', C: 'No son un órgano de gobierno municipal.', D: 'No son un servicio exclusivo de la Diputación Provincial.' } },

  // Museos (art 5)
  { art: '5', co: 2,
    q: '¿Cuál de los siguientes es un museo municipal dependiente del Ayuntamiento de Córdoba?',
    o: ['El Museo del Prado.', 'El Museo Guggenheim.', 'El Museo Julio Romero de Torres.', 'El Museo del Baile Flamenco.'],
    cita: 'El Ayuntamiento de Córdoba gestiona, entre otros, el Museo Julio Romero de Torres.',
    why: 'El Museo Julio Romero de Torres es uno de los museos municipales del Ayuntamiento de Córdoba.',
    bad: { A: 'El Museo del Prado está en Madrid y es de titularidad estatal.', B: 'El Museo Guggenheim está en Bilbao.', D: 'El Museo del Baile Flamenco está en Sevilla.' } },
  { art: '5', co: 0,
    q: 'El Museo Julio Romero de Torres, dependiente del Ayuntamiento de Córdoba, se ubica en:',
    o: ['La Plaza del Potro.', 'La Plaza de las Tendillas.', 'La Plaza de la Corredera.', 'La Plaza de Colón.'],
    cita: 'Museo Julio Romero de Torres — plaza del Potro, 1.',
    why: 'El Museo Julio Romero de Torres está en la plaza del Potro.',
    bad: { B: 'La Plaza de las Tendillas no alberga este museo.', C: 'En la Plaza de la Corredera está el Centro Cívico Centro.', D: 'La Plaza de Colón no es la ubicación del museo.' } },
  { art: '5', co: 3,
    q: '¿Cuál de estos espacios museísticos municipales de Córdoba conserva los baños del primitivo Alcázar de época califal?',
    o: ['El Museo Taurino.', 'El Museo Julio Romero de Torres.', 'El Alcázar de los Reyes Cristianos.', 'Los Baños del Alcázar Califal.'],
    cita: 'Baños del Alcázar Califal — complejo de baños del primitivo Alcázar de época califal.',
    why: 'Los Baños del Alcázar Califal conservan los baños califales del primitivo Alcázar.',
    bad: { A: 'El Museo Taurino se aloja en la Casa de las Bulas.', B: 'El Museo Julio Romero de Torres se dedica a la obra del pintor.', C: 'El Alcázar de los Reyes Cristianos es la fortaleza-residencia, no los baños califales.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Equipamientos municipales del Ayuntamiento de Córdoba** (fuentes oficiales: cordoba.es, participa.cordoba.es)\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const lawId = (await c.query('SELECT id FROM laws WHERE slug=$1', [LAW_SLUG])).rows[0].id;
    // corregir art 4 con las 9 zonas oficiales
    await c.query('UPDATE articles SET content=$1 WHERE law_id=$2 AND article_number=$3', [ART4_CONTENT, lawId, '4']);
    const arts = await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [lawId]);
    const idByNum = Object.fromEntries(arts.rows.map(a => [String(a.article_number), a.id]));

    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.co]++);
    console.log('Distribución correct_option:', dist.map((n, i) => L[i] + ':' + n).join(' '), '(total ' + Q.length + ')');

    for (const item of Q) {
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
           difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'easy','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.co, buildExplanation(item), idByNum[item.art], ['ia_generada', TAG]]);
    }
    await c.query('COMMIT');
    console.log('✅ ' + Q.length + ' preguntas DRAFT T10 + art 4 actualizado (9 zonas oficiales)');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
