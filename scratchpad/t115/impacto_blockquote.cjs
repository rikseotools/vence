// ¿A cuántos artículos afectaba el fallo de `bloqueVigente` (redacción derogada envuelta en
// <blockquote class="noDesde...">)? Se mide sobre los artículos de MÁS EXPOSICIÓN: los que más
// preguntas sirven. Solo lectura: no escribe nada.
const { Client } = require('pg');
const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id';
const { mapaBloquesPorArticulo, bloqueDeArticulo } = require('/home/manuel/Documentos/github/vence/lib/laws/boeBloqueVigente');
const N = parseInt(process.argv[2] || '40', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT l.short_name ley, l.boe_url, a.article_number art,
           count(q.id) preguntas
    FROM articles a
    JOIN laws l ON l.id = a.law_id
    JOIN questions q ON q.primary_article_id = a.id AND q.is_active
    WHERE a.is_active AND l.boe_url LIKE '%BOE-A-%' AND a.article_number ~ '^[0-9]+$'
    GROUP BY 1,2,3
    ORDER BY random()
    LIMIT $1`, [N]);
  await c.end();

  const porLey = new Map();
  let conRedaccionVieja = 0, revisados = 0, fallos = 0, expuestas = 0;
  const afectados = [];
  for (const f of r.rows) {
    const bid = (f.boe_url.match(/BOE-A-[\d-]+/) || [])[0];
    if (!bid) continue;
    if (!porLey.has(bid)) {
      try {
        const ix = await fetch(`${API}/${bid}/texto/indice`, { headers:{Accept:'application/xml'} });
        porLey.set(bid, ix.ok ? mapaBloquesPorArticulo(await ix.text()) : {});
      } catch { porLey.set(bid, {}) }
      await sleep(200);
    }
    const bloque = bloqueDeArticulo(porLey.get(bid), String(f.art)) || `a${f.art}`;
    try {
      const rr = await fetch(`${API}/${bid}/texto/bloque/${bloque}`, { headers:{Accept:'application/xml'} });
      if (!rr.ok) { fallos++; continue }
      const xml = await rr.text();
      revisados++;
      if (/<blockquote\s+[^>]*class="[^"]*noDesde/i.test(xml)) {
        conRedaccionVieja++; expuestas += Number(f.preguntas);
        afectados.push(`${f.ley} art.${f.art} (${f.preguntas} preguntas)`);
      }
    } catch { fallos++ }
    await sleep(150);
  }
  console.log(`\nartículos revisados: ${revisados} (muestra ALEATORIA de ${N}) · fallos de red: ${fallos}`);
  console.log(`con redacción derogada envuelta → el código VIEJO los leía mal: ${conRedaccionVieja}`);
  console.log(`preguntas activas que cuelgan de ellos: ${expuestas}`);
  if (afectados.length) console.log('\n' + afectados.map(a => '  · ' + a).join('\n'));
})();
