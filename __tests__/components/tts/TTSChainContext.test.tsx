// __tests__/components/tts/TTSChainContext.test.tsx
// Tests del provider/contexto que coordina la cascada entre <ArticleTTS>
// instancias dentro de un mismo tema.

/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import {
  TTSChainProvider,
  useTTSChain,
  ChainModeToggle,
} from '@/components/tts/TTSChainContext'

// Helper component que registra una entry y expone hooks de testing
function TestEntry({
  id,
  startPlay,
  expose,
}: {
  id: string
  startPlay: () => void
  expose?: (api: ReturnType<typeof useTTSChain>) => void
}) {
  const chain = useTTSChain()
  React.useEffect(() => {
    if (!chain) return
    return chain.register(id, startPlay)
  }, [chain, id, startPlay])
  React.useEffect(() => {
    expose?.(chain)
  }, [chain, expose])
  return <div data-testid={`entry-${id}`}>{id}</div>
}

describe('TTSChainProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('register/unregister funciona y mantiene registeredCount', async () => {
    let chainApi: ReturnType<typeof useTTSChain> = null
    const { rerender, unmount } = render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={() => {}} />
      </TTSChainProvider>
    )

    await waitFor(() => {
      expect(chainApi?.isSingletonTopic).toBe(false)
    })

    // Quitar B → solo queda A → singleton
    rerender(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
      </TTSChainProvider>
    )
    await waitFor(() => {
      expect(chainApi?.isSingletonTopic).toBe(true)
    })

    unmount()
  })

  it('firstId es el id con menor domOrder (primer registrado)', async () => {
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={() => {}} />
        <TestEntry id="C" startPlay={() => {}} />
      </TTSChainProvider>
    )
    await waitFor(() => {
      expect(chainApi?.firstId).toBe('A')
    })
  })

  it('al desmontarse el firstId, recalcula al siguiente disponible', async () => {
    let chainApi: ReturnType<typeof useTTSChain> = null
    const { rerender } = render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={() => {}} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.firstId).toBe('A'))

    // Quitamos A → B debería ser el nuevo first
    rerender(
      <TTSChainProvider>
        <TestEntry id="B" startPlay={() => {}} expose={(c) => { chainApi = c }} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.firstId).toBe('B'))
  })

  it('notifyEnded en modo "topic" llama a startPlay del siguiente', async () => {
    const playFn = jest.fn()
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={playFn} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.firstId).toBe('A'))

    act(() => { chainApi?.notifyEnded('A') })
    expect(playFn).toHaveBeenCalledTimes(1)
  })

  it('notifyEnded en modo "single" NO llama a startPlay del siguiente', async () => {
    const playFn = jest.fn()
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={playFn} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.firstId).toBe('A'))

    act(() => { chainApi?.setMode('single') })
    act(() => { chainApi?.notifyEnded('A') })
    expect(playFn).not.toHaveBeenCalled()
  })

  it('notifyEnded en la última entry no llama a nadie', async () => {
    const playFn = jest.fn()
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={playFn} expose={(c) => { chainApi = c }} />
        <TestEntry id="B" startPlay={playFn} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.firstId).toBe('A'))

    // Notificar fin de B (última) → no llama a nadie
    act(() => { chainApi?.notifyEnded('B') })
    expect(playFn).not.toHaveBeenCalled()
  })

  it('setMode persiste en localStorage', async () => {
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi).not.toBeNull())

    act(() => { chainApi?.setMode('single') })
    expect(localStorage.getItem('vence_tts_mode')).toBe('single')

    act(() => { chainApi?.setMode('topic') })
    expect(localStorage.getItem('vence_tts_mode')).toBe('topic')
  })

  it('hidrata mode desde localStorage en mount', async () => {
    localStorage.setItem('vence_tts_mode', 'single')
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.mode).toBe('single'))
  })

  it('valor inválido en localStorage no rompe (default "topic")', async () => {
    localStorage.setItem('vence_tts_mode', 'garbage')
    let chainApi: ReturnType<typeof useTTSChain> = null
    render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} expose={(c) => { chainApi = c }} />
      </TTSChainProvider>
    )
    await waitFor(() => expect(chainApi?.mode).toBe('topic'))
  })
})

describe('ChainModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('NO se renderiza si solo hay 1 entry (singleton)', async () => {
    const { container } = render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} />
        <ChainModeToggle />
      </TTSChainProvider>
    )
    // El toggle debe estar oculto (isSingletonTopic=true)
    await waitFor(() => {
      expect(container.querySelector('[role="group"]')).toBeNull()
    })
  })

  it('SE renderiza si hay 2+ entries', async () => {
    const { container } = render(
      <TTSChainProvider>
        <TestEntry id="A" startPlay={() => {}} />
        <TestEntry id="B" startPlay={() => {}} />
        <ChainModeToggle />
      </TTSChainProvider>
    )
    await waitFor(() => {
      expect(container.querySelector('[role="group"]')).not.toBeNull()
    })
  })
})
