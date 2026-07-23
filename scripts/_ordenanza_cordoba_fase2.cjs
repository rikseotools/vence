// FASE 2 — Alta en BD de "Ordenanza del Ayuntamiento de Córdoba" (23 plazas, oposición libre).
// Fuentes oficiales: temario BOP Córdoba núm. 99 (23/05/2025, ANEXO I); convocatoria BOE-A-2026-15802
// (BOE núm. 175, 20/07/2026), bases BOP núm. 218 (13/11/2025). is_active=false hasta verificar todo.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SLUG = 'ordenanza-ayuntamiento-cordoba';
const POS = 'ordenanza_ayuntamiento_cordoba';
const PROGRAMA_URL = 'https://bop.dipucordoba.es/visor-pdf/23-05-2025/BOP-A-2025-1439.pdf';
const SEGUIMIENTO_URL = 'https://www.cordoba.es/sede/tramites/empleo/convocatorias';

// Epígrafes LITERALES del ANEXO I (BOP núm. 99, 23/05/2025)
const TOPICS = [
  { n: 1, b: 1, title: 'La Constitución Española de 1978',
    desc: 'Estructura y principios básicos. Derechos y deberes fundamentales. Organización territorial del Estado.',
    epi: 'La Constitución Española de 1978: Estructura y principios básicos. Derechos y deberes fundamentales. Organización territorial del Estado.' },
  { n: 2, b: 1, title: 'La Administración Local. El Municipio',
    desc: 'Regulación y principios constitucionales. El Municipio: elementos y competencias. Municipios de gran población. Personal al servicio de la Administración Local.',
    epi: 'La Administración Local: Regulación y principios constitucionales. El Municipio: elementos y competencias. Organización de los municipios de gran población. El personal al servicio de la Administración Local.' },
  { n: 3, b: 1, title: 'Igualdad efectiva y violencia de género',
    desc: 'Igualdad efectiva de mujeres y hombres. Políticas públicas. Protección integral contra la violencia de género.',
    epi: 'La Igualdad efectiva de mujeres y hombres. Políticas públicas para la igualdad. Medidas de protección integral contra la violencia de género. Derechos de las mujeres víctimas de violencia de género.' },
  { n: 4, b: 1, title: 'Prevención de riesgos laborales',
    desc: 'Seguridad y salud en el trabajo. Derechos y obligaciones. Delegados de Prevención. Comité de Seguridad y Salud.',
    epi: 'Prevención de riesgos laborales y protección de la seguridad y salud en el trabajo: Derechos y obligaciones del empresario y los trabajadores. Los delegados de Prevención. El Comité de Seguridad y Salud.' },
  { n: 5, b: 2, title: 'Derechos ante las AAPP. Atención al ciudadano',
    desc: 'Derechos de las personas ante las Administraciones. Atención, acogida e información. Comunicación y atención telefónica.',
    epi: 'Derechos de las personas en sus relaciones con las Administraciones Públicas. La atención, acogida e información del ciudadano. Los diferentes tipos de comunicación. Respuestas ante situaciones conflictivas con los usuarios. Recepción y servicio de atención telefónico.' },
  { n: 6, b: 2, title: 'Máquinas de oficina y material',
    desc: 'Máquinas reproductoras, duplicadoras, faxes, encuadernadoras y destructoras. Material de oficina. El papel. Grapado y plastificado.',
    epi: 'Características y manipulación de máquinas reproductoras, duplicadoras, faxes, encuadernadoras, destructoras de documentos y otras máquinas similares. Revisión y reposición de material de oficina. El papel: tipos y formatos. Grapado y plastificado. Corrección de anomalías y defectos que no requieran calificación técnica especial.' },
  { n: 7, b: 2, title: 'Correspondencia, notificaciones y cargas',
    desc: 'Correspondencia y tipos de envíos. Certificados postales y notificaciones. Distribución. Manipulación manual de cargas.',
    epi: 'Correspondencia. Tipos de envíos. Nociones básicas sobre certificados postales y notificaciones. Acuse de recibo. Depósito, entrega, recogida y distribución de correspondencia y objetos. Almacenamiento y traslado de materiales y enseres. Manipulación manual de cargas.' },
  { n: 8, b: 2, title: 'PRL del subalterno. Emergencias y evacuación',
    desc: 'PRL del personal subalterno. Planes de evacuación. Incendios y emergencias. Primeros auxilios. Manual de emergencias del Ayto. de Córdoba.',
    epi: 'La prevención de riesgos laborales en el ejercicio de las funciones del personal subalterno. Planes de evacuación en locales y edificios de pública concurrencia. Medidas preventivas y pautas de actuación ante incendios y emergencias. Instalaciones de protección contra incendios. Primeros Auxilios. Manual para situaciones de emergencia en edificios municipales del Ayuntamiento de Córdoba.' },
  { n: 9, b: 2, title: 'Seguridad y salud en los lugares de trabajo',
    desc: 'Disposiciones mínimas de seguridad y salud en los lugares de trabajo. Señalización.',
    epi: 'Disposiciones mínimas de seguridad y salud en los lugares de trabajo. Señalización de seguridad y salud en el trabajo.' },
  { n: 10, b: 2, title: 'Edificios, centros cívicos y museos del Ayto. de Córdoba',
    desc: 'Edificios municipales, red de Centros Cívicos, Centros de Servicios Sociales y museos dependientes del Ayuntamiento de Córdoba.',
    epi: 'Edificios municipales dependientes del Ayuntamiento de Córdoba: localización; usos y servicios; características básicas. La red de Centros Cívicos Municipales: localización y características principales. Los Centros de Servicios Sociales: localización y características básicas. Museos dependientes del Ayuntamiento de Córdoba: localización y principales peculiaridades.' },
];

