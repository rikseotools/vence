/**
 * Backfill puntual: anota `admin_notes` en las señales pag_empleo ya CASADAS con
 * el veredicto de frescura de inscripción (inscription-reconcile), igual que hará
 * el sensor en cada run futuro. Necesario porque las señales existentes se
 * insertaron antes de cablear el veredicto (y ON CONFLICT DO NOTHING no las toca).
 *
 * NO escribe el catálogo — solo la nota de la señal. Idempotente.
 *
 * Uso:
 *   npx ts-node src/scripts/annotate-pag-freshness.ts          # dry-run
 *   npx ts-node src/scripts/annotate-pag-freshness.ts --apply
 */
import postgres from 'postgres';
import { config } from 'dotenv';
import { classifyInscriptionFreshness } from '../oep-signals/inscription-reconcile';

config({ path: `${__dirname}/../../../.env.local` });

const APPLY = process.argv.includes('--apply');

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  const rows = (await sql`
    SELECT s.id,
           s.admin_notes AS current_notes,
           s.raw_extraction->'pag'->>'plazoHasta' AS signal_deadline,
           o.slug,
           o.inscription_deadline::text AS catalog_deadline
    FROM oep_detection_signals s
    JOIN oposiciones o ON o.id = s.oposicion_id
    WHERE s.sensor_type = 'pag_empleo' AND s.status = 'pending'
    ORDER BY o.slug
  `) as unknown as Array<{
    id: string;
    current_notes: string | null;
    signal_deadline: string | null;
    slug: string;
    catalog_deadline: string | null;
  }>;

  let changes = 0;
  for (const r of rows) {
    const f = classifyInscriptionFreshness(r.catalog_deadline, r.signal_deadline);
    const newNote = f.note;
    if ((r.current_notes ?? null) === newNote) continue;
    changes++;
    console.log(
      `· ${r.slug.padEnd(40)} [${f.verdict}${f.actionable ? ' ⚠️' : ''}]  cat:${r.catalog_deadline ?? '∅'} señal:${r.signal_deadline ?? '∅'}`,
    );
    if (APPLY) {
      await sql`
        UPDATE oep_detection_signals
        SET admin_notes = ${newNote}, updated_at = now()
        WHERE id = ${r.id}
      `;
    }
  }

  const actionable = rows.filter(
    (r) => classifyInscriptionFreshness(r.catalog_deadline, r.signal_deadline).actionable,
  ).length;
  console.log(
    `\n${APPLY ? '✅ APLICADO' : '🔍 DRY-RUN'}: ${changes} nota(s) a actualizar de ${rows.length} casadas. Accionables ahora: ${actionable}.`,
  );
  await sql.end();
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
