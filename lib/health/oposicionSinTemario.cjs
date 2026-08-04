// lib/health/oposicionSinTemario.cjs
//
// «Se puede elegir —y pagar— una oposición que no tiene ni un tema». [T-397]
//
// El catálogo deja elegir oposiciones `catalogada` (vigiladas pero NO preparadas), y el cobro
// no comprueba si esa oposición tiene temario. Quien cae ahí no ve temas, ni progreso por
// bloques, ni nada que practicar: solo le queda el test por leyes, artículo por artículo.
//
// ## Por qué hace falta un detector y no basta con la cifra medida a mano
//
// La cifra existía (592 usuarios / 3 premium, medido el 31/07) porque alguien la contó una vez.
// Sin detector, dentro de un mes nadie sabe si mejoró o empeoró. Y **empeora**: al reproducir la
// medición el 01/08 salieron **594 usuarios y 4 premium** — un premium nuevo en un solo día. Esto
// no es un stock parado que se pueda vaciar cuando haya tiempo, es una entrada continua.
//
// ## Los detectores que ya existen NO lo ven, y por eso hay hueco
//
// Los badges de salud de contenido (temas vacíos, cobertura, artículos sin preguntas) miran
// dentro de las oposiciones que PREPARAMOS. A esta gente no la ve nadie: su oposición no está
// en ese conjunto justamente porque no tiene temario.

/**
 * ¿El `target_oposicion` es una personalizada en el formato VIEJO (UUID pelado)?
 *
 * ⚠️ ESTA GUARDA ES LA MITAD DEL DETECTOR, y solo cubre el formato viejo. El onboarding antiguo
 * guardaba aquí el **UUID pelado** de `custom_oposiciones`, mientras que los temas de esa
 * oposición viven bajo `position_type = 'personalizada_<uuid sin guiones>'`. O sea que el join
 * por `position_type` NUNCA casa y todas saldrían con 0 temas: contarlas es fabricar hallazgos.
 * En una medición anterior se hizo y hubo que rectificar la cifra publicada.
 *
 * ⚠️ NO cubre —ni debe cubrir— el formato NUEVO `personalizada_<uuid>` de T-327: ver
 * `esPersonalizadaConTemarioPropio` abajo.
 */
function esOposicionPersonalizada(target) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(target ?? ''))
}

/**
 * ¿Es una personalizada en el formato NUEVO (`personalizada_<uuid sin guiones>`)? [T-508]
 *
 * Estas SÍ se juzgan por los hechos, y la diferencia con las de arriba no es de estilo: aquí el
 * `target_oposicion` **es** el `position_type`, así que el join cuenta sus temas de verdad. Si
 * salen 0 temas es que de verdad tiene 0 temas.
 *
 * ── POR QUÉ ESTO ESTABA MAL Y COSTÓ UN BUG ──────────────────────────────────────────────────
 *
 * El detector ya las listaba —por accidente, porque el regex de arriba no las reconoce— mientras
 * su propio pie de página anunciaba que las personalizadas «están EXCLUIDAS: su temario vive en
 * `custom_oposiciones` y NO están rotas». Una salida que se desmiente a sí misma no es una
 * señal: quien la lee o descarta las filas buenas por creerse el aviso, o «arregla» el regex
 * para que también las excluya y apaga la detección para siempre.
 *
 * Y no era teórico: el 03/08/2026 la lista ya traía a una usuaria PREMIUM
 * (`personalizada_cddb52fd…`, 1 tema activo: ninguno) que ese mismo día escribió reportando el
 * 404 que eso produce. La señal estaba; el texto de al lado mandaba ignorarla.
 */
function esPersonalizadaConTemarioPropio(target) {
  return /^personalizada_[0-9a-f]{32}$/i.test(String(target ?? ''))
}

/** El mismo filtro, en SQL, para poder excluirlas sin traerse la tabla entera. */
const SQL_EXCLUIR_PERSONALIZADAS = `target_oposicion !~ '^[0-9a-f]{8}-[0-9a-f]{4}-'`

/**
 * Clasifica una oposición elegida por usuarios.
 *
 * Devuelve `null` si no hay hallazgo (tiene temario, o nadie la ha elegido).
 *
 * La banda la decide **quién paga**, no el volumen:
 *   · `error` → hay al menos un PREMIUM. Está pagando por algo que no existe; es dinero cobrado
 *     y un usuario que no puede estudiar. Se resuelve uno a uno, con nombre y apellidos.
 *   · `warn`  → solo usuarios free. Duele igual pero no hay cobro de por medio, y la salida
 *     (construir el temario) es la misma que para cualquier oposición con demanda.
 *
 * El volumen NO sube la banda a propósito: 58 personas en `enfermero` señalan demanda —que es
 * información útil para decidir qué construir— pero no un incumplimiento. Mezclar las dos cosas
 * haría que la lista se ordenara por popularidad y los premium quedaran enterrados.
 */
function clasificarEleccion({ slug, usuarios = 0, premium = 0, temasActivos = 0 } = {}) {
  if (!slug || esOposicionPersonalizada(slug)) return null
  if (temasActivos > 0) return null
  if (usuarios <= 0) return null
  // El `tipo` viaja con el hallazgo porque la REPARACIÓN es distinta y confundirlas hace perder
  // el tiempo: una del catálogo se arregla construyendo temario (decisión de producto, semanas);
  // una personalizada vacía se arregla en el editor del propio usuario, o avisándole. [T-508]
  const tipo = esPersonalizadaConTemarioPropio(slug) ? 'personalizada' : 'catalogo'
  return {
    slug,
    usuarios,
    premium,
    tipo,
    severity: premium > 0 ? 'error' : 'warn',
    kind: 'oposicion_elegida_sin_temario',
  }
}

/**
 * Ordena los hallazgos por lo que hay que atender primero: premium, y a igualdad, volumen.
 *
 * No es el mismo orden que «qué construir»: para eso manda el volumen. Es el orden de
 * REPARACIÓN, y ahí un solo premium pesa más que cincuenta free.
 */
function ordenarPorUrgencia(hallazgos) {
  return [...(hallazgos || [])].sort(
    (a, b) => (b.premium - a.premium) || (b.usuarios - a.usuarios) || a.slug.localeCompare(b.slug),
  )
}

/** Resumen para el veredicto del runner. */
function resumir(hallazgos) {
  const h = hallazgos || []
  return {
    oposiciones: h.length,
    usuarios: h.reduce((a, x) => a + x.usuarios, 0),
    premium: h.reduce((a, x) => a + x.premium, 0),
    conPremium: h.filter((x) => x.premium > 0).length,
  }
}

module.exports = {
  esOposicionPersonalizada,
  esPersonalizadaConTemarioPropio,
  SQL_EXCLUIR_PERSONALIZADAS,
  clasificarEleccion,
  ordenarPorUrgencia,
  resumir,
}
