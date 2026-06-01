/**
 * Sprint G.2 — migración de datos oposiciones → convocatorias.
 *
 * Para cada oposición con datos REALES de proceso (plazas, fechas, BOE,
 * convocatoria_fecha), INSERT en convocatorias con is_current calculado.
 *
 * Casos especiales unificados:
 *   - auxiliar-administrativo-madrid-2025 → vinculada a madrid (sin sufijo)
 *   - auxiliar-administrativo-canarias-2024 → vinculada a canarias (sin sufijo)
 *
 * Backfill convocatoria_hitos.convocatoria_id según mapeo oposicion→convocatoria.
 *
 * Idempotente (ON CONFLICT DO NOTHING en la UNIQUE oposicion_id+año).
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const { Redis } = require('@upstash/redis');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

// Mapeo: oposiciones con sufijo año → cuerpo principal (sin sufijo)
const SUFIJO_UNIFICATION = {
  'auxiliar-administrativo-madrid-2025': 'auxiliar-administrativo-madrid',
  'auxiliar-administrativo-canarias-2024': 'auxiliar-administrativo-canarias',
};

(async () => {
  console.log('=== Sprint G.2 — migración datos oposiciones → convocatorias ===\n');

  // PASO 1: INSERT en convocatorias desde oposiciones con datos REALES de proceso.
  // Criterio: tiene plazas, fecha examen, convocatoria_fecha O boe_reference.
  // Solo estado_proceso != catalogada NO basta (las 103 catalogadas tienen default).
  console.log('PASO 1: INSERT convocatorias desde oposiciones con datos reales...');

  const result = await sql.begin(async tx => {
    const inserted = await tx`
      INSERT INTO convocatorias (
        oposicion_id, año, convocatoria_numero, convocatoria_fecha, convocatoria_dogv,
        is_current, archived_at,
        estado_proceso, oep_decreto, oep_fecha,
        plazas_libres, plazas_promocion_interna, plazas_discapacidad,
        boe_publication_date, boe_reference,
        inscription_start, inscription_deadline,
        exam_date, exam_date_approximate, programa_url,
        examen_config, landing_faqs, landing_estadisticas,
        landing_description, requisitos_especiales,
        seguimiento_last_checked, seguimiento_last_hash, seguimiento_change_status
      )
      SELECT
        o.id,
        COALESCE(
          EXTRACT(YEAR FROM o.convocatoria_fecha)::int,
          EXTRACT(YEAR FROM o.boe_publication_date)::int,
          EXTRACT(YEAR FROM o.exam_date)::int,
          2026
        ) AS año,
        o.convocatoria_numero, o.convocatoria_fecha, o.convocatoria_dogv,
        -- is_current=true salvo si el slug acaba en -YYYY y is_active=false (legacy)
        CASE
          WHEN o.slug ~ '-[0-9]{4}$' AND o.is_active = false THEN false
          ELSE true
        END AS is_current,
        -- archived_at: solo si el proceso ya terminó
        CASE
          WHEN o.is_active = false AND o.estado_proceso IN ('examen_realizado', 'resultados', 'nombramientos')
            THEN COALESCE(o.exam_date::timestamptz, NOW())
          ELSE NULL
        END AS archived_at,
        o.estado_proceso, o.oep_decreto, o.oep_fecha,
        o.plazas_libres, o.plazas_promocion_interna, o.plazas_discapacidad,
        o.boe_publication_date, o.boe_reference,
        o.inscription_start, o.inscription_deadline,
        o.exam_date, COALESCE(o.exam_date_approximate, false), o.programa_url,
        o.examen_config, o.landing_faqs, o.landing_estadisticas,
        o.landing_description, o.requisitos_especiales,
        o.seguimiento_last_checked, o.seguimiento_last_hash, o.seguimiento_change_status
      FROM oposiciones o
      WHERE o.plazas_libres IS NOT NULL
         OR o.exam_date IS NOT NULL
         OR o.convocatoria_fecha IS NOT NULL
         OR o.boe_reference IS NOT NULL
      ON CONFLICT (oposicion_id, año) DO NOTHING
      RETURNING id, oposicion_id, año, is_current
    `;
    console.log(`  ✅ ${inserted.length} convocatorias creadas`);
    return inserted;
  });

  // PASO 2: Unificar madrid-2025 y canarias-2024 con su cuerpo principal
  console.log('\nPASO 2: Unificar sufijos legacy con cuerpo principal...');
  for (const [slugLegacy, slugPrincipal] of Object.entries(SUFIJO_UNIFICATION)) {
    const cuerpoLegacy = await sql`SELECT id FROM oposiciones WHERE slug = ${slugLegacy}`;
    const cuerpoPrincipal = await sql`SELECT id FROM oposiciones WHERE slug = ${slugPrincipal}`;
    if (cuerpoLegacy.length === 0 || cuerpoPrincipal.length === 0) {
      console.log(`  ⚠️  ${slugLegacy} → ${slugPrincipal}: una de las dos no existe, skip`);
      continue;
    }
    const idLegacy = cuerpoLegacy[0].id;
    const idPrincipal = cuerpoPrincipal[0].id;

    // Cambiar convocatoria del legacy → vincular al principal
    const r = await sql`
      UPDATE convocatorias
      SET oposicion_id = ${idPrincipal}::uuid,
          is_current = false,
          archived_at = COALESCE(archived_at, NOW())
      WHERE oposicion_id = ${idLegacy}::uuid
      RETURNING id, año
    `;
    console.log(`  ${slugLegacy.padEnd(50)} → ${slugPrincipal}: ${r.length} convocatorias reasignadas (archived)`);
  }

  // PASO 3: Backfill convocatoria_hitos.convocatoria_id
  console.log('\nPASO 3: Backfill convocatoria_hitos.convocatoria_id...');

  // 3a) Hitos cuya oposicion tiene 1 sola convocatoria → asignar a esa.
  const r3a = await sql`
    UPDATE convocatoria_hitos h
    SET convocatoria_id = c.id
    FROM convocatorias c
    WHERE c.oposicion_id = h.oposicion_id
      AND h.convocatoria_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM convocatorias c2
        WHERE c2.oposicion_id = h.oposicion_id AND c2.id != c.id
      )
    RETURNING h.id
  `;
  console.log(`  ✅ ${r3a.length} hitos asignados (oposicion con 1 sola convocatoria)`);

  // 3b) Si una oposicion tiene varias convocatorias: asignar por proximidad de fechas.
  // Para cada hito sin convocatoria_id, buscar la convocatoria de la oposicion cuya
  // ventana [convocatoria_fecha, COALESCE(archived_at::date, NOW())] contenga h.fecha.
  const r3b = await sql`
    UPDATE convocatoria_hitos h
    SET convocatoria_id = c.id
    FROM convocatorias c
    WHERE c.oposicion_id = h.oposicion_id
      AND h.convocatoria_id IS NULL
      AND h.fecha BETWEEN
        COALESCE(c.convocatoria_fecha, '1970-01-01'::date)
        AND COALESCE(c.archived_at::date, c.exam_date + INTERVAL '6 months', NOW()::date + INTERVAL '6 months')
    RETURNING h.id
  `;
  console.log(`  ✅ ${r3b.length} hitos asignados (por proximidad de fechas)`);

  // 3c) Hitos restantes (huérfanos): asignar a la convocatoria con is_current=true
  // de la oposicion. Si la oposicion tiene 1 sola convocatoria archived, asignar a esa.
  const r3c = await sql`
    UPDATE convocatoria_hitos h
    SET convocatoria_id = c.id
    FROM convocatorias c
    WHERE c.oposicion_id = h.oposicion_id
      AND h.convocatoria_id IS NULL
      AND c.is_current = true
    RETURNING h.id
  `;
  console.log(`  ✅ ${r3c.length} hitos restantes asignados a convocatoria_current`);

  const huerfanos = await sql`
    SELECT COUNT(*) AS n FROM convocatoria_hitos WHERE convocatoria_id IS NULL
  `;
  console.log(`\n  Hitos sin convocatoria_id (huérfanos restantes): ${huerfanos[0].n}`);

  // PASO 4: Verificar invariante is_current
  console.log('\nPASO 4: Verificar invariante (máx 1 is_current por oposicion)...');
  const violations = await sql`
    SELECT oposicion_id, COUNT(*) AS n
    FROM convocatorias WHERE is_current = true
    GROUP BY oposicion_id HAVING COUNT(*) > 1
  `;
  if (violations.length === 0) {
    console.log('  ✅ Invariante OK: ninguna oposicion con >1 is_current');
  } else {
    console.log('  ❌ Violación:', violations);
  }

  // PASO 5: Invalidar cache Redis catalog
  try {
    const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    await r.del('oposiciones:catalog:v1');
    console.log('\n✅ Cache Redis invalidado');
  } catch (e) {
    console.warn('⚠️ No se pudo invalidar cache:', e.message);
  }

  // PASO 6: Resumen final
  console.log('\n=== RESUMEN ===');
  const summary = await sql`
    SELECT
      (SELECT COUNT(*) FROM convocatorias) AS total_convs,
      (SELECT COUNT(*) FROM convocatorias WHERE is_current = true) AS vigentes,
      (SELECT COUNT(*) FROM convocatorias WHERE archived_at IS NOT NULL) AS archivadas,
      (SELECT COUNT(*) FROM convocatoria_hitos WHERE convocatoria_id IS NOT NULL) AS hitos_migrados,
      (SELECT COUNT(*) FROM convocatoria_hitos WHERE convocatoria_id IS NULL) AS hitos_huerfanos
  `;
  console.log(summary[0]);

  await sql.end();
})();
