// El texto de un mensaje de soporte nunca debe enseñar la URL interna de un adjunto.
//
// Caso real que lo motivó (30/07/2026): en la conversación de una embajadora aparecía
// `https://vence-uploads.s3.eu-west-2.amazonaws.com/feedback-images/…png` en mitad del hilo.
// Era la captura que ella misma había adjuntado, pintada como texto plano.
//
// El segundo test es el importante: con la bandera `g` y `.test()`, el regex conserva
// `lastIndex` entre llamadas y alterna true/false sobre los mismos datos — una imagen se veía
// y la siguiente salía como URL. Solo se cae con DOS adjuntos seguidos.
import { partirMensaje, tieneUrlVisible } from '@/lib/referrals/mensajeAdjuntos'

const S3 = 'https://vence-uploads.s3.eu-west-2.amazonaws.com/feedback-images/user-feedback-images/1785249203204-lrcp3srxlj.png'

describe('partirMensaje', () => {
  it('saca el adjunto del texto', () => {
    const partes = partirMensaje(`Mira lo que sale ${S3} en el historial`)
    expect(partes.filter((p) => p.tipo === 'imagen')).toHaveLength(1)
    expect(tieneUrlVisible(partes)).toBe(false)
  })

  it('DOS adjuntos seguidos: los dos son imagen (el fallo del lastIndex)', () => {
    const otra = S3.replace('.png', '.jpg')
    const partes = partirMensaje(`Uno ${S3} y otro ${otra} gracias`)
    expect(partes.filter((p) => p.tipo === 'imagen')).toHaveLength(2)
    expect(tieneUrlVisible(partes)).toBe(false)
  })

  it('llamarlo varias veces no cambia el resultado (sin estado entre llamadas)', () => {
    const uno = partirMensaje(S3)
    const dos = partirMensaje(S3)
    const tres = partirMensaje(S3)
    expect([uno, dos, tres].map((p) => p[0].tipo)).toEqual(['imagen', 'imagen', 'imagen'])
  })

  it('un mensaje normal se queda como está', () => {
    const partes = partirMensaje('Hola, creo que hay un error en el historial')
    expect(partes).toEqual([{ tipo: 'texto', valor: 'Hola, creo que hay un error en el historial' }])
  })

  it('un enlace que NO es imagen se deja como texto (no lo tapamos)', () => {
    // Si alguien comparte un enlace del BOE en su mensaje, tiene que poder leerlo.
    const partes = partirMensaje('Lo dice aquí https://www.boe.es/buscar/act.php?id=BOE-A-1981-10325')
    expect(partes.every((p) => p.tipo === 'texto')).toBe(true)
  })

  it('vacío o nulo no rompe', () => {
    expect(partirMensaje('')).toEqual([])
    expect(partirMensaje(null)).toEqual([])
    expect(partirMensaje(undefined)).toEqual([])
  })
})
