#!/usr/bin/env node
/**
 * Scraper completo de TuTestDigital
 * Descarga TODOS los libros disponibles organizados por libro/tema
 *
 * Uso: node scripts/tutestdigital-scraper-completo.cjs
 *      node scripts/tutestdigital-scraper-completo.cjs --libro 69
 *      node scripts/tutestdigital-scraper-completo.cjs --desde 50
 */

const fs = require('fs');
const path = require('path');

const JWT_FILE = path.join(__dirname, 'jwt-tutestdigital.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'tutestdigital');
const PROGRESS_FILE = path.join(__dirname, 'tutestdigital-scraper-progress.json');

const BASE_URL = 'https://back.tutestdigital.es';
const DELAY_MS = 300; // ms entre requests

// IDs de libros descubiertos (brute-force 1-148, Abril 2026)
const BOOK_IDS = [
  1, 3, 4, 7, 13, 14, 16, 19, 20, 21, 23, 26, 27, 28, 31, 32, 33, 34,
  37, 38, 39, 40, 42, 43, 44, 45, 49, 51, 54, 55, 57, 58, 63, 66, 67,
  69, 71, 72, 73, 74, 76, 79, 80, 83, 85, 89, 90, 98, 99, 102, 103,
  105, 106, 107, 108, 113, 118, 119, 120, 121, 123, 124, 125, 126, 127,
  128, 129, 130, 131, 132, 133, 134, 135, 136, 138, 139, 140, 141, 143,
  144, 145, 146, 147, 148
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

function getJwt() {
  if (!fs.existsSync(JWT_FILE)) {
    console.error('❌ No se encontró scripts/jwt-tutestdigital.txt');
    console.error('   Copia el Bearer token desde DevTools → Network → Authorization');
    process.exit(1);
  }
  return fs.readFileSync(JWT_FILE, 'utf8').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(text) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 60);
}

function sanitizeFilename(text) {
  return text
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Elimina coletillas al final de preguntas entre paréntesis.
 * MANTIENE las instrucciones que forman parte de la pregunta.
 *
 * Patrones que se eliminan:
 *   - (TEST ESTATUTO AUTONOMÍA...)   → marca "TEST ..."
 *   - (Ley 9/2017)                  → etiqueta de ley
 *   - (LEY 31/1995)                 → etiqueta de ley en mayúsculas
 *   - (Real Decreto 203/2021)        → etiqueta de RD
 *   - (REAL DECRETO 500/1990)        → ídem en mayúsculas
 *   - (DECRETO 1955)                 → etiqueta de decreto
 *   - (D.V.)                         → marca de editorial "Doble Vuelta"
 *   - (LA CONSTITUCIÓN ESPAÑOLA)     → etiqueta de fuente
 *   - (Constitución Española)        → ídem
 *   - (INFORMÁTICA BÁSICA)           → etiqueta de tema
 *   - (PROCESADOR DE TEXTO: WORD)    → etiqueta de tema
 *   - (HOJA DE CÁLCULO: EXCEL)       → etiqueta de tema
 *   - (WINDOWS 10) / (WINDOWS 11)    → etiqueta de tema
 *   - (Atención al público)          → etiqueta de tema
 *   - (LEY 2/1979 EL TRIBUNAL...)    → etiqueta de ley con descripción
 *
 * Patrones que se MANTIENEN (son parte de la instrucción):
 *   - (indica la respuesta incorrecta)
 *   - (marca la opción incorrecta)
 *   - (señala la incorrecta)
 *   - (elige la correcta)
 *   - (todas son correctas)
 *   - etc.
 */
function cleanQuestion(text) {
  if (!text) return text;

  // Instrucciones que son parte de la pregunta → NO tocar
  const KEEP_PATTERNS = [
    /indica.*respuesta/i,
    /indica.*opci/i,
    /marca.*incorrecta/i,
    /marca.*correcta/i,
    /se\u00f1ala.*incorrecta/i,
    /se\u00f1ala.*correcta/i,
    /elige.*correcta/i,
    /elige.*incorrecta/i,
    /todas son/i,
    /ninguna es/i,
    /cu\u00e1l es correcta/i,
    /cu\u00e1l es incorrecta/i,
    /cu\u00e1l no es/i,
    /cu\u00e1l s\u00ed es/i,
    /es falsa/i,
    /es verdadera/i,
    /es incorrecta/i,
    /es correcta/i,
    /^#/,                    // errores de hoja de cálculo: (#VALOR!), (#REF!), (#N/A)
    /fecha actual/i,         // contenido explicativo que forma parte de la pregunta
    /número total de/i,      // idem
  ];

  // Ver si hay paréntesis al final
  const match = text.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return text.trim();

  const before = match[1];
  const inside = match[2];

  // Si el contenido del paréntesis parece una instrucción → mantener
  if (KEEP_PATTERNS.some(p => p.test(inside))) {
    return text.trim();
  }

  // Si no es una instrucción, es una etiqueta → eliminar y limpiar recursivo
  // (por si hay varias coletillas anidadas)
  return cleanQuestion(before.trim());
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function apiFetch(endpoint) {
  const jwt = getJwt();
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function getBookInfo(bookId) {
  // Solo metadatos del libro (título, descripción) - sin preguntas
  const data = await apiFetch(`/api/Books/${bookId}`);
  if (!data) return null;
  return {
    id: data.id,
    titulo: data.titulo,
    descripcion: data.descripcion,
    fechaCreacion: data.fechaCreacion,
    totalPreguntas: data.libroPreguntas?.length ?? 0
  };
}

async function getTemas(bookId) {
  const data = await apiFetch(`/api/Temas/book/${bookId}`);
  if (!data) return [];
  return data.temas || [];
}

async function getPreguntasTema(temaId, bookId) {
  const data = await apiFetch(`/api/Temas/${temaId}/libro/${bookId}/preguntas`);
  if (!data) return [];
  return Array.isArray(data) ? data : [];
}

// ─── Progreso ─────────────────────────────────────────────────────────────────

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { completedBooks: [], failedBooks: [], lastUpdate: null };
}

function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── Transformar preguntas ────────────────────────────────────────────────────

function transformPreguntas(preguntas) {
  return preguntas.map(q => {
    const opciones = q.opciones || [];
    const correctIdx = opciones.findIndex(o => o.esCorrecta);
    return {
      question: cleanQuestion(q.enunciado),
      options: opciones.map((o, i) => ({
        letter: ['A', 'B', 'C', 'D'][i],
        text: o.texto
      })),
      correctAnswer: correctIdx >= 0 ? ['A', 'B', 'C', 'D'][correctIdx] : null,
      explanation: q.explicacionCorrecta || null
    };
  });
}

// ─── Scraper principal ────────────────────────────────────────────────────────

async function scrapeBook(bookId, progress) {
  console.log(`\n📚 Libro ${bookId}...`);

  // 1. Info del libro
  const bookInfo = await getBookInfo(bookId);
  if (!bookInfo) {
    console.log(`   ⚠️  404 - libro no existe`);
    return false;
  }

  console.log(`   "${bookInfo.titulo}" (${bookInfo.totalPreguntas} pregs)`);

  // 2. Crear carpeta del libro
  const bookSlug = `libro-${bookId}-${slugify(bookInfo.titulo)}`;
  const bookDir = path.join(OUTPUT_DIR, bookSlug);
  fs.mkdirSync(bookDir, { recursive: true });

  // 3. Guardar metadatos del libro
  const metaPath = path.join(bookDir, '_metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...bookInfo,
    scrapedAt: new Date().toISOString()
  }, null, 2));

  await sleep(DELAY_MS);

  // 4. Obtener temas
  const temas = await getTemas(bookId);
  if (temas.length === 0) {
    console.log(`   ⚠️  Sin temas - guardando como libro sin temas`);
    // Si no hay temas, descargamos todo el libro de una
    const bookData = await apiFetch(`/api/Books/${bookId}`);
    if (bookData?.libroPreguntas?.length > 0) {
      const preguntas = bookData.libroPreguntas
        .sort((a, b) => a.orden - b.orden)
        .map(lp => lp.pregunta);

      const transformed = transformPreguntas(preguntas);
      const output = {
        tema: bookInfo.titulo,
        temaId: null,
        libroId: bookId,
        source: 'tutestdigital',
        scrapedAt: new Date().toISOString(),
        questionCount: transformed.length,
        questions: transformed
      };
      const filename = sanitizeFilename('Todas_las_preguntas') + '.json';
      fs.writeFileSync(path.join(bookDir, filename), JSON.stringify(output, null, 2));
      console.log(`   ✅ ${transformed.length} preguntas guardadas`);
    }
    return true;
  }

  console.log(`   📋 ${temas.length} temas encontrados`);

  // 5. Para cada tema, descargar preguntas
  let totalPregs = 0;
  for (let i = 0; i < temas.length; i++) {
    const tema = temas[i];
    const temaNum = i + 1;

    // Comprobar si ya está descargado
    const filename = sanitizeFilename(`Tema_${temaNum}.-_${tema.titulo}`) + '.json';
    const filePath = path.join(bookDir, filename);

    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`   ✓  Tema ${temaNum}: ya existe (${existing.questionCount} pregs)`);
      totalPregs += existing.questionCount;
      continue;
    }

    await sleep(DELAY_MS);

    const preguntas = await getPreguntasTema(tema.id, bookId);
    const transformed = transformPreguntas(preguntas);

    const output = {
      tema: tema.titulo,
      temaId: tema.id,
      libroId: bookId,
      source: 'tutestdigital',
      scrapedAt: new Date().toISOString(),
      questionCount: transformed.length,
      questions: transformed
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    totalPregs += transformed.length;
    console.log(`   ✅ Tema ${temaNum}/${temas.length}: ${tema.titulo.substring(0, 50)} (${transformed.length} pregs)`);
  }

  console.log(`   🎉 Libro ${bookId} completo: ${totalPregs} preguntas en ${temas.length} temas`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const singleBook = args.includes('--libro') ? parseInt(args[args.indexOf('--libro') + 1]) : null;
  const desdeId = args.includes('--desde') ? parseInt(args[args.indexOf('--desde') + 1]) : null;

  console.log('🚀 TuTestDigital Scraper Completo');
  console.log('================================');

  // Verificar JWT
  getJwt();
  console.log('✅ JWT cargado');

  // Crear directorio base
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Cargar progreso
  const progress = loadProgress();
  console.log(`📊 Progreso: ${progress.completedBooks.length} libros completados`);

  // Determinar qué libros procesar
  let booksToProcess = singleBook ? [singleBook] : BOOK_IDS;
  if (desdeId) {
    booksToProcess = BOOK_IDS.filter(id => id >= desdeId);
    console.log(`⏩ Empezando desde ID ${desdeId}`);
  }

  // Filtrar los ya completados (salvo que sea --libro específico)
  if (!singleBook) {
    booksToProcess = booksToProcess.filter(id => !progress.completedBooks.includes(id));
    console.log(`📚 ${booksToProcess.length} libros pendientes de ${BOOK_IDS.length} totales`);
  }

  let completados = 0;
  let errores = 0;

  for (const bookId of booksToProcess) {
    try {
      const ok = await scrapeBook(bookId, progress);
      if (ok) {
        if (!progress.completedBooks.includes(bookId)) {
          progress.completedBooks.push(bookId);
        }
        completados++;
      }
    } catch (err) {
      console.error(`   ❌ Error en libro ${bookId}: ${err.message}`);
      if (!progress.failedBooks.includes(bookId)) {
        progress.failedBooks.push(bookId);
      }
      errores++;
    }

    saveProgress(progress);
    await sleep(DELAY_MS);
  }

  console.log('\n================================');
  console.log(`✅ Completados: ${completados} libros`);
  console.log(`❌ Errores: ${errores} libros`);
  console.log(`📁 Salida: ${OUTPUT_DIR}`);

  if (progress.failedBooks.length > 0) {
    console.log(`⚠️  Libros con error: ${progress.failedBooks.join(', ')}`);
    console.log(`   Reintenta con: node scripts/tutestdigital-scraper-completo.cjs --libro <id>`);
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
