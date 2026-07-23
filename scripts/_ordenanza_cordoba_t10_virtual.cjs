// T10 (contenido local) — Ley virtual "Equipamientos y edificios municipales del Ayuntamiento de Córdoba"
// + artículos de contenido factual extraído de fuentes OFICIALES:
//   · Centros Cívicos: participa.cordoba.es (doc. Participación Ciudadana, 15 centros con direcciones)
//   · Museos: cordoba.es/servicios/cultura-ocio-y-naturaleza/museos (4 museos municipales)
//   · Servicios Sociales: ssm.cordoba.es (9 zonas de trabajo social)
// NO se inventa nada: solo se estructura lo publicado por el Ayuntamiento.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SLUG = 'equipamientos-municipales-ayuntamiento-cordoba';

const ARTICLES = [
  { n: '1', title: 'Organización territorial del municipio: distritos y Juntas Municipales de Distrito',
    content: `El Ayuntamiento de Córdoba organiza la ciudad en **distritos**. Un distrito es una de las zonas en que se divide la ciudad; en cada distrito hay uno o varios **barrios**.

Las **Juntas Municipales de Distrito** son grupos de personas que organizan actividades y servicios en un distrito de la ciudad y organizan los **centros cívicos** de los barrios de su zona. Acercan la gestión municipal a los barrios y ayudan a las asociaciones vecinales.` },
  { n: '2', title: 'La Red de Centros Cívicos Municipales: concepto, funciones y servicios',
    content: `Los **Centros Cívicos Municipales** son edificios situados en los barrios de la ciudad, dependientes de las Juntas Municipales de Distrito, donde se realizan actividades y se prestan servicios municipales adaptados a las necesidades de cada barrio.

En los centros cívicos se prestan servicios municipales **territorializados** como: Participación Ciudadana, Servicios Sociales, Biblioteca, Igualdad y la Oficina de Atención al Ciudadano.

Su finalidad es acercar la Administración municipal a la ciudadanía, dinamizar la vida de los barrios, informar y orientar a los vecinos y apoyar al tejido asociativo.` },
  { n: '3', title: 'Relación de Centros Cívicos Municipales del Ayuntamiento de Córdoba',
    content: `El Ayuntamiento de Córdoba cuenta con los siguientes Centros Cívicos Municipales:

- **Fuensanta** — calle Arquitecto Sáenz de Santamaría.
- **Centro** — plaza de la Corredera.
- **Arrabal del Sur** — calle Santo Domingo de Guzmán.
- **Norte** — avenida Cruz de Juárez.
- **Levante** — plaza Mahatma Gandhi.
- **Lepanto** — Ronda del Marrubial.
- **Moreras** — calle Músico Tomás Luis de Victoria.
- **Vallehermoso** — pasaje Candelaria Heredia.
- **Poniente Sur** — calle Camino Viejo de Almodóvar.
- **Chari Navarro** — plaza de la Cerería, en Alcolea.
- **Cerro Muriano** — calle Padre Rogelio Benítez, en Cerro Muriano.
- **Santa Cruz** — plaza de Andalucía, en Santa Cruz.
- **Rafael Villar** — avenida Principal, en El Higuerón.
- **Villarrubia** — plaza de la Aljarilla nº 15, en Villarrubia.
- **Trassierra** — carretera de Trassierra, en Trassierra.

Varios centros cívicos se ubican en las barriadas periféricas y núcleos de población del término municipal (Alcolea, Cerro Muriano, Santa Cruz, El Higuerón, Villarrubia y Trassierra).` },
  { n: '4', title: 'Los Centros de Servicios Sociales Comunitarios',
    content: `Los **Centros de Servicios Sociales Comunitarios** del Ayuntamiento de Córdoba se organizan en **Zonas de Trabajo Social**, que prácticamente coinciden con la delimitación de los distritos municipales.

Existen **9 Zonas de Trabajo Social** en el municipio de Córdoba. Entre ellas se encuentran las zonas **Centro-Ribera**, **Norte**, **Levante**, **Sur**, **Poniente** y **Periferia**, cada una con su centro de servicios sociales de referencia, que atiende a los barrios incluidos en su zona.

Los servicios sociales comunitarios constituyen el primer nivel de atención del Sistema Público de Servicios Sociales y son la puerta de entrada al sistema para la ciudadanía.` },
  { n: '5', title: 'Museos municipales dependientes del Ayuntamiento de Córdoba',
    content: `El Ayuntamiento de Córdoba gestiona los siguientes **museos municipales**:

- **Museo Julio Romero de Torres** — plaza del Potro, 1. Dedicado a la vida y obra del pintor cordobés Julio Romero de Torres.
- **Museo Taurino** — plaza Maimónides, 1. Ubicado en la antigua Casa de las Bulas, del siglo XVI.
- **Alcázar de los Reyes Cristianos** — calle Caballerizas Reales, s/n. Antigua fortaleza que fue residencia de los Reyes Católicos.
- **Baños del Alcázar Califal** — plaza Campo de los Santos Mártires. Complejo de baños del primitivo Alcázar de época califal.` },
];

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const dup = await c.query('SELECT id FROM laws WHERE slug=$1', [SLUG]);
    if (dup.rowCount) throw new Error('Ya existe ley virtual ' + SLUG);

    const law = await c.query(
      `INSERT INTO laws (name, short_name, type, slug, is_virtual, scope, is_active, verification_status, description)
       VALUES ($1,$2,'regulation',$3,true,'local',true,'no_monitoreable',$4) RETURNING id`,
      ['Equipamientos y edificios municipales del Ayuntamiento de Córdoba',
       'Equipamientos municipales Córdoba', SLUG,
       'Contenido local del Ayuntamiento de Córdoba: edificios municipales, Juntas Municipales de Distrito, Red de Centros Cívicos, Centros de Servicios Sociales y museos municipales. Fuentes oficiales: cordoba.es y participa.cordoba.es.']);
    const lawId = law.rows[0].id;
    console.log('✅ ley virtual:', lawId);

    for (const a of ARTICLES) {
      await c.query(
        `INSERT INTO articles (law_id, article_number, title, content, is_active) VALUES ($1,$2,$3,$4,true)`,
        [lawId, a.n, a.title, a.content]);
    }
    console.log('✅ articles de contenido:', ARTICLES.length);

    // escopar en T10
    const t10 = await c.query("SELECT id FROM topics WHERE position_type='ordenanza_ayuntamiento_cordoba' AND topic_number=10");
    await c.query('DELETE FROM topic_scope WHERE topic_id=$1', [t10.rows[0].id]);
    await c.query(
      `INSERT INTO topic_scope (topic_id, law_id, article_numbers, include_full_title, include_full_chapter, weight)
       VALUES ($1,$2,NULL,false,false,1.0)`, [t10.rows[0].id, lawId]);
    console.log('✅ T10 escopado a la ley virtual');

    await c.query('COMMIT');
    console.log('\n🎉 T10 contenido local creado. Falta: generar preguntas + activar disponible.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
