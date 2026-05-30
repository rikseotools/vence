require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAW_ID = '45a8bef1-0c98-41cc-aa13-d76e50b211eb';
const TEXT_FILE = '/tmp/d622_2019.txt';

// Estrategia: el PDF BOJA tiene índice al principio (líneas 18-~75 con "Artículo N. <título>"
// SIN punto al final + sin contenido). Luego el cuerpo legítimo: "Artículo N. <título>." (CON punto)
// seguido de apartados numerados "1.", "2."...
//
// Heurística para detectar "cuerpo" vs "índice":
//   - Líneas de ÍNDICE: terminan SIN punto (o con coma para títulos largos)
//   - Líneas de CUERPO: terminan CON punto + siguiente línea es "1." o párrafo

function parseArticles(text) {
  // Limpiar headers de página BOJA (se repiten en cada página)
  const cleaned = text
    .split('\n')
    .filter(l => !/Boletín Oficial de la Junta de Andalucía/.test(l))
    .filter(l => !/^\s*BOJA\s+/.test(l))
    .filter(l => !/^\s*Número 250\s*-\s*Martes/.test(l))
    .filter(l => !/^\s*Depósito Legal:\s*SE-410/.test(l))
    .filter(l => !/^\s*página\s+\d+\s*$/.test(l))
    .filter(l => !/^\s*\d{8}\s*$/.test(l))  // CSV BOJA codes
    .join('\n');

  // Localizar inicio del cuerpo: SEGUNDA aparición de "Artículo 1." (la primera es índice)
  // El cuerpo del decreto tiene la signatura "Artículo 1. Objeto y finalidad." con punto final
  // y un párrafo justo después que comienza por "1." (apartado).
  const allLines = cleaned.split('\n');
  let bodyStart = -1;
  let foundFirstArt1 = false;
  for (let i = 0; i < allLines.length; i++) {
    if (/^\s*Artículo\.?\s+1\.\s+.+/.test(allLines[i])) {
      if (foundFirstArt1) { bodyStart = i; break; }
      foundFirstArt1 = true;
    }
  }
  if (bodyStart === -1) { console.error('No se encontró inicio del cuerpo'); return []; }
  const lines = allLines.slice(bodyStart);

  const articles = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^\s*Artículo\.?\s+(\d+)\.\s+(.+?)\s*$/);
    if (m) {
      if (current) articles.push(current);
      current = { num: m[1], title: m[2].trim().replace(/\.$/, ''), content_lines: [] };
      continue;
    }
    if (current) {
      // Detener al llegar a disposiciones
      if (/^\s*DISPOSICI[ÓO]N\s+(ADICIONAL|TRANSITORIA|DEROGATORIA|FINAL)/i.test(line)) {
        articles.push(current);
        current = null;
        break;
      }
      current.content_lines.push(line);
    }
  }
  if (current) articles.push(current);

  // Limpiar contenido + truncar cabeceras de CAPÍTULO/TÍTULO/SECCIÓN al final
  for (const a of articles) {
    let content = a.content_lines.join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
    // Cortar contenido si aparece cabecera de CAPÍTULO/TÍTULO/SECCIÓN en MAYÚSCULAS al final
    content = content.replace(/\n+\s*(CAP[ÍI]TULO|T[ÍI]TULO|SECCI[ÓO]N)\s+[IVXLCDM]+\b[\s\S]*$/m, '').trim();
    a.content = content;
    delete a.content_lines;
  }

  return articles;
}

