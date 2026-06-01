/**
 * Sprint A — migración masiva OFFICIAL_OPOSICIONES → tabla `oposiciones`.
 *
 * Para cada entrada C1+C2 del array `OFFICIAL_OPOSICIONES` en
 * `components/OnboardingModal.tsx` que NO existe en BD (por slug), INSERT con
 * campos mínimos + coverage_level='catalogada'. Idempotente (re-ejecutable).
 *
 * Convención slug: el `id` de OFFICIAL_OPOSICIONES usa underscores
 * (`auxiliar_administrativo_madrid`); la BD usa guiones
 * (`auxiliar-administrativo-madrid`). Mapeo automático.
 *
 * Tras esto, el Sprint B refactoriza el frontend para fetchar desde BD en vez
 * de leer el array hardcoded.
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const fs = require('fs');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

// Mapeo administracion → enum del campo `oposiciones.administracion` (texto libre).
function normalizeAdmin(admin) {
  return admin; // sin cambios; el campo es libre
}

(async () => {
  // 1) Parse OFFICIAL_OPOSICIONES
  const src = fs.readFileSync('components/OnboardingModal.tsx', 'utf8');
  const re = /\{\s*id:\s*'([^']+)',\s*nombre:\s*'([^']+)',\s*categoria:\s*'([^']+)',\s*administracion:\s*'([^']+)',\s*icon:\s*'([^']+)'/g;
  const all = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    all.push({ id: m[1], nombre: m[2], categoria: m[3], administracion: m[4], icon: m[5] });
  }
  const c12 = all.filter(o => ['C1', 'C2'].includes(o.categoria));
  console.log(`OFFICIAL_OPOSICIONES total: ${all.length} | C1+C2: ${c12.length}`);

  // 2) Cargar slugs existentes en BD
  const existing = await sql`SELECT slug FROM oposiciones`;
  const existingSlugs = new Set(existing.map(r => r.slug));
  console.log(`Slugs existentes en BD: ${existingSlugs.size}`);

  // 3) Para cada entrada C1+C2, comprobar si ya existe (por slug derivado)
  const toInsert = [];
  const alreadyInBd = [];
  for (const e of c12) {
    const slug = e.id.replace(/_/g, '-');
    if (existingSlugs.has(slug)) {
      alreadyInBd.push({ id: e.id, slug });
    } else {
      toInsert.push({ ...e, slug });
    }
  }
  console.log(`\nYa en BD: ${alreadyInBd.length}`);
  console.log(`A insertar: ${toInsert.length}`);

  // 4) INSERTs en transacción
  if (toInsert.length === 0) {
    console.log('\nNada que insertar. Saliendo.');
    await sql.end();
    return;
  }

  let insertedCount = 0;
  let failedCount = 0;
  const failures = [];

  await sql.begin(async tx => {
    for (const e of toInsert) {
      try {
        // Campos mínimos: nombre, tipo_acceso (libre por default), administracion, categoria,
        // slug, coverage_level. tipo_acceso es NOT NULL en el schema, así que rellenamos 'libre'.
        await tx`
          INSERT INTO public.oposiciones (
            nombre,
            tipo_acceso,
            administracion,
            categoria,
            slug,
            coverage_level,
            is_active,
            is_convocatoria_activa
          ) VALUES (
            ${e.nombre},
            'libre',
            ${normalizeAdmin(e.administracion)},
            ${e.categoria},
            ${e.slug},
            'catalogada',
            false,
            false
          )
        `;
        insertedCount++;
      } catch (err) {
        failedCount++;
        failures.push({ id: e.id, slug: e.slug, error: err.message });
      }
    }
  });

  console.log(`\n✅ INSERT OK: ${insertedCount}`);
  if (failedCount > 0) {
    console.log(`❌ INSERT FAIL: ${failedCount}`);
    for (const f of failures.slice(0, 10)) {
      console.log(`  - ${f.slug}: ${f.error}`);
    }
  }

  // 5) Resumen final
  const finalCounts = await sql`
    SELECT coverage_level, COUNT(*) AS n FROM oposiciones GROUP BY coverage_level ORDER BY 1
  `;
  console.log('\n=== Resumen post-migración ===');
  for (const c of finalCounts) console.log(`  ${c.coverage_level}: ${c.n}`);
  const totalBd = await sql`SELECT COUNT(*) AS n FROM oposiciones`;
  console.log(`  TOTAL: ${totalBd[0].n}`);

  await sql.end();
})();
