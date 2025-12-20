# 📊 Sistema Dual de Usuarios - iLoveTest

## 🎯 OBJETIVO GENERAL

Implementar un sistema que permita **dos flujos de usuario diferentes** para maximizar tanto el crecimiento orgánico como los ingresos mediante campañas de Google Ads dirigidas.

## 🔄 FLUJOS IMPLEMENTADOS

### 🆓 FLUJO ORGÁNICO (Usuarios Web)
```
Usuario web → Registro Google → Acceso GRATIS completo → Conversión futura opcional
```
- **Fuente:** Tráfico orgánico, SEO, referencias, usuarios existentes
- **Experiencia:** Sin restricciones, acceso inmediato a todos los tests
- **Objetivo:** Crecimiento de base de usuarios, engagement, testimonials
- **Monetización:** Conversión orgánica a premium en el futuro

### 💰 FLUJO GOOGLE ADS (Usuarios de Pago)
```
Google Ads → Landing Premium → Registro Google → PAYWALL OBLIGATORIO → Acceso tras pago
```
- **Fuente:** Campañas de Google Ads (2 variantes de landing)
- **Experiencia:** Debe pagar para acceder a cualquier funcionalidad
- **Objetivo:** Validar willingness to pay, generar ingresos inmediatos
- **Monetización:** Conversión directa desde el primer contacto

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### Tabla Principal: `user_profiles`

| Campo | Tipo | Propósito | Valores Posibles |
|-------|------|-----------|------------------|
| `id` | UUID | ID único (FK a auth.users) | - |
| `email` | TEXT | Email del usuario | - |
| `full_name` | TEXT | Nombre completo | - |
| `plan_type` | TEXT | **Tipo de plan actual** | `legacy_free`, `free`, `premium_required`, `trial`, `premium` |
| `registration_source` | TEXT | **📍 NUEVO: Fuente de registro** | `organic`, `google_ads`, `legacy` |
| `requires_payment` | BOOLEAN | **💰 NUEVO: Si requiere pago para acceder** | `true`, `false` |
| `stripe_customer_id` | TEXT | ID del customer en Stripe | - |
| `created_at` | TIMESTAMP | Fecha de registro | - |
| `updated_at` | TIMESTAMP | Última actualización | - |

### Tabla Secundaria: `user_subscriptions`

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `id` | UUID | ID único de la suscripción |
| `user_id` | UUID | FK a user_profiles.id |
| `stripe_customer_id` | TEXT | ID del customer en Stripe |
| `stripe_subscription_id` | TEXT | ID de la suscripción en Stripe |
| `status` | TEXT | Estado de la suscripción |
| `plan_type` | TEXT | Tipo de plan (premium_semester) |
| `trial_start` | TIMESTAMP | Inicio del trial |
| `trial_end` | TIMESTAMP | Final del trial |
| `current_period_start` | TIMESTAMP | Inicio del periodo actual |
| `current_period_end` | TIMESTAMP | Final del periodo actual |
| `cancel_at_period_end` | BOOLEAN | Si se cancela al final del periodo |

---

## 🏷️ TIPOS DE USUARIO

| Tipo | `plan_type` | `registration_source` | `requires_payment` | Acceso | Descripción |
|------|-------------|----------------------|-------------------|---------|-------------|
| **Legacy** | `legacy_free` | `organic` | `false` | ✅ Completo gratis | Usuarios anteriores al sistema dual |
| **Orgánico** | `free` | `organic` | `false` | ✅ Completo gratis | Nuevos usuarios de web normal |
| **Google Ads** | `premium_required` | `google_ads` | `true` | ❌ Requiere pago | Usuarios de campañas de pago |
| **Trial** | `trial` | `organic/google_ads` | `false` | ✅ Acceso premium | Usuarios en periodo de prueba |
| **Premium** | `premium` | `organic/google_ads` | `false` | ✅ Acceso premium | Usuarios con suscripción activa |

---

## 🔧 FUNCIONES SQL IMPLEMENTADAS

### 1. `check_user_access(user_id UUID)`
**Propósito:** Determina si un usuario puede acceder a los tests o debe pagar.

