/**
 * Ningún argumento declarado por una plantilla puede quedarse sin pintar. (T-466)
 *
 * ── EL DEFECTO QUE LO MOTIVA ────────────────────────────────────────────────────────────────
 * La plantilla `fin_suscripcion_precio_heredado` declaraba `fechaLimite` como parámetro, el
 * despacho se lo pasaba… y el HTML **no lo pintaba en ninguna parte**. Resultado: el correo salía,
 * se entregaba y se leía diciéndole a la persona *«si no lo haces, lo perderás»* **sin decir hasta
 * cuándo**, mientras un barrido le anulaba el precio en una fecha concreta. Cuatro personas lo
 * recibieron así.
 *
 * Y no saltó nada, porque el fallo es SILENCIOSO por partida doble: el parámetro no usado no da
 * error de TypeScript (llega y se ignora) y, al no pintarse, tampoco aparece un «undefined» en
 * pantalla que delate el hueco. Un argumento declarado y no usado es una promesa a medias.
 *
 * ── POR QUÉ ESTE GUARDARRAÍL Y NO MÁS CASOS EN `templateDispatch` ───────────────────────────
 * Aquel test enumera los tipos A MANO (`test.each([...])`), así que solo cubre los que alguien se
 * acordó de añadir: medido hoy, **6 de los 18** tipos declarados no los prueba nadie, y entre
 * ellos estaba justo el nuevo. Añadir un caso más habría tapado ESTE agujero dejando los otros
 * cinco. Esto recorre la lista de plantillas, así que una nueva nace cubierta.
 */
import { emailTemplates } from '@/lib/emails/templates'

/** Los nombres de los parámetros de una función, leídos de su firma. */
function argumentosDe(fn: (...a: unknown[]) => unknown): string[] {
  const src = fn.toString()
  const abre = src.indexOf('(')
  if (abre === -1) return []
  // Recorre hasta el paréntesis que cierra la lista, respetando anidamiento.
  let nivel = 0
  let cierra = -1
  for (let i = abre; i < src.length; i++) {
    if (src[i] === '(') nivel++
    else if (src[i] === ')') { nivel--; if (nivel === 0) { cierra = i; break } }
  }
  if (cierra === -1) return []
  return src.slice(abre + 1, cierra)
    .split(',')
    .map((p) => p.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./, ''))
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p))
}

/**
 * Argumentos que pueden declararse sin pintarse, con su motivo. La lista solo puede ENCOGER: si
 * crece, alguien está tapando un hueco en vez de cerrarlo.
 */
const NO_PINTAR: Record<string, string> = {
  // Va en el `href` de un enlace que solo se construye en algunas ramas del propio HTML.
  unsubscribeUrl: 'pie de baja: algunas plantillas lo omiten a propósito (categoría soporte)',
}

/**
 * DEUDA CONOCIDA, medida el 06/08/2026. **Solo puede encoger.**
 *
 * Al estrenar esto saltaron 8 plantillas, y mirarlas cambió el diagnóstico: casi todas son
 * **huecos de la FIRMA POSICIONAL COMPARTIDA**, no promesas rotas. El despacho llama a las
 * plantillas de campaña con la misma forma —`(userName, daysInactive, testUrl, unsubscribeUrl)`—
 * y cada una usa lo que necesita; por eso `daysInactive` aparece sin usar en **seis**. Eso es un
 * diseño discutible, pero NO es el defecto que este fichero vigila: nadie está prometiendo un dato
 * que no llega.
 *
 * El defecto de verdad ([T-466]) estaba en una plantilla con firma PROPIA, donde el argumento se
 * añadió a propósito para decir algo concreto —la fecha límite para recuperar el precio— y se
 * quedó sin pintar. Ese ya está arreglado y por eso `fin_suscripcion_precio_heredado` NO está aquí.
 *
 * Se declara como trinquete en vez de ponerlo a cero hoy porque limpiar la firma compartida es
 * refactorizar el despacho de correo entero: dejar el CI en rojo para todas las sesiones mientras
 * tanto es exactamente cómo se aprende a ignorar un guardarraíl.
 */
const DEUDA_CONOCIDA: Record<string, string[]> = {
  bienvenida_inmediato: ['daysInactive'],
  resumen_semanal: ['daysInactive'],
  modal_articulos_mejora: ['daysInactive'],
  mejoras_producto: ['daysInactive', 'mejoraDatos'],
  nueva_oposicion: ['_daysInactive', 'testUrl', 'datos'],
  lanzamiento_premium: ['daysInactive', 'testUrl'],
  impugnacion_respuesta: ['status'],
  recordatorio_renovacion: ['diasRestantes'],
}

describe('toda plantilla PINTA lo que declara (T-466)', () => {
  const nombres = Object.keys(emailTemplates)

  it('hay plantillas que recorrer (si no, esto no vigila nada)', () => {
    expect(nombres.length).toBeGreaterThan(5)
  })

  it.each(nombres)('«%s» usa todos los argumentos de su html()', (nombre) => {
    const tpl = emailTemplates[nombre]
    const args = argumentosDe(tpl.html)
    const src = tpl.html.toString()

    const sinUsar = args.filter((a) => {
      if (NO_PINTAR[a]) return false
      // Se busca su USO (`${a}`, `a?`, `a ?`, `a)`…), no su declaración: la firma siempre lo
      // menciona, así que un `includes(a)` a secas daría verde siempre.
      const usos = [...src.matchAll(new RegExp(`\\$\\{[^}]*\\b${a}\\b`, 'g'))].length
        + [...src.matchAll(new RegExp(`\\b${a}\\s*(?:\\?|&&|\\|\\||\\.)`, 'g'))].length
      return usos === 0
    })

    const conocida = DEUDA_CONOCIDA[nombre] ?? []
    const nuevos = sinUsar.filter((a) => !conocida.includes(a))
    // Trinquete en la otra dirección: si se arregla uno, hay que quitarlo de la deuda o deja de
    // vigilarse sin que nadie se entere.
    expect(conocida.filter((a) => !sinUsar.includes(a))).toEqual([])

    expect({
      plantilla: nombre,
      sinUsar: nuevos,
      arreglo: nuevos.length
        ? 'o lo pintas en el HTML, o quitas el parámetro. Declararlo y no usarlo no da error de ' +
          'TypeScript ni deja un «undefined» visible: el correo sale con el dato ausente y nadie ' +
          'se entera (fue el caso de fechaLimite en fin_suscripcion_precio_heredado, T-466).'
        : null,
    }).toEqual({ plantilla: nombre, sinUsar: [], arreglo: null })
  })

  it('la lista de excepciones no crece y todas siguen siendo argumentos reales', () => {
    expect(Object.keys(NO_PINTAR).length).toBeLessThanOrEqual(1)
    const todos = new Set(nombres.flatMap((n) => argumentosDe(emailTemplates[n].html)))
    for (const a of Object.keys(NO_PINTAR)) expect(todos.has(a)).toBe(true)
  })
})
