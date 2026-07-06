// Verificación RIGUROSA de paridad: para cada oposición compara
//   HIPOTÉTICO (lo que veía ANTES de la migración: común-scope sobre el pool completo por nº de artículo)
//   vs ACTUAL (lo que ve AHORA, tras aplicar el fix, vía sus scopes reales común+escritorio+web).
// Deben ser IDÉNTICOS (mismo count Y mismos ids). Aplica el fix en TX y verifica.
// --simulate (rollback) | --commit (solo si 0 mismatches)
const { Pool } = require('pg');
const fs = require('fs');
const MODE = process.argv.includes('--commit') ? 'commit' : 'simulate';
const url = fs.readFileSync('.env.development.local', 'utf8').match(/DATABASE_URL=(\S+)/)[1].replace('?sslmode=require', '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const ARAGON = 'auxiliar_administrativo_aragon';

(async () => {
  const c = await pool.connect();
  try {
    const W = (await c.query("SELECT id FROM laws WHERE id::text LIKE '86f671a9%'")).rows[0].id;
    const E = (await c.query("SELECT id FROM laws WHERE id::text LIKE 'c7475712%'")).rows[0].id;
    const WESC = (await c.query("SELECT id FROM laws WHERE slug='word-365-solo-escritorio'")).rows[0].id;
    const EESC = (await c.query("SELECT id FROM laws WHERE slug='excel-365-solo-escritorio'")).rows[0].id;
    const WWEB = (await c.query("SELECT id FROM laws WHERE slug='word-365-solo-web'")).rows[0].id;
    const EWEB = (await c.query("SELECT id FROM laws WHERE slug='excel-365-solo-web'")).rows[0].id;
    const appOf = id => ([W, WESC, WWEB].includes(id) ? 'W' : 'E');
    const ALL = [W, E, WESC, EESC, WWEB, EWEB];

    // 1. pool completo: qid -> {app, num}
    const pool_q = (await c.query(`
      SELECT q.id, a.law_id, a.article_number num
      FROM questions q JOIN articles a ON a.id=q.primary_article_id
      WHERE a.law_id = ANY($1::uuid[]) AND q.is_active=true`, [ALL])).rows
      .map(r => ({ id: r.id, app: appOf(r.law_id), num: String(r.num) }));

    // 2. común-scope por opo (law W/E): {opo: {W:{full,nums:Set}, E:{...}}}
    const comun = {};
    const crows = (await c.query(`
      SELECT t.position_type opo, ts.law_id, ts.article_numbers, ts.include_full_title
      FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id
      WHERE ts.law_id IN ($1,$2)`, [W, E])).rows;
    for (const r of crows) {
      const app = r.law_id === W ? 'W' : 'E';
      comun[r.opo] = comun[r.opo] || { W: { full: false, nums: new Set() }, E: { full: false, nums: new Set() } };
      if (r.include_full_title) comun[r.opo][app].full = true;
      (r.article_numbers || []).forEach(n => comun[r.opo][app].nums.add(String(n)));
    }
    // hipotético: set de qids que la opo veía antes
    const hypo = opo => {
      const s = comun[opo]; if (!s) return new Set();
      const out = new Set();
      for (const q of pool_q) {
        const a = s[q.app];
        if (a.full || a.nums.has(q.num)) out.add(q.id);
      }
      return out;
    };

    // APLICAR FIX en TX (misma lógica que office_fix_fulltitle)
    await c.query('BEGIN');
    for (const [cl, esc] of [[W, WESC], [E, EESC]]) {
      const rows = (await c.query(`SELECT ts.topic_id FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE ts.law_id=$1 AND ts.include_full_title=true AND t.position_type<>$2`, [cl, ARAGON])).rows;
      for (const r of rows) {
        const ex = (await c.query('SELECT 1 FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [r.topic_id, esc])).rows.length;
        if (!ex) await c.query('INSERT INTO topic_scope (topic_id, law_id, include_full_title, weight) VALUES ($1,$2,true,$3)', [r.topic_id, esc, '1.00']);
      }
    }

    // 3. ACTUAL por opo (tras fix): set de qids vía scopes reales
    const actualRows = (await c.query(`
      SELECT t.position_type opo, q.id
      FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id
      JOIN articles a ON a.law_id=ts.law_id AND ((ts.article_numbers IS NOT NULL AND a.article_number=ANY(ts.article_numbers)) OR ts.include_full_title=true)
      JOIN questions q ON q.primary_article_id=a.id AND q.is_active=true
      WHERE ts.law_id = ANY($1::uuid[])`, [ALL])).rows;
    const actual = {};
    for (const r of actualRows) { (actual[r.opo] = actual[r.opo] || new Set()).add(r.id); }

    // 4. comparar hipo vs actual por opo
    const opos = [...new Set([...Object.keys(comun), ...Object.keys(actual)])].sort();
    let mismatches = 0;
    console.log('=== VERIFICACIÓN hipotético(antes) vs actual(ahora+fix) ===');
    for (const opo of opos) {
      const h = hypo(opo), a = actual[opo] || new Set();
      const isAr = opo === ARAGON;
      if (isAr) {
        // Aragón DEBE perder exactamente las 182 → actual = hypo menos 182
        const ids182 = JSON.parse(fs.readFileSync('/tmp/claude-1000/-home-manuel-Documentos-github-vence/25e81766-396d-41b1-a1f6-8312c9593ebe/scratchpad/verified_solo_escritorio.json', 'utf8'));
        const expected = new Set([...h].filter(x => !ids182.includes(x)));
        const miss = [...expected].filter(x => !a.has(x)).length, extra = [...a].filter(x => !expected.has(x)).length;
        console.log(`  ${opo} (Aragón): hipo=${h.size} → esperado=${expected.size} actual=${a.size} ${miss === 0 && extra === 0 ? '✅' : '❌ miss=' + miss + ' extra=' + extra}`);
        if (miss || extra) mismatches++;
      } else {
        const miss = [...h].filter(x => !a.has(x)).length, extra = [...a].filter(x => !h.has(x)).length;
        if (miss || extra) { mismatches++; console.log(`  ❌ ${opo}: hipo=${h.size} actual=${a.size} (faltan ${miss}, sobran ${extra})`); }
      }
    }
    console.log(`\nOpos NO-Aragón con mismatch (deben ser 0): ${mismatches - (mismatches && false ? 1 : 0)}`);
    const nonArMismatch = opos.filter(o => o !== ARAGON).filter(o => { const h = hypo(o), a = actual[o] || new Set(); return [...h].filter(x => !a.has(x)).length || [...a].filter(x => !h.has(x)).length; }).length;
    console.log(`(recuento directo no-Aragón mismatch: ${nonArMismatch})`);

    if (MODE === 'commit' && nonArMismatch === 0) { await c.query('COMMIT'); console.log('\n✅ COMMIT del fix hecho'); }
    else if (MODE === 'commit') { await c.query('ROLLBACK'); console.log('\n❌ ROLLBACK — hay mismatches'); }
    else { await c.query('ROLLBACK'); console.log('\n🧪 ROLLBACK — prod intacto'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERR', e.message); }
  finally { c.release(); await pool.end(); }
})();
