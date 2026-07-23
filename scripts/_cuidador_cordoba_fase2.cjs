// FASE 2 — Catálogo Cuidador/a Diputación Provincial de Córdoba (BOP-A-2026-2548, 23/07/2026).
// Idempotente: borra y reinserta oposición/bloques/topics/convocatoria por slug/position_type.
// RDS (postgres). NO activa is_active (queda false hasta verificar). Topics disponible=false.
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const SLUG = 'cuidador-diputacion-cordoba';
const PT = 'cuidador_diputacion_cordoba';
const T = JSON.parse(fs.readFileSync('data/temarios/cuidador-diputacion-cordoba.json', 'utf8'));

const examen_config = {
  tipo: 'test + supuesto práctico',
  penalizacion: '1/4 del valor de una respuesta correcta',
  duracion_total_minutos: 130,
  total_preguntas: 80,
  partes: [
    { nombre: 'Parte primera (teórica)', preguntas: 40, reserva: 5, detalle: '10 preguntas del Bloque I (materias comunes) + 30 del Bloque II (materias específicas)' },
    { nombre: 'Parte segunda (supuestos prácticos)', preguntas: 40, reserva: 5, detalle: 'Cuestionario tipo test sobre uno o varios supuestos prácticos del Bloque II, relacionados con las funciones de la plaza' }
  ],
  notas: 'Ejercicio único con dos partes en la misma sesión. Cada respuesta incorrecta resta 1/4. Fuente: bases BOP Córdoba nº 141, 23/07/2026.'
};

const landing_estadisticas = [
  { numero: '4', texto: 'Plazas (OEP 2023-2025)', color: 'text-green-600' },
  { numero: '{temasCount}', texto: 'Temas oficiales', color: 'text-blue-600' },
  { numero: '80', texto: 'Preguntas en el examen', color: 'text-purple-600' },
  { numero: 'ESO', texto: 'Titulación mínima', color: 'text-orange-600' }
];

const landing_faqs = [
  { pregunta: '¿Cuántas plazas hay?', respuesta: 'La convocatoria oferta 4 plazas de Cuidador/a (personal laboral) de la Diputación Provincial de Córdoba, incluidas en las OEP 2023 y 2025. Una de ellas está reservada a personas con discapacidad general.' },
  { pregunta: '¿Qué titulación necesito?', respuesta: 'Graduado en ESO más el Certificado de profesionalidad de Atención Sociosanitaria a personas dependientes en Instituciones Sociales; o el título de Técnico en Cuidados Auxiliares de Enfermería (o equivalente); o Técnico en Atención a Personas en Situación de Dependencia. Además se exige el certificado de manipulador/a de alimentos.' },
  { pregunta: '¿Cómo es el examen?', respuesta: 'La fase de oposición es un ejercicio único de 130 minutos con dos partes: una primera parte de 40 preguntas tipo test (10 del Bloque I y 30 del Bloque II) y una segunda parte de 40 preguntas tipo test sobre supuestos prácticos del Bloque II. Cada respuesta incorrecta resta 1/4 del valor de un acierto.' },
  { pregunta: '¿Cuántos temas tiene el programa?', respuesta: 'El programa oficial tiene {temasCount} temas: 4 de materias comunes (Bloque I) y 16 de materias específicas de atención sociosanitaria y a la dependencia (Bloque II).' },
  { pregunta: '¿Hasta cuándo puedo inscribirme?', respuesta: 'El plazo de presentación de solicitudes es de 20 días hábiles a contar desde el día siguiente a la publicación de las bases en el BOP (publicadas el 23/07/2026).' }
];

