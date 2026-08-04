// lib/health/psicotecnicoExplicacionSinRespuesta.cjs
//
// Detecta explicaciones de PSICOTÉCNICOS que no llevan a la respuesta que dicen explicar.
//
// ── POR QUÉ ES UNA FAMILIA PROPIA (T-500, 03/08/2026) ──────────────────────────────────────
// Todos los detectores de explicaciones del barrido —`audit_note_explanation`,
// `explicacion_estructura_rota`, `cita_no_literal`— comparan la explicación con el ARTÍCULO
// vinculado. Una psicotécnica no tiene artículo, así que ninguno la mira: son 7.040 preguntas
// activas con explicación y cero cobertura.
//
// Y en una psicotécnica la explicación pesa MÁS que en una legislativa: el opositor no tiene un
// BOE contra el que contrastar, así que si el razonamiento miente se lleva el método equivocado
// al examen. El caso que lo destapó (impugnación `3ff87618`) tenía la CLAVE BIEN y la explicación
// razonando sobre otro dato: llegaba al número correcto por un camino falso.
//
// ── LO QUE ESTE NÚCLEO SÍ PUEDE VER, Y LO QUE NO ───────────────────────────────────────────
// Lo mecanizable es si la explicación **llega a decir su propia respuesta**. Que el RAZONAMIENTO
// sea correcto no lo es: el caso origen citaba su cifra y estaba mal. Por eso el veredicto se
// llama «no cierra», no «es incorrecta», y el runner es BAJO DEMANDA (no pinga el badge).
//
// ── LAS EXENCIONES SON LO QUE SOSTIENE LA PRECISIÓN ────────────────────────────────────────
// Salen de leer 11 casos marcados, no de imaginar: sin ellas, uno de cada tres hallazgos era un
// defecto del comparador y no de la pregunta.
//   · decimal con APÓSTROFO (`5'5`), que es como se escribe media España;
//   · separador de MILES con punto (`2.400`) frente a decimal con coma;
//   · clave con VARIAS cifras (`20,120` son dos números de una serie): basta con que cite una;
//   · clave por RANGO (`Entre 2.001 y 2.500`): vale cualquier número dentro.

