const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Leyes que ahora sabemos que existen
const LAWS = {
  RD366: '449d1c85-ab44-4401-99b5-1a454d5b2e45',     // RD 366/2007 Accesibilidad
  LO4: '34891744-aac3-442d-91ca-377f18a71b45',       // LO 4/2001 Derecho Petición
  LEY2014: 'f76a0a5f-9e39-43ff-9dd9-d90826ffeba1',  // Ley 2/2014 Acción exterior
  // Leyes ya usadas
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LPAC: '218452f5-b9f6-48f0-a25b-26df9cb19644',
  LRJSP: '95680d57-feb1-41c0-bb27-236024815feb',
  RD208: 'a76f584e-26d4-4c50-afef-b7811cc2bffd',
  RD951: '07c2113d-cc6b-499c-8412-adf79692d390',
  TREBEP: 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0'
};

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // RD 366/2007 - Accesibilidad
  if (textLower.includes('366/2007') || textLower.includes('rd 366') ||
      textLower.includes('condiciones de accesibilidad')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RD366', article: artMatch ? artMatch[1] : null };
  }

  // Ley 2/2014 - Acción exterior (ANTES de LO 4/2001 para evitar confusión)
  if (textLower.includes('2/2014') || textLower.includes('ley 2/2014') ||
      textLower.includes('acción y del servicio exterior') || textLower.includes('acción exterior')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LEY2014', article: artMatch ? artMatch[1] : null };
  }

  // LO 4/2001 - Derecho de Petición
  if (textLower.includes('4/2001') || textLower.includes('lo 4/2001') ||
      textLower.includes('derecho de petición') || textLower.includes('ley orgánica 4/2001') ||
      textLower.includes('reguladora del derecho de petición')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LO4', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

async function reimportDir(dirPath, tag, bloque) {
  if (!fs.existsSync(dirPath)) return { imported: 0, errors: [] };

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let imported = 0;
  const errors = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
    const data = JSON.parse(content);
    const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

    for (const q of data.questions) {
      // Verificar si ya existe
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) continue;

      const text = (q.explanation || '') + ' ' + (q.question || '');
      const { lawKey, article } = detectLawAndArticle(text);

      if (!lawKey || !article) continue;

      const lawId = LAWS[lawKey];
      if (!lawId) continue;

      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', article)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 40), reason: `${lawKey} Art.${article}` });
        continue;
      }

      const { error } = await supabase.from('questions').insert({
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: art.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [subtema.trim(), tag, bloque]
      });

      if (!error) {
        imported++;
        console.log('  ✅', lawKey, 'Art', article, '-', q.question.substring(0, 35) + '...');
      }
    }
  }

  return { imported, errors };
}

(async () => {
  console.log('=== Reimportando preguntas con leyes ahora disponibles ===\n');

  // T201 - Atención al público (RD 366/2007, LO 4/2001)
  console.log('📁 T201 - Atención al público');
  const r1 = await reimportDir(
    '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_Atención_al_público',
    'T201', 'Bloque II'
  );
  console.log(`  Importadas: ${r1.imported}`);

  // T108 - AGE (Ley 2/2014)
  console.log('\n📁 T108 - Administración General del Estado');
  const r2 = await reimportDir(
    '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_8,_La_Administración_General_del_Estado',
    'T108', 'Bloque I'
  );
  console.log(`  Importadas: ${r2.imported}`);

  console.log('\n=== RESUMEN ===');
  console.log('T201:', r1.imported);
  console.log('T108:', r2.imported);
  console.log('Total:', r1.imported + r2.imported);

  if (r1.errors.length + r2.errors.length > 0) {
    console.log('\nErrores:');
    for (const e of [...r1.errors, ...r2.errors].slice(0, 10)) {
      console.log('  -', e.reason, ':', e.q);
    }
  }
})();
