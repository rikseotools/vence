# Helper de scope por oposición

Documentación del helper centralizado que decide qué leyes son válidas para un
usuario en función de su `target_oposicion`. Evita bugs cross-oposición (ver
dispute `4e247ddc-313b-46d7-81e9-cf20f6a48acc`: usuarios de Aux Estado
recibiendo preguntas de leyes CyL).

## Regla de oro

> Todo endpoint que filtre preguntas por oposición **DEBE** usar
> `getAllowedLawIds` del módulo `lib/api/oposicion-scope/queries.ts`.
> Nunca derives el scope de un `positionType` que venga del cliente.

## Archivos

- `lib/api/oposicion-scope/queries.ts` — helpers
- `lib/api/shared/auth.ts` — `getAuthenticatedUserWithOposicion` para usar
  desde route handlers

## API

### `getAllowedLawIds(params)`

Devuelve la lista de leyes (IDs y short names) pertenecientes al scope de un
usuario o positionType.

```ts
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'

const { positionType, lawIds, lawShortNames } = await getAllowedLawIds({
  userId,                          // opcional — sobrescribe fallback si existe
  fallbackPositionType: 'auxiliar_administrativo_estado',
})
```

Comportamiento:

- Si `userId` se pasa y `user_profiles.target_oposicion` no está vacío →
  `positionType` = `target_oposicion` (el fallback se ignora).
- Si `userId` no se pasa o el perfil no tiene `target_oposicion` →
  `positionType` = `fallbackPositionType` o `'auxiliar_administrativo_estado'`.
- Fuente de verdad para las leyes válidas: `topic_scope × topics`, filtrado
  por `topics.position_type`.

### `filterSelectedLawsByScope(input)`

Intersección pura entre las leyes seleccionadas por el usuario y las
permitidas por su scope.

```ts
import { filterSelectedLawsByScope } from '@/lib/api/oposicion-scope/queries'

const { allowedLaws, empty, emptyReason } = filterSelectedLawsByScope({
  selectedLaws: ['CE', 'Reglamento Cortes CyL'],
  allowedLawShortNames,            // del getAllowedLawIds
})
```

Comportamiento:

- Si `allowedLawShortNames` está vacío → `empty: true` con
  `emptyReason = 'No hay contenido configurado para esta oposición'`.
- Si no hay intersección → `empty: true` con
  `emptyReason = 'Las leyes seleccionadas no pertenecen al temario de tu oposición'`.
- Si hay intersección → `empty: false`, `allowedLaws` solo con las válidas.

### `getAuthenticatedUserWithOposicion(request)`

Autentica el Bearer token y devuelve `user` + `targetOposicion` del perfil en
una sola llamada. Pensado para route handlers.

```ts
import { getAuthenticatedUserWithOposicion } from '@/lib/api/shared/auth'

const auth = await getAuthenticatedUserWithOposicion(request)
if (!auth.ok) return auth.response

const scope = await getAllowedLawIds({
  userId: auth.user.id,
  fallbackPositionType: auth.targetOposicion ?? undefined,
})
```

## Patrón recomendado para route handlers

```ts
// 1. Sesión
const auth = await getAuthenticatedUser(request)
if (!auth.ok) return auth.response

// 2. Nunca confiar en positionType/userId del body — derivar de la sesión
const body = await request.json()
const { userId: _ignore, positionType: _ignore2, ...safeBody } = body

// 3. Scope centralizado
const scope = await getAllowedLawIds({ userId: auth.user.id })

// 4. Intersección si el cliente pasa selectedLaws
const check = filterSelectedLawsByScope({
  selectedLaws: safeBody.selectedLaws ?? [],
  allowedLawShortNames: scope.lawShortNames,
})
if (check.empty) {
  return NextResponse.json({ success: true, questions: [], emptyReason: check.emptyReason })
}

// 5. Query acotada por scope
// ...inArray(laws.id, scope.lawIds) o similar
```

## Dónde está ya aplicado

- `lib/api/filtered-questions/queries.ts` — `isGlobalMode` e `isLawOnlyMode`.
- `lib/api/notifications/queries.ts` — `getUserProblematicArticlesWeekly` (en
  rollout gradual, ver `docs/maintenance/despliegue-articulos-problematicos.md`).

## Cambios que requieren revisar scope

Cualquiera de estos cambios puede romper el aislamiento:

- Añadir un nuevo `positionType` a `POSITION_TYPES_ENUM` en
  `lib/config/oposiciones.ts` → asegurarse de que hay entradas en `topic_scope`.
- Crear un nuevo endpoint que devuelva preguntas → aplicar el patrón de arriba.
- Modificar `topic_scope` o `topics.position_type` en BD → el scope cambia
  automáticamente, ningún cambio de código necesario.

## No confiar nunca en positionType del cliente

El cliente puede mentir. Si un usuario Aux Estado envía
`positionType: 'auxiliar_administrativo_cyl'` en el body, el servidor debe
ignorar ese valor y derivar del `user_profiles.target_oposicion` autenticado.
Esa regla está aplicada en `app/api/questions/filtered/route.ts` (strip del
`userId` del body) y debe aplicarse en cualquier endpoint nuevo.
