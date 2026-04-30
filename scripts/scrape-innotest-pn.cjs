#!/usr/bin/env node
/**
 * InnoTest Policía Nacional Scraper
 *
 * Scrapes all questions from InnoTest web API for Policía Nacional (oposicionID=2)
 * Uses server.innotest.app (web) with Bearer token from browser session
 *
 * Usage:
 *   node scripts/scrape-innotest-pn.cjs <TOKEN>
 *   # TOKEN = Bearer token from web.innotest.app DevTools (Network tab)
 *
 * Output: preguntas-para-subir/innotest-policia-nacional/
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('Usage: node scripts/scrape-innotest-pn.cjs <BEARER_TOKEN>');
  process.exit(1);
}

const BASE = 'https://server.innotest.app/api-apps-nuevas/Api/public';
const OPOSICION_ID = '2'; // Policía Nacional
const USUARIO_ID = 3313000;
const OUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-policia-nacional');

const HEADERS = {
  'Authorization': 'Bearer ' + TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Origin': 'https://web.innotest.app',
  'Referer': 'https://web.innotest.app/',
  'deviceID': '1'
};

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

async function fetchJSON(url, opts = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000), ...opts });
      return r.json();
    } catch (e) {
      console.log(`\n  ⚠ fetch error (attempt ${attempt}/${retries}): ${e.message}`);
      if (attempt === retries) return { success: false, data: null, error: e.message };
      await randomDelay(15000, 45000);
    }
  }
}

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

async function humanPause(context) {
  if (context === 'between_batches') await randomDelay(4000, 12000);
  else if (context === 'between_temas') await randomDelay(8000, 25000);
  else if (context === 'between_bloques') await randomDelay(30000, 60000);
  else if (context === 'image_download') await randomDelay(1000, 3000);
}

// ── Resume: check if tema file already exists with enough questions ──

function alreadyScraped(dir, index, slug, expectedCount) {
  const pattern = `tema${index + 1}_${slug}.json`;
  const filePath = path.join(OUT_DIR, dir, pattern);
  if (!fs.existsSync(filePath)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const coverage = data.downloadedCount / Math.max(1, expectedCount);
    if (coverage >= 0.5) return data;
  } catch {}
  return false;
}

// ── Get structure ───────────────────────────────────────────────────

async function getTemas(typeID, bloqueID) {
  const d = await fetchJSON(`${BASE}/api/v2/tests/${typeID}/oposicion/${OPOSICION_ID}/bloque/${bloqueID}/tipo/1`);
  if (!d.data) return [];

  const temas = [];
  for (const g of d.data) {
    // Type "temas" — temas inside groups
    if (g.temas) {
      for (const t of g.temas) {
        if (t.testID && t.testID > 0) {
          temas.push({
            nombre: t.nombre,
            testID: t.testID,
            preguntas: t.count_preguntas || 0,
            grupo: g.nombre || null
          });
        }
      }
    }
    // Type "oficiales" (year > detalle)
    else if (g.year && g.detalle) {
      for (const ex of g.detalle) {
        if (ex.testID && ex.testID > 0) {
          temas.push({
            nombre: ex.nombre,
            testID: ex.testID,
            preguntas: ex.count_preguntas || 0,
            grupo: g.year,
            fecha_examen: ex.fecha_examen
          });
        }
      }
    }
    // Type "tests" / flat list
    else if (g.testID && g.testID > 0) {
      temas.push({
        nombre: g.nombre,
        testID: g.testID,
        preguntas: g.count_preguntas || 0,
        grupo: null
      });
    }
  }
  return temas;
}

// ── Fetch questions for a tema ──────────────────────────────────────

async function fetchQuestions(testID, bloqueID, limite = 100) {
  const body = {
    bloqueID,
    dificultades: [4],
    evaluacion_ranking: 0,
    invitadoID: 0,
    limite,
    modoCorreccion: 1,
    oposicionID: OPOSICION_ID,
    ponderado: false,
    testID: [testID],
    test_tipoID: 2,
    tiempo: 999,
    tipo: 1,
    usuarioID: USUARIO_ID
  };

  const d = await fetchJSON(`${BASE}/api/v1/preguntastest`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (!d.success || !d.data || !d.data.preguntas) return [];
  return d.data.preguntas;
}

// ── Scrape a tema with retries until coverage plateau ───────────────

async function scrapeTema(testID, bloqueID, expectedCount) {
  const questionsMap = new Map();
  let emptyBatches = 0;
  const MAX_EMPTY = 2;
  const MAX_BATCHES = Math.max(5, Math.ceil(expectedCount / 80));
  let batch = 0;
  let consecutiveErrors = 0;

  while (emptyBatches < MAX_EMPTY && batch < MAX_BATCHES && consecutiveErrors < 3) {
    batch++;
    try {
      const qs = await fetchQuestions(testID, bloqueID, 100);
      let newCount = 0;

      for (const q of qs) {
        if (!questionsMap.has(q.id)) {
          questionsMap.set(q.id, q);
          newCount++;
        }
      }

      const coverage = expectedCount > 0 ? (questionsMap.size / expectedCount * 100).toFixed(1) : '?';
      process.stdout.write(`  batch ${batch}: +${newCount} new (total: ${questionsMap.size}/${expectedCount}, ${coverage}%)\r`);

      if (newCount === 0) emptyBatches++;
      else emptyBatches = 0;
      consecutiveErrors = 0;

      await humanPause('between_batches');
    } catch (e) {
      consecutiveErrors++;
      console.log(`\n  ⚠ scrapeTema error (${consecutiveErrors}/3): ${e.message}`);
      await randomDelay(15000, 45000);
    }
  }

  console.log(`  → ${questionsMap.size}/${expectedCount} (${(questionsMap.size / Math.max(1, expectedCount) * 100).toFixed(1)}%) in ${batch} batches`);
  return Array.from(questionsMap.values());
}

// ── Download images ─────────────────────────────────────────────────

async function downloadImage(imagePath, questionId) {
  if (!imagePath) return null;
  const url = `https://server.innotest.app/recursos/imagenes/${imagePath}`;
  const basename = path.basename(imagePath);
  const filename = `${questionId}_${basename}`;
  const outPath = path.join(OUT_DIR, 'imagenes', filename);

  if (fs.existsSync(outPath)) return filename;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return filename;
  } catch (e) {
    return null;
  }
}

// ── Transform question to our format ────────────────────────────────

function transformQuestion(q) {
  const correctResp = q.respuestas?.find(r => r.correcta === 1);
  const correctLetter = correctResp ? correctResp.orden?.replace(')', '') : null;

  return {
    innotest_id: q.id,
    question: q.enunciado,
    options: (q.respuestas || []).map(r => ({
      letter: r.orden?.replace(')', ''),
      text: r.respuesta,
      correct: r.correcta === 1
    })),
    correctAnswer: correctLetter,
    explanation: q.feedback || null,
    article: q.articulo ? {
      id: q.articulo.id,
      leyID: q.articulo.leyID,
      articulo: q.articulo.articulo,
      denominacion: q.articulo.denominacion,
      texto: q.articulo.texto,
      titulo: q.articulo.titulo
    } : null,
    image: q.image || null,
    imageLocal: null,
    tema: q.tema || null,
    referencia: q.referencia || null,
    tipoPregunta: q.tipoPregunta || 'normal',
    bloqueID: q.bloqueID
  };
}

// ── Scrape one full bloque ──────────────────────────────────────────

async function scrapeBloque(bloque, temas) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📚 ${bloque.label}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`${temas.length} temas encontrados\n`);

  // Ensure dir exists
  const dir = path.join(OUT_DIR, bloque.dir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Save structure
  fs.writeFileSync(path.join(dir, '_temas.json'), JSON.stringify(temas, null, 2));

  let bloqueTotal = 0;
  let bloqueImages = 0;

  for (let i = 0; i < temas.length; i++) {
    const tema = temas[i];
    const slug = slugify(tema.nombre);

    // Resume
    const existing = alreadyScraped(bloque.dir, i, slug, tema.preguntas);
    if (existing) {
      console.log(`[${i + 1}/${temas.length}] ${tema.nombre} — SKIP (already ${existing.downloadedCount}/${tema.preguntas})`);
      bloqueTotal += existing.downloadedCount;
      continue;
    }

    console.log(`[${i + 1}/${temas.length}] ${tema.nombre} (${tema.preguntas}q expected)`);

    try {
      const rawQs = await scrapeTema(tema.testID, bloque.bloqueID, tema.preguntas);
      const questions = rawQs.map(transformQuestion);

      // Download images
      for (const q of questions) {
        if (q.image) {
          try {
            const localFile = await downloadImage(q.image, q.innotest_id);
            if (localFile) {
              q.imageLocal = localFile;
              bloqueImages++;
              await humanPause('image_download');
            }
          } catch (imgErr) {
            console.log(`  ⚠ image error ${q.innotest_id}: ${imgErr.message}`);
          }
        }
      }

      // Save
      const filename = `tema${i + 1}_${slug}.json`;
      const output = {
        bloque: bloque.label,
        tema: tema.nombre,
        grupo: tema.grupo,
        testID: tema.testID,
        source: 'innotest',
        oposicion: 'policia-nacional',
        expectedCount: tema.preguntas,
        downloadedCount: questions.length,
        coverage: tema.preguntas > 0 ? (questions.length / tema.preguntas * 100).toFixed(1) + '%' : 'N/A',
        questions
      };

      fs.writeFileSync(path.join(dir, filename), JSON.stringify(output, null, 2));
      bloqueTotal += questions.length;
    } catch (temaErr) {
      console.log(`\n  ❌ Error en tema ${tema.nombre}: ${temaErr.message} — continuando`);
    }

    if (i < temas.length - 1) await humanPause('between_temas');
  }

  console.log(`\n✅ ${bloque.label}: ${bloqueTotal} preguntas, ${bloqueImages} imágenes`);
  return { temas: temas.length, preguntas: bloqueTotal, imagenes: bloqueImages };
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 InnoTest Policía Nacional Scraper');
  console.log('Token: ....' + TOKEN.substring(TOKEN.length - 20));
  console.log('Output: ' + OUT_DIR);
  console.log('');

  // Verify token
  const check = await fetchJSON(`${BASE}/api/v1/oposicionesselectorce`);
  if (!check.success) {
    console.error('❌ Token inválido o expirado');
    process.exit(1);
  }
  console.log('✅ Token válido\n');

  // All bloques to scrape — discovered via iniciobloque
  const BLOQUES = [
    { label: 'Conocimientos',              bloqueID: 2, typeID: 2,   dir: 'conocimientos' },
    { label: 'Exámenes oficiales',         bloqueID: 2, typeID: 4,   dir: 'examenes-oficiales' },
    { label: 'Específicos conocimientos',  bloqueID: 2, typeID: 28,  dir: 'especificos-conocimientos' },
    { label: 'Comunes con otras escalas',  bloqueID: 2, typeID: 30,  dir: 'comunes' },
    { label: 'Inglés temas',               bloqueID: 3, typeID: 2,   dir: 'ingles' },
    { label: 'Inglés tests',               bloqueID: 3, typeID: 3,   dir: 'ingles-tests' },
    { label: 'Psicotécnicos temas',        bloqueID: 4, typeID: 2,   dir: 'psicotecnicos' },
    { label: 'Psicotécnicos tests',        bloqueID: 4, typeID: 3,   dir: 'psicotecnicos-tests' },
    { label: 'Psicotécnicos específicos',  bloqueID: 4, typeID: 28,  dir: 'psicotecnicos-especificos' },
    { label: 'Psicotécnicos oficiales',    bloqueID: 4, typeID: 4,   dir: 'psicotecnicos-oficiales' },
    { label: 'Simulacros',                 bloqueID: 7, typeID: 21,  dir: 'simulacros' },
  ];

  const stats = {};
  let totalDownloaded = 0;
  let totalImages = 0;

  for (const bloque of BLOQUES) {
    const temas = await getTemas(bloque.typeID, bloque.bloqueID);
    if (temas.length === 0) {
      console.log(`\n⏭ ${bloque.label}: vacío, saltando`);
      continue;
    }

    const s = await scrapeBloque(bloque, temas);
    stats[bloque.label] = s;
    totalDownloaded += s.preguntas;
    totalImages += s.imagenes;

    await humanPause('between_bloques');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN FINAL — POLICÍA NACIONAL');
  console.log('═'.repeat(60));
  for (const [name, s] of Object.entries(stats)) {
    console.log(`  ${name}: ${s.temas} temas, ${s.preguntas} preguntas, ${s.imagenes} imágenes`);
  }
  console.log(`\n  TOTAL: ${totalDownloaded} preguntas, ${totalImages} imágenes`);

  // Save summary
  fs.writeFileSync(
    path.join(OUT_DIR, '_summary.json'),
    JSON.stringify({
      date: new Date().toISOString(),
      oposicion: 'policia-nacional',
      oposicionID: OPOSICION_ID,
      stats,
      totalDownloaded,
      totalImages
    }, null, 2)
  );
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
