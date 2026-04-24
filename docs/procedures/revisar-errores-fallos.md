# Revisar Errores y Fallos — Guía Unificada

Guía rápida para investigar errores de producción. Combina las 3 fuentes de datos disponibles.

## Las 3 fuentes de errores

| Fuente | Qué captura | Dónde se ve | Cuándo usarla |
|--------|------------|-------------|---------------|
| **Errores API** (BD) | Respuestas 4xx/5xx de endpoints | Panel admin `/admin/errores-validacion` | Errores de servidor, fallos de guardado, auth |
| **Sentry** | Excepciones client-side + server-side | API de Sentry o panel admin (badge) | Errores de UI, componentes que crashean, TTS watchdog |
| **Vercel Logs** | stdout/stderr del runtime | Dashboard Vercel o logs que el usuario copie | Errores de build, cold starts, timeouts de función |

## Flujo rápido de revisión

### 1. Errores API (lo más común)

```bash
# Errores no revisados de las últimas 24h
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase
    .from('validation_error_logs')
    .select('created_at, endpoint, error_type, error_message, http_status, severity, user_id, deploy_version')
    .is('reviewed_at', null)
    .gte('created_at', new Date(Date.now() - 86400000).toISOString())
    .neq('deploy_version', 'local')
    .order('created_at', { ascending: false })
    .limit(20);
  (data||[]).forEach(e => console.log(
    e.created_at?.slice(0,16), '|', e.severity, '|', e.endpoint, '|', e.error_type, '|', e.error_message?.slice(0,80), '|', e.http_status
  ));
})();
"
```

**Filtrar ruido:** `deploy_version = 'local'` → desarrollo. `error_type = 'network'` → red del usuario.

Manual detallado: `docs/maintenance/revisar-errores-api.md`

### 2. Sentry (errores client-side)

```bash
# Issues sin resolver — producción
node -e "
require('dotenv').config({ path: '.env.local' });
fetch('https://sentry.io/api/0/organizations/vence-x2/issues/?statsPeriod=24h&query=is:unresolved+environment:vercel-production', {
  headers: { 'Authorization': 'Bearer ' + process.env.SENTRY_AUTH_TOKEN }
})
.then(r => r.json())
.then(issues => {
  console.log('Issues sin resolver:', issues.length);
  issues.forEach(i => console.log(
    i.count + 'x |', i.title?.slice(0,80), '|', i.culprit?.slice(0,40), '| last:', i.lastSeen?.slice(0,16)
  ));
});
"
```

```bash
# Filtrar por componente específico (ej: TTS)
# query=is:unresolved+ArticleTTS
# query=is:unresolved+tts/watchdog
# query=is:unresolved+DynamicTest
# query=is:unresolved+ExamLayout
```

```bash
# Ver detalles de un issue (stacktrace, breadcrumbs, device)
node -e "
require('dotenv').config({ path: '.env.local' });
const issueId = 'PONER_ISSUE_ID';
fetch('https://sentry.io/api/0/organizations/vence-x2/issues/' + issueId + '/events/latest/', {
  headers: { 'Authorization': 'Bearer ' + process.env.SENTRY_AUTH_TOKEN }
})
.then(r => r.json())
.then(data => {
  console.log('Date:', data.dateCreated);
  console.log('Tags:', JSON.stringify(data.tags?.filter(t =>
    ['browser', 'os', 'device', 'url', 'component', 'endpoint', 'deploy'].includes(t.key)
  ), null, 2));
  // Excepciones
  data.entries?.forEach(entry => {
    if (entry.type === 'exception') {
      entry.data.values.forEach(exc => {
        console.log('Exception:', exc.type, '-', exc.value);
        exc.stacktrace?.frames.slice(-5).forEach(f => {
          console.log('  -', f.function, '|', f.filename?.split('/').pop());
        });
      });
    }
  });
});
"
```

```bash
# Cerrar/ignorar un issue
curl -X PUT \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  "https://sentry.io/api/0/organizations/vence-x2/issues/ISSUE_ID/"
```

**Tags importantes para filtrar:**

| Tag | Valores | Qué indica |
|-----|---------|------------|
| `component` | `ArticleTTS`, `DynamicTest`, `ExamLayout`... | Qué componente falló |
| `endpoint` | `tts/watchdog`, `/api/answer`... | Qué endpoint o sistema |
| `source` | `client` | Error del navegador del usuario |
| `deploy` | SHA del commit | Qué versión del código |

Manual detallado: `docs/maintenance/sentry-troubleshooting.md`

### 3. Vercel Logs (cuando las otras 2 no muestran nada)

Los logs de Vercel no se consultan por API desde aquí. El usuario los copia del dashboard de Vercel y los pega en la conversación.

**Qué buscar:**
- `ERR` o `Error` → errores de runtime
- `FUNCTION_INVOCATION_TIMEOUT` → función serverless tardó >60s
- `504 Gateway Timeout` → BD no respondió
- `EDGE_FUNCTION_INVOCATION_FAILED` → error en middleware

## Componentes que loguean a Sentry (client-side)

| Componente | Endpoint en Sentry | Qué captura |
|------------|-------------------|-------------|
| `ArticleTTS` | `tts/watchdog` | Watchdog detecta speech muerto o chunk zombie |
| `DynamicTest` | `/api/answer` | Error al validar respuesta |
| `ExamLayout` | `/api/exam/validate` | Error al validar examen |
| `TestLayout` | `/api/answer` | Error al validar respuesta |

Todos usan `logClientError()` de `lib/logClientError.ts`.

## Tabla de errores API en BD

**Tabla:** `validation_error_logs`

**Campos clave:** `severity`, `endpoint`, `error_type`, `error_message`, `user_id`, `http_status`, `deploy_version`, `reviewed_at`

**Indices:** `created_at`, `endpoint`, `error_type`, `user_id`, `deploy_version`

## Archivos clave

| Archivo | Función |
|---------|---------|
| `lib/api/withErrorLogging.ts` | Wrapper server-side: captura 4xx/5xx → BD |
| `lib/logClientError.ts` | Helper client-side: captura errores → Sentry |
| `hooks/useSentryIssues.ts` | Hook admin: muestra badge con issues Sentry |
| `app/api/admin/sentry-issues/route.ts` | API proxy a Sentry (para el panel admin) |
| `sentry.client.config.ts` | Config Sentry client (ignoreErrors, etc.) |
| `docs/maintenance/revisar-errores-api.md` | Manual detallado errores API |
| `docs/maintenance/sentry-troubleshooting.md` | Manual detallado Sentry |
