/**
 * Núcleo PURO del embudo de `detect-oep-llm` (T-166).
 *
 * Responde a una sola pregunta, sin red y sin BD: **¿el texto que le llegaría al
 * modelo es el mismo que la última vez?** Si lo es, la llamada al LLM no puede
 * aportar nada nuevo y se puede saltar.
 *
 * ## Por qué el hash actual NO sirve para esto
 *
 * `OepSignalsLlmService.computeContentHash()` hashea `cleanHtml(html, 100000)`,
 * pero a Haiku solo se le mandan `cleanHtml(html, 20000)`. Un cambio a partir
 * del carácter 20.001 mueve ese hash **sin poder alterar una coma de lo que el
 * modelo ve** → gatear con él seguiría pagando llamadas inútiles. El gate tiene
 * que hashear EXACTAMENTE la entrada del modelo, que es lo que hace `llmInputHash`.
 *
 * ## Aviso obligatorio antes de fiarse de esto (T-047)
 *
 * Ya hubo un sensor `hash_change` sobre estas mismas páginas y **se retiró con un
 * 4% de acierto**: muchas sirven un banner con la fecha/hora y cambian de hash a
 * diario sin cambiar nada relevante. La herramienta que lo diagnosticó sigue ahí
 * (`scripts/diag-seguimiento-ruido.cjs`).
 *
 * La diferencia de ESTE uso es de riesgo, no de fiabilidad: allí un falso
 * "cambió" emitía una señal falsa a la bandeja; aquí solo cuesta una llamada de
 * LLM de más. **La asimetría manda:** un falso "cambió" cuesta céntimos; un falso
 * "NO cambió" es una convocatoria que no detectamos. Por eso el gate solo puede
 * saltarse la llamada con igualdad EXACTA de la entrada, nunca con parecido.
 *
 * @module lib/oep/llmInputHash
 */

const crypto = require('crypto');

/** Lo que el LLM recibe hoy (`extractOepFromHtml`). No tocar sin medir. */
const LLM_MAX_CHARS = 20000;
/** Lo que hashea hoy `computeContentHash()`. Aquí solo para poder comparar. */
const LEGACY_HASH_MAX_CHARS = 100000;

/**
 * Espejo EXACTO de `OepSignalsLlmService.cleanHtml`.
 *
 * Si aquello cambia y esto no, el gate hashea un texto distinto del que se
 * analiza y decide mal. La paridad se fija en el test, no en la buena voluntad.
 */
function cleanHtml(html, maxChars) {
  let text = String(html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + ' ...[truncado]';
  }
  return text;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Hash de EXACTAMENTE lo que se le manda al modelo. Es el gate propuesto. */
function llmInputHash(html) {
  return sha256(cleanHtml(html, LLM_MAX_CHARS));
}

/** Hash como lo calcula hoy el backend (100k). Solo para medir la diferencia. */
function legacyContentHash(html) {
  return sha256(cleanHtml(html, LEGACY_HASH_MAX_CHARS));
}

/**
 * ¿Hace falta llamar al LLM?
 *
 * Sin hash previo → SÍ (nunca se ha mirado: no se puede descartar a ciegas).
 * Hash distinto  → SÍ.
 * Hash idéntico  → NO: la entrada del modelo es byte a byte la misma.
 */
function necesitaLlm(htmlActual, hashPrevio) {
  const hash = llmInputHash(htmlActual);
  if (!hashPrevio) return { necesita: true, hash, motivo: 'sin_hash_previo' };
  if (hash !== hashPrevio) return { necesita: true, hash, motivo: 'cambio' };
  return { necesita: false, hash, motivo: 'sin_cambios' };
}

module.exports = {
  LLM_MAX_CHARS,
  LEGACY_HASH_MAX_CHARS,
  cleanHtml,
  llmInputHash,
  legacyContentHash,
  necesitaLlm,
};
