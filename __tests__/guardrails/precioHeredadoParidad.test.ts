// GUARDARRAÍL: el CLI de precios heredados y su núcleo puro no pueden divergir.
//
// El núcleo vive en TS (`lib/stripe/precioHeredado.ts`, testeado) pero el script de
// operación es .cjs y no transpila, así que replica lo mínimo. Es el mismo patrón de
// copia+paridad que `shuffle/permute` y `benignSignals`. Si alguien cambia la
// recurrencia en un sitio y no en el otro, el webhook clasificaría la suscripción en
// otro plan; si cambia el redondeo, se factura mal. Aquí se para.
import { readFileSync } from 'fs'
import { join } from 'path'
import { RECURRENCIA, lookupKeyPrecioHeredado, euroACentimos, nombreProductoHeredado } from '@/lib/stripe/precioHeredado'

const CLI = readFileSync(join(process.cwd(), 'scripts/stripe/precio-heredado.cjs'), 'utf8')

/** Ejecuta el trozo del CLI en un sandbox para comparar COMPORTAMIENTO, no texto. */
function cargarCopiaDelCli() {
  const desde = CLI.indexOf('const RECURRENCIA = {')
  const hasta = CLI.indexOf('function claveDeCuenta')
  const cuerpo = CLI.slice(desde, hasta)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(
    `${cuerpo}; return { RECURRENCIA, euroACentimos, lookupKey, nombreProducto };`,
  )() as {
    RECURRENCIA: typeof RECURRENCIA
    euroACentimos: (e: number) => number
    lookupKey: (i: string, c: number) => string
    nombreProducto: (i: string) => string
  }
}

describe('paridad núcleo TS ↔ CLI de precios heredados', () => {
  const cli = cargarCopiaDelCli()

  it('la recurrencia es idéntica (si no, el webhook daría otro plan)', () => {
    expect(cli.RECURRENCIA).toEqual(RECURRENCIA)
  })

  it('el redondeo a céntimos coincide, incluidos los casos de coma flotante', () => {
    for (const euros of [18, 20, 9.99, 0.5, 18.29, 1.1, 29, 35.5]) {
      expect(cli.euroACentimos(euros)).toBe(euroACentimos(euros))
    }
  })

  it('ambos rechazan lo que no debe facturarse', () => {
    for (const malo of [0, -5, 18.333, NaN]) {
      expect(() => cli.euroACentimos(malo)).toThrow()
      expect(() => euroACentimos(malo)).toThrow()
    }
  })

  it('la lookup_key coincide (de ella depende la idempotencia del price)', () => {
    for (const i of Object.keys(RECURRENCIA)) {
      for (const c of [1800, 2000, 999]) {
        expect(cli.lookupKey(i, c)).toBe(lookupKeyPrecioHeredado(i as keyof typeof RECURRENCIA, c))
      }
    }
  })

  it('el nombre del producto coincide (es lo que la persona ve en su recibo)', () => {
    for (const i of Object.keys(RECURRENCIA)) {
      expect(cli.nombreProducto(i)).toBe(nombreProductoHeredado(i as keyof typeof RECURRENCIA))
    }
  })

  it('el CLI usa Payment Link, no Checkout Session (una sesión caduca en 24 h)', () => {
    expect(CLI).toContain('paymentLinks.create')
    expect(CLI).not.toContain('checkout.sessions.create')
  })

  it('el enlace lleva supabase_user_id en la metadata de la SUSCRIPCIÓN', () => {
    // Sin esto el webhook no sabe a quién dar premium y el pago queda huérfano.
    expect(CLI).toMatch(/subscription_data:\s*\{\s*metadata\s*\}/)
    expect(CLI).toContain('supabase_user_id: u.id')
  })

  it('deja rastro observable de cada enlace creado', () => {
    expect(CLI).toContain('legacy_price_link_created')
  })
})
