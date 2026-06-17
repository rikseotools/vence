# CLAUDE.md - Información del Proyecto

> 📋 **Contexto Adicional:** Ver también `PROJECT_CONTEXT.md` para configuración MCP y `docs/` para documentación organizada por categorías.

## Descripción del Proyecto
**Vence** es una aplicación web de preparación para oposiciones, específicamente para Auxiliar Administrativo del Estado. Permite a los usuarios realizar tests personalizados con preguntas de exámenes oficiales y contenido generado por IA.

## Arquitectura Principal

### Componentes Clave de Tests
- **`TestLayout.js`** - Componente principal para tests normales/personalizados
- **`DynamicTest.js`** - Componente para tests generados con IA
- **`ExamLayout.js`** - Componente para modo examen (todas las preguntas visibles, corrección al final)
- **`PsychometricTestLayout.js`** - Componente para tests psicotécnicos
- **`TestPageWrapper.js`** - Wrapper que maneja diferentes tipos de tests
- **`TestConfigurator.js`** - Configurador avanzado de tests (general)
- **`LawTestConfigurator.js`** - Configurador específico para tests de leyes individuales

### APIs de Validación Segura
- **`/api/answer`** - Validación individual de respuestas (tests normales)
- **`/api/exam/validate`** - Validación batch de exámenes completos
- **`/api/answer/psychometric`** - Validación de respuestas psicotécnicas

### Fetchers de Datos
- **`testFetchers.js`** - Funciones para obtener preguntas por tema
- **`lawFetchers.js`** - Funciones específicas para preguntas por ley

### Utilidades de Test
- **`testAnswers.js`** - Manejo de guardado de respuestas
- **`testSession.js`** - Gestión de sesiones de test
- **`testTracking.js`** - Sistema de tracking de interacciones

## Funcionalidades Recientes

### Barra de Meta Diaria movible + ocultable (Implementado: 04/06/2026)
- **Componente:** `components/DailyGoalBanner.tsx` (pill premium "X/Y (%)" en el Header)
- **Problema:** en móvil vive en la fila flotante `absolute top-full` del Header y tapaba contenido.
- **Arrastrable:** pointer events (ratón+táctil), posición persistida en `localStorage` (`daily_goal_pos:<uid>`, per-dispositivo), **clampada al viewport** (helper puro `clampBannerOffset`) y **re-clampada** en mount/resize (no queda fuera al rotar/cambiar pantalla). Distingue click de drag (umbral 6px) para no romper el dropdown.
- **Ocultable con ✕:** es **preferencia de CUENTA** (`user_profiles.show_daily_goal_banner`, NO localStorage) → se ve igual en todos los dispositivos. La ✕ la pone `false`; el **único** sitio para re-activarla es el toggle en `/perfil`.
- **Cableado:** `db/schema.ts` → `lib/api/profile/{schemas,queries}.ts` → `contexts/AuthContext.tsx` → `types/database.types.ts`. Helpers puros exportados (`effectiveBannerVisible`, `nextBannerVisible`, `clampBannerOffset`) testeados en `__tests__/components/DailyGoalBanner.test.ts` (18 tests).
- **Observabilidad in-house:** evento `daily_goal_banner_action` (con `userId` auto) — `action ∈ {drag,hide,show}` en éxito; en fallo del PUT **revierte** el cambio optimista y emite `severity:'warn'` (`hide_failed`/`toggle_failed`). Consulta: `observable_events WHERE event_type='daily_goal_banner_action'`.
- **Migración:** `supabase/migrations/20260604_show_daily_goal_banner.sql` (columna `boolean NOT NULL DEFAULT true`, additiva).

### Landing Pages Dinámicas con Datos de BD (Implementado: 22/03/2026)
- **Ubicación:** `app/auxiliar-administrativo-estado/page.tsx` (primera migrada)
- **Datos dinámicos de tabla `oposiciones`:** plazas, fechas, BOE reference, salario, título requerido
- **Timeline del proceso selectivo:** tabla `convocatoria_hitos` con hitos (completed/current/upcoming)
- **Links oficiales:** convocatoria BOE (`programa_url`) y seguimiento INAP (`seguimiento_url`)
- **ISR:** `revalidate = 86400` (24h) en Vercel
- **SEO:** JSON-LD FAQPage + Event (fecha examen), epígrafes oficiales BOE
- **Función compartida:** `getOposicionLandingData(slug)` en `lib/api/convocatoria/queries.ts`
- **Hitos:** `getHitosConvocatoria(slug)` - timeline visual en la landing
- **Helpers de formato:** `formatNumber()` (regex, sin depender de locale), `formatDateLarga()`, `formatDateCorta()`

