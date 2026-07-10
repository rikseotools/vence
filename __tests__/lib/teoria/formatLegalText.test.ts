// __tests__/lib/teoria/formatLegalText.test.ts
// Formateo de artículos legales importados de PDF (fix "apelotonado" 10/07).
import { formatLegalText } from '@/lib/teoria/formatLegalText'

describe('formatLegalText', () => {
  it('vacío / null / undefined → ""', () => {
    expect(formatLegalText('')).toBe('')
    expect(formatLegalText(null)).toBe('')
    expect(formatLegalText(undefined)).toBe('')
    expect(formatLegalText('   \n  ')).toBe('')
  })

  it('une saltos MECÁNICOS de PDF (a mitad de frase, minúscula) en la misma frase', () => {
    const raw = 'mantiene una relación\nque puede acreditar a través de la inscripción\nen un registro.'
    expect(formatLegalText(raw)).toBe(
      'mantiene una relación que puede acreditar a través de la inscripción en un registro.',
    )
  })

  it('SEPARA cada enumerador de letra a) b) c) en su propio bloque', () => {
    const raw = 'se entenderá\npor:\na) Pareja de hecho: una relación\nque acredita.\nb) Familiar de primer\ngrado.'
    const out = formatLegalText(raw)
    expect(out).toBe(
      'se entenderá por:\n\na) Pareja de hecho: una relación que acredita.\n\nb) Familiar de primer grado.',
    )
  })

  it('SEPARA apartados numerados 1. 2. 3.', () => {
    const raw = '1. La jornada será de treinta y cinco\nhoras.\n2. La duración de la jornada\nespecial.'
    expect(formatLegalText(raw)).toBe(
      '1. La jornada será de treinta y cinco horas.\n\n2. La duración de la jornada especial.',
    )
  })

  it('NO junta líneas cortas tipo tabla/código (A1, E038…) — no las apelotona en horizontal', () => {
    const raw = 'grupos siguientes:\nA1\nE038\nA2\nE023'
    const out = formatLegalText(raw)
    expect(out).toContain('A1\n\nE038')
    expect(out).not.toContain('A1 E038') // no las une en una línea
  })

  it('PRESERVA Markdown ya bueno (bullets, negritas) sin romperlo', () => {
    const raw = '- **Título I**: interesados (arts. 4-12)\n- **Título II**: actividad (arts. 13-33)'
    const out = formatLegalText(raw)
    expect(out).toContain('- **Título I**: interesados (arts. 4-12)')
    expect(out).toContain('- **Título II**: actividad (arts. 13-33)')
  })

  it('idempotente: formatear dos veces da el mismo resultado', () => {
    const raw = 'A los efectos se entenderá\npor:\na) Uno: una relación\nlarga.\nb) Dos.'
    const once = formatLegalText(raw)
    expect(formatLegalText(once)).toBe(once)
  })

  it('caso real art 100 Ley 39/2015: 1. + a) b) c) d) todos separados', () => {
    const raw =
      '1. La ejecución forzosa se efectuará por los siguientes\nmedios:\na) Apremio sobre el patrimonio.\nb) Ejecución subsidiaria.\nc) Multa coercitiva.\nd) Compulsión sobre las\npersonas.\n2. Si fueran varios los medios.'
    const out = formatLegalText(raw)
    expect(out).toContain('a) Apremio sobre el patrimonio.')
    expect(out).toContain('b) Ejecución subsidiaria.')
    expect(out).toContain('d) Compulsión sobre las personas.')
    // cada apartado/letra separado por línea en blanco
    expect(out.split('\n\n').length).toBe(6) // 1. + a b c d + 2.
  })
})
