'use strict';
//
// canonicalizeBoletinUrl — PURA, sin I/O. Mapea la URL de un documento de boletín
// oficial a una IDENTIDAD estable (`docKey`), para que el MISMO documento oficial
// referenciado por URLs distintas (BOE `txt.php?id=…` vs `/boe/dias/…/pdfs/….pdf`)
// deduplique a la misma fila del hub `convocatoria_documentos`.
//
// Es el ladrillo compartido del provenance: lo usan por igual el flujo OEP/seguimiento
// (productor) y la verificación de epígrafe (consumidor) antes de llamar a la función
// SQL `ensure_convocatoria_documento`. Ver docs/maintenance/provenance-convocatorias.md.
//
// Diseño DEFENSIVO: solo reconoce patrones de id de los que estamos SEGUROS (BOE, BOCM).
// Para el resto (los ~70 boletines de la cola larga: DOGV/BORM/DOE/webs de CCAA/PDFs
// sueltos) NO inventa un id — cae a la URL normalizada como `docKey` (dedup por URL
// exacta, seguro) y marca `recognized:false` para que el llamador lo deje en cola de
// revisión. Añadir un boletín = una fila en PATTERNS, con su formato de id verificado.

// Tabla extensible. `re` captura el id en el grupo 1; `canonical` (opcional) reconstruye
// la URL canónica SOLO a partir del id (sin depender de fecha/ruta), para que txt.php y
// pdf converjan. Sin `canonical`, se conserva la URL de entrada normalizada.
const PATTERNS = [
  {
    boletin: 'BOE',
    // BOE-A-2025-26262 (disposiciones), BOE-B-… (anuncios), BOE-S-… (sumarios)
    re: /\b(BOE-[ABS]-\d{4}-\d+)\b/i,
    key: (m) => m[1].toUpperCase(),
    canonical: (k) => `https://www.boe.es/diario_boe/txt.php?id=${k}`,
  },
  {
    boletin: 'BOCM',
    // BOCM-20260218-2  (AAAAMMDD-secuencia)
    re: /\b(BOCM-\d{8}-\d+)\b/i,
    key: (m) => m[1].toUpperCase(),
  },
  {
    boletin: 'DOGV',
    // dogv.gva.es/datos/2026/03/12/pdf/2026_8057_es.pdf → DOGV-2026-8057 (año_número del DOGV).
    // Las variantes de idioma (_es/_va) del MISMO documento convergen al mismo docKey.
    re: /dogv\.gva\.es\/datos\/\d{4}\/\d{2}\/\d{2}\/pdf\/(\d{4})_(\d+)/i,
    key: (m) => `DOGV-${m[1]}-${m[2]}`,
  },
  {
    boletin: 'BOCYL',
    // bocyl.jcyl.es/.../BOCYL-D-24062026-120-22.pdf → el propio código de documento del BOCYL
    re: /(BOCYL-[A-Z]-\d{8}-\d+-\d+)/i,
    key: (m) => m[1].toUpperCase(),
  },
  {
    boletin: 'DOGC',
    // portaldogc.gencat.cat/.../?documentId=1035641 → DOGC-1035641
    re: /portaldogc\.gencat\.cat.*?documentId=(\d+)/i,
    key: (m) => `DOGC-${m[1]}`,
  },
  {
    boletin: 'BOC',
    // gobiernodecanarias.org/boc/2024/239/3965.html → BOC-2024-239-3965 (año/nº boletín/nº anuncio).
    // La variante .pdf del mismo anuncio converge al mismo docKey; canonical fija el .html.
    re: /gobiernodecanarias\.org\/boc\/(\d{4})\/(\d+)\/(\d+)/i,
    key: (m) => `BOC-${m[1]}-${m[2]}-${m[3]}`,
    canonical: (k) => {
      const [, y, b, a] = k.match(/^BOC-(\d{4})-(\d+)-(\d+)$/);
      return `https://www.gobiernodecanarias.org/boc/${y}/${b}/${a}.html`;
    },
  },
  {
    boletin: 'BOJA',
    // juntadeandalucia.es/boja/2024/191/27 → BOJA-2024-191-27 (año/nº boletín/nº disposición).
    re: /juntadeandalucia\.es\/boja\/(\d{4})\/(\d+)\/(\d+)/i,
    key: (m) => `BOJA-${m[1]}-${m[2]}-${m[3]}`,
    canonical: (k) => {
      const [, y, b, a] = k.match(/^BOJA-(\d{4})-(\d+)-(\d+)$/);
      return `https://www.juntadeandalucia.es/boja/${y}/${b}/${a}`;
    },
  },
  {
    boletin: 'BOJA',
    // Variante PDF del eBOJA: juntadeandalucia.es/eboja/2026/136/BOJA26-136-00016-9536-01_00340768.pdf
    // Converge al MISMO docKey que la variante web (/boja/2026/136/16): año 20+26, boletín 136,
    // disposición 00016 → BOJA-2026-136-16. Sin esto, el mismo documento oficial referenciado por
    // sus dos URLs oficiales deduplicaba a dos filas distintas del hub.
    re: /juntadeandalucia\.es\/eboja\/\d{4}\/\d+\/BOJA(\d{2})-(\d+)-(\d+)/i,
    key: (m) => `BOJA-20${m[1]}-${parseInt(m[2], 10)}-${parseInt(m[3], 10)}`,
    canonical: (k) => {
      const [, y, b, a] = k.match(/^BOJA-(\d{4})-(\d+)-(\d+)$/);
      return `https://www.juntadeandalucia.es/boja/${y}/${b}/${a}`;
    },
  },
  {
    boletin: 'DOG',
    // xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_es.html → DOG-G0597-191125-0004.
    // El código de anuncio es la identidad estable; las variantes de idioma _es/_gl convergen.
    re: /xunta\.gal\/dog\/Publicados\/\d{4}\/\d{8}\/Anuncio([A-Z0-9-]+?)(?:_[a-z]{2})?\.html/i,
    key: (m) => `DOG-${m[1].toUpperCase()}`,
  },
  {
    boletin: 'MIA',
    // Portal documental de Aragón (mia.aragon.es): los programas de materias se publican ahí por
    // Código Seguro de Verificación (CSV). El portal SPA (?csv=CSV…) y la API real
    // (carp-core-mia.aragon.es/rest/documentos/CSV…/pdf) convergen al mismo docKey por el CSV.
    re: /(?:mia\.aragon\.es\/documentos\?csv=|carp-core-mia\.aragon\.es\/rest\/documentos\/)([A-Z0-9]{10,})/i,
    key: (m) => `MIA-${m[1].toUpperCase()}`,
    canonical: (k) => `https://mia.aragon.es/documentos?csv=${k.slice(4)}`,
  },
];

