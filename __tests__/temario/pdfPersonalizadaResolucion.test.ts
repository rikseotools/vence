/**
 * @jest-environment node
 *
 * [T-648] La pre-generación de PDFs RECHAZABA todas las oposiciones personalizadas.
 *
 * ── EL DEFECTO, MEDIDO (07/08/2026) ─────────────────────────────────────────────────────────
 * De los 220 jobs muertos en la cola de PDFs, **195 eran personalizadas**, todos con la firma
 * `hook:scope`: los encolaba el TRIGGER de `topic_scope`, que salta cuando el usuario edita su
 * temario. El trigger encolaba y el renderizador rechazaba con `oposicion_desconocida` — dos
 * componentes con criterios DISTINTOS sobre qué es una oposición, y la DLQ como sitio donde se
 * acumulaba el desacuerdo. 54 oposiciones de 7 usuarios desde el 01/08 sin recibir su PDF, y sin
 * una sola incidencia: nadie se queja de un PDF que no llega, simplemente deja de pedirlo.
 *
 * ── LO QUE ESTA PRUEBA FIJA ─────────────────────────────────────────────────────────────────
 * Las dos mitades, porque arreglar una sin la otra deja el defecto vivo:
 *   1. que una personalizada NO se rechace por no estar en el registro estático;
 *   2. que su identificador NO se «slugifique» (una personalizada no tiene slug: lo que llega ya
 *      ES su `position_type`, y cambiar los `_` por `-` lo rompe aguas abajo).
 * Y la tercera, que es la que evita el arreglo torcido: que una oposición inventada de verdad
 * SIGA rechazándose. Sin ella, «acepta personalizadas» se podría satisfacer aceptándolo todo.
 */
import { esObjetivoPersonalizado } from '@/lib/oposicion/objetivoPersonalizado'
import { OPOSICIONES } from '@/lib/api/temario/schemas'

// El identificador que llega a la pre-generación desde el trigger, tal cual está en la BD.
const PERSONALIZADA = 'personalizada_a92faefaf41b4d36b723c274f90a59f7'  // la real con 89 jobs muertos

describe('[T-648] resolución de la oposición en la pre-generación de PDFs', () => {
  it('una personalizada NO está en el registro estático, y no puede estarla', () => {
    // El registro se deriva de un fichero con 131 entradas fijas; una personalizada la crea el
    // usuario en caliente. Si algún día esto falla, es que alguien la metió ahí — y entonces el
    // registro crece con cada usuario, que es justo lo que este arreglo evita.
    expect(PERSONALIZADA in OPOSICIONES).toBe(false)
    expect(PERSONALIZADA.replace(/_/g, '-') in OPOSICIONES).toBe(false)
  })

  it('pero SÍ la reconoce el criterio que ya existe (no se inventa uno nuevo)', () => {
    // Reutiliza `esObjetivoPersonalizado`, el mismo que usa el resolutor de contenido desde
    // [T-327]. Un segundo criterio para lo mismo es como nacieron los cinco escritores de T-130.
    expect(esObjetivoPersonalizado(PERSONALIZADA)).toBe(true)
  })

  it('su identificador NO se slugifica: los guiones bajos son parte del position_type', () => {
    // `personalizada_abc` → `personalizada-abc` no existe en ninguna tabla. La conversión es
    // correcta SOLO para el catálogo, donde traduce position_type a slug.
    const comoLoTrataElCatalogo = PERSONALIZADA.replace(/_/g, '-')
    expect(comoLoTrataElCatalogo).not.toBe(PERSONALIZADA)
    expect(esObjetivoPersonalizado(comoLoTrataElCatalogo)).toBe(false)
  })

  it('una oposición INVENTADA se sigue rechazando (el arreglo no abre la puerta a todo)', () => {
    expect(esObjetivoPersonalizado('no_existe_esta_oposicion')).toBe(false)
    expect('no-existe-esta-oposicion' in OPOSICIONES).toBe(false)
  })

  it('y el UUID pelado sin prefijo tampoco cuela', () => {
    // El onboarding antiguo guardaba el UUID de `custom_oposiciones` sin prefijo, y esas filas
    // son solo una etiqueta: no tienen topics detrás. Aceptarlas mandaría a renderizar un
    // temario vacío. El criterio compartido ya lo impide; esto lo fija.
    expect(esObjetivoPersonalizado('a92faefaf41b4d36b723c274f90a59f7')).toBe(false)
  })

  it('LOS DOS sitios que slugifican tienen la excepción, no solo uno', () => {
    // ⚠️ La lección que costó una vuelta entera el 07/08: el arreglo se puso en
    // `pregenerateTopicPdf` y **seguía fallando en producción**, porque `scripts/pdf-local.ts`
    // —el punto de entrada REAL del worker— tenía su PROPIA copia del `replace(/_/g,'-')` y la
    // aplicaba ANTES de llamarla. La prueba directa a la función pasaba y la ruta real no; lo
    // delató la salida, que decía `personalizada-f228…` con guion.
    // Este test mira el CÓDIGO de los dos sitios: un test de comportamiento sobre la función no
    // puede ver una conversión que ocurre antes de entrar en ella.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs'), path = require('path')
    const raiz = path.join(__dirname, '..', '..')
    for (const f of ['lib/temario/pdf/pregenerate.ts', 'scripts/pdf-local.ts']) {
      const txt = fs.readFileSync(path.join(raiz, f), 'utf8')
      // Si el fichero convierte guiones bajos, tiene que exceptuar antes a las personalizadas.
      if (/replace\(\/_\/g/.test(txt)) {
        expect(txt).toMatch(/esObjetivoPersonalizado/)
      }
    }
  })

  it('una del catálogo sigue resolviéndose por su slug, como siempre', () => {
    const [slug] = Object.keys(OPOSICIONES)
    expect(slug).toBeTruthy()
    expect(esObjetivoPersonalizado(slug)).toBe(false)
    expect(slug in OPOSICIONES).toBe(true)
  })
})