### Monitoreo de Seguimiento de Convocatorias (Implementado: 22/03/2026)
- **Objetivo:** Detectar cambios en páginas oficiales de seguimiento de cada oposición
- **Cron:** `/api/cron/check-seguimiento` (L-V 9:00 UTC via GitHub Actions)
- **Mecanismo:** Fetch → limpiar HTML → hash SHA-256 → comparar con hash anterior
- **Tabla:** `convocatoria_seguimiento_checks` (historial) + columnas `seguimiento_*` en `oposiciones`
- **Admin:** `/admin/seguimiento-convocatorias` - lista con badges (CAMBIO/ERROR/OK)
- **Flujo:** Cron detecta cambio → badge en admin → usuario avisa a Claude → Claude actualiza hitos y landing
- **Workflow:** `.github/workflows/check-seguimiento.yml`

### Sistema de Validación Segura de Respuestas (Implementado: 09/01/2026)
- **Objetivo:** Prevenir scraping de respuestas correctas por bots
- **Principio:** La respuesta correcta (`correct_option`) NUNCA se envía al cliente antes de que el usuario responda
- **Arquitectura:**
  - Las preguntas se cargan SIN `correct_option`
  - Cuando el usuario responde, se llama a la API correspondiente
  - La API valida la respuesta y devuelve `isCorrect`, `correctAnswer` y `explanation`
  - El cliente usa `verifiedCorrectAnswer` para mostrar feedback

#### APIs de Validación:
| Endpoint | Uso | Tabla |
|----------|-----|-------|
| `/api/answer` | Tests normales (TestLayout, DynamicTest) | `questions` |
| `/api/exam/validate` | Modo examen batch (ExamLayout) | `questions` |
| `/api/answer/psychometric` | Tests psicotécnicos | `psychometric_questions` |

#### Componentes Actualizados:
- **TestLayout.js** - Usa `/api/answer` con estado `verifiedCorrectAnswer`
- **DynamicTest.js** - Usa `/api/answer` con estado `verifiedCorrectAnswer`
- **ExamLayout.js** - Usa `/api/exam/validate` con estado `validatedResults`
- **PsychometricTestLayout.js** - Usa `/api/answer/psychometric`
- **ChartQuestion.js** - Usa prop `verifiedCorrectAnswer` (NO `question.correct_option`)
- **10 componentes psicotécnicos** - Reciben `verifiedCorrectAnswer` y `verifiedExplanation`

#### Tests de Seguridad:
- **`__tests__/security/answerValidation.test.js`** - 34 tests de validación

#### Logs de Debug:
- `🔒 [SecureAnswer]` - Operaciones de validación segura
- `✅ [SecureAnswer]` - Validación exitosa via API

### Configurador de Tests para Leyes Específicas (Implementado: 17/10/2025)
- **Ubicación:** `app/leyes/[law]/LawTestConfigurator.js`
- **Funcionalidad:** Configurador especializado para tests de leyes individuales
- **Características:**
  - Preselecciona automáticamente la ley específica
  - Oculta opciones no relevantes (preguntas oficiales, artículos imprescindibles)
  - Calcula correctamente las preguntas disponibles por ley
  - Interfaz simplificada para estudio de leyes específicas
- **Diferencias con TestConfigurator general:**
  - No permite selección múltiple de leyes
  - No incluye opciones de oposición (solo estudio de ley)
  - Optimizado para una sola ley preseleccionada

### Sistema Dual de Respuestas (Implementado: 01/01/2025)
- **Ubicación:** `TestLayout.js` líneas 924-943, `DynamicTest.js` líneas 393-412
- **Funcionalidad:** Los usuarios pueden responder de dos formas:
  1. **Método tradicional:** Haciendo clic en las opciones de respuesta completas
  2. **Método rápido:** Usando botones cuadrados A/B/C/D sin scroll
- **Diseño:** Botones cuadrados azules (56x56px) con efectos hover y selección
- **Comportamiento:** Los botones aparecen solo antes de responder y desaparecen después
- **Compatibilidad:** Dark mode y diseño responsive

