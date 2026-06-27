/**
 * Helpers PUROS para el sensor `detect-notas-convocatoria`.
 *
 * Lógica portada de los scripts validados en runtime contra datos reales
 * (`scripts/leer-notas-oposicion.cjs`, `scripts/sim-notas-pipeline.cjs`):
 * Aragón (extrae Windows 11 + Word/Excel 365 con cita), Tramitación
 * (Playwright rescata 3 PDF), Catalunya (0 docs → confianza baja).
 *
 * Sin DI, sin red, fáciles de testear (jest).
 */

/** Un documento (nota/PDF) enlazado desde la página de seguimiento. */
export interface DocLink {
  href: string;
  /** Texto del ancla (para detectar sublinks "documentación/notas"). */
  text: string;
}

/** Señales extraídas del texto de una nota. */
export interface NotaSignals {
  versiones: string[];
  fechas: string[];
  criterio: string[];
  material: string[];
  penalizacion: string[];
}

const DOC_RX = /\.pdf(\?|$)|\/documents?\//i;
const ASSET_RX =
  /\.(css|js|png|jpe?g|svg|gif|webp|woff2?|ico|themeconfig)(\?|$)|\/index\.html?$/i;
const SUBLINK_RX =
  /document|nota|convocat|bases|informaci|anunci|publicaci|temari|programa/i;

/**
 * Palabras clave que disparan revisión humana. La de `versiones` capta AMBOS
 * órdenes ("Windows 11" y "versión 11 de Windows") — el bug que casi se nos
 * escapa el 27/06: la nota del IAAP escribía "la versión 11 de Windows".
 */
const KEYWORDS: Record<keyof NotaSignals, RegExp> = {
  versiones:
    /\b(windows(\s*(11|10|8|7|xp))?|versi[oó]n\s*\d+\s*de\s*windows|word|excel|outlook|office|microsoft\s*365|powerpoint|access|libreoffice|navegador|edge|chrome)\b/gi,
  fechas: /\b(fecha|primer ejercicio|segundo ejercicio|llamamiento|examen|celebra)\b/gi,
  criterio: /\b(versi[oó]n m[aá]s moderna|legislaci[oó]n actualizada|criterio)\b/gi,
  material: /\b(calculadora|material permitido|legislaci[oó]n permitida|sin anotaciones)\b/gi,
  penalizacion: /\b(penaliz|aciertos|errores|respuestas? en blanco|f[oó]rmula de correcci[oó]n)\b/gi,
};

/** Extrae todos los anclas `<a href>` con su texto de un HTML. */
export function extractAnchors(html: string, baseUrl: string): DocLink[] {
  const out: DocLink[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    try {
      href = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    out.push({ href, text });
  }
  return out;
}

/** Documentos reales (PDF o /documents/), excluyendo assets de la web. */
export function extractDocLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  for (const a of extractAnchors(html, baseUrl)) {
    if (DOC_RX.test(a.href) && !ASSET_RX.test(a.href)) seen.add(a.href);
  }
  return [...seen];
}

/**
 * Sublinks candidatos a contener documentos (texto "documentación/notas/…"),
 * para seguir 1 nivel cuando la página principal trae pocos docs.
 */
export function extractSublinks(html: string, baseUrl: string, max = 4): string[] {
  const seen = new Set<string>();
  for (const a of extractAnchors(html, baseUrl)) {
    if (
      SUBLINK_RX.test(a.text) &&
      /^https?:/.test(a.href) &&
      !DOC_RX.test(a.href) &&
      !ASSET_RX.test(a.href)
    ) {
      seen.add(a.href);
    }
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** Quita tags HTML y normaliza espacios (texto plano aproximado). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escanea un texto y devuelve las señales encontradas (deduplicadas). */
export function scanSignals(text: string): NotaSignals {
  const out: NotaSignals = {
    versiones: [],
    fechas: [],
    criterio: [],
    material: [],
    penalizacion: [],
  };
  (Object.keys(KEYWORDS) as Array<keyof NotaSignals>).forEach((k) => {
    const found = text.match(KEYWORDS[k]) ?? [];
    out[k] = [...new Set(found.map((x) => x.toLowerCase()))];
  });
  return out;
}

/** ¿Hay alguna señal accionable (versiones/criterio) que merezca triaje? */
export function hasActionableSignal(s: NotaSignals): boolean {
  return s.versiones.length > 0 || s.criterio.length > 0;
}

/** Prompt para que Claude extraiga señales estructuradas (JSON) de las notas. */
export function buildNotasPrompt(slug: string, pageText: string, notas: Array<{ title: string; text: string }>): string {
  const corpus = [`PÁGINA DE SEGUIMIENTO (${slug}):\n${pageText.slice(0, 8000)}`]
    .concat(notas.map((n, i) => `\n--- NOTA ${i + 1}: ${n.title} ---\n${n.text.slice(0, 8000)}`))
    .join('\n')
    .slice(0, 60000);
  return `Eres analista de oposiciones. Lee la página de seguimiento y las notas informativas de una convocatoria española. Extrae SOLO lo que afecte al contenido de las preguntas de examen.

IMPORTANTE sobre versiones de software: las notas suelen fijar qué versión de Windows/Office se examina, con frases como "la versión 11 de Windows", "Word para Microsoft 365 en la Web", "Excel 2016". Captúralas SIEMPRE (ambos órdenes: "Windows 11" y "versión 11 de Windows" → windows:"11"). Si solo hay criterio general ("la referencia siempre es a la versión más moderna"), ponlo en criterio_version Y deduce la moderna (Windows 11, Microsoft 365) con confianza:"media".

Devuelve EXCLUSIVAMENTE un JSON válido (sin texto fuera del JSON):
{"software_versions":{"windows":"<o null>","word":"<o null>","excel":"<o null>","office_o_365":"<o null>","otros":"<o null>"},"fecha_examen":"<o null>","criterio_version":"<o null>","material_permitido":"<o null>","penalizacion":"<o null>","otras_aclaraciones":["..."],"citas":[{"dato":"...","cita_literal":"<exacta>","fuente":"<título de nota o 'página'>"}],"confianza":"alta|media|baja"}
Si un dato no aparece, null. NO inventes citas. Texto:\n\n${corpus}`;
}

/** Parsea la respuesta del LLM a objeto; tolera fences ```json y truncado. */
export function parseNotasJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // intento de rescate: mayor bloque {...}
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