(async () => {
  const text = fs.readFileSync(TEXT_FILE, 'utf8');
  const parsed = parseArticles(text);
  console.log(`Parseados: ${parsed.length} artículos`);

  // Modo: mostrar contenido específico de un artículo
  const showArt = process.argv.find(a => a.startsWith('--show='));
  if (showArt) {
    const num = showArt.split('=')[1];
    const a = parsed.find(x => x.num === num);
    if (!a) { console.log('No encontrado'); return; }
    console.log(`\n═══ ART ${a.num}: ${a.title} (${a.content.length}c) ═══`);
    console.log(a.content);
    return;
  }

  // Verificar continuidad
  const nums = parsed.map(a => parseInt(a.num));
  const min = Math.min(...nums), max = Math.max(...nums);
  console.log(`Rango: ${min}-${max}`);
  const missing = [];
  for (let i = min; i <= max; i++) if (!nums.includes(i)) missing.push(i);
  console.log(`Faltan: ${missing.join(',') || 'ninguno'}`);

  // Cargar BD actual
  const { data: dbArts } = await supabase.from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', LAW_ID)
    .order('article_number');
  const dbMap = new Map(dbArts.map(a => [a.article_number, a]));

  // Comparar
  console.log('\n═══ Comparación BOJA vs BD ═══');
  const diffs = [];
  for (const a of parsed) {
    const db = dbMap.get(a.num);
    if (!db) {
      console.log(`  art ${a.num}: NO EN BD (BOJA: ${a.content.length}c)`);
      diffs.push({ num: a.num, action: 'INSERT', boja_chars: a.content.length });
      continue;
    }
    const dbLen = db.content?.length || 0;
    const bojaLen = a.content.length;
    const ratio = dbLen > 0 ? (bojaLen / dbLen) : Infinity;
    if (Math.abs(bojaLen - dbLen) > 100 && (ratio > 1.3 || ratio < 0.7)) {
      console.log(`  ⚠️  art ${a.num}: BD ${dbLen}c → BOJA ${bojaLen}c (ratio ${ratio.toFixed(2)})`);
      diffs.push({ num: a.num, action: 'UPDATE', db_chars: dbLen, boja_chars: bojaLen, db_id: db.id, new_content: a.content });
    }
  }
  console.log(`\nDiferencias significativas: ${diffs.length}`);

  // ESTRATEGIA CONSERVADORA: solo aplicar updates donde el BOJA tiene MÁS contenido
  // que la BD significativamente (BD truncado). Los casos BD>BOJA requieren revisión
  // manual porque pueden ser falsos positivos del parser BOJA flojo (no del bug en BD).
  const safeUpdates = diffs.filter(x =>
    x.action === 'UPDATE' &&
    x.boja_chars > x.db_chars &&            // BOJA tiene más
    (x.boja_chars - x.db_chars) > 300 &&    // diferencia significativa
    x.boja_chars > 800                      // BOJA tiene contenido sustantivo
  );
  const requireReview = diffs.filter(x =>
    x.action === 'UPDATE' &&
    !safeUpdates.includes(x)
  );

  console.log(`\n═══ Updates seguros (BOJA > BD, truncados): ${safeUpdates.length} ═══`);
  for (const d of safeUpdates) console.log(`  art ${d.num}: BD ${d.db_chars}c → BOJA ${d.boja_chars}c (+${d.boja_chars - d.db_chars}c)`);
  console.log(`\n═══ Requieren revisión manual (BD ≥ BOJA, posible contaminación): ${requireReview.length} ═══`);
  for (const d of requireReview) console.log(`  art ${d.num}: BD ${d.db_chars}c vs BOJA ${d.boja_chars}c (diff ${d.db_chars - d.boja_chars})`);

  if (process.argv.includes('--apply')) {
    console.log('\n═══ APLICANDO UPDATES SEGUROS ═══');
    for (const d of safeUpdates) {
      const { error } = await supabase.from('articles')
        .update({ content: d.new_content, updated_at: new Date().toISOString() })
        .eq('id', d.db_id);
      console.log(`  art ${d.num}: ${error ? '❌ ' + error.message : '✅'} (${d.db_chars} → ${d.boja_chars})`);
    }
  } else {
    console.log('\n(dry-run) Para aplicar: node scripts/resync_d622_2019.cjs --apply');
  }
})();
