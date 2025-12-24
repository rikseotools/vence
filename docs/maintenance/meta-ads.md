# Meta Conversions API (CAPI) - Vence

## Descripcion General

Sistema de tracking server-side para Facebook/Instagram Ads que permite:
- Atribuir registros a campanas de Meta correctamente
- Enviar eventos de conversion a Meta desde el servidor (mejor matching)
- Capturar `fbclid` y parametros UTM de usuarios que llegan desde Meta

## Arquitectura

```
Usuario Meta Ads -> Landing Page -> Captura fbclid/UTM (cliente)
                                          |
                                          v
                    Registro con Google -> Auth Callback
                                          |
                                          v
                    Detecta isFromMeta -> Guarda registration_source='meta'
                                          |
                                          v
                    Llama trackMetaRegistration -> API /api/meta/track
                                          |
                                          v
                    Meta Conversions API -> Facebook Ads Manager
```

## Archivos Implementados

### 1. `lib/services/metaConversionsAPI.js` (Server-side)
Servicio principal para enviar eventos a Meta CAPI.

**Funciones:**
- `sendMetaEvent()` - Funcion base para enviar cualquier evento
- `trackMetaRegistration()` - Evento CompleteRegistration
- `trackMetaLead()` - Evento Lead
- `trackMetaPurchase()` - Evento Purchase
- `trackMetaInitiateCheckout()` - Evento InitiateCheckout
- `isMetaTraffic()` - Detecta si trafico viene de Meta
- `extractMetaParams()` - Extrae parametros de request

### 2. `lib/metaPixelCapture.js` (Client-side)
Captura parametros de Meta en el navegador.

**Funciones:**
- `captureMetaParams()` - Captura fbclid/UTM y guarda en cookies/sessionStorage
- `getMetaParams()` - Obtiene parametros guardados
- `isFromMeta()` - Verifica si usuario viene de Meta
- `trackMetaRegistration()` - Envia evento a API de tracking
- `clearMetaParams()` - Limpia parametros despues de conversion

### 3. `app/api/meta/track/route.js` (API Endpoint)
Endpoint que recibe eventos desde el cliente y los envia a Meta CAPI.

**Eventos soportados:**
- `CompleteRegistration` - Registro completado
- `Lead` - Usuario inicia proceso
- `Purchase` - Compra completada
- `InitiateCheckout` - Inicio de checkout
- Eventos personalizados

### 4. `app/ClientLayoutContent.js` (Modificado)
Captura parametros de Meta al cargar cualquier pagina:
```javascript
useEffect(() => {
  captureMetaParams()
}, [])
```

### 5. `app/auth/callback/page.js` (Modificado)
Detecta usuarios de Meta y:
- Guarda `registration_source = 'meta'`
- Envia evento CompleteRegistration a Meta CAPI

## Configuracion

### Variables de Entorno Requeridas

```bash
# En .env.local
META_PIXEL_ID=123456789012345
META_ACCESS_TOKEN=EAAxxxxxxxx...

# Opcional: Para testing
META_TEST_EVENT_CODE=TEST12345
```

### Obtener Credenciales

