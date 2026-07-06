// Fase 1 Aragón: separar contenido Office solo-escritorio a leyes nuevas.
// - Crea leyes "· solo Escritorio" y "· solo Web" (virtuales).
// - Mueve las 182 verificadas (primary_article_id → art espejo en escritorio).
// - Añade scope escritorio a las 39 opos de escritorio (paridad).
// - Aragón NO se toca (pierde las 182 al salir de común).
// Verificación de paridad por oposición DENTRO de la TX.
// Modos: dry | --simulate (BEGIN..ROLLBACK) | --commit
const { Pool } = require('pg');
const fs = require('fs');
const MODE = process.argv.includes('--commit') ? 'commit' : process.argv.includes('--simulate') ? 'simulate' : 'dry';
const url = fs.readFileSync('.env.development.local', 'utf8').match(/DATABASE_URL=(\S+)/)[1].replace('?sslmode=require', '');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const DIR = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/25e81766-396d-41b1-a1f6-8312c9593ebe/scratchpad/';
const ARAGON = 'auxiliar_administrativo_aragon';

(async () => {
  const c = await pool.connect();
  try {
    const ids = JSON.parse(fs.readFileSync(DIR + 'verified_solo_escritorio.json', 'utf8'));
    const W = (await c.query("SELECT id FROM laws WHERE id::text LIKE '86f671a9%'")).rows[0].id;
    const E = (await c.query("SELECT id FROM laws WHERE id::text LIKE 'c7475712%'")).rows[0].id;
    const OFFICE = [W, E];

    // conteo directo de preguntas Office visibles por una oposición (mismo criterio que v2: primary_article→law+num en su scope)
    const countByOpo = async (lawIds) => {
      const r = await c.query(`
        SELECT t.position_type, count(DISTINCT q.id)::int n
        FROM topic_scope ts
        JOIN topics t ON t.id = ts.topic_id
        JOIN articles a ON a.law_id = ts.law_id AND a.article_number = ANY(ts.article_numbers)
        JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
        WHERE ts.law_id = ANY($1::uuid[])
        GROUP BY 1`, [lawIds]);
      const m = {}; r.rows.forEach(x => m[x.position_type] = x.n); return m;
    };

    const before = await countByOpo(OFFICE);

    if (MODE !== 'dry') await c.query('BEGIN');

    // STEP 1: crear 4 leyes virtuales
    const mkLaw = async (name, short, slug) => {
      if (MODE === 'dry') return '(dry)';
      return (await c.query(
        `INSERT INTO laws (name, short_name, type, scope, slug, is_virtual, is_active, verification_status, description)
         VALUES ($1,$2,'regulation','national',$3,true,true,'no_monitoreable',$4) RETURNING id`,
        [name, short, slug, 'Ley virtual: contenido exclusivo de la versión de ' + (slug.includes('web') ? 'Office para la Web' : 'escritorio') + '.'])).rows[0].id;
    };
    const W_ESC = await mkLaw('Procesadores de textos. Word 365 · solo Escritorio', 'Word 365 Escritorio', 'word-365-solo-escritorio');
    const E_ESC = await mkLaw('Hojas de cálculo. Excel 365 · solo Escritorio', 'Excel 365 Escritorio', 'excel-365-solo-escritorio');
    const W_WEB = await mkLaw('Procesadores de textos. Word 365 · solo Web', 'Word 365 Web', 'word-365-solo-web');
    const E_WEB = await mkLaw('Hojas de cálculo. Excel 365 · solo Web', 'Excel 365 Web', 'excel-365-solo-web');

    // STEP 2: artículos espejo en las leyes escritorio (mismos article_number, copia título/contenido de común)
    const artMap = {}; // key `${app}:${num}` -> new article id
    const mirror = async (srcLaw, dstLaw, nums, app) => {
      for (const n of nums) {
        const src = (await c.query('SELECT title, content FROM articles WHERE law_id=$1 AND article_number=$2', [srcLaw, String(n)])).rows[0] || {};
        if (MODE === 'dry') { artMap[`${app}:${n}`] = '(dry)'; continue; }
        const id = (await c.query(
          'INSERT INTO articles (law_id, article_number, title, content) VALUES ($1,$2,$3,$4) RETURNING id',
          [dstLaw, String(n), src.title || null, src.content || null])).rows[0].id;
        artMap[`${app}:${n}`] = id;
      }
    };
    await mirror(W, W_ESC, [1, 2, 4, 5, 6], 'W');
    await mirror(E, E_ESC, [30, 170, 180], 'E');

    // STEP 3: mover las 182 (primary_article_id → art espejo mismo número; y question_articles si hubiera)
    let moved = 0;
    if (MODE !== 'dry') {
      for (const qid of ids) {
        const cur = (await c.query(`
          SELECT q.id, l.short_name app, a.article_number num
          FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
          WHERE q.id=$1`, [qid])).rows[0];
        if (!cur) continue;
        const app = cur.app.includes('Word') ? 'W' : 'E';
        const dst = artMap[`${app}:${cur.num}`];
        if (!dst) { console.log('  ⚠️ sin destino para', qid.slice(0, 8), app, cur.num); continue; }
        await c.query('UPDATE questions SET primary_article_id=$1 WHERE id=$2', [dst, qid]);
        // question_articles (por si el path simple lo usa)
        const oldArt = (await c.query('SELECT primary_article_id FROM questions WHERE id=$1', [qid])); // ya actualizado; usar cur
        await c.query('UPDATE question_articles SET article_id=$1 WHERE question_id=$2 AND article_id IN (SELECT id FROM articles WHERE law_id=$3 AND article_number=$4)', [dst, qid, app === 'W' ? W : E, String(cur.num)]);
        moved++;
      }
    }

    // STEP 4: añadir scope escritorio a las 39 opos (todas menos Aragón) que scopean común W/E
    let scopeRows = 0;
    if (MODE !== 'dry') {
      const MW = [1, 2, 4, 5, 6].map(String), ME = [30, 170, 180].map(String);
      for (const [comun, esc, moved_arts] of [[W, W_ESC, MW], [E, E_ESC, ME]]) {
        const rows = (await c.query(`
          SELECT ts.id, ts.topic_id, ts.article_numbers, t.position_type
          FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id
          WHERE ts.law_id=$1 AND t.position_type <> $2`, [comun, ARAGON])).rows;
        for (const r of rows) {
          const inter = (r.article_numbers || []).filter(x => moved_arts.includes(String(x)));
          if (!inter.length) continue;
          await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,$4)',
            [r.topic_id, esc, inter, '1.00']);
          scopeRows++;
        }
      }
    }

    // STEP 4b: añadir leyes solo-Web al scope de Aragón (vacías por ahora; para contenido web futuro)
    if (MODE !== 'dry') {
      for (const [comun, web, moved_arts] of [[W, W_WEB, ['1','2','4','5','6']], [E, E_WEB, ['30','170','180']]]) {
        const rows = (await c.query(`SELECT ts.topic_id, ts.article_numbers FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE ts.law_id=$1 AND t.position_type=$2`, [comun, ARAGON])).rows;
        for (const r of rows) {
          await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,$4)', [r.topic_id, web, r.article_numbers, '1.00']);
        }
      }
    }

    // STEP 5: conteo AFTER (todas las leyes Office)
    const after = MODE === 'dry' ? before : await countByOpo([W, E, W_ESC, E_ESC, W_WEB, E_WEB]);

    // STEP 6: verificación de paridad
    console.log(`\n=== ${MODE.toUpperCase()} — movidas: ${moved}/182 | scope-rows añadidas: ${scopeRows} ===`);
    console.log('\n=== PARIDAD por oposición (before → after) ===');
    const allOpos = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    let fails = 0;
    for (const opo of allOpos) {
      const b = before[opo] || 0, a = after[opo] || 0, d = a - b;
      const isAragon = opo === ARAGON;
      let flag = '';
      if (MODE !== 'dry') {
        if (isAragon) flag = d < 0 ? `✅ baja ${d} (esperado)` : `⚠️ Aragón no bajó (${d})`;
        else flag = d === 0 ? '✅ igual' : `❌ CAMBIÓ ${d}`;
        if (!isAragon && d !== 0) fails++;
      }
      if (isAragon || (MODE !== 'dry' && d !== 0)) console.log(`  ${opo}: ${b} → ${a}  ${flag}`);
    }
    console.log(`\nOpos que CAMBIARON indebidamente (deben ser 0): ${fails}`);

    if (MODE === 'commit' && fails === 0) { await c.query('COMMIT'); console.log('\n✅ COMMIT hecho'); }
    else if (MODE === 'commit') { await c.query('ROLLBACK'); console.log('\n❌ ROLLBACK por fallo de paridad'); }
    else if (MODE === 'simulate') { await c.query('ROLLBACK'); console.log('\n🧪 ROLLBACK — prod intacto'); }
    else console.log('\n(dry: nada escrito)');
  } catch (e) { if (MODE !== 'dry') await c.query('ROLLBACK').catch(() => {}); console.error('ERR', e.message); }
  finally { c.release(); await pool.end(); }
})();
