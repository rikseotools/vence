/**
 * @jest-environment jsdom
 */
// Banner de instalación de la PWA — capa de INTEGRACIÓN con el navegador.
//
// Las reglas ("¿a quién se le enseña?") están probadas aparte y sin DOM en
// __tests__/pwa/installBanner.test.ts. Aquí se prueba lo que aquellas no pueden: que las
// señales del navegador se lean bien (`beforeinstallprompt`, `display-mode: standalone`,
// `appinstalled`), que los botones hagan lo que dicen y que **el embudo se mida**.
//
// Esa última parte importa tanto como el banner: si se enseña pero no se mide, dentro de un
// mes no sabremos si funciona, que es exactamente lo que pasó con el banner anterior (su
// medición murió con `pwaTracker` y el panel lleva desde mayo enseñando ceros que parecen
// datos).

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockEmitidos: any[] = []
jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: (e: any) => mockEmitidos.push(e),
}))

const mockAlmacen = new Map<string, string>()
jest.mock('@/lib/storage/safeLocalStorage', () => ({
  safeGet: (k: string) => mockAlmacen.get(k) ?? null,
  safeSet: (k: string, v: string) => { mockAlmacen.set(k, v); return true },
  safeRemove: (k: string) => { mockAlmacen.delete(k); return true },
}))

const emitidos = mockEmitidos
const almacen = mockAlmacen

import PwaInstallBanner from '@/components/PwaInstallBanner'
import { CLAVE_SILENCIO } from '@/lib/pwa/installBanner'

const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/126 Mobile'
const UA_ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126'

