/**
 * @jest-environment node
 *
 * NINGÚN premium puede quedar limitado ni avisado por el cupo de DISPOSITIVO.
 *
 * POR QUÉ ([T-418], 01/08/2026): al cablear el cupo por dispositivo al cliente, Manuel avisó de
 * algo que no está en ningún sitio del código — *«ojo, no bloquear a ningún premium, muchas
 * veces tienen cuentas free y premium, no sé bien por qué»*. Es un riesgo real: el aparato de
 * un cliente que paga suele tener también su cuenta gratuita, y contar a la ligera lo convierte
 * en sospechoso de multicuenta dentro de su propio ordenador.
 *
 * Son TRES puntos distintos y ninguno protege a los otros, así que se vigilan los tres:
 *   1. el conteo de cupo que se le enseña al cliente (`conteoEfectivoConDispositivo`);
 *   2. el aviso de multicuenta (`debeMostrarAviso`);
 *   3. el recuento de cuentas del aparato, que debe mirar SOLO las free.
 *
 * El punto 3 se comprueba sobre el código porque la consulta vive en SQL: `get_accounts_on_device`
 * devuelve TODAS las cuentas (premium incluidas) y por eso NO se puede usar tal cual para el
 * aviso. Si alguien la vuelve a enchufar directamente, esto se pone rojo.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { conteoEfectivoConDispositivo } from '@/lib/api/dailyLimit'
import { debeMostrarAviso } from '@/lib/multicuenta/aviso'

const ROOT = join(__dirname, '..', '..')

describe('premium nunca se limita ni se avisa por el dispositivo', () => {
  it('1. el conteo de cupo ignora el dispositivo si es premium', () => {
    // Aparato saturadísimo: da igual, el premium no tiene límite que alcanzar.
    expect(conteoEfectivoConDispositivo(0, true, 9999)).toBe(0)
  })

  it('2. el aviso de multicuenta no se le enseña a un premium', () => {
    expect(
      debeMostrarAviso({
        multiCuenta: true,
        esPremium: true,
        userId: 'u-1',
        yaAceptadoHoy: false,
        cargando: false,
      }),
    ).toBe(false)
  })

  it('3. el endpoint cuenta cuentas FREE, no todas las del aparato', () => {
    const ruta = readFileSync(
      join(ROOT, 'app', 'api', 'v2', 'daily-question', 'status', 'route.ts'),
      'utf8',
    )
    expect(ruta).toMatch(/contarCuentasFreeEnDispositivo\s*\(/)
    // `getAccountsOnDevice` incluye premium: usarla aquí devolvería el defecto.
    expect(ruta).not.toMatch(/getAccountsOnDevice\s*\(/)
  })

  it('3b. y ese recuento excluye explícitamente los planes de pago', () => {
    const dev = readFileSync(join(ROOT, 'lib', 'api', 'deviceLimit.ts'), 'utf8')
    const fn = dev.slice(dev.indexOf('export async function contarCuentasFreeEnDispositivo'))
    expect(fn).toMatch(/NOT IN \('premium'/)
    expect(fn).toMatch(/'trial'/)
    expect(fn).toMatch(/'legacy_free'/)
    expect(fn).toMatch(/'premium_semester'/)
    expect(fn).toMatch(/'admin'/)
  })

  it('4. el aviso solo se calcula para quien NO es premium en el propio endpoint', () => {
    const ruta = readFileSync(
      join(ROOT, 'app', 'api', 'v2', 'daily-question', 'status', 'route.ts'),
      'utf8',
    )
    expect(ruta).toMatch(/is_premium\s*!==\s*true/)
  })
})
