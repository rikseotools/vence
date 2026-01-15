// scripts/parse-auxilio-judicial-exams.cjs
// Parsea exámenes oficiales de Auxilio Judicial desde PDFs

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PDF_DIR = path.join(__dirname, '..', 'data/examenes/auxilio-judicial/pdfs');
const OUTPUT_DIR = path.join(__dirname, '..', 'data/examenes/auxilio-judicial/json');

// Normalizar texto para comparación
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calcular similitud Levenshtein
function similarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;

  const costs = [];
  for (let i = 0; i <= str1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[str2.length] = lastValue;
  }
  return (longer.length - costs[str2.length]) / longer.length;
}

// Generar hash de contenido (igual que la BD)
function generateContentHash(questionText, optionA, optionB, optionC, optionD) {
  const content = [questionText, optionA, optionB, optionC, optionD]
    .map(s => normalizeText(s || ''))
    .join('|');
  return crypto.createHash('md5').update(content).digest('hex');
}

// Extraer texto de PDF
function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (e) {
    console.error(`Error extrayendo ${pdfPath}:`, e.message);
    return '';
  }
}

// Parsear respuestas desde PDF de plantilla
function parseAnswers(text) {
  const answers = {};
  // Formato: "Nº X      LETRA" o "Nº X    LETRA"
  const regex = /Nº\s*(\d+)\s+([ABCD])/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    answers[parseInt(match[1])] = match[2].toUpperCase();
  }
  return answers;
}

// Parsear preguntas desde PDF de examen
function parseQuestions(text) {
  const questions = [];
  const lines = text.split('\n');

  let currentQuestion = null;
  let currentOption = null;
  let optionBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignorar líneas de pie de página
    if (/Página\s+\d+\s+de\s+\d+/i.test(line) ||
        /AUXILIO\s+JUDICIAL/i.test(line) ||
        /^[\s]*$/.test(line)) {
      continue;
    }

    // Nueva pregunta: número seguido de punto
    const questionMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (questionMatch) {
      // Guardar pregunta anterior
      if (currentQuestion) {
        if (currentOption && optionBuffer.trim()) {
          currentQuestion.options[currentOption] = optionBuffer.trim();
        }
        questions.push(currentQuestion);
      }

      currentQuestion = {
        number: parseInt(questionMatch[1]),
        text: questionMatch[2].trim(),
        options: { a: '', b: '', c: '', d: '' }
      };
      currentOption = null;
      optionBuffer = '';
      continue;
    }

    // Opción: a), b), c), d)
    const optionMatch = line.match(/^\s*([abcd])\)\s*(.*)$/i);
    if (optionMatch && currentQuestion) {
      // Guardar opción anterior
      if (currentOption && optionBuffer.trim()) {
        currentQuestion.options[currentOption] = optionBuffer.trim();
      }

      currentOption = optionMatch[1].toLowerCase();
      optionBuffer = optionMatch[2].trim();
      continue;
    }

    // Continuación de texto (pregunta u opción)
    const trimmedLine = line.trim();
    if (trimmedLine && currentQuestion) {
      if (currentOption) {
        // Continuación de opción
        optionBuffer += ' ' + trimmedLine;
      } else {
        // Continuación de pregunta
        currentQuestion.text += ' ' + trimmedLine;
      }
    }
  }

  // Guardar última pregunta
  if (currentQuestion) {
    if (currentOption && optionBuffer.trim()) {
      currentQuestion.options[currentOption] = optionBuffer.trim();
    }
    questions.push(currentQuestion);
  }

  return questions;
}

// Combinar preguntas con respuestas
function combineQuestionsWithAnswers(questions, answers) {
  return questions.map(q => ({
    ...q,
    correctAnswer: answers[q.number] || null
  })).filter(q => q.correctAnswer); // Solo preguntas con respuesta
}