### Características Técnicas
- **Framework:** Next.js 15.3.3
- **Base de datos:** Supabase
- **Autenticación:** Context-based con Supabase Auth
- **Estilos:** Tailwind CSS con dark mode
- **Tracking:** Sistema completo de analíticas de usuario

## Estructura de Tests

### Tipos de Test Disponibles
1. **Test Aleatorio** - Preguntas mezcladas automáticamente
2. **Test Personalizado** - Configuración avanzada (cantidad, dificultad, exclusiones)
3. **Test Rápido** - 10 preguntas para práctica rápida
4. **Test Oficial** - Solo preguntas de exámenes oficiales reales
5. **Test Dinámico IA** - Preguntas generadas con inteligencia artificial

### Configuraciones de Test
- Número de preguntas (configurable)
- Exclusión de preguntas recientes
- Filtros por dificultad
- Solo preguntas oficiales
- Enfoque en áreas débiles
- Límite de tiempo

## Flujo de Respuesta a Preguntas

1. **Carga de pregunta** → Muestra opciones A, B, C, D (SIN `correct_option`)
2. **Botones rápidos** → Aparecen botones cuadrados azules A/B/C/D al final
3. **Selección** → Usuario puede usar cualquiera de los dos métodos
4. **Validación anti-duplicados** → Sistema previene respuestas múltiples
5. **🔒 Validación segura via API** → Se llama a `/api/answer` (o variante)
6. **Respuesta de API** → Devuelve `isCorrect`, `correctAnswer`, `explanation`
7. **Tracking** → Registra interacciones y tiempo de respuesta
8. **Guardado** → Almacena respuesta en Supabase
9. **Resultado** → Muestra explicación y feedback usando `verifiedCorrectAnswer`
10. **Navegación** → Botón para siguiente pregunta

## Comandos de Desarrollo

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck

# Git push (SIEMPRE usar origin main)
git push origin main
```

## Lifecycle de Preguntas (Implementado: 03/05/2026)

**Sistema robusto de visibilidad de preguntas con state machine de 8 estados + audit trail completo + invariante por construcción.**

- **Roadmap completo:** `docs/roadmap/sistema-desactivacion-preguntas.md`
- **Estados:** `draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`
- **Invariante física:** `is_active` es `GENERATED ALWAYS AS (lifecycle_state IN ('approved', 'tech_approved')) STORED`. Imposible que se desincronicen — el motor Postgres rechaza cualquier `UPDATE is_active` con "can only be updated to DEFAULT".
- **Única vía legítima de cambio:** función SQL `transition_question_state(question_id, expected_state, new_state, reason_code, changed_by, ai_verification_id, notes)`. Valida transiciones legales, optimistic check anti-race, rechaza estados terminales (`retired_*`).
- **Audit completo:** tabla `question_lifecycle_history` (append-only, fuente única de verdad). Trigger fallback `tg_questions_lifecycle_audit_fallback` registra cualquier UPDATE directo como `reason_code='bypass_detected'`.
- **Endpoint admin:** `POST /api/admin/questions/lifecycle/transition` (requiere admin auth)
- **Constants:** `lib/constants/lifecycleReasons.ts` (taxonomía cerrada de 25 `reason_code`s + helpers `isLegalTransition`, `legacyStatusToTransition`)
- **Cron grandfather (no programado aún):** `SELECT public.lifecycle_grandfather_expire(90)` — degrada a `draft` preguntas legacy approved sin verificar tras 90d

**Columnas legacy** (`topic_review_status`, `verification_status`, `deactivation_reason`) se siguen escribiendo por compatibilidad pero `lifecycle_state` es la fuente de verdad. Eliminación pendiente cuando todos los readers (admin UI, funciones SQL `get_topic_questions_*`, tests) migren.

## Base de Datos (Supabase)

### 🧩 Modelo NUCLEAR: preguntas ↔ artículos ↔ temas (FUENTE DE VERDAD)

**Tenerlo SIEMPRE claro — no liarse con los `tags`:**

1. **La pregunta cuelga de un ARTÍCULO de una ley** (`questions.primary_article_id` → `articles`; adicionales en `question_articles`). **El artículo es la fuente única de la verdad** del contenido de la pregunta.
2. **Cada tema de cada oposición se forma con `topic_scope`**: filas `(position_type, topic_id, law_id, article_numbers[])` construidas **según el epígrafe oficial** de ese tema. Un tema = "estos artículos de estas leyes porque su epígrafe los incluye".
3. **Una pregunta aparece en un tema SI su artículo (law_id + article_number) está en el `topic_scope` de ese tema.** La misma ley/artículo escopa en temas distintos de oposiciones distintas (cada `position_type` arma su temario).
4. **`questions.tags` son metadatos y NO mandan en la colocación** (suelen venir cruzados/stale de otra oposición). Para colocación, IGNORAR tags y mirar `topic_scope`. No existe tabla `question_topics`.

**Diagnóstico `tema_incorrecto`:** coger el artículo de la pregunta → buscar en qué `topic_scope` de la oposición del usuario aparece → comparar el artículo con el `topics.epigrafe` → si no encaja con el epígrafe, quitarlo del `article_numbers`. Detalle: `docs/maintenance/verificar-epigrafe-topic-scope.md` + impugnaciones §7.2.

### Tablas Principales
- `questions` - Preguntas de exámenes (con `lifecycle_state`, `is_active` GENERATED)
- `question_lifecycle_history` - Audit trail append-only de transiciones de estado
- `test_sessions` - Sesiones de tests de usuarios
- `detailed_answers` - Respuestas detalladas con analytics
- `user_profiles` - Perfiles de usuario
- `articles` - Artículos de legislación
- `oposiciones` - Datos de convocatorias (plazas, fechas, BOE, URLs seguimiento)
- `convocatoria_hitos` - Hitos del proceso selectivo (timeline en landings)
- `convocatoria_seguimiento_checks` - Historial de checks de páginas de seguimiento

### Formato de Respuestas (questions.correct_option)
- **0 = A**, **1 = B**, **2 = C**, **3 = D** (0-indexed)
- Constraint: `correct_option >= 0 AND correct_option <= 3`

### Sistema de Tracking de Notificaciones (Implementado: 04/08/2025)
- `notification_events` - Eventos de notificaciones push (permisos, envíos, clicks, etc.)
- `email_events` - Eventos de emails (enviados, abiertos, clickeados, rebotes)
- `user_notification_metrics` - Métricas agregadas por usuario para análisis rápido

### Vistas de Analytics
- `admin_notification_analytics` - Vista consolidada para métricas de notificaciones push
- `admin_email_analytics` - Vista consolidada para métricas de emails por tipo

### Funciones RPC
- `get_personalized_questions` - Obtener preguntas personalizadas
- `get_weak_areas` - Análisis de áreas débiles del usuario
- `save_test_result` - Guardar resultados de test
- `update_user_notification_metrics()` - Trigger automático para actualizar métricas


## Notas de Implementación

### 🔒 Seguridad Anti-Scraping (CRÍTICO)
- **NUNCA** exponer `correct_option` al cliente antes de que el usuario responda
- Las preguntas se cargan desde fetchers SIN el campo `correct_option`
- La validación SIEMPRE se hace via API (`/api/answer`, `/api/exam/validate`, `/api/answer/psychometric`)
- Los componentes usan `verifiedCorrectAnswer` (de la API) en vez de `question.correct_option`
- Si se añaden nuevos componentes de test, DEBEN seguir este patrón
- **Tests:** `__tests__/security/answerValidation.test.js` verifica este comportamiento

#### APIs Securizadas (NO devuelven correct_option):
| Endpoint | Descripción |
|----------|-------------|
| `/api/exam/resume` | Reanudar examen - preguntas sin correct_option |
| `/api/debug/question/[id]` | Debug de preguntas - sin correct_option |
| `testFetchers.js` | Fetchers de preguntas normales |
| `lawFetchers.js` | Fetchers de preguntas de leyes |

#### QuestionContext (contexts/QuestionContext.js):
- Solo expone `correctAnswer` cuando `showResult = true`
- Patrón: `correct: showResult ? verifiedCorrectAnswer : null`
- Usado por `AIChatWidget` para sugerencias contextuales

#### Páginas de Debug:
- `app/debug/question/[id]/page.js` - Usa validación via API, no expone respuesta

### Anti-Duplicados
- Sistema robusto para prevenir respuestas múltiples
- Uso de Maps globales y timeouts
- Validación en cliente y servidor

### Performance
- Lazy loading de componentes
- Optimización de consultas a BD
- Cache de sesiones de usuario
- Cleanup automático de eventos

### Accesibilidad
- Dark mode completo
- Responsive design
- Keyboard navigation
- Screen reader compatible

## Mantenimiento

### 🚨 Salud del sistema (runbook obligatorio)
- **Runbook:** `docs/runbooks/health-check.md`
- **Cuándo consultarlo:** cuando el usuario diga *"busca errores"*, *"qué tal va"*, *"estado del sistema"*, *"salud"*, *"hay fuego"*, o similar, Claude DEBE seguir el runbook ANTES de improvisar.
- **Panel admin:** `/admin/salud-sistema` (4 indicadores con semáforo verde/ámbar/rojo, auto-refresh 60s)
- **Indicadores:** errores 5xx 24h, drift de contadores materializados, latencia INSERT a test_questions, salud del cron de drift.
- **Comando CLI rápido** (30s para veredicto verde/ámbar/rojo) en la sección 1 del runbook.

### 📡 Observabilidad (manual completo)
- **Manual:** `docs/runbooks/observability.md`
- **Cuándo consultarlo:** al añadir un nuevo writer (cron, endpoint, handler), al diseñar dashboards/alertas, al investigar incidente, o cuando se pregunte sobre client-side errors / SLOs / tracing.
- **Filosofía martillo:** *"Si un usuario nos reporta un bug que la observabilidad podía haber capturado, hemos fallado."*
- **Principio rector arquitectural:** **AWS-native by default, agnóstico by contract.** La intención futura es migrar a AWS (escala mejor que Vercel/Supabase) pero el código de app habla con interfaces estándar — swap de sink ≠ rewrite.
- **Estado actual (2026-05-25):** MVP — tabla `observable_events` + writers Vercel/Fargate + 1 cron + espejo `validation_error_logs`. Falta Fase 1 (client-side observability + interceptor backend + endpoint ingest + más crons), Fase 2 (alertas + dashboard), Fase 3 (smoke E2E), Fase 4 (SLOs), Fase 5 (tracing OpenTelemetry).
- **Roadmap priorizado:** §13 del manual — siguiente paso recomendado es **endpoint `/api/observability/ingest`** (gateway universal, desbloquea client-side + GHA + Sentry webhook).
- **Migración a AWS:** §11 del manual explica qué cambia (sinks, alertas) y qué NO (todo el código de app, queries SQL, dashboards, SLOs). Diseño Sink intercambiable en §4.

### 📣 Análisis de Google Ads / Campañas (runbook)
- **Runbook:** `docs/runbooks/google-ads-analisis.md`
- **Cuándo consultarlo:** cuando el usuario diga *"investiga ads"*, *"campañas"*, *"rendimiento de anuncios"*, *"dónde meto presupuesto"* o similar, Claude DEBE seguir el runbook ANTES de improvisar.
- **Resumen:** integración Google Ads API (`lib/services/googleAds/`, comandos `npm run ads:*`, panel `/admin/ads`). El runbook explica cómo mirar coste/clics/registros + ingreso real + fecha de examen, con queries listas y el framework de decisión de presupuesto. Aprendizaje clave (02/06/2026, datos reales): la gente compra premium cerca del examen (pico 0-30 días), el examen pasado seca las ventas, y el coste/registro solo engaña si no se cruza con fecha de examen e ingreso. Mantener puja por CLIC (decisión Manuel).

### 📘 Análisis y gestión de Meta Ads (Facebook/Instagram) (runbook)
- **Runbook:** `docs/runbooks/meta-ads-analisis.md`
- **Cuándo consultarlo:** cuando el usuario diga *"meta ads"*, *"facebook ads"*, *"instagram ads"*, *"campañas de meta"*, *"publi en meta"* o similar.
- **Resumen:** Marketing API v21.0 vía System User (credenciales `META_ADS_*` en `.env.local`), página de anuncios **Vence Oposiciones** (`META_PAGE_ID`). El runbook tiene comandos `curl` listos (listar/insights/pausar/activar/presupuesto/crear campaña-conjunto-anuncio), playbook de creación, cruce con ingresos en BD y los **gotchas** del alta (app en modo Live, política de no discriminación en Usuarios del sistema → "+ Agregar", unidades en céntimos, géneros 1/2, geo region keys, subir imágenes multipart). **Cliente ideal que paga (datos reales 17/06): MUJER, 25-55** (73% mujeres; 92% de ventas en 25-54; 18-24 solo 3%). Pujar por CLIC con techo bajo (Conversiones arranca caro). Creativos: `marketing/ad-creatives/meta/generate.py`. Atribución BD: `registration_source='meta'` (NO `'meta_ads'`).

### 🔎 Oportunidades SEO (runbook)
- **Runbook:** `docs/runbooks/seo-oportunidades.md`
- **Cuándo consultarlo:** cuando el usuario diga *"oportunidades SEO"*, *"qué mejoro de SEO"*, *"subir en Google"*, *"posiciones orgánicas"* o similar.
- **Resumen:** datos de Google Search Console (conectado por API, `lib/services/googleSearchConsole/`). Comandos `npm run gsc:seo` (oportunidades con tendencia ↑/↓) y `gsc:keywords -- <slug>`. Panel `/admin/ads` tiene columna "Orgánico". Bucle: identificar (gsc:seo) → estudiar competidor (Google la query / Semrush) → mejorar contenido → medir a 3-4 semanas. **Ads NO sube el orgánico**; SEO se sube con contenido + enlaces. Mayor demanda: tests de leyes (39/2015, 40/2015, CE) + "examen auxiliar administrativo estado".

### Logs Importantes
- Prefijo `🔍` para debug de renderizado
- Prefijo `💾` para operaciones de guardado
- Prefijo `🎯` para funcionalidades de test
- Prefijo `❌` para errores críticos
- Prefijo `🔒 [SecureAnswer]` para validación segura de respuestas
- Prefijo `✅ [SecureAnswer]` para validación exitosa via API
- Prefijo `✅ [API/answer]` para logs de APIs de validación

### Archivos de Configuración
- `.env.local` - Variables de entorno
- `next.config.js` - Configuración de Next.js
- `package.json` - Dependencias y scripts

### Documentación de Base de Datos

#### Drizzle ORM (Schema Tipado)
- **`db/schema.ts`** - Schema completo con 85 tablas tipadas, índices, foreign keys y RLS policies
- **`db/relations.ts`** - Relaciones entre tablas
- **`drizzle.config.ts`** - Configuración de Drizzle
- **IMPORTANTE:** Consultar `db/schema.ts` para conocer la estructura exacta de cualquier tabla
- Para regenerar el schema: `DATABASE_URL="..." npx drizzle-kit introspect`

#### Documentación Adicional
- **docs/database/tablas.md:** Documentación detallada de todas las tablas
- Para verificar estructura de tablas, consultar primero `db/schema.ts` (fuente de verdad)

### Consultas a Base de Datos desde Claude Code
Claude puede consultar la base de datos Supabase directamente usando Node.js con `@supabase/supabase-js`:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty')
    .eq('is_active', true)
    .limit(5);

  if (error) console.error('❌ Error:', error);
  else console.log('✅ Resultados:', data);
})();
"
```

