/** @jest-environment node */
/**
 * [T-368] Guardarraíl del decodificador de plantillas oficiales (PDF sin `pdftotext`).
 *
 * Fija el bug real que rompía la transcripción (07/08/2026): para una fuente SIMPLE
 * (`/TrueType`/`/Type1`) el content stream usa SIEMPRE 1 byte por carácter, aunque su
 * `/ToUnicode` declare `<0000><FFFF>` en el `codespacerange` (habitual, no significa 2
 * bytes). Confiar en ese codespacerange partía cada carácter en dos y perdía la mitad del
 * texto — "CUERPO AUXILIAR" salía "UEO AUXIAR". Sin este test, una regresión futura volvería
 * a publicar un examen oficial mal transcrito sin que nada lo avisara.
 *
 * Corre contra el PDF REAL ya committeado (no un fixture sintético): es la única forma de
 * probar el bug de verdad, porque depende de cómo ESTE PDF concreto declaró su fuente.
 */
import { extraerPdf, parseToUnicodeCMap } from '@/scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs'
import path from 'path'

const PDF = path.join(
  process.cwd(),
  'data/examenes-oficiales/auxiliar-administrativo-canarias',
  '24-07-08 segundo ejercicio 2 supuestos practicos - OEP 2022',
  'plantilla_respuestas.pdf',
)

describe('parseToUnicodeCMap (núcleo puro)', () => {
  it('detecta 1 byte por código cuando el codespacerange declara <00>-<FF>', () => {
    const cmap = 'begincodespacerange\n<00> <FF>\nendcodespacerange\nbeginbfchar\n<01> <0043>\nendbfchar'
    const { bytesPerCode, map } = parseToUnicodeCMap(cmap)
    expect(bytesPerCode).toBe(1)
    expect(map.get('01')).toBe('C')
  })

  it('detecta 2 bytes cuando el codespacerange declara <0000>-<FFFF> (Type0/Identity-H real)', () => {
    const cmap = 'begincodespacerange\n<0000> <FFFF>\nendcodespacerange\nbeginbfchar\n<0001> <0043>\nendbfchar'
    const { bytesPerCode, map } = parseToUnicodeCMap(cmap)
    expect(bytesPerCode).toBe(2)
    expect(map.get('0001')).toBe('C')
  })

  it('decodifica bfrange (no solo bfchar)', () => {
    const cmap = 'begincodespacerange\n<00> <FF>\nendcodespacerange\nbeginbfrange\n<41> <43> <0061>\nendbfrange'
    const { map } = parseToUnicodeCMap(cmap)
    expect(map.get('41')).toBe('a')
    expect(map.get('42')).toBe('b')
    expect(map.get('43')).toBe('c')
  })
})

describe('extraerPdf — contra el PDF real (fuente simple con ToUnicode <0000><FFFF>)', () => {
  let texto: string

  beforeAll(async () => {
    texto = await extraerPdf(PDF)
  }, 30000)

  it('NO parte los caracteres en dos: el gotcha del codespacerange está arreglado', () => {
    // El bug exacto que se cazó: sin el fix esto salía "UEO AUXIAR" (perdiendo C, R, P, L...).
    expect(texto).toContain('CUERPO AUXILIAR')
    expect(texto).not.toContain('UEO AUXIAR')
  })

  it('el título del documento sale íntegro y legible', () => {
    expect(texto).toContain('SUPUESTO PRÁCTICO N.º 1')
    expect(texto).toContain('D. Santiago Montoliu')
  })

  it('marca en rojo la respuesta correcta de la pregunta 1 del supuesto 1 (verificado contra la fuente)', () => {
    // La plantilla marca "El 14 de enero de 2024" — coincide con la fecha de solicitud que
    // narra el propio enunciado del supuesto, así que es verificable sin salir del documento.
    expect(texto).toMatch(/<<[^<>]*El 14 de enero de 2024/)
  })

  it('no marca en rojo las opciones incorrectas de esa misma pregunta', () => {
    expect(texto).not.toMatch(/<<[^<>]*El 15 de enero de 2024/)
    expect(texto).not.toMatch(/<<[^<>]*El 16 de enero de 2024/)
  })
})
