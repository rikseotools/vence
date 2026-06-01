/**
 * Sprint C.2/C.3/C.4/C.5 — Rellenar seguimiento_url para el resto de
 * catalogadas: Cabildos canarios, Consells baleares, Aytos top, Sanitarias
 * y Estatales/Autonómicos transversales.
 *
 * Estrategia: dominio raíz del organismo convocante. El sensor LLM Haiku
 * navega desde ahí.
 *
 * También reintenta las 4 Diputaciones que dieron timeout en Sprint C.1.
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const https = require('https');
const http = require('http');

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const URLS = {
  // --- Retry Diputaciones que dieron timeout en Sprint C.1 ---
  'auxiliar-administrativo-diputacion-almeria': 'https://www.dipalme.org',
  'auxiliar-administrativo-diputacion-burgos': 'https://www.diputaciondeburgos.es',
  'auxiliar-administrativo-diputacion-valencia': 'https://www.dival.es',
  'auxiliar-administrativo-diputacion-ourense': 'https://www.depourense.es',

  // --- Cabildos canarios (7) ---
  'auxiliar-administrativo-cabildo-el-hierro': 'https://www.elhierro.es',
  'auxiliar-administrativo-cabildo-fuerteventura': 'https://www.cabildofuer.es',
  'auxiliar-administrativo-cabildo-gran-canaria': 'https://www.grancanaria.com',
  'auxiliar-administrativo-cabildo-la-gomera': 'https://www.lagomera.es',
  'auxiliar-administrativo-cabildo-la-palma': 'https://www.cabildodelapalma.es',
  'auxiliar-administrativo-cabildo-lanzarote': 'https://www.cabildodelanzarote.com',
  'auxiliar-administrativo-cabildo-tenerife': 'https://www.tenerife.es',

  // --- Consells baleares (3) ---
  'auxiliar-administrativo-consell-formentera': 'https://www.consellinsulardeformentera.cat',
  'auxiliar-administrativo-consell-mallorca': 'https://www.conselldemallorca.cat',
  'auxiliar-administrativo-consell-menorca': 'https://www.cime.es',

  // --- Ayuntamientos top (~8 sin URL) ---
  'auxiliar-administrativo-ayuntamiento-barcelona': 'https://ajuntament.barcelona.cat',
  'auxiliar-administrativo-ayuntamiento-bilbao': 'https://www.bilbao.eus',
  'auxiliar-administrativo-ayuntamiento-las-palmas': 'https://www.laspalmasgc.es',
  'auxiliar-administrativo-ayuntamiento-madrid': 'https://www.madrid.es',
  'auxiliar-administrativo-ayuntamiento-malaga': 'https://www.malaga.eu',
  'auxiliar-administrativo-ayuntamiento-palma': 'https://www.palma.cat',
  'auxiliar-administrativo-ayuntamiento-sevilla': 'https://www.sevilla.org',
  'auxiliar-administrativo-ayuntamiento-zaragoza': 'https://www.zaragoza.es',

  // --- Sanitarias TCAE faltantes (12) ---
  'tcae-ibsalut': 'https://www.ibsalut.es',
  'tcae-ics': 'https://ics.gencat.cat',
  'tcae-ingesa': 'https://www.ingesa.sanidad.gob.es',
  'tcae-sacyl': 'https://www.saludcastillayleon.es',
  'tcae-seris': 'https://www.riojasalud.es',
  'tcae-sas': 'https://www.juntadeandalucia.es/servicioandaluzdesalud',
  'tcae-scs-cantabria': 'https://www.scsalud.es',
  'tcae-navarra': 'https://www.navarra.es/home_es/Temas/Empleo+y+Economia/Empleo/Empleo+publico/',
  'tcae-ses': 'https://saludextremadura.ses.es',
  'tcae-sescam': 'https://sanidad.castillalamancha.es/profesionales/recursos-humanos',
  'tcae-sespa': 'https://www.astursalud.es',

  // --- Cuerpos estatales (12) ---
  // Concentrar en sede de cada ente o INAP (que ya cubre AGE general)
  'agente-hacienda': 'https://sede.agenciatributaria.gob.es',
  'auxiliar-administrativo-seguridad-social': 'https://www.seg-social.es',
  'bibliotecario': 'https://www.cultura.gob.es',
  'auxiliar-estadistica-ine': 'https://www.ine.es',
  'auxiliar-inspeccion-soivre': 'https://comercio.gob.es',
  'auxiliar-vigilancia-aduanera': 'https://www.agenciatributaria.gob.es',
  'auxiliar-catastro': 'https://www.catastro.minhap.es',
  'auxiliar-sepe': 'https://www.sepe.es',
  'ayudante-instituciones-penitenciarias': 'https://www.institucionpenitenciaria.es',
  'conductor': 'https://sede.inap.gob.es',
  'mecanico-conductor-estado': 'https://www.parquemovil.es',
  'tecnico-informatica': 'https://sede.inap.gob.es',

  // --- Autonómicos transversales (11) ---
  'administrativo-comunidad-autonoma': 'https://sede.inap.gob.es',
  'agente-forestal': 'https://www.miteco.gob.es',
  'agente-medioambiental': 'https://www.miteco.gob.es',
  'auxiliar-administrativo-ceuta': 'https://www.ceuta.es',
  'auxiliar-administrativo-melilla': 'https://www.melilla.es',
  'auxiliar-comunidad-autonoma': 'https://sede.inap.gob.es',
  'auxiliar-administrativo-navarra': 'https://www.navarra.es',
  'auxiliar-residencia-mayores': 'https://www.imserso.es',
  'auxiliar-servicios-sociales': 'https://www.mdsocialesa2030.gob.es',
  'auxiliar-educador-centros-menores': 'https://www.mdsocialesa2030.gob.es',
  'operador-emergencias-112': 'https://www.proteccioncivil.es',
};

function fetchUrl(url, timeoutMs = 15000) {
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
  `;
  console.log(`Catalogadas sin URL: ${candidates.length}`);
  const slugs = new Set(candidates.map(c => c.slug));

  const updates = [];
  const skipped = [];

  for (const slug of Object.keys(URLS)) {
    if (!slugs.has(slug)) {
      // Ya tiene URL o no es catalogada → skip silencioso
      continue;
    }
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

  // Resumen final del catálogo
  const finalState = await sql`
    SELECT COUNT(*) FILTER (WHERE seguimiento_url IS NOT NULL) AS con_url,
           COUNT(*) FILTER (WHERE seguimiento_url IS NULL) AS sin_url,
           COUNT(*) AS total
    FROM oposiciones WHERE coverage_level = 'catalogada'
  `;
  console.log(`\n=== Estado catálogo coverage_level='catalogada' ===`);
  console.log(`  con URL: ${finalState[0].con_url}`);
  console.log(`  sin URL: ${finalState[0].sin_url}`);
  console.log(`  total: ${finalState[0].total}`);

  console.log(`\nSkipped en esta ronda: ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.slug}: ${s.reason}`);

  await sql.end();
})();
