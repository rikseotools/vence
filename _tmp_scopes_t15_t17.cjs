require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const T15 = 'd29072af-c088-4f55-9684-ad65ac28b65c';
const T16 = 'e3fb3cb2-8c07-4d93-9830-976a1802a20f';
const T17 = '33820d1d-d2d4-4074-ae7f-8f98d292004d';

const scopes = {
  T15: {
    topic_id: T15,
    label: 'T15 Informática básica',
    laws: [
      { short_name: 'Informática Básica', arts: ['1','2','3','4','5'] },
      { short_name: 'Redes LAN', arts: ['1','2','3'] },
      { short_name: 'Almacenamiento Datos', arts: ['1','2','3'] },
    ],
  },
  T16: {
    topic_id: T16,
    label: 'T16 Sistemas operativos',
    laws: [
      { short_name: 'Windows 10', arts: ['1','2','3','4'] },
      { short_name: 'Explorador Windows 10', arts: ['1','2','3','4'] },
    ],
    remove_laws: ['Windows 11', 'Explorador Windows 11'],
  },
  T17: {
    topic_id: T17,
    label: 'T17 Sistemas ofimáticos',
    laws: [
      { short_name: 'LibreOffice Writer', arts: ['1','2','3','4','5','6','7','8'] },
      { short_name: 'LibreOffice Calc', arts: ['1','2','3','4','5','6','7'] },
      { short_name: 'LibreOffice Impress', arts: ['1','2','3','4','5','6'] },
      { short_name: 'Correo electrónico', arts: ['1','2','3','4'] },
      { short_name: 'Intranet', arts: ['1','2'] },
    ],
  },
};

(async () => {
  for (const key of ['T15', 'T16', 'T17']) {
    const sc = scopes[key];
    console.log('\n=== ' + sc.label + ' ===');

    // Remove old laws
    if (sc.remove_laws) {
      for (const rn of sc.remove_laws) {
        const { data: law } = await s.from('laws').select('id').eq('short_name', rn).maybeSingle();
        if (!law) continue;
        const { error } = await s.from('topic_scope').delete().eq('topic_id', sc.topic_id).eq('law_id', law.id);
        if (error) { console.error('  ❌ remove', rn, error.message); continue; }
        console.log('  🗑  eliminado', rn);
      }
    }

    // Apply new/updated laws
    for (const l of sc.laws) {
      const { data: law } = await s.from('laws').select('id').eq('short_name', l.short_name).single();
      const { data: existing } = await s.from('topic_scope').select('id').eq('topic_id', sc.topic_id).eq('law_id', law.id).maybeSingle();
      if (existing) {
        const { error } = await s.from('topic_scope').update({ article_numbers: l.arts }).eq('id', existing.id);
        if (error) { console.error('  ❌ update', l.short_name, error.message); continue; }
        console.log('  🔄 actualizado', l.short_name, '→', l.arts.length, 'arts');
      } else {
        const { error } = await s.from('topic_scope').insert({ topic_id: sc.topic_id, law_id: law.id, article_numbers: l.arts });
        if (error) { console.error('  ❌ insert', l.short_name, error.message); continue; }
        console.log('  ➕ añadido', l.short_name, '→', l.arts.length, 'arts');
      }
    }

    // Cobertura resultante
    const { data: scopeRows } = await s.from('topic_scope').select('article_numbers, laws(id, short_name)').eq('topic_id', sc.topic_id);
    let total = 0;
    for (const r of scopeRows) {
      const { data: arts } = await s.from('articles').select('id').eq('law_id', r.laws.id).in('article_number', r.article_numbers);
      const artIds = arts.map(a => a.id);
      const { count } = await s.from('questions').select('id', { count: 'exact', head: true }).in('primary_article_id', artIds).eq('is_active', true);
      total += count || 0;
      console.log('     ' + r.laws.short_name + ': ' + (count || 0) + ' preguntas activas');
    }
    console.log('  📊 TOTAL preguntas activas ' + key + ':', total);
  }
})();
