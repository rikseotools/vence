/**
 * @jest-environment node
 */
// Lo que sale HACIA UNA PERSONA lo aprueba una persona. (T-486)
//
// ── LA REGLA, EN PALABRAS DE MANUEL ─────────────────────────────────────────────────────────
// «No puedo permitir que los trabajadores envíen correos sin mi supervisión. Siempre tengo que
// aprobar lo que se envía, porque ahí se detectan fallos y los usuarios necesitan que haya
// personas detrás, no la IA.»
//
// ── QUÉ PROTEGE ESTE FICHERO Y QUÉ NO ───────────────────────────────────────────────────────
// Lo que HOY impide de verdad que un trabajador mande un correo es que **no tiene con qué**: sin
// `.env.local`, sin credenciales de AWS (así que no puede sacar `AUTH_SECRET` de SSM), sin clave
// del proveedor de correo, y su rol de lectura ni siquiera puede ver la dirección de nadie.
// Medido el 05/08 en el VPS: cero variables sensibles en su entorno.
//
// Pero eso es un accidente del aprovisionamiento: el día que un trabajador necesite una credencial
// para otra cosa, la contención desaparece sin que nadie lo decida. Por eso la regla se declara en
// UN sitio y se hace cumplir en el punto de envío. Este guardarraíl vigila que **ningún script que
// envía se quede sin esa puerta**, que es como se pierden las protecciones: no quitándolas, sino
// añadiendo un cuarto script que no la tiene.
import { readFileSync } from 'fs'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const APR = require('@/lib/sessions/aprobacion.cjs')

/** Todo lo que entrega algo a una persona. Añadir uno nuevo = añadirlo aquí y ponerle la puerta. */
const SCRIPTS_QUE_ENVIAN = [
  ['scripts/impugnaciones/cerrar.ts', 'impugnacion'],
  ['scripts/impugnaciones/cerrar-feedback.ts', 'feedback'],
  ['scripts/newsletters/send-promo-cruzada.cjs', 'newsletter'],
  ['scripts/newsletters/send-promo-inscripcion.cjs', 'newsletter'],
]

describe('el juicio: quién puede enviar', () => {
  it.each(Object.keys(APR.ENVIOS_SUPERVISADOS))('una persona SÍ puede enviar «%s»', (tipo) => {
    expect(APR.puedeEnviar('persona', tipo).ok).toBe(true)
  })

  it.each(Object.keys(APR.ENVIOS_SUPERVISADOS))('un trabajador NO puede enviar «%s»', (tipo) => {
    const v = APR.puedeEnviar('trabajador', tipo)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/una persona/)
  })

  // El rol lo declara quien ARRANCA la sesión. Su ausencia dentro de algo automatizado no es «hay
  // una persona delante»: es una sesión que nadie declaró. Fail-closed, como todo lo que decide
  // un autónomo ([T-539]).
  it.each([null, undefined, '', 'cualquiera'])('un rol sin declarar (%s) tampoco envía', (rol) => {
    expect(APR.puedeEnviar(rol as any, 'impugnacion').ok).toBe(false)
  })

  // Un tipo que nadie declaró no puede colarse por defecto: se rechaza y se dice dónde declararlo.
  it('un tipo de envío desconocido se rechaza en vez de dejarse pasar', () => {
    const v = APR.puedeEnviar('persona', 'lo_que_sea')
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/ENVIOS_SUPERVISADOS/)
  })

  // Un bloqueo sin salida se rodea (la lección de [T-375]): tiene que decir qué hacer en su lugar.
  it('el mensaje de bloqueo ofrece el camino bueno', () => {
    const m = APR.mensajeBloqueo('impugnacion')
    expect(m).toMatch(/backlog\.cjs borrador/)
    expect(m).toMatch(/--para/)
    expect(m).toMatch(/--texto/)
  })
})

describe('la puerta está PUESTA en cada script que envía', () => {
  it.each(SCRIPTS_QUE_ENVIAN)('%s llama a exigirPersona', (ruta) => {
    const src = readFileSync(join(process.cwd(), ruta as string), 'utf8')
    expect(src).toMatch(/exigirPersona\(/)
    // Y lo IMPORTA del módulo común: una copia local del criterio diverge y entonces cada script
    // decide por su cuenta quién puede enviar.
    expect(src).toMatch(/sessions\/aprobacion\.cjs/)
  })

  it.each(SCRIPTS_QUE_ENVIAN)('%s usa un tipo declarado', (ruta, tipo) => {
    const src = readFileSync(join(process.cwd(), ruta as string), 'utf8')
    expect(src).toContain(`exigirPersona('${tipo}')`)
    expect(APR.ENVIOS_SUPERVISADOS).toHaveProperty(tipo as string)
  })

  // La puerta va ANTES de trabajar: si se pone al final, el trabajador ya ha consumido el turno,
  // y si se pone tras la validación de argumentos, un fallo de argumentos la esconde.
  it.each(SCRIPTS_QUE_ENVIAN)('%s la comprueba al empezar, no al final', (ruta) => {
    const src = readFileSync(join(process.cwd(), ruta as string), 'utf8')
    const puerta = src.indexOf('exigirPersona(')
    // Nada que envíe de verdad puede estar por delante de la puerta.
    for (const envio of ['--aplicar', 'resend', 'sendEmail']) {
      const i = src.toLowerCase().indexOf(envio.toLowerCase(), 0)
      if (i >= 0 && i < puerta) {
        // Salvo que sea la documentación de cabecera, que está antes de todo el código.
        expect(src.slice(0, i)).toMatch(/^[\s\S]*\*/)
      }
    }
    expect(puerta).toBeGreaterThan(0)
  })
})

describe('el encargo se lo dice a los trabajadores', () => {
  it('la regla y el camino alternativo están en el encargo', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ENC = require('@/lib/flota/encargo.cjs')
    const texto = ENC.encargo({ trabajador: 'w1', tarea: { id: 'T-1', title: 'x' } })
    expect(texto).toMatch(/NADA SALE HACIA UNA PERSONA SIN QUE MANUEL LO APRUEBE/)
    expect(texto).toMatch(/backlog\.cjs borrador/)
  })
})