/** Extrae los números de un texto, tolerando `1.234,5`, `5'5` y `5.5`. */
function numeros(texto) {
  const out = []
  const re = /\d[\d.,'’]*/g
  let m
  while ((m = re.exec(String(texto || ''))) !== null) {
    let v = m[0].replace(/[.,'’]$/, '')
    // Miles con punto: 1.234 / 2.400.000 → quitar solo los puntos que separan grupos de 3.
    v = v.replace(/\.(?=\d{3}(\D|$))/g, '')
    // Decimal escrito con coma o con apóstrofo.
    v = v.replace(/['’]/g, '.').replace(',', '.')
    // Si quedan varios puntos, es una enumeración pegada: quedarse con el primer número.
    const partes = v.split('.')
    if (partes.length > 2) v = partes[0] + '.' + partes[1]
    const n = Number(v)
    if (Number.isFinite(n)) out.push(n)
    // AMBIGÜEDAD REAL: `20,120` puede ser el decimal 20,12 o los dos números de una serie. En
    // español los miles van con punto, así que la coma seguida de TRES cifras no se resuelve
    // mirando el texto: se devuelven las dos lecturas, porque ampliar el candidato solo puede
    // evitar marcar una pregunta sana. (La coma con una o dos cifras SÍ es decimal — `83,72` —,
    // y ensancharlo ahí rebajaría la sensibilidad de todo el detector.)
    const amb = /^(\d+),(\d{3})$/.exec(m[0])
    if (amb) out.push(Number(amb[1]), Number(amb[2]))
    // LISTA: `2,4,3,1` es el orden de una pregunta de ordenar frases, no un número. Se reconoce
    // por tener DOS comas o más (un decimal solo tiene una) y se devuelven todos sus miembros.
    // Sin esto, las preguntas de «ordene la oración» salían marcadas aunque su explicación diera
    // el orden correcto: el token entero se leía como un número imposible y se descartaba.
    if (/^\d+(,\d+){2,}$/.test(m[0])) out.push(...m[0].split(',').map(Number))
  }
  return out
}

const IGUAL = (a, b) => Math.abs(a - b) < 0.005

/** ¿La clave describe un RANGO («entre 2.001 y 2.500», «de 10 a 20»)? */
function rangoDe(clave) {
  const t = String(clave || '').toLowerCase()
  if (!/\b(entre|de)\b/.test(t)) return null
  const n = numeros(t)
  if (n.length !== 2) return null
  const [a, b] = n.sort((x, y) => x - y)
  return b > a ? { min: a, max: b } : null
}

/**
 * Marcas de que la explicación no es una explicación: nota de auditoría pegada, o un texto que
 * enuncia el método y se corta antes de resolver. La primera es la banda grave — no es que falte
 * el número, es que lo que se publica es una anotación interna.
 */
const NOTA_AUDITORIA = /(errores? en (el )?desglose|deber[íi]a (anularse|revisarse|decir)|posible errata|nota t[ée]cnica|revisar (la )?(clave|respuesta))/i

/**
 * @param {{correcta: string, explicacion: string, opciones?: string[]}} q
 * @returns {{cierra: boolean, severidad: 'error'|'warn'|null, motivo: string|null, exenta: string|null}}
 */
function analizarExplicacion(q) {
  const explicacion = String((q && q.explicacion) || '')
  const clave = String((q && q.correcta) || '')
  const ok = { cierra: true, severidad: null, motivo: null, exenta: null }

  // Una clave como `(2,1)` no es el decimal 2,1: son las DOS raíces de una ecuación. Se detecta
  // por los paréntesis, que es lo que la distingue de un decimal, y se añaden sus componentes.
  // Lo destapó reparar el lote de [T-502]: una explicación que resolvía «x = 1 y x = 2» se
  // marcaba como si cerrase con la cifra de otra opción.
  const nClave = numeros(clave)
  // Cuando el ENUNCIADO pide DOS valores («indique los dos números que seguirían»), una clave
  // como `2,1` es el par pedido y no el decimal 2,1. El dato que lo desambigua no está en la
  // clave sino en la pregunta, así que hay que mirarla: sin esto, una explicación que resuelve
  // «4 − 2 = 2 y 2 − 1 = 1» se marcaba como si cerrara con la cifra de otra opción.
  const pideVarios = /\bdos\s+(n[uú]meros|valores|t[eé]rminos|cifras)\b/i.test(String((q && q.pregunta) || ''))
  if ((pideVarios || /^\s*\(.+,.+\)\s*$/.test(clave)) && /,/.test(clave)) {
    for (const parte of clave.replace(/[()]/g, '').split(',')) {
      const n = numeros(parte)
      if (n.length) nClave.push(...n)
    }
  }
  if (!nClave.length) return { ...ok, exenta: 'clave_no_numerica' }
  // Clave que NO es un valor calculado sino una lista de enunciados («Sólo 2, 3 y 5», «Todas son
  // correctas (1, 2, 3, 4 y 5)»): sus cifras son etiquetas, y la explicación razona sin
  // nombrarlas. Medirla con este criterio marca preguntas sanas.
  if (/^\s*(s[oó]lo|solo|todas|ninguna|ambas|los?|las?)\b/i.test(clave) && nClave.every((n) => Number.isInteger(n) && n <= 10)) {
    return { ...ok, exenta: 'clave_enumera_enunciados' }
  }

  if (NOTA_AUDITORIA.test(explicacion)) {
    return { cierra: false, severidad: 'error', motivo: 'la explicación publicada es una nota de revisión interna, no resuelve la pregunta', exenta: null }
  }
  const nExp = numeros(explicacion)
  // Una pregunta de respuesta numérica cuya explicación no contiene NI UNA cifra no resuelve
  // nada: enuncia el método («se aplica la fórmula de iguales excluidos:») o describe el truco
  // («se trata de sustituir los números por letras») y ahí se acaba.
  //
  // ⚠️ AQUÍ HUBO UN CHECK MAL CALIBRADO Y LO CAZÓ CORRERLO CONTRA LO SANO (03/08). La primera
  // versión marcaba además por LONGITUD (<40 caracteres útiles), y en psicotécnicos eso es un
  // sinsentido: la explicación buena de un cálculo es corta por naturaleza —«X = 1·420/7 = 60
  // km/h»— así que 4 de los 5 primeros hallazgos graves eran preguntas perfectas. La longitud no
  // mide si una explicación resuelve; la presencia de la CIFRA sí. Regla del manual de
  // generación: si un check nuevo sale rojo sobre un lote que sabes bueno, el defecto está en el
  // check.
  if (!nExp.length) {
    return { cierra: false, severidad: 'error', motivo: 'la explicación no llega a resolver: enuncia el método y se corta', exenta: null }
  }
  const rango = rangoDe(clave)
  if (rango) {
    const dentro = nExp.some((x) => x >= rango.min && x <= rango.max)
    return dentro
      ? { ...ok, exenta: 'clave_por_rango' }
      : { cierra: false, severidad: 'warn', motivo: `la explicación no llega a ningún valor dentro del rango de la clave (${rango.min}-${rango.max})`, exenta: null }
  }

  // Con varias cifras en la clave (series, pares de valores) basta con que cite una.
  if (nClave.some((n) => nExp.some((m) => IGUAL(m, n)))) return ok

  // REDONDEO: la explicación llega a 111,35 semanas y la opción dice 111. Es la misma respuesta
  // — el enunciado pide semanas enteras — y marcarlo era el segundo falso positivo medido.
  if (nClave.some((n) => Number.isInteger(n) && nExp.some((m) => Math.round(m) === n))) {
    return { ...ok, exenta: 'redondeo' }
  }

  // Señal fuerte: la explicación cierra afirmando la cifra de OTRA opción.
  const otras = (q.opciones || []).filter((o) => String(o) !== clave).flatMap(numeros)
  const cierre = nExp.slice(-2)
  if (otras.some((o) => cierre.some((c) => IGUAL(c, o)))) {
    return { cierra: false, severidad: 'error', motivo: 'la explicación termina afirmando la cifra de otra opción, no la de la clave', exenta: null }
  }

  return { cierra: false, severidad: 'warn', motivo: 'la explicación nunca menciona la cifra de la respuesta que dice explicar', exenta: null }
}

module.exports = { numeros, rangoDe, analizarExplicacion, NOTA_AUDITORIA }