// Buscar duplicados en BD
async function findDuplicates(questions, dbQuestions) {
  const results = {
    new: [],
    duplicates: [],
    possible: []
  };

  // Crear maps para búsqueda rápida
  const dbHashes = new Set(dbQuestions.map(q => q.content_hash));
  const dbNormTexts = new Map();

  for (const q of dbQuestions) {
    const norm = normalizeText(q.question_text);
    dbNormTexts.set(norm, q);
  }

  for (const q of questions) {
    const hash = generateContentHash(
      q.text,
      q.options.a,
      q.options.b,
      q.options.c,
      q.options.d
    );

    // 1. Coincidencia exacta por hash
    if (dbHashes.has(hash)) {
      results.duplicates.push({ ...q, matchType: 'hash_exact' });
      continue;
    }

    // 2. Coincidencia por texto normalizado
    const normText = normalizeText(q.text);
    if (dbNormTexts.has(normText)) {
      results.duplicates.push({ ...q, matchType: 'text_exact' });
      continue;
    }

    // 3. Similitud alta (>85%)
    let foundSimilar = false;
    for (const [dbNorm, dbQ] of dbNormTexts) {
      const sim = similarity(normText, dbNorm);
      if (sim > 0.85) {
        results.duplicates.push({ ...q, matchType: 'similar', similarity: Math.round(sim * 100), matchedWith: dbQ.question_text.substring(0, 50) });
        foundSimilar = true;
        break;
      } else if (sim > 0.70) {
        results.possible.push({ ...q, similarity: Math.round(sim * 100), matchedWith: dbQ.question_text.substring(0, 50) });
        foundSimilar = true;
        break;
      }
    }

    if (!foundSimilar) {
      results.new.push(q);
    }
  }

  return results;
}

// Procesar un par de archivos (examen + respuestas)
async function processExamPair(examFile, answersFile, year, convocatoria) {
  console.log(`\n📄 Procesando: ${examFile}`);

  const examPath = path.join(PDF_DIR, examFile);
  const answersPath = path.join(PDF_DIR, answersFile);

  if (!fs.existsSync(examPath)) {
    console.log(`   ❌ No existe: ${examFile}`);
    return null;
  }

  // Extraer texto
  const examText = extractPdfText(examPath);
  const answersText = fs.existsSync(answersPath) ? extractPdfText(answersPath) : '';

  // Parsear
  const questions = parseQuestions(examText);
  const answers = parseAnswers(answersText);

  console.log(`   📊 Preguntas extraídas: ${questions.length}`);
  console.log(`   📊 Respuestas encontradas: ${Object.keys(answers).length}`);

  // Combinar
  const combined = combineQuestionsWithAnswers(questions, answers);
  console.log(`   📊 Preguntas con respuesta: ${combined.length}`);

  return {
    year,
    convocatoria,
    examFile,
    answersFile,
    questions: combined
  };
}

