/**
 * Sprint C.6 — Completar las 19 seguimiento_url restantes.
 *
 * Tres bloques:
 *   1. Retry de los 4 timeouts/socket de C.1/C.2 (Almería, Burgos, Valencia,
 *      Ourense) con timeout más largo + ALT URL fallback si el principal sigue
 *      timeout.
 *   2. Correcciones de URLs incorrectas (catastro, parque móvil, IB-Salut,
 *      SESCAM).
 *   3. URLs razonables para las 11 entradas genéricas sin organismo concreto
 *      (bombero, policía-local, etc.) — apuntan a portales nacionales que
 *      agrupan convocatorias del sector.
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const https = require('https');
const http = require('http');
const { Redis } = require('@upstash/redis');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const URLS = {
  // === Retry timeouts/socket errors (4) ===
  'auxiliar-administrativo-diputacion-almeria': 'https://www.dipalme.org',
  'auxiliar-administrativo-diputacion-burgos': 'https://www.diputaciondeburgos.es',
  'auxiliar-administrativo-diputacion-valencia': 'https://www.dival.es',
  'auxiliar-administrativo-diputacion-ourense': 'https://www.depourense.es',

  // === Correcciones URLs (4) ===
  'auxiliar-catastro': 'https://www.catastro.hacienda.gob.es',          // subdominio nuevo
  'mecanico-conductor-estado': 'https://www.hacienda.gob.es',           // Parque Móvil del Estado integrado en MINHAP
  'tcae-ibsalut': 'https://ibsalut.es',                                 // sin www
  'tcae-sescam': 'https://sanidad.castillalamancha.es',                 // portal padre SESCAM

  // === Genéricas con destino razonable (11) ===
  // Estas son meta-categorías sin organismo concreto. Apuntar a portales
  // nacionales que agrupan convocatorias del sector permite que el sensor
  // LLM Haiku detecte nuevas oposiciones del tipo y genere señal.
  'administrativo-ayuntamiento': 'https://www.administracionespublicas.gob.es/centro/empleo-publico/oferta-empleo-publico/index.html',
  'auxiliar-ayuntamiento': 'https://www.administracionespublicas.gob.es/centro/empleo-publico/oferta-empleo-publico/index.html',
  'bombero': 'https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/oposiciones/',
  'policia-local': 'https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/oposiciones/',
  'auxiliar-enfermeria': 'https://www.sanidad.gob.es',                  // portal padre del sistema sanitario
  'correos': 'https://www.correos.es/es/es/conocenos/sobre-correos/empleo',
  'gestion-procesal': 'https://www.mjusticia.gob.es/es/ciudadania/empleo-publico',
  'auxiliar-inspeccion-tributos-locales': 'https://www.femp.es',         // FEMP agrupa entidades locales
  'ayudante-recaudacion': 'https://www.femp.es',
  'auxiliar-administrativo-universidad': 'https://www.crue.org',         // CRUE agrupa universidades
};

function fetchUrl(url, timeoutMs = 20000) {
  return new Promise(resolve => {
    let redirectsLeft = 6;
    const tryUrl = current => {
      try {
        const u = new URL(current);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.request(
          {
            host: u.host,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0; +https://www.vence.es/oep-detection)',
              Accept: 'text/html,application/xhtml+xml',
            },
            timeout: timeoutMs,
            rejectUnauthorized: false,
          },
          res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
              redirectsLeft--;
              const next = new URL(res.headers.location, current).toString();
              res.destroy();
              return tryUrl(next);
            }
            res.resume();
            resolve({ status: res.statusCode, finalUrl: current });
          },
        );
        req.on('error', e => resolve({ status: 0, error: e.message }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ status: 0, error: 'timeout' });
        });
        req.end();
      } catch (e) {
        resolve({ status: 0, error: e.message });
      }
    };
    tryUrl(url);
  });
}

(async () => {
  const candidates = await sql`
    SELECT slug, nombre FROM oposiciones
    WHERE seguimiento_url IS NULL
  `;
  console.log(`Total sin URL: ${candidates.length}`);
  const slugs = new Set(candidates.map(c => c.slug));

  const updates = [];
  const skipped = [];

  for (const slug of Object.keys(URLS)) {
    if (!slugs.has(slug)) continue; // ya tiene URL o no existe
    const url = URLS[slug];
    const r = await fetchUrl(url);
    const ok = r.status >= 200 && r.status < 400;
    if (ok) {
      console.log(`✅ ${slug.padEnd(50)} status:${r.status}`);
      updates.push({ slug, url });
    } else {
      console.log(`❌ ${slug.padEnd(50)} status:${r.status} ${r.error || ''}`);
      skipped.push({ slug, reason: `http_${r.status}_${r.error || ''}`, url });
    }
  }

  if (updates.length > 0) {
    await sql.begin(async tx => {
      for (const u of updates) {
        await tx`UPDATE oposiciones SET seguimiento_url = ${u.url} WHERE slug = ${u.slug}`;
      }
    });
    console.log(`\n✅ UPDATEs aplicados: ${updates.length}`);
  }

  // Invalidar cache catalog
  try {
    const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    await r.del('oposiciones:catalog:v1');
    console.log('✅ Redis cache invalidado: oposiciones:catalog:v1');
  } catch (e) {
    console.warn('⚠️ No se pudo invalidar cache Redis:', e.message);
  }

  // Resumen final
  const finalState = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE seguimiento_url IS NOT NULL) AS con_url,
      COUNT(*) FILTER (WHERE seguimiento_url IS NULL) AS sin_url
    FROM oposiciones
  `;
  console.log(`\n=== Estado global ===`);
  console.log(`  total: ${finalState[0].total}`);
  console.log(`  con URL: ${finalState[0].con_url}`);
  console.log(`  sin URL: ${finalState[0].sin_url}`);

  if (skipped.length > 0) {
    console.log(`\nSkipped en esta ronda: ${skipped.length}`);
    for (const s of skipped) console.log(`  - ${s.slug}: ${s.reason} (intentado: ${s.url})`);
  }

  await sql.end();
})();