**Retorna:**
```sql
{
  can_access: BOOLEAN,
  user_type: TEXT,
  message: TEXT
}
```

**Lógica:**
- `legacy_free` → ✅ Acceso siempre
- `premium`, `trial` → ✅ Acceso completo
- `organic` + `requires_payment=false` → ✅ Acceso gratis
- `google_ads` + `requires_payment=true` → ❌ Paywall

### 2. `create_organic_user(user_id, user_email, user_name)`
**Propósito:** Crear usuario orgánico con acceso gratuito.

**Configuración:**
- `registration_source = 'organic'`
- `requires_payment = FALSE`
- `plan_type = 'free'`

### 3. `create_google_ads_user(user_id, user_email, user_name, campaign_id)`
**Propósito:** Crear usuario de Google Ads que requiere pago.

**Configuración:**
- `registration_source = 'google_ads'`
- `requires_payment = TRUE`
- `plan_type = 'premium_required'`

### 4. `activate_premium_user(user_id, stripe_customer_id)`
**Propósito:** Activar premium después del pago exitoso.

**Cambios:**
- `plan_type = 'trial'` (luego cambia a 'premium')
- `stripe_customer_id = [valor]`
- `requires_payment = FALSE`

---

## 🎨 LANDING PAGES IMPLEMENTADAS

### 🔥 Landing Agresiva (`/es/premium-ads`)
**Target:** Usuarios impulsivos, buscan solución rápida
**Estilo:** 
- Colores: Rojos, naranjas (urgencia)
- Copy: "¡APRUEBA YA!", "ÚLTIMA OPORTUNIDAD", "Solo 100 plazas"
- Elementos: Testimonials prominentes, countdown, garantías
- CTA: "🚀 QUIERO APROBAR EN 2025"

### 🎓 Landing Educativa (`/es/premium-edu`)
**Target:** Usuarios racionales, quieren entender el producto
**Estilo:**
- Colores: Azules, blancos (confianza)
- Copy: "Metodología científica", "Resultados comprobados"
- Elementos: Tabs informativos, demo interactivo, análisis científico
- CTA: "🚀 Comenzar prueba gratuita"

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### AuthContext Actualizado
**Nuevas funcionalidades:**
```javascript
const {
  user,              // Usuario de Supabase Auth
  userProfile,       // Perfil completo con plan_type, etc.
  isPremium,         // Boolean: tiene acceso premium
  isLegacy,          // Boolean: usuario legacy
  requiresPayment,   // Boolean: debe pagar para acceder
  registrationSource, // 'organic' | 'google_ads' | 'legacy'
  checkAccess,       // Función para verificar acceso
  activatePremium    // Función para activar tras pago
} = useAuth()
```

### Detección Automática de Fuente
**Criterios de detección:**
1. **URL Path**: `/premium-ads`, `/premium-edu` → Google Ads
2. **UTM Parameters**: `utm_source=google&utm_medium=cpc` → Google Ads  
3. **Campaign Parameter**: `campaign=ads-*` → Google Ads
4. **localStorage**: Return URL contiene premium-ads → Google Ads
5. **Default**: Todo lo demás → Orgánico

### Flujo de Registro Automático
```javascript
// Detección automática al hacer login
const registrationSource = detectRegistrationSource()

if (registrationSource === 'google_ads') {
  await supabase.rpc('create_google_ads_user', {...})
} else {
  await supabase.rpc('create_organic_user', {...})
}
```

### URLs de Campaña
```
Campaña Agresiva:
https://ilovetest.com/es/premium-ads?campaign=aggressive&utm_source=google&utm_medium=cpc

Campaña Educativa:  
https://ilovetest.com/es/premium-edu?campaign=educational&utm_source=google&utm_medium=cpc
```

---

## 📊 ANALYTICS Y MÉTRICAS

### KPIs por Fuente
```sql
-- Conversión por fuente de registro
SELECT 
    registration_source,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN stripe_customer_id IS NOT NULL THEN 1 END) as conversiones,
    ROUND(
        COUNT(CASE WHEN stripe_customer_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as conversion_rate_percent
FROM user_profiles 
WHERE registration_source != 'legacy'
GROUP BY registration_source;
```

