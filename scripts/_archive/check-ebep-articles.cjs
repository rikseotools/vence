const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar la ley 5/2015 (EBEP)
  const { data: laws } = await supabase
    .from('laws')
    .select('id, name, short_name')
    .or('name.ilike.%EBEP%,name.ilike.%5/2015%,short_name.ilike.%EBEP%');

  console.log('Leyes encontradas:');
  laws?.forEach(l => console.log('  -', l.short_name || l.name, '(id:', l.id + ')'));

  const law = laws?.find(l => l.short_name === 'RDL 5/2015') || laws?.[0];
  if (!law) {
    console.log('No se encontró la ley');
    return;
  }
  console.log('');
  console.log('Usando:', law.short_name || law.name);
  console.log('');

  // Ver artículos
  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .order('article_number', { ascending: true });

  // Contar por tipo
  const numbered = articles.filter(a => /^\d+/.test(a.article_number));
  const disposiciones = articles.filter(a => !/^\d+/.test(a.article_number));

  console.log('Total artículos:', articles.length);
  console.log('Artículos numerados:', numbered.length);
  console.log('Disposiciones:', disposiciones.length);
  console.log('');

  // Mostrar todos los artículos numerados ordenados
  console.log('Artículos numerados (orden numérico):');
  const sortedNumbered = numbered.sort((a, b) => {
    const numA = parseInt(a.article_number.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.article_number.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  sortedNumbered.forEach(a => {
    const num = parseInt(a.article_number);
    if (num >= 95 || num === 1 || a.article_number.includes('bis')) {
      console.log('  Art. ' + a.article_number + ': ' + (a.title?.substring(0, 50) || 'Sin título'));
    }
  });

  // Mostrar artículos con 'bis' u otros especiales
  console.log('');
  console.log('Artículos especiales (bis, ter, etc):');
  numbered.filter(a => /bis|ter|quater/i.test(a.article_number)).forEach(a => {
    console.log('  Art. ' + a.article_number + ': ' + (a.title?.substring(0, 50) || 'Sin título'));
  });

  // Ver si hay artículo 149
  const art149 = articles.find(a => a.article_number === '149');
  if (art149) {
    console.log('');
    console.log('⚠️ ARTÍCULO 149 ENCONTRADO:');
    console.log('  Título:', art149.title);
  }

  // Verificar si hay huecos en la numeración
  console.log('');
  console.log('Verificando huecos en numeración...');
  const nums = numbered.map(a => parseInt(a.article_number)).sort((a, b) => a - b);
  for (let i = 1; i <= 101; i++) {
    if (!nums.includes(i)) {
      console.log('  ⚠️ Falta artículo:', i);
    }
  }

  // Ver artículos después del 101
  const after101 = nums.filter(n => n > 101);
  if (after101.length > 0) {
    console.log('');
    console.log('Artículos después del 101:', after101.join(', '));
  }

  // Contar artículos NUMÉRICOS PUROS (como hace teoriaFetchers.js)
  console.log('');
  console.log('=== CONTEO SEGÚN LÓGICA DE TEORÍA ===');

  const { data: allArticles } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', law.id)
    .eq('is_active', true)
    .not('content', 'is', null);

  // Filtrar solo artículos numéricos puros (como hace teoriaFetchers.js)
  const numericOnly = allArticles.filter(a => /^\d+$/.test(a.article_number?.trim() || ''));

  console.log('Total artículos con contenido:', allArticles.length);
  console.log('Artículos NUMÉRICOS puros:', numericOnly.length);
  console.log('');
  console.log('Esto es lo que muestra el temario: ' + numericOnly.length + ' artículos');

  // Verificar cuáles son los numéricos
  const numericNumbers = numericOnly.map(a => parseInt(a.article_number)).sort((a, b) => a - b);
  console.log('');
  console.log('Artículos numéricos:', numericNumbers.slice(0, 10).join(', ') + '...' + numericNumbers.slice(-5).join(', '));

  // Verificar artículos 101 y 149 en detalle
  console.log('');
  console.log('=== VERIFICANDO ARTÍCULOS SOSPECHOSOS ===');

  const { data: suspiciousArticles } = await supabase
    .from('articles')
    .select('article_number, title, content, is_active')
    .eq('law_id', law.id)
    .or('article_number.eq.101,article_number.eq.149');

  for (const a of suspiciousArticles || []) {
    console.log('');
    console.log('Art. ' + a.article_number + ': ' + a.title);
    console.log('  is_active:', a.is_active);
    console.log('  tiene content:', a.content ? 'SÍ (' + a.content.length + ' chars)' : 'NO');
    if (a.content) {
      console.log('  primeros 100 chars: ' + a.content.substring(0, 100));
    }
  }

  // El EBEP real (según BOE) tiene del artículo 1 al 100
  console.log('');
  console.log('=== RESUMEN ===');
  console.log('El RDL 5/2015 (EBEP) oficialmente tiene artículos del 1 al 100.');
  console.log('');
  console.log('ERRORES ENCONTRADOS:');

  if (suspiciousArticles?.find(a => a.article_number === '101')) {
    console.log('  ❌ Artículo 101 - NO existe en el EBEP real');
  }
  if (suspiciousArticles?.find(a => a.article_number === '149')) {
    console.log('  ❌ Artículo 149 - NO existe en el EBEP real');
  }

  // Verificar duplicados de 47bis
  const { data: art47bis } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .or('article_number.ilike.%47%bis%,article_number.ilike.%47bis%');

  if (art47bis && art47bis.length > 1) {
    console.log('  ❌ Artículo 47bis DUPLICADO (' + art47bis.length + ' versiones)');
    art47bis.forEach(a => console.log('      - "' + a.article_number + '" (id: ' + a.id.substring(0, 8) + ')'));
  }
})();
