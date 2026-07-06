// Mueve las 93 atajos-solo_escritorio (regla autoritativa MS) a las leyes escritorio.
// Crea artículos espejo que falten (esc Word art3, esc Excel art150) + amplía scopes escritorio
// (article_numbers = los de común) + verificación RIGUROSA set-a-set. Aragón -93, resto intacto.
// --simulate | --commit
const { Pool } = require('pg');
const fs = require('fs');
const MODE = process.argv.includes('--commit') ? 'commit' : 'simulate';
const url = fs.readFileSync('.env.development.local', 'utf8').match(/DATABASE_URL=(\S+)/)[1].replace('?sslmode=require', '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const DIR = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/25e81766-396d-41b1-a1f6-8312c9593ebe/scratchpad/';
const ARAGON = 'auxiliar_administrativo_aragon';

(async () => {
  const c = await pool.connect();
  try {
    const ids = JSON.parse(fs.readFileSync(DIR + 'atajos2_solo_escritorio.json', 'utf8'));
    const W = (await c.query("SELECT id FROM laws WHERE id::text LIKE '86f671a9%'")).rows[0].id;
    const E = (await c.query("SELECT id FROM laws WHERE id::text LIKE 'c7475712%'")).rows[0].id;
    const WESC = (await c.query("SELECT id FROM laws WHERE slug='word-365-solo-escritorio'")).rows[0].id;
    const EESC = (await c.query("SELECT id FROM laws WHERE slug='excel-365-solo-escritorio'")).rows[0].id;
    const WWEB = (await c.query("SELECT id FROM laws WHERE slug='word-365-solo-web'")).rows[0].id;
    const EWEB = (await c.query("SELECT id FROM laws WHERE slug='excel-365-solo-web'")).rows[0].id;
    const ALL = [W, E, WESC, EESC, WWEB, EWEB];
    const appOf = id => ([W, WESC, WWEB].includes(id) ? 'W' : 'E');

    // set visible por opo (article_numbers OR full_title) sobre law set dado
    const setByOpo = async () => {
      const rows = (await c.query(`
        SELECT t.position_type opo, q.id FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id
        JOIN articles a ON a.law_id=ts.law_id AND ((ts.article_numbers IS NOT NULL AND a.article_number=ANY(ts.article_numbers)) OR ts.include_full_title=true)
        JOIN questions q ON q.primary_article_id=a.id AND q.is_active=true
        WHERE ts.law_id=ANY($1::uuid[])`, [ALL])).rows;
      const m = {}; for (const r of rows) (m[r.opo] = m[r.opo] || new Set()).add(r.id); return m;
    };

    const before = await setByOpo();
    await c.query('BEGIN');

    // 1. artículos espejo que falten en escritorio (Word art3, Excel art150; el resto ya existe de rondas previas)
    const need = { W: new Set(), E: new Set() };
    for (const r of (await c.query(`SELECT l.short_name app, a.article_number num FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id WHERE q.id=ANY($1::uuid[])`, [ids])).rows) {
      need[r.app.includes('Word') ? 'W' : 'E'].add(String(r.num));
    }
    const artId = {}; // `${app}:${num}` -> escritorio article id
    for (const [app, esc, cl] of [['W', WESC, W], ['E', EESC, E]]) {
      for (const num of need[app]) {
        let a = (await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [esc, num])).rows[0];
        if (!a) {
          const src = (await c.query('SELECT title, content FROM articles WHERE law_id=$1 AND article_number=$2', [cl, num])).rows[0] || {};
          a = (await c.query('INSERT INTO articles (law_id, article_number, title, content) VALUES ($1,$2,$3,$4) RETURNING id', [esc, num, src.title || null, src.content || null])).rows[0];
        }
        artId[`${app}:${num}`] = a.id;
      }
    }

    // 2. mover las 93
    let moved = 0;
    for (const qid of ids) {
      const cur = (await c.query(`SELECT l.short_name app, a.article_number num FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id WHERE q.id=$1`, [qid])).rows[0];
      if (!cur) continue;
      const app = cur.app.includes('Word') ? 'W' : 'E';
      const dst = artId[`${app}:${cur.num}`]; if (!dst) { console.log('sin destino', qid.slice(0, 8), app, cur.num); continue; }
      await c.query('UPDATE question_articles SET article_id=$1 WHERE question_id=$2 AND article_id IN (SELECT id FROM articles WHERE law_id=$3 AND article_number=$4)', [dst, qid, app === 'W' ? W : E, String(cur.num)]);
      await c.query('UPDATE questions SET primary_article_id=$1 WHERE id=$2', [dst, qid]);
      moved++;
    }

    // 3. ampliar scopes escritorio article_numbers (no Aragón) = article_numbers de su fila común homóloga
    //    (cubre cualquier artículo movido, presente y futuro). full_title ya cubre todo.
    for (const [cl, esc] of [[W, WESC], [E, EESC]]) {
      const escRows = (await c.query(`SELECT ts.id, ts.topic_id FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE ts.law_id=$1 AND ts.article_numbers IS NOT NULL AND t.position_type<>$2`, [esc, ARAGON])).rows;
      for (const er of escRows) {
        const comun = (await c.query('SELECT article_numbers FROM topic_scope WHERE topic_id=$1 AND law_id=$2 AND article_numbers IS NOT NULL', [er.topic_id, cl])).rows[0];
        if (comun) await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [comun.article_numbers, er.id]);
      }
    }

    const after = await setByOpo();

    // 4. verificación: Aragón = before - 93 ; resto igual
    const opos = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    let bad = 0;
    for (const opo of opos) {
      const b = before[opo] || new Set(), a = after[opo] || new Set();
      if (opo === ARAGON) {
        const expected = new Set([...b].filter(x => !ids.includes(x)));
        const miss = [...expected].filter(x => !a.has(x)).length, extra = [...a].filter(x => !expected.has(x)).length;
        console.log(`  Aragón: ${b.size} → esperado ${expected.size} actual ${a.size} ${miss === 0 && extra === 0 ? '✅ (-' + (b.size - a.size) + ')' : '❌ miss=' + miss + ' extra=' + extra}`);
        if (miss || extra) bad++;
      } else {
        const miss = [...b].filter(x => !a.has(x)).length, extra = [...a].filter(x => !b.has(x)).length;
        if (miss || extra) { bad++; console.log(`  ❌ ${opo}: ${b.size}→${a.size} (faltan ${miss}, sobran ${extra})`); }
      }
    }
    console.log(`\nmovidas: ${moved}/93 | opos no-Aragón con mismatch (deben ser 0): ${bad - (bad && opos.includes(ARAGON) && (() => { const b = before[ARAGON] || new Set(), a = after[ARAGON] || new Set(); const expected = new Set([...b].filter(x => !ids.includes(x))); return [...expected].filter(x => !a.has(x)).length || [...a].filter(x => !expected.has(x)).length; })() ? 1 : 0)}`);
    const nonAr = opos.filter(o => o !== ARAGON).filter(o => { const b = before[o] || new Set(), a = after[o] || new Set(); return [...b].filter(x => !a.has(x)).length || [...a].filter(x => !b.has(x)).length; }).length;
    console.log(`(no-Aragón mismatch directo: ${nonAr})`);

    if (MODE === 'commit' && nonAr === 0) { await c.query('COMMIT'); console.log('\n✅ COMMIT hecho'); }
    else if (MODE === 'commit') { await c.query('ROLLBACK'); console.log('\n❌ ROLLBACK — mismatches'); }
    else { await c.query('ROLLBACK'); console.log('\n🧪 ROLLBACK — prod intacto'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERR', e.message); }
  finally { c.release(); await pool.end(); }
})();
