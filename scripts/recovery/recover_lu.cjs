// Reconstrucción de los tests del 07-04 de Angela desde user_interactions.
// DRY-RUN por defecto; pasar --commit para escribir.
const { Pool } = require('pg');
const fs = require('fs');
const COMMIT = process.argv.includes('--commit');
const SIMULATE = process.argv.includes('--simulate');
const WRITE = COMMIT || SIMULATE; // ambos hacen INSERT; simulate hace ROLLBACK
const url = fs.readFileSync('.env.development.local', 'utf8').match(/DATABASE_URL=(\S+)/)[1].replace('?sslmode=require', '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const U = '8ec9fbe3-e48a-4d58-85f0-8b6de991027f';
const LET = ['A', 'B', 'C', 'D'];

(async () => {
  const c = await pool.connect();
  try {
    // Guard: si ya hay tests el 07-04 para ella, abortar (evitar duplicar)
    const exist = await c.query("SELECT count(*)::int n FROM tests WHERE user_id=$1 AND created_at>='2026-07-04' AND created_at<'2026-07-05'", [U]);
    if (exist.rows[0].n > 0) { console.log('⛔ Ya existen', exist.rows[0].n, 'tests el 07-04 — aborto para no duplicar.'); return; }

    const ev = await c.query(
      "SELECT session_id, created_at, value, page_url FROM user_interactions WHERE user_id=$1 AND event_type='test_answer_selected' AND created_at>='2026-07-04' AND created_at<'2026-07-05' ORDER BY created_at", [U]);

    // Segmentar en tests: nuevo test si cambia sesión/url o el questionIndex se reinicia/baja
    const tests = [];
    let cur = null, lastQi = -1;
    for (const r of ev.rows) {
      const v = r.value || {};
      const qi = v.questionIndex ?? 0;
      const isNew = !cur || r.session_id !== cur.session || r.page_url !== cur.url || qi <= lastQi;
      if (isNew) { cur = { session: r.session_id, url: r.page_url, answers: [], t0: r.created_at, t1: r.created_at }; tests.push(cur); }
      cur.answers.push({ qid: v.questionId, ans: v.answerIndex, qi, ts: r.created_at, tdec: v.timeToDecide });
      cur.t1 = r.created_at; lastQi = qi;
    }

    // Dedup dentro de cada test por questionId (última respuesta gana)
    for (const t of tests) {
      const m = new Map();
      for (const a of t.answers) m.set(a.qid, a);
      t.answers = [...m.values()];
    }

    // Traer datos de todas las preguntas
    const allQ = [...new Set(ev.rows.map(r => (r.value || {}).questionId))];
    const qd = await c.query("SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id FROM questions WHERE id = ANY($1::uuid[])", [allQ]);
    const Q = new Map(qd.rows.map(r => [r.id, r]));

    let totalOk = 0, totalBad = 0, totalQ = 0;
    const recoveredAt = new Date().toISOString();

    // Estado ANTES (para comparar en simulate)
    const streakBefore = (await c.query('SELECT calculate_user_streak($1) v', [U])).rows[0].v;
    if (WRITE) await c.query('BEGIN');

    console.log((COMMIT ? '💾 COMMIT' : SIMULATE ? '🧪 SIMULATE (rollback)' : '🔎 DRY-RUN') + ' — reconstrucción Lú Henao 07-04\n');
    let tno = 0;
    for (const t of tests) {
      tno++;
      const temaM = /\/tema\/(\d+)/.exec(t.url || '');
      const tema = temaM ? parseInt(temaM[1]) : null;
      let ok = 0;
      const rows = [];
      t.answers.forEach((a, i) => {
        const q = Q.get(a.qid); if (!q) return;
        const correct = a.ans === q.correct_option;
        if (correct) ok++;
        rows.push({ a, q, correct, order: i + 1 });
      });
      totalOk += ok; totalBad += (rows.length - ok); totalQ += rows.length;
      console.log(`  Test #${tno} [${String(t.t0).slice(11,16)}] tema:${tema ?? '-'} url:${(t.url||'').slice(-40)} → ${rows.length}q  ✓${ok}/✗${rows.length-ok}`);

      if (WRITE && rows.length > 0) {
        const tid = (await c.query(
          `INSERT INTO tests (user_id, title, test_type, total_questions, is_completed, score, started_at, completed_at, created_at, tema_number, test_number, test_url, detailed_analytics)
           VALUES ($1,$2,'practice',$3,true,$4,$5,$6,$6,$7,99,$8,$9) RETURNING id`,
          [U, `Test recuperado${tema ? ' - Tema ' + tema : ''}`, rows.length, ok, t.t0, t.t1, tema, t.url,
           JSON.stringify({ recovered: true, originalUrl: t.url, recoveredAt })]
        )).rows[0].id;
        for (const r of rows) {
          const opts = [r.q.option_a, r.q.option_b, r.q.option_c, r.q.option_d];
          await c.query(
            `INSERT INTO test_questions (test_id, question_id, question_order, question_text, user_answer, correct_answer, is_correct, was_blank, user_id, tema_number, time_spent_seconds, created_at, updated_at, full_question_context)
             VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10,$11,$11,$12)`,
            [tid, r.a.qid, r.order, r.q.question_text, LET[r.a.ans] ?? '?', LET[r.q.correct_option], r.correct, U, tema,
             Math.round((r.a.tdec || 0) / 1000), r.a.ts, JSON.stringify({ options: opts, recovered: true })]
          );
        }
      }
    }

    console.log(`\nTOTAL: ${tests.length} tests, ${totalQ} preguntas, ✓${totalOk} ✗${totalBad} (${((totalOk/(totalOk+totalBad))*100).toFixed(1)}%)`);

    if (WRITE) {
      // Verificación DENTRO de la transacción (antes de commit/rollback)
      const q = async (sql) => (await c.query(sql)).rows[0];
      const tq = await q(`SELECT count(*)::int n, count(*) FILTER (WHERE is_correct=false)::int fallos FROM test_questions WHERE user_id='${U}' AND created_at>='2026-07-04' AND created_at<'2026-07-05'`);
      const tests07 = await q(`SELECT count(*)::int n FROM tests WHERE user_id='${U}' AND created_at>='2026-07-04' AND created_at<'2026-07-05'`);
      const outbox = await q(`SELECT count(*)::int n FROM test_questions_outbox WHERE user_id='${U}' AND test_question_id IN (SELECT id FROM test_questions WHERE user_id='${U}' AND created_at>='2026-07-04')`);
      const streakAfter = (await c.query('SELECT calculate_user_streak($1) v', [U])).rows[0].v;
      const artStats = await q(`SELECT count(*)::int n FROM user_article_stats WHERE user_id='${U}'`).catch(()=>({n:'?'}));
      console.log('\n=== VERIFICACIÓN (dentro de la TX, triggers ya ejecutados) ===');
      console.log('  tests creados 07-04:', tests07.n);
      console.log('  test_questions 07-04:', tq.n, '| fallos (repaso):', tq.fallos);
      console.log('  outbox emitido (CDC):', outbox.n);
      console.log('  racha calculate_user_streak:  antes=', streakBefore, ' después=', streakAfter);
      console.log('  user_article_stats filas (tras triggers):', artStats.n);
    }

    if (COMMIT) { await c.query('COMMIT'); console.log('\n✅ COMMIT hecho'); }
    else if (SIMULATE) { await c.query('ROLLBACK'); console.log('\n🧪 ROLLBACK hecho — prod intacto. Si todo OK arriba, correr con --commit'); }
    else console.log('\n(dry-run: nada escrito)');
  } catch (e) {
    if (COMMIT) await c.query('ROLLBACK').catch(() => {});
    console.error('ERR', e.message);
  } finally { c.release(); await pool.end(); }
})();
