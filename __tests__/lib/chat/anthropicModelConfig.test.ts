// __tests__/lib/chat/anthropicModelConfig.test.ts
//
// GUARDRAIL del modelo Anthropic del chat (bug 09/07: premium roto 2 días, 7 users).
// El modelo estaba HARDCODEADO (claude-sonnet-4-20250514) y Anthropic lo retiró →
// 404 en todo chat premium, solo arreglable redeployando. Fix: el modelo es
// DB-driven (ai_api_config.default_model) con fallback de código VÁLIDO, y todos los
// call-sites lo resuelven con getAnthropicModel(). Este guardrail (lectura de código,
// sin BD → corre en CI) blinda el cableado y evita reintroducir el modelo muerto.

import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const DEAD_MODEL = 'claude-sonnet-4-20250514'

describe('GUARDRAIL: modelo Anthropic del chat (DB-driven, no hardcodeado muerto)', () => {
  it('anthropic.ts expone getAnthropicModel y lo lee de ai_api_config.default_model', () => {
    const src = read('lib/chat/shared/anthropic.ts')
    expect(src).toMatch(/export async function getAnthropicModel/)
    expect(src).toMatch(/aiApiConfig\.defaultModel/)
  })

  it('el fallback de código NO es el modelo muerto (04-20250514)', () => {
    const src = read('lib/chat/shared/anthropic.ts')
    const m = src.match(/export const ANTHROPIC_MODEL\s*=\s*'([^']+)'/)
    expect(m).toBeTruthy()
    expect(m![1]).not.toBe(DEAD_MODEL)
    // formato modelo Claude válido (claude-...-YYYYMMDD o alias)
    expect(m![1]).toMatch(/^claude-/)
  })

  it('los call-sites resuelven el modelo con getAnthropicModel(), no con el constante', () => {
    const files = [
      'lib/chat/domains/search/SearchDomain.ts',
      'lib/chat/core/ChatOrchestrator.ts',
      'lib/chat/domains/psychometric/PsychometricService.ts',
      'lib/chat/domains/verification/ReanalysisService.ts',
    ]
    for (const f of files) {
      const src = read(f)
      expect(src).toMatch(/getAnthropicModel/)
      // no debe quedar ningún `model: ANTHROPIC_MODEL` (el constante como modelo del call)
      expect(src).not.toMatch(/model:\s*ANTHROPIC_MODEL/)
    }
  })

  it('ningún fichero del chat usa el modelo muerto como STRING literal (valor)', () => {
    // Solo string literales ('...'/"..."); mencionarlo en un comentario que documenta
    // el bug es legítimo. Lo que no puede volver es `= 'claude-sonnet-4-20250514'`.
    const files = [
      'lib/chat/shared/anthropic.ts',
      'lib/chat/domains/search/SearchDomain.ts',
      'lib/chat/core/ChatOrchestrator.ts',
      'lib/chat/domains/psychometric/PsychometricService.ts',
      'lib/chat/domains/verification/ReanalysisService.ts',
    ]
    const deadLiteral = new RegExp(`['"]${DEAD_MODEL}['"]`)
    for (const f of files) {
      expect(read(f)).not.toMatch(deadLiteral)
    }
  })
})
