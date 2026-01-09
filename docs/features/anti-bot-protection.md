# Sistema Anti-Bot y Detección de Fraudes

> Implementado: Enero 2026
> Última actualización: 2026-01-09

## Resumen

Sistema de protección contra scrapers y bots que copian preguntas de tests. **Solo afecta a usuarios autenticados** - no bloquea crawlers de SEO (Google, Bing, etc.).

---

## Estado de Implementación

### ✅ Implementado

| Componente | Descripción | Ubicación |
|------------|-------------|-----------|
| **Detección de Bots (BotD)** | Detecta WebDriver, Puppeteer, headless browsers | `hooks/useBotDetection.js` |
| **Análisis de Comportamiento** | Detecta navegación rápida, tiempos mecánicos, alto volumen | `hooks/useBotDetection.js` |
| **Rate Limiting** | 300 requests/hora para rutas de test (usuarios autenticados) | `middleware.js` |
| **API de Reportes** | Endpoint para recibir y almacenar alertas | `app/api/fraud/report/route.js` |
| **Detección Automática** | GitHub Action cada 6h para detectar patrones | `.github/workflows/fraud-detection.yml` |
| **Panel de Admin** | Interfaz para revisar alertas y tomar acciones | `app/admin/fraudes/page.js` |
| **Tabla fraud_alerts** | Almacenamiento de alertas en Supabase | Base de datos |

### ❌ Pendiente de Implementar

| Vulnerabilidad | Descripción | Prioridad | Complejidad |
|----------------|-------------|-----------|-------------|
| **Protección de respuestas** | Actualmente `correct_option` se envía al cliente antes de responder. Un scraper puede interceptar la respuesta JSON y obtener todas las respuestas correctas. | 🔴 Alta | Alta |
| **Honeypot fields** | Campos invisibles en formularios que solo los bots rellenan | 🟡 Media | Baja |
| **Rutas trampa** | URLs falsas (`/api/v2/questions/export`) que solo scrapers intentan acceder | 🟡 Media | Baja |
| **Rate limit por IP** | Adicional al rate limit por sesión, limitar por IP | 🟡 Media | Baja |
| **CAPTCHA tras detección** | Mostrar CAPTCHA cuando se detecta comportamiento sospechoso | 🟡 Media | Media |
| **Ofuscación de `__NEXT_DATA__`** | Next.js expone datos en script tag JSON que scrapers pueden extraer | 🟠 Media | Alta |
| **Watermarking de preguntas** | ID único por usuario para rastrear fugas | 🟢 Baja | Media |

### 📋 Detalle de Vulnerabilidades Pendientes

#### 1. Protección de Respuestas (Crítico)

**Problema actual:**
```javascript
// lib/testFetchers.js - Las preguntas incluyen la respuesta correcta
const { data } = await supabase
  .from('questions')
  .select('id, question, options, correct_option, explanation, ...')
  //                              ^^^^^^^^^^^^^^ ← Visible para scrapers
```

**Riesgo:** Un scraper puede:
1. Interceptar respuestas de red en DevTools
2. Usar la misma API con el anon key (públicamente visible)
3. Obtener pregunta + respuesta correcta sin necesidad de "responder"

**Solución propuesta:**
```
FLUJO ACTUAL:
Cliente ──GET /questions──► Supabase ──► {question, options, correct_option}
                                                              ↑ EXPUESTO

FLUJO SEGURO:
Cliente ──GET /questions──► Supabase ──► {question, options}  ← Sin respuesta
Cliente ──POST /api/answer──► API ──► {isCorrect, correct_option, explanation}
                                       ↑ Solo después de responder
```

**Archivos a modificar:**
- `lib/testFetchers.js` - Excluir `correct_option` del select
- `components/TestLayout.js` - Llamar API para validar
- `components/DynamicTest.js` - Igual
- `app/api/answer/route.js` - **NUEVO** endpoint de validación

**Impacto:** Requiere refactorización significativa pero no rompe la app.

#### 2. Honeypot Fields

**Implementación sugerida:**
```javascript
// En formularios de login/registro
<input
  type="text"
  name="website"
  style={{ position: 'absolute', left: '-9999px' }}
  tabIndex={-1}
  autoComplete="off"
/>

// En el servidor: si website tiene valor → es bot
if (body.website) {
  await reportBot(ip, 'honeypot_triggered')
  return { error: 'Invalid request' }
}
```

#### 3. Rutas Trampa

**Implementación sugerida:**
```javascript
// app/api/v2/questions/export/route.js
export async function GET(request) {
  const ip = getClientIP(request)

  // Registrar intento de scraping
  await supabase.from('fraud_alerts').insert({
    alert_type: 'trap_route_accessed',
    severity: 'high',
    details: { ip, url: '/api/v2/questions/export', userAgent: request.headers.get('user-agent') }
  })

  // Respuesta falsa para confundir
  return Response.json({
    error: 'API v2 deprecated',
    migrate_to: '/api/v3/questions' // Otra trampa
  })
}
```

**Rutas trampa sugeridas:**
- `/api/v2/questions/export`
- `/api/admin/dump`
- `/backup/questions.json`
- `/data/all-answers.csv`

