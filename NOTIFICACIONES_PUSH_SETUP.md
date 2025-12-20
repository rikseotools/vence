# 🚀 Sistema de Notificaciones Push - ilovetest

Sistema completo de notificaciones push personalizadas para oposiciones, diseñado específicamente para mantener el engagement y la motivación de los usuarios.

## 🎯 Características Principales

### ✨ Mensajes Contextuales para Oposiciones
- **Urgencia real**: "Tu oposición no espera", "Los demás opositores siguen estudiando"
- **Motivación específica**: Mensajes adaptados al contexto de preparación de oposiciones
- **Segmentación inteligente**: Según patrones de estudio, nivel de riesgo y progreso

### 🧠 Sistema Inteligente
- **Análisis de patrones**: Horarios preferidos, días activos, rendimiento
- **Riesgo de abandono**: Detección automática de usuarios en riesgo
- **Personalización**: Mensajes según el perfil motivacional del usuario
- **A/B Testing**: Optimización continua de mensajes

### 📊 Analytics Avanzado
- Tracking completo de efectividad
- Métricas de conversión (notificación → sesión de estudio)
- Análisis de mejores horarios por usuario
- Dashboard de rendimiento del sistema

## 🛠️ Configuración e Instalación

### 1. Instalar Dependencias

```bash
npm install web-push
```

### 2. Generar Claves VAPID

```bash
node scripts/generate-vapid-keys.js
```

### 3. Configurar Variables de Entorno

Añadir al archivo `.env.local`:

```env
# Notificaciones Push - VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tu_clave_publica_vapid
VAPID_PRIVATE_KEY=tu_clave_privada_vapid
VAPID_EMAIL=noreply@ilovetest.com
CRON_SECRET=tu_secret_para_cron_jobs

# Supabase (si no las tienes ya)
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 4. Ejecutar Migración de Base de Datos

```sql
-- Ejecutar en Supabase SQL Editor
\i database/migrations/push_notifications_system.sql
```

### 5. Configurar Cron Job

#### Opción A: Vercel Cron (Recomendado)
```json
{
  "crons": [
    {
      "path": "/api/notifications/send-scheduled",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

#### Opción B: Cron Job Manual
```bash
# Cada 4 horas
0 */4 * * * curl -X POST https://tu-dominio.com/api/notifications/send-scheduled -H "Authorization: Bearer $CRON_SECRET"
```

## 📱 Uso en la Aplicación

### Integración Automática
El sistema se integra automáticamente:
- Se muestra el prompt de permisos a usuarios nuevos
- Análisis automático de patrones de usuario
- Envío inteligente según horarios y comportamiento

### Componentes Principales

1. **PushNotificationManager** - Gestión de permisos y configuración
2. **UserPatternAnalyzer** - Análisis de patrones de comportamiento
3. **oposicionMessages** - Sistema de mensajes contextuales
4. **Service Worker** - Manejo de notificaciones en cliente

## 📋 API Endpoints

### `/api/notifications/send-scheduled` (POST)
Envío programado de notificaciones
- **Auth**: Bearer token con CRON_SECRET
- **Respuesta**: Estadísticas de envío

### `/api/notifications/send-scheduled` (GET)  
Estado del sistema de notificaciones
- **Respuesta**: Estado de configuración y estadísticas

## 🎨 Tipos de Mensajes

### 🚨 Peligro de Racha
```
"🚨 Tu oposición no espera. ¡7 días de racha en peligro!"
"⚠️ Los demás opositores siguen estudiando. ¿Y tú?"
```

### 🌅 Motivación Diaria
```
"☀️ ¡Buenos días, futuro funcionario! Tu plaza matutina te espera"
"🌆 El día laboral termina, tu preparación continúa"
```

### 🔄 Regreso
```
"📢 ¡Tu oposición te extraña! Llevas 3 días sin practicar"
"💪 Volver es de valientes. ¿Estás listo para recuperar tu ritmo?"
```

### 🏆 Logros
```
"🏆 ¡15 días consecutivos! Así se prepara una oposición"
"⭐ Nivel funcionario desbloqueado: 500 preguntas dominadas"
```

### 🆘 Emergencia
```
"🆘 CÓDIGO ROJO: Tu oposición está en peligro crítico"  
"⚠️ ALERTA MÁXIMA: 7 días sin tocar un libro"
```

## 🔧 Configuración Avanzada

### Segmentación de Usuarios
- **Principiantes**: Mensajes de apoyo y gamificación
- **Constantes**: Recordatorios de racha y logros  
- **En Riesgo**: Mensajes urgentes pero no agresivos
- **Inactivos**: Re-engagement progresivo

### Horarios Inteligentes
- Análisis automático de patrones temporales
- Respeto por zonas horarias
- Adaptación a rutinas individuales

### Niveles de Urgencia
1. **Baja**: Motivación estándar diaria
2. **Media**: Recordatorio después de 1 día sin actividad
3. **Alta**: Racha en peligro (2+ días)
4. **Crítica**: Abandono potencial (7+ días)
5. **Emergencia**: Usuarios completamente inactivos

## 📊 Analytics y Métricas

### Métricas Clave
- **Open Rate**: % de notificaciones abiertas
- **Click-through Rate**: % que resultan en sesión
- **Retention Impact**: Efecto en retención de usuarios
- **Conversion Rate**: Notificación → estudio efectivo

### Dashboards Disponibles
- Rendimiento por tipo de mensaje
- Efectividad por segmento de usuario
- Análisis temporal de engagement
- A/B testing de variantes

## 🚀 Próximas Mejoras

### Fase 2: ML y Personalización
- Predicción de abandonos con Machine Learning
- Optimización automática de mensajes
- Personalización basada en psicología del usuario

### Fase 3: Multi-canal
- Integración con email y WhatsApp
- Notificaciones in-app complementarias
- Sistema de recompensas gamificado

## 🛡️ Consideraciones de Privacidad

- Datos almacenados: solo patrones de uso anónimos
- Cumplimiento GDPR: consentimiento explícito
- Opt-out fácil: desactivación en un click
- Transparencia: dashboard de datos del usuario

## 🔍 Debugging y Monitoreo

### Logs Importantes
```javascript
console.log('📢 Push notification recibida')
console.log('👆 Click en notificación')  
console.log('📊 Tracking: notification_clicked')
```

### Verificar Estado
```bash
curl https://tu-dominio.com/api/notifications/send-scheduled
```

### Troubleshooting Común
1. **VAPID keys no válidas**: Regenerar con el script
2. **Service Worker no registra**: Verificar HTTPS
3. **Notificaciones no llegan**: Revisar suscripción en BD
4. **Cron job falla**: Verificar CRON_SECRET

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs del navegador (F12 → Console)
2. Verificar configuración de variables de entorno
3. Comprobar estado de la base de datos
4. Revisar analytics de notificaciones

---

**¡Tu sistema de notificaciones push está listo para mantener a los opositores motivados y constantes! 🎯📚**