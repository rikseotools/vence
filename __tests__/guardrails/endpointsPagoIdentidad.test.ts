// GUARDARRAÍL: en los endpoints de pago, la identidad sale del TOKEN y nunca del cliente.
//
// ## De dónde sale (30/07/2026 — T-340)
//
// `/api/stripe/{cancel,reactivate,subscription,create-checkout,cancel/feedback}` leían el
// `userId` del **cuerpo o de la query**, sin verificar ningún token. Con el UUID de otra
// persona —que viaja en respuestas de la propia app— se podía:
//
//   · cancelarle la suscripción;
//   · **reactivársela**, es decir, volver a ponerle un cobro;
//   · leer sus datos de facturación;
//   · abrirle el PORTAL de Stripe (facturas, tarjeta);
//   · crear un checkout a su nombre, saltándose la comprobación de precio personalizado,
//     que se hacía «contra el usuario que dijera el cliente».
//
// Se descubrió por una vía indirecta: durante una suplantación de **solo lectura**, un clic
// en «Reactivar suscripción» se ejecutó de verdad sobre la cuenta de una usuaria. El candado
// de la suplantación vive en `verifyAuth` —«el paso por el que pasan TODAS las APIs»— y estos
// endpoints no pasaban por ahí. La suplantación fue el síntoma; el agujero de autorización
// era el fondo, y llevaba abierto desde que se escribieron.
//
// Regla: **si un endpoint que mueve dinero acepta un `userId`, tiene que contrastarlo con el
// token.** Nunca usarlo como identidad.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(process.cwd(), 'app/api/stripe')

/**
 * Exenciones, con motivo. Cualquier ruta nueva bajo `/api/stripe` que no esté aquí tiene que
 * pasar por `requireUsuarioPropio`, o este test se pone rojo.
 */
const EXENTOS: Record<string, string> = {
  'webhook/route.ts':
    'Server-to-server: lo llama Stripe y se autentica con la FIRMA del webhook, no con una ' +
    'sesión de usuario. Exigirle un token lo rompería.',
  'checkout-sync/route.ts':
    'Ya usa verifyAuth directamente (comprobado abajo): sirve para activar el premium justo ' +
    'tras el checkout y no acepta un userId ajeno.',
}

function rutas(dir: string, prefijo = ''): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      salida.push(...rutas(ruta, `${prefijo}${entrada}/`))
    } else if (/^route\.(ts|js)$/.test(entrada)) {
      salida.push(`${prefijo}${entrada}`)
    }
  }
  return salida
}

const TODAS = rutas(RAIZ)

