/**
 * ¿Aparece una cifra en un documento oficial, en cualquiera de las formas en que un boletín la escribe?
 *
 * NÚCLEO PURO compartido — sin BD, sin red, sin estado. Lo usan TRES consumidores que deben coincidir
 * al dígito, porque una discrepancia entre ellos sería un hallazgo que aparece o desaparece según quién
 * mire:
 *   1. `scripts/audit-convocatoria-completitud.cjs`  (auditor bajo demanda + gate de CI)
 *   2. `scripts/health-sweep.cjs`                     (sweep nocturno → badge de Salud del contenido)
 *   3. `backend/src/content-health-sweep/…`           (gemelo @Cron; mantiene su propio mirror)
 *
 * Vivía suelto dentro del auditor. Se extrae aquí al llevar el hallazgo al badge: dos copias de una
 * tabla de numerales divergen en cuanto alguien toque una — y el fallo sería silencioso (una cifra que
 * el auditor da por probada y el sweep denuncia, o al revés).
 */

// Cifras en letra: los boletines las escriben así por convención jurídica, sobre todo las pequeñas —
// que son la mayoría del catálogo. Un buscador solo-dígitos daría 22 acusaciones falsas de 31 (medido
// el 16/07 con `proponer-plazas-boe.cjs`, que lleva la misma tabla y la misma cicatriz).
const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve']
const D = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos']

function enLetra(n) {
  if (n < 30) return U[n]
  if (n < 100) return D[Math.floor(n / 10)] + (n % 10 ? ` y ${U[n % 10]}` : '')
  if (n === 100) return 'cien'
  if (n < 1000) return C[Math.floor(n / 100)] + (n % 100 ? ` ${enLetra(n % 100)}` : '')
  const mil = Math.floor(n / 1000), r = n % 1000
  return (mil === 1 ? 'mil' : `${enLetra(mil)} mil`) + (r ? ` ${enLetra(r)}` : '')
}

/**
 * ¿Aparece la cifra `n` en `texto`, en cualquiera de las formas en que un boletín la escribe?
 * (1030 · 1.030 · «mil treinta»).
 *
 * Es condición NECESARIA de que el documento pruebe la cifra, no suficiente: que un «3» aparezca no
 * prueba que sean 3 plazas — eso se lee. Pero si no aparece NI UNA VEZ, no puede probarla, y eso sí
 * se puede afirmar sin criterio.
 */
function cifraEnTexto(n, texto) {
  if (n == null) return true          // sin cifra no hay nada que probar
  if (!texto) return false            // sin corpus, imposible
  const t = ' ' + String(texto).replace(/\s+/g, ' ').toLowerCase() + ' '
  const formas = [String(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), ...(n <= 9999 ? [enLetra(n)] : [])]
  return formas.some((f) => t.includes(f.toLowerCase()))
}

/**
 * ¿Es esta fila una cifra de plazas AFIRMADA como hecho pero sin ningún documento que la contenga?
 *
 * Pura y separada de la query a propósito: la regla tiene dos válvulas de escape legítimas y ambas se
 * prueban aquí sin BD.
 *  - `plazas_prevision`: una previsión declarada NO es una afirmación de hecho (la filtra la query).
 *  - `derivada_declarada`: la cifra correcta a veces no está escrita en ningún sitio y se obtiene
 *    sumando literales DEL MISMO documento (el turno libre de Extremadura: 23 + 103 = 126, y el «126»
 *    no aparece). Es honesto, pero «lo sumé yo» es también lo que se dijo del 2.163 de Policía Nacional,
 *    que sí era una invención. Por eso no se silencia sola: hay que firmarla en `convocatoria_verification`.
 *
 * @param {{plazas_libres:number|null, corpus:string|null, docs:number, derivada_declarada:boolean|null}} fila
 * @returns {boolean} true si hay hallazgo (cifra huérfana)
 */
function esPlazaHuerfana(fila) {
  if (!fila || fila.plazas_libres == null) return false
  if (!cifraEnTexto(fila.plazas_libres, fila.corpus)) {
    // La válvula `cifra_derivada` exime… pero solo si la firma es VERIFICABLE. Hasta el 27/07 bastaba
    // con que existiera: yo mismo firmé una que justificaba 139 como «144 menos las 5 reservadas», una
    // resta que no aparece escrita, y el aviso se calló. Ahora la firma tiene que sostenerse sola —
    // la cifra ha de ser suma de literales de su propia cita. Ver `validarDerivada.cjs`.
    if (fila.derivada_declarada === true) {
      const { validarFirmaDerivada } = require('./validarDerivada.cjs')
      return !validarFirmaDerivada({ plazas: fila.plazas_libres, snippet: fila.derivada_snippet }).ok
    }
    return true
  }
  return false
}

module.exports = { enLetra, cifraEnTexto, esPlazaHuerfana }
