/**
 * Sprint C.1 — Rellenar seguimiento_url para Diputaciones provinciales catalogadas.
 *
 * Estrategia: usar el DOMINIO RAÍZ del portal de cada Diputación. Los paths
 * específicos cambian con frecuencia (vimos 404 masivos en primera iteración);
 * el dominio raíz es estable. El sensor LLM Haiku navega desde ahí buscando
 * convocatorias.
 *
 * Cada URL se valida con HTTP GET. Las que respondan 200 se aplican en BD.
 * Los paths específicos quedan como deuda — se investigan caso a caso en
 * Sprint C.1.b cuando se detecte convocatoria activa.
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const https = require('https');
const http = require('http');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

// Mapa slug → URL portal o ficha empleo público. Cuando el path específico de
// /empleo o equivalente es estable, lo usamos; cuando no, dominio raíz.
const URLS = {
  // Andalucía
  'auxiliar-administrativo-diputacion-almeria': 'https://www.dipalme.org',
  'auxiliar-administrativo-diputacion-cordoba': 'https://www.dipucordoba.es',
  'auxiliar-administrativo-diputacion-granada': 'https://www.dipgra.es',
  'auxiliar-administrativo-diputacion-huelva': 'https://www.diphuelva.es',
  'auxiliar-administrativo-diputacion-jaen': 'https://www.dipujaen.es',
  'auxiliar-administrativo-diputacion-malaga': 'https://www.malaga.es',
  'auxiliar-administrativo-diputacion-sevilla': 'https://www.dipusevilla.es',
  // Aragón
  'auxiliar-administrativo-diputacion-huesca': 'https://www.dphuesca.es',
  'auxiliar-administrativo-diputacion-teruel': 'https://www.dpteruel.es',
  // Castilla-La Mancha
  'auxiliar-administrativo-diputacion-albacete': 'https://www.dipualba.es',
  'auxiliar-administrativo-diputacion-ciudad-real': 'https://www.dipucr.es',
  'auxiliar-administrativo-diputacion-cuenca': 'https://www.dipucuenca.es',
  'auxiliar-administrativo-diputacion-guadalajara': 'https://www.dguadalajara.es',
  'auxiliar-administrativo-diputacion-toledo': 'https://www.diputoledo.es',
  // Castilla y León
  'auxiliar-administrativo-diputacion-avila': 'https://www.diputacionavila.es',
  'auxiliar-administrativo-diputacion-burgos': 'https://www.diputaciondeburgos.es',
  'auxiliar-administrativo-diputacion-palencia': 'https://www.diputaciondepalencia.es',
  'auxiliar-administrativo-diputacion-salamanca': 'https://www.lasalina.es',
  'auxiliar-administrativo-diputacion-segovia': 'https://www.dipsegovia.es',
  'auxiliar-administrativo-diputacion-soria': 'https://www.dipsoria.es',
  'auxiliar-administrativo-diputacion-valladolid': 'https://www.diputaciondevalladolid.es',
  'auxiliar-administrativo-diputacion-zamora': 'https://www.diputaciondezamora.es',
  // Catalunya
  'auxiliar-administrativo-diputacion-barcelona': 'https://www.diba.cat',
  'auxiliar-administrativo-diputacion-girona': 'https://www.ddgi.cat',
  'auxiliar-administrativo-diputacion-lleida': 'https://www.diputaciolleida.cat',
  'auxiliar-administrativo-diputacion-tarragona': 'https://www.dipta.cat',
  // Comunitat Valenciana
  'auxiliar-administrativo-diputacion-alicante': 'https://www.diputacionalicante.es',
  'auxiliar-administrativo-diputacion-castellon': 'https://www.dipcas.es',
  'auxiliar-administrativo-diputacion-valencia': 'https://www.dival.es',
  // Extremadura
  'auxiliar-administrativo-diputacion-badajoz': 'https://www.dip-badajoz.es',
  'auxiliar-administrativo-diputacion-caceres': 'https://www.dip-caceres.es',
  // Galicia
  'auxiliar-administrativo-diputacion-a-coruna': 'https://www.dacoruna.gal',
  'auxiliar-administrativo-diputacion-lugo': 'https://www.deputacionlugo.gal',
  'auxiliar-administrativo-diputacion-ourense': 'https://www.depourense.es',
  'auxiliar-administrativo-diputacion-pontevedra': 'https://www.depo.gal',
  // País Vasco (forales)
  'auxiliar-administrativo-diputacion-alava': 'https://web.araba.eus',
  'auxiliar-administrativo-diputacion-bizkaia': 'https://www.bizkaia.eus',
  'auxiliar-administrativo-diputacion-gipuzkoa': 'https://www.gipuzkoa.eus',
};

function fetchUrl(url, timeoutMs = 12000) {
  return new Promise(resolve => {
    let redirectsLeft = 5;
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
    WHERE coverage_level = 'catalogada'
      AND seguimiento_url IS NULL
      AND slug LIKE 'auxiliar-administrativo-diputacion-%'
  `;
  console.log(`Diputaciones catalogadas sin URL: ${candidates.length}`);

  const updates = [];
  const skipped = [];

  for (const c of candidates) {
    const url = URLS[c.slug];
    if (!url) {
      skipped.push({ slug: c.slug, reason: 'no_url_in_map' });
      continue;
    }
    const r = await fetchUrl(url);
    const ok = r.status >= 200 && r.status < 400;
    if (ok) {
      console.log(`✅ ${c.slug.padEnd(48)} status:${r.status}`);
      updates.push({ slug: c.slug, url });
    } else {
      console.log(`❌ ${c.slug.padEnd(48)} status:${r.status} ${r.error || ''}`);
      skipped.push({ slug: c.slug, reason: `http_${r.status}_${r.error || ''}`, url });
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

  console.log(`\n=== RESUMEN ===`);
  console.log(`OK: ${updates.length}`);
  console.log(`Skipped: ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.slug}: ${s.reason}`);

  await sql.end();
})();
