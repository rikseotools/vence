require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'LO 1/1981').single();
  const { data: preambulo } = await supabase.from('articles').select('id').eq('law_id', law.id).eq('article_number', 'preámbulo').single();
  console.log('Preámbulo art id:', preambulo.id);

  const unmapped = JSON.parse(fs.readFileSync('t2_galicia_step3_unmapped.json', 'utf8'));
  const mapped = JSON.parse(fs.readFileSync('t2_galicia_step3_mapped.json', 'utf8'));

  const discarded = [];
  const recovered = [];
  for (const q of unmapped) {
    const txt = (q.cleaned || '').toLowerCase();
    // Discard: CE Title VIII question
    if (txt.includes('título viii de la constitución española') || q._missingArt === '158') {
      discarded.push(q);
      continue;
    }
    // Map structural questions to preámbulo
    if (txt.includes('qué fecha') || txt.includes('capítulos') || txt.includes('título') || txt.includes('estructura')) {
      recovered.push({
        ...q,
        primary_article_id: preambulo.id,
        article_number: 'preámbulo',
      });
      continue;
    }
    discarded.push(q);
  }

  console.log('Recuperadas (→ preámbulo):', recovered.length);
  console.log('Descartadas:', discarded.length);
  discarded.forEach(q => console.log('  ×', q.cleaned.slice(0, 100)));

  const finalMapped = [...mapped, ...recovered];
  console.log('\nTotal final a importar:', finalMapped.length);

  fs.writeFileSync('t2_galicia_step3_final_mapped.json', JSON.stringify(finalMapped, null, 2));
})();
