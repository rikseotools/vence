// lib/health/explicacionEstructuraRota.cjs — núcleo puro del detector `explicacion_estructura_rota`:
// preguntas ACTIVAS cuya explicación ESTRUCTURADA (`explanation_data`, Fase 2 de T-080) se
// renderiza ROTA, aunque su contenido sea correcto. Es un defecto de FORMA, no de fondo.
//
// ## Por qué hace falta, si ya hay detectores de explicaciones
//
// Los que había miran el TEXTO: `audit_note_explanation` caza la nota de auditoría colada como
// explicación, el cubo de «explicación apelotonada» mira el formato, `shuffle_safe_regressed` caza
// la letra clavada. Ninguno mira la **estructura** de la que hoy se compone el texto que se sirve.
// Y desde que producción renderiza desde `explanation_data` (Fase 2 viva), un campo mal formado ahí
// sale a pantalla tal cual: nadie lo lee, porque la columna `explanation` parece correcta.
//
// ## Qué mira (medido el 29/07/2026 sobre las 6.335 activas con estructura)
//
//   · `negrita_impar` — un `**` sin pareja. **163 preguntas · 7.988 exposiciones (2,6%).** Origen:
//     la transcripción del histórico partía «**A) Insertar** — …» y se quedaba con «Insertar** — …».
//     El usuario ve un asterisco doble suelto en mitad de la frase.
//   · `cita_sin_texto` / `cita_ref_es_el_texto` — la cita legal declara un `ref` y no trae `texto`
//     (el recuadro anuncia el artículo y no enseña nada), o trae la PROSA del artículo metida en el
//     campo `ref` (el render la pinta como encabezado, sin comillas y sin decir de qué artículo es).
//     **Hoy: 0.** No es una avería descartada, es una que NO está ocurriendo — y ese cero depende
//     por completo de la guarda de `bloque` de más abajo. Se queda como cerrojo de regresión: el
//     día que alguien escriba una cita sin `bloque` y sin `texto`, salta.
//
// El primer recuento de esta clase dio 1.412 «citas huecas». Era falso: todas tenían el `bloque`
// relleno, que es el campo que MANDA en el render. Está anotado aquí porque la cifra sin la guarda
// vuelve a salir en cuanto alguien consulte la tabla a mano, y conviene saber que no significa nada.
//
// ## De dónde salió
//
// De la auditoría posterior a la poda de narrativas del 29/07: cinco agentes revisaron 115
// preguntas que se acababan de tocar y señalaron «asteriscos huérfanos» en 11. Al comprobarlo
// contra el backup resultó que **ya venían rotas** — la reparación no las causó. Es decir: el
// defecto llevaba ahí desde la transcripción y ningún detector lo miraba. Esto lo mira.
//
// ## Lo que NO es
//
// No juzga el contenido. Una explicación puede estar aquí y ser jurídicamente impecable — el
// defecto es de FORMA, y por eso se puede detectar sin IA y reparar sin criterio en la mayoría de
// los casos. Y al revés: no estar aquí no dice nada sobre si la explicación es correcta.
//
// Runbook: `docs/runbooks/salud-contenido.md`. Hermanos: `lib/health/auditNoteExplanation.cjs`,
// `lib/shuffle/structuredExplanation.ts` (el render que convierte esto en lo que se ve).

/** ¿La cadena tiene un número IMPAR de delimitadores `**`? Entonces la negrita no cierra. */
function negritaDesbalanceada(s) {
  return ((String(s == null ? '' : s).match(/\*\*/g) || []).length % 2) === 1
}

/**
 * Longitud a partir de la cual una `ref` deja de parecer una referencia («Art. 35.3 de la Ley
 * 12/2009» son 26 caracteres) y pasa a ser, casi con seguridad, el TEXTO de la cita metido en el
 * campo equivocado. Calibrado sobre las 1.412 reales: por debajo de 60 hay referencias largas
 * legítimas («Artículo 27.4 del Reglamento de la Asamblea de Madrid» = 53).
 */
const REF_LARGA = 60

/**
 * Recorre todos los campos de texto de una estructura, incluidos los bloques.
 * Se mantiene aquí, y no en el llamador, para que el CLI y el cron no puedan divergir en QUÉ miran.
 */
function camposDeTexto(data) {
  const d = data || {}
  const out = [d.intro, d.outro]
  for (const v of Object.values(d.options || {})) out.push(v)
  for (const b of d.blocks || []) { out.push(b && b.intro, b && b.texto) }
  const c = d.cita
  if (c && typeof c === 'object') out.push(c.bloque, c.texto)
  return out.filter((x) => x != null)
}

/**
 * Veredicto por pregunta. Devuelve la lista de averías encontradas (vacía = sana).
 *
 * @param {{explanation_data?: object}} pregunta
 * @returns {{roto: boolean, averias: string[], detalle: object}}
 */
function classifyEstructura({ explanation_data } = {}) {
  const d = explanation_data
  if (!d || typeof d !== 'object') return { roto: false, averias: [], detalle: {} }

  const averias = []
  const detalle = {}

  if (camposDeTexto(d).some(negritaDesbalanceada)) averias.push('negrita_impar')

  const c = d.cita
  if (c && typeof c === 'object') {
    const ref = String(c.ref || '').trim()
    const texto = String(c.texto || '').trim()
    // `bloque` es el blockquote ÍNTEGRO y MANDA sobre ref/texto en el render: si está relleno, la
    // cita se pinta entera y no hay hueco que denunciar. Ignorar esto daría 1.412 falsos positivos
    // de golpe — es la primera guarda que hay que respetar al tocar este archivo.
    const tieneBloque = String(c.bloque || '').trim().length > 0
    if (!tieneBloque && ref && !texto) {
      averias.push('cita_sin_texto')
      detalle.ref = ref.slice(0, 120)
      if (ref.length > REF_LARGA) averias.push('cita_ref_es_el_texto')
    }
  }

  return { roto: averias.length > 0, averias, detalle }
}

/**
 * Filtra un lote y devuelve solo las rotas, ordenadas por EXPOSICIÓN descendente: se repara antes
 * lo que más gente está viendo, no lo que salga primero en la consulta.
 *
 * @param {Array<{id: string, explanation_data?: object, servidas?: number}>} filas
 */
function explicacionesRotas(filas) {
  const out = []
  for (const f of filas || []) {
    const v = classifyEstructura(f)
    if (v.roto) out.push({ id: f.id, averias: v.averias, servidas: Number(f.servidas || 0), detalle: v.detalle })
  }
  return out.sort((a, b) => b.servidas - a.servidas)
}

module.exports = {
  REF_LARGA,
  negritaDesbalanceada,
  camposDeTexto,
  classifyEstructura,
  explicacionesRotas,
}