// Normaliza una URL para usarla como docKey de reserva: minúsculas en esquema+host,
// sin fragmento, sin barra final, query ordenada. NO descarta parámetros (podrían ser
// significativos, p.ej. VersionId de un objeto S3). Determinista.
function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let scheme = '';
  let rest = s;
  const m = s.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (m) {
    scheme = m[1].toLowerCase() + '://';
    rest = s.slice(m[0].length);
  }
  // separar fragmento
  rest = rest.split('#')[0];
  // separar query
  let path = rest;
  let query = '';
  const qi = rest.indexOf('?');
  if (qi >= 0) {
    path = rest.slice(0, qi);
    query = rest.slice(qi + 1);
  }
  // host = primer segmento antes de la primera '/'; se pasa a minúsculas
  const slash = path.indexOf('/');
  let host = slash >= 0 ? path.slice(0, slash) : path;
  let tail = slash >= 0 ? path.slice(slash) : '';
  host = host.toLowerCase().replace(/:80$/, '').replace(/:443$/, '');
  // sin barra final (salvo raíz)
  if (tail.length > 1) tail = tail.replace(/\/+$/, '');
  // query ordenada por pares clave=valor
  let q = '';
  if (query) {
    const parts = query.split('&').filter(Boolean).sort();
    if (parts.length) q = '?' + parts.join('&');
  }
  return `${scheme}${host}${tail}${q}`;
}

/**
 * @param {string} raw  URL cruda del documento oficial
 * @returns {{docKey:string|null, canonicalUrl:string|null, boletin:string, recognized:boolean}}
 *   docKey       identidad estable para dedup (id del boletín, o URL normalizada de reserva)
 *   canonicalUrl URL canónica reconstruida (BOE) o la de entrada normalizada
 *   boletin      'BOE' | 'BOCM' | … | 'unknown'
 *   recognized   true si se reconoció un id de boletín; false si es reserva por URL
 */
function canonicalizeBoletinUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return { docKey: null, canonicalUrl: null, boletin: 'unknown', recognized: false };
  for (const p of PATTERNS) {
    const m = url.match(p.re);
    if (m) {
      const key = p.key(m);
      return {
        docKey: key,
        canonicalUrl: p.canonical ? p.canonical(key) : normalizeUrl(url),
        boletin: p.boletin,
        recognized: true,
      };
    }
  }
  const norm = normalizeUrl(url);
  return { docKey: norm, canonicalUrl: norm, boletin: 'unknown', recognized: false };
}

