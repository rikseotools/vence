# Manual de Troubleshooting de Errores Sentry

Este documento describe cómo investigar y resolver errores reportados en Sentry para el proyecto Vence.

## Configuración de Sentry

- **Organización:** `vence-x2`
- **SDK:** `@sentry/nextjs`
- **Entornos:** `vercel-production`, `development`
- **Config cliente:** `sentry.client.config.ts`
- **Config servidor:** `sentry.server.config.ts`

## Cómo Investigar Errores

### 1. Obtener Errores Recientes

```bash
# Errores no resueltos en las últimas 24h
node -e "
require('dotenv').config({ path: '.env.local' });
const token = process.env.SENTRY_AUTH_TOKEN;

fetch('https://sentry.io/api/0/organizations/vence-x2/issues/?statsPeriod=24h&query=is:unresolved', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(r => r.json())
.then(data => {
  data.forEach(issue => {
    console.log('---');
    console.log('ID:', issue.id);
    console.log('Title:', issue.title);
    console.log('Culprit:', issue.culprit);
    console.log('Count:', issue.count);
    console.log('Environment:', issue.metadata?.environment);
  });
});
"
```

### 2. Filtrar por Entorno

```bash
# Solo producción (lo que importa)
query=is:unresolved+environment:vercel-production

# Solo desarrollo (ignorar generalmente)
query=is:unresolved+environment:development
```

### 3. Obtener Detalles de un Error

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const token = process.env.SENTRY_AUTH_TOKEN;
const issueId = 'ISSUE_ID_AQUI';

