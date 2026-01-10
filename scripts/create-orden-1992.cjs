const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('=== Creando Orden 30/07/1992 ===\n');

  // 1. Crear la ley
  const { data: law, error: lawError } = await supabase.from('laws').insert({
    short_name: 'Orden 30/07/1992',
    name: 'Orden de 30 de julio de 1992 sobre instrucciones para la confección de nóminas',
    description: 'Instrucciones para la confección de nóminas de retribuciones del personal al servicio de la Administración del Estado',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-19493',
    boe_id: 'BOE-A-1992-19493',
    year: 1992,
    type: 'regulation',
    is_active: true
  }).select().single();

  if (lawError) {
    console.log('Error creando ley:', lawError.message);
    return;
  }

  console.log('✅ Ley creada:', law.id);

  // 2. Obtener HTML del BOE para extraer artículos
  const response = await fetch('https://www.boe.es/buscar/act.php?id=BOE-A-1992-19493');
  const html = await response.text();

  // 3. Extraer artículos (A1-A8)
  const articleRegex = /<div[^>]*class="bloque"[^>]*id="A(\d)"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi;
  let match;
  const articles = [];

  while ((match = articleRegex.exec(html)) !== null) {
    const artNum = match[1];
    const content = match[2];

    // Extraer título si existe
    const titleMatch = content.match(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/i);
    let title = '';
    if (titleMatch) {
      title = titleMatch[0].replace(/<[^>]*>/g, '').replace(/Art[íi]culo\s*\d+\.?\s*/i, '').trim();
    }

    // Limpiar contenido
    let cleanContent = content
      .replace(/<h5[^>]*>[\s\S]*?<\/h5>/gi, '')
      .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    articles.push({
      law_id: law.id,
      article_number: artNum,
      title: title || null,
      content: cleanContent.substring(0, 10000),
      is_active: true
    });
  }

  console.log('Artículos encontrados:', articles.length);

  // 4. Insertar artículos
  for (const art of articles) {
    const { error } = await supabase.from('articles').insert(art);
    if (error) console.log('Error art ' + art.article_number + ':', error.message);
    else console.log('  ✅ Art ' + art.article_number + ': ' + (art.title || '(sin título)').substring(0, 40));
  }

  console.log('\n✅ Orden 30/07/1992 creada con', articles.length, 'artículos');
  console.log('Law ID:', law.id);
})();
