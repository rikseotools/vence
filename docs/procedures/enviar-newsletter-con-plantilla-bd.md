# Enviar newsletter usando plantillas de BD

## Cuando usar este procedimiento

Cuando el usuario dice cosas como:
- "Envia la newsletter de nueva oposicion a los usuarios de CyL"
- "Manda el email de oposicion cruzada a usuarios de Estado que viven en CyL"
- "Haz un broadcast con la plantilla X a la audiencia Y"

## Paso 1: Identificar plantilla y audiencia

Preguntar al usuario si no queda claro:
- **Plantilla**: slug de la plantilla en BD (ej: `nueva-oposicion`, `oposicion-cruzada`)
- **Audiencia**: por target_oposicion, por selectedUserIds, o por region/IP
- **Variables**: datos que rellenan el template

### Consultar plantillas disponibles

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('email_templates').select('slug, name, variables').eq('is_active', true);
  for (const t of data || []) {
    const vars = (t.variables || []).map(v => v.key).join(', ');
    console.log(t.slug, '-', t.name, '| Variables:', vars);
  }
})();
"
```

### Consultar audiencias por oposicion

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('user_profiles').select('target_oposicion').not('email', 'is', null);
  const counts = {};
  for (const u of data || []) {
    if (u.target_oposicion) counts[u.target_oposicion] = (counts[u.target_oposicion] || 0) + 1;
  }
  Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(v, 'usuarios -', k));
})();
"
```

### Consultar audiencia por region/IP (tabla user_sessions)

Cuando el usuario pide enviar a usuarios de una comunidad autonoma, buscar por IP:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const REGION = 'Castille and León'; // Nombre en inglés como lo guarda ip-api.com

(async () => {
  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('user_id')
    .ilike('region', '%' + REGION + '%');

  const userIds = [...new Set((sessions || []).map(s => s.user_id).filter(Boolean))];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, target_oposicion, ciudad')
    .in('id', userIds)
    .not('email', 'is', null)
    .order('target_oposicion');

  console.log('Usuarios con IP en', REGION + ':', profiles?.length);
  // Filtrar por oposicion si es necesario
  for (const u of profiles || []) {
    console.log(u.email, '|', u.ciudad || '?', '|', u.target_oposicion);
  }
})();
"
```

Regiones en user_sessions (en ingles): Madrid, Andalusia, Castille and León, Valencia, Catalonia, Principality of Asturias, etc.

## Paso 2: Comprobar audiencia final (OBLIGATORIO)

Verificar cuantos usuarios recibirán el email y cuantos están bloqueados.
Se excluyen usuarios con `unsubscribed_all = true` O `email_newsletter_disabled = true`.

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const USER_IDS = []; // <-- Rellenar con IDs de usuarios a enviar

(async () => {
  const { data: blocked } = await supabase
    .from('email_preferences')
    .select('user_id, unsubscribed_all, email_newsletter_disabled')
    .or('unsubscribed_all.eq.true,email_newsletter_disabled.eq.true');
  const blockedIds = new Set((blocked || []).map(b => b.user_id));

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, target_oposicion')
    .in('id', USER_IDS)
    .not('email', 'is', null);

  const eligible = (users || []).filter(u => !blockedIds.has(u.id));
  const blockedList = (users || []).filter(u => blockedIds.has(u.id));

  console.log('Total:', users?.length);
  console.log('Bloqueados:', blockedList.length);
  if (blockedList.length) blockedList.forEach(u => console.log('  BLOQUEADO:', u.email));
  console.log('Elegibles:', eligible.length);
  eligible.forEach((u, i) => console.log((i+1) + '.', u.email, '-', u.full_name || '', '-', u.target_oposicion));
})();
"
```

**Reportar al usuario** antes de enviar:
- Total registrados
- Cuantos bloqueados y por que
- Cuantos elegibles finales
- Pedir confirmacion antes de enviar

## Paso 3: Enviar test primero

