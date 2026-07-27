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

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * ¿El texto que ve el MODELO incluye la fecha de un día concreto?
 *
 * Sirve para medir HOY el ruido de MAÑANA, sin esperar 24 h: una página que
 * imprime la fecha actual cambiará de hash cada día pase lo que pase, así que
 * el gate no la ahorrará nunca. Es el cohorte que en el histórico del 8 al 21
 * de julio "cambiaba todos los días" (9,5%).
 *
 * Solo mira DENTRO de la ventana del modelo: una fecha más allá del carácter
 * 20.000 no afecta al hash del gate y contarla inflaría la estimación.
 *
 * Formatos cubiertos (los habituales en boletines españoles): `27/07/2026`,
 * `27-7-2026`, `2026-07-27` y `27 de julio de 2026`.
 */
function contieneFecha(texto, dia = new Date()) {
  const d = dia.getDate();
  const m = dia.getMonth() + 1;
  const a = dia.getFullYear();
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return [
    new RegExp(`\\b${dd}[/.-]${mm}[/.-]${a}\\b`),
    new RegExp(`\\b${d}[/.-]${m}[/.-]${a}\\b`),
    new RegExp(`\\b${a}-${mm}-${dd}\\b`),
    new RegExp(`\\b${d}\\s+de\\s+${MESES[m - 1]}\\s+de\\s+${a}\\b`, 'i'),
  ].some((p) => p.test(texto));
}

module.exports = {
  LLM_MAX_CHARS,
  LEGACY_HASH_MAX_CHARS,
  cleanHtml,
  llmInputHash,
  legacyContentHash,
  necesitaLlm,
  contieneFecha,
};
