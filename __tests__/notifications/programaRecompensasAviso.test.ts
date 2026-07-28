/**
 * El aviso del Programa de Recompensas debe estar cableado en LOS DOS sitios:
 *   1. `NOTIFICATION_TYPES` (hooks/useIntelligentNotifications.ts) → cómo se PINTA en la campana.
 *   2. el switch de `generateActionUrl` (components/NotificationBell.tsx) → A DÓNDE va al pincharlo.
 *
 * Declarar solo el primero es el fallo silencioso que este test existe para cazar: el aviso se ve
 * perfecto en la campana, el usuario lo pincha, se marca como leído… y no va a ninguna parte. El
 * aviso se consume sin que nadie llegue al programa, que es justo lo contrario de para lo que se
 * manda (medido 28/07: solo 11 de 258 premium lo habían abierto nunca).
 *
 * Se comprueba sobre el TEXTO de los ficheros porque ninguna de las dos cosas se exporta: son
 * internas del hook y del componente. Un test de humo sobre la fuente es preferible a no tener nada.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const hook = readFileSync(join(raiz, 'hooks/useIntelligentNotifications.ts'), 'utf8')
const campana = readFileSync(join(raiz, 'components/NotificationBell.tsx'), 'utf8')

describe('aviso del Programa de Recompensas', () => {
  it('está declarado en NOTIFICATION_TYPES (si no, no se pinta bien en la campana)', () => {
    expect(hook).toMatch(/'programa_recompensas':\s*\{/)
  })

  it('tiene destino en generateActionUrl (si no, el usuario lo pincha y no va a ninguna parte)', () => {
    expect(campana).toMatch(/case 'programa_recompensas':/)
  })

  it('el destino es el panel del programa, no otra página', () => {
    const bloque = campana.slice(campana.indexOf("case 'programa_recompensas':"))
    const destino = bloque.slice(0, 200)
    expect(destino).toContain('/recompensas')
  })

  it('el destino lleva `src` para poder atribuir la visita al aviso', () => {
    const bloque = campana.slice(campana.indexOf("case 'programa_recompensas':"))
    expect(bloque.slice(0, 200)).toMatch(/src=aviso-mencion/)
  })

  it('apunta a la ruta NUEVA: /embajadores quedó como 301 y no debe usarse en enlaces nuevos', () => {
    const bloque = campana.slice(campana.indexOf("case 'programa_recompensas':"))
    expect(bloque.slice(0, 200)).not.toContain('/embajadores')
  })
})