1. **META_PIXEL_ID:**
   - Ve a [Events Manager](https://business.facebook.com/events_manager)
   - Selecciona tu Pixel
   - El ID aparece en la URL o en la configuracion

2. **META_ACCESS_TOKEN:**
   - Ve a Events Manager > Settings > Conversions API
   - Click en "Generate access token"
   - Este token no expira

3. **META_TEST_EVENT_CODE (opcional):**
   - Ve a Events Manager > Test Events
   - Copia el codigo de test
   - Usalo SOLO en desarrollo

## Flujo de Tracking

### 1. Usuario llega desde Meta
```
URL: https://vence.es/?fbclid=ABC123&utm_source=facebook&utm_campaign=oposiciones
```

### 2. Captura en cliente (automatico)
`ClientLayoutContent.js` ejecuta `captureMetaParams()` que:
- Guarda `fbclid` en cookie `_fbc` (formato: fb.1.timestamp.fbclid)
- Guarda UTM params en cookies y sessionStorage

### 3. Usuario hace login
En `/auth/callback/page.js`:
```javascript
const isMetaAds = isFromMeta()
if (isMetaAds) {
  registrationSource = 'meta'
  await trackMetaRegistration(userId, userEmail)
}
```

### 4. Evento enviado a Meta
```json
{
  "event_name": "CompleteRegistration",
  "user_data": {
    "em": ["sha256_hash_email"],
    "external_id": ["sha256_hash_user_id"],
    "fbc": "fb.1.1234567890.ABCdef123"
  },
  "custom_data": {
    "registration_source": "meta",
    "content_name": "Vence - Oposiciones"
  }
}
```

## Deteccion de Trafico Meta

Un usuario se considera "de Meta" si:
1. Tiene `fbclid` en la URL
2. Tiene cookie `_fbc` o `_fbp`
3. Tiene `utm_source` = facebook, fb, instagram, ig, o meta

## Datos Enviados a Meta

### User Data (hasheado SHA-256)
- `em` - Email del usuario
- `external_id` - ID del usuario en Supabase
- `fbc` - Facebook Click ID (construido desde fbclid)
- `fbp` - Facebook Browser ID (si existe)
- `client_ip_address` - IP del usuario
- `client_user_agent` - User Agent del navegador

### Custom Data
- `registration_source` - 'meta'
- `content_name` - 'Vence - Oposiciones'
- `status` - 'registered'

## Analytics

### Ver registros por fuente
```sql
SELECT
  registration_source,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days
FROM user_profiles
GROUP BY registration_source
ORDER BY total DESC;
```

### Ver conversion Meta
```sql
SELECT
  DATE(created_at) as fecha,
  COUNT(*) as registros_meta
FROM user_profiles
WHERE registration_source = 'meta'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;
```

## Verificar Eventos en Meta

1. Ve a [Events Manager](https://business.facebook.com/events_manager)
2. Selecciona tu Pixel
3. Ve a "Test Events" para ver eventos de prueba
4. Ve a "Overview" para ver eventos reales

## Debugging

### Logs en servidor
```
[META CAPI] Enviando evento CompleteRegistration...
[META CAPI] Evento enviado correctamente { event_id: xxx }
```

### Logs en cliente
```
Meta params capturados: { fbclid: "ABC...", utm_source: "facebook" }
Meta registration event: { success: true, eventId: xxx }
```

## Cookies Utilizadas

| Cookie | Duracion | Proposito |
|--------|----------|-----------|
| `_fbc` | 30 dias | Facebook Click ID (formato: fb.1.timestamp.fbclid) |
| `meta_fbclid` | 30 dias | fbclid original |
| `meta_utm_source` | 30 dias | utm_source de Meta |
| `meta_utm_campaign` | 30 dias | utm_campaign de Meta |
| `meta_utm_medium` | 30 dias | utm_medium de Meta |

## Diferencias con Google Ads

| Aspecto | Google Ads | Meta Ads |
|---------|------------|----------|
| Deteccion | URL path `/premium-ads` | `fbclid` o `utm_source=facebook` |
| Plan Type | `premium_required` | `free` |
| Requires Payment | `true` | `false` |
| Registration Source | `google_ads` | `meta` |
| Tracking API | Google Ads Conversion | Meta Conversions API |

## Notas Importantes

1. **Dual Tracking**: Meta recomienda enviar eventos tanto desde Pixel (cliente) como CAPI (servidor). El `event_id` se usa para deduplicar.

2. **Hashing**: Todos los datos de usuario se hashean con SHA-256 antes de enviar a Meta.

3. **Cookies de Terceros**: Si Safari/Firefox bloquean cookies de terceros, `_fbp` no estara disponible, pero `_fbc` construido desde `fbclid` si funcionara.

4. **Attribution Window**: Meta usa ventana de 7 dias click / 1 dia view por defecto.
