#!/usr/bin/env node
// Guardarraíl anti-recurrencia: caza artículos ACTIVOS cuyo `title` reintroduzca el
// prefijo redundante "Artículo N. <rúbrica>" (denormalización: el número ya vive en
// `article_number`). El extractor BOE actual produce la rúbrica limpia, así que un
// título prefijado indica un import defectuoso (legacy o nuevo bug de pipeline).
//
// Contexto (14/07/2026): se normalizaron ~1.439 títulos (strip prefijo) + se restauraron
// ~264 rúbricas faltantes desde el BOE (backfill con guard de boe_url). Este check evita
// que el problema vuelva. Se puede cablear al sweep de salud o a CI.
//
// Uso: DATABASE_URL=... node scripts/check-article-title-prefix.cjs [--fail]
//   --fail → exit 1 si encuentra >0 (para CI). Sin flag: solo informa.
//
// NOTA: cuenta SOLO el patrón limpiamente-strippable (prefijo + separador + rúbrica).
// Los títulos "bare" ("Artículo N" sin rúbrica) son otro defecto (rúbrica faltante),
// no cubiertos por este guardarraíl.
const fs = require('fs');
const pg = require('./../backend/node_modules/postgres');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

(async () => {
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const rows = await s`
      SELECT a.article_number an, l.short_name ln, left(a.title, 70) title
      FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE a.is_active
        AND a.title ~* '^art[íi]culo\s+\d+\s*(bis|ter|qu[aá]ter|quinquies)?\s*[.\-–:]\s+\S'`;
    console.log(`Artículos activos con prefijo "Artículo N." strippable: ${rows.length}`);
    rows.slice(0, 20).forEach(r => console.log(`  ${r.ln} · art ${r.an}: "${r.title}"`));
    if (rows.length > 20) console.log(`  … y ${rows.length - 20} más`);
    if (process.argv.includes('--fail') && rows.length > 0) process.exit(1);
  } finally {
    await s.end();
  }
})();
