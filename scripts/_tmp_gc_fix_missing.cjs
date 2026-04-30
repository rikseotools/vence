#!/usr/bin/env node
/**
 * Fix missing questions from GC import:
 * 1. Import RD 179/2005 and RD 67/2010 from BOE
 * 2. Create articles in virtual laws for international treaties
 * 3. Update law_map with new mappings
 * 4. Re-import the ~1901 questions that were lost
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/<[^>]*>/g, '').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(text) { return crypto.createHash('sha256').update(normalize(text)).digest('hex'); }
const LETTER_TO_NUM = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

async function createOrGetLaw(shortName, name, slug, opts = {}) {
  const { data: existing } = await s.from('laws').select('id').eq('short_name', shortName).limit(1);
  if (existing && existing.length > 0) return existing[0].id;
  const { data, error } = await s.from('laws').insert({
    short_name: shortName, name, slug,
    scope: opts.scope || 'national', type: 'law',
    is_active: true, is_virtual: opts.virtual ?? false,
    boe_url: opts.boe_url || null,
  }).select('id').single();
  if (error) { console.log('❌ Create law ' + shortName + ': ' + error.message); return null; }
  console.log('✅ Created law: ' + shortName);
  return data.id;
}

async function createOrGetArticle(lawId, artNum, title, content) {
  const { data: existing } = await s.from('articles').select('id')
    .eq('law_id', lawId).eq('article_number', String(artNum)).limit(1);
  if (existing && existing.length > 0) return existing[0].id;
  const { data, error } = await s.from('articles').insert({
    law_id: lawId, article_number: String(artNum), title: title || '', content: content || '', is_active: true
  }).select('id').single();
  if (error) { console.log('❌ Create art ' + artNum + ': ' + error.message); return null; }
  return data.id;
}

async function syncFromBOE(lawId) {
  try {
    const r = await fetch('http://localhost:3000/api/verify-articles/sync-all', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lawId })
    });
    const d = await r.json();
    return d.success ? (d.stats?.added || 0) : 0;
  } catch { return 0; }
}

async function main() {
  console.log('=== STEP 1: Import BOE laws ===\n');

  // RD 179/2005 PRL GC
  const rd179Id = await createOrGetLaw('RD 179/2005 PRL GC',
    'Real Decreto 179/2005, sobre prevención de riesgos laborales en la Guardia Civil',
    'rd-179-2005-prl-gc', { boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2005-3838' });
  if (rd179Id) {
    const added = await syncFromBOE(rd179Id);
    console.log('  RD 179/2005: +' + added + ' articles synced');
  }

  // RD 67/2010 PRL AGE
  const rd67Id = await createOrGetLaw('RD 67/2010 PRL AGE',
    'Real Decreto 67/2010, de adaptación de PRL a la AGE',
    'rd-67-2010-prl-age', { boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-2161' });
  if (rd67Id) {
    const added = await syncFromBOE(rd67Id);
    console.log('  RD 67/2010: +' + added + ' articles synced');
  }

  // Reglamento Defensor del Pueblo - check BOE
  const regDefId = await createOrGetLaw('Reglamento Defensor Pueblo',
    'Reglamento de Organización y Funcionamiento del Defensor del Pueblo',
    'reglamento-defensor-pueblo', { boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1983-9193' });
  if (regDefId) {
    const added = await syncFromBOE(regDefId);
    console.log('  Reglamento Defensor: +' + added + ' articles synced');
  }

  console.log('\n=== STEP 2: Create virtual law articles ===\n');

  // For each null-mapped leyID, create a dedicated virtual law with Art 0
  const VIRTUAL_LAWS_TO_CREATE = [
    { leyIDs: ['5'], shortName: 'DUDH', fullName: 'Declaración Universal de Derechos Humanos', slug: 'dudh' },
    { leyIDs: ['7'], shortName: 'PIDCP', fullName: 'Pacto Internacional de Derechos Civiles y Políticos', slug: 'pidcp' },
    { leyIDs: ['8'], shortName: 'PIDESC', fullName: 'Pacto Internacional de Derechos Económicos, Sociales y Culturales', slug: 'pidesc' },
    { leyIDs: ['91'], shortName: 'Estatuto de Roma', fullName: 'Estatuto de Roma de la Corte Penal Internacional', slug: 'estatuto-roma' },
    { leyIDs: ['95', '203'], shortName: 'CEDH', fullName: 'Convenio Europeo para la Protección de los Derechos Humanos y las Libertades Fundamentales', slug: 'cedh' },
    { leyIDs: ['97'], shortName: 'Convención contra Tortura', fullName: 'Convención contra la Tortura y otros tratos crueles, inhumanos o degradantes', slug: 'convencion-tortura' },
    { leyIDs: ['40'], shortName: 'Protocolo Tortura', fullName: 'Protocolo Facultativo de la Convención contra la Tortura', slug: 'protocolo-tortura' },
    { leyIDs: ['103'], shortName: 'Carta DDFF UE', fullName: 'Carta de los Derechos Fundamentales de la Unión Europea', slug: 'carta-ddff-ue' },
    { leyIDs: ['164', '215'], shortName: 'Carta Social Europea', fullName: 'Carta Social Europea (revisada)', slug: 'carta-social-europea' },
    { leyIDs: ['46', '205', '384'], shortName: 'Consejo DDHH ONU', fullName: 'Consejo de Derechos Humanos de las Naciones Unidas', slug: 'consejo-ddhh-onu' },
    { leyIDs: ['318'], shortName: 'Principios Fuerza ONU', fullName: 'Principios Básicos sobre el Empleo de la Fuerza y de Armas de Fuego', slug: 'principios-fuerza-onu' },
    { leyIDs: ['139'], shortName: 'Ciberseguridad CCN-CERT', fullName: 'Principios y recomendaciones básicas en Ciberseguridad del CCN-CERT', slug: 'ciberseguridad-ccn-cert' },
    { leyIDs: ['321'], shortName: 'Código Aduanero UE', fullName: 'Reglamento (UE) nº 952/2013, Código Aduanero de la Unión', slug: 'codigo-aduanero-ue' },
    { leyIDs: ['408', '121'], shortName: 'Directiva Eficiencia Energética', fullName: 'Directiva 2012/27/UE y 2023/1791 de eficiencia energética', slug: 'directiva-eficiencia-energetica' },
    { leyIDs: ['191'], shortName: 'Reglamento Defensor Pueblo GC', fullName: 'Reglamento de Organización y Funcionamiento del Defensor del Pueblo (para GC)', slug: 'reglamento-defensor-pueblo-gc' },
    { leyIDs: ['112'], shortName: 'CIJ', fullName: 'Corte Internacional de Justicia', slug: 'cij' },
    { leyIDs: ['124'], shortName: 'TEDH', fullName: 'Tribunal Europeo de Derechos Humanos', slug: 'tedh' },
    { leyIDs: ['82'], shortName: 'Adhesiones Tratados GC', fullName: 'Adhesiones de España a tratados internacionales', slug: 'adhesiones-tratados-gc' },
    { leyIDs: ['99', '120'], shortName: 'EUROJUST GC', fullName: 'EUROJUST: Unidad de Cooperación Judicial de la UE', slug: 'eurojust-gc' },
    { leyIDs: ['184', '185', '210'], shortName: 'Instituciones UE GC', fullName: 'Instituciones de la Unión Europea (Parlamento, Consejo, TJUE)', slug: 'instituciones-ue-gc' },
    { leyIDs: ['183'], shortName: 'OTAN GC', fullName: 'Organización del Tratado del Atlántico Norte', slug: 'otan-gc' },
    { leyIDs: ['42', '50', '376'], shortName: 'Estructura DGGC', fullName: 'Estructura orgánica de la Dirección General de la Guardia Civil', slug: 'estructura-dggc' },
    { leyIDs: ['466'], shortName: 'Historia GC', fullName: 'Historia de la Guardia Civil', slug: 'historia-gc' },
  ];

  // Build new mapping: leyID → law_id + art0_id
  const newMapping = {};

  for (const vl of VIRTUAL_LAWS_TO_CREATE) {
    const lawId = await createOrGetLaw(vl.shortName, vl.fullName, vl.slug, { virtual: true });
    if (!lawId) continue;
    const art0Id = await createOrGetArticle(lawId, '0', 'Contenido - ' + vl.shortName, vl.fullName);
    if (!art0Id) continue;

    for (const lid of vl.leyIDs) {
      newMapping[lid] = { law_id: lawId, art0_id: art0Id };
    }
    console.log('✅ ' + vl.shortName + ' → ' + vl.leyIDs.join(',') + ' (' + art0Id.substring(0,8) + ')');
  }

  // Also map the BOE laws
  if (rd179Id) {
    const { data: art0 } = await s.from('articles').select('id').eq('law_id', rd179Id).limit(1);
    if (art0?.[0]) newMapping['67'] = { law_id: rd179Id, art0_id: art0[0].id };
  }
  if (rd67Id) {
    const { data: art0 } = await s.from('articles').select('id').eq('law_id', rd67Id).limit(1);
    if (art0?.[0]) newMapping['74'] = { law_id: rd67Id, art0_id: art0[0].id };
  }
  if (regDefId) {
    const { data: art0 } = await s.from('articles').select('id').eq('law_id', regDefId).limit(1);
    if (art0?.[0]) newMapping['191'] = { law_id: regDefId, art0_id: art0[0].id };
  }

  console.log('\nNew mappings created:', Object.keys(newMapping).length);

  console.log('\n=== STEP 3: Re-import lost questions ===\n');

  // Load existing question hashes to avoid dupes
  const existingHashes = new Set();
  let page = 0;
  while (true) {
    const { data } = await s.from('questions').select('content_hash').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(q => existingHashes.add(q.content_hash));
    page++;
    if (data.length < 1000) break;
  }
  console.log('Loaded', existingHashes.size, 'existing hashes');

  // Load the original law_map
  const origMap = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', '_law_map.json'), 'utf-8'));

  // Process conocimientos files
  const base = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', 'conocimientos');
  const files = fs.readdirSync(base).filter(f => f.endsWith('.json') && !f.startsWith('_'));

  let totalInserted = 0, totalSkipped = 0, totalNoMapping = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(base, file), 'utf-8'));
    let inserted = 0, skipped = 0, noMap = 0;

    for (const q of data.questions) {
      if (!q.question || q.question.length < 10) continue;
      if (!q.options || q.options.length < 4) continue;
      const correctNum = LETTER_TO_NUM[q.correctAnswer] ?? null;
      if (correctNum === null) continue;

      const hash = contentHash(q.question);
      if (existingHashes.has(hash)) { skipped++; continue; }

      // Try to find article
      let articleId = null;

      if (q.article && q.article.leyID) {
        const lid = String(q.article.leyID);
        const origMapping = origMap[lid];

        if (origMapping && origMapping.law_id) {
          // Already mapped to real law — should have been imported before
          // Try to find the article
          const { data: art } = await s.from('articles').select('id')
            .eq('law_id', origMapping.law_id)
            .eq('article_number', String(q.article.articulo)).limit(1);
          articleId = art?.[0]?.id || null;
        }

        if (!articleId && newMapping[lid]) {
          // Use new mapping (virtual law or newly imported BOE law)
          const nm = newMapping[lid];
          // Try to find specific article first
          if (nm.law_id) {
            const { data: art } = await s.from('articles').select('id')
              .eq('law_id', nm.law_id)
              .eq('article_number', String(q.article.articulo)).limit(1);
            articleId = art?.[0]?.id || nm.art0_id; // fallback to art 0
          } else {
            articleId = nm.art0_id;
          }
        }
      }

      // For questions without any article ref and no mapping
      if (!articleId) {
        if (q.article && q.article.leyID && newMapping[String(q.article.leyID)]) {
          articleId = newMapping[String(q.article.leyID)].art0_id;
        }
      }

      if (!articleId) { noMap++; totalNoMapping++; continue; }

      // Clean explanation
      let explanation = (q.explanation || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (explanation.length < 5) explanation = null;

      const { error } = await s.from('questions').insert({
        question_text: q.question,
        option_a: q.options[0]?.text || '',
        option_b: q.options[1]?.text || '',
        option_c: q.options[2]?.text || '',
        option_d: q.options[3]?.text || '',
        correct_option: correctNum,
        explanation,
        primary_article_id: articleId,
        difficulty: 'medium',
        is_active: false,
        deactivation_reason: 'Pendiente de revisión post-importación',
        topic_review_status: 'pending',
        content_hash: hash,
        tags: ['InnoTest', data.tema || ''],
      });

      if (!error) {
        inserted++;
        existingHashes.add(hash);
      } else {
        skipped++; // duplicate hash
      }
    }

    if (inserted > 0 || noMap > 0) {
      console.log('[' + data.tema + '] +' + inserted + ' inserted, ' + skipped + ' skipped, ' + noMap + ' still unmapped');
    }
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log('\n' + '='.repeat(50));
  console.log('TOTAL: +' + totalInserted + ' inserted, ' + totalSkipped + ' skipped, ' + totalNoMapping + ' unmapped');
}

main().catch(e => { console.error(e); process.exit(1); });