**Ventajas:**
- ✅ 100% confiable (usa las mismas credenciales que la app)
- ✅ No requiere contraseña de Postgres (usa ANON_KEY)
- ✅ Respeta RLS policies automáticamente
- ✅ Sintaxis familiar (igual que en el código de la app)

**Notas importantes:**
- MCP NO funciona con Supabase (ver docs/MCP-POSTGRES-SUPABASE.md en otros proyectos)
- Variables de entorno se cargan automáticamente de `.env.local`
- Útil para debugging, verificación de datos, y análisis de queries complejas

### ⚠️ CRÍTICO: Verificación de Contenido Legal
- **NUNCA crear estructuras de leyes sin verificar primero con BOE oficial**
- **SIEMPRE consultar fuentes oficiales ANTES de crear contenido normativo**
- **Verificar artículos, títulos y rangos contra documentos oficiales**
- **En contenido legal, la precisión es crítica para la plataforma**

### Política de Commits
- **NUNCA hacer commits automáticos sin autorización explícita del usuario**
- Solo hacer commit cuando el usuario específicamente lo solicite
- Anotar cambios completados pero esperar instrucciones para commit
- **IMPORTANTE:** A veces los problemas no se solucionan completamente al primer intento
- Siempre verificar que el fix funciona antes de proponer commit