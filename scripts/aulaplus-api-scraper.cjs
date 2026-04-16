#!/usr/bin/env node
/**
 * Aula Plus API Scraper
 *
 * Descarga todas las preguntas de https://app.aulaplusformacion.es
 * Usa el JWT auth de la API (ver docs/scraping/aulaplus-app-manual.md)
 *
 * Uso:
 *   export AULAPLUS_EMAIL=tu-email@dominio.es
 *   export AULAPLUS_PASSWORD=tu-password
 *   node scripts/aulaplus-api-scraper.cjs [options]
 *
 * Options:
 *   --delay=800         Delay ms entre peticiones (default 800)
 *   --from-page=1       Página inicial (para reanudar manualmente)
 *   --to-page=464       Página final (para parar antes del final)
 *   --no-images         No descargar imágenes
 *   --dry-run           No guardar nada, solo verifica conectividad
 *   --metadata-only     Solo descarga metadatos (branches, subjects, examiners...)
 *
 * Output:
 *   preguntas-para-subir/aula-plus/
 *   ├── raw/page_NNN.json          (1 archivo por página)
 *   ├── images/*                    (imágenes descargadas)
 *   ├── metadata/*.json             (taxonomías)
 *   └── scrape-progress.json        (estado para reanudar)
 */

const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = 'https://app.aulaplusformacion.es'
const API = BASE_URL + '/api'
const OUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'aula-plus')
const RAW_DIR = path.join(OUT_DIR, 'raw')
const IMG_DIR = path.join(OUT_DIR, 'images')
const META_DIR = path.join(OUT_DIR, 'metadata')
const PROGRESS_FILE = path.join(OUT_DIR, 'scrape-progress.json')
const TOKEN_FILE = path.join(OUT_DIR, '.jwt-token')

const ITEMS_PER_PAGE = 300
const IMAGE_CONCURRENCY = 5

// Args parsing
const argv = process.argv.slice(2)
const args = Object.fromEntries(
  argv
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v = true] = a.replace(/^--/, '').split('=')
      return [k, v]
    })
)

const DELAY_MS = parseInt(args.delay || '800')
const FROM_PAGE = parseInt(args['from-page'] || '0')  // 0 = usar progress
const TO_PAGE = parseInt(args['to-page'] || '0')       // 0 = hasta última
const NO_IMAGES = !!args['no-images']
const DRY_RUN = !!args['dry-run']
const META_ONLY = !!args['metadata-only']

const EMAIL = process.env.AULAPLUS_EMAIL
const PASSWORD = process.env.AULAPLUS_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('❌ Falta AULAPLUS_EMAIL o AULAPLUS_PASSWORD en env')
  console.error('   export AULAPLUS_EMAIL="tu-email@..."')
  console.error('   export AULAPLUS_PASSWORD="tu-password"')
  process.exit(1)
}

// ============================================================
// UTILS
// ============================================================

function log(...args) {
  const ts = new Date().toISOString().substring(11, 19)
  console.log(`[${ts}]`, ...args)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true })
}

async function readJson(p, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8'))
  } catch {
    return fallback
  }
}

async function writeJson(p, data) {
  await fs.writeFile(p, JSON.stringify(data, null, 2))
}

// ============================================================
// AUTH
// ============================================================

let TOKEN = null

async function login() {
  log('🔐 Login con', EMAIL)
  const res = await fetch(API + '/login_check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Login falló ${res.status}: ${body}`)
  }
  const data = await res.json()
  TOKEN = data.token
  await fs.writeFile(TOKEN_FILE, TOKEN)
  log(`✅ Login OK (userId ${data.id})`)
  return TOKEN
}

async function loadTokenOrLogin() {
  try {
    const t = await fs.readFile(TOKEN_FILE, 'utf-8')
    // Verificar que sigue válido
    const probe = await fetch(API + '/branches/1', {
      headers: { Authorization: 'Bearer ' + t.trim() }
    })
    if (probe.ok) {
      TOKEN = t.trim()
      log('🔐 Token cacheado válido')
      return TOKEN
    }
  } catch {}
  return login()
}

// ============================================================
// HTTP con retry/relogin
// ============================================================

