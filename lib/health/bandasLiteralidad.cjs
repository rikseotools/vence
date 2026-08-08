// lib/health/bandasLiteralidad.cjs — núcleo puro de `audit-literalidad-clave.cjs` [T-672].
//
// Solo el bucketing del histograma de recall(clave↔artículo propio). Se extrae a `lib/` (en vez
// de vivir inline en el script) para poder testearlo sin arrastrar la conexión a Postgres que
// el script crea a nivel de módulo — mismo motivo por el que `lib/health/vinculoArticuloVecino.cjs`
// vive separado de `scripts/audit-vinculo-articulo-vecino.cjs`.

/** Bandas del histograma. Son de INSPECCIÓN, no de decisión — el umbral de acción (si alguno)
 * se fija DESPUÉS de leer muestras de cada banda, no antes (ver ficha T-672). */
const BANDAS = [
  [0, 10], [10, 25], [25, 40], [40, 55], [55, 70], [70, 85], [85, 101],
];

/** @param {number} pct recall en 0-100 @returns {string} etiqueta de banda, p.ej. "0-10" */
function bandaDe(pct) {
  for (const [lo, hi] of BANDAS) if (pct >= lo && pct < hi) return `${lo}-${hi === 101 ? 100 : hi}`;
  return '?';
}

module.exports = { BANDAS, bandaDe };
