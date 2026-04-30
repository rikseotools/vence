// Step 3: map each unique question to a LO 1/1981 article
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAW_ID = null; // will lookup

function extractArticleFromText(text) {
  if (!text) return null;
  // Patterns: "artículo 5", "art. 14", "art 10.2", "artículos 10 y 11" → prefer first
  const patterns = [
    /art[íi]culos?\s+(\d+)/i,
    /^art\.?\s+(\d+)/i,
    /\bart\.\s*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

(async () => {
  const { data: law } = await supabase.from('laws').select('id, short_name').eq('short_name', 'LO 1/1981').single();
  if (!law) { console.error('Ley LO 1/1981 no encontrada'); process.exit(1); }
  console.log('Ley:', law.short_name, law.id);

  const { data: arts } = await supabase.from('articles')
    .select('id, article_number')
    .eq('law_id', law.id);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));
  console.log('Artículos en BD:', arts.length);
  console.log('Disponibles:', arts.map(a => a.article_number).sort().join(', '));

  const news = JSON.parse(fs.readFileSync('t2_galicia_step2_new.json', 'utf8'));
  console.log('\nProcesando', news.length, 'preguntas nuevas...\n');

  const mapped = [];
  const unmapped = [];
  const missingArts = new Set();

  for (const q of news) {
    // Priority: articleHint > extract from explanation > extract from question
    let art = null;
    if (q.articleHint) art = extractArticleFromText(q.articleHint);
    if (!art && q.explanation) art = extractArticleFromText(q.explanation);
    if (!art) art = extractArticleFromText(q.cleaned);

    if (!art) {
      unmapped.push(q);
      continue;
    }

    if (!artMap.has(art)) {
      missingArts.add(art);
      unmapped.push({ ...q, _missingArt: art });
      continue;
    }

    mapped.push({
      ...q,
      primary_article_id: artMap.get(art),
      article_number: art,
    });
  }

  console.log('Mapeadas:', mapped.length);
  console.log('Sin mapear:', unmapped.length);
  if (missingArts.size > 0) {
    console.log('\nArtículos mencionados pero NO en BD:', [...missingArts].sort().join(', '));
  }

  // Show unmapped for manual review
  if (unmapped.length > 0) {
    console.log('\n=== Preguntas sin artículo mapeable ===');
    unmapped.slice(0, 10).forEach((q, i) => {
      console.log(`[${i+1}] ${q.cleaned.slice(0, 100)}`);
      if (q._missingArt) console.log(`    art mencionado: ${q._missingArt} (no existe en BD)`);
      if (q.articleHint) console.log(`    articleHint: ${q.articleHint}`);
      if (q.explanation) console.log(`    explanation: ${q.explanation.slice(0, 100)}`);
    });
  }

  // Distribution by article
  const byArt = {};
  mapped.forEach(q => { byArt[q.article_number] = (byArt[q.article_number] || 0) + 1; });
  console.log('\nDistribución por artículo:');
  Object.entries(byArt).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([a, c]) => console.log(`  art ${a}: ${c} preguntas`));

  fs.writeFileSync('t2_galicia_step3_mapped.json', JSON.stringify(mapped, null, 2));
  fs.writeFileSync('t2_galicia_step3_unmapped.json', JSON.stringify(unmapped, null, 2));
  console.log('\nEscritos: t2_galicia_step3_mapped.json, t2_galicia_step3_unmapped.json');
})();
