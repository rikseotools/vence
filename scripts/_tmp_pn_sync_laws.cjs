#!/usr/bin/env node
/**
 * Sync articles from BOE for all PN laws that have boe_url with act.php and 0 articles.
 * Also creates Art 0 for laws without boe_url (virtual/non-syncable).
 *
 * Usage: node scripts/_tmp_pn_sync_laws.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_BASE = 'http://localhost:3000';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function syncLaw(lawId, shortName) {
  try {
    const r = await fetch(`${API_BASE}/api/verify-articles/sync-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lawId, includeDisposiciones: true }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await r.json();
    if (data.success) {
      return { ok: true, stats: data.stats };
    }
    return { ok: false, error: data.error || 'unknown' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function createArt0(lawId, shortName) {
  // Check if Art 0 already exists
  const { data: existing } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', '0')
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: true, skipped: true };
  }

  const { error } = await supabase.from('articles').insert({
    law_id: lawId,
    article_number: '0',
    title: shortName + ' — Contenido general',
    content: 'Artículo contenedor para preguntas de ' + shortName,
    is_active: true,
    is_verified: false,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
}

async function main() {
  console.log('🚀 Syncing articles for PN laws\n');

  const map = JSON.parse(fs.readFileSync('preguntas-para-subir/innotest-policia-nacional/_law_map.json', 'utf-8'));
  const lawIds = [...new Set(Object.values(map).filter(e => e.law_id).map(e => e.law_id))];

  let synced = 0, art0Created = 0, errors = 0, skipped = 0;

  for (const lawId of lawIds) {
    const { data: law } = await supabase
      .from('laws')
      .select('id, short_name, boe_url')
      .eq('id', lawId)
      .single();

    if (!law) continue;

    // Count existing articles
    const { count } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('law_id', lawId)
      .eq('is_active', true);

    if ((count || 0) > 0) {
      skipped++;
      continue;
    }

    // Syncable (act.php)?
    if (law.boe_url && law.boe_url.includes('act.php')) {
      process.stdout.write(`  SYNC ${law.short_name}...`);
      const result = await syncLaw(lawId, law.short_name);
      if (result.ok) {
        const s = result.stats;
        console.log(` ✅ +${s.added} arts (${s.updated} upd, ${s.unchanged} unch)`);
        synced++;
      } else {
        console.log(` ❌ ${result.error}`);
        // Fallback: create Art 0
        const art0 = await createArt0(lawId, law.short_name);
        if (art0.ok) {
          console.log(`    → Art 0 created as fallback`);
          art0Created++;
        } else {
          errors++;
        }
      }
      await sleep(2000); // Be nice to BOE
    } else {
      // No sync URL — create Art 0
      process.stdout.write(`  ART0 ${law.short_name}...`);
      const result = await createArt0(lawId, law.short_name);
      if (result.ok) {
        if (result.skipped) console.log(' (already exists)');
        else { console.log(' ✅ created'); art0Created++; }
      } else {
        console.log(` ❌ ${result.error}`);
        errors++;
      }
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Synced from BOE: ${synced}`);
  console.log(`Art 0 created: ${art0Created}`);
  console.log(`Skipped (already had articles): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