// ── Registro de HOSTS de boletín (nivel DOMINIO, no identidad de documento) ──────────
//
// `PATTERNS` responde "¿QUÉ documento es?" y por eso exige un formato de id verificado.
// Hay una segunda pregunta, más barata y distinta, que el sistema necesitaba y no tenía:
// "¿esta URL es del boletín X, sea cual sea el documento?". Contestarla no requiere saber
// parsear su id — basta el dominio. Separarlas evita el mal negocio de inventar ids solo
// para poder comparar el dominio (un docKey mal construido rompe el dedup del hub).
//
// Lo usa `linkCoherence.cjs` para juzgar el botón "Ver convocatoria en {diario_oficial}":
// hasta 26/07 solo reconocía los 9 boletines de PATTERNS, así que 56 de las 123 landings
// activas caían en zona ciega y el botón podía llevar a cualquier sitio sin que nada lo
// marcase (caso raíz: policia-nacional prometía el BOE y llevaba al portal de aspirantes
// en INGLÉS). Añadir un boletín = una fila aquí (y su espejo en el backend @Cron).
//
// `path` acota los dominios que NO son solo boletín: euskadi.eus es el portal entero del
// Gobierno Vasco y solo `/…bopv…/` es el BOPV; gobiernodecanarias.org sirve el BOC en
// `/boc/` y el Servicio Canario de Salud en `/sanidad/`. Sin ese filtro, un portal
// institucional pasaría por boletín y el detector se quedaría ciego justo donde mira.
const BOLETIN_HOSTS = [
  { boletin: 'BOE', host: /(^|\.)boe\.es$/ },
  { boletin: 'BOCM', host: /(^|\.)bocm\.es$/ },
  { boletin: 'BORM', host: /(^|\.)borm\.es$/ },
  { boletin: 'BOA', host: /(^|\.)boa\.aragon\.es$/ },
  { boletin: 'DOE', host: /(^|\.)doe\.juntaex\.es$/ },
  { boletin: 'BON', host: /(^|\.)bon\.navarra\.es$/ },
  { boletin: 'BOC', host: /(^|\.)boc\.cantabria\.es$/ },
  { boletin: 'BOC', host: /(^|\.)gobiernodecanarias\.org$/, path: /\/boc\// },
  { boletin: 'BOPA', host: /(^|\.)asturias\.es$/, path: /\/bopa\// },
  { boletin: 'BOR', host: /(^|\.)larioja\.org$/, path: /bor/i },
  { boletin: 'BOCYL', host: /(^|\.)bocyl\.jcyl\.es$/ },
  { boletin: 'DOGC', host: /(^|\.)dogc\.gencat\.cat$/ },
  { boletin: 'DOGV', host: /(^|\.)dogv\.gva\.es$/ },
  { boletin: 'DOCM', host: /(^|\.)docm\.jccm\.es$/ },
  { boletin: 'BOIB', host: /(^|\.)boib\.caib\.es$/ },
  { boletin: 'BOUC', host: /(^|\.)bouc\.ucm\.es$/ },
  { boletin: 'BOPZ', host: /(^|\.)boletin\.dpz\.es$/ },
  { boletin: 'BOPV', host: /(^|\.)euskadi\.eus$/, path: /bopv/i },
  { boletin: 'BOJA', host: /(^|\.)juntadeandalucia\.es$/, path: /\/e?boja\// },
  { boletin: 'DOG', host: /(^|\.)xunta\.gal$/, path: /\/dog\// },
];

/**
 * ¿De qué boletín oficial es esta URL? Primero por IDENTIDAD de documento (PATTERNS, que
 * además da docKey), y si no, por DOMINIO (BOLETIN_HOSTS). Puro, sin red.
 * @param {string} raw
 * @returns {{boletin:string|null, nivel:'id'|'host'|null}}  null = no es de ningún boletín conocido
 */
function boletinDeUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return { boletin: null, nivel: null };
  const porId = canonicalizeBoletinUrl(url);
  if (porId.recognized && porId.boletin !== 'unknown') return { boletin: porId.boletin, nivel: 'id' };
  // host: se acepta con o sin esquema; se ignora `www.` y el puerto.
  const norm = normalizeUrl(url.includes('://') ? url : `https://${url}`);
  const sinEsquema = norm.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const corte = sinEsquema.search(/[/?]/);
  const host = (corte >= 0 ? sinEsquema.slice(0, corte) : sinEsquema).replace(/^www\d*\./, '');
  const resto = corte >= 0 ? sinEsquema.slice(corte) : '';
  for (const h of BOLETIN_HOSTS) {
    if (!h.host.test(host)) continue;
    if (h.path && !h.path.test(resto)) continue;
    return { boletin: h.boletin, nivel: 'host' };
  }
  return { boletin: null, nivel: null };
}

module.exports = { canonicalizeBoletinUrl, normalizeUrl, PATTERNS, BOLETIN_HOSTS, boletinDeUrl };