// Detectar pares de archivos
function detectExamPairs() {
  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  const pairs = [];

  // Patrones conocidos
  const patterns = [
    // 2024-sep-parte1.pdf + 2024-sep-parte1-resp.pdf
    { exam: /^(\d{4})-(.*)-parte1\.pdf$/, resp: (m) => `${m[1]}-${m[2]}-parte1-resp.pdf` },
    { exam: /^(\d{4})-(.*)-parte2\.pdf$/, resp: (m) => `${m[1]}-${m[2]}-parte2-resp.pdf` },
    // 2023-parte1.pdf + 2023-parte1-resp.pdf
    { exam: /^(\d{4})-parte1\.pdf$/, resp: (m) => `${m[1]}-parte1-resp.pdf` },
    { exam: /^(\d{4})-parte2\.pdf$/, resp: (m) => `${m[1]}-parte2-resp.pdf` },
    // 2025-test-modelo-A.pdf + 2025-test-plantilla-A.pdf
    { exam: /^(\d{4})-test-modelo-A\.pdf$/, resp: (m) => `${m[1]}-test-plantilla-A.pdf` },
    { exam: /^(\d{4})-practico-modelo-A\.pdf$/, resp: (m) => `${m[1]}-practico-plantilla-A.pdf` },
    // Otros formatos
    { exam: /^(\d{4})-incidencias-parte1\.pdf$/, resp: (m) => `${m[1]}-incidencias-parte1-resp.pdf` },
    { exam: /^(\d{4})-incidencias-parte2\.pdf$/, resp: (m) => `${m[1]}-incidencias-parte2-resp.pdf` },
  ];

  const processed = new Set();

  for (const file of files) {
    if (processed.has(file)) continue;

    for (const pattern of patterns) {
      const match = file.match(pattern.exam);
      if (match) {
        const respFile = pattern.resp(match);
        const year = match[1];
        const convocatoria = file.replace('.pdf', '');

        pairs.push({
          exam: file,
          resp: files.includes(respFile) ? respFile : null,
          year,
          convocatoria
        });

        processed.add(file);
        if (respFile) processed.add(respFile);
        break;
      }
    }
  }

  // Archivos especiales (con respuestas incluidas)
  for (const file of files) {
    if (processed.has(file)) continue;
    if (file.includes('completo-resp') || file.includes('con-respuestas')) {
      const yearMatch = file.match(/^(\d{4})/);
      pairs.push({
        exam: file,
        resp: file, // Respuestas en el mismo archivo
        year: yearMatch ? yearMatch[1] : 'unknown',
        convocatoria: file.replace('.pdf', '')
      });
      processed.add(file);
    }
  }

  return pairs.sort((a, b) => b.year.localeCompare(a.year));
}

// Cargar preguntas existentes de auxilio-judicial
async function loadExistingQuestions() {
  console.log('📊 Cargando preguntas existentes de Auxilio Judicial...');

  // Obtener topics de auxilio_judicial
  const { data: topics } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', 'auxilio_judicial');

  if (!topics || topics.length === 0) {
    console.log('   ⚠️ No hay topics de auxilio_judicial');
    return [];
  }

  // Obtener topic_scope para esos topics (contiene law_id y article_numbers)
  const topicIds = topics.map(t => t.id);
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .in('topic_id', topicIds);

  if (!scopes || scopes.length === 0) {
    console.log('   ⚠️ No hay topic_scope');
    return [];
  }

  // Obtener todas las leyes únicas
  const lawIds = [...new Set(scopes.map(s => s.law_id))];

  // Cargar artículos de esas leyes
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', lawIds);

  if (!articles || articles.length === 0) {
    console.log('   ⚠️ No hay artículos');
    return [];
  }

  const articleIds = articles.map(a => a.id);

  // Cargar preguntas de esos artículos
  let allQuestions = [];
  for (let i = 0; i < articleIds.length; i += 50) {
    const batch = articleIds.slice(i, i + 50);
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, content_hash')
      .in('primary_article_id', batch);

    if (data) allQuestions = allQuestions.concat(data);
  }

  console.log(`   ✅ ${allQuestions.length} preguntas cargadas`);
  return allQuestions;
}

