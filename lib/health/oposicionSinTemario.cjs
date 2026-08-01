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
 * ¿El `target_oposicion` es una oposición PERSONALIZADA?
 *
 * ⚠️ ESTA GUARDA ES LA MITAD DEL DETECTOR. Las personalizadas guardan un **UUID** en la misma
 * columna donde las del catálogo guardan un slug, y su temario vive en otra tabla
 * (`custom_oposiciones`). **No están rotas: es una función legítima.** En una medición anterior
 * se contaron como error y hubo que rectificar la cifra publicada. Cualquier query sobre esta
 * columna tiene que excluirlas ANTES de contar.
 */
function esOposicionPersonalizada(target) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(target ?? ''))
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
  return {
    slug,
    usuarios,
    premium,
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
  SQL_EXCLUIR_PERSONALIZADAS,
  clasificarEleccion,
  ordenarPorUrgencia,
  resumir,
}
