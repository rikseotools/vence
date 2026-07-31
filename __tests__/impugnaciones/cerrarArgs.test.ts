// Los dos cierres de la cola (impugnación y feedback) se invocan a mano, deprisa y sobre
// producción: el reparto de argumentos es justo donde un despiste manda un mensaje al hilo
// equivocado o cierra sin escribir. Por eso `parsearArgs` es puro y está testeado — el resto
// del script (red + BD) no se puede probar aquí, pero la DECISIÓN sí.

import { parsearArgs as parsearDispute } from '@/scripts/impugnaciones/cerrar'
import { parsearArgs as parsearFeedback } from '@/scripts/impugnaciones/cerrar-feedback'

describe('cerrar.ts — reparto de argumentos', () => {
  it('lee el id, el estado y el fichero del mensaje', () => {
    const a = parsearDispute(['ab3b9e43-bb6a-432f-a2de-a71e198adf1e', '--estado', 'resolved', '--mensaje', '/tmp/m.txt'])
    expect(a.disputeId).toBe('ab3b9e43-bb6a-432f-a2de-a71e198adf1e')
    expect(a.estado).toBe('resolved')
    expect(a.mensajeFichero).toBe('/tmp/m.txt')
  })

  it('NO aplica salvo que se pida: escribir en producción es un acto explícito', () => {
    expect(parsearDispute(['id', '--estado', 'rejected', '--mensaje', 'm.txt']).aplicar).toBe(false)
    expect(parsearDispute(['id', '--estado', 'rejected', '--mensaje', 'm.txt', '--aplicar']).aplicar).toBe(true)
  })

  it('recoge los dos escapes con su motivo (recompensa y puerta de barajado)', () => {
    const a = parsearDispute([
      'id', '--estado', 'resolved', '--mensaje', 'm.txt',
      '--sin-recompensa', 'mismo hallazgo que ce143c99',
      '--saltar-barajado', 'la pregunta se jubila',
    ])
    expect(a.sinRecompensa).toBe('mismo hallazgo que ce143c99')
    expect(a.saltarBarajado).toBe('la pregunta se jubila')
  })

  it('un motivo omitido no se traga el flag siguiente', () => {
    // `--sin-recompensa --aplicar` no puede leer «--aplicar» como el motivo: quedaría escrito
    // un motivo absurdo en la auditoría y encima se perdería el --aplicar.
    const a = parsearDispute(['id', '--estado', 'resolved', '--mensaje', 'm.txt', '--sin-recompensa', '--aplicar'])
    expect(a.sinRecompensa).toBeNull()
    expect(a.aplicar).toBe(true)
  })

  it('distingue la psicotécnica, que va a otra tabla', () => {
    expect(parsearDispute(['id', '--estado', 'resolved', '--mensaje', 'm.txt']).psicotecnica).toBe(false)
    expect(parsearDispute(['id', '--estado', 'resolved', '--mensaje', 'm.txt', '--psicotecnica']).psicotecnica).toBe(true)
  })
})

describe('cerrar-feedback.ts — responder vs cerrar en silencio', () => {
  it('el silencioso no lleva mensaje, y ese es todo el punto', () => {
    const a = parsearFeedback(['6df1e69a-a34b-4510-90e3-61acfa047f3e', '--silencioso'])
    expect(a.silencioso).toBe(true)
    expect(a.mensajeFichero).toBeNull()
    expect(a.estado).toBe('resolved')
  })

  it('con mensaje NO es silencioso (si no, se cerraría sin avisar a quien espera respuesta)', () => {
    const a = parsearFeedback(['id', '--mensaje', '/tmp/m.txt'])
    expect(a.silencioso).toBe(false)
    expect(a.mensajeFichero).toBe('/tmp/m.txt')
  })

  it('deja ver la combinación contradictoria para que el script la rechace', () => {
    const a = parsearFeedback(['id', '--mensaje', '/tmp/m.txt', '--silencioso'])
    expect(a.mensajeFichero && a.silencioso).toBeTruthy()
  })
})
