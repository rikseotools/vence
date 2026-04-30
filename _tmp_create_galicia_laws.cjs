require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const laws = [
  {
    name: 'Ley 7/2014, de 26 de septiembre, de archivos y documentos de Galicia',
    short_name: 'Ley 7/2014 Galicia',
    description: 'Archivos y documentos de Galicia',
    year: 2014,
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-10825',
    boe_consolidation_url: 'https://www.boe.es/buscar/pdf/2014/BOE-A-2014-10825-consolidado.pdf',
    boe_id: 'BOE-A-2014-10825',
    slug: 'ley-7-2014-archivos-galicia',
    articles_file: '_tmp_ley_7_2014_galicia_articles.json',
  },
  {
    name: 'Ley 4/2019, de 17 de julio, de administración digital de Galicia',
    short_name: 'Ley 4/2019 Galicia',
    description: 'Administración digital de Galicia',
    year: 2019,
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2019-13518',
    boe_consolidation_url: 'https://www.boe.es/buscar/pdf/2019/BOE-A-2019-13518-consolidado.pdf',
    boe_id: 'BOE-A-2019-13518',
    slug: 'ley-4-2019-admin-digital-galicia',
    articles_file: '_tmp_ley_4_2019_galicia_articles.json',
  },
];

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

(async () => {
  for (const law of laws) {
    console.log('\n=== Procesando ' + law.short_name + ' ===');

    // Check if law exists
    const { data: existing } = await s.from('laws').select('id').eq('short_name', law.short_name).maybeSingle();
    let lawId;
    if (existing) {
      lawId = existing.id;
      console.log('  Ya existe:', lawId);
    } else {
      const { data: newLaw, error } = await s.from('laws').insert({
        name: law.name,
        short_name: law.short_name,
        description: law.description,
        year: law.year,
        type: 'law',
        scope: 'national',
        is_active: true,
        boe_url: law.boe_url,
        boe_consolidation_url: law.boe_consolidation_url,
        boe_id: law.boe_id,
        slug: law.slug,
        is_virtual: false,
        verification_status: 'pendiente',
        current_version: '1.0',
      }).select('id').single();
      if (error) { console.error('  ❌ INSERT law:', error.message); process.exit(1); }
      lawId = newLaw.id;
      console.log('  ✅ Insertada:', lawId);
    }

    // Load articles
    const arts = JSON.parse(fs.readFileSync(law.articles_file));
    console.log('  Artículos a insertar:', arts.length);

    // Check existing articles
    const { data: existingArts } = await s.from('articles').select('article_number').eq('law_id', lawId);
    const existingSet = new Set((existingArts || []).map(a => a.article_number));

    const toInsert = [];
    for (const a of arts) {
      if (existingSet.has(a.article_number)) continue;
      toInsert.push({
        law_id: lawId,
        article_number: a.article_number,
        title: a.title || null,
        content: a.content,
        is_active: true,
        content_hash: hash(a.content),
        is_verified: true,
        verification_date: new Date().toISOString().slice(0, 10),
        last_modification_date: new Date().toISOString().slice(0, 10),
      });
    }
    console.log('  Nuevos a insertar (no duplicados):', toInsert.length);

    if (toInsert.length === 0) { console.log('  Nada nuevo'); continue; }

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      const { data, error } = await s.from('articles').insert(chunk).select('id');
      if (error) { console.error('  ❌ chunk error:', error.message); continue; }
      inserted += data.length;
    }
    console.log('  ✅ Artículos insertados:', inserted, '/', toInsert.length);
  }

  // Final verification
  console.log('\n=== Verificación final ===');
  for (const law of laws) {
    const { data: lawRow } = await s.from('laws').select('id').eq('short_name', law.short_name).single();
    const { count } = await s.from('articles').select('id', { count: 'exact', head: true }).eq('law_id', lawRow.id);
    console.log(law.short_name, '→', count, 'artículos en BD');
  }
})();