// Importar preguntas nuevas a la BD
async function importQuestions(questions, examSource) {
  console.log(`\n📤 Importando ${questions.length} preguntas oficiales...`);

  // Obtener un article_id válido de las leyes de auxilio judicial
  // Primero obtenemos el topic_scope para conseguir law_id
  const { data: topics } = await supabase
    .from('topics')
    .select('id, title')
    .eq('position_type', 'auxilio_judicial')
    .order('topic_number')
    .limit(1);

  if (!topics || topics.length === 0) {
    console.log('   ❌ No se encontró topic de auxilio_judicial');
    return { inserted: 0, errors: 0 };
  }

  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topics[0].id)
    .limit(1)
    .single();

  if (!scope) {
    console.log('   ❌ No se encontró topic_scope');
    return { inserted: 0, errors: 0 };
  }

  // Buscar el primer artículo de esa ley
  const { data: article } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', scope.law_id)
    .order('article_number')
    .limit(1)
    .single();

  if (!article) {
    console.log('   ❌ No se encontró artículo');
    return { inserted: 0, errors: 0 };
  }

  const defaultArticleId = article.id;
  console.log(`   📍 Artículo destino: Art. ${article.article_number} - ${article.title?.substring(0, 40)}`);

  let inserted = 0;
  let errors = 0;
  let duplicates = 0;

  for (const q of questions) {
    const { error } = await supabase
      .from('questions')
      .insert({
        question_text: q.text,
        option_a: q.options.a,
        option_b: q.options.b,
        option_c: q.options.c,
        option_d: q.options.d,
        correct_option: { A: 0, B: 1, C: 2, D: 3 }[q.correctAnswer],
        explanation: `Pregunta oficial del examen de Auxilio Judicial ${examSource}`,
        primary_article_id: defaultArticleId,
        difficulty: 'medium',
        question_type: 'single',
        is_active: true,
        is_official_exam: true,
        exam_source: examSource
      });

    if (error) {
      if (error.message.includes('content_hash') || error.code === '23505') {
        duplicates++;
      } else {
        errors++;
        console.log(`   ❌ Error: ${error.message}`);
      }
    } else {
      inserted++;
    }
  }

  console.log(`   ✅ Insertadas: ${inserted} | 🔄 Duplicadas BD: ${duplicates} | ❌ Errores: ${errors}`);
  return { inserted, errors, duplicates };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🔍 Parser de Exámenes Oficiales - Auxilio Judicial');
  console.log('═'.repeat(60));

  // Crear directorio de output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Detectar pares de archivos
  const pairs = detectExamPairs();
  console.log(`\n📁 Pares de exámenes detectados: ${pairs.length}`);
  pairs.forEach(p => {
    console.log(`   ${p.year}: ${p.exam} + ${p.resp || '(sin respuestas)'}`);
  });

  // Cargar preguntas existentes para detección de duplicados
  const existingQuestions = await loadExistingQuestions();

  // Procesar cada par
  const allResults = [];
  let totalNew = 0;
  let totalDuplicates = 0;

  for (const pair of pairs) {
    if (!pair.resp) {
      console.log(`\n⏭️ Saltando ${pair.exam} (sin archivo de respuestas)`);
      continue;
    }

    const result = await processExamPair(
      pair.exam,
      pair.resp,
      pair.year,
      pair.convocatoria
    );

    if (result && result.questions.length > 0) {
      // Detectar duplicados
      const duplicateCheck = await findDuplicates(result.questions, existingQuestions);

      console.log(`   🆕 Nuevas: ${duplicateCheck.new.length}`);
      console.log(`   🔄 Duplicadas: ${duplicateCheck.duplicates.length}`);
      console.log(`   ⚠️ Posibles: ${duplicateCheck.possible.length}`);

      result.newQuestions = duplicateCheck.new;
      result.duplicates = duplicateCheck.duplicates;
      result.possible = duplicateCheck.possible;

      allResults.push(result);
      totalNew += duplicateCheck.new.length;
      totalDuplicates += duplicateCheck.duplicates.length;

      // Guardar JSON
      const jsonFile = path.join(OUTPUT_DIR, `${pair.convocatoria}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2));
    }
  }

  // Resumen
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`Total exámenes procesados: ${allResults.length}`);
  console.log(`Total preguntas nuevas: ${totalNew}`);
  console.log(`Total duplicadas (ya en BD): ${totalDuplicates}`);

  // Preguntar si importar
  if (totalNew > 0) {
    console.log('\n¿Importar preguntas nuevas a la BD?');
    console.log('Ejecutar con --import para importar');

    if (process.argv.includes('--import')) {
      console.log('\n📤 IMPORTANDO PREGUNTAS...');

      let totalInserted = 0;
      for (const result of allResults) {
        if (result.newQuestions.length > 0) {
          const { inserted } = await importQuestions(
            result.newQuestions,
            `${result.year} - ${result.convocatoria}`
          );
          totalInserted += inserted;
        }
      }

      console.log(`\n✅ Total importadas: ${totalInserted}`);
    }
  }

  console.log('\n✅ Proceso completado');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