// Temas con contenido local pendiente de construir → disponible=false hasta FASE 3/6
const NOT_AVAILABLE_YET = new Set([8, 10]);

const BLOQUES = [
  { n: 1, titulo: 'Temas Generales', icon: '⚖️', sort: 1 },
  { n: 2, titulo: 'Temas Específicos', icon: '🏛️', sort: 2 },
];

const LANDING_ESTADISTICAS = [
  { numero: '23', texto: 'Plazas (oposición libre)', color: 'text-green-600' },
  { numero: '{temasCount}', texto: 'Temas oficiales', color: 'text-blue-600' },
  { numero: 'AP', texto: 'Agrupación Profesional', color: 'text-purple-600' },
  { numero: 'Sin', texto: 'Titulación requerida', color: 'text-orange-600' },
];
const LANDING_FAQS = [
  { pregunta: '¿Cuántas plazas hay?', respuesta: 'Se convocan 23 plazas de Ordenanza por el sistema de oposición en turno libre (BOE-A-2026-15802, 20/07/2026).' },
  { pregunta: '¿Qué titulación se exige?', respuesta: 'Ninguna titulación académica: la plaza pertenece a las Agrupaciones Profesionales (subescala subalterna).' },
  { pregunta: '¿Qué temario entra?', respuesta: 'El programa oficial consta de {temasCount} temas (4 generales y 6 específicos), recogidos en el Anexo I de las bases (BOP Córdoba).' },
  { pregunta: '¿Cómo es el examen?', respuesta: 'Oposición con ejercicios eliminatorios (incluido un test sobre el temario del Anexo I), según las bases publicadas en el BOP de Córdoba.' },
  { pregunta: '¿Hasta cuándo hay plazo de inscripción?', respuesta: 'El plazo de presentación de solicitudes está abierto hasta el 17 de agosto de 2026 (20 días hábiles desde la publicación en el BOE).' },
];
const EXAMEN_CONFIG = {
  tipo: 'oposición',
  notas: 'Ejercicios eliminatorios (incluido un test basado en el temario del Anexo I). Estructura según las bases (BOP Córdoba núm. 99, 23/05/2025, y núm. 218, 13/11/2025).',
};

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // Guardarraíl anti-duplicado
    const dup = await c.query('SELECT 1 FROM oposiciones WHERE slug=$1', [SLUG]);
    if (dup.rowCount) throw new Error('Ya existe oposición con slug ' + SLUG);

    // 2a — oposiciones
    const opo = await c.query(`
      INSERT INTO oposiciones (
        nombre, tipo_acceso, administracion, categoria, slug, short_name,
        grupo, subgrupo, is_active, temas_count, bloques_count, titulo_requerido,
        diario_oficial, diario_referencia, programa_url, seguimiento_url,
        estado_proceso, convocatoria_numero, convocatoria_fecha, convocatoria_dogv,
        plazas_libres, plazas_promocion_interna,
        inscription_start, inscription_deadline, exam_date,
        boe_publication_date, boe_reference, is_convocatoria_activa,
        coverage_level, fetcher_type, headless_required, familia, sistema_selectivo,
        seo_title, seo_description,
        landing_estadisticas, landing_faqs, examen_config
      ) VALUES (
        $1,'libre','Local','AP',$2,$3,
        'AP','AP',false,$4,$5,'Sin requisito de titulación (Agrupación Profesional)',
        'BOP Córdoba','BOE-A-2026-15802 (BOE núm. 175, 20/07/2026); bases BOP Córdoba núm. 218, 13/11/2025',$6,$7,
        'inscripcion_abierta','BOE-A-2026-15802','2026-07-20','BOE núm. 175, 20/07/2026',
        23,0,
        '2026-07-21','2026-08-17',NULL,
        '2026-07-20','BOE-A-2026-15802 (BOE núm. 175, 20/07/2026); bases BOP Córdoba núm. 218, 13/11/2025', true,
        'con_tests','http',false,'administracion_general','oposicion',
        $8,$9,
        $10::jsonb,$11::jsonb,$12::jsonb
      ) RETURNING id`,
      ['Ordenanza del Ayuntamiento de Córdoba', SLUG, 'Ordenanza Córdoba',
       TOPICS.length, BLOQUES.length, PROGRAMA_URL, SEGUIMIENTO_URL,
       'Ordenanza Ayuntamiento de Córdoba 2026 | 23 plazas · Tests y temario',
       'Prepara la oposición de Ordenanza del Ayuntamiento de Córdoba (23 plazas, oposición libre, sin titulación). Temario oficial y tests por tema. Inscripción abierta hasta el 17/08/2026.',
       JSON.stringify(LANDING_ESTADISTICAS), JSON.stringify(LANDING_FAQS), JSON.stringify(EXAMEN_CONFIG)]);
    const oposicionId = opo.rows[0].id;
    console.log('✅ oposiciones:', oposicionId);

    // 2b.2 — oposicion_bloques
    for (const b of BLOQUES) {
      await c.query(
        `INSERT INTO oposicion_bloques (position_type, bloque_number, titulo, icon, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [POS, b.n, b.titulo, b.icon, b.sort]);
    }
    console.log('✅ oposicion_bloques:', BLOQUES.length);

    // 2b — topics
    for (const t of TOPICS) {
      const disponible = !NOT_AVAILABLE_YET.has(t.n);
      await c.query(
        `INSERT INTO topics (position_type, topic_number, title, description, descripcion_corta, epigrafe,
           difficulty, estimated_hours, is_active, bloque_number, disponible)
         VALUES ($1,$2,$3,$4,$5,$6,'medium',8,true,$7,$8)`,
        [POS, t.n, t.title, t.desc, t.title, t.epi, t.b, disponible]);
    }
    console.log('✅ topics:', TOPICS.length, '(no disponibles aún: temas', [...NOT_AVAILABLE_YET].join(','), ')');

    // 2c — convocatorias (SSOT, is_current=true)
    await c.query(`
      INSERT INTO convocatorias (
        oposicion_id, año, is_current, convocatoria_numero, convocatoria_fecha, convocatoria_dogv,
        estado_proceso, plazas_libres, plazas_promocion_interna,
        inscription_start, inscription_deadline, exam_date, exam_date_approximate,
        boe_publication_date, boe_reference, programa_url, sistema_selectivo,
        examen_config, landing_faqs, landing_estadisticas
      ) VALUES (
        $1, 2026, true, 'BOE-A-2026-15802', '2026-07-20', 'BOE núm. 175, 20/07/2026',
        'inscripcion_abierta', 23, 0,
        '2026-07-21', '2026-08-17', NULL, false,
        '2026-07-20', 'BOE-A-2026-15802 (BOE núm. 175, 20/07/2026); bases BOP Córdoba núm. 218, 13/11/2025', $2, 'oposicion',
        $3::jsonb, $4::jsonb, $5::jsonb
      )`,
      [oposicionId, PROGRAMA_URL, JSON.stringify(EXAMEN_CONFIG), JSON.stringify(LANDING_FAQS), JSON.stringify(LANDING_ESTADISTICAS)]);
    console.log('✅ convocatorias (is_current=true)');

    await c.query('COMMIT');
    console.log('\n🎉 FASE 2 completada para', SLUG, '— oposición INACTIVA (is_active=false).');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
