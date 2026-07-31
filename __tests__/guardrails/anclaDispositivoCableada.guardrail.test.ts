// [T-371] Guardarraíl del cableado, no de la lógica.
//
// El bug no estaba en ninguna función mal escrita: estaba en DÓNDE colgaba la creación del
// identificador. `getOrCreateDeviceId()` existía y funcionaba; lo que fallaba es que solo se
// invocaba desde el beacon de marketing y desde el chat, así que 4 de cada 10 usuarios no
// tenían ancla y eran invisibles para el antifraude.
//
// Un defecto de colocación no lo caza un test unitario: hay que afirmar la colocación. Estas
// comprobaciones son deliberadamente literales — leen los ficheros — porque lo que se protege
// es precisamente que la pieza siga montada donde tiene que estar.

import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

/**
 * El fichero sin comentarios. Hace falta porque el código nuevo CITA la guarda vieja para
 * explicar por qué se fue: sin esto, la propia documentación del arreglo haría fallar al
 * guardarraíl que lo protege.
 */
const soloCodigo = (p: string) =>
  leer(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')

describe('T-371 — el ancla de dispositivo nace al arrancar la app', () => {
  it('DeviceIdentity está montado en el layout raíz', () => {
    const layout = leer('app/layout.tsx')
    expect(layout).toMatch(/import\s*\{[^}]*DeviceIdentity[^}]*\}\s*from\s*'\.\.\/components\/tracking'/)
    expect(layout).toMatch(/<DeviceIdentity\s*\/>/)
  })

  it('se monta ANTES que la captura de atribución', () => {
    // El orden importa: la atribución LEE el identificador. Si se montara después, la primera
    // carga de cada sesión volvería a depender de que lo cree el propio beacon, que es el bug.
    const layout = leer('app/layout.tsx')
    expect(layout.indexOf('<DeviceIdentity')).toBeLessThan(layout.indexOf('<AttributionCapture'))
    expect(layout.indexOf('<DeviceIdentity')).toBeGreaterThan(-1)
  })

  it('el flujo de respuestas CREA el identificador si falta, no solo lo lee', () => {
    // Era `localStorage.getItem('vence_device_id')`: sin valor, no se mandaba la cabecera y el
    // servidor no registraba el dispositivo ni con la huella delante.
    const cola = leer('utils/answerSaveQueue.ts')
    expect(cola).toContain('getOrCreateDeviceId()')
    expect(cola).not.toContain("localStorage.getItem('vence_device_id')")
  })

  it('solo hay UNA implementación del generador (no vuelve a duplicarse)', () => {
    // Había dos copias sobre la misma clave: la del hook y otra pegada dentro de
    // AttributionCapture. Dos identidades para un mismo navegador esperando a divergir.
    const ficheros = [
      'components/tracking/AttributionCapture.tsx',
      'components/AIChatWidget.js',
      'utils/answerSaveQueue.ts',
      'components/tracking/DeviceIdentity.tsx',
    ]
    for (const f of ficheros) {
      const src = leer(f)
      expect({ f, define: /function getOrCreateDeviceId\s*\(/.test(src) }).toEqual({ f, define: false })
    }
    expect(/export function getOrCreateDeviceId/.test(leer('hooks/useDeviceTracking.ts'))).toBe(true)
  })

  it('el servidor registra con huella cuando no hay identificador de navegador', () => {
    const dl = soloCodigo('lib/api/deviceLimit.ts')
    expect(dl).toContain('resolverAnclaDispositivo')
    // La guarda vieja tumbaba la llamada entera —y con ella la huella— antes de registrar.
    expect(dl).not.toMatch(/if\s*\(\s*!userId\s*\|\|\s*!deviceId\s*\)\s*return FAIL_OPEN/)
  })

  it('el ancla derivada nunca bloquea', () => {
    // Registrar da visibilidad; cortar es otra decisión y necesita el modo de T-304.
    expect(soloCodigo('lib/api/deviceLimit.ts')).toContain('ancla.aplicaLimite ?')
  })
})