describe('endpoints de pago — la identidad no la pone el cliente', () => {
  it('hay rutas que auditar (si esto falla, el escaneo se ha quedado ciego)', () => {
    expect(TODAS.length).toBeGreaterThanOrEqual(6)
  })

  it.each(TODAS.filter((r) => !EXENTOS[r]))('%s comprueba la identidad contra el token', (rel) => {
    const src = readFileSync(join(RAIZ, rel), 'utf8')
    expect(src).toMatch(/requireUsuarioPropio\(/)
  })

  it.each(TODAS.filter((r) => !EXENTOS[r]))(
    '%s opera con el userId AUTENTICADO, no con el que llegó en la petición',
    (rel) => {
      const src = readFileSync(join(RAIZ, rel), 'utf8')
      // El patrón correcto es sobrescribir el id del cliente con el del token:
      //   { ...parseResult.data, userId: identidad.userId }   ó   const userId = identidad.userId
      expect(src).toMatch(/userId:\s*identidad\.userId|const\s+userId\s*=\s*identidad\.userId/)
    },
  )

  it('checkout-sync sigue verificando de su manera (la exención no es un agujero)', () => {
    const src = readFileSync(join(RAIZ, 'checkout-sync/route.ts'), 'utf8')
    expect(src).toMatch(/verifyAuth\(/)
  })

  it('el webhook sigue validando la FIRMA de Stripe (su exención tampoco lo es)', () => {
    const src = readFileSync(join(RAIZ, 'webhook/route.ts'), 'utf8')
    expect(src).toMatch(/constructEvent|verifyWebhook|signature/i)
  })

  it.each(TODAS.filter((r) => !EXENTOS[r]))(
    '%s DECLARA por escrito qué hacer si el cliente afirma otro id',
    (rel) => {
      // Añadido el 31/07/2026. El defecto del helper es `cortar`, así que un endpoint que no
      // declare nada es seguro — pero no es EXPLÍCITO, y esa es justo la decisión que costó
      // 17 intentos de compra bloqueados: nadie había elegido cortar en el checkout, se
      // heredó. Aquí se obliga a elegir y a que la elección se lea en el propio fichero.
      const src = readFileSync(join(RAIZ, rel), 'utf8')
      expect(src).toMatch(/alDiscrepar:\s*'(cortar|seguir-con-el-token)'/)
    },
  )

  it('las acciones DESTRUCTIVAS cortan: equivocarse de cuenta ahí no se deshace solo', () => {
    // Cancelar, reactivar (volver a cobrar) y escribir en el historial de una persona.
    for (const rel of ['cancel/route.ts', 'cancel/feedback/route.ts', 'reactivate/route.ts']) {
      expect(readFileSync(join(RAIZ, rel), 'utf8')).toMatch(/alDiscrepar:\s*'cortar'/)
    }
  })

  it('el checkout NO corta: el peor caso es cobrarse a sí mismo lo que iba a pagar', () => {
    const src = readFileSync(join(RAIZ, 'create-checkout/route.js'), 'utf8')
    expect(src).toMatch(/alDiscrepar:\s*'seguir-con-el-token'/)
    // Y aun así la identidad tiene que salir del token — seguir no es confiar.
    expect(src).toMatch(/const\s+userId\s*=\s*identidad\.userId/)
  })

  it('toda exención está justificada por escrito', () => {
    for (const [ruta, motivo] of Object.entries(EXENTOS)) {
      expect(TODAS).toContain(ruta) // no dejar exenciones de ficheros que ya no existen
      expect(motivo.length).toBeGreaterThan(60)
    }
  })
})

describe('el helper compartido no se puede ablandar sin querer', () => {
  const helper = readFileSync(join(process.cwd(), 'lib/api/shared/auth.ts'), 'utf8')
  const cuerpo = helper.slice(helper.indexOf('export async function requireUsuarioPropio'))

  it('un id distinto al del token NUNCA pasa en silencio (se corte o no, se registra)', () => {
    expect(cuerpo).toMatch(/status:\s*403/)
    expect(cuerpo).toMatch(/auth_identidad_ajena_rechazada/)
    // La señal se emite ANTES de decidir si se corta: dejar pasar no puede dejar de verse.
    const iSenal = cuerpo.indexOf('auth_identidad_ajena_rechazada')
    const iCorte = cuerpo.indexOf('if (bloqueado)')
    expect(iSenal).toBeGreaterThan(-1)
    expect(iCorte).toBeGreaterThan(iSenal)
  })

  it('el defecto es CORTAR: olvidarse de declarar la política falla del lado seguro', () => {
    expect(cuerpo).toMatch(/opciones\.alDiscrepar\s*\?\?\s*'cortar'/)
  })

  it('al dejar pasar se sigue con el id del TOKEN, nunca con el afirmado', () => {
    // Sin esto, «seguir-con-el-token» sería un nombre bonito para confiar en el cliente.
    expect(cuerpo).not.toMatch(/userId:\s*idQueAfirmaElCliente/)
  })

  it('propaga el status real de verifyAuth (401 sin sesión, 403 suplantando)', () => {
    // Colapsarlo todo a 401 haría indistinguible «no estás autenticado» de «no puedes».
    expect(cuerpo).toMatch(/status:\s*auth\.status/)
  })

  it('la identidad devuelta es la del token', () => {
    expect(cuerpo).toMatch(/userId:\s*auth\.userId/)
  })
})
