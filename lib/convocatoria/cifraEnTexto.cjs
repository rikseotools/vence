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

/**
 * Numeral en letra de un entero >= 0. Fuera de ese dominio devuelve `null` (no una excepción, y
 * sobre todo no una recursión): `enLetra(-5)` indexaba `U[-5]` → `undefined`, y `NaN`/`Infinity` no
 * entran en NINGUNA rama y caían en la recursión final (`enLetra(NaN/1000)`) hasta reventar la pila.
 * Devolver `null` en vez de `''` es deliberado: una cadena vacía la daría por encontrada cualquier
 * `includes('')`, que es exactamente el falso «sí, la cifra está» que este núcleo existe para evitar.
 */
function enLetra(n) {
  if (!Number.isInteger(n) || n < 0) return null
  if (n < 30) return U[n]
  if (n < 100) return D[Math.floor(n / 10)] + (n % 10 ? ` y ${U[n % 10]}` : '')
  if (n === 100) return 'cien'
  if (n < 1000) return C[Math.floor(n / 100)] + (n % 100 ? ` ${enLetra(n % 100)}` : '')
  const mil = Math.floor(n / 1000), r = n % 1000
  return (mil === 1 ? 'mil' : `${enLetra(mil)} mil`) + (r ? ` ${enLetra(r)}` : '')
}

// Palabras que componen un numeral español, en los DOS géneros: los boletines escriben tanto
// «doscientos puestos» como «doscientas plazas». La conjunción «y» NO está aquí a propósito: se
// trata aparte, porque no siempre une un numeral (ver `tocaOtroNumeral`).
const PALABRA_NUMERAL = /^(mil|mill[óo]n|millones|cien|ciento|cientos|un|un[oa]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci(s[ée]is|siete|ocho|nueve)|veinte|veinti(un[oa]?|d[óo]s|tr[ée]s|cuatro|cinco|s[ée]is|siete|ocho|nueve)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|quinient[oa]s|(dos|tres|cuatro|seis|sete|ocho|nove)cient[oa]s)$/

/**
 * ¿La palabra vecina delata que lo escrito es OTRO número?
 *
 * La conjunción «y» se mira de refilón: sola no dice nada («personal laboral y tres plazas» prueba
 * el 3 perfectamente), pero entre dos numerales sí une («treinta y seis» no prueba el 30 ni el 6).
 * Por eso, cuando la vecina es «y», el que decide es el que está detrás de ella.
 */
function tocaOtroNumeral(vecina, masAlla) {
  if (!vecina) return false
  if (vecina === 'y') return !!masAlla && PALABRA_NUMERAL.test(masAlla)
  return PALABRA_NUMERAL.test(vecina)
}

/**
 * Las dos escrituras del mismo numeral: «doscientos puestos» / «doscientas plazas».
 *
 * `enLetra` escribe en masculino y los boletines concuerdan con lo que cuentan, que casi siempre es
 * «plazas» — femenino. Buscar solo el masculino no da falsos verdes (nadie escribe «doscientas»
 * para decir otra cifra), da ACUSACIONES FALSAS: la convocatoria tiene el dato con todas sus letras
 * y el detector jura que no aparece. Es el mismo error que quitar la búsqueda en letra.
 */
function formasDeGenero(letra) {
  const fem = letra
    .replace(/cientos\b/g, 'cientas')
    .replace(/\bveintiuno\b/g, 'veintiuna')
    .replace(/\buno\b/g, 'una')
  return fem === letra ? [letra] : [letra, fem]
}

/**
 * ¿Aparece el numeral `letra` como un número COMPLETO del texto, y no como pieza de otro mayor?
 *
 * Los numerales españoles se componen, así que —al revés que en dígitos— la frontera de palabra no
 * basta: «treinta» es palabra entera dentro de «treinta y seis», y «mil» lo es dentro de «dos mil
 * setecientas cuatro». Se compara token a token y se exige que ninguna palabra de numeral toque la
 * aparición por ninguno de los dos lados.
 */
function numeralSuelto(t, letra) {
  const palabras = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const buscada = letra.split(' ')
  for (let i = 0; i + buscada.length <= palabras.length; i++) {
    if (buscada.some((w, k) => palabras[i + k] !== w)) continue
    const fin = i + buscada.length
    if (tocaOtroNumeral(palabras[i - 1], palabras[i - 2])) continue
    if (tocaOtroNumeral(palabras[fin], palabras[fin + 1])) continue
    return true
  }
  return false
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
  // Basura (negativo, decimal, NaN, Infinity, string): NO puede estar probada por ningún documento,
  // así que `false` — nunca una excepción. Un detector que revienta deja de reportar, y ese silencio
  // se lee como «está todo limpio»: el modo de fallo que el runbook manda descartar antes de celebrar.
  if (!Number.isInteger(n) || n < 0) return false
  if (!texto) return false            // sin corpus, imposible
  const t = ' ' + String(texto).replace(/\s+/g, ' ').toLowerCase() + ' '
  // El numeral en LETRA también necesita frontera, y no la misma: los numerales españoles se
  // COMPONEN, así que uno puede ser palabra entera DENTRO de otro. `includes` a secas daba por
  // probado el 30 dentro de «treinta y seis», el 1000 dentro de «dos mil setecientas cuatro», el
  // 200 dentro de «doscientos cincuenta y tres» y hasta el 2 dentro de «todos». Es el MISMO falso
  // verde que T-202 quitó de los dígitos, que se quedó intacto aquí porque el fixture solo traía
  // un caso positivo en letra y ningún negativo de colisión por prefijo.
  const letra = n <= 9999 ? enLetra(n) : null
  if (letra && formasDeGenero(letra.toLowerCase()).some((f) => numeralSuelto(t, f))) return true
  // En DÍGITOS se exige que la cifra sea un número ENTERO del texto, no una subcadena de otro.
  //
  // [T-202] `includes` a secas daba por probadas cifras que solo existen DENTRO de otro número:
  // «216» dentro del código `C1.1000197163216` (administrativo-andalucia), «278» dentro de
  // «2781853» (auxiliar-administrativo-canarias), «317» dentro de «Total31745362» (una tabla que
  // el extractor de PDF aplanó pegando las celdas). Medido sobre las 118 convocatorias vivas: **7**
  // estaban en verde ÚNICAMENTE por esto. Como el detector solo puede afirmar «si no aparece ni una
  // vez, el documento no la prueba», una aparición que ningún lector reconocería como esa cifra no
  // vale: convierte el silencio del badge en una garantía que no existe.
  const escapar = (s) => s.replace(/[.]/g, '\\.')
  return [String(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')]
    .some((f) => new RegExp(`(?<![\\d.,])${escapar(f)}(?![\\d.,]?\\d)`).test(t))
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