async function apiGet(path, retries = 3) {
  const url = path.startsWith('http') ? path : API + path
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + TOKEN,
          Accept: 'application/ld+json'
        }
      })
      if (res.status === 401) {
        log('⚠️  401 detectado, re-login...')
        await login()
        continue
      }
      if (res.status === 429) {
        log('⚠️  429 rate limit, esperando 60s...')
        await sleep(60000)
        continue
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
      }
      return await res.json()
    } catch (e) {
      if (i === retries - 1) throw e
      log(`⚠️  Error (intento ${i + 1}/${retries}): ${e.message}. Retry en ${(i + 1) * 2}s`)
      await sleep((i + 1) * 2000)
    }
  }
}

// ============================================================
// METADATA
// ============================================================

async function fetchAllPages(path) {
  const all = []
  let page = 1
  while (true) {
    const d = await apiGet(`${path}?page=${page}&itemsPerPage=300`)
    const items = d['hydra:member'] || []
    all.push(...items)
    const total = d['hydra:totalItems'] || 0
    if (all.length >= total || items.length === 0) break
    page++
    if (page > 50) break  // safeguard
    await sleep(DELAY_MS)
  }
  return all
}

async function downloadMetadata() {
  log('📋 Descargando metadatos...')
  await ensureDir(META_DIR)

  const endpoints = [
    { name: 'branches', path: '/branches' },
    { name: 'subjects', path: '/subjects' },
    { name: 'examiners', path: '/examiners' },
    { name: 'origins', path: '/origins' },
    { name: 'legislation_branches', path: '/legislation_branches' },
    { name: 'test_types', path: '/test_types' },
    { name: 'question_levels', path: '/question_levels' },
    { name: 'estrategias', path: '/estrategias' },
    { name: 'broad_subjects', path: '/broad_subjects' },
    { name: 'courses', path: '/courses' }
  ]

  const counts = {}
  for (const ep of endpoints) {
    try {
      const items = await fetchAllPages(ep.path)
      if (!DRY_RUN) {
        await writeJson(path.join(META_DIR, ep.name + '.json'), items)
      }
      counts[ep.name] = items.length
      log(`  ✓ ${ep.name}: ${items.length}`)
    } catch (e) {
      log(`  ✗ ${ep.name}: ${e.message}`)
      counts[ep.name] = -1
    }
  }

  return counts
}

// ============================================================
// IMAGES DOWNLOAD QUEUE
// ============================================================

const imageQueue = new Set()
const imageDone = new Set()
const imageFail = new Set()
let imageActive = 0

async function downloadImage(imageName) {
  if (imageDone.has(imageName) || imageFail.has(imageName)) return
  const safeName = imageName.replace(/[\/\\]/g, '_')
  const localPath = path.join(IMG_DIR, safeName)
  try {
    await fs.access(localPath)
    imageDone.add(imageName)
    return  // ya existe
  } catch {}

  const url = BASE_URL + '/images/questions/' + encodeURIComponent(imageName)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      imageFail.add(imageName)
      return
    }
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(localPath, buf)
    imageDone.add(imageName)
  } catch (e) {
    imageFail.add(imageName)
  }
}

async function drainImages() {
  // Download with concurrency limit
  const arr = Array.from(imageQueue)
  imageQueue.clear()
  let i = 0
  async function worker() {
    while (i < arr.length) {
      const name = arr[i++]
      imageActive++
      await downloadImage(name)
      imageActive--
    }
  }
  const workers = Array.from({ length: IMAGE_CONCURRENCY }, worker)
  await Promise.all(workers)
}

function extractImagesFromQuestion(q) {
  const names = []
  if (q.questionImageName) names.push(q.questionImageName)
  if (q.feedbackImageName && q.feedbackImageName !== q.questionImageName) names.push(q.feedbackImageName)
  if (q.nombreImagenPregunta && !names.includes(q.nombreImagenPregunta)) names.push(q.nombreImagenPregunta)
  for (const a of q.answers || []) {
    if (a.imageName && !names.includes(a.imageName)) names.push(a.imageName)
  }
  return names
}

// ============================================================
// SCRAPE QUESTIONS
// ============================================================

async function loadProgress() {
  return (await readJson(PROGRESS_FILE)) || {
    startedAt: null,
    lastPage: 0,
    totalPages: 0,
    totalQuestions: 0,
    imagesDownloaded: 0,
    imagesFailed: 0
  }
}

async function saveProgress(p) {
  if (DRY_RUN) return
  await writeJson(PROGRESS_FILE, p)
}

async function scrapeQuestions() {
  const progress = await loadProgress()
  if (!progress.startedAt) progress.startedAt = new Date().toISOString()

  // Discover total
  const first = await apiGet('/questions?page=1&itemsPerPage=' + ITEMS_PER_PAGE)
  const total = first['hydra:totalItems']
  const lastPageUrl = first['hydra:view']?.['hydra:last'] || ''
  const lastPageMatch = lastPageUrl.match(/page=(\d+)/)
  const totalPages = lastPageMatch ? parseInt(lastPageMatch[1]) : Math.ceil(total / ITEMS_PER_PAGE)

  progress.totalPages = totalPages
  log(`📊 Total: ${total} preguntas · ${totalPages} páginas`)

  const startPage = FROM_PAGE > 0 ? FROM_PAGE : (progress.lastPage + 1)
  const endPage = TO_PAGE > 0 ? Math.min(TO_PAGE, totalPages) : totalPages

  log(`▶️  Scrape de páginas ${startPage} a ${endPage} (delay ${DELAY_MS}ms, imágenes ${NO_IMAGES ? 'OFF' : 'ON'})`)

  const t0 = Date.now()
  for (let page = startPage; page <= endPage; page++) {
    const data = page === 1 && startPage === 1
      ? first
      : await apiGet(`/questions?page=${page}&itemsPerPage=${ITEMS_PER_PAGE}`)

    const items = data['hydra:member'] || []

    if (!DRY_RUN) {
      const fname = `page_${String(page).padStart(3, '0')}.json`
      await writeJson(path.join(RAW_DIR, fname), data)
    }

    // Extraer imágenes
    if (!NO_IMAGES) {
      for (const q of items) {
        for (const name of extractImagesFromQuestion(q)) {
          imageQueue.add(name)
        }
      }
      // Cada 10 páginas, drenamos imágenes acumuladas
      if (page % 10 === 0 && imageQueue.size > 0) {
        log(`  📥 Descargando ${imageQueue.size} imágenes pendientes...`)
        await drainImages()
      }
    }

    progress.lastPage = page
    progress.totalQuestions += items.length
    progress.imagesDownloaded = imageDone.size
    progress.imagesFailed = imageFail.size

    // Progreso
    const elapsed = (Date.now() - t0) / 1000
    const done = page - startPage + 1
    const remaining = endPage - page
    const rate = done / elapsed
    const eta = remaining / rate
    log(`  Página ${page}/${endPage} · ${items.length} items · total ${progress.totalQuestions} · ETA ${Math.round(eta)}s`)

    await saveProgress(progress)

    if (page < endPage) await sleep(DELAY_MS)
  }

  // Drenar cola final de imágenes
  if (!NO_IMAGES && imageQueue.size > 0) {
    log(`📥 Descargando ${imageQueue.size} imágenes finales...`)
    await drainImages()
  }

  progress.imagesDownloaded = imageDone.size
  progress.imagesFailed = imageFail.size
  progress.completedAt = new Date().toISOString()
  await saveProgress(progress)

  return progress
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  log('🚀 Aula Plus API Scraper')
  log(`   Output: ${OUT_DIR}`)

  await ensureDir(OUT_DIR)
  await ensureDir(RAW_DIR)
  await ensureDir(IMG_DIR)
  await ensureDir(META_DIR)

  await loadTokenOrLogin()

  if (DRY_RUN) log('🧪 DRY-RUN — no se guardará nada')

  const metaCounts = await downloadMetadata()

  if (META_ONLY) {
    log('✅ Solo metadatos solicitado. Fin.')
    return
  }

  const progress = await scrapeQuestions()

  log('')
  log('═'.repeat(60))
  log('✅ SCRAPING COMPLETO')
  log('═'.repeat(60))
  log(`   Páginas: ${progress.lastPage}/${progress.totalPages}`)
  log(`   Preguntas: ${progress.totalQuestions}`)
  log(`   Imágenes descargadas: ${progress.imagesDownloaded}`)
  log(`   Imágenes fallidas: ${progress.imagesFailed}`)
  log(`   Output: ${OUT_DIR}`)
}

main().catch(e => {
  console.error('❌ Error fatal:', e)
  process.exit(1)
})
