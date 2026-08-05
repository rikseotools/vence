/**
 * Guardarraíl: la tarjeta del vale se pinta en UN solo sitio (`VoucherCard`).
 *
 * POR QUÉ (27/07/2026). Había dos implementaciones de la misma tarjeta —`MisVales` (lo que ve la
 * embajadora en /embajadores) y `EmbajadorPanelView` (la vista de admin «ver como el usuario»)— y
 * habían divergido: una ocultaba PIN/serial tras «Revelar» y enseñaba el enlace de la tarjeta
 * original, la otra no. El runbook describe la vista de admin como *el panel del embajador tal cual
 * lo ve él*, y con dos componentes distintos eso era falso.
 *
 * Se destapó al añadir el enlace de canje: se puso en una vista y desde la otra seguía sin verse
 * dónde canjear el vale. Este test existe para que no vuelva a pasar en silencio.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

const VISTAS = [
  'components/embajadores/MisVales.tsx',
  'components/embajadores/EmbajadorPanelView.tsx',
]

describe('VoucherCard — una sola implementación de la tarjeta del vale', () => {
  it.each(VISTAS)('%s usa <VoucherCard> y no reimplementa la tarjeta', (rel) => {
    const s = src(rel)
    expect(s).toMatch(/import VoucherCard/)
    expect(s).toMatch(/<VoucherCard\b/)
    // Señales de haber vuelto a pintar la tarjeta a mano: los campos del vale con CopyCode.
    expect(s).not.toMatch(/<CopyCode\s+label="Código"/)
    expect(s).not.toMatch(/<CopyCode\s+label="PIN"/)
    expect(s).not.toMatch(/<CopyCode\s+label="Serial"/)
  })

  it.each(VISTAS)('%s no duplica el enlace de canje (lo pone la tarjeta)', (rel) => {
    expect(src(rel)).not.toContain('amazon.es/gc/redeem')
  })

  it('la tarjeta ofrece SIEMPRE dónde canjear, no solo cuando el vale trae extras', () => {
    const card = src('components/embajadores/VoucherCard.tsx')
    // El bloque de canje vive FUERA del condicional de pin/serial/fallbackLink: si alguien lo mete
    // dentro, los vales que solo traen código (3 de los 5 primeros) se quedan otra vez sin destino.
    const iCondFin = card.indexOf('solo con el código')
    const iDestino = card.indexOf('brand.redeemHint')
    expect(iDestino).toBeGreaterThan(iCondFin)
    // La pista del proveedor se pinta SIEMPRE (no cuelga de que haya enlace).
    expect(card).toMatch(/\{brand\.redeemHint\}/)
  })

  it('la MARCA no está escrita a mano en la tarjeta (T-591)', () => {
    const card = src('components/embajadores/VoucherCard.tsx')
    // Hasta el 05/08/2026 el JSX ponía «{v.amount} € · Amazon.es» y el enlace de Amazon a pelo, así
    // que un vale de Nike se servía con la marca y el destino de otra tienda. La marca y el enlace
    // salen ahora del vale; si alguien vuelve a clavarlos aquí, esto se pone rojo.
    expect(card).toMatch(/\{brand\.label\}/)
    expect(card).toMatch(/href=\{brand\.redeemUrl\}/)
    // Ni el título ni el enlace del JSX pueden nombrar una tienda concreta.
    const jsx = card.slice(card.indexOf('export default function'))
    expect(jsx).not.toMatch(/·\s*Amazon\.es/)
    expect(jsx).not.toContain('amazon.es/gc/redeem')
    expect(jsx).not.toMatch(/Canjear en Amazon/)
  })

  it('los tres formatos de Bitrefill están contemplados en la tarjeta', () => {
    const card = src('components/embajadores/VoucherCard.tsx')
    expect(card).toMatch(/v\.pin/)          // lote con pin+serial
    expect(card).toMatch(/v\.fallbackLink/) // lote con enlace de revelación
    expect(card).toMatch(/solo con el código/) // lote que solo trae el código
  })
})
