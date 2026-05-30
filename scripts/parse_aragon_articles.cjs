require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAWS = {
  viii: { id: '28f62de0-ba86-4805-a90e-e5b0aed4c428', file: '/tmp/viii_convenio_aragon.txt', expected: 137 },
  ii:   { id: '7e20e886-3c90-46e5-b8d7-0734074f7b06', file: '/tmp/ii_acuerdo_aragon.txt',     expected: 68 },
};

// Parser: extrae artículos de PDFs convertidos a texto layout-preserved.
// Patrón típico:
//   Artículo N. <título>.
//   <contenido>
//   ...
//   Artículo N+1. <título>.
function parseArticles(text) {
  // Limpiar headers de página BOA (aparecen en cada página)
  const cleaned = text
    .split('\n')
    .filter(line => !/Núm\.\s*94\s+Boletín Oficial de Aragón\s+19\/05\/2023/.test(line))
    .filter(line => !/^\s*csv:\s*BOA/.test(line))
    .join('\n');

  // Regex multilínea: busca "Artículo N. título" y captura hasta el siguiente "Artículo N+1." o "DISPOSICIÓN"
  const articleRegex = /^[[:space:]]*Artículo\s+(\d+)\.\s*(.+?)$/gm;
  // Mejor approach: split por la línea "Artículo N." y luego procesar cada chunk
  const lines = cleaned.split('\n');
  const articles = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^\s*Artículo\.?\s+(\d+)\.\s*(.+?)\s*$/);
    if (m) {
      if (current) articles.push(current);
      current = {
        article_number: m[1],
        title: m[2].replace(/\.$/, '').trim(),
        content_lines: [],
      };
    } else {
      // Detenerse al llegar a las disposiciones
      if (/^\s*DISPOSI[CC]I[ÓO]N\s+(ADICIONAL|TRANSITORIA|DEROGATORIA|FINAL)/i.test(line)) {
        if (current) articles.push(current);
        current = null;
        break;
      }
      if (current) current.content_lines.push(line);
    }
  }
  if (current) articles.push(current);

  // Limpiar contenido: trim líneas, colapsar espacios múltiples, quitar líneas vacías al inicio/fin
  for (const a of articles) {
    let content = a.content_lines.join('\n')
      .replace(/[ \t]+/g, ' ')          // colapsar espacios horizontales
      .replace(/\n\s*\n+/g, '\n\n')     // colapsar líneas vacías múltiples
      .trim();
    a.content = content;
    delete a.content_lines;
  }

  return articles;
}

(async () => {
  const DRY_RUN = process.argv.includes('--dry');
  for (const [key, { id, file, expected }] of Object.entries(LAWS)) {
    const text = fs.readFileSync(file, 'utf8');
    const articles = parseArticles(text);
    console.log(`\n═══ ${key.toUpperCase()} (law ${id}) ═══`);
    console.log(`  Parseados: ${articles.length} artículos (esperado ${expected})`);

    const short = articles.filter(a => a.content.length < 100);
    if (short.length > 0) {
      console.log(`  ⚠️  ${short.length} artículos con <100 chars:`);
      for (const a of short) console.log(`    Art ${a.article_number}: "${a.title}" - ${a.content.length} chars`);
    }

    if (DRY_RUN) continue;

    // Verificar si ya hay artículos para esta ley
    const { count: existing } = await supabase.from('articles').select('*', { count: 'exact', head: true }).eq('law_id', id);
    if (existing > 0) {
      console.log(`  ⏭  Ya existen ${existing} artículos, saltando INSERT`);
      continue;
    }

    // INSERT en lotes de 50
    let inserted = 0;
    for (let i = 0; i < articles.length; i += 50) {
      const batch = articles.slice(i, i + 50).map(a => ({
        law_id: id,
        article_number: a.article_number,
        title: a.title,
        content: a.content,
        is_active: true,
      }));
      const { error } = await supabase.from('articles').insert(batch);
      if (error) { console.error(`  ❌ batch ${i}: ${error.message}`); break; }
      inserted += batch.length;
    }
    console.log(`  ✅ ${inserted} artículos importados`);
  }
})();
