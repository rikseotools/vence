# CLAUDE.md - Información del Proyecto

> 📋 **Contexto Adicional:** Ver también `PROJECT_CONTEXT.md` para configuración MCP y `docs/` para documentación organizada por categorías.

## Descripción del Proyecto
**Vence** es una aplicación web de preparación para oposiciones, específicamente para Auxiliar Administrativo del Estado. Permite a los usuarios realizar tests personalizados con preguntas de exámenes oficiales y contenido generado por IA.

## Arquitectura Principal

### Componentes Clave de Tests
- **`TestLayout.js`** - Componente principal para tests normales/personalizados
- **`DynamicTest.js`** - Componente para tests generados con IA
- **`TestPageWrapper.js`** - Wrapper que maneja diferentes tipos de tests
- **`TestConfigurator.js`** - Configurador avanzado de tests (general)
- **`LawTestConfigurator.js`** - Configurador específico para tests de leyes individuales

### Fetchers de Datos
- **`testFetchers.js`** - Funciones para obtener preguntas por tema
- **`lawFetchers.js`** - Funciones específicas para preguntas por ley

### Utilidades de Test
- **`testAnswers.js`** - Manejo de guardado de respuestas
- **`testSession.js`** - Gestión de sesiones de test
- **`testTracking.js`** - Sistema de tracking de interacciones

## Funcionalidades Recientes

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

1. **Carga de pregunta** → Muestra opciones A, B, C, D tradicionales
2. **Botones rápidos** → Aparecen botones cuadrados azules A/B/C/D al final
3. **Selección** → Usuario puede usar cualquiera de los dos métodos
4. **Validación** → Sistema previene respuestas duplicadas
5. **Tracking** → Registra interacciones y tiempo de respuesta
6. **Guardado** → Almacena respuesta en Supabase
7. **Resultado** → Muestra explicación y feedback
8. **Navegación** → Botón para siguiente pregunta

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

### Archivos de Configuración
- `.env.local` - Variables de entorno
- `next.config.js` - Configuración de Next.js
- `package.json` - Dependencias y scripts

### Documentación de Base de Datos
- **docs/database/tablas.md:** Documentación detallada de todas las tablas y su estructura
- Para verificar estructura de tablas, consultar `docs/database/tablas.md` antes de hacer queries
- Evita asumir nombres de columnas, siempre verificar con `information_schema.columns` o el README

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