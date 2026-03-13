# Revisar Errores API (Panel Admin)

## Acceso

Panel admin > **Errores API** (tab con badge parpadeante si hay errores sin revisar)

URL: `/admin/errores-validacion`

## Sistema de captura

Todos los endpoints (198 route files) usan el wrapper `withErrorLogging` que captura **todas las respuestas 4xx y 5xx** con niveles de severidad:

| Status | Severidad | Badge? | Ejemplo |
|--------|-----------|--------|---------|
| 500+ | **critical** | Si | Error interno, DB caida |
| 401, 403 | warning | No | Sesion expirada, sin permisos |
| 400, 404, 422, 429 | info | No | Validacion fallida, ruta no encontrada |

Ademas captura:
- **Excepciones no manejadas**: Errores throw sin catch (severity critical)
- **Errores client-side**: Los 4 componentes de test logean via `logClientError`

El logging es **fire-and-forget**: no ralentiza ni modifica respuestas.
El badge solo parpadea con errores **critical no revisados**.

## Campos capturados

| Campo | Descripcion |
|-------|------------|
| `severity` | `critical`, `warning`, `info` |
| `endpoint` | Ruta de la API (ej: `/api/answer`) |
| `error_type` | `timeout`, `network`, `db_connection`, `unknown` |
| `error_message` | Mensaje del error |
| `user_id` | UUID del usuario (si disponible en body) |
| `question_id` | ID de pregunta (si disponible) |
| `http_status` | Status HTTP (0 = error client-side) |
| `duration_ms` | Tiempo de respuesta |
| `deploy_version` | SHA del commit desplegado (`local` en dev) |
| `vercel_region` | Region de Vercel (ej: `iad1`) |
| `user_agent` | Navegador del usuario |
| `reviewed_at` | Fecha de revision (null = pendiente) |

## Procedimiento de revision

### 1. Filtrar ruido

- **`deploy_version = local`**: Son errores de tu entorno de desarrollo. Se pueden borrar.
- **`duration_ms` > 100000** (>100s): Probablemente dev server compilando. Ruido.
- **Endpoints admin** sin user_id: Llamadas del propio admin sin autenticacion local.

### 2. Clasificar por tipo

| Tipo | Causa probable | Accion |
|------|---------------|--------|
| `timeout` | Usuario espero >20s, watchdog disparo | Revisar logs de Vercel, comprobar si la BD estaba lenta |
| `network` | Fallo de red del usuario | No requiere accion, informativo |
| `db_connection` | Pool de conexiones agotado | Revisar `connect_timeout` y carga del servidor |
| `unknown` | Error generico 500 | Leer `error_message` para diagnosticar |

### 3. Investigar errores reales

Para cada error **no revisado** con `deploy_version != local`:

1. **Identificar al usuario**: El `user_id` permite buscar en `user_profiles`
2. **Contexto temporal**: Ver si hubo muchos errores en el mismo periodo (posible incidencia)
3. **Endpoint afectado**: Si es `/api/answer` o `/api/exam/validate`, el usuario tuvo problema respondiendo
4. **User Agent**: Identificar si es movil/desktop, navegador especifico
5. **Region**: Si todos los errores son de la misma region de Vercel, puede ser problema regional

### 4. Consultar detalles

```bash
# Buscar errores de un usuario especifico
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase
    .from('validation_error_logs')
    .select('*')
    .eq('user_id', 'UUID_AQUI')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(JSON.stringify(data, null, 2));
})();
"
```

```bash
# Borrar errores de localhost (ruido)
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('/home/manuel/Documentos/github/vence/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const { rowCount } = await pool.query(\"DELETE FROM validation_error_logs WHERE deploy_version = 'local'\");
  console.log('Borrados:', rowCount);
  await pool.end();
})();
"
```

### 5. Marcar como revisado

- Desde el panel: expandir la fila del error y pulsar **"Marcar revisado"**
- El error se atenua visualmente y deja de contar para el badge
- Los errores revisados siguen visibles en el historial

## Badge de notificacion

El badge rojo en la tab "Errores API" muestra el numero de errores **no revisados** en las ultimas 24h. Se actualiza automaticamente al recargar el panel admin.

## Archivos clave

| Archivo | Funcion |
|---------|---------|
| `lib/api/withErrorLogging.ts` | Wrapper que captura errores en endpoints |
| `lib/logClientError.ts` | Helper para logging client-side |
| `lib/api/validation-error-log/queries.ts` | `logValidationError` (fire-and-forget a BD) |
| `lib/api/admin-validation-errors/queries.ts` | Queries del panel admin |
| `app/admin/errores-validacion/page.tsx` | Panel admin UI |
| `hooks/useAdminNotifications.ts` | Badge con conteo de errores |

## Tabla BD

`validation_error_logs` — indices en `created_at`, `endpoint`, `error_type`, `user_id`, `deploy_version`.