#### 4. Rate Limit por IP

**Estado actual:** Solo por sesión (cookie)
**Mejora:** Añadir también por IP

```javascript
// middleware.js - Añadir
const ipKey = `rate:ip:${ip}`
const { allowed: ipAllowed } = checkRateLimit(ipKey, { maxRequests: 500 })

if (!ipAllowed) {
  return new Response('Too many requests from this IP', { status: 429 })
}
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                        │
├─────────────────────────────────────────────────────────────────┤
│  useBotDetection()          │  useBehaviorAnalysis()            │
│  - Detecta WebDriver        │  - Detecta navegación rápida      │
│  - Detecta headless         │  - Detecta tiempos mecánicos      │
│  - Detecta Puppeteer        │  - Detecta alto volumen           │
│  - Usa BotD (FingerprintJS) │  - Analiza patrones de scraping   │
└──────────────┬──────────────┴────────────────┬──────────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      /api/fraud/report                          │
│  - Recibe alertas de detección                                  │
│  - Calcula severidad (low/medium/high/critical)                 │
│  - Guarda en tabla fraud_alerts                                 │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE                                │
│  Rate Limiting: 300 requests/hora para rutas de test            │
│  Solo usuarios autenticados (cookie de sesión)                  │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Action (cada 6h)                       │
│  - Detecta misma IP en múltiples cuentas                        │
│  - Detecta dispositivos compartidos                             │
│  - Detecta patrones de bot en historial                         │
│  - Detecta cuentas premium compartidas                          │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Hook de Detección de Bots (`hooks/useBotDetection.js`)

#### `useBotDetection(userId)`
Detecta automatización del navegador:

| Señal | Puntos | Descripción |
|-------|--------|-------------|
| `navigator.webdriver` | +50 | Selenium, Puppeteer, Playwright |
| HeadlessChrome en UA | +40 | Navegador headless |
| `window._phantom` | +50 | PhantomJS/Nightmare |
| `__puppeteer_evaluation_script__` | +50 | Puppeteer específico |
| Sin plugins | +15 | Bots no tienen plugins |
| Dimensiones 0x0 | +30 | Ventana invisible |
| Sin idiomas | +15 | `navigator.languages` vacío |
| Chrome sin `window.chrome` | +25 | Headless Chrome |
| BotD detection | +60 | Librería especializada |
| Carga < 100ms | +20 | Sospechosamente rápido |

**Umbral**: Score > 40 = probable bot

#### `useBehaviorAnalysis(userId)`
Detecta patrones de scraping (no respuestas correctas - los bots copian, no responden):

| Patrón | Puntos | Descripción |
|--------|--------|-------------|
| Respuesta < 500ms | +40 | Imposible leer la pregunta |
| Respuesta < 1000ms | +25 | Muy rápido para leer |
| Respuesta < 1500ms | +10 | Algo rápido |
| Varianza < 200ms² | +35 | Tiempos mecánicamente idénticos |
| Varianza < 500ms² | +15 | Poca variación natural |
| Promedio < 1000ms | +30 | No está leyendo |
| Promedio < 2000ms | +15 | Lectura muy rápida |
| > 30 preguntas/min | +50 | Scraping agresivo |
| > 20 preguntas/min | +30 | Muy alto volumen |
| > 15 preguntas/min | +15 | Alto volumen |

**Umbral**: Score acumulado > 100 = reportar

### 2. Rate Limiting (`middleware.js`)

```javascript
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000,  // 1 hora
  maxRequests: 300,          // Máximo 300 requests
  cleanupInterval: 5 * 60 * 1000
}
```

**Rutas protegidas**:
- `/test/*`
- `/test-examen/*`
- `/test-personalizado/*`
- `/test-rapido/*`

**Respuesta cuando se excede**:
```json
{
  "error": "Demasiadas solicitudes",
  "message": "Has realizado muchas preguntas en poco tiempo.",
  "retryAfter": 3600
}
```

### 3. API de Reportes (`app/api/fraud/report/route.js`)

Endpoint POST que recibe:
```javascript
{
  userId: "uuid",
  alertType: "bot_detected" | "suspicious_behavior",
  botScore: number,
  behaviorScore: number,
  evidence: string[],
  userAgent: string,
  screenResolution: string,
  timestamp: string,
  url: string
}
```

Calcula severidad:
- `score >= 100` → `critical`
- `score >= 70` → `high`
- `score >= 40` → `medium`
- `score < 40` → `low`

### 4. GitHub Action (`.github/workflows/fraud-detection.yml`)

Ejecuta cada 6 horas (0:00, 6:00, 12:00, 18:00 UTC):
- Llama a `/api/cron/fraud-detection`
- Requiere `CRON_SECRET` en secrets

Detecta:
- Múltiples cuentas desde misma IP
- Dispositivos compartidos (fingerprint)
- Comportamiento de bot en historial
- Cuentas premium compartidas

### 5. Panel de Admin (`/admin/fraudes`)

#### Pestañas disponibles

| Pestaña | Contenido |
|---------|-----------|
| Alertas | Lista de detecciones con filtros por estado |
| Misma IP | Grupos de usuarios con IP compartida |
| Mismo Dispositivo | Usuarios con mismo fingerprint |
| Sesiones Sospechosas | Patrones anómalos |

#### Estados de alertas

| Estado | Descripción |
|--------|-------------|
| `new` | Alerta nueva, pendiente de revisión |
| `reviewed` | Revisada, sin acción inmediata |
| `dismissed` | Descartada (falso positivo) |
| `action_taken` | Se tomó acción (ej: cuenta bloqueada) |

## Monitoreo Diario

### Checklist de revisión

1. **Acceder a `/admin/fraudes`**
2. **Revisar alertas nuevas** (filtro: `new`)
3. **Priorizar por severidad**:
   - 🔴 Critical → Investigar inmediatamente
   - 🟠 High → Revisar en el día
   - 🟡 Medium → Revisar semanalmente
   - 🟢 Low → Ignorar/batch

### Qué buscar en cada alerta

```
┌─────────────────────────────────────────┐
│ Alerta: bot_detected                    │
├─────────────────────────────────────────┤
│ Score: 85                               │
│ Evidence:                               │
│   - webdriver_detected                  │
│   - no_plugins                          │
│   - chrome_without_chrome_object        │
│                                         │
│ → Decisión: BLOQUEAR (bot confirmado)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Alerta: suspicious_behavior             │
├─────────────────────────────────────────┤
│ Score: 120                              │
│ Evidence:                               │
│   - avgResponseTime: 450ms              │
│   - questionsPerMinute: 25              │
│                                         │
│ → Decisión: INVESTIGAR (muy rápido)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Alerta: same_ip_accounts                │
├─────────────────────────────────────────┤
│ IP: 83.45.xxx.xxx                       │
│ Usuarios: 3                             │
│ Todos FREE                              │
│                                         │
│ → Decisión: DESCARTAR (familia/wifi)    │
└─────────────────────────────────────────┘
```

### Acciones disponibles

| Acción | Cuándo usar |
|--------|-------------|
| **Descartar** | Falso positivo confirmado |
| **Marcar revisado** | Sospechoso pero no concluyente |
| **Bloquear usuario** | Bot/scraper confirmado |
| **Revocar premium** | Cuenta premium compartida |

## Base de Datos

### Tabla: `fraud_alerts`

```sql
CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- low, medium, high, critical
  status TEXT DEFAULT 'new', -- new, reviewed, dismissed, action_taken
  user_ids UUID[],
  details JSONB,
  match_criteria TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  notes TEXT
);
```

### Consultas útiles

```sql
-- Alertas críticas no revisadas
SELECT * FROM fraud_alerts
WHERE severity = 'critical' AND status = 'new'
ORDER BY detected_at DESC;

-- Resumen por tipo de alerta (última semana)
SELECT alert_type, severity, COUNT(*)
FROM fraud_alerts
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY alert_type, severity;

-- Usuarios con múltiples alertas
SELECT unnest(user_ids) as user_id, COUNT(*) as alert_count
FROM fraud_alerts
GROUP BY user_id
HAVING COUNT(*) > 3;
```

## Integración en TestLayout

```javascript
// components/TestLayout.js

import { useBotDetection, useBehaviorAnalysis } from '../hooks/useBotDetection'

// Dentro del componente:
const { isBot, botScore } = useBotDetection(user?.id)
const { suspicionScore, recordAnswer: recordBehavior } = useBehaviorAnalysis(user?.id)

// Al responder una pregunta:
if (user?.id) {
  recordBehavior(responseTimeMs)
}
```

## Limitaciones conocidas

1. **Scrapers sofisticados**: Un atacante con recursos puede usar browsers reales con timing humano
2. **Falsos positivos**: Usuarios muy rápidos pueden triggear alertas
3. **Client-side**: La detección puede ser bypasseada deshabilitando JS (pero no verían las preguntas)

## Mejoras futuras consideradas

| Mejora | Prioridad | Complejidad |
|--------|-----------|-------------|
| Rate limit por IP (adicional a sesión) | Media | Baja |
| CAPTCHA tras detección | Media | Media |
| Honeypot questions | Baja | Baja |
| Watermarking de preguntas | Baja | Media |
| Integración con Cloudflare Bot Management | Baja | Alta |

## Troubleshooting

### Las alertas no se generan
1. Verificar que `useBotDetection` está importado en TestLayout
2. Verificar que el usuario está autenticado (`user?.id` existe)
3. Revisar consola del navegador por errores

### El GitHub Action falla
1. Verificar que `CRON_SECRET` está en GitHub Secrets
2. Verificar que la URL de producción es correcta
3. Revisar logs del Action en GitHub

### Rate limiting no funciona
1. Verificar que el middleware está activo
2. Verificar que la ruta está en la lista de rutas protegidas
3. Revisar headers `X-RateLimit-*` en la respuesta

## Referencias

- [FingerprintJS BotD](https://github.com/nicedoc.io/nicedoc/botd)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- Commit inicial: `1afc7cd3` (2026-01-09)
