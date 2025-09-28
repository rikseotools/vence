# 🔔 README - Sistema de Notificaciones Push

## 📋 **ÍNDICE**
- [🎯 Introducción](#-introducción)
- [🏗️ Arquitectura del Sistema](#️-arquitectura-del-sistema)
- [📊 Estructura de Base de Datos](#-estructura-de-base-de-datos)
- [🚀 Configuración e Instalación](#-configuración-e-instalación)
- [📱 Componentes Frontend](#-componentes-frontend)
- [🧠 Sistema Inteligente](#-sistema-inteligente)
- [📧 Tipos de Mensajes](#-tipos-de-mensajes)
- [🔧 API Endpoints](#-api-endpoints)
- [📊 Analytics y Métricas](#-analytics-y-métricas)
- [🛡️ Seguridad y Privacidad](#️-seguridad-y-privacidad)
- [🔍 Debugging y Monitoreo](#-debugging-y-monitoreo)

---

## 🎯 **Introducción**

Sistema completo de notificaciones push diseñado específicamente para **aplicaciones de oposiciones**. El sistema utiliza **mensajes contextuales motivacionales** que aprovechan la urgencia y determinación inherente en la preparación de oposiciones públicas.

### ✨ **Características Principales**
- **Mensajes específicos para oposiciones**: "Tu oposición no espera", "Los demás opositores siguen estudiando"
- **Análisis de patrones inteligente**: Horarios, rachas, rendimiento, riesgo de abandono
- **Personalización automática**: Según comportamiento y progreso del usuario
- **A/B Testing integrado**: Optimización continua de mensajes
- **Analytics avanzados**: Tracking completo de efectividad

---

## 🏗️ **Arquitectura del Sistema**

```
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA DE NOTIFICACIONES PUSH            │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React/Next.js)                                   │
│  ├── PushNotificationManager.js     - Gestión de permisos  │
│  ├── Service Worker (sw.js)         - Manejo de notifs     │
│  └── Hooks personalizados           - Estados y lógica     │
├─────────────────────────────────────────────────────────────┤
│  Backend Intelligence                                       │
│  ├── UserPatternAnalyzer.js         - Análisis de patrones │
│  ├── oposicionMessages.js           - Sistema de mensajes  │
│  └── API Routes                     - Endpoints de envío   │
├─────────────────────────────────────────────────────────────┤
│  Base de Datos (Supabase)                                  │
│  ├── user_notification_settings     - Configuración user   │
│  ├── user_activity_patterns         - Patrones de uso      │
│  ├── notification_templates         - Templates mensajes   │
│  ├── notification_logs              - Historial completo   │
│  ├── notification_metrics           - Analytics agregados  │
│  └── user_smart_scheduling          - Programación intelig │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├── Web Push Protocol              - Envío de notifs      │
│  ├── VAPID Keys                     - Autenticación segura │
│  └── Cron Jobs                      - Envío programado     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **Estructura de Base de Datos**

### 🔧 **TABLA: `user_notification_settings`**
Configuración de notificaciones por usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | uuid | FK a auth.users(id) |
| `push_enabled` | boolean | Si tiene notificaciones activas |
| `push_subscription` | jsonb | Objeto de suscripción del navegador |
| `preferred_times` | jsonb | Horarios preferidos ["09:00", "14:00", "20:00"] |
| `timezone` | text | Zona horaria del usuario |
| `frequency` | text | 'daily', 'smart', 'minimal', 'off' |
| `oposicion_type` | text | Tipo de oposición que prepara |
| `exam_date` | date | Fecha estimada del examen |
| `motivation_level` | text | 'low', 'medium', 'high', 'extreme' |

### 📈 **TABLA: `user_activity_patterns`**
Patrones de actividad analizados automáticamente.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | uuid | FK a auth.users(id) |
| `preferred_hours` | integer[] | Horas preferidas de estudio |
| `active_days` | integer[] | Días activos (1=lunes, 7=domingo) |
| `avg_session_duration` | integer | Duración promedio de sesión (min) |
| `peak_performance_time` | time | Hora de mejor rendimiento |
| `streak_pattern` | text | 'morning_focused', 'evening_focused', etc. |

### 📝 **TABLA: `notification_templates`**
Templates de mensajes con contexto de oposición.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `category` | text | 'streak_danger', 'daily_motivation', 'comeback', etc. |
| `subcategory` | text | 'urgent', 'motivational', 'morning', etc. |
| `message_variants` | jsonb | Array de variantes del mensaje |
| `target_conditions` | jsonb | Condiciones para usar este template |
| `urgency_level` | integer | Nivel de urgencia (1-5) |
| `success_metrics` | jsonb | Métricas de rendimiento del template |

### 📊 **TABLA: `notification_logs`**
Historial completo de notificaciones enviadas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | uuid | Usuario destinatario |
| `template_id` | uuid | Template utilizado |
| `message_sent` | text | Mensaje final enviado |
| `delivery_status` | text | 'sent', 'delivered', 'failed', 'clicked' |
| `opened_at` | timestamp | Cuándo se abrió la notificación |
| `clicked_at` | timestamp | Cuándo se hizo click |
| `resulted_in_session` | boolean | Si resultó en sesión de estudio |
| `context_data` | jsonb | Datos del contexto al enviar |

### ⏰ **TABLA: `user_smart_scheduling`**
Programación inteligente por usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | uuid | Usuario |
| `next_notification_time` | timestamp | Próxima notificación programada |
| `notification_frequency_hours` | integer | Frecuencia en horas |
| `streak_status` | integer | Días de racha actual |
| `risk_level` | text | 'low', 'medium', 'high', 'critical' |
| `pause_until` | timestamp | Pausar notificaciones hasta fecha |

### 📈 **TABLA: `notification_metrics`**
Métricas agregadas para optimización.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `template_id` | uuid | Template analizado |
| `user_segment` | text | Segmento de usuario |
| `total_sent` | integer | Total enviadas |
| `total_opened` | integer | Total abiertas |
| `total_clicked` | integer | Total con click |
| `total_sessions_generated` | integer | Sesiones generadas |
| `conversion_rate` | decimal | Ratio conversión |

---

## 🚀 **Configuración e Instalación**

### 1. **Instalar Dependencias**
```bash
npm install web-push
```

### 2. **Generar Claves VAPID**
```bash
node scripts/generate-vapid-keys.js
```

### 3. **Variables de Entorno en Vercel**
Ve a **Vercel Dashboard** → **Settings** → **Environment Variables**:

```env
# Notificaciones Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBWUpw3CN4Bf6LgyTAAvXL9F-nwTW9jX9K_UUtkEBVtBMi50WEzX3UhhTXN_YaodLsfYVPf8aZoQaVadJJ_-lqM
VAPID_PRIVATE_KEY=cmA5NhECAQzRMzn5EQVEGwv8_MYdoiSmp2Gl_5IAfME
VAPID_EMAIL=noreply@ilovetest.com
CRON_SECRET=73452212c8d282d577073db8669a601a8d495cd935ee082d2ab91f0a839099e5

# Supabase (si no las tienes ya)
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 4. **Migración de Base de Datos**
Ejecutar en **Supabase SQL Editor**:
```sql
-- Ejecutar todo el contenido de:
-- database/migrations/push_notifications_system.sql

-- Si hay error de constraints, ejecutar:
ALTER TABLE user_notification_settings 
ADD CONSTRAINT user_notification_settings_user_id_unique UNIQUE (user_id);

ALTER TABLE user_smart_scheduling 
ADD CONSTRAINT user_smart_scheduling_user_id_unique UNIQUE (user_id);
```

### 5. **Configurar GitHub Actions (Recomendado)**
El archivo `.github/workflows/push-notifications.yml` ya está configurado.

**Configurar GitHub Secret:**
1. **GitHub** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**: `CRON_SECRET` = `73452212c8d282d577073db8669a601a8d495cd935ee082d2ab91f0a839099e5`

**Schedule automático**: Cada 4 horas (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)

### 6. **Verificar Instalación**
```bash
# Test manual del endpoint
curl -X POST https://www.ilovetest.pro/api/notifications/send-scheduled \
  -H "Authorization: Bearer 73452212c8d282d577073db8669a601a8d495cd935ee082d2ab91f0a839099e5"

# Respuesta esperada:
# {"success":true,"message":"No users to notify","processed":0}
```

---

## 📱 **Componentes Frontend**

### 🔧 **PushNotificationManager.js**
Componente principal que gestiona permisos y configuración.

**Funcionalidades:**
- Solicita permisos de notificaciones con UI atractiva
- Registra Service Worker automáticamente
- Guarda configuración en Supabase
- Maneja estados de error y loading

**Estados:**
- `permission`: 'default', 'granted', 'denied'
- `supported`: boolean - Si el navegador soporta push
- `showPrompt`: boolean - Si mostrar el prompt
- `settings`: objeto - Configuración guardada

### 🔄 **Service Worker (sw.js)**
Maneja las notificaciones en el cliente.

**Eventos manejados:**
- `push`: Recibe y muestra notificaciones
- `notificationclick`: Maneja clicks y acciones
- `notificationclose`: Tracking de cierres

**Personalizaciones:**
- Iconos según hora del día
- Acciones específicas por categoría
- Tracking automático de interacciones

---

## 🧠 **Sistema Inteligente**

### 📊 **UserPatternAnalyzer.js**
Analiza patrones de comportamiento para personalización.

#### **Análisis de Patrones Temporales**
```javascript
analyzeTimePatterns() {
  // Analiza últimas 30 días
  // Identifica horarios preferidos
  // Determina días más activos
  // Calcula duración promedio de sesión
  // Clasifica patrón: morning/afternoon/evening_focused
}
```

#### **Análisis de Rachas**
```javascript
analyzeStreakPatterns() {
  // Calcula racha actual
  // Identifica racha máxima
  // Evalúa estabilidad de rachas
  // Predice riesgo de ruptura
}
```

#### **Análisis de Rendimiento**
```javascript
analyzePerformancePatterns() {
  // Accuracy general y por tema
  // Tiempo promedio de respuesta
  // Identificación de áreas débiles/fuertes
  // Tendencia de mejora
}
```

#### **Evaluación de Riesgo**
```javascript
assessRiskLevel() {
  // Días sin actividad
  // Rendimiento reciente
  // Consistencia histórica
  // Clasificación: low/medium/high/critical
}
```

### 🎯 **Sistema de Mensajes Contextuales**

#### **Categorías de Mensajes:**

**🚨 Peligro de Racha**
```javascript
"🚨 Tu oposición no espera. ¡7 días de racha en peligro!"
"⚠️ Los demás opositores siguen estudiando. ¿Y tú?"
"🔥 7 días consecutivos... ¡No los pierdas ahora que estás tan cerca!"
```

**☀️ Motivación Diaria**
```javascript
// Mañana
"☀️ ¡Buenos días, futuro funcionario! Tu plaza matutina te espera"
// Tarde  
"🕐 Pausa del trabajo = Momento perfecto para tu oposición"
// Noche
"🌆 El día laboral termina, tu preparación continúa"
```

**🔄 Regreso después de Inactividad**
```javascript
// 1-2 días
"👋 ¡Te echábamos de menos! Tu oposición te esperaba"
// 3-5 días
"📢 ¡Tu oposición te extraña! Llevas 3 días sin practicar"
// 6+ días
"🚨 ALERTA MÁXIMA: 7 días sin estudiar"
```

**🏆 Logros y Celebraciones**
```javascript
"🏆 ¡15 días consecutivos! Así se prepara una oposición"
"⭐ Nivel funcionario desbloqueado: 500 preguntas dominadas"
"🎯 ¡Imparable! Tu dedicación marca la diferencia"
```

**🆘 Emergencia (Usuarios muy inactivos)**
```javascript
"🆘 CÓDIGO ROJO: Tu oposición está en peligro crítico"
"⚠️ ALERTA MÁXIMA: 7 días sin tocar un libro"
"💔 Tu sueño funcionario está agonizando. ¿Lo salvas?"
```

---

## 📧 **Tipos de Mensajes**

### 🎯 **Selección Inteligente de Mensajes**

El sistema selecciona automáticamente el tipo de mensaje según:

```javascript
determineNotificationType(user, patterns) {
  const hoursSinceLastSession = user.hours_since_last_session
  const riskLevel = user.risk_level
  const currentStreak = user.streak_status

  // Casos de emergencia
  if (riskLevel === 'critical' || hoursSinceLastSession >= 168) {
    return 'emergency_motivation'
  }

  // Peligro de racha
  if (currentStreak >= 5 && hoursSinceLastSession >= 24) {
    return 'streak_danger'
  }

  // Regreso después de inactividad
  if (hoursSinceLastSession >= 48) {
    return 'comeback'
  }

  // Motivación diaria estándar
  return 'daily_motivation'
}
```

### 📊 **Personalización por Contexto**

```javascript
buildMessageContext(user, patterns) {
  return {
    streak: user.streak_status,
    daysInactive: Math.floor(user.hours_since_last_session / 24),
    weakTopic: patterns.performancePatterns?.weakAreas?.[0],
    strongTopic: patterns.performancePatterns?.strongAreas?.[0],
    daysUntilExam: calculateDaysUntilExam(user.exam_date),
    timeOfDay: getCurrentTimeOfDay(),
    motivationLevel: user.motivation_level
  }
}
```

---

## 🔧 **API Endpoints**

### 📤 **POST `/api/notifications/send-scheduled`**
Endpoint principal para envío programado de notificaciones.

**Autenticación:** Bearer token con `CRON_SECRET`

**Flujo:**
1. Obtiene usuarios que necesitan notificación
2. Analiza patrones de cada usuario
3. Determina tipo de mensaje apropiado
4. Genera mensaje personalizado
5. Envía notificación push
6. Registra en logs
7. Actualiza próxima notificación

**Respuesta:**
```json
{
  "success": true,
  "results": {
    "sent": 45,
    "failed": 2,
    "skipped": 8,
    "errors": []
  }
}
```

### 📊 **GET `/api/notifications/send-scheduled`**
Estado del sistema de notificaciones.

**Respuesta:**
```json
{
  "status": "ok",
  "configuration": {
    "vapid_configured": true,
    "supabase_connected": true
  },
  "stats": {
    "users_with_notifications": 1250,
    "pending_notifications": 89
  }
}
```

---

## 📊 **Analytics y Métricas**

### 🎯 **Métricas Clave Tracked**

**📈 Efectividad de Mensajes:**
- **Open Rate**: % de notificaciones abiertas
- **Click-through Rate**: % que resultan en sesión
- **Conversion Rate**: % que generan actividad de estudio
- **Session Quality**: Duración y preguntas contestadas

**👥 Segmentación de Usuarios:**
- **Principiantes**: Usuarios nuevos (< 1 mes)
- **Constantes**: Rachas largas y consistentes
- **En Riesgo**: Patrones de inactividad creciente
- **Inactivos**: Sin actividad > 7 días

**⏰ Análisis Temporal:**
- **Mejores horarios**: Por tipo de usuario
- **Días más efectivos**: Lunes vs fin de semana
- **Estacionalidad**: Variaciones por época del año

### 📊 **Dashboard de Analytics**

```sql
-- Query ejemplo para métricas de efectividad
SELECT 
  nt.category,
  COUNT(*) as total_sent,
  COUNT(nl.opened_at) as total_opened,
  COUNT(nl.clicked_at) as total_clicked,
  COUNT(CASE WHEN nl.resulted_in_session THEN 1 END) as sessions_generated,
  ROUND(
    COUNT(nl.clicked_at)::numeric / COUNT(*)::numeric * 100, 2
  ) as click_rate,
  ROUND(
    COUNT(CASE WHEN nl.resulted_in_session THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 2
  ) as conversion_rate
FROM notification_logs nl
JOIN notification_templates nt ON nl.template_id = nt.id
WHERE nl.sent_at > NOW() - INTERVAL '7 days'
GROUP BY nt.category
ORDER BY conversion_rate DESC;
```

---

## 🛡️ **Seguridad y Privacidad**

### 🔐 **Medidas de Seguridad**

**🔑 VAPID Keys:**
- Claves públicas/privadas para autenticación
- Rotación recomendada cada 6 meses
- Almacenamiento seguro de claves privadas

**🛡️ Autorización:**
- Endpoint protegido con `CRON_SECRET`
- Validación de origen en Service Worker
- Rate limiting automático

**📊 Datos Almacenados:**
- Solo patrones de uso anónimos
- No contenido personal sensible
- Limpieza automática de logs antiguos

### 🌍 **Cumplimiento GDPR**

**✅ Consentimiento:**
- Solicitud explícita de permisos
- Opt-in voluntario con explicación clara
- Opt-out fácil en cualquier momento

**🗑️ Derecho al Olvido:**
- Eliminación automática de datos al desactivar
- Cleanup de logs antiguos (> 1 año)
- Anonimización de métricas agregadas

**🔍 Transparencia:**
- Dashboard de datos del usuario
- Explicación clara de qué datos se recopilan
- Acceso a historial de notificaciones

---

## 🔍 **Debugging y Monitoreo**

### 🔧 **Logs de Debug**

**Frontend (Consola del navegador):**
```javascript
// Componente PushNotificationManager
🔔 PushNotificationManager rendered - User: true Supabase: true
🔔 Render decision: {showPrompt: false, supported: true, hasUser: true, permission: 'granted', settings: true}
🔔 Support check: {supported: true, permission: "granted"}

// Service Worker
🔧 Service Worker instalado
⚡ Service Worker activado
📢 Push notification recibida
👆 Click en notificación: study_urgent
📊 Tracking: notification_clicked
```

**Backend (GitHub Actions logs):**
```javascript
🚀 Iniciando envío programado de notificaciones...
⏰ Timestamp: Sun Aug  3 22:54:10 UTC 2025
📊 HTTP Status: 200
📄 Response: {"success":true,"message":"No users to notify","processed":0}
✅ Notificaciones enviadas exitosamente
```

**Backend (Server logs en Vercel):**
```javascript
📢 Procesando 1 usuarios para notificación
✅ Notificación enviada a usuario b9ebbad0-...: streak_danger
✅ Proceso completado: 1 enviadas, 0 fallidas
```

### 🔍 **Comandos de Verificación**

**Estado del sistema:**
```bash
curl https://www.ilovetest.pro/api/notifications/send-scheduled
```

**Verificar soporte en navegador:**
```javascript
console.log('Soporte completo:', {
  https: location.protocol === 'https:',
  notifications: 'Notification' in window,
  serviceWorker: 'serviceWorker' in navigator,
  pushManager: 'PushManager' in window,
  permission: Notification.permission
})
```

**Forzar reset (testing):**
```javascript
// En DevTools → Application → Storage
localStorage.clear()
// O específico para notificaciones
localStorage.removeItem('notification_settings')
```

### ⚠️ **Troubleshooting Común**

**Problema:** Notificaciones no aparecen
- ✅ Verificar HTTPS habilitado (✅ **ilovetest.pro**)
- ✅ Comprobar permisos del navegador (✅ **Configurado**)
- ✅ Revisar VAPID keys en variables de entorno (✅ **Configurado**)
- ✅ Verificar Service Worker registrado (✅ **Funcionando**)

**Problema:** Service Worker no se registra
- ✅ Verificar archivo `public/sw.js` existe (✅ **Creado**)
- ✅ Comprobar sintaxis JavaScript válida (✅ **OK**)
- ✅ Revisar DevTools → Application → Service Workers (✅ **Activo**)

**Problema:** GitHub Actions falla
- ✅ Verificar `CRON_SECRET` en GitHub Secrets (✅ **Configurado**)
- ✅ Verificar `CRON_SECRET` en Vercel Environment Variables (✅ **Configurado**)
- ✅ Comprobar endpoint accesible: `https://www.ilovetest.pro/api/notifications/send-scheduled` (✅ **200 OK**)

**Problema:** Usuarios no reciben notificaciones
- ✅ Verificar suscripciones válidas en BD (✅ **Usuario configurado**)
- ✅ Comprobar `user_smart_scheduling.next_notification_time`
- ✅ Revisar `notification_logs` para errores
- ⏰ **Nota**: Las notificaciones solo se envían cuando es apropiado (24h+ sin actividad, racha en peligro, etc.)

---

## 📚 **Recursos Adicionales**

### 📖 **Documentación de Referencia**
- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [VAPID Specification](https://tools.ietf.org/html/rfc8292)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

### 🔗 **Enlaces Útiles**
- [Generador de VAPID Keys Online](https://vapidkeys.com/)
- [Tester de Notificaciones Push](https://tests.peter.sh/notification-generator/)
- [Can I Use - Push API](https://caniuse.com/push-api)

### 📧 **Soporte**
Para dudas técnicas o problemas de implementación, revisar:
1. Logs del navegador (F12 → Console)
2. Estado del endpoint `/api/notifications/send-scheduled`
3. Configuración de variables de entorno
4. Tablas de base de datos y migraciones

---

## 🎉 **Estado del Sistema - COMPLETAMENTE OPERATIVO**

### ✅ **Sistema 100% Funcional:**
- **Frontend**: Prompt de notificaciones funcionando
- **Base de datos**: 6 tablas creadas con constraints correctos  
- **API**: Endpoint `/api/notifications/send-scheduled` respondiendo (HTTP 200)
- **Autenticación**: VAPID keys y CRON_SECRET configurados
- **GitHub Actions**: Workflow ejecutándose cada 4 horas automáticamente
- **Usuario configurado**: Notificaciones habilitadas en BD

### 📊 **Métricas de Configuración:**
- **Usuario ID**: `b9ebbad0-cb6d-4dc3-87fc-a32a31611256`
- **Notificaciones**: `push_enabled: true`
- **Suscripción**: `has_subscription: true`
- **Horarios preferidos**: `["09:00","14:00","20:00"]`
- **Última configuración**: `2025-08-03 22:11:09`

### 🔄 **Próximas Ejecuciones Automáticas:**
GitHub Actions se ejecutará automáticamente:
- **Cada 4 horas**: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- **Hora España**: 01:00, 05:00, 09:00, 13:00, 17:00, 21:00 (horario de verano)

### 🔔 **Cuándo Llegará la Primera Notificación:**
El sistema enviará notificaciones cuando detecte:
- ⏰ **24+ horas sin actividad** en la app
- 🔥 **Racha en peligro** (si tienes una racha activa > 5 días)
- 📊 **Horarios óptimos** según tus patrones de uso
- ⚠️ **Riesgo de abandono** basado en comportamiento

---

**🎯 ¡Tu sistema de notificaciones push está completamente operativo y listo para mantener a los opositores motivados hacia su plaza! 🏆📚**