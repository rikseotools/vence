#!/usr/bin/env node
/**
 * Fix incorrectly linked PN questions.
 *
 * For questions linked to catch-all "Conocimientos PN (sin ley)" etc,
 * re-link them to the correct law's Art 0 based on their InnoTest tema.
 *
 * Strategy:
 * 1. For each scraped question without ley reference, determine the correct law
 *    based on the InnoTest tema (which has a dominant leyID from other questions in the same tema)
 * 2. For temas without any ley reference at all (ciencias sociales), create virtual laws
 * 3. Re-link the questions in BD
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PN_DIR = 'preguntas-para-subir/innotest-policia-nacional';
const LAW_MAP = JSON.parse(fs.readFileSync(path.join(PN_DIR, '_law_map.json'), 'utf-8'));

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/<[^>]*>/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function contentHash(text) {
  return crypto.createHash('sha256').update(normalize(text)).digest('hex');
}

// Manual mapping: tema name → law short_name for temas WITHOUT any leyID in InnoTest
// These are ciencias sociales, técnicas, etc. where no question has a law reference
const TEMA_TO_VIRTUAL_LAW = {
  // Ciencias Sociales (no law reference in InnoTest)
  'Actitudes y valores sociales': 'Ciencias Sociales PN',
  'Principios éticos de la sociedad actual': 'Ciencias Sociales PN',
  'Globalización y antiglobalización': 'Ciencias Sociales PN',
  'Inmigración': 'Ciencias Sociales PN',
  'La seguridad': 'Ciencias Sociales PN',
  'Gramática de la lengua española': 'Lengua Española PN',
  'Ortografía de la lengua española': 'Lengua Española PN',
  // Ministerio Interior (no consistent ley)
  'El Ministerio del Interior.': 'Estructura Ministerio Interior y Defensa',
};

// Cache
const art0Cache = {}; // lawId → article.id (Art 0)

async function getOrCreateArt0(lawId, lawName) {
  if (art0Cache[lawId]) return art0Cache[lawId];

  const { data } = await s.from('articles').select('id')
    .eq('law_id', lawId).eq('article_number', '0').limit(1);

  if (data && data.length > 0) {
    art0Cache[lawId] = data[0].id;
    return data[0].id;
  }

  // Create Art 0
  const { data: created } = await s.from('articles').insert({
    law_id: lawId,
    article_number: '0',
    title: (lawName || 'Ley') + ' — Contenido general',
    content: 'Artículo contenedor para preguntas sin artículo específico de ' + (lawName || 'esta ley'),
    is_active: true,
    is_verified: false,
  }).select('id').single();

  if (created) {
    art0Cache[lawId] = created.id;
    return created.id;
  }
  return null;
}

async function getOrCreateVirtualLaw(name) {
  let { data: law } = await s.from('laws').select('id').eq('short_name', name).single();
  if (!law) {
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data: created } = await s.from('laws').insert({
      short_name: name, name: name, slug,
      scope: 'national', type: 'regulation',
      is_active: true, is_virtual: true,
    }).select('id').single();
    law = created;
    console.log(`  Created virtual law: ${name} → ${law.id.substring(0, 8)}`);
  }
  return law.id;
}

async function main() {
  console.log('🔧 Fixing PN question linking\n');

  // Step 1: Build tema → dominant law mapping from scraped data
  const temaDominantLaw = new Map(); // tema → { leyId, lawId, lawName }

  const bloques = ['conocimientos', 'examenes-oficiales', 'especificos-conocimientos', 'comunes', 'simulacros'];

  for (const bloque of bloques) {
    const dir = path.join(PN_DIR, bloque);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const tema = data.tema || file;
      const leyCount = new Map();

      for (const q of data.questions || []) {
        if (q.article && q.article.leyID) {
          const leyId = String(q.article.leyID);
          leyCount.set(leyId, (leyCount.get(leyId) || 0) + 1);
        }
      }

      if (leyCount.size > 0) {
        const [topLeyId] = [...leyCount.entries()].sort((a, b) => b[1] - a[1])[0];
        const mapping = LAW_MAP[topLeyId];
        if (mapping && mapping.law_id) {
          temaDominantLaw.set(tema, { lawId: mapping.law_id, lawName: mapping.short_name });
        }
      }
    }
  }

  console.log('Tema → dominant law mappings:', temaDominantLaw.size);

  // Step 2: Get the bad catch-all article IDs
  const badLaws = [
    'Conocimientos PN (sin ley)',
    'Exámenes Oficiales PN (sin ley)',
    'Específicos PN (sin ley)',
    'Comunes PN (sin ley)',
    'Simulacros PN (sin ley)',
  ];

  const badArt0Ids = new Set();
  for (const name of badLaws) {
    const { data: law } = await s.from('laws').select('id').eq('short_name', name).single();
    if (!law) continue;
    const { data: art } = await s.from('articles').select('id').eq('law_id', law.id).eq('article_number', '0').single();
    if (art) badArt0Ids.add(art.id);
  }
  console.log('Bad catch-all Art 0 IDs:', badArt0Ids.size);

  // Step 3: For each scraped question without ley, determine correct Art 0 and update
  let fixed = 0, skipped = 0, errors = 0, alreadyCorrect = 0;

  for (const bloque of bloques) {
    const dir = path.join(PN_DIR, bloque);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

    console.log(`\n📚 ${bloque.toUpperCase()}`);

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const tema = data.tema || file;
      let fileFixed = 0;

      for (const q of data.questions || []) {
        // Only process questions WITHOUT ley reference in InnoTest
        if (q.article && q.article.leyID) continue;
        if (!q.question || q.question.length < 5) continue;

        // Find this question in BD by question_text (exact match)
        const { data: dbQ } = await s.from('questions').select('id, primary_article_id')
          .eq('question_text', q.question).limit(1);

        if (!dbQ || dbQ.length === 0) { skipped++; continue; }

        const question = dbQ[0];

        // Check if it's linked to a bad catch-all
        if (!badArt0Ids.has(question.primary_article_id)) {
          alreadyCorrect++;
          continue;
        }

        // Determine correct law
        let targetArt0 = null;

        // Strategy 1: tema has a dominant law
        const dominant = temaDominantLaw.get(tema);
        if (dominant) {
          targetArt0 = await getOrCreateArt0(dominant.lawId, dominant.lawName);
        }

        // Strategy 2: manual mapping for virtual temas
        if (!targetArt0 && TEMA_TO_VIRTUAL_LAW[tema]) {
          const virtualLawId = await getOrCreateVirtualLaw(TEMA_TO_VIRTUAL_LAW[tema]);
          targetArt0 = await getOrCreateArt0(virtualLawId, TEMA_TO_VIRTUAL_LAW[tema]);
        }

        // Strategy 3: keep on catch-all (shouldn't happen if mapping is complete)
        if (!targetArt0) {
          skipped++;
          continue;
        }

        // Update the question
        const { error } = await s.from('questions').update({ primary_article_id: targetArt0 })
          .eq('id', question.id);

        if (error) { errors++; } else { fixed++; fileFixed++; }
      }

      if (fileFixed > 0) process.stdout.write(`  [${file.substring(0, 40)}] ${fileFixed} fixed\n`);
    }
  }

  console.log('\n=== RESULTS ===');
  console.log('Fixed:', fixed);
  console.log('Already correct:', alreadyCorrect);
  console.log('Skipped (not in BD):', skipped);
  console.log('Errors:', errors);

  // Final: count remaining on bad catch-alls
  for (const artId of badArt0Ids) {
    const { count } = await s.from('questions').select('id', { count: 'exact', head: true })
      .eq('primary_article_id', artId);
    if (count > 0) console.log('  Still on catch-all ' + artId.substring(0, 8) + ':', count);
  }
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