### Revenue por Fuente
```sql
-- Ingresos estimados por fuente
SELECT 
    up.registration_source,
    COUNT(us.id) as suscripciones_activas,
    COUNT(us.id) * 59 as revenue_estimado_euros
FROM user_profiles up
LEFT JOIN user_subscriptions us ON up.id = us.user_id AND us.status = 'active'
GROUP BY up.registration_source;
```

### Usuarios Activos por Tipo
```sql
-- Distribución actual de usuarios
SELECT 
    plan_type,
    registration_source,
    requires_payment,
    COUNT(*) as usuarios_count
FROM user_profiles 
GROUP BY plan_type, registration_source, requires_payment
ORDER BY usuarios_count DESC;
```

---

## 🧪 EXPERIMENTO A/B EN CURSO

### Hipótesis Central
> "Los usuarios que llegan con intención de pago (Google Ads) convertirán mejor con paywall inmediato que con freemium tradicional"

### Variables de Testing
- **Landing A (Agresiva)** vs **Landing B (Educativa)**
- **Messaging**: Urgencia vs Educativo
- **Audiencias**: Broad vs Específicas
- **Copy**: Emocional vs Racional

### Métricas a Optimizar
1. **CTR** (Click-through Rate) en Google Ads
2. **Conversion Rate** (Registro → Pago)
3. **CAC** (Customer Acquisition Cost)
4. **LTV** (Customer Lifetime Value)
5. **ROAS** (Return on Ad Spend)

---

## 🛡️ COMPONENTES DE PROTECCIÓN

### PaywallGuard (Próximo)
Componente que verificará acceso antes de mostrar contenido:
```javascript
// Uso previsto
<PaywallGuard>
  <TestsPage />
</PaywallGuard>
```

### withPremium HOC (Implementado)
HOC para proteger páginas completas:
```javascript
export default withPremium(TestsPage)
```

---

## 🚀 ROADMAP DE IMPLEMENTACIÓN

### ✅ FASE 1 COMPLETADA
- [x] Diseño de arquitectura de BD
- [x] Funciones SQL para tipos de usuario
- [x] AuthContext con detección automática
- [x] Landing pages A y B
- [x] Sistema de tracking de fuentes

### 🔄 FASE 2 EN CURSO
- [ ] Componente PaywallGuard
- [ ] Integración con Stripe webhook
- [ ] Testing completo del flujo

### 📋 FASE 3 PENDIENTE
- [ ] Dashboard de analytics en tiempo real
- [ ] Email marketing para conversión
- [ ] Optimización basada en datos
- [ ] Escalado de campañas rentables

---

## ⚡ COMANDOS ÚTILES PARA TESTING

### Verificar Estado Actual
```sql
-- Ver distribución de usuarios
SELECT 
    registration_source,
    plan_type,
    requires_payment,
    COUNT(*) as count
FROM user_profiles 
GROUP BY registration_source, plan_type, requires_payment;
```

### Simular Usuario Google Ads
```sql
-- Convertir usuario a Google Ads temporalmente
UPDATE user_profiles 
SET 
    registration_source = 'google_ads',
    requires_payment = TRUE,
    plan_type = 'premium_required'
WHERE email = 'test@example.com';
```

### Verificar Acceso
```sql
-- Probar función de acceso
SELECT * FROM check_user_access('user-id-here');
```

---

## 🔒 CONSIDERACIONES DE SEGURIDAD

- ✅ **RLS (Row Level Security)** en todas las tablas
- ✅ **Validación de entrada** en todas las funciones SQL
- ✅ **Verificación de ownership** en operaciones de usuario
- ✅ **Sanitización** de parámetros de campaña
- ✅ **Rate limiting** en funciones críticas

---

## 📞 SOPORTE Y DEBUGGING

### Logs Importantes
```javascript
// En navegador, verificar:
console.log('Registration Source:', detectRegistrationSource())
console.log('User Profile:', userProfile)
console.log('Access Check:', await checkAccess())
```

### Variables de Entorno Requeridas
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret
```

---

**Este sistema permite experimentar con monetización directa mientras se mantiene el crecimiento orgánico intacto, proporcionando flexibilidad máxima para optimizar ambos flujos según los datos recopilados.**