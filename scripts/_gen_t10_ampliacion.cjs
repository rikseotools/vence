// Batch T10 (ampliación) — equipamientos municipales Córdoba. 10 preguntas DRAFT NUEVAS de
// hechos ESTABLES (ubicaciones conocidas, pedanías, museos, zonas de servicios sociales).
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const LAW_SLUG = 'equipamientos-municipales-ayuntamiento-cordoba';
const TAG = 'piloto_equipamientos_ampliacion_t10';
const L = ['A', 'B', 'C', 'D'];

const Q = [
  { art: '2', co: 1,
    q: 'Según su definición, los Centros Cívicos Municipales del Ayuntamiento de Córdoba son edificios situados en:',
    o: ['Los polígonos industriales de la ciudad.', 'Los barrios de la ciudad.', 'El casco histórico exclusivamente.', 'Los accesos a las autovías.'],
    cita: 'Los Centros Cívicos Municipales son edificios situados en los barrios de la ciudad.',
    why: 'Los centros cívicos son edificios situados en los barrios de la ciudad.',
    bad: { A: 'No se ubican en polígonos industriales.', C: 'No se limitan al casco histórico.', D: 'No se sitúan en los accesos a las autovías.' } },
  { art: '3', co: 0,
    q: 'El Centro Cívico Municipal Norte del Ayuntamiento de Córdoba se encuentra en:',
    o: ['La Avenida Cruz de Juárez.', 'La Ronda del Marrubial.', 'El Camino Viejo de Almodóvar.', 'La Plaza de la Corredera.'],
    cita: 'El Centro Cívico Municipal Norte está en la Avenida Cruz de Juárez.',
    why: 'El Centro Cívico Norte se ubica en la Avenida Cruz de Juárez.',
    bad: { B: 'En la Ronda del Marrubial está el Centro Cívico Lepanto.', C: 'En el Camino Viejo de Almodóvar está el Centro Cívico Poniente Sur.', D: 'En la Plaza de la Corredera está el Centro Cívico Centro.' } },
  { art: '3', co: 2,
    q: 'El Centro Cívico Municipal Lepanto del Ayuntamiento de Córdoba está situado en:',
    o: ['El Pasaje Candelaria Heredia.', 'La Avenida Cruz de Juárez.', 'La Ronda del Marrubial.', 'La Calle Santo Domingo de Guzmán.'],
    cita: 'El Centro Cívico Municipal Lepanto está en la Ronda del Marrubial.',
    why: 'El Centro Cívico Lepanto se ubica en la Ronda del Marrubial.',
    bad: { A: 'En el Pasaje Candelaria Heredia está el Centro Cívico Vallehermoso.', B: 'En la Avenida Cruz de Juárez está el Centro Cívico Norte.', D: 'En la Calle Santo Domingo de Guzmán está el Centro Cívico Arrabal del Sur.' } },
  { art: '3', co: 3,
    q: '¿En qué núcleo de población o barriada del término municipal de Córdoba se localiza el Centro Cívico Municipal Rafael Villar?',
    o: ['Alcolea.', 'Cerro Muriano.', 'Villarrubia.', 'El Higuerón.'],
    cita: 'El Centro Cívico Municipal Rafael Villar está en la Avenida Principal, en El Higuerón.',
    why: 'El Centro Cívico Rafael Villar es el de El Higuerón.',
    bad: { A: 'En Alcolea está el Centro Cívico Chari Navarro.', B: 'En Cerro Muriano está el Centro Cívico Cerro Muriano.', C: 'En Villarrubia está el Centro Cívico Villarrubia.' } },
  { art: '3', co: 1,
    q: '¿Cuál de los siguientes Centros Cívicos Municipales de Córdoba NO se localiza en una pedanía o núcleo periférico del término municipal?',
    o: ['Chari Navarro (Alcolea).', 'Lepanto.', 'Villarrubia.', 'Cerro Muriano.'],
    cita: 'El Centro Cívico Municipal Lepanto está en la Ronda del Marrubial (zona urbana de la ciudad).',
    why: 'Lepanto está en la ciudad (Ronda del Marrubial); los otros tres se localizan en pedanías o núcleos periféricos (Alcolea, Villarrubia, Cerro Muriano).',
    bad: { A: 'Chari Navarro está en la pedanía de Alcolea.', C: 'Villarrubia está en el núcleo de Villarrubia.', D: 'Cerro Muriano está en el núcleo de Cerro Muriano.' } },
  { art: '3', co: 2,
    q: 'El Centro Cívico Municipal Poniente Sur del Ayuntamiento de Córdoba se encuentra en:',
    o: ['La Ronda del Marrubial.', 'La Plaza Mahatma Gandhi.', 'La Calle Camino Viejo de Almodóvar.', 'La Avenida Cruz de Juárez.'],
    cita: 'El Centro Cívico Municipal Poniente Sur está en la calle Camino Viejo de Almodóvar.',
    why: 'El Centro Cívico Poniente Sur se ubica en el Camino Viejo de Almodóvar.',
    bad: { A: 'En la Ronda del Marrubial está el Centro Cívico Lepanto.', B: 'En la Plaza Mahatma Gandhi está el Centro Cívico Levante.', D: 'En la Avenida Cruz de Juárez está el Centro Cívico Norte.' } },
  { art: '5', co: 0,
    q: 'El Museo Taurino de Córdoba, dependiente del Ayuntamiento, se aloja en la antigua Casa de las Bulas, un edificio del siglo:',
    o: ['XVI.', 'XVIII.', 'XX.', 'XIII.'],
    cita: 'Museo Taurino — plaza Maimónides, 1. Ubicado en la antigua Casa de las Bulas, del siglo XVI.',
    why: 'La Casa de las Bulas, sede del Museo Taurino, es del siglo XVI.',
    bad: { B: 'No es del siglo XVIII.', C: 'No es del siglo XX.', D: 'No es del siglo XIII.' } },
  { art: '5', co: 3,
    q: '¿Cuál de estos espacios museísticos municipales de Córdoba fue una antigua fortaleza que sirvió de residencia a los Reyes Católicos?',
    o: ['El Museo Julio Romero de Torres.', 'El Museo Taurino.', 'Los Baños del Alcázar Califal.', 'El Alcázar de los Reyes Cristianos.'],
    cita: 'Alcázar de los Reyes Cristianos — antigua fortaleza que fue residencia de los Reyes Católicos.',
    why: 'El Alcázar de los Reyes Cristianos fue la fortaleza-residencia de los Reyes Católicos.',
    bad: { A: 'El Museo Julio Romero de Torres se dedica a la obra del pintor.', B: 'El Museo Taurino se aloja en la Casa de las Bulas.', C: 'Los Baños del Alcázar Califal conservan los baños califales.' } },
  { art: '4', co: 1,
    q: '¿Cuál de las siguientes es una de las Zonas de Trabajo Social de los Servicios Sociales Comunitarios del Ayuntamiento de Córdoba?',
    o: ['El Distrito Sanitario Córdoba-Guadalquivir.', 'Poniente Norte-La Foggara.', 'La Mancomunidad de la Vega.', 'El Área Metropolitana Sur.'],
    cita: 'Existen 9 Zonas de Trabajo Social: Norte, Levante, Fuensanta, La Ribera, Sur, Poniente Sur, Poniente Norte-La Foggara, Moreras y Periferia.',
    why: 'Poniente Norte-La Foggara es una de las 9 Zonas de Trabajo Social de Córdoba.',
    bad: { A: 'El distrito sanitario pertenece a la organización de la sanidad, no a los servicios sociales.', C: 'La Mancomunidad de la Vega no es una zona de trabajo social municipal.', D: 'El Área Metropolitana Sur no es una zona de servicios sociales.' } },
  { art: '4', co: 2,
    q: 'Para la ciudadanía, los servicios sociales comunitarios del Ayuntamiento de Córdoba constituyen:',
    o: ['El último recurso, tras agotar la vía judicial.', 'Un servicio de pago según renta.', 'La puerta de entrada al Sistema Público de Servicios Sociales.', 'Una competencia exclusiva del Estado.'],
    cita: 'los servicios sociales comunitarios... son la puerta de entrada al sistema para la ciudadanía.',
    why: 'Son la puerta de entrada al Sistema Público de Servicios Sociales para la ciudadanía.',
    bad: { A: 'No son el último recurso tras la vía judicial.', B: 'No son un servicio de pago según renta.', D: 'No son competencia exclusiva del Estado.' } },
];

function buildExplanation(item) {
  const letter = L[item.co];
  const others = [0, 1, 2, 3].filter(i => i !== item.co);
  const bullets = others.map(i => `- **${L[i]})** ${item.bad[L[i]]}`).join('\n');
  return `> **Equipamientos municipales del Ayuntamiento de Córdoba** (fuentes oficiales: cordoba.es, participa.cordoba.es, ssm.cordoba.es)\n> "${item.cita}"\n\n**Por qué ${letter} es correcta:** ${item.why}\n\n**Por qué las demás son incorrectas:**\n${bullets}`;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const lawId = (await c.query('SELECT id FROM laws WHERE slug=$1', [LAW_SLUG])).rows[0].id;
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
    console.log('✅ Insertadas', Q.length, 'preguntas DRAFT con tag', TAG);
  } catch (e) { console.error('❌ error:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
