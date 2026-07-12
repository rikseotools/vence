// lib/premium/features.ts — REGISTRO ÚNICO de funcionalidades premium (fuente de verdad).
//
// POR QUÉ EXISTE: para gatear una feature premium NO se siembra `if (isPremium)` por N
// componentes (imposible de mantener/medir). Todo pasa por este registro + el guard
// central (hooks/usePremiumGate) + un único modal (components/premium/PremiumFeatureModal).
// AÑADIR una feature premium = 1 entrada aquí + envolver su control. Nada más.
//
// TRES TIPOS de gating conviven bajo el mismo registro (kind):
//   - 'ui_feature'  → un toggle/opción del configurador (excluir recientes, áreas débiles…).
//   - 'experience'  → una experiencia entera (Simulacro, modo examen…).
//   - 'course'      → videocursos (fila video_courses.is_premium; server da preview 10 min).
//   - 'editorial'   → temas de contenido editorial premium (futuro; gating por dato en fila).
//
// El copy vive AQUÍ (no en cada modal) para consistencia + para poder A/B-testear centralmente.
// Cada gate emite observabilidad con `feature` = el id de aquí → medible al 100% (qué gate se
// muestra, cuál convierte). Ver docs/runbooks/premium-gating.md.

export type PremiumFeatureKind = 'ui_feature' | 'experience' | 'course' | 'editorial'

export interface PremiumFeature {
  /** Id ESTABLE (kebab_case). Es la clave de analítica — NO cambiar una vez en producción. */
  id: string
  kind: PremiumFeatureKind
  /** Nombre corto para logs/analítica y para el chip 👑 junto al control. */
  label: string
  /** Título del modal (patrón "Función Premium"). */
  modalTitle: string
  /** Cuerpo del modal: por qué es premium + qué gana. Frases cortas, sin muro de texto. */
  modalBody: string
  /** Línea de beneficio destacada (bullet principal del modal). */
  benefit: string
  /** Plan mínimo que la desbloquea. Hoy todas 'premium'; preparado para tiers. */
  unlockPlan: 'premium'
}

// ── EL REGISTRO ──────────────────────────────────────────────────────────────
// Empieza VACÍO de features concretas salvo las genéricas de contenido: el andamiaje
// no decide QUÉ gatear (eso es decisión de negocio, se añade 1 línea cuando se aprueba).
// Las entradas 'course'/'editorial' son genéricas: el dato (is_premium en la fila) decide
// SI se gatea; el registro aporta el copy/analítica uniformes para ese kind.
export const PREMIUM_FEATURES = {
  // Videocursos (fila video_courses.is_premium). El server ya sirve 10 min de preview;
  // este entry unifica el copy + la analítica del paywall del curso.
  course: {
    id: 'course',
    kind: 'course',
    label: 'Videocurso completo',
    modalTitle: 'Videocurso Premium',
    modalBody:
      'Has visto la vista previa gratuita de este bloque. Con Premium accedes al videocurso completo y a todos los cursos.',
    benefit: 'Todos los videocursos completos, sin límite de minutos',
    unlockPlan: 'premium',
  },
  // Temas de contenido editorial premium (futuro). El dato en la fila del tema decide;
  // aquí el copy/analítica uniformes.
  editorial_topic: {
    id: 'editorial_topic',
    kind: 'editorial',
    label: 'Tema premium',
    modalTitle: 'Contenido Premium',
    modalBody:
      'Este tema es contenido editorial exclusivo de Premium. Con Premium desbloqueas todos los temas premium, además de tests y cursos ilimitados.',
    benefit: 'Todos los temas de contenido editorial premium',
    unlockPlan: 'premium',
  },
} as const satisfies Record<string, PremiumFeature>

export type PremiumFeatureId = keyof typeof PREMIUM_FEATURES

/** Devuelve la feature del registro o `null` si el id no existe (nunca lanza). */
export function getPremiumFeature(id: string): PremiumFeature | null {
  return (PREMIUM_FEATURES as Record<string, PremiumFeature>)[id] ?? null
}
