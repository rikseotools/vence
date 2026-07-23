// FASE 5b — convocatoria_hitos (timeline) + inscription_deadline aproximado. Idempotente.
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const SLUG = 'cuidador-diputacion-cordoba';
const PROG = 'https://bop.dipucordoba.es/visor-pdf/23-07-2026/BOP-A-2026-2548.pdf';

const HITOS = [
  { fecha: '2025-01-01', titulo: 'OEP 2023 y 2025', descripcion: '4 plazas de Cuidador/a (personal laboral) incluidas en las Ofertas de Empleo Público de 2023 y 2025.', status: 'completed', order_index: 0, aprox: true, url: null, tipo: 'oep_aprobada', origen: 'registro' },
  { fecha: '2026-07-23', titulo: 'Publicación de las bases (BOP nº 141)', descripcion: 'Bases generales y específicas aprobadas por Acuerdo de la Junta de Gobierno de 14/07/2026 (BOP-A-2026-2548).', status: 'completed', order_index: 1, aprox: false, url: PROG, tipo: 'bases_publicadas', origen: 'registro' },
  { fecha: '2026-07-24', titulo: 'Apertura del plazo de solicitudes', descripcion: 'Plazo de 20 días hábiles a contar desde el día siguiente a la publicación de las bases.', status: 'current', order_index: 2, aprox: false, url: null, tipo: 'plazo_inicio', origen: 'registro' },
  { fecha: '2026-08-20', titulo: 'Fin del plazo de solicitudes (previsión)', descripcion: 'Previsión del último día del plazo de 20 días hábiles (sujeto a los días festivos aplicables).', status: 'upcoming', order_index: 3, aprox: true, url: null, tipo: 'plazo_fin', origen: 'estimacion' },
  { fecha: '2026-09-15', titulo: 'Lista de personas admitidas y excluidas', descripcion: 'Publicación de la resolución con la lista provisional de admitidos y excluidos (pendiente).', status: 'upcoming', order_index: 4, aprox: true, url: null, tipo: 'lista_provisional', origen: 'estimacion' },
  { fecha: '2026-11-15', titulo: 'Ejercicio de la fase de oposición', descripcion: 'Ejercicio único de 130 minutos en dos partes (teórica + supuestos prácticos). Fecha por determinar.', status: 'upcoming', order_index: 5, aprox: true, url: null, tipo: 'ejercicio_1', origen: 'estimacion' }
];

(async () => {
  const op = await sql`SELECT id FROM oposiciones WHERE slug=${SLUG}`;
  if (!op[0]) throw new Error('oposición no encontrada');
  const oid = op[0].id;
  const cv = await sql`SELECT id FROM convocatorias WHERE oposicion_id=${oid} AND is_current LIMIT 1`;
  const cid = cv[0] ? cv[0].id : null;

  await sql`UPDATE oposiciones SET inscription_deadline='2026-08-20' WHERE id=${oid}`;
  await sql`UPDATE convocatorias SET inscription_deadline='2026-08-20' WHERE id=${cid}`;

  await sql`DELETE FROM convocatoria_hitos WHERE oposicion_id=${oid}`;
  for (const h of HITOS) {
    await sql`INSERT INTO convocatoria_hitos (oposicion_id, convocatoria_id, fecha, titulo, descripcion, url, status, order_index, fecha_aproximada, tipo, origen)
              VALUES (${oid}, ${cid}, ${h.fecha}, ${h.titulo}, ${h.descripcion}, ${h.url}, ${h.status}, ${h.order_index}, ${h.aprox}, ${h.tipo}, ${h.origen})`;
  }
  const c = await sql`SELECT count(*)::int n FROM convocatoria_hitos WHERE oposicion_id=${oid}`;
  console.log('✅ hitos insertados:', c[0].n, '| inscription_deadline=2026-08-20 (aprox)');
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