Enviar a 1 usuario (el admin) para verificar que se ve bien.

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: p } = await supabase.from('user_profiles').select('id').eq('email', 'manueltrader@gmail.com').single();

  const res = await fetch('http://localhost:3000/api/admin/newsletters/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateSlug: 'SLUG_PLANTILLA',
      templateVariables: {
        // Variables de la plantilla (NO incluir userName ni unsubscribeUrl, se rellenan solos)
      },
      selectedUserIds: [p.id],
      testMode: false
    })
  });

  console.log(JSON.stringify(await res.json(), null, 2));
})();
"
```

## Paso 4: Enviar a todos (solo con aprobacion del usuario)

Usar `selectedUserIds` con los IDs elegibles del paso 2.
Si ya se envio a algunos (ej: test previo), excluirlos consultando email_events.

```bash
# Verificar a quienes ya se envio
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('email_events')
    .select('email_address')
    .eq('event_type', 'sent')
    .eq('template_id', 'SLUG_PLANTILLA')
    .gte('created_at', today + 'T00:00:00Z');
  console.log('Ya enviados hoy:', data?.length);
  (data || []).forEach(e => console.log(' -', e.email_address));
})();
"
```

El endpoint al enviar:
- Personaliza `{{userName}}` y `{{oposicionActual}}` por cada usuario automaticamente
- `{{userName}}` = primer nombre del perfil
- `{{oposicionActual}}` = nombre completo de la oposicion del usuario (desde tabla oposiciones)
- Respeta `unsubscribedAll` y `email_newsletter_disabled`
- Rate limiting: 1 email/segundo con retry en 429
- Registra eventos en `email_events` con subject personalizado
- Tracking pixel + link tracking automatico (solo en testMode: false)
- Genera token de unsubscribe por usuario

## Referencia rapida de la API

### POST /api/admin/newsletters/send

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `templateSlug` | string | Slug de plantilla en BD |
| `templateVariables` | object | Variables globales (no incluir userName ni unsubscribeUrl) |
| `audienceType` | string | `all`, `active`, `premium`, `free`, o cualquier `target_oposicion` |
| `selectedUserIds` | string[] | Alternativa: enviar a usuarios especificos por ID |
| `testMode` | boolean | `true` = solo 3 usuarios (solo con audienceType, no selectedUserIds) |

### Plantillas disponibles

#### `nueva-oposicion` - Anunciar nueva oposicion

| Variable | Descripcion | Auto? |
|----------|-------------|-------|
| `nombreOposicion` | Nombre completo de la oposicion | No |
| `textoPlazas` | Texto con plazas (empieza con espacio) | No |
| `features` | HTML con items `<li>` y checkmarks | No |
| `ctaUrl` | URL del boton CTA | No |
| `userName` | Primer nombre del usuario | Si |
| `unsubscribeUrl` | Link de desuscripcion | Si |

#### `oposicion-cruzada` - Promocionar oposicion a usuarios de otra

| Variable | Descripcion | Auto? |
|----------|-------------|-------|
| `nuevaOposicion` | Nombre de la oposicion a promocionar | No |
| `nuevaOposicionCorta` | Nombre corto (para boton CTA) | No |
| `temasComunesHtml` | HTML con temas comunes (items `<li>`) | No |
| `ctaUrl` | URL del boton CTA | No |
| `userName` | Primer nombre del usuario | Si |
| `oposicionActual` | Oposicion actual del usuario (nombre completo) | Si |
| `unsubscribeUrl` | Link de desuscripcion | Si |

### Audiencias

Las audiencias se cargan dinamicamente de la tabla `oposiciones`. Valores comunes:

| Valor | Descripcion |
|-------|-------------|
| `all` | Todos los usuarios con email |
| `active` | Usuarios activos |
| `premium` | Usuarios premium |
| `auxiliar_administrativo_estado` | Aux. Admin. Estado |
| `auxiliar_administrativo_cyl` | Aux. Admin. CyL |
| `auxiliar_administrativo_madrid` | Aux. Admin. Madrid |
| `administrativo_estado` | Administrativo Estado |

Para audiencias por region/IP, usar `selectedUserIds` con IDs obtenidos de `user_sessions`.

## Notas importantes

- **SIEMPRE enviar test a manueltrader@gmail.com primero**
- Variables auto (`userName`, `oposicionActual`, `unsubscribeUrl`) se personalizan por cada usuario
- Si ya se envio a algunos usuarios, excluirlos consultando `email_events`
- Para ver resultado: `/admin/newsletters` > Historial de Envios
- Limite de Resend: verificar cuota antes de envios grandes
