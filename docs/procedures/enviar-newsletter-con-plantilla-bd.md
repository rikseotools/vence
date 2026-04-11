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

---

## Gotchas reales aprendidos en producción

Problemas reales que han costado un incidente y no son obvios del código. Ignorarlos causa envíos incompletos, emails rotos o mensajes contradictorios.

### 1. Supabase trunca queries a 1000 filas por defecto

`supabase.from('user_profiles').select(...).eq(...)` devuelve como máximo **1000 filas** aunque haya más. No emite error, silenciosamente trunca.

**Impacto real**: en el envío cross-sell a Aux Admin Estado (abril 2026) la tabla tenía 1221 usuarios con target=`auxiliar_administrativo_estado`. La query devolvió solo 1000 → al filtrar por ciudad gallega salieron 40, no 49. **9 usuarios no recibieron el email** en el primer envío.

**Fix obligatorio** para audiencias grandes:

```javascript
let all = [];
for (let from = 0;; from += 1000) {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, email, target_oposicion, ciudad')
    .eq('target_oposicion', 'auxiliar_administrativo_estado')
    .range(from, from + 999);
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < 1000) break;
}
```

**Señal de alarma**: si tu query puede superar 1000 filas en algún momento (tabla con >1000 registros del dominio que consultas), siempre paginar con `.range()` en loop.

### 2. `previewData` con valores dinámicos rompe el render personalizado

El endpoint `/api/admin/newsletters/send` hace: `baseVars = { ...previewData, ...templateVariables }` → luego por usuario añade `userName`, `oposicionActual`, `unsubscribeUrl`.

**Pero** si el template tiene en `previewData` un valor estático para un campo que debería ser dinámico (como `unsubscribeUrl: "https://www.vence.es/perfil"`), ese valor **ya aparece en `baseVars`** y el wrapper no lo sobrescribe correctamente salvo que detecte el placeholder en el template raw.

**Incidente real (abril 2026)**: el template `nueva-oposicion` tenía `previewData.unsubscribeUrl = "https://www.vence.es/perfil"`. El render sustituía `{{unsubscribeUrl}}` por esa URL estática antes de que el código pudiera inyectar el token real → el footer del template quedaba renderizado con URL incorrecta Y el sistema añadía SU PROPIO footer con el token real → **doble footer en el email**.

**Regla**: en `email_templates.previewData` solo poner valores que sirvan para render de preview en el admin y que **no se personalicen por usuario**. Nunca `unsubscribeUrl`, nunca datos personales. Si necesitas un placeholder para preview, úsalo solo en el panel admin, no en el payload real.

Ver commit `83df3b7c` para el fix: detectar `{{unsubscribeUrl}}` en `rawHtmlTemplate` **antes** del render y inyectar el link real en `userVars` si existe.

### 3. Subject NO debe incluir `{{userName}}`

Meter el nombre del usuario en el subject_template:
- Dispara filtros antispam (personalización en subject es señal de mass marketing)
- Queda "tufillo a marketing barato"
- Los usuarios lo notan

**Incidente real**: el template `oposicion-cruzada` tenía subject `"{{userName}}, prepara {{nuevaOposicion}} sin empezar de cero"`. Se cambió a `"Prepara {{nuevaOposicion}} sin empezar de cero"` tras feedback del usuario.

**Regla**: personalización del nombre **dentro del cuerpo** (saludo), **nunca en el subject**.

### 4. `fromEmail: 'noreply@...'` contradice "responde a este email"

Los templates de newsletter suelen incluir frases tipo "Si tienes alguna duda, responde a este email". Si el envío usa `fromEmail: 'noreply@vence.es'` eso es una **contradicción directa** — el usuario responde y rebota.

**Default correcto**: `info@vence.es` (es lo que usa el resto del sistema — stripe webhooks, admin notifications, reactivación, etc., y es el default en `lib/api/newsletters/schemas.ts`).

**Regla**: para newsletters que invitan a responder, usar siempre `fromEmail: 'info@vence.es'`. Nunca pasar `noreply@...` salvo que el contenido del template haya sido editado para NO invitar a responder.

### 5. `target_oposicion` puede estar corrupto

Algunos usuarios tienen en `target_oposicion` valores que no son position_types válidos:
- UUIDs (p.ej. `"0f60a358-22bb-4e11-ac68-ad1972b5d28e"`) — probablemente migraciones antiguas
- Strings libres tipo `"explorador"`
- `null`

Estos usuarios no son targeteables con `{{oposicionActual}}` porque el endpoint no encuentra el `fullName` correspondiente y devuelve basura.

**Regla al construir audiencias**: filtrar con regex antes de enviar:

```javascript
const VALID_POSITION_TYPE = /^[a-z_]+$/;
const candidatos = users.filter(u =>
  u.target_oposicion && VALID_POSITION_TYPE.test(u.target_oposicion)
);
```

### 6. Matching de ciudades con `includes()` genera falsos positivos

