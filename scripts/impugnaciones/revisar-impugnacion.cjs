#!/usr/bin/env node
// Dossier estructurado de una impugnación (manual impugnaciones §2). Genera SIEMPRE el
// mismo análisis + los dos checks pre-rellenados con datos, para que Claude no se salte
// pasos. El JUICIO (¿válida?, ¿clave?, corrección) lo pone Claude; los DATOS y los checks
// mecánicos los pone este script.
//
// Uso: node scripts/impugnaciones/revisar-impugnacion.cjs <dispute_id> [--sid <id-sesión>]
//   Con --sid: COGE (claim) la impugnación para tu sesión y avisa si otra sesión ya la
//   está revisando (reparto entre 2-10 sesiones sin pisarse, ver cola.cjs). Sin --sid: solo dossier.
const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function recall(opt, art) { const O = words(opt), A = words(art); if (!O.size) return 0; let h = 0; O.forEach((w) => A.has(w) && h++); return h / O.size; }
const hasOptFormat = (e) => /\*\*A\)/i.test(e || '') && /\*\*B\)/i.test(e || '');

(async () => {
  const did = process.argv[2];
  if (!did) { console.error('Uso: revisar-impugnacion.cjs <dispute_id>'); process.exit(2); }
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    let d, isPsy = false;
    [d] = await s`SELECT *, 'legislative' qtype FROM question_disputes WHERE id=${did}`;
    if (!d) { [d] = await s`SELECT *, 'psychometric' qtype FROM psychometric_question_disputes WHERE id=${did}`; isPsy = !!d; }
    if (!d) { console.error('Impugnación no encontrada:', did); process.exit(2); }

    // --- CLAIM (reparto entre sesiones, ver cola.cjs). Solo si pasas --sid. No fatal. ---
    let claimWarn = '';
    const sidIdx = process.argv.indexOf('--sid');
    const sid = (sidIdx >= 0 ? process.argv[sidIdx + 1] : null) || process.env.CLAUDE_CODE_SESSION_ID || null;
    if (sid && ['pending', 'appealed'].includes(d.status)) {
      const dtbl = isPsy ? 'psychometric_question_disputes' : 'question_disputes';
      try {
        const fresh = d.claimed_by && d.claimed_by !== sid && d.claimed_at && (Date.now() - new Date(d.claimed_at).getTime()) < 2 * 3600e3;
        if (fresh) {
          const mins = Math.round((Date.now() - new Date(d.claimed_at).getTime()) / 60000);
          claimWarn = `⚠️  YA LA ESTÁ REVISANDO otra sesión (${String(d.claimed_by).slice(0, 8)}, hace ${mins}m). Coordínate o corre "cola.cjs next --sid ${sid}" para coger otra.`;
        } else {
          await s.unsafe(`UPDATE public.${dtbl} SET claimed_by=$1, claimed_at=now() WHERE id=$2`, [sid, did]);
          claimWarn = `🔒 Cogida por tu sesión (${String(sid).slice(0, 8)}).`;
        }
      } catch (e) { claimWarn = `(claim no aplicado: ${e.message})`; }
    }

    // --- PASO 0: ¿YA está respondida? Caza el desync status=pending PERO admin_response ya escrito
    //     (gotcha 504/partial-close: la respuesta se guardó/emailó pero el estado no se volteó).
    //     Trigger SOLO por admin_response (es por-dispute, fiable). NO por email_events: esa tabla no
    //     tiene dispute_id, así que un email 'impugnacion_respuesta' de OTRA dispute del mismo usuario
    //     daría falso positivo (visto 24/07 con Cristina: 3 disputes, cerrar una marcaba las otras). ---
    let alreadyWarn = '';
    if (['pending', 'appealed'].includes(d.status)) {
      const hasResp = d.admin_response && String(d.admin_response).trim().length > 0;
      if (hasResp) {
        alreadyWarn = '🛑 PASO 0 — YA RESPONDIDA (status=' + d.status + ' pero ya tiene admin_response'
          + (d.updated_at ? ' de ' + new Date(d.updated_at).toISOString().slice(0, 16) : '') + '):\n'
          + '   • ' + String(d.admin_response).replace(/\s+/g, ' ').trim().slice(0, 90) + '…\n'
          + '   → NO re-respondas (duplicarías el email). Solo falta CERRAR el estado (silent close):\n'
          + "     UPDATE status → 'resolved'/'rejected' preservando admin_response, SIN /resolve (reenviaría email).";
      }
    }

    const [p] = await s`SELECT full_name, email FROM user_profiles WHERE id=${d.user_id}`;
    const qtbl = isPsy ? 'psychometric_questions' : 'questions';
    const [q] = await s.unsafe(`SELECT * FROM ${qtbl} WHERE id='${d.question_id}'`);
    let art = null;
    if (!isPsy && q.primary_article_id) [art] = await s`SELECT a.article_number an, a.title, a.content, l.short_name ln FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${q.primary_article_id}`;

    const co = q.correct_option;
    const opts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    const correctText = opts['ABCD'[co]];

    console.log('══════════════════════════════════════════════════════════════');
    console.log(`DOSSIER IMPUGNACIÓN ${did.slice(0, 8)}  [${d.qtype}]`);
    console.log('══════════════════════════════════════════════════════════════');
    if (claimWarn) console.log(claimWarn);
    if (alreadyWarn) console.log(alreadyWarn);
    console.log(`Usuario: ${p?.full_name || '?'} (${p?.email || '?'})`);
    console.log(`Tipo: ${d.dispute_type} | estado: ${d.status}`);
    console.log(`Descripción: ${d.description}`);
    console.log(`\nPregunta (oficial=${q.is_official_exam}, lifecycle=${q.lifecycle_state}):`);
    console.log(`  ${q.question_text}`);
    ['A', 'B', 'C', 'D'].forEach((L) => opts[L] != null && console.log(`  ${L}) ${opts[L]}`));
    console.log(`  CLAVE: ${'ABCD'[co]}) ${correctText}`);
    console.log(`\nExplicación actual:\n  ${(q.explanation || '(vacía)').replace(/\n/g, '\n  ')}`);
    if (art) {
      console.log(`\nArtículo vinculado: ${art.ln} art ${art.an} — ${art.title || ''}`);
      console.log(`  ${art.content.slice(0, 500).replace(/\n/g, '\n  ')}${art.content.length > 500 ? ' …' : ''}`);
    } else if (!isPsy) console.log('\n⚠️ Artículo vinculado: NINGUNO (primary_article_id null)');

    console.log('\n─── CHECKS AUTOMÁTICOS (los verifica el código; el juicio lo pone Claude) ───');
    // Check (b): ¿el artículo vinculado responde? (recall de la opción correcta en el artículo)
    if (art) {
      const r = recall(correctText, art.content);
      const verdict = r >= 0.7 ? '🟢 alto (probablemente SÍ responde)' : r >= 0.4 ? '🟡 medio (revisar a mano)' : '🔴 bajo (probablemente NO responde → re-vincular)';
      console.log(`(b) ¿el artículo vinculado responde la pregunta? → recall opción correcta ↔ artículo = ${(r * 100).toFixed(0)}% ${verdict}`);
      console.log(`    ⚠️ recall alto ≠ garantía: verifica que el HECHO concreto esté literal, no solo las palabras.`);
    } else if (!isPsy) console.log('(b) ¿el artículo responde? → 🔴 NO hay artículo vinculado (o es art 0 estructural).');
    // Check (a): formato de la explicación
    console.log(`(a) ¿la explicación tiene formato §5.1 (por opción)? → ${hasOptFormat(q.explanation) ? '🟢 sí' : '🔴 NO (apelotonada / sin análisis por opción) → mejorable'}`);

    console.log('\─── CHECKLIST OBLIGATORIA (marcar cada una antes de proponer) ───'.replace('\\─','─'));
    console.log('  [ ] 1. ¿La CLAVE es correcta? (verificar contra el artículo/ley)');
    console.log('  [ ] 2. (b) ¿El artículo vinculado responde LITERALMENTE? (no solo solape de palabras)');
    console.log('  [ ] 3. ¿La pregunta está bien formulada? (¿doble solución? ¿opción D vacía legítima? ¿enunciado confuso?)');
    console.log('  [ ] 4. (a) ¿La explicación es mejorable? (formato §5.1 + exactitud) → SIEMPRE evaluar');
    console.log('  [ ] 5. Clasificar: informática / tema_incorrecto / supuesto huérfano / estructural / normal');
    console.log('  [ ] 6. ¿Oficial? (oficial=no se toca enunciado/opciones; no oficial=se mejora)');
    console.log('  [ ] 7. Antes de aplicar explicación nueva → pasar validar-explicacion.cjs');
    console.log('  [ ] 8. Borrador del mensaje (Hola <nombre real>, reconocer si tenía razón, Muchas gracias, Equipo de Vence) → ESPERAR OK');
    console.log('  [ ] 9. Cerrar vía /api/v2/dispute/resolve (nunca UPDATE directo del dispute)');
  } finally { await s.end(); }
})();
