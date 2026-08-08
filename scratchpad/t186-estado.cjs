require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const { enlaceOficialEfectivo, rotuloEnlaceOficial, esOepSinConvocatoria } = require('../lib/convocatoria/enlaceOficial.cjs');
const OPO = '624e85b9-b14c-401e-b94d-329edf6c12b6';
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const o = await c.query(`SELECT id, slug, nombre, is_active, programa_url, diario_oficial, estado_proceso FROM oposiciones WHERE id=$1`, [OPO]);
  console.log('OPOSICION:', JSON.stringify(o.rows[0], null, 1));
  const v = await c.query(`SELECT slug, programa_url, estado_proceso, diario_oficial FROM oposiciones_ssot WHERE id=$1`, [OPO]).catch(e => ({ rows: [{ err: e.message }] }));
  console.log('\nSSOT (lo que LEE la landing):', JSON.stringify(v.rows[0], null, 1));
  const cv = await c.query(`SELECT id, año, is_current, archived_at, programa_url, estado_proceso, oep_decreto FROM convocatorias WHERE oposicion_id=$1 ORDER BY is_current DESC, año DESC`, [OPO]);
  cv.rows.forEach(r => console.log('CONVOCATORIA:', JSON.stringify(r)));

  // El matiz que señalé al revisar: ¿la rama OEP se activaría?
  const s = v.rows[0] || {};
  const oep = await c.query(`SELECT d.source_url FROM convocatoria_oep co JOIN oep e ON e.id=co.oep_id
      LEFT JOIN convocatoria_documentos d ON d.id = e.source_documento_id
     WHERE co.convocatoria_id IN (SELECT id FROM convocatorias WHERE oposicion_id=$1 AND is_current)`, [OPO]).catch(() => ({ rows: [] }));
  const enlaceOep = oep.rows[0]?.source_url ?? null;
  console.log('\nenlaceOep:', enlaceOep);
  console.log('estado en ESTADOS_SIN_CONVOCATORIA?:', esOepSinConvocatoria(s.estado_proceso));
  console.log('BOTÓN AHORA :', enlaceOficialEfectivo({ estadoProceso: s.estado_proceso, enlaceOep, programaUrl: s.programa_url }));
  console.log('BOTÓN si NULL:', enlaceOficialEfectivo({ estadoProceso: s.estado_proceso, enlaceOep, programaUrl: null }));
  console.log('rótulo       :', rotuloEnlaceOficial({ estadoProceso: s.estado_proceso, diarioOficial: s.diario_oficial }));
  await c.end();
})();
