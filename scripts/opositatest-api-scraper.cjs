#!/usr/bin/env node
/**
 * Scraper de OpositaTest via API
 * Captura Convocatorias Anteriores y Supuestos Prácticos con TODOS los metadatos
 *
 * Uso: node scripts/opositatest-api-scraper.cjs
 */

const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, 'jwt-token.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir');
const PROGRESS_FILE = path.join(__dirname, 'api-scrape-progress.json');

// Configuración
const CONFIG = {
  oppositionId: 7, // Tramitación Procesal
  oppositionName: 'tramitacion-procesal',
  delayBetweenRequests: 1500, // ms
};

// Leer token
function getToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('❌ No se encontró jwt-token.txt');
    console.error('   Ejecuta primero: node scripts/extract-jwt.cjs');
    process.exit(1);
  }
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}

// API helper
async function api(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text.substring(0, 200)}`);
  }

  return res.json();
}

// Cargar/guardar progreso
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { scraped: {}, lastUpdate: null };
}

function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Obtener lista de exámenes
async function getExams(type) {
  console.log(`\n📋 Obteniendo exámenes tipo: ${type}...`);

  // Usamos los datos capturados del navegador ya que admin API no responde directamente
  // Endpoint: admin.opositatest.com/api/v2.0/exams?filters[opposition]=7&filters[type]=previousCall

  const url = `https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=${CONFIG.oppositionId}&filters[type]=${type}&pageSize=100`;

  try {
    const data = await api(url);
    console.log(`   ✅ ${data.resources?.length || 0} exámenes encontrados`);
    return data.resources || [];
  } catch (e) {
    console.log(`   ⚠️ Error obteniendo exámenes: ${e.message}`);
    return [];
  }
}

// Crear test y obtener preguntas
async function getExamQuestions(exam) {
  console.log(`\n🎯 Procesando: ${exam.title}`);
  console.log(`   ID: ${exam.id}, Tipo: ${exam.type}`);

  // 1. Crear test
  console.log('   📝 Creando test...');
  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id }),
  });

  if (!test.id) {
    throw new Error('No se pudo crear el test');
  }

  console.log(`   ✅ Test creado: ${test.id}`);
  console.log(`   📖 Preguntas: ${test.questions?.length || 0}`);

  // 2. Extraer datos completos
  const result = {
    // Metadatos del examen
    metadata: {
      examId: exam.id,
      testId: test.id,
      title: exam.title,
      type: exam.type,
      editionId: exam.editionId,
      isDemo: exam.isDemo,
      isIncludedInNormalSubscription: exam.isIncludedInNormalSubscription,
      maxDuration: exam.maxDuration,
      isMaxDurationMandatory: exam.isMaxDurationMandatory,
      permissions: exam.permissions,
      requiredRoles: exam.requiredRoles,
      initDate: exam.initDate,
      realizationLimit: exam.realizationLimit,
    },

    // Metadatos del test generado
    testMetadata: {
      oppositionId: test.oppositionId,
      state: test.state,
      statement: test.statement, // Enunciado del supuesto práctico
      createdAt: test.createdAt,
      config: test.config,
      info: test.info,
      generationInfo: test.generationInfo,
    },

    // Info de scraping
    scrapedAt: new Date().toISOString(),
    source: 'opositatest-api',
    oppositionName: CONFIG.oppositionName,
    questionCount: test.questions?.length || 0,

    // Preguntas con todos los metadatos
    questions: (test.questions || []).map((q, idx) => ({
      // Identificadores
      id: q.id,
      position: idx + 1,

      // Contenido principal
      question: q.declaration,
      organization: q.organization,

      // Opciones de respuesta
      options: (q.answers || []).map(a => ({
        id: a.id,
        text: a.declaration,
        isCorrect: a.id === q.correctAnswerId,
      })),

      // Respuesta correcta
      correctAnswerId: q.correctAnswerId,
      correctAnswer: (q.answers || []).find(a => a.id === q.correctAnswerId)?.declaration,
      correctLetter: getCorrectLetter(q.answers, q.correctAnswerId),

      // Explicación
      explanation: q.reason || null,

      // Estados
      isAnnulled: q.isAnnulled,
      isRepealed: q.isRepealed,
      isDeleted: q.isDeleted,

      // Interacción del usuario (si la hay)
      answeredId: q.answeredId,
      isDoubtful: q.isDoubtful,
      isHighlighted: q.isHighlighted,

      // Media
      image: q.image,

      // Temas/contenidos asociados
      contents: (q.contents || []).map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),

      // Metadatos adicionales
      rawAnswers: q.answers, // Respuestas originales completas
    })),
  };

  return result;
}

// Obtener letra correcta (A, B, C, D)
function getCorrectLetter(answers, correctId) {
  if (!answers || !correctId) return null;
  const idx = answers.findIndex(a => a.id === correctId);
  return idx >= 0 ? String.fromCharCode(65 + idx) : null; // 0=A, 1=B, etc.
}

// Guardar JSON
function saveExamData(data, subdir) {
  const dir = path.join(OUTPUT_DIR, CONFIG.oppositionName, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Limpiar título para nombre de archivo
  const filename = data.metadata.title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80) + '.json';

  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  console.log(`   💾 Guardado: ${filename}`);
  return filepath;
}

// Sleep
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Scrapear tipo de examen
async function scrapeExamType(type, subdir) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📚 SCRAPEANDO: ${type.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);

  const progress = loadProgress();
  const exams = await getExams(type);

  if (exams.length === 0) {
    console.log('   ⚠️ No se encontraron exámenes');
    return;
  }

  let scraped = 0;
  let skipped = 0;
  let errors = 0;

  for (const exam of exams) {
    const key = `${type}::${exam.id}`;

    if (progress.scraped[key]) {
      console.log(`\n⏭️ Saltando (ya scrapeado): ${exam.title.substring(0, 50)}...`);
      skipped++;
      continue;
    }

    try {
      const data = await getExamQuestions(exam);
      saveExamData(data, subdir);

      progress.scraped[key] = {
        examId: exam.id,
        title: exam.title,
        questionCount: data.questionCount,
        scrapedAt: new Date().toISOString(),
      };
      saveProgress(progress);

      scraped++;
      await sleep(CONFIG.delayBetweenRequests);

    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Resumen ${type}:`);
  console.log(`   ✅ Scrapeados: ${scraped}`);
  console.log(`   ⏭️ Saltados: ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
}

// Usar datos hardcodeados si la API no responde
async function getExamsHardcoded() {
  // Datos capturados del navegador
  return {
    previousCall: [
      { id: 709137, title: "Examen Tramitación Procesal Turno Libre, 11 de Marzo de 2012 (OEP 2011)", type: "previousCall", editionId: 82 },
      { id: 707425, title: "Examen Tramitación Procesal Turno Libre, 3 de Julio de 2016 (OEP 2015)", type: "previousCall", editionId: 83 },
      { id: 1143624, title: "Examen Tramitación Procesal Turno Libre, 12 de mayo de 2018 (OEP 2016)", type: "previousCall", editionId: 91 },
      { id: 7215420, title: "Examen Tramitación Procesal Turno Libre, 2020 (OEP 2017 y 2018)", type: "previousCall", editionId: 147 },
      { id: 29734933, title: "Examen Tramitación Procesal Turno Libre, 2023 (OEP 2020, 2021, 2022)", type: "previousCall", editionId: 345 },
      { id: 35968319, title: "Examen Tramitación Procesal Turno Libre Estabilización, 2 de marzo de 2024 (OEP 2021)", type: "previousCall", editionId: 392 },
      { id: 40195044, title: "Examen Tramitación Procesal Turno Libre, 28 de septiembre de 2024 (OEP 2023)", type: "previousCall", editionId: 441 },
      { id: 49481489, title: "Tercer Ejercicio Tramitación Procesal turno libre (OEP 2024)", type: "previousCall", editionId: 539 },
      { id: 49485348, title: "Examen Tramitación Procesal Turno Libre, 27 de septiembre de 2025 (OEP 2024)", type: "previousCall", editionId: 539 },
    ],
    practicalCase: [
      { id: 49478717, title: "Examen Supuesto Práctico Tramitación Procesal Turno Libre, 2025 (OEP 2024)", type: "alleged", editionId: 539 },
    ],
  };
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  OPOSITATEST API SCRAPER - Convocatorias y Supuestos       ║');
  console.log('║  Captura TODOS los metadatos para uso posterior            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Verificar token
  getToken();
  console.log('✅ Token JWT encontrado');

  // Intentar obtener exámenes de la API, o usar datos hardcodeados
  let exams;
  try {
    const previousCall = await getExams('previousCall');
    const practicalCase = await getExams('alleged');

    if (previousCall.length > 0 || practicalCase.length > 0) {
      exams = { previousCall, practicalCase };
    } else {
      throw new Error('API no devolvió datos');
    }
  } catch (e) {
    console.log('\n⚠️ Usando datos capturados del navegador...');
    exams = await getExamsHardcoded();
  }

  // Procesar Convocatorias Anteriores
  console.log(`\n📋 Convocatorias Anteriores: ${exams.previousCall.length}`);
  for (const exam of exams.previousCall) {
    console.log(`   - ${exam.title}`);
  }

  // Procesar Supuestos Prácticos
  console.log(`\n📋 Supuestos Prácticos: ${exams.practicalCase.length}`);
  for (const exam of exams.practicalCase) {
    console.log(`   - ${exam.title}`);
  }

  // Scrapear
  const progress = loadProgress();

  for (const exam of exams.previousCall) {
    const key = `previousCall::${exam.id}`;
    if (progress.scraped[key]) {
      console.log(`\n⏭️ Saltando: ${exam.title.substring(0, 50)}...`);
      continue;
    }

    try {
      const data = await getExamQuestions(exam);
      saveExamData(data, 'convocatorias-anteriores');

      progress.scraped[key] = {
        examId: exam.id,
        title: exam.title,
        questionCount: data.questionCount,
        scrapedAt: new Date().toISOString(),
      };
      saveProgress(progress);

      await sleep(CONFIG.delayBetweenRequests);
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }

  for (const exam of exams.practicalCase) {
    const key = `practicalCase::${exam.id}`;
    if (progress.scraped[key]) {
      console.log(`\n⏭️ Saltando: ${exam.title.substring(0, 50)}...`);
      continue;
    }

    try {
      const data = await getExamQuestions(exam);
      saveExamData(data, 'supuestos-practicos');

      progress.scraped[key] = {
        examId: exam.id,
        title: exam.title,
        questionCount: data.questionCount,
        scrapedAt: new Date().toISOString(),
      };
      saveProgress(progress);

      await sleep(CONFIG.delayBetweenRequests);
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }

  // Resumen final
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('═'.repeat(60));

  const finalProgress = loadProgress();
  const previousCallScraped = Object.keys(finalProgress.scraped).filter(k => k.startsWith('previousCall')).length;
  const practicalCaseScraped = Object.keys(finalProgress.scraped).filter(k => k.startsWith('practicalCase')).length;

  console.log(`✅ Convocatorias Anteriores: ${previousCallScraped}/${exams.previousCall.length}`);
  console.log(`✅ Supuestos Prácticos: ${practicalCaseScraped}/${exams.practicalCase.length}`);
  console.log(`\n📁 Output: ${path.join(OUTPUT_DIR, CONFIG.oppositionName)}`);
}

main().catch(e => {
  console.error('\n❌ Error fatal:', e.message);
  process.exit(1);
});
