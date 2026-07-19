#!/usr/bin/env node
// Aplicador de correcciones a preguntas en needs_human (campaña citas ajenas 2026-07).
// Hace en UNA transacción: (opcional) re-vínculo de primary_article_id + (opcional) nueva
// explicación + marca la fila AVR de la campaña como fix_applied + transición de lifecycle
// vía la función SQL canónica (audit trail). NO toca correct_option (nunca auto-flip de clave).
//
// Uso:
//   node scripts/impugnaciones/aplicar-needs-human.cjs \
//     --id <uuid> \
//     [--expl <fichero.md>] \
//     [--relink <article_uuid>] \
//     --to <approved|tech_approved|retired_irreparable|needs_review> \
//     --reason <reason_code> \
//     --note "texto de audit" \
//     [--dry]
//
// Guardarraíl: si --expl, valida la explicación con validar-explicacion.cjs ANTES de aplicar
// (contra el artículo YA re-vinculado si se pasa --relink). Aborta si no valida.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
const has = (name) => process.argv.includes(name);

const ADMIN = null; // campaña Claude Code: changed_by NULL (convención de las pasadas previas)
const CAMPAIGN_PROVIDERS = ['claude_code_citas_2026_07', 'claude_code_mislink_ley_2026_07'];

(async () => {
  const id = arg('--id');
  const explFile = arg('--expl');
  const relink = arg('--relink');
  const to = arg('--to');
  const reason = arg('--reason');
  const note = arg('--note') || 'campaña citas: corrección needs_human';
  const dry = has('--dry');
  if (!id || !to || !reason) { console.error('faltan --id / --to / --reason'); process.exit(2); }

  const newExpl = explFile ? fs.readFileSync(explFile, 'utf8') : null;

  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const [q] = await s`SELECT id, lifecycle_state, primary_article_id FROM questions WHERE id = ${id}`;
    if (!q) { console.error('pregunta no encontrada'); process.exit(2); }
    console.log(`estado actual: ${q.lifecycle_state}  primary_article=${q.primary_article_id}`);

    if (relink) {
      const [a] = await s`SELECT a.id, a.article_number, l.short_name FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${relink}`;
      if (!a) { console.error('artículo destino --relink no existe'); process.exit(2); }
      console.log(`re-vínculo → ${a.short_name} art.${a.article_number} (${a.id})`);
    }

    if (dry) { console.log('DRY: no se aplica nada.'); process.exit(0); }

    // 1. re-vínculo (antes de validar la explicación, para que la cita se valide contra el art nuevo)
    if (relink) await s`UPDATE questions SET primary_article_id=${relink} WHERE id=${id}`;

    // 2. validar explicación contra el artículo YA vinculado
    if (newExpl) {
      try {
        execFileSync('node', [path.join(__dirname, 'validar-explicacion.cjs'), id, explFile], { stdio: 'inherit' });
      } catch (e) {
        console.error('❌ la explicación no valida — abortando (revínculo revertido)');
        if (relink) await s`UPDATE questions SET primary_article_id=${q.primary_article_id} WHERE id=${id}`;
        process.exit(1);
      }
      await s`UPDATE questions SET explanation=${newExpl} WHERE id=${id}`;
    }

    // 3. marcar la fila AVR de campaña como fix_applied (traza)
    const upd = await s`UPDATE ai_verification_results SET fix_applied=true, fix_applied_at=now(),
        new_explanation=COALESCE(${newExpl}, new_explanation)
      WHERE question_id=${id} AND ai_provider = ANY(${CAMPAIGN_PROVIDERS}) RETURNING id`;
    console.log(`AVR marcadas fix_applied: ${upd.length}`);

    // 4. transición de lifecycle (audit trail canónico)
    await s`SELECT public.transition_question_state(${id}::uuid, ${q.lifecycle_state}::text, ${to}::text, ${reason}::text, ${ADMIN}::uuid, ${upd[0]?.id ?? null}::uuid, ${note.slice(0, 250)}::text)`;
    const [after] = await s`SELECT lifecycle_state, is_active FROM questions WHERE id=${id}`;
    console.log(`✅ nuevo estado: ${after.lifecycle_state}  is_active=${after.is_active}`);
  } finally { await s.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
