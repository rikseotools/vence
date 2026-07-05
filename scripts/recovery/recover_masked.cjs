// Recuperación de los usuarios con pérdida ENMASCARADA que el barrido global no cazó
// (su pre-filtro a nivel-ventana los excluyó porque otros días guardaron bien).
// Mismo método robusto que recover_global: segmentar + filtro LOST por-segmento (anti-duplicado).
// Modos: (def) dry | --simulate (TX+rollback por usuario) | --commit
const { Pool } = require('pg');
const fs = require('fs');
const MODE = process.argv.includes('--commit') ? 'commit' : process.argv.includes('--simulate') ? 'simulate' : 'dry';
const url = fs.readFileSync('.env.development.local', 'utf8').match(/DATABASE_URL=(\S+)/)[1].replace('?sslmode=require', '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const LET = ['A', 'B', 'C', 'D'];
const W0 = '2026-07-02 00:00', W1 = '2026-07-05 00:35';
const MARGIN = 5 * 60 * 1000;
const USERS = [
  'dc5ac505', '6d89d010', '78fe6c8d', 'a7413904',
];

function segment(events) {
  const tests = []; let cur = null, lastQi = -1;
  for (const r of events) {
    const v = r.value || {}; const qi = v.questionIndex ?? 0;
    const isNew = !cur || r.session_id !== cur.session || r.page_url !== cur.url || qi <= lastQi;
    if (isNew) { cur = { session: r.session_id, url: r.page_url, answers: [], t0: r.created_at, t1: r.created_at }; tests.push(cur); }
    cur.answers.push({ qid: v.questionId, ans: v.answerIndex, qi, ts: r.created_at, tdec: v.timeToDecide });
    cur.t1 = r.created_at; lastQi = qi;
  }
  for (const t of tests) { const m = new Map(); for (const a of t.answers) if (a.qid != null) m.set(a.qid, a); t.answers = [...m.values()]; }
  return tests;
}

(async () => {
  const recoveredAt = new Date().toISOString();
  let gTests = 0, gAns = 0, gOk = 0, gUsers = 0;
  console.log(`MODE=${MODE} | usuarios: ${USERS.length} | ventana ${W0}→${W1}\n`);

  for (const short of USERS) {
    const c = await pool.connect();
    try {
      const U = (await c.query("SELECT id FROM user_profiles WHERE id::text LIKE $1||'%'", [short])).rows[0].id;
      const ev = (await c.query(`SELECT session_id, created_at, value, page_url FROM user_interactions WHERE user_id=$1 AND event_type='test_answer_selected' AND created_at>=$2 AND created_at<$3 ORDER BY created_at`, [U, W0, W1])).rows;
      const segs = segment(ev);
      const qids = [...new Set(ev.map(r => (r.value || {}).questionId).filter(Boolean))];
      const Q = new Map((await c.query(`SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id = ANY($1::uuid[])`, [qids])).rows.map(r => [r.id, r]));

      // Filtrar segmentos LOST (ninguna pregunta guardada en ±5min → test entero perdido)
      const lost = [];
      for (const s of segs) {
        if (!s.answers.length) continue;
        const lo = new Date(new Date(s.t0).getTime() - MARGIN).toISOString();
        const hi = new Date(new Date(s.t1).getTime() + MARGIN).toISOString();
        const sqids = s.answers.map(a => a.qid).filter(Boolean);
        const ex = await c.query(`SELECT count(*)::int n FROM test_questions WHERE user_id=$1 AND created_at BETWEEN $2 AND $3 AND question_id = ANY($4::uuid[])`, [U, lo, hi, sqids]);
        if (ex.rows[0].n === 0) lost.push(s);
      }

      const streakBefore = (await c.query('SELECT calculate_user_streak($1) v', [U])).rows[0].v;
      let uTests = 0, uAns = 0, uOk = 0;
      if (MODE !== 'dry') await c.query('BEGIN');
      for (const s of lost) {
        const temaM = /\/tema\/(\d+)/.exec(s.url || ''); const tema = temaM ? parseInt(temaM[1]) : null;
        const rows = []; let ok = 0;
        s.answers.forEach((a, i) => { const q = Q.get(a.qid); if (!q) return; const correct = a.ans === q.correct_option; if (correct) ok++; rows.push({ a, q, correct, order: i + 1 }); });
        if (!rows.length) continue;
        uTests++; uAns += rows.length; uOk += ok;
        if (MODE !== 'dry') {
          const tid = (await c.query(
            `INSERT INTO tests (user_id, title, test_type, total_questions, is_completed, score, started_at, completed_at, created_at, tema_number, test_number, test_url, detailed_analytics)
             VALUES ($1,$2,'practice',$3,true,$4,$5,$6,$6,$7,99,$8,$9) RETURNING id`,
            [U, `Test recuperado${tema ? ' - Tema ' + tema : ''}`, rows.length, ok, s.t0, s.t1, tema, s.url, JSON.stringify({ recovered: true, originalUrl: s.url, recoveredAt, sweep: 'c1-flip-masked' })])).rows[0].id;
          for (const r of rows) {
            const opts = [r.q.option_a, r.q.option_b, r.q.option_c, r.q.option_d];
            await c.query(
              `INSERT INTO test_questions (test_id, question_id, question_order, question_text, user_answer, correct_answer, is_correct, was_blank, user_id, tema_number, time_spent_seconds, created_at, updated_at, full_question_context)
               VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10,$11,$11,$12)`,
              [tid, r.a.qid, r.order, r.q.question_text, LET[r.a.ans] ?? '?', LET[r.q.correct_option], r.correct, U, tema, Math.round((r.a.tdec || 0) / 1000), r.a.ts, JSON.stringify({ options: opts, recovered: true })]);
          }
        }
      }
      let streakAfter = streakBefore;
      if (MODE !== 'dry') streakAfter = (await c.query('SELECT calculate_user_streak($1) v', [U])).rows[0].v;
      if (MODE === 'commit') await c.query('COMMIT');
      else if (MODE === 'simulate') await c.query('ROLLBACK');
      gTests += uTests; gAns += uAns; gOk += uOk; if (uTests) gUsers++;
      console.log(`  ${short} → ${uTests} tests, ${uAns} resp (✓${uOk})  racha ${streakBefore}→${streakAfter}`);
    } catch (e) { if (MODE !== 'dry') await c.query('ROLLBACK').catch(() => {}); console.error('  ERR', short, e.message.slice(0, 90)); }
    finally { c.release(); }
  }
  console.log(`\n=== ${MODE.toUpperCase()} TOTAL: ${gUsers} usuarios, ${gTests} tests, ${gAns} resp (✓${gOk}) ===`);
  if (MODE === 'simulate') console.log('(ROLLBACK — prod intacto)');
  await pool.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
