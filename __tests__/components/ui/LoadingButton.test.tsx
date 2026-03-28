// __tests__/components/ui/LoadingButton.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoadingButton from '@/components/ui/LoadingButton'

describe('LoadingButton', () => {
  it('renderiza el texto del children', () => {
    render(<LoadingButton onClick={() => {}}>Guardar</LoadingButton>)
    expect(screen.getByText('Guardar')).toBeInTheDocument()
  })

  it('muestra spinner durante onClick async', async () => {
    let resolve: () => void
    const promise = new Promise<void>(r => { resolve = r })
    const onClick = () => promise

    render(<LoadingButton onClick={onClick} loadingText="Guardando...">Guardar</LoadingButton>)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Guardando...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()

    resolve!()
    await waitFor(() => {
      expect(screen.getByText('Guardar')).toBeInTheDocument()
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })

  it('no ejecuta onClick si está disabled', () => {
    const onClick = jest.fn()
    render(<LoadingButton onClick={onClick} disabled>Guardar</LoadingButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('no permite doble clic durante loading', async () => {
    let callCount = 0
    const onClick = () => new Promise<void>(r => { callCount++; setTimeout(r, 100) })

    render(<LoadingButton onClick={onClick}>Enviar</LoadingButton>)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(callCount).toBe(1)
    })
  })

  it('se recupera de errores en onClick', async () => {
    const onClick = () => Promise.reject(new Error('test error'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(<LoadingButton onClick={onClick}>Acción</LoadingButton>)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    consoleSpy.mockRestore()
  })

  it('pasa className y props adicionales', () => {
    render(
      <LoadingButton onClick={() => {}} className="bg-blue-600 text-white" data-testid="custom">
        Test
      </LoadingButton>
    )
    const btn = screen.getByTestId('custom')
    expect(btn).toHaveClass('bg-blue-600', 'text-white')
  })
})
