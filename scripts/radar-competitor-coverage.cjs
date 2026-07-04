// scripts/radar-competitor-coverage.cjs
//
// Sitemap-coverage de la Capa 3 (competidores): lee los sitemaps de los
// competidores, extrae las oposiciones que cubren, y las cruza con NUESTRO
// catálogo → lista las que ellos tienen y nosotros NO (candidatas a catalogar).
//
// Es un AUDITOR de completitud (nombres), no señal de convocatoria. El cruce es
// difuso → produce candidatos para REVISAR, no auto-catalogar a ciegas.
// Diseño: docs/roadmap/radar-multicapa.md (Capa 3a). Uso: node scripts/radar-competitor-coverage.cjs

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';

// Ruido: páginas de academia/preparador/temario/genéricas que NO son oposiciones.
const NOISE = /academia|preparador|temario|esquemas|metodo|precio|blog|test-legislacion|psicotecnic|informatica|normativa-comun|categorias?/i;

// Config por competidor: sitemap(s) + cómo reconocer una URL de oposición individual.
const COMPETITORS = [
  {
    key: 'opositas',
    sitemaps: ['https://www.opositas.com/oposiciones-sitemap.xml'],
    // .../categoria/oposicion/  (dos niveles bajo /oposiciones/)
    isOpo: (u) => /\/oposiciones\/[^/]+\/[^/]+\/?$/.test(u) && !NOISE.test(u),
    name: (u) => slugToName(lastSeg(u)),
  },
  {
    key: 'opositatest',
    // El sitemap solo expone CATEGORÍAS (no oposiciones individuales, van por JS).
    // Inútil por sitemap → necesita Playwright on-demand. Se deja config vacía.
    sitemaps: [],
    isOpo: () => false,
    name: (u) => slugToName(lastSeg(u)),
  },
  {
    key: 'gokoan',
    sitemaps: ['https://www.gokoan.com/sitemap.xml'],
    // Oposición individual = /oposiciones/<slug> o /oposiciones-<cat>/<slug>
    // (excluye las páginas-índice de un solo segmento como /oposiciones-autonomicas-andalucia)
    isOpo: (u) =>
      (/\/oposiciones\/[^/]+\/?$/.test(u) || /\/oposiciones-[a-z-]+\/[^/]+\/?$/.test(u)) &&
      !NOISE.test(u),
    name: (u) => slugToName(lastSeg(u).replace(/^oposiciones?-?/, '')),
  },
];

function lastSeg(u) {
  return u.replace(/\/+$/, '').split('/').pop() || '';
}
function slugToName(s) {
  return s.replace(/-/g, ' ').replace(/\bturno libre\b|\bpromocion interna\b/g, '').trim();
}
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// tokens significativos (quita relleno)
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'oposiciones', 'oposicion', 'turno', 'libre', 'promocion', 'interna', 'general', 'cuerpo', 'escala']);
function tokens(s) {
  return norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function competitorOposiciones(cfg) {
  const urls = new Set();
  for (const sm of cfg.sitemaps) {
    let xml;
    try {
      xml = await fetchText(sm);
    } catch (e) {
      console.warn(`  ⚠️ ${cfg.key}: sitemap ${sm} → ${e.message}`);
      continue;
    }
    const all = locs(xml);
    // Índice de sitemaps: recursar en sub-sitemaps que huelan a oposiciones.
    const subs = all.filter((u) => /\.xml$/.test(u) && /(oposicion|convocatoria)/i.test(u));
    if (subs.length) {
      for (const sub of subs) {
        try {
          locs(await fetchText(sub)).filter(cfg.isOpo).forEach((u) => urls.add(u));
        } catch (e) {
          console.warn(`  ⚠️ ${cfg.key}: sub ${sub} → ${e.message}`);
        }
      }
    }
    all.filter(cfg.isOpo).forEach((u) => urls.add(u));
  }
  return [...urls].map((u) => ({ url: u, name: cfg.name(u), tokens: tokens(cfg.name(u)) }));
}

(async () => {
  // 1) nuestro catálogo (todos: activas + catalogadas)
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: cat } = await s.from('oposiciones').select('slug, nombre');
  const catTokens = (cat || []).map((o) => new Set([...tokens(o.nombre), ...tokens((o.slug || '').replace(/-/g, ' '))]));
  console.log(`Catálogo: ${(cat || []).length} oposiciones\n`);

  // matcher difuso: cubierta si comparte >=2 tokens (o >=60%) con alguna fila
  const covered = (t) => {
    if (t.length === 0) return true; // sin tokens útiles → no lo contamos como gap
    // Nombres de 1-2 tokens: exigir match COMPLETO (evita falsos gaps como "correos").
    // 3+ tokens: 60% de solape.
    const need = t.length <= 2 ? t.length : Math.max(2, Math.ceil(t.length * 0.6));
    const set = new Set(t);
    return catTokens.some((ct) => {
      let hit = 0;
      for (const tok of set) if (ct.has(tok)) hit++;
      return hit >= need;
    });
  };

  for (const cfg of COMPETITORS) {
    const opos = await competitorOposiciones(cfg);
    const gaps = opos.filter((o) => !covered(o.tokens));
    console.log(`===== ${cfg.key.toUpperCase()} — ${opos.length} oposiciones | ${opos.length - gaps.length} ya en catálogo | ${gaps.length} GAPS =====`);
    gaps.slice(0, 40).forEach((g) => console.log(`  ❌ ${g.name}  <${g.url}>`));
    if (gaps.length > 40) console.log(`  … y ${gaps.length - 40} más`);
    console.log('');
  }
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