Al targetear por región geográfica es tentador hacer `ciudad.toLowerCase().includes('monforte')` para capturar "Monforte de Lemos" (Lugo). Pero eso matchea también:
- **Monforte del Cid** (Alicante, no Galicia)
- **Villamayor de Santiago** (Cuenca, matchea "santiago")

**Regla**: tokenizar por separadores no-alfabéticos y matchear tokens completos, con lista de exclusiones:

```javascript
const GALICIA_TOKENS = new Set(['coruña','vigo','pontevedra',...]);
const EXCLUDE_PHRASES = ['del cid','de santiago','de chile'];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

const enGalicia = profiles.filter(p => {
  const c = norm(p.ciudad || '');
  if (EXCLUDE_PHRASES.some(e => c.includes(e))) return false;
  const tokens = c.split(/[^a-z]+/).filter(Boolean);
  return tokens.some(t => GALICIA_TOKENS.has(t));
});
```

### 7. `user_profiles.ciudad` > `user_sessions.region` para targeting geográfico

La sección "Consultar audiencia por region/IP" usa `user_sessions.region` (basada en IP de ip-api.com). **Esto es ruidoso**:

- Una IP en Galicia no significa que el usuario viva allí (viaje, visita familiar, roaming)
- En el envío cross-sell C2 Galicia (abril 2026), usando IP salían 59 candidatos, pero muchos declaraban residencia en Madrid, Valencia, Barcelona, Toledo... al cambiar a filtro por `ciudad` (autodeclarada) salieron 28 candidatos legítimos.

**Regla**: usar `user_profiles.ciudad` como señal primaria (autodeclarado = fiable). Usar `user_sessions.region` solo como fallback para usuarios sin ciudad declarada.

### 8. Cross-sell: excluir usuarios ya en la oposición destino

Si envías "prepara Xunta de Galicia" a usuarios que ya tienen `target_oposicion = auxiliar_administrativo_galicia` o `administrativo_galicia`, el mensaje se ve absurdo ("te proponemos lo que ya haces").

**Regla al construir audiencias de cross-sell**: excluir explícitamente los position_types de destino:

```javascript
const DESTINO = new Set(['auxiliar_administrativo_galicia', 'administrativo_galicia']);
const candidatos = users.filter(u => !DESTINO.has(u.target_oposicion));
```

### 9. Overlap de temario en cross-sell: verificar contra `lib/config/oposiciones.ts`

Al redactar `temasComunesHtml` es tentador escribir "comparten casi todo el temario". **No inventar** — verificar contra la config real.

**Dato real** (Estado C2 ↔ Galicia C2, abril 2026): solo **~40% del temario** es común. Los 6 temas realmente idénticos son:

1. Constitución Española de 1978
2. Ley 39/2015 (LPAC) — ley estatal
3. Ley 40/2015 (LRJSP) — ley estatal
4. Unión Europea (instituciones + derecho derivado)
5. Informática básica y sistemas operativos
6. Marco común de protección de datos, transparencia e igualdad

**Lo que NO es común** (no vender como común):
- Corona, Cortes, TC, Poder Judicial, AGE (solo Estado)
- Estatuto de Autonomía de Galicia, Ley 16/2010 Admin Galicia, régimen financiero autonómico (solo Galicia)
- Transparencia: Ley 19/2013 estatal vs Ley 1/2016 gallega (marco sí, articulado no)
- Empleo público: EBEP estatal vs Ley 2/2015 gallega

**Regla**: antes de redactar cross-sell, abrir `lib/config/oposiciones.ts`, buscar los dos `positionType` implicados, comparar `blocks[*].themes[*].name` tema a tema y listar solo los realmente idénticos.

### 10. Ofimática Estado ≠ Ofimática Galicia

Aunque ambos temarios tienen un "bloque de ofimática", son incompatibles:
- **Estado**: Microsoft Office (Word, Excel, Access, Windows 11)
- **Galicia**: LibreOffice (Writer, Calc, Impress)

**Regla**: no incluir "ofimática" como tema común en cross-sell Estado↔Galicia. El opositor tendría que aprender LibreOffice desde cero aunque domine Office.

---

## Checklist pre-envío (resumen de gotchas)

Antes de lanzar cualquier envío masivo, verifica:

- [ ] ¿La audiencia puede superar 1000 filas? → paginar con `.range()` en loop
- [ ] ¿El `previewData` del template contiene valores dinámicos? → sacarlos
- [ ] ¿El `subject_template` contiene `{{userName}}`? → quitarlo
- [ ] ¿`fromEmail` es `info@vence.es` (no `noreply`)?
- [ ] ¿Se filtran `target_oposicion` corruptos (`/^[a-z_]+$/`)?
- [ ] Si es cross-sell: ¿se excluyen users ya en oposición destino?
- [ ] Si filtras por geografía: ¿usas `ciudad` (no IP) con tokenización estricta?
- [ ] Si el copy dice "temario común", ¿verificado contra `lib/config/oposiciones.ts`?
- [ ] ¿Test a manueltrader@gmail.com primero y aprobación explícita?
