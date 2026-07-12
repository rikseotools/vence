// Guardarraíl (fix 12/07/2026 — flakiness del build): /leyes/[law] era la ÚNICA ruta
// de alto volumen en SSG masivo (generateStaticParams → getAllActiveSlugs → 1.278
// páginas, cada una pegando a RDS en build) → CONNECT_TIMEOUT + OOM intermitentes.
// Fix: on-demand (generateStaticParams => []). Este test verifica POR FUENTE que:
//   1. generateStaticParams NO vuelve a prerenderizar las 1.278 (getAllActiveSlugs).
//   2. dynamicParams NUNCA es false (false = 404 masivo = desastre SEO).
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(
  join(__dirname, '..', '..', 'app', 'leyes', '[law]', 'page.tsx'),
  'utf-8',
)

describe('/leyes/[law] — on-demand (anti flakiness build + anti 404 masivo)', () => {
  it('generateStaticParams NO importa/llama getAllActiveSlugs (no prerenderiza las 1.278 en build)', () => {
    // el comentario PUEDE mencionarlo (documenta la historia); lo que no debe es importarlo ni llamarlo
    expect(src).not.toMatch(/import[^;]*getAllActiveSlugs/)
    expect(src).not.toMatch(/getAllActiveSlugs\s*\(/)
  })

  it('generateStaticParams devuelve una lista acotada (idealmente [])', () => {
    // el cuerpo de generateStaticParams no debe mapear miles de slugs
    const m = src.match(/generateStaticParams\(\)\s*\{([\s\S]*?)\n\}/)
    expect(m).toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/return\s*\[\s*\]/)
  })

  it('dynamicParams está explícito y NUNCA es false (evita 404 masivo)', () => {
    expect(src).toMatch(/export const dynamicParams\s*=\s*true/)
    expect(src).not.toMatch(/dynamicParams\s*=\s*false/)
  })
})
