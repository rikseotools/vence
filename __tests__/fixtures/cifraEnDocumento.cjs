'use strict'
/**
 * FIXTURE COMPARTIDO — «¿esta cifra está en este documento?»
 *
 * ## Por qué existe (T-202, 28/07/2026)
 *
 * Tres implementaciones juzgan ese mismo hecho y **habían divergido sin que nadie se enterara**:
 *
 *   1. `lib/convocatoria/cifraEnTexto.cjs` — el núcleo del detector `plazas_afirmadas_sin_documento`
 *   2. `backend/src/content-health-sweep/…` — su mirror, en otro build (el @Cron nocturno)
 *   3. `lib/convocatoria/landingClaims.cjs` — contrasta lo que AFIRMA la landing contra el documento
 *
 * La 3 exigía desde el 26/07 que la cifra fuera un número entero del texto (su test:
 * *«no confunde 45 con 450 ni con 2.045»*) mientras la 1 se conformaba con un `includes`, así que
 * daba por probadas cifras que solo existen DENTRO de otra. Nadie los comparó nunca **porque cada
 * uno traía sus propios casos de prueba**: podían separarse sin que ningún test se pusiera rojo.
 *
 * Este fichero es el sitio ÚNICO donde se declara qué debe responder cada regla ante un texto. Si
 * alguien afina una implementación, o afina las demás o un test le dice exactamente qué acaba de
 * separar. **Al calibrar cualquiera de las tres, el caso nuevo se añade AQUÍ**, no en su suite.
 *
 * ## Las dos preguntas NO son la misma (y por eso hay dos columnas)
 *
 *   · `apareceLaCifra`  → ¿el documento contiene esa cifra? Es lo que puede afirmar el detector de
 *     plazas: si no aparece ni una vez, el documento no la prueba.
 *   · `laLlamaPlazas`   → ¿el documento la presenta COMO plazas («55 plazas»)? Es más exigente, y
 *     se midió que **NO sirve como regla del detector**: el boletín escribe «Mil setecientas cuatro
 *     (1704) plazas» o «Plazas del cupo general: 1.747», y las convocatorias sanitarias reparten
 *     las plazas en tablas por categoría donde la palabra no aparece al lado.
 *
 * Los casos donde las dos columnas DIFIEREN son deliberados y son el corazón de la calibración: el
 * documento prueba la cifra aunque el patrón de concepto no la case. Si alguna vez coinciden en
 * todo, es que alguien ha igualado dos reglas que miden cosas distintas.
 *
 * Todos los textos son LITERALES de corpus reales de `convocatoria_documentos`.
 */

/**
 * @typedef {Object} CasoCifra
 * @property {string}  nombre          qué situación fija
 * @property {number}  cifra           la que se busca
 * @property {string}  texto           literal del documento
 * @property {boolean} apareceLaCifra  veredicto de `cifraEnTexto` (núcleo y mirror)
 * @property {boolean|null} laLlamaPlazas  veredicto de `landingClaims` (null = no aplica)
 * @property {string}  origen          de dónde salió el caso
 */

/** @type {CasoCifra[]} */
const CASOS = [
  // ── La cifra NO está: solo aparece dentro de otro número ────────────────────────────────────
  {
    nombre: 'dentro de un código de puesto',
    cifra: 216,
    texto: 'B.1.3 C.ADMINISTRATIVO C1.1000197163216 C.DE AYUDANTES C1.25041055',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'administrativo-andalucia — estaba en verde por esto',
  },
  {
    nombre: 'dentro de un número más largo',
    cifra: 278,
    texto: 'PLAZAS ADICIONALES TD C211L26181 8 69 4 28 6 2781853 6 Grupo E',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'auxiliar-administrativo-canarias',
  },
  {
    nombre: 'dentro de una tabla que el extractor de PDF aplanó',
    // «Total | 317 | 45 | 362» salió como «Total31745362». El dato es CORRECTO (cuadra con
    // plazas_libres=317 y plazas_discapacidad=45) pero ningún lector reconoce ahí la cifra: el
    // detector debe pedir prueba legible, no adivinar. Se arregla el documento o se firma.
    cifra: 317,
    texto: 'Acuerdo 52/2025, de 11 de diciembre19220212 Total31745362 2.2. Las personas aspirantes',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'auxiliar-administrativo-cyl',
  },
  {
    nombre: 'no confunde la cifra con el final de un millar',
    cifra: 747,
    texto: 'un total de 1.747 plazas',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'derivado de tcae-sermas-madrid',
  },
  {
    nombre: 'no confunde la cifra con una parte decimal',
    cifra: 5,
    texto: 'un incremento del 44,5 % sobre la plantilla',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'T-202',
  },
  {
    nombre: 'la cifra sencillamente no está',
    cifra: 561,
    texto: 'se convocan 231 plazas de policía municipal',
    apareceLaCifra: false,
    laLlamaPlazas: false,
    origen: 'el hallazgo legítimo de siempre',
  },

  // ── La cifra SÍ está, pero el patrón de concepto no la casa (divergencia DELIBERADA) ────────
  {
    nombre: 'la palabra «Plazas» va DELANTE, con dos puntos',
    cifra: 1747,
    texto: 'y se dividen en dos cupos: — Plazas del cupo general: 1.747. — Plazas del cupo de reserva',
    apareceLaCifra: true,
    laLlamaPlazas: false, // el patrón es «N plazas», no «plazas: N» → por eso no sirve de regla
    origen: 'tcae-sermas-madrid (BOCM)',
  },
  {
    nombre: 'un paréntesis se cuela entre el número y la palabra',
    cifra: 1704,
    texto: 'c) Mil setecientas cuatro (1704) plazas libres. 1.2 Las plazas reservadas',
    apareceLaCifra: true,
    laLlamaPlazas: false,
    origen: 'guardia-civil (BOE)',
  },

  // ── La cifra SÍ está y el documento la llama plazas ──────────────────────────────────────────
  {
    nombre: 'la forma canónica: «N plazas»',
    cifra: 55,
    texto: 'la provisión en propiedad de 55 plazas de Auxiliar Administrativo/a, mediante oposición',
    apareceLaCifra: true,
    laLlamaPlazas: true,
    origen: 'auxiliar-administrativo-ayuntamiento-cordoba (BOP)',
  },
  {
    nombre: 'el numeral en LETRA, como escriben los boletines las cifras pequeñas',
    // Quitar la búsqueda en letra al exigir frontera habría acusado a esta convocatoria, que tiene
    // el dato escrito con todas las letras. Lo cazó la simulación de T-202, no un test.
    cifra: 36,
    texto: 'se convocan treinta y seis plazas de la escala administrativa',
    apareceLaCifra: true,
    laLlamaPlazas: true,
    origen: 'administrativa-universidad-de-murcia',
  },
  {
    nombre: 'con punto de millar, como lo imprime el boletín',
    cifra: 1030,
    texto: 'un total de 1.030 plazas',
    apareceLaCifra: true,
    laLlamaPlazas: true,
    origen: 'T-142',
  },
]

module.exports = { CASOS }
