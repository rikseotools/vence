/**
 * ¿Cómo se relaciona el cupo de discapacidad con las plazas de acceso libre? — NÚCLEO PURO.
 *
 * ## Por qué existe (T-214, 28/07/2026)
 *
 * La landing decía, con la misma plantilla, dos cosas OPUESTAS:
 *
 *   · `administrativo-andalucia`  → «216 plazas de acceso libre. 19 reservadas para discapacidad.»
 *     Las 19 están **dentro** de las 216 (`plazas_discapacidad_incluidas = true`), pero la frase
 *     invita a sumar 235.
 *   · `auxiliar-administrativo-ayuntamiento-cordoba` → «43 plazas de acceso libre. 12 reservadas…»
 *     Aquí sí se suman: su BOP convoca **55 plazas en turno libre** y de ese total 9 + 3 van a
 *     reserva, así que 43 + 12 = 55 y la frase es correcta.
 *
 * El dato que las distingue —`convocatorias.plazas_discapacidad_incluidas`— **existía en la base y
 * el render no lo miraba**. Medido el 28/07 sobre las convocatorias vivas que enseñan las dos
 * cifras: 93 en total, 32 con la reserva dentro (las que se leían infladas), 23 aparte y 38 sin
 * declarar.
 *
 * ## La regla
 *
 *   dentro  → «…, de las cuales N están reservadas para discapacidad»  (no se suman)
 *   aparte  → «… y otras N reservadas para discapacidad»               (sí se suman)
 *   sin dato→ no se dice nada de la reserva
 *
 * Callar cuando no se sabe es deliberado: una cifra de plazas es lo primero que mira un opositor
 * para decidir si se presenta, y **afirmar una relación que no consta es peor que no afirmarla**.
 * El hueco no se tapa suponiendo: se rellena verificando cada convocatoria contra su boletín.
 *
 * ## Ojo: la vista `oposiciones_ssot` ya usaba esta columna, y con `null` NO calla — suma
 *
 * `plazas_total` se deriva en SQL así (literal de la vista):
 *
 *     CASE WHEN c.plazas_discapacidad_incluidas IS TRUE THEN 0
 *          ELSE COALESCE(c.plazas_discapacidad, 0) END
 *
 * o sea `IS TRUE` no suma y **todo lo demás —`false` Y `null`— suma**. Para `true`/`false` las dos
 * capas coinciden; para `null` divergen a propósito: la vista tiene que dar un número (es un total
 * y alguien lo va a pintar) y elige el supuesto conservador de que el cupo va aparte, mientras que
 * aquí se puede simplemente no afirmar nada, que es más honesto en una frase.
 *
 * La consecuencia práctica hay que tenerla presente: en las convocatorias **sin declarar**, el
 * `plazas_total` que sale en la meta description **puede estar inflado** si resulta que el cupo iba
 * dentro. No es un fallo introducido por este núcleo —es anterior— pero se arregla en el mismo
 * sitio: verificando la convocatoria contra su boletín y declarando la columna.
 */

/** Cómo se relaciona el cupo con las plazas de acceso libre. */
export type RelacionReserva = 'dentro' | 'aparte' | 'sin_declarar'

export function relacionReserva(incluidas: boolean | null | undefined): RelacionReserva {
  if (incluidas === true) return 'dentro'
  if (incluidas === false) return 'aparte'
  return 'sin_declarar'
}

/**
 * El complemento que acompaña a «N plazas de acceso libre», o `null` si no debe decirse nada.
 *
 * Devuelve la pieza semántica (conector + cifra) y NO el texto ya montado, para que cada superficie
 * lo componga con su formato: el hero envuelve la cifra en `<strong>` y la FAQ va a JSON-LD.
 *
 * @param plazasDiscapacidad cupo reservado, tal como está en la convocatoria
 * @param incluidas          `plazas_discapacidad_incluidas` (puede no estar declarado)
 */
export function complementoReserva(
  plazasDiscapacidad: number | null | undefined,
  incluidas: boolean | null | undefined,
): { conector: 'de las cuales' | 'más'; plazas: number } | null {
  if (plazasDiscapacidad == null || !Number.isFinite(plazasDiscapacidad) || plazasDiscapacidad <= 0) return null
  const rel = relacionReserva(incluidas)
  if (rel === 'sin_declarar') return null
  return { conector: rel === 'dentro' ? 'de las cuales' : 'más', plazas: plazasDiscapacidad }
}

/**
 * El complemento YA REDACTADO que sigue a «N plazas de acceso libre», con su puntuación, o `null`
 * si no debe decirse nada. Todas las superficies (hero, FAQ del JSON-LD, meta description) usan
 * esta misma frase: dos superficies de la misma página contándose cosas distintas es un defecto
 * que este proyecto ya ha pagado antes (`landingClaims`, T-142).
 *
 * La redacción no es cosmética, es lo que evita la suma equivocada:
 *   · «, de las cuales 223 están reservadas…» → el cupo sale DE las 2.300, no se añade
 *   · « y otras 12 reservadas…»               → el cupo se SUMA a las 43 (= 55 del BOP)
 *
 * @param formatear cómo pintar la cifra (se inyecta para no acoplar el núcleo al helper de formato)
 */
export function fraseReserva(
  plazasDiscapacidad: number | null | undefined,
  incluidas: boolean | null | undefined,
  formatear: (n: number) => string = String,
): string | null {
  const c = complementoReserva(plazasDiscapacidad, incluidas)
  if (!c) return null
  // Concordancia en singular: hay convocatorias con UNA plaza de cupo (`cuidador-diputacion-cordoba`
  // reserva 1 de 3) y la plantilla vieja publicaba «1 reservadas para discapacidad».
  const una = c.plazas === 1
  return c.conector === 'de las cuales'
    ? `, de las cuales ${formatear(c.plazas)} ${una ? 'está reservada' : 'están reservadas'} para discapacidad.`
    : ` y otra${una ? '' : `s ${formatear(c.plazas)}`} más reservada${una ? '' : 's'} para discapacidad.`
}

/**
 * ¿Cuántas plazas hay EN TOTAL en el turno libre? Útil para no contradecirse entre superficies.
 * Si la reserva va dentro, el total ya es `plazasLibres`; si va aparte, se suman. Sin dato
 * declarado no se inventa una suma: se devuelve `plazasLibres`, que es lo único que consta.
 */
export function totalTurnoLibre(
  plazasLibres: number | null | undefined,
  plazasDiscapacidad: number | null | undefined,
  incluidas: boolean | null | undefined,
): number | null {
  if (plazasLibres == null || !Number.isFinite(plazasLibres)) return null
  const c = complementoReserva(plazasDiscapacidad, incluidas)
  return c && c.conector === 'más' ? plazasLibres + c.plazas : plazasLibres
}
