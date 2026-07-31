// backend/src/law-source-watch/source-watch.core.ts
//
// ⚠️ COPIA PARITARIA de `lib/laws/sourceWatch.cjs`. NO editar una sin la otra: el guardarraíl
// `__tests__/guardrails/sourceWatchParidad.test.ts` compara las dos y falla si divergen.
//
// ── POR QUÉ HAY DOS COPIAS ─────────────────────────────────────────────────────────────────
//
// El backend (NestJS, Fargate) no importa de `lib/`: son dos paquetes distintos. El patrón de
// la casa para esto es copia + guardarraíl de paridad, igual que `lib/observability/benignSignals`
// y su gemelo del backend. Es feo y es deliberado: lo que NO se puede permitir es que el cron
// y el CLI clasifiquen distinto, porque entonces la línea base que fija uno la lee el otro como
// «cambiada» y la señal se vuelve ruido. La paridad la vigila un test, no la memoria de nadie.
//
// El contexto completo (por qué hash y no LLM, y las dos trampas que evita) está en el fichero
// original. Aquí solo la lógica, para que la comparación de los dos ficheros sea posible.

import { createHash } from 'crypto';

/** Por debajo de esto no es un documento: es un error, una redirección o un WAF. */
export const MINIMO_SERVIBLE = 500;

// Páginas que responden 200 y NO traen el documento: captcha, WAF, bloqueo por IP, error del
// servidor maquillado. Cazadas el 31/07 con el BORM, que devolvía una pantalla de captcha con
// un «incident id» DISTINTO en cada descarga: 810 caracteres —por encima del mínimo— y hash
// nuevo cada vez, o sea «cambiada» a diario para siempre.
const FIRMAS_BLOQUEO = [
  /solve this captcha/i,
  /request unblock/i,
  /incident id:/i,
  /access denied/i,
  /attention required/i,
  /cloudflare/i,
  /forbidden/i,
  /su navegador no soporta|javascript.*(habilitad|enabled)/i,
];

/** ¿El texto descargado es una pantalla de bloqueo en vez del documento? */
export function pareceBloqueo(texto: string | null | undefined): boolean {
  const t = String(texto ?? '');
  // Solo se juzga como bloqueo si además es CORTO: un documento legal de verdad puede citar la
  // palabra «forbidden» o hablar de Cloudflare sin dejar de ser el documento.
  if (t.length > 12000) return false;
  return FIRMAS_BLOQUEO.some((re) => re.test(t));
}

/**
 * Deja el texto en lo que de verdad identifica a la norma. Conservador a propósito: solo
 * aplasta variabilidad de FORMA y marcas de fecha de consulta, nunca contenido.
 */
export function normalizarParaHash(texto: string | null | undefined): string {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(
      /(consultado|descargado|impreso|generado)\s+el\s+\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}[^\n]*/gi,
      ' ',
    )
    .replace(/\bp[áa]gina\s+\d+\s+de\s+\d+/gi, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .toLowerCase()
    .trim();
}

/** Hash estable del contenido normalizado. */
export function hashFuente(texto: string | null | undefined): string {
  return createHash('sha256').update(normalizarParaHash(texto), 'utf8').digest('hex');
}

export type EstadoVigilancia = 'sin_cambio' | 'cambiada' | 'inaccesible' | 'linea_base';

export interface ResultadoVigilancia {
  estado: EstadoVigilancia;
  hash: string | null;
  motivo: string;
}

export function clasificarVigilancia({
  hashPrevio,
  textoDescargado,
}: {
  hashPrevio?: string | null;
  textoDescargado?: string | null;
}): ResultadoVigilancia {
  const texto = String(textoDescargado ?? '');
  if (pareceBloqueo(texto)) {
    return {
      estado: 'inaccesible',
      hash: null,
      motivo: 'la fuente devolvió una pantalla de bloqueo/captcha, no el documento',
    };
  }
  if (texto.trim().length < MINIMO_SERVIBLE) {
    return {
      estado: 'inaccesible',
      hash: null,
      motivo: `descarga vacía o demasiado corta (<${MINIMO_SERVIBLE} chars)`,
    };
  }
  const hash = hashFuente(texto);
  if (!hashPrevio) {
    return {
      estado: 'linea_base',
      hash,
      motivo: 'primera captura: se guarda como referencia, no hay nada con que comparar',
    };
  }
  if (hash === hashPrevio) return { estado: 'sin_cambio', hash, motivo: 'idéntica a la última captura' };
  return {
    estado: 'cambiada',
    hash,
    motivo: 'el contenido de la fuente oficial ha cambiado desde la última captura',
  };
}
