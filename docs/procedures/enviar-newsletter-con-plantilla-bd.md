# Enviar newsletter usando plantillas de BD

## Cuando usar este procedimiento

Cuando el usuario dice cosas como:
- "Envia la newsletter de nueva oposicion a los usuarios de CyL"
- "Manda un email a los de Madrid con la plantilla nueva-oposicion"
- "Haz un broadcast con la plantilla X a la audiencia Y"

## Paso 1: Identificar plantilla y audiencia

Preguntar al usuario si no queda claro:
- **Plantilla**: slug de la plantilla en BD (ej: `nueva-oposicion`)
- **Audiencia**: target_oposicion del usuario (ej: `auxiliar_administrativo_cyl`)
- **Variables**: datos que rellenan el template (nombre, plazas, features, etc.)

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

### Consultar audiencias disponibles (usuarios por oposicion)

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

## Paso 2: Enviar en modo TEST primero (SIEMPRE)

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Obtener token admin
(async () => {
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL || 'rikseotools@gmail.com',
    password: process.env.ADMIN_PASSWORD
  });

  if (!session) { console.error('No se pudo autenticar'); return; }

  const res = await fetch(process.env.NEXT_PUBLIC_URL + '/api/admin/newsletters/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateSlug: 'nueva-oposicion',
      templateVariables: {
        nombreOposicion: 'Auxiliar Administrativo de Castilla y Leon',
        textoPlazas: ' Se han convocado 362 plazas.',
        features: '<li style=\"margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;\"><span style=\"position: absolute; left: 0;\">✅</span><strong>27 temas</strong> del temario oficial BOCYL</li><li style=\"margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;\"><span style=\"position: absolute; left: 0;\">✅</span><strong>Tests por tema</strong></li><li style=\"margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;\"><span style=\"position: absolute; left: 0;\">✅</span><strong>Examenes oficiales</strong> de convocatorias anteriores</li><li style=\"margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;\"><span style=\"position: absolute; left: 0;\">✅</span><strong>Estadisticas de progreso</strong></li>',
        ctaUrl: 'https://www.vence.es/auxiliar-administrativo-cyl/test?utm_source=email&utm_campaign=nueva_oposicion'
      },
      audienceType: 'auxiliar_administrativo_cyl',
      testMode: true
    })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
})();
"
```

**testMode: true** envia solo a los primeros 3 usuarios. Verificar que llega bien al email.

## Paso 3: Enviar a todos (solo con aprobacion del usuario)

Cambiar `testMode: false` y ejecutar de nuevo. El endpoint:
- Respeta `unsubscribedAll` (no envia a usuarios dados de baja)
- Tiene rate limiting (1 email/segundo con retry en 429)
- Registra eventos en `email_events` para analytics
- Añade tracking pixel y link tracking automaticamente
- Genera token de unsubscribe por usuario

## Referencia rapida de la API

### POST /api/admin/newsletters/send

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `templateSlug` | string | Slug de plantilla en BD |
| `templateVariables` | object | Variables para rellenar el template |
| `audienceType` | string | `all`, `active`, `inactive`, `premium`, `free`, o cualquier `target_oposicion` |
| `testMode` | boolean | `true` = solo 3 usuarios |
| `selectedUserIds` | string[] | Alternativa: enviar a usuarios especificos por ID |

### Variables de la plantilla `nueva-oposicion`

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `nombreOposicion` | Nombre completo | Auxiliar Administrativo de Castilla y Leon |
| `textoPlazas` | Texto con plazas (empieza con espacio) | ` Se han convocado 362 plazas.` |
| `features` | HTML con items `<li>` y checkmarks | Ver ejemplo arriba |
| `ctaUrl` | URL del boton "Empezar a practicar" | `https://www.vence.es/SLUG/test?utm_source=email&utm_campaign=nueva_oposicion` |
| `userName` | Se rellena automaticamente por usuario | - |
| `unsubscribeUrl` | Se genera automaticamente por usuario | - |

### Audiencias comunes

| Valor | Descripcion |
|-------|-------------|
| `all` | Todos los usuarios con email |
| `auxiliar_administrativo_estado` | Aux. Admin. Estado |
| `auxiliar_administrativo_cyl` | Aux. Admin. CyL |
| `auxiliar_administrativo_madrid` | Aux. Admin. Madrid |
| `administrativo_estado` | Administrativo Estado |
| `tramitacion_procesal` | Tramitacion Procesal |

Las audiencias se cargan dinamicamente de la tabla `oposiciones`. Cualquier oposicion activa con usuarios que tengan ese `target_oposicion` es una audiencia valida.

## Notas importantes

- **SIEMPRE testMode: true primero** - verificar que el email se ve bien
- **userName y unsubscribeUrl** se rellenan automaticamente por cada usuario
- Las audiencias no son mutuamente excluyentes con region. Si quieres CyL + region, usa el endpoint `/api/v2/admin/broadcast` que combina ambos filtros
- Para ver el resultado del envio, consultar `/admin/newsletters` > Historial de Envios
