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
