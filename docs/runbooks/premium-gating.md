# Runbook — Framework de gating premium (funciones "esto es Premium")

> **Cuándo:** cuando el usuario diga *"haz esta función premium"*, *"esto que sea de pago"*, *"gatea X"*, *"pon un modal de premium en Y"*, o al añadir contenido (curso/tema editorial) que deba ser premium. Seguir este runbook — NO sembrar `if (isPremium)` a mano.

## Qué es (fuente única, robusto/escalable/medible)

Un solo sistema para gatear cualquier cosa premium — toggles de UI, experiencias enteras, videocursos y temas de contenido editorial — con **un registro**, **un guard**, **un modal** y **observabilidad por-feature**. Añadir una feature premium = **1 entrada en el registro + envolver su control**. Nada más.

- **Registro (verdad):** `lib/premium/features.ts` → `PREMIUM_FEATURES`. Cada entrada: `{ id, kind, label, modalTitle, modalBody, benefit, unlockPlan }`. El `id` es la clave de analítica — **estable, no se cambia** una vez en producción.
  - `kind`: `ui_feature` (toggle), `experience` (flujo entero), `course` (videocurso), `editorial` (tema editorial premium).
- **Verdad server-side:** `lib/premium/isPremiumPlan.ts` → `isPremiumPlan(plan_type)` (reexporta `PREMIUM_PLAN_TYPES`). **Toda** validación de servidor mira aquí.
- **Guard cliente:** `hooks/usePremiumGate.ts` → `usePremiumGate()`. `gate(featureId, onAllowed?, context?)`: premium → ejecuta; free → abre el modal + emite `premium_gate_shown`. Id desconocido → **fail-open** (nunca bloquea por un typo).
- **Modal único:** `components/premium/PremiumFeatureModal.tsx` — genérico, copy del registro, CTA → `/premium?feature=<id>` (emite `premium_gate_cta_click`).
- **Observabilidad (medible al 100%):** eventos `premium_gate_shown` / `premium_gate_cta_click` / `premium_gate_dismiss` en `conversion_events` (vía `lib/services/conversionTracker.ts`), cada uno con `feature` + `kind` + `context`. Embudo listo: `SELECT * FROM v_premium_gate_funnel ORDER BY shown DESC;` (shown → cta → cta_rate por feature).

## Cómo GATEAR una feature (UI toggle) — el patrón

1. **Registro** — añade 1 entrada en `lib/premium/features.ts`:
   ```ts
   exclude_recent: {
     id: 'exclude_recent', kind: 'ui_feature',
     label: 'Excluir preguntas recientes',
     modalTitle: 'Repaso sin repetir',
     modalBody: 'Evita que te salgan las preguntas que ya hiciste hace poco. Con Premium…',
     benefit: 'Repaso inteligente sin repetir lo reciente',
     unlockPlan: 'premium',
   },
   ```
2. **Envolver el control** en el componente:
   ```tsx
   const { gate, activeFeature, activeContext, closeGate } = usePremiumGate()
   // en el onChange/onClick del toggle:
   onClick={() => gate('exclude_recent', () => setExcludeRecent(true), 'test_configurator')}
   // una vez, al final del componente:
   {activeFeature && <PremiumFeatureModal feature={activeFeature} context={activeContext} onClose={closeGate} />}
   ```
   Para "visible pero bloqueado" (recomendado): muestra el toggle con un chip 👑 y deja que `gate()` abra el modal — el free VE lo que se pierde (superficie de upsell), no una función oculta.

## Cómo gatear CONTENIDO (curso / tema editorial)

El gating de contenido es **por dato en la fila** (no por registro de código): `video_courses.is_premium` (ya existe; el server sirve preview de 10 min) y, a futuro, un flag análogo en el tema editorial.

- **Servidor (obligatorio, defensa en profundidad):** el endpoint que sirve el contenido valida `isPremiumPlan(profile.plan_type)`; si es free y la fila es `is_premium`, devuelve la versión gateada (preview / bloqueo). Nunca fiar el gating solo al cliente para contenido (se puede pedir la URL directa).
- **Cliente:** al topar el bloqueo, abre el modal con la feature genérica del registro (`course` o `editorial_topic`) → copy + analítica uniformes.

## Regla de oro
- **Nunca** `if (isPremium)` suelto: pasa por `gate()` (cliente) / `isPremiumPlan()` (servidor).
- **Contenido y features que cuestan** (IA, cursos): SIEMPRE gated también en servidor.
- No sobre-gatear: el bucle central (responder, tests básicos, leer teoría) alimenta el embudo; el límite de 25/día ya monetiza volumen. Gatear "power features" y contenido, no lo básico.
- Guardarraíl: `__tests__/premium/premiumGateFramework.test.ts` (integridad del registro + fail-open + isPremiumPlan).