(async () => {
  await sql.begin(async (sql) => {
    // limpiar previo
    await sql`DELETE FROM convocatorias WHERE oposicion_id IN (SELECT id FROM oposiciones WHERE slug=${SLUG})`;
    await sql`DELETE FROM topics WHERE position_type=${PT}`;
    await sql`DELETE FROM oposicion_bloques WHERE position_type=${PT}`;
    await sql`DELETE FROM oposiciones WHERE slug=${SLUG}`;

    // 1) oposición
    const op = await sql`INSERT INTO oposiciones (
        nombre, tipo_acceso, administracion, categoria, slug, short_name, grupo, subgrupo,
        is_active, is_convocatoria_activa, temas_count, bloques_count, titulo_requerido,
        diario_oficial, diario_referencia, programa_url, seguimiento_url,
        estado_proceso, oep_decreto, oep_fecha,
        convocatoria_fecha, convocatoria_dogv,
        plazas_libres, plazas_promocion_interna, plazas_discapacidad,
        inscription_start, exam_date, exam_date_approximate,
        boe_publication_date, boe_reference,
        examen_config, landing_faqs, landing_estadisticas, landing_description,
        seo_title, seo_description, requisitos_especiales,
        sistema_selectivo, position_group, familia
      ) VALUES (
        ${T.nombre}, 'libre', 'Local', 'C2', ${SLUG}, ${T.short_name}, 'C', 'C2',
        false, true, ${T.temas.length}, 2, ${T.titulo_requerido},
        'BOP Córdoba', 'BOP-A-2026-2548',
        'https://bop.dipucordoba.es/visor-pdf/23-07-2026/BOP-A-2026-2548.pdf',
        'https://empleo.dipucordoba.es/',
        'inscripcion_abierta', 'OEP 2023 y OEP 2025', '2025-01-01',
        '2026-07-23', 'BOP Córdoba nº 141, 23/07/2026',
        3, 0, 1,
        '2026-07-24', NULL, true,
        '2026-07-23', 'Acuerdo Junta de Gobierno de 14/07/2026 (BOP Córdoba nº 141, 23/07/2026, BOP-A-2026-2548)',
        ${sql.json(examen_config)}, ${sql.json(landing_faqs)}, ${sql.json(landing_estadisticas)},
        'Oposición a 4 plazas de Cuidador/a (personal laboral, grupo C2) de la Diputación Provincial de Córdoba, turno libre por concurso-oposición. Incluidas en las OEP 2023 y 2025. Inscripción abierta.',
        'Cuidador/a Diputación de Córdoba 2026 | 4 Plazas | Tests Vence',
        'Prepara las 4 plazas de Cuidador/a de la Diputación de Córdoba (OEP 2023-2025). Inscripción abierta desde el 24/07/2026. Tests del temario oficial de atención sociosanitaria y a la dependencia.',
        ${sql.json([{ tipo: 'sociosanitario', descripcion: 'Requiere certificado de manipulador/a de alimentos y titulación sociosanitaria (TCAE, Atención a la Dependencia o certificado de profesionalidad)' }])},
        'concurso-oposicion', 'C2', 'social'
      ) RETURNING id`;
    const oid = op[0].id;
    console.log('oposición id:', oid);

    // 2) bloques
    for (const b of T.bloques) {
      await sql`INSERT INTO oposicion_bloques (position_type, bloque_number, titulo, icon, sort_order)
                VALUES (${PT}, ${b.bloque_number}, ${b.titulo}, ${b.icon}, ${b.bloque_number})`;
    }
    console.log('bloques insertados:', T.bloques.length);

    // 3) topics (display_number = número oficial dentro del bloque)
    let dispBI = 0, dispBII = 0;
    for (const tm of T.temas) {
      const display = tm.bloque === 1 ? (++dispBI) : (++dispBII);
      await sql`INSERT INTO topics (position_type, topic_number, display_number, bloque_number, title, descripcion_corta, epigrafe, difficulty, estimated_hours, is_active, disponible)
                VALUES (${PT}, ${tm.n}, ${display}, ${tm.bloque}, ${tm.titulo}, ${tm.titulo}, ${tm.epigrafe}, 'medium', 10, true, false)`;
    }
    console.log('topics insertados:', T.temas.length);

    // 4) convocatoria vigente (SSOT)
    await sql`INSERT INTO convocatorias (
        oposicion_id, año, is_current, convocatoria_fecha, convocatoria_dogv,
        estado_proceso, oep_decreto, oep_fecha,
        plazas_libres, plazas_promocion_interna, plazas_discapacidad,
        inscription_start, exam_date, exam_date_approximate,
        boe_publication_date, boe_reference, programa_url,
        examen_config, landing_faqs, landing_estadisticas, landing_description, requisitos_especiales,
        sistema_selectivo
      ) VALUES (
        ${oid}, 2026, true, '2026-07-23', 'BOP Córdoba nº 141, 23/07/2026',
        'inscripcion_abierta', 'OEP 2023 y OEP 2025', '2025-01-01',
        3, 0, 1,
        '2026-07-24', NULL, true,
        '2026-07-23', 'Acuerdo Junta de Gobierno de 14/07/2026 (BOP Córdoba nº 141, 23/07/2026, BOP-A-2026-2548)',
        'https://bop.dipucordoba.es/visor-pdf/23-07-2026/BOP-A-2026-2548.pdf',
        ${sql.json(examen_config)}, ${sql.json(landing_faqs)}, ${sql.json(landing_estadisticas)},
        'Oposición a 4 plazas de Cuidador/a de la Diputación Provincial de Córdoba (OEP 2023-2025), concurso-oposición turno libre.',
        ${sql.json([{ tipo: 'sociosanitario', descripcion: 'Certificado de manipulador/a de alimentos y titulación sociosanitaria' }])},
        'concurso-oposicion'
      )`;
    console.log('convocatoria vigente insertada');
  });

  const chk = await sql`SELECT o.slug, o.is_active, o.temas_count,
      (SELECT count(*) FROM topics WHERE position_type=${PT}) AS topics,
      (SELECT count(*) FROM oposicion_bloques WHERE position_type=${PT}) AS bloques,
      (SELECT count(*) FROM convocatorias WHERE oposicion_id=o.id AND is_current) AS conv
    FROM oposiciones o WHERE o.slug=${SLUG}`;
  console.log('✅ CHECK:', JSON.stringify(chk[0]));
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
