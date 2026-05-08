/**
 * Regresión: el SELECT de /api/exam/resume DEBE incluir content_data
 * e image_url. Sin estos campos, las preguntas técnicas (Word/Excel/
 * Windows) con icono guardado en content_data.image_base64 no muestran
 * el icono al reanudar un examen — flujo originario de la dispute
 * ed59b2d2 (Nila, 08/05/2026, "Test Tema 108 - 1" en modo examen).
 *
 * No mockeamos Supabase: leemos el código fuente y verificamos el
 * contrato a nivel de string. Robusto frente a refactors locales,
 * sólo falla si alguien quita los campos del SELECT.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROUTE_PATH = path.join(
  process.cwd(),
  'app/api/exam/resume/route.ts'
)

function loadSource(): string {
  return fs.readFileSync(ROUTE_PATH, 'utf-8')
}

describe('app/api/exam/resume/route.ts — contrato del SELECT', () => {
  test('el SELECT incluye image_url (icono fuera de content_data)', () => {
    const src = loadSource()
    expect(src).toMatch(/\bimage_url\b/)
  })

  test('el SELECT incluye content_data (image_base64, instructions, etc.)', () => {
    const src = loadSource()
    expect(src).toMatch(/\bcontent_data\b/)
  })

  test('image_url y content_data están dentro del SELECT de questions', () => {
    const src = loadSource()
    // Localiza el bloque from('questions') ... .select(`...`)
    const fromIdx = src.indexOf(".from('questions')")
    expect(fromIdx).toBeGreaterThan(-1)

    const selectIdx = src.indexOf('.select(`', fromIdx)
    expect(selectIdx).toBeGreaterThan(-1)

    const closeIdx = src.indexOf('`)', selectIdx)
    expect(closeIdx).toBeGreaterThan(-1)

    const selectBlock = src.slice(selectIdx, closeIdx)
    expect(selectBlock).toContain('image_url')
    expect(selectBlock).toContain('content_data')
  })
})