function configurarNavegador({ ua, standalone = false }: { ua: string; standalone?: boolean }) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  window.matchMedia = ((q: string) => ({
    matches: q.includes('standalone') ? standalone : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as any
}

/** Simula el `beforeinstallprompt` de Chrome. Devuelve el espía de `prompt()`. */
function dispararPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = jest.fn().mockResolvedValue(undefined)
  const ev: any = new Event('beforeinstallprompt')
  ev.prompt = prompt
  ev.userChoice = Promise.resolve({ outcome })
  act(() => { window.dispatchEvent(ev) })
  return prompt
}

const acciones = () => emitidos.map((e) => e.metadata?.accion)

beforeEach(() => {
  emitidos.length = 0
  almacen.clear()
  configurarNavegador({ ua: UA_MOVIL })
})

describe('cuándo aparece', () => {
  it('en móvil, cuando el navegador ofrece instalar', async () => {
    render(<PwaInstallBanner />)
    expect(screen.queryByText('Instalar')).toBeNull() // aún no: falta el prompt
    dispararPrompt()
    expect(await screen.findByText('Instalar')).toBeTruthy()
    expect(acciones()).toContain('mostrado')
  })

  it('NO en escritorio, aunque el navegador lo ofrezca', () => {
    configurarNavegador({ ua: UA_ESCRITORIO })
    render(<PwaInstallBanner />)
    dispararPrompt()
    expect(screen.queryByText('Instalar')).toBeNull()
    // Y queda registrado POR QUÉ no se enseñó: sin el motivo, un día que el banner no salga
    // no se puede distinguir "no aplica" de "está roto".
    expect(emitidos[0].metadata).toMatchObject({ accion: 'no_mostrado', motivo: 'no_movil' })
  })

  it('NO a quien ya la tiene instalada', () => {
    configurarNavegador({ ua: UA_MOVIL, standalone: true })
    render(<PwaInstallBanner />)
    dispararPrompt()
    expect(screen.queryByText('Instalar')).toBeNull()
    expect(emitidos[0].metadata).toMatchObject({ motivo: 'ya_instalada' })
  })

  it('NO si el usuario lo descartó y el silencio sigue vigente', () => {
    almacen.set(CLAVE_SILENCIO, String(Date.now() + 86_400_000))
    render(<PwaInstallBanner />)
    dispararPrompt()
    expect(screen.queryByText('Instalar')).toBeNull()
    expect(emitidos[0].metadata).toMatchObject({ motivo: 'descartado' })
  })

  it('mide el "mostrado" UNA sola vez aunque lleguen varios eventos', () => {
    // Chrome puede disparar `beforeinstallprompt` más de una vez; si cada uno contara, el
    // numerador del embudo saldría inflado justo donde más se mira.
    render(<PwaInstallBanner />)
    dispararPrompt()
    dispararPrompt()
    expect(acciones().filter((a) => a === 'mostrado')).toHaveLength(1)
  })
})

describe('descartar', () => {
  it('la ✕ lo cierra, lo silencia y lo mide', async () => {
    render(<PwaInstallBanner />)
    dispararPrompt()
    await screen.findByText('Instalar')

    await userEvent.click(screen.getByLabelText('Cerrar'))

    expect(screen.queryByText('Instalar')).toBeNull()
    expect(almacen.get(CLAVE_SILENCIO)).toBeTruthy()
    expect(emitidos.at(-1)!.metadata.accion).toBe('descartado')
  })

  it('«Ahora no» lo silencia MÁS que la ✕', async () => {
    // Se DESMONTA entre los dos casos: sin eso quedan dos banners montados a la vez y el
    // `getByText('Instalar')` encuentra dos botones. Es artefacto del test, no del componente.
    const a = render(<PwaInstallBanner />)
    dispararPrompt()
    await screen.findByText('Instalar')
    await userEvent.click(screen.getByText('Ahora no'))
    const conAhoraNo = Number(almacen.get(CLAVE_SILENCIO))
    a.unmount()

    almacen.clear(); emitidos.length = 0
    const b = render(<PwaInstallBanner />)
    dispararPrompt()
    await screen.findByText('Instalar')
    await userEvent.click(screen.getByLabelText('Cerrar'))
    const conCerrar = Number(almacen.get(CLAVE_SILENCIO))
    b.unmount()

    expect(conAhoraNo).toBeGreaterThan(conCerrar)
  })
})

describe('instalar', () => {
  it('lanza el diálogo del sistema y mide aceptación y elección', async () => {
    render(<PwaInstallBanner />)
    const prompt = dispararPrompt('accepted')
    await screen.findByText('Instalar')

    await userEvent.click(screen.getByText('Instalar'))
    await act(async () => { await Promise.resolve() })

    expect(prompt).toHaveBeenCalledTimes(1)
    expect(acciones()).toContain('aceptado')
    // `aceptado` (pulsó nuestro botón) y `eleccion_sistema` (qué dijo en el diálogo de
    // Android) son cosas distintas: entre las dos está la gente que se arrepiente, y esa
    // fuga no se ve de ninguna otra forma.
    const eleccion = emitidos.find((e) => e.metadata?.accion === 'eleccion_sistema')
    expect(eleccion?.metadata?.outcome).toBe('accepted')
  })

  it('registra cuando el usuario RECHAZA en el diálogo del sistema', async () => {
    render(<PwaInstallBanner />)
    dispararPrompt('dismissed')
    await screen.findByText('Instalar')
    await userEvent.click(screen.getByText('Instalar'))
    await act(async () => { await Promise.resolve() })

    const eleccion = emitidos.find((e) => e.metadata?.accion === 'eleccion_sistema')
    expect(eleccion?.metadata?.outcome).toBe('dismissed')
  })

  it('el evento `appinstalled` cierra el banner y confirma la instalación', async () => {
    render(<PwaInstallBanner />)
    dispararPrompt()
    await screen.findByText('Instalar')

    act(() => { window.dispatchEvent(new Event('appinstalled')) })

    expect(screen.queryByText('Instalar')).toBeNull()
    expect(acciones()).toContain('instalado')
  })
})

describe('el fallo es VISIBLE para el sistema de salud', () => {
  // El panel /admin/salud-sistema cuenta `severity IN ('error','critical')`. Si la
  // instalación se rompiera y lo emitiéramos como `info` —como estaba al principio—
  // quedaría registrado pero no lo vería nadie, que es el fallo que el manual de
  // observabilidad nombra por su nombre.
  it('un fallo del diálogo de instalación se emite como `error`, no como `info`', async () => {
    render(<PwaInstallBanner />)
    const prompt = jest.fn().mockRejectedValue(new Error('prompt no disponible'))
    const ev: any = new Event('beforeinstallprompt')
    ev.prompt = prompt
    ev.userChoice = Promise.resolve({ outcome: 'accepted' })
    act(() => { window.dispatchEvent(ev) })
    await screen.findByText('Instalar')

    await userEvent.click(screen.getByText('Instalar'))
    await act(async () => { await Promise.resolve() })

    const fallo = emitidos.find((e) => e.metadata?.accion === 'error_prompt')
    expect(fallo).toBeTruthy()
    expect(fallo.severity).toBe('error')
    expect(fallo.metadata.error).toContain('prompt no disponible')
  })

  it('los pasos NORMALES del embudo NO se emiten como error (no ensucian el panel)', async () => {
    render(<PwaInstallBanner />)
    dispararPrompt()
    await screen.findByText('Instalar')
    await userEvent.click(screen.getByLabelText('Cerrar'))

    // Ver el banner y descartarlo es comportamiento esperado: contarlo como error dispararía
    // alarmas por gente usando la app con normalidad.
    for (const e of emitidos) expect(e.severity).toBe('info')
  })
})

// La rama `prompt_perdido` (pulsa «Instalar» y el prompt guardado ya no vale) es DEFENSIVA:
// depende de que Chrome invalide el prompt por su cuenta y no hay forma honesta de provocarla
// desde jsdom sin retorcer el componente. No se finge cobertura con un test que no prueba
// nada. Lo que SÍ se fija es lo que importa: que si ocurre, sea visible para el panel de salud.
describe('contrato de severidad', () => {
  it('las acciones consideradas FALLO incluyen el clic sin efecto', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'components/PwaInstallBanner.tsx'), 'utf8')
    const linea = src.match(/const ACCIONES_DE_FALLO = new Set\(\[([^\]]*)\]\)/)?.[1] ?? ''
    expect(linea).toContain('error_prompt')
    expect(linea).toContain('prompt_perdido')
    // Y que el emisor las mapee a 'error', que es lo que mira /admin/salud-sistema.
    expect(src).toContain("ACCIONES_DE_FALLO.has(accion) ? 'error' : 'info'")
  })
})
