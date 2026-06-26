/**
 * Backfill puntual: re-evalúa las señales `pag_empleo` con el matcher nuevo
 * (oep-match) y corrige en BD `oposicion_id`, `is_novel` y `position_category`.
 *
 * Necesario porque el sensor inserta con ON CONFLICT DO NOTHING (dedupe por
 * convocatoria) → re-ejecutarlo NO actualiza filas ya existentes. Las señales
 * creadas con el matcher viejo arrastran falsos positivos (Ayto. Ávila /
 * Univ. León → cyl) y el falso negativo de IIPP.
 *
 * Uso:
 *   npx ts-node src/scripts/backfill-pag-match.ts          # dry-run (no escribe)
 *   npx ts-node src/scripts/backfill-pag-match.ts --apply  # aplica los cambios
 *
 * Idempotente: una 2ª pasada no debería proponer ningún cambio.
 */
import postgres from 'postgres';
import { config } from 'dotenv';
import { pickBestMatch, type OposicionCandidate } from '../oep-signals/oep-match';

config({ path: `${__dirname}/../../../.env.local` });

const APPLY = process.argv.includes('--apply');

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  const catalog = (await sql`
    SELECT id, nombre, slug, short_name AS "shortName", subgrupo, administracion
    FROM oposiciones WHERE is_active = true
  `) as unknown as OposicionCandidate[];

  const signals = (await sql`
    SELECT id, oposicion_id, is_novel, position_category,
           raw_extraction->'pag' AS pag
    FROM oep_detection_signals
    WHERE sensor_type = 'pag_empleo' AND status = 'pending'
    ORDER BY created_at DESC
  `) as unknown as Array<{
    id: string;
    oposicion_id: string | null;
    is_novel: boolean | null;
    position_category: string | null;
    pag: {
      cuerpo: string;
      grupo: string;
      admin: string;
      ccaa: string;
      organismo: string;
    };
  }>;

  const byId = new Map(catalog.map((o) => [o.id, o]));
  let changes = 0;

  for (const s of signals) {
    const best = pickBestMatch(
      {
        cuerpo: s.pag.cuerpo,
        grupo: s.pag.grupo,
        admin: s.pag.admin,
        ccaa: s.pag.ccaa,
        organismo: s.pag.organismo,
      },
      catalog,
    );
    const newOpoId = best.matched ? best.oposicionId : null;
    const newNovel = newOpoId === null;
    const newCat = s.pag.grupo || null;

    const opoChanged = (s.oposicion_id ?? null) !== (newOpoId ?? null);
    const novelChanged = (s.is_novel ?? null) !== newNovel;
    const catChanged = (s.position_category ?? null) !== (newCat ?? null);

    if (!opoChanged && !novelChanged && !catChanged) continue;
    changes++;

    const oldSlug = s.oposicion_id ? byId.get(s.oposicion_id)?.slug ?? '?' : '∅';
    const newSlug = newOpoId ? byId.get(newOpoId)?.slug ?? '?' : '∅(novel)';
    console.log(
      `· ${s.pag.cuerpo.slice(0, 32).padEnd(32)} «${s.pag.organismo.slice(0, 24).padEnd(24)}»  ` +
        `${oldSlug.padEnd(36)} → ${newSlug}` +
        `${catChanged ? `  [cat:${s.position_category ?? '∅'}→${newCat}]` : ''}` +
        `  {${best.reason}}`,
    );

    if (APPLY) {
      await sql`
        UPDATE oep_detection_signals
        SET oposicion_id = ${newOpoId},
            is_novel = ${newNovel},
            position_category = ${newCat},
            updated_at = now()
        WHERE id = ${s.id}
      `;
    }
  }

  console.log(
    `\n${APPLY ? '✅ APLICADO' : '🔍 DRY-RUN'}: ${changes} señal(es) con cambios de ${signals.length} pending.`,
  );
  await sql.end();
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
