#!/usr/bin/env node
/**
 * Import laws needed for Guardia Civil oposición
 * Step 1: Create law in BD with boe_url
 * Step 2: Sync articles from BOE via /api/verify-articles/sync-all
 * Step 3: Report results
 *
 * Runs one law at a time, with delays, verifying each step.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LAWS_TO_IMPORT = [
  // T9 - Derecho Procesal Penal (faltan 2 de 5 bloques)
  {
    short_name: 'RD 769/1987',
    name: 'Real Decreto 769/1987, de 19 de junio, sobre regulación de la Policía Judicial',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1987-14578',
    scope: 'national', type: 'law',
    tema: 9, scope_articles: null // toda la ley (es corta)
  },
  {
    short_name: 'Ley 4/2015 Estatuto Víctima',
    name: 'Ley 4/2015, de 27 de abril, del Estatuto de la víctima del delito',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-4606',
    scope: 'national', type: 'law',
    tema: 9, scope_articles: null
  },
  // T12 - Extranjería (falta RD 240/2007)
  {
    short_name: 'RD 240/2007',
    name: 'Real Decreto 240/2007, de 16 de febrero, sobre entrada, libre circulación y residencia en España de ciudadanos de los Estados miembros de la UE',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-4184',
    scope: 'national', type: 'law',
    tema: 12, scope_articles: null
  },
  // T13 - Seguridad (falta Ley 5/2014 Seguridad Privada)
  {
    short_name: 'Ley 5/2014 Seguridad Privada',
    name: 'Ley 5/2014, de 4 de abril, de Seguridad Privada',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-3649',
    scope: 'national', type: 'law',
    tema: 13, scope_articles: null
  },
  // T15 - FCSE / Guardia Civil
  {
    short_name: 'LO 2/1986 FCSE',
    name: 'Ley Orgánica 2/1986, de 13 de marzo, de Fuerzas y Cuerpos de Seguridad',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1986-6859',
    scope: 'national', type: 'law',
    tema: 15, scope_articles: null
  },
  {
    short_name: 'Ley 29/2014 Régimen Personal GC',
    name: 'Ley 29/2014, de 28 de noviembre, de Régimen del Personal de la Guardia Civil',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-12408',
    scope: 'national', type: 'law',
    tema: 15, scope_articles: null // BOE dice Título Preliminar + I + II
  },
  {
    short_name: 'LO 11/2007 Derechos GC',
    name: 'Ley Orgánica 11/2007, de 22 de octubre, reguladora de los derechos y deberes de los miembros de la Guardia Civil',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-18473',
    scope: 'national', type: 'law',
    tema: 15, scope_articles: null
  },
  // T16 - Protección Civil (falta Ley 42/2007)
  {
    short_name: 'Ley 42/2007 Patrimonio Natural',
    name: 'Ley 42/2007, de 13 de diciembre, del Patrimonio Natural y de la Biodiversidad',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-21490',
    scope: 'national', type: 'law',
    tema: 16, scope_articles: null // BOE: Título Preliminar + II + III + IV
  },
  // T17 - TIC (falta Ley 11/2022 y RD 806/2014)
  {
    short_name: 'Ley 11/2022 Telecomunicaciones',
    name: 'Ley 11/2022, de 28 de junio, General de Telecomunicaciones',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-10757',
    scope: 'national', type: 'law',
    tema: 17, scope_articles: null // BOE: Título I + Título III Cap III
  },
  {
    short_name: 'RD 806/2014',
    name: 'Real Decreto 806/2014, de 19 de septiembre, sobre organización e instrumentos operativos de las TIC en la AGE',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-9741',
    scope: 'national', type: 'law',
    tema: 17, scope_articles: null
  },
  // T19 - Deontología
  {
    short_name: 'RD 176/2022 Código Conducta GC',
    name: 'Real Decreto 176/2022, de 4 de marzo, por el que se aprueba el código de conducta del personal de la Guardia Civil',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-3587',
    scope: 'national', type: 'law',
    tema: 19, scope_articles: null
  },
  // T20 - Menores
  {
    short_name: 'LO 5/2000 Menores',
    name: 'Ley Orgánica 5/2000, de 12 de enero, reguladora de la responsabilidad penal de los menores',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-641',
    scope: 'national', type: 'law',
    tema: 20, scope_articles: null
  },
  // T22 - Armas y Explosivos
  {
    short_name: 'RD 137/1993 Reglamento Armas',
    name: 'Real Decreto 137/1993, de 29 de enero, por el que se aprueba el Reglamento de Armas',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1993-6202',
    scope: 'national', type: 'law',
    tema: 22, scope_articles: null
  },
  {
    short_name: 'RD 130/2017 Reglamento Explosivos',
    name: 'Real Decreto 130/2017, de 24 de febrero, por el que se aprueba el Reglamento de Explosivos',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2017-2303',
    scope: 'national', type: 'law',
    tema: 22, scope_articles: null
  },
  // T23 - Derecho Fiscal
  {
    short_name: 'LO 12/1995 Contrabando',
    name: 'Ley Orgánica 12/1995, de 12 de diciembre, de represión del contrabando',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-26836',
    scope: 'national', type: 'law',
    tema: 23, scope_articles: null
  },
  {
    short_name: 'RD 1649/1998 Contrabando Admin',
    name: 'Real Decreto 1649/1998, de 24 de julio, por el que se desarrolla el Título II de la LO 12/1995, relativo a las infracciones administrativas de contrabando',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1998-18233',
    scope: 'national', type: 'law',
    tema: 23, scope_articles: null
  },
  // T1 - DDHH (LO 18/2003 es la única ley española)
  {
    short_name: 'LO 18/2003 Corte Penal',
    name: 'Ley Orgánica 18/2003, de 10 de diciembre, de Cooperación con la Corte Penal Internacional',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-22715',
    scope: 'national', type: 'law',
    tema: 1, scope_articles: null
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function importLaw(law, index) {
  console.log(`\n[${ index + 1}/${LAWS_TO_IMPORT.length}] ${law.short_name}`);
  console.log(`  BOE: ${law.boe_url}`);

  // Check if already exists
  const { data: existing } = await s.from('laws').select('id, short_name')
    .or(`short_name.eq.${law.short_name},boe_url.eq.${law.boe_url}`)
    .limit(1);

  let lawId;

  if (existing && existing.length > 0) {
    lawId = existing[0].id;
    console.log(`  ⏭️  Ya existe: ${existing[0].short_name} (${lawId.substring(0,8)})`);

    // Make sure boe_url is set
    await s.from('laws').update({ boe_url: law.boe_url }).eq('id', lawId);
  } else {
    // Generate slug from short_name
    const slug = law.short_name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Create law
    const { data: created, error } = await s.from('laws').insert({
      short_name: law.short_name,
      name: law.name,
      slug: slug,
      boe_url: law.boe_url,
      scope: law.scope,
      type: law.type,
      is_active: true,
      is_virtual: false,
    }).select('id').single();

    if (error) {
      console.log(`  ❌ Error creating: ${error.message}`);
      return null;
    }
    lawId = created.id;
    console.log(`  ✅ Created: ${lawId.substring(0,8)}`);
  }

  // Count existing articles
  const { count: beforeCount } = await s.from('articles').select('id', { count: 'exact', head: true }).eq('law_id', lawId);
  console.log(`  📄 Articles before sync: ${beforeCount}`);

  // Sync from BOE via API
  console.log(`  🔄 Syncing from BOE...`);
  try {
    const response = await fetch('http://localhost:3000/api/verify-articles/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lawId })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`  ✅ Sync OK: +${data.stats?.added || 0} added, ${data.stats?.updated || 0} updated, ${data.stats?.unchanged || 0} unchanged`);
    } else {
      console.log(`  ❌ Sync error: ${data.error || JSON.stringify(data).substring(0, 200)}`);
      // If sync fails, try with includeDisposiciones
      console.log(`  🔄 Retrying with disposiciones...`);
      const r2 = await fetch('http://localhost:3000/api/verify-articles/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawId, includeDisposiciones: true })
      });
      const d2 = await r2.json();
      if (d2.success) {
        console.log(`  ✅ Retry OK: +${d2.stats?.added || 0} added`);
      } else {
        console.log(`  ❌ Retry also failed: ${d2.error || 'unknown'}`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Fetch error: ${e.message}`);
  }

  // Count articles after sync
  const { count: afterCount } = await s.from('articles').select('id', { count: 'exact', head: true }).eq('law_id', lawId);
  console.log(`  📄 Articles after sync: ${afterCount}`);

  return { lawId, shortName: law.short_name, tema: law.tema, articles: afterCount };
}

async function main() {
  console.log('🚀 Importing laws for Guardia Civil');
  console.log(`   ${LAWS_TO_IMPORT.length} laws to import\n`);

  const results = [];

  for (let i = 0; i < LAWS_TO_IMPORT.length; i++) {
    const result = await importLaw(LAWS_TO_IMPORT[i], i);
    if (result) results.push(result);

    // Human-like delay between laws (10-20 seconds)
    if (i < LAWS_TO_IMPORT.length - 1) {
      const delay = 10000 + Math.random() * 10000;
      console.log(`  ⏳ Waiting ${(delay/1000).toFixed(0)}s...`);
      await sleep(delay);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  for (const r of results) {
    console.log(`  T${r.tema}: ${r.shortName} → ${r.articles} artículos`);
  }
  console.log(`\n  Total: ${results.length} leyes importadas`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
