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
  // ── UI features del configurador de tests ──────────────────────────────────
  // Excluir preguntas recientes ("no repetir lo hecho hace poco"). Primera feature
  // cableada del framework (prueba end-to-end). Free → 👑 + modal; premium → normal.
  exclude_recent: {
    id: 'exclude_recent',
    kind: 'ui_feature',
    label: 'Excluir preguntas recientes',
    modalTitle: 'Repaso sin repetir',
    modalBody:
      'Evita que te salgan las preguntas que ya hiciste hace poco y centra el repaso en lo que te falta. Es una función Premium.',
    benefit: 'Repaso inteligente que no repite lo reciente',
    unlockPlan: 'premium',
  },

  // Atajo "Practicar mis fallos" en la pantalla de RESULTADOS (justo tras fallar =
  // máxima intención). El repaso de fallos sigue GRATIS por el camino largo
  // (hub "Mis Debilidades" / estadísticas); lo Premium es el ATAJO sin fricción en
  // el momento perfecto → gancho de conversión por PRACTICIDAD, no por exclusividad
  // (por eso NO se gatea la API: no vendemos la capacidad, vendemos el atajo). Free
  // → 👑 + modal; premium → va directo al repaso scopeado a su oposición.
  repaso_fallos: {
    id: 'repaso_fallos',
    kind: 'experience',
    label: 'Practicar mis fallos',
    modalTitle: 'Practica tus fallos al instante',
    modalBody:
      'Con Premium, nada más terminar un test vuelves a practicar tus preguntas falladas de un toque, sin buscar. Además tienes tests, chat con IA y lectura por voz sin límite.',
    benefit: 'Repasa tus fallos al instante, justo cuando más te cunde',
    unlockPlan: 'premium',
  },

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
  // Descarga/impresión del temario en PDF. Los primeros FREE_PRINT_MAX_TOPIC temas
  // son GRATIS (captación + SEO); a partir de ahí, descargar el PDF es Premium.
  // Gatea la descarga por-tema más allá del cupo; el "temario completo" (T-076) tendrá
  // su propio control premium. Free → 👑 + modal; premium → descarga directa.
  print_pdf: {
    id: 'print_pdf',
    kind: 'ui_feature',
    label: 'Descargar temario en PDF',
    modalTitle: 'Descarga el temario en PDF',
    modalBody:
      'Con Premium descargas en PDF cualquier tema para estudiar sin conexión o imprimirlo. Los primeros temas son gratis; el resto es Premium, junto con tests, chat con IA y lectura por voz sin límite.',
    benefit: 'Descarga e imprime todo el temario, tema a tema',
    unlockPlan: 'premium',
  },
} as const satisfies Record<string, PremiumFeature>

export type PremiumFeatureId = keyof typeof PREMIUM_FEATURES

/**
 * Cupo GRATIS de descarga/impresión de PDF por tema (T-076): los temas con
 * `topic_number <= FREE_PRINT_MAX_TOPIC` se descargan gratis (captación + SEO);
 * a partir de ahí es Premium. Fuente única compartida por el botón (cliente) y la
 * ruta `/api/temario/[oposicion]/[topic]/pdf` (servidor).
 */
export const FREE_PRINT_MAX_TOPIC = 3

/** Devuelve la feature del registro o `null` si el id no existe (nunca lanza). */
export function getPremiumFeature(id: string): PremiumFeature | null {
  return (PREMIUM_FEATURES as Record<string, PremiumFeature>)[id] ?? null
}
