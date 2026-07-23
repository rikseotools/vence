// FASE 2a/5b — landing_description + convocatoria_hitos (timeline) de Ordenanza Ayto. Córdoba.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const OPO_ID = '66a462f4-68f6-461c-ab96-6920fa82f4d4';
const LANDING_DESC = 'Preparación de la oposición de Ordenanza del Ayuntamiento de Córdoba: 23 plazas por el sistema de oposición libre, sin requisito de titulación (Agrupación Profesional). Temario oficial de 10 temas y tests por tema. Inscripción abierta hasta el 17 de agosto de 2026.';

const HITOS = [
  { fecha: '2026-07-20', titulo: 'Convocatoria publicada (BOE núm. 175)', status: 'completed', order: 1,
    cita: 'BOE-A-2026-15802 (BOE núm. 175, 20/07/2026): 23 plazas de Ordenanza, oposición libre.', aprox: false },
  { fecha: '2026-07-21', titulo: 'Apertura del plazo de solicitudes', status: 'current', order: 2,
    cita: '20 días hábiles desde el día siguiente a la publicación en el BOE.', aprox: false },
  { fecha: '2026-08-17', titulo: 'Fin del plazo de solicitudes', status: 'upcoming', order: 3,
    cita: 'Cierre del plazo de presentación de solicitudes.', aprox: false },
  { fecha: '2026-12-01', titulo: 'Celebración de los ejercicios (fecha por determinar)', status: 'upcoming', order: 4,
    cita: 'Primer ejercicio (test de 45 preguntas) y segundo ejercicio (supuesto práctico). Fecha pendiente de determinar por el Tribunal.', aprox: true },
];

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE oposiciones SET landing_description=$1 WHERE id=$2', [LANDING_DESC, OPO_ID]);
    const cv = await c.query('SELECT id FROM convocatorias WHERE oposicion_id=$1 AND is_current LIMIT 1', [OPO_ID]);
    const convId = cv.rows[0] ? cv.rows[0].id : null;
    await c.query('DELETE FROM convocatoria_hitos WHERE oposicion_id=$1', [OPO_ID]);
    for (const h of HITOS) {
      await c.query(
        `INSERT INTO convocatoria_hitos
           (oposicion_id, convocatoria_id, fecha, titulo, status, order_index, severity, notify_status, origen, tipo, cita_literal, fecha_aproximada)
         VALUES ($1,$2,$3,$4,$5,$6,'important','pending','inferencia',$7,$8,$9)`,
        [OPO_ID, convId, h.fecha, h.titulo, h.status, h.order,
         h.order === 1 ? 'convocatoria_publicada' : h.order === 2 ? 'plazo_inicio' : h.order === 3 ? 'plazo_fin' : 'ejercicio_1',
         h.cita, h.aprox]);
    }
    await c.query('COMMIT');
    console.log('✅ landing_description + ' + HITOS.length + ' hitos insertados');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
