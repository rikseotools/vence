/**
 * Tests para el gating Premium del Simulacro de Examen y el cap en
 * la card "Mis Debilidades".
 *
 * Feature (16/05/2026): bloquear entrada al simulacro para usuarios FREE
 * mostrando un modal Premium en vez de dejarlos entrar y bloquearlos a
 * mitad de las 110 preguntas (cuota free = 25/día).
 *
 * Diseño UX confirmado:
 *  - Premium NO ve badge "⭐ Premium" — ven "Nuevo" como siempre.
 *  - Free SÍ ven badge "⭐ Premium" y al pulsar → modal en lugar de entrar.
 *  - Excepción: si tienen simulacro pendiente, sí pueden continuar.
 *  - Debilidades: deshabilitar cantidades que excedan la cuota diaria.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ============================================
// CONFIG COMPARTIDO
// ============================================
describe('lib/api/simulacro/config — single source of truth', () => {
  const cfg = read('lib/api/simulacro/config.ts')

  it('exporta SIMULACRO_PUBLIC_CONFIG con auxiliar-administrativo-estado', () => {
    expect(cfg).toContain("'auxiliar-administrativo-estado'")
    expect(cfg).toMatch(/totalQuestions:\s*110/)
    expect(cfg).toMatch(/durationMinutes:\s*90/)
  })

  it('exporta SIMULACRO_AVAILABLE_OPOSICIONES derivado de las keys', () => {
    expect(cfg).toContain('export const SIMULACRO_AVAILABLE_OPOSICIONES')
    expect(cfg).toContain('Object.keys(SIMULACRO_PUBLIC_CONFIG)')
  })

  it('exporta getSimulacroConfig(slug) que devuelve config o null', () => {
    expect(cfg).toContain('export function getSimulacroConfig')
    expect(cfg).toContain('SIMULACRO_PUBLIC_CONFIG[oposicionSlug]')
  })

  it('NO importa nada server-side (sin Drizzle ni dependencies de server)', () => {
    expect(cfg).not.toMatch(/from\s+['"]drizzle-orm/)
    expect(cfg).not.toMatch(/from\s+['"]@\/db\//)
    expect(cfg).not.toMatch(/from\s+['"]@\/lib\/api\/simulacro\/queries/)
  })
})

// ============================================
// MODAL EXTRACTADO
// ============================================
describe('SimulacroPaywallModal — componente reutilizable', () => {
  const modal = read('components/test/SimulacroPaywallModal.tsx')

  it('está en un archivo propio (no inline en TestHubClient)', () => {
    expect(modal).toContain('export default function SimulacroPaywallModal')
  })

  it('recibe config + dailyLimit + oposicionSlug por props', () => {
    expect(modal).toMatch(/config:\s*SimulacroPublicConfig/)
    expect(modal).toMatch(/dailyLimit:\s*number/)
    expect(modal).toMatch(/oposicionSlug:\s*string/)
  })

  it('a11y: role=dialog, aria-modal, aria-labelledby', () => {
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain('aria-labelledby="simulacro-paywall-title"')
  })

  it('trackea view, upgrade_click y dismiss vía useInteractionTracker', () => {
    expect(modal).toContain("'paywall_view'")
    expect(modal).toContain("'paywall_upgrade_click'")
    expect(modal).toContain("'paywall_dismiss'")
  })

  it('calcula daysToComplete = ceil(totalQuestions / dailyLimit)', () => {
    expect(modal).toMatch(/Math\.ceil\(config\.totalQuestions\s*\/\s*Math\.max\(1,\s*dailyLimit\)\)/)
  })

  it('CTA Premium navega a /premium con tracking', () => {
    expect(modal).toMatch(/href="\/premium"[\s\S]{0,300}paywall_upgrade_click/)
  })
})

// ============================================
// TestHubClient — usa el componente extraído + config compartido
// ============================================
describe('TestHubClient — gating simulacro Free', () => {
  const hub = read('components/test/TestHubClient.tsx')

  it('importa SIMULACRO_AVAILABLE_OPOSICIONES + getSimulacroConfig del config', () => {
    expect(hub).toContain("from '@/lib/api/simulacro/config'")
    expect(hub).toContain('SIMULACRO_AVAILABLE_OPOSICIONES')
    expect(hub).toContain('getSimulacroConfig')
  })

  it('NO duplica la constante SIMULACRO_AVAILABLE_OPOSICIONES localmente', () => {
    // No debe haber declaración local "const SIMULACRO_AVAILABLE_OPOSICIONES ="
    expect(hub).not.toMatch(/const\s+SIMULACRO_AVAILABLE_OPOSICIONES\s*:/)
  })

  it('importa SimulacroPaywallModal del archivo nuevo', () => {
    expect(hub).toContain("from '@/components/test/SimulacroPaywallModal'")
  })

  it('usa useDailyQuestionLimit para detectar hasLimit / questionsRemaining', () => {
    expect(hub).toContain('useDailyQuestionLimit()')
    expect(hub).toMatch(/hasLimit,\s*questionsRemaining,\s*dailyLimit/)
  })

  it('badge "⭐ Premium" solo si hasLimit (free); resto ve "Nuevo"', () => {
    expect(hub).toMatch(/hasLimit\s*\?\s*'⭐ Premium'\s*:\s*'Nuevo'/)
  })

  it('SimulacroCard FREE: <button> que abre paywall', () => {
    expect(hub).toMatch(/if \(hasLimit\)\s*\{[\s\S]{0,400}<button[\s\S]{0,300}onClick=\{onOpenPaywall\}/)
  })

  it('SimulacroCard Premium: <Link> que SIEMPRE genera nuevo con ?nuevo=1', () => {
    expect(hub).toMatch(/href=\{`\/\$\{oposicion\}\/test\/simulacro\?nuevo=1`\}/)
  })

  it('Hub NO gestiona pending simulacros (es responsabilidad solo del header dropdown)', () => {
    // No debe haber detector de pending ni state pendingSimulacro en el hub
    expect(hub).not.toMatch(/setPendingSimulacro\(/)
    expect(hub).not.toContain('checkPendingSimulacro')
    // No debe haber "Continuar simulacro" como card en el hub
    expect(hub).not.toMatch(/SimulacroCard[\s\S]{0,500}Continuar simulacro/)
  })

  it('SimulacroCard recibe props mínimas (oposicion, hasLimit, onOpenPaywall)', () => {
    expect(hub).toMatch(/interface SimulacroCardProps\s*\{[\s\S]{0,300}oposicion:\s*string[\s\S]{0,80}hasLimit:\s*boolean[\s\S]{0,80}onOpenPaywall:/)
  })

  it('renderiza SimulacroPaywallModal con config del slug actual', () => {
    expect(hub).toMatch(/getSimulacroConfig\(oposicion\)/)
    expect(hub).toMatch(/<SimulacroPaywallModal[\s\S]{0,300}config=\{simulacroConfig\}/)
  })
})

// ============================================
// DebilidadesCard — cap por questionsRemaining
// ============================================
describe('DebilidadesCard — cap por cuota diaria', () => {
  const hub = read('components/test/TestHubClient.tsx')

  it('recibe hasLimit, questionsRemaining, dailyLimit por props', () => {
    expect(hub).toMatch(/function DebilidadesCard\([\s\S]{0,500}hasLimit:\s*boolean[\s\S]{0,300}questionsRemaining:\s*number[\s\S]{0,300}dailyLimit:\s*number/)
  })

  it('helper isCountAvailable: free → n <= questionsRemaining; premium → true', () => {
    expect(hub).toMatch(/isCountAvailable.*=\s*\(n:\s*number\).*=>\s*!hasLimit\s*\|\|\s*n\s*<=\s*questionsRemaining/)
  })

  it('botones de cantidad deshabilitados (disabled) cuando exceden cuota', () => {
    expect(hub).toMatch(/disabled=\{!available\}/)
  })

  it('estilo visual distintivo: gris + line-through cuando no disponible', () => {
    expect(hub).toMatch(/!available[\s\S]{0,200}line-through/)
  })

  it('chip "{questionsRemaining}/{dailyLimit} hoy" solo si hasLimit', () => {
    expect(hub).toMatch(/hasLimit\s*&&\s*\([\s\S]{0,300}questionsRemaining\}\/\{dailyLimit\}\s*hoy/)
  })

  it('useEffect autoadaptativo: si default excede cuota, baja al max viable', () => {
    expect(hub).toMatch(/useEffect[\s\S]{0,400}!isCountAvailable\(selectedCount\)[\s\S]{0,300}setSelectedCount\(fallback\)/)
  })

  it('mensaje CTA Premium debajo si la cuota es menor que el máximo selector', () => {
    expect(hub).toMatch(/Cantidades en gris exceden tu cuota diaria[\s\S]{0,300}Hazte Premium/)
  })
})
