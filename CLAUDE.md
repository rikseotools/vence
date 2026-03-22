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

## Base de Datos (Supabase)

### Tablas Principales
- `questions` - Preguntas de exámenes
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