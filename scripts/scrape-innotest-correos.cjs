/**
 * Scraper InnoTest Correos — Descarga todas las preguntas, psicotécnicos, recursos y esquemas
 *
 * Uso:
 *   node scripts/scrape-innotest-correos.cjs
 *   node scripts/scrape-innotest-correos.cjs --only-conocimientos
 *   node scripts/scrape-innotest-correos.cjs --only-psicotecnicos
 *   node scripts/scrape-innotest-correos.cjs --only-recursos
 *   node scripts/scrape-innotest-correos.cjs --only-esquemas
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://server2.innotest.app/api-apps-nuevas/Api/public';
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-correos');

const LOGIN_BODY = {
  devicecharID: '17cbd1ff86ca70b8',
  email: 'manueltrader@gmail.com',
  identificador: 'android_co',
  keyentry: 1699,
  metodo_login: 1,
  modelo: 'Samsung SM-S926B',
  notification: 0,
  oposicionID: 5,
  pushID: '7abf9ed8-3b88-40e9-8c19-c2771d66b468',
  secret: 'lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir',
  simulacion: 0,
  source: 1,
  vos: '16',
};

const DEVICE_ID = '499578';
const USER_ID = 3313000;
const INVITADO_ID = 499578;
const OPO_ID = '5';

const DELAY_MS = 1500;
const DELAY_BETWEEN_LOGIN = 2000;
const PREGUNTAS_POR_BATCH = 500; // API acepta hasta 500 por petición
const MAX_BATCHES_POR_TEMA = 10; // máximo intentos para cubrir un tema

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login() {
  const r = await fetch(BASE + '/base/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN_BODY),
  });
  const d = await r.json();
  if (d.code !== 200 || !d.data?.token?.access_token) {
    throw new Error('Login failed: ' + JSON.stringify(d).substring(0, 200));
  }
  return d.data.token.access_token;
}

function makeHeaders(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'deviceID': DEVICE_ID,
  };
}

async function fetchJSON(url, headers, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

async function scrapeBloquePreguntas(bloqueID, bloqueNombre) {
  console.log(`\n=== ${bloqueNombre.toUpperCase()} (bloque ${bloqueID}) ===`);

  let token = await login();
  let h = makeHeaders(token);

  const temasRes = await fetchJSON(BASE + '/api/v2/tests/2/oposicion/' + OPO_ID + '/bloque/' + bloqueID + '/tipo/1', h);
  if (temasRes.code !== 200) throw new Error('Error obteniendo temas: ' + JSON.stringify(temasRes));

  const allTemas = [];
  for (const grupo of temasRes.data) {
    if (grupo.temas) allTemas.push(...grupo.temas);
  }
  console.log('Temas encontrados:', allTemas.length);

  const dir = path.join(OUTPUT_DIR, slugify(bloqueNombre));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '_temas.json'), JSON.stringify(allTemas, null, 2));

  const allQuestions = new Map();

  for (const tema of allTemas) {
    const fileName = `tema${tema.numero || tema.testID}_${slugify(tema.nombre)}.json`;
    const filePath = path.join(dir, fileName);

    const disponibles = tema.count_preguntas || 0;
    const preguntasMap = new Map();

    // Cargar preguntas existentes si ya hay archivo (para acumular)
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (existing.preguntas) {
        for (const q of existing.preguntas) preguntasMap.set(q.id, q);
      }
      if (preguntasMap.size >= disponibles * 0.95) {
        console.log(`  ✓ ${fileName} ya completo (${preguntasMap.size}/${disponibles}) — skip`);
        for (const q of preguntasMap.values()) allQuestions.set(q.id, q);
        continue;
      }
      console.log(`  → Tema ${tema.numero || ''}: ${tema.nombre?.substring(0, 45)} — acumulando desde ${preguntasMap.size}/${disponibles}...`);
    } else {
      console.log(`  → Tema ${tema.numero || ''}: ${tema.nombre?.substring(0, 45)} (${disponibles}q)...`);
    }

    // Pedir por cada sub-bloque para maximizar cobertura
    const subBloques = tema.bloqueTemas?.length > 0
      ? tema.bloqueTemas
      : [{ id: 0, nombre: tema.nombre }];

    for (const bt of subBloques) {
      let batchesSinNuevas = 0;

      for (let batch = 0; batch < MAX_BATCHES_POR_TEMA; batch++) {
        if (preguntasMap.size >= disponibles * 0.95) break;

        token = await login();
        h = makeHeaders(token);
        await sleep(DELAY_BETWEEN_LOGIN);

        const body = {
          bloqueID,
          bloque_tema: [{ bloque_testID: bt.id, etiquetas: [], nombre: '', orden: 1, premium: false, testID: tema.testID }],
          deviceID: parseInt(DEVICE_ID),
          dificultades: [4],
          evaluacion_ranking: 0,
          invitadoID: INVITADO_ID,
          limite: PREGUNTAS_POR_BATCH,
          modoCorreccion: 1,
          oposicionID: OPO_ID,
          ponderado: false,
          testID: [0],
          test_tipoID: 2,
          tiempo: 90,
          tipo: 1,
          usuarioID: USER_ID,
        };

        const d = await fetchJSON(BASE + '/api/v1/preguntastest', h, 'POST', body);

        if (d.code !== 200 || !d.data?.preguntas) {
          console.log(`    bt:${bt.id} batch ${batch + 1}: error [${d.code}]`);
          break;
        }

        let nuevas = 0;
        for (const q of d.data.preguntas) {
          if (!preguntasMap.has(q.id)) { preguntasMap.set(q.id, q); nuevas++; }
        }

        const cobertura = disponibles > 0 ? Math.round(preguntasMap.size / disponibles * 100) : '?';
        const btLabel = subBloques.length > 1 ? `bt:${bt.id} ` : '';
        console.log(`    ${btLabel}batch ${batch + 1}: +${nuevas} nuevas → ${preguntasMap.size}/${disponibles} (${cobertura}%)`);

        if (nuevas === 0) batchesSinNuevas++;
        else batchesSinNuevas = 0;

        if (batchesSinNuevas >= 2) break;
        if (preguntasMap.size >= disponibles * 0.95) break;

        await sleep(DELAY_MS);
      }
    }

    // También probar con dificultades específicas si no hemos cubierto suficiente
    if (preguntasMap.size < disponibles * 0.90) {
      for (const dif of [[1], [2], [3]]) {
        if (preguntasMap.size >= disponibles * 0.95) break;

        token = await login();
        h = makeHeaders(token);
        await sleep(DELAY_BETWEEN_LOGIN);

        const body = {
          bloqueID,
          bloque_tema: [{ bloque_testID: subBloques[0].id, etiquetas: [], nombre: '', orden: 1, premium: false, testID: tema.testID }],
          deviceID: parseInt(DEVICE_ID),
          dificultades: dif,
          evaluacion_ranking: 0,
          invitadoID: INVITADO_ID,
          limite: PREGUNTAS_POR_BATCH,
          modoCorreccion: 1,
          oposicionID: OPO_ID,
          ponderado: false,
          testID: [0],
          test_tipoID: 2,
          tiempo: 90,
          tipo: 1,
          usuarioID: USER_ID,
        };

        const d = await fetchJSON(BASE + '/api/v1/preguntastest', h, 'POST', body);
        if (d.code === 200 && d.data?.preguntas) {
          let nuevas = 0;
          for (const q of d.data.preguntas) {
            if (!preguntasMap.has(q.id)) { preguntasMap.set(q.id, q); nuevas++; }
          }
          if (nuevas > 0) console.log(`    dif:${dif} +${nuevas} nuevas → ${preguntasMap.size}/${disponibles}`);
        }

        await sleep(DELAY_MS);
      }
    }

    const preguntas = [...preguntasMap.values()];
    for (const q of preguntas) allQuestions.set(q.id, q);

    const result = {
      tema: tema.numero,
      temaNombre: tema.nombre,
      testID: tema.testID,
      disponibles,
      descargadas: preguntas.length,
      cobertura: disponibles > 0 ? Math.round(preguntas.length / disponibles * 100) + '%' : '?',
      preguntas,
    };

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`  ✓ ${fileName}: ${preguntas.length}/${disponibles} (${result.cobertura})`);
  }

  console.log(`\n${bloqueNombre}: ${allQuestions.size} preguntas únicas descargadas`);
  return allQuestions.size;
}

async function scrapeConocimientos() {
  return scrapeBloquePreguntas(2, 'conocimientos');
}

async function scrapePsicotecnicos() {
  return scrapeBloquePreguntas(4, 'psicotecnicos');
}

async function scrapeRecursos() {
  console.log('\n=== RECURSOS ===');
  const token = await login();
  const h = makeHeaders(token);

  const d = await fetchJSON(BASE + '/api/v1/recursos/' + OPO_ID, h);
  if (d.code !== 200) throw new Error('Error: ' + JSON.stringify(d));

  const dir = path.join(OUTPUT_DIR, 'recursos');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, '_catalogo.json'), JSON.stringify(d.data, null, 2));
  console.log(`Catálogo guardado: ${d.data.length} recursos`);

  for (const r of d.data) {
    if (!r.archivo) continue;
    const fileName = path.basename(decodeURIComponent(r.archivo));
    const filePath = path.join(dir, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${fileName} ya existe — skip`);
      continue;
    }

    const url = 'https://web.innotest.app/recursos/' + r.archivo;
    console.log(`  → ${fileName}...`);

    try {
      const res = await fetch(url);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
        console.log(`  ✓ ${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`);
      } else {
        console.log(`  ✗ ${fileName} [${res.status}]`);
      }
    } catch (e) {
      console.log(`  ✗ ${fileName}: ${e.message}`);
    }

    await sleep(500);
  }

  return d.data.length;
}

async function scrapeEsquemas() {
  console.log('\n=== ESQUEMAS (articulado) ===');
  const token = await login();
  const h = makeHeaders(token);

  const d = await fetchJSON(BASE + '/api/v1/esquemas', h);
  if (d.code !== 200) throw new Error('Error: ' + JSON.stringify(d));

  const dir = path.join(OUTPUT_DIR, 'esquemas');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'esquemas_completos.json'), JSON.stringify(d.data, null, 2));

  let totalArticulos = 0;
  for (const e of d.data) {
    totalArticulos += e.articulado?.length || 0;
    console.log(`  ${e.nombre} — ${e.articulado?.length || 0} artículos`);
  }
  console.log(`Total: ${d.data.length} esquemas, ${totalArticulos} artículos`);

  return totalArticulos;
}

function slugify(str) {
  return (str || 'sin-nombre')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find(a => a.startsWith('--only-'))?.replace('--only-', '');

  console.log('🔧 InnoTest Correos Scraper');
  console.log('Output:', OUTPUT_DIR);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const stats = {};

  try {
    if (!only || only === 'esquemas') {
      stats.esquemas = await scrapeEsquemas();
    }

    if (!only || only === 'conocimientos') {
      stats.conocimientos = await scrapeConocimientos();
    }

    if (!only || only === 'psicotecnicos') {
      stats.psicotecnicos = await scrapePsicotecnicos();
    }

    if (!only || only === 'recursos') {
      stats.recursos = await scrapeRecursos();
    }
  } catch (e) {
    console.error('\n✗ Error:', e.message);
  }

  console.log('\n=== RESUMEN FINAL ===');
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
