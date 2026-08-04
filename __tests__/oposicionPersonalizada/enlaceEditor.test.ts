// __tests__/oposicionPersonalizada/enlaceEditor.test.ts — [T-523]
//
// Lo que de verdad fija esta suite es el IDA Y VUELTA: quien escribe la URL y quien la lee son
// dos ficheros distintos, y el modo de fallo es que uno cambie el nombre del parámetro. El test
// de round-trip se pone rojo en cuanto se separan.

import { enlaceEditor, idAEditarDesdeUrl, PARAM_EDITAR } from '@/lib/oposicionPersonalizada/enlaceEditor'

const ID = 'dd5c1b2b80d94b36a8be653ad3c4b685'
const ID_CON_GUIONES = 'dd5c1b2b-80d9-4b36-a8be-653ad3c4b685'

describe('enlaceEditor', () => {
  it('lleva el id cuando lo hay', () => {
    expect(enlaceEditor(ID)).toBe(`/oposicion-personalizada?${PARAM_EDITAR}=${ID}`)
  })

  it('normaliza el UUID con guiones (las dos formas circulan por la app)', () => {
    expect(enlaceEditor(ID_CON_GUIONES)).toBe(enlaceEditor(ID))
  })

  it('sin id, va al editor a secas — nunca a una URL con el parámetro vacío', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(enlaceEditor(v as string | null | undefined)).toBe('/oposicion-personalizada')
    }
  })

  it('descarta un id que no es creíble en vez de propagarlo', () => {
    for (const v of ['../../admin', 'personalizada_' + ID, 'zzzz', ID.slice(0, 8)]) {
      expect(enlaceEditor(v)).toBe('/oposicion-personalizada')
    }
  })
})

describe('idAEditarDesdeUrl', () => {
  it('lee el id con y sin la interrogación inicial', () => {
    expect(idAEditarDesdeUrl(`?${PARAM_EDITAR}=${ID}`)).toBe(ID)
    expect(idAEditarDesdeUrl(`${PARAM_EDITAR}=${ID}`)).toBe(ID)
  })

  it('devuelve null cuando no viene o no es creíble', () => {
    for (const v of [undefined, null, '', '?otra=cosa', `?${PARAM_EDITAR}=`, `?${PARAM_EDITAR}=nope`]) {
      expect(idAEditarDesdeUrl(v as string | null | undefined)).toBeNull()
    }
  })

  it('convive con otros parámetros', () => {
    expect(idAEditarDesdeUrl(`?utm_source=email&${PARAM_EDITAR}=${ID}&x=1`)).toBe(ID)
  })

  it('IDA Y VUELTA: lo que escribe el aviso es exactamente lo que lee el editor', () => {
    const url = enlaceEditor(ID_CON_GUIONES)
    const search = url.slice(url.indexOf('?'))
    expect(idAEditarDesdeUrl(search)).toBe(ID)
  })
})
