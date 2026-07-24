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
    canonical: (k) => `https://www.boe.es/diario_boe/txt.php?id=${k}`,
  },
  {
    boletin: 'BOCM',
    // BOCM-20260218-2  (AAAAMMDD-secuencia)
    re: /\b(BOCM-\d{8}-\d+)\b/i,
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
      const key = m[1].toUpperCase();
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

module.exports = { canonicalizeBoletinUrl, normalizeUrl, PATTERNS };
