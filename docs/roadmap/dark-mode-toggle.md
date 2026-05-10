# Roadmap — Toggle Tema Claro/Oscuro

> **Estado**: Pendiente (revertido 10/05/2026)
> **Prioridad**: Media
> **Feedback**: mushacosa (10/05/2026) — "El fondo oscuro me dificulta la visión"
> **Commit revertido**: `5c4fb226` (feat: toggle tema claro/oscuro con next-themes)
> **Revert**: `89d584af`

## Contexto

La app usa `darkMode: 'media'` (Tailwind default) — sigue la preferencia del SO sin toggle manual. Usuarios con macOS/iOS en dark mode no pueden cambiar a claro dentro de Vence.

Se implementó con `next-themes` pero se revirtió porque ~30 componentes no tienen clases `dark:` y se veían mal (texto blanco sobre fondo blanco).

## Auditoría de cobertura (10/05/2026)

- **207 archivos** con clases `dark:` (TestLayout, Header, temario, landings dinámicas, oposiciones-compatibles, etc.)
- **~30 archivos sin `dark:`** — principalmente:
  - Componentes de estadísticas: `MainStats.js`, `DetailedCharts.tsx`, `ThemePerformance.tsx`, `ExamReadiness.tsx`, `DifficultyBreakdown.tsx`, `AIRecommendations.tsx`, etc.
  - Landing estáticas: `premium-edu`, `premium-ads-1`
  - Modales: `ArticleModal.tsx`, `TitleFilterModal.js`
  - Páginas de test legacy: `test/aleatorio`, `test/desde-chat`

## Plan de implementación

### Fase 1 — Cobertura dark mode (2-3 horas)
1. Añadir clases `dark:` a los ~30 componentes sin soporte
2. Patrón: `bg-white` → `bg-white dark:bg-gray-800`, `text-gray-800` → `text-gray-800 dark:text-white`
3. Verificar visualmente cada página en ambos modos

### Fase 2 — Activar toggle (30 min)
1. `npm install next-themes`
2. `tailwind.config.js`: `darkMode: 'class'`
3. `ThemeProvider` en `app/layout.tsx` con `attribute="class" defaultTheme="system" enableSystem`
4. `suppressHydrationWarning` en `<html>`
5. `ThemeToggle` componente (sol/luna) en Header antes de la campana

### Fase 3 — Verificación
1. Probar todas las páginas principales en ambos modos
2. Verificar que localStorage persiste la preferencia
3. Verificar que `defaultTheme="system"` respeta el SO para nuevos usuarios

## Referencia técnica

El commit revertido `5c4fb226` contiene la implementación completa de la Fase 2. Solo falta la Fase 1 (cobertura) antes de re-aplicarlo.
