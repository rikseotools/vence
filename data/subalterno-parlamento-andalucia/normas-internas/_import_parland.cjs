require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const SP = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/a7c63fbe-2e0f-4671-8436-0532c02684e2/scratchpad';
const { luto, egripa } = JSON.parse(fs.readFileSync(`${SP}/parsed.json`, 'utf8'));

const NORMS = [
  {
    key: 'luto',
    arts: luto,
    topic: 6,
    name: 'Reglamento del Parlamento de Andalucía sobre distinciones, honores y señales de luto',
    short_name: 'Reglamento Distinciones y Luto PA',
    slug: 'reglamento-distinciones-honores-luto-parlamento-andalucia',
    url: 'https://www.parlamentodeandalucia.es/documents/20121/397932/Reglamento+del+Parlamento+de+Andaluc%C3%ADa+sobre+distinciones%2C+honores+y+se%C3%B1ales+de+luto.pdf/ddb36893-6ec1-8dec-7594-4220ced39606?t=1781520547330',
    source: 'Acuerdo de la Mesa de la Diputación Permanente del Parlamento de Andalucía, de 26 de marzo de 2026. BOPA núm. 899, de 1 de abril de 2026. Expediente 12-26/AEA-000070.',
    note: 'Importada ÍNTEGRA desde el PDF oficial del Servicio de Publicaciones del Parlamento de Andalucía: 9 artículos + 2 disposiciones adicionales + disposición final. Texto verbatim.',
  },
  {
    key: 'egripa',
    arts: egripa,
    topic: 8,
    name: 'Estatuto de Gobierno y Régimen Interior del Parlamento de Andalucía',
    short_name: 'EGRIPA',
    slug: 'estatuto-gobierno-regimen-interior-parlamento-andalucia',
    url: 'https://www.parlamentodeandalucia.es/documents/20121/397932/Egripa.pdf/0639a1c8-20d1-f319-ac3a-fbc8e1879420?t=1781243243177',
    source: 'Acuerdo de la Mesa del Parlamento de Andalucía, de 25 de octubre de 2023. BOPA núm. 302, de 31 de octubre de 2023. Expediente 12-23/AEA-000154. En vigor desde 1 de noviembre de 2023.',
    note: 'Importada ÍNTEGRA desde el PDF oficial del Servicio de Publicaciones del Parlamento de Andalucía: 34 artículos + 2 disposiciones transitorias + disposición derogatoria + disposición final. Texto verbatim. No se importa la exposición de motivos ni el índice sistemático.',
  },
];

(async () => {
  const out = {};
  for (const n of NORMS) {
    let law = (await sql`SELECT id FROM laws WHERE slug=${n.slug} OR name=${n.name}`)[0];
    if (law) {
      console.log(`[${n.key}] ya existe: ${law.id}`);
    } else {
      law = (await sql`
        INSERT INTO laws (name, short_name, type, slug, scope, is_virtual, is_active, description)
        VALUES (${n.name}, ${n.short_name}, 'regulation', ${n.slug}, 'regional', false, true, ${n.source})
        RETURNING id`)[0];
      console.log(`[${n.key}] creada: ${law.id}`);
    }

    let ins = 0;
    for (const a of n.arts) {
      const ex = (await sql`SELECT id FROM articles WHERE law_id=${law.id} AND article_number=${a.article_number}`)[0];
      if (ex) continue;
      await sql`INSERT INTO articles (law_id, article_number, title, content, is_active)
                VALUES (${law.id}, ${a.article_number}, ${a.title}, ${a.content}, true)`;
      ins++;
    }

    await sql`UPDATE laws SET boe_url=${n.url},
      last_verification_summary=${JSON.stringify({
        deliberate_subset: true,
        is_ok: true,
        source: n.source,
        note: n.note,
        verified_at: '2026-07-20T00:00:00.000Z',
      })}::jsonb WHERE id=${law.id}`;

    const t = (await sql`SELECT id FROM topics WHERE position_type='subalterno_parlamento_andalucia' AND topic_number=${n.topic}`)[0];
    await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${t.id}, ${law.id}, NULL) ON CONFLICT DO NOTHING`;

    const total = (await sql`SELECT count(*)::int c FROM articles WHERE law_id=${law.id}`)[0].c;
    out[n.key] = { law_id: law.id, inserted: ins, total_articles: total, topic: n.topic, topic_id: t.id };
    console.log(`[${n.key}] artículos insertados=${ins} total=${total} → tema ${n.topic}`);
  }
  fs.writeFileSync(`${SP}/imported.json`, JSON.stringify(out, null, 1));
  await sql.end();
})();
