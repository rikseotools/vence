/**
 * @jest-environment node
 */
// Contenido de la landing "tu oposición a medida" (T-328). No renderiza el Server Component
// (RSC + next/link resisten Jest sin el entorno completo de Next) — verifica el contrato de
// datos que page.tsx consume tal cual, que es donde vive el riesgo real: un CTA que apunte al
// sitio equivocado, o una FAQ que se quede vacía y deje un FAQPage JSON-LD vacío en el <head>
// (peor que no tenerlo — es un rich-result roto).

import { CTA_HREF, FAQ_ITEMS } from '@/app/tu-oposicion-a-medida/content'

describe('contenido de tu-oposicion-a-medida', () => {
  it('el CTA apunta al creador real de T-327, no a un borrador de URL', () => {
    expect(CTA_HREF).toBe('/oposicion-personalizada')
  })

  it('hay preguntas frecuentes, y ninguna vacía', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThan(0)
    for (const item of FAQ_ITEMS) {
      expect(item.pregunta.trim().length).toBeGreaterThan(0)
      expect(item.respuesta.trim().length).toBeGreaterThan(0)
    }
  })

  it('no promete lo que T-327 todavía no tiene: nada de "simulacro" ni "aleatorio" para toda la oposición', () => {
    // T-327 (01/08): el test de TODA la oposición (aleatorio/simulacro) NO existe para
    // personalizadas, solo test por tema. Prometerlo en SEO sería quemar la palabra antes de
    // tener el producto — la propia ficha de T-328 lo pone como condición explícita.
    const textoCompleto = FAQ_ITEMS.map((f) => `${f.pregunta} ${f.respuesta}`).join(' ').toLowerCase()
    expect(textoCompleto).not.toMatch(/test aleatorio de toda\b|simulacro de toda\b/)
  })

  it('deja claro que hoy solo hay test POR TEMA (para que nadie llegue esperando más)', () => {
    const textoCompleto = FAQ_ITEMS.map((f) => `${f.pregunta} ${f.respuesta}`).join(' ')
    expect(textoCompleto).toMatch(/por tema/i)
  })

  it('no promete privacidad que no existe: hoy toda oposición personalizada se crea pública', () => {
    const textoCompleto = FAQ_ITEMS.map((f) => `${f.pregunta} ${f.respuesta}`).join(' ').toLowerCase()
    expect(textoCompleto).not.toMatch(/hacerla privada|opción privada|modo privado/)
  })

  it('las preguntas son únicas (evita FAQPage con entradas duplicadas)', () => {
    const preguntas = FAQ_ITEMS.map((f) => f.pregunta)
    expect(new Set(preguntas).size).toBe(preguntas.length)
  })
})
