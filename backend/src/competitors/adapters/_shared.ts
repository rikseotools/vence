// backend/src/competitors/adapters/_shared.ts
//
// Helpers PUROS compartidos por varios adapters de competidor (title-case,
// limpieza de nombre desde slug/título). Cada adapter sigue teniendo su propio
// classifyUrl/parseCourse; esto solo evita duplicar utilidades triviales.

const STOP = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a', 'para', 'por', 'the',
]);

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-case dejando conectores en minúscula. */
export function titleCase(text: string): string {
  return text
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (STOP.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

/** Nombre desde el último segmento del path de una URL. */
export function nameFromSlug(url: string, drop = 0): string {
  try {
    const segs = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const slug = segs[segs.length - 1 - drop] ?? '';
    return titleCase(slug);
  } catch {
    return '';
  }
}

/** Precio (céntimos) de un `offers` (objeto o array) JSON-LD. */
function offerCents(offersRaw: unknown): number | null {
  const offer = Array.isArray(offersRaw) ? offersRaw[0] : (offersRaw as Record<string, unknown> | undefined);
  const price = offer?.['price'];
  if (price == null) return null;
  const v = parseFloat(String(price));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

/**
 * Precio (céntimos) del primer Product/Course del JSON-LD de la página.
 * Cubre `offers` top-level (WooCommerce) y `hasCourseInstance[].offers` (schema
 * Course). Devuelve null si no hay precio numérico. PURA.
 */
export function jsonLdPrice(html: string): number | null {
  const scripts = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const s of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(s[1].trim());
    } catch {
      continue;
    }
    const top = data as Record<string, unknown>;
    const nodes = Array.isArray(data)
      ? data
      : Array.isArray(top?.['@graph'])
        ? (top['@graph'] as unknown[])
        : [data];
    for (const n of nodes as Record<string, unknown>[]) {
      if (!n) continue;
      const t = n['@type'];
      if (t !== 'Product' && t !== 'Course') continue;
      const direct = offerCents(n.offers);
      if (direct != null) return direct;
      const inst = n.hasCourseInstance;
      const arr = Array.isArray(inst) ? inst : inst ? [inst] : [];
      for (const i of arr as Record<string, unknown>[]) {
        const c = offerCents(i?.offers);
        if (c != null) return c;
      }
    }
  }
  return null;
}

/** Nombre desde el primer <h1> (para sitios con <title> stale/genérico). */
export function nameFromH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return stripTags(m[1])
    .replace(/^(Oposici[oó]n(?:es)?\s+(?:a\s+|de\s+|al\s+)?|Academia\s+(?:de\s+)?(?:Oposiciones\s+(?:de\s+)?)?)/i, '')
    .replace(/\s+en\s+[A-ZÁÉÍÓÚ][a-záéíóú]+\s*$/, '')
    .trim();
}

/** Nombre desde el <title> quitando prefijos/sufijos comerciales comunes. */
export function nameFromTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  let t = stripTags(m[1]);
  // Corta el sufijo de marca (" | X", " - X", " – X") y prefijos habituales.
  t = t.replace(/\s*[|–-]\s*[^|–-]*$/, '').trim();
  t = t.replace(/^(Oposici[oó]n(?:es)?\s+(?:a\s+|de\s+|al\s+)?|Curso\s+(?:de\s+)?|Temario\s+(?:de\s+)?|▷\s*Oposiciones\s+)/i, '').trim();
  t = t.replace(/\s+\d{4}.*$/, '').trim(); // "... 2026 ..."
  return t;
}