fetch('https://sentry.io/api/0/organizations/vence-x2/issues/' + issueId + '/events/latest/', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(r => r.json())
.then(data => {
  console.log('Date:', data.dateCreated);
  console.log('Tags:', JSON.stringify(data.tags?.filter(t =>
    ['browser', 'url', 'environment', 'transaction'].includes(t.key)
  )));

  // Stacktrace
  data.entries?.forEach(entry => {
    if (entry.type === 'exception') {
      entry.data.values.forEach(exc => {
        console.log('Exception:', exc.type, '-', exc.value);
        exc.stacktrace?.frames.slice(-5).forEach(f => {
          console.log('  -', f.function, '|', f.filename?.split('/').pop());
        });
      });
    }
    // Breadcrumbs (acciones previas al error)
    if (entry.type === 'breadcrumbs') {
      console.log('Breadcrumbs:');
      entry.data.values.slice(-10).forEach(c => {
        console.log(' ', c.category, '|', c.message?.substring(0, 100) || c.data?.url);
      });
    }
  });
});
"
```

## Errores Conocidos y Soluciones

### 1. `DbHandler exited`

**Descripción:** Conexión TCP con Postgres cerrada inesperadamente.

**Frecuencia:** Muy rara (3 ocurrencias en 90 días)

**Causa raíz:**
- El pooler de Supabase cierra conexiones idle
- Vercel termina funciones serverless, dejando conexiones huérfanas
- El singleton global de `db/client.ts` mantiene referencias a conexiones cerradas

**Stacktrace típico:**
```
TCP.onStreamRead -> Readable.push -> Socket.emit -> Socket.ej (db_client_ts)
```

**Por qué ocurre:**
1. Una función serverless hace queries a la BD
2. La función termina pero el proceso Node persiste (warm instance)
3. El pooler de Supabase cierra la conexión idle (~30 seg)
4. El cliente postgres-js intenta usar la conexión cerrada
5. Error: "DbHandler exited"

**Configuración actual en `db/client.ts`:**
```typescript
const conn = postgres(urlWithTimeout, {
  max: 1,              // Una conexión máxima
  idle_timeout: 20,    // Cerrar idle después de 20 seg
  connect_timeout: 10, // Timeout de conexión 10 seg
  prepare: false,      // Requerido para Supabase pooler
})
```

**Impacto:** Mínimo. El error se lanza pero la operación ya completó (el INSERT a `ai_chat_logs` retornó 201 antes del error).

**Solución aplicada:**
- `idle_timeout: 20` cierra conexiones antes que el pooler de Supabase
- Es un error "cosmético" - la funcionalidad no se ve afectada

**Posibles mejoras futuras:**
- Agregar `onnotice` handler para silenciar errores de conexión cerrada
- Usar cliente Supabase REST en lugar de postgres directo para algunas operaciones

### 2. `ReferenceError: startTime is not defined`

**Descripción:** Variable no definida en VideoCoursePage.

**Entorno:** Solo desarrollo (localhost:3000)

**Causa:** Turbopack Fast Refresh mantiene referencias a código eliminado durante desarrollo.

**Evidencia en breadcrumbs:**
```
[Fast Refresh] rebuilding
[Fast Refresh] done in 343ms
```

**Solución:** Ninguna necesaria. Solo ocurre en desarrollo después de hot reload.

### 3. `ReferenceError: session is not defined`

**Descripción:** Variable de sesión no definida en VideoCoursePage.

**Entorno:** Solo desarrollo (localhost:3000)

**Causa:** Mismo problema que `startTime` - Fast Refresh de Turbopack.

**Código afectado en `VideoCoursePage.tsx`:**
```typescript
// Línea 145 y 269
const { data: { session } } = await supabase.auth.getSession()
```

**Solución:** Ninguna necesaria para producción.

### 4. `You cannot use different slug names for the same dynamic path`

**Descripción:** Conflicto de rutas dinámicas en Next.js.

**Mensaje:** `'law' !== 'testId'`

**Causa:** Existían dos carpetas con rutas dinámicas conflictivas:
- `app/test/[law]/...`
- `app/test/[testId]/...`

**Solución aplicada:** Commit `b40da6f1` eliminó `app/test/[testId]`

**Estado:** Resuelto. Última ocurrencia: 2026-02-04 06:53

## Errores a Ignorar

Los siguientes errores están filtrados en `sentry.client.config.ts`:

```typescript
ignoreErrors: [
  /^chrome-extension:\/\//,      // Extensiones de navegador
  /^moz-extension:\/\//,
  'Network request failed',       // Errores de red
  'Failed to fetch',
  'Load failed',
  'AbortError',                   // Usuario canceló
  'The operation was aborted',
  'Converting circular structure to JSON',  // Sentry Replay interno
  /SecurityError/,                // Cross-origin frames
  /enableDidUserTypeOnKeyboardLogging/,  // Instagram WebView
  /Java object is gone/,          // Meta WebView
]
```

## Cómo Cerrar/Ignorar Issues

```bash
# Ignorar un issue (no aparecerá en unresolved)
curl -X PUT \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ignored"}' \
  "https://sentry.io/api/0/organizations/vence-x2/issues/ISSUE_ID/"

# Resolver un issue
curl -X PUT \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  "https://sentry.io/api/0/organizations/vence-x2/issues/ISSUE_ID/"
```

## Métricas de Referencia

### Últimos 90 días (Feb 2026)
- Total errores producción no resueltos: 2
- `DbHandler exited`: 3 ocurrencias totales (rarísimo)
- Error de rutas slug: 1823 ocurrencias (ya resuelto, era loop de restart)

### Criterios de Severidad

| Severidad | Criterio | Acción |
|-----------|----------|--------|
| **Crítica** | >100 ocurrencias/hora en producción | Investigar inmediatamente |
| **Alta** | >10 ocurrencias/día, afecta funcionalidad | Investigar en 24h |
| **Media** | <10 ocurrencias/día, no afecta funcionalidad | Investigar cuando haya tiempo |
| **Baja** | Solo desarrollo, errores cosméticos | Ignorar |

## Tips de Investigación

1. **Siempre verificar el entorno** - Muchos errores son solo de desarrollo
2. **Revisar breadcrumbs** - Muestran las acciones previas al error
3. **Comparar timestamps** - Un error 6 minutos después del último breadcrumb indica conexión huérfana
4. **Verificar el release** - Comparar con commits recientes para ver si es código nuevo
5. **UserCount = 0** - Significa que el error no tiene user ID asociado (puede ser server-side)
