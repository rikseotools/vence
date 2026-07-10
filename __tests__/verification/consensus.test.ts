// __tests__/verification/consensus.test.ts — capa unit (pura, sin BD ni agentes)
import { scopeConsensus, epigrafeConsensus, isContentVerificationPending } from '@/lib/verification/consensus'

describe('scopeConsensus (S1)', () => {
  it('ambos CORRECT → correct', () => {
    expect(scopeConsensus('CORRECT', 'CORRECT')).toBe('correct')
  })
  it('ambos ISSUES → issues', () => {
    expect(scopeConsensus('ISSUES', 'ISSUES')).toBe('issues')
  })
  it('discrepancia sin juez → issues (conservador)', () => {
    expect(scopeConsensus('CORRECT', 'ISSUES')).toBe('issues')
    expect(scopeConsensus('ISSUES', 'CORRECT')).toBe('issues')
  })
  it('discrepancia con juez → mayoría', () => {
    expect(scopeConsensus('CORRECT', 'ISSUES', 'CORRECT')).toBe('correct') // 2 correct
    expect(scopeConsensus('CORRECT', 'ISSUES', 'ISSUES')).toBe('issues')   // 2 issues
  })
})

describe('epigrafeConsensus (S2)', () => {
  it('todos literal → literal', () => {
    expect(epigrafeConsensus(['literal', 'literal'])).toBe('literal')
  })
  it('algún drift → drift', () => {
    expect(epigrafeConsensus(['literal', 'drift'])).toBe('drift')
  })
  it('todos no_verificable → no_verificable', () => {
    expect(epigrafeConsensus(['no_verificable', 'no_verificable'])).toBe('no_verificable')
  })
  it('literal + no_verificable → literal (no bloquea)', () => {
    expect(epigrafeConsensus(['literal', 'no_verificable'])).toBe('literal')
  })
  it('vacío → no_verificable', () => {
    expect(epigrafeConsensus([])).toBe('no_verificable')
  })
})

describe('isContentVerificationPending (badge)', () => {
  it('scope correct + epígrafe literal → NO pendiente', () => {
    expect(isContentVerificationPending('verified_correct', 'verified_literal')).toBe(false)
  })
  it('scope stale → pendiente', () => {
    expect(isContentVerificationPending('stale', 'verified_literal')).toBe(true)
  })
  it('epígrafe outdated → pendiente', () => {
    expect(isContentVerificationPending('verified_correct', 'outdated_convocatoria')).toBe(true)
  })
  it('sin verificar (null/null) → pendiente', () => {
    expect(isContentVerificationPending(null, null)).toBe(true)
  })
  it('scope issues → pendiente', () => {
    expect(isContentVerificationPending('verified_issues', 'verified_literal')).toBe(true)
  })
})
