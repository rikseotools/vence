# Crear una Nueva Oposicion - Guia Completa

Manual para escalar Vence a nuevas oposiciones. Basado en las implementaciones de CARM (Murcia) y CyL (Castilla y Leon), febrero 2026.

---

## Resumen de pasos

1. Base de datos: oposicion, topics, topic_scope
2. Config central: `lib/config/oposiciones.ts`
3. Schemas y validaciones (hay MUCHOS archivos con listas hardcodeadas)
4. Rutas Next.js: `app/<slug>/`
5. Home y SEO: `app/page.js`, sitemaps
6. Verificar build y tests

---

## Paso 1: Base de datos

### 1a. Insertar en tabla `oposiciones`

```sql
INSERT INTO oposiciones (
  nombre, tipo_acceso, administracion, categoria, slug,
  short_name, grupo, is_active, temas_count, bloques_count,
  titulo_requerido
) VALUES (
  'Nombre Completo de la Oposicion',
  'libre',
  'Comunidad Autonoma / Estado / Justicia',
  'C2',  -- o C1, A2, A1
  'slug-de-la-oposicion',        -- URL-friendly con guiones
  'Nombre Corto',
  'C2',
  true,
  16,   -- numero total de temas
  2,    -- numero de bloques
  'Graduado en ESO o equivalente'
);
```

### 1b. Insertar topics (16 rows ejemplo)

```sql
INSERT INTO topics (position_type, topic_number, title, description, difficulty, estimated_hours, is_active)
VALUES
  ('slug_con_underscores', 1, 'Titulo del Tema 1', 'Descripcion', 'medium', 10, true),
  ('slug_con_underscores', 2, 'Titulo del Tema 2', 'Descripcion', 'medium', 10, true),
  -- ... repetir para todos los temas
;
```

**IMPORTANTE:**
- `position_type` usa underscores (ej: `auxiliar_administrativo_carm`), NO guiones
- El slug de URL usa guiones (ej: `auxiliar-administrativo-carm`)

### 1c. Insertar topic_scope (mapeo temas a leyes)

Primero obtener los IDs de las leyes existentes:

```sql
SELECT id, short_name, name FROM laws WHERE short_name IN ('CE', 'Ley 39/2015', 'Ley 40/2015', 'RDL 5/2015');
```

Luego insertar los scopes:

```sql
INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES
  ('<topic_uuid>', '<law_uuid>', ARRAY['1','2','3','4','5']),
  ('<topic_uuid>', '<law_uuid>', NULL),  -- NULL = todos los articulos de la ley
;
```

**IMPORTANTE:**
- Usar los UUIDs COMPLETOS de las leyes (no truncados)
- `article_numbers: NULL` significa TODOS los articulos de esa ley
- Los temas sin ley asociada (contenido pendiente) se dejan SIN scope
- **Reutilizar topic_scope de otras oposiciones:** Antes de crear scope nuevo, comparar los epigrafes con los temas existentes (aux_estado, administrativo, CARM, etc.). Muchos temas comparten legislacion (CE, Ley 39/2015, TREBEP, LPRL, informatica...). Consultar topic_scope existente y copiar law_id + article_numbers. En CyL se activaron 15 de 28 temas asi.
- Los temas especificos de la comunidad autonoma (Estatuto, Cortes, Gobierno, Funcion Publica) necesitan scope nuevo con legislacion autonomica

### 1d. (Opcional) Actualizar perfil de usuario

```sql
UPDATE user_profiles SET target_oposicion = 'slug_con_underscores' WHERE email = 'usuario@email.com';
```

---

## Paso 2: Config central

### 2a. `lib/config/oposiciones.ts`

Anadir nueva entrada al array `OPOSICIONES`:

```typescript
{
  id: 'slug_con_underscores',
  slug: 'slug-con-guiones',
  positionType: 'slug_con_underscores',
  name: 'Nombre Completo de la Oposicion',
  shortName: 'Nombre Corto',
  emoji: '🏛️',
  badge: 'C2',
  color: 'amber',   // color tema Tailwind
  blocks: [
    {
      id: 'bloque1',
      title: 'Bloque I: Nombre del Bloque',
      subtitle: null,
      icon: '⚖️',
      themes: [
        { id: 1, name: 'Titulo tema 1' },
        // ...
      ]
    },
    {
      id: 'bloque2',
      title: 'Bloque II: Nombre del Bloque',
      subtitle: null,
      icon: '📋',
      themes: [
        { id: 10, name: 'Titulo tema 10' },
        // ...
      ]
    },
  ],
  totalTopics: 16,
  navLinks: [/* ... patron estandar ... */]
}
```

Este archivo es el "source of truth" para muchos componentes que importan desde aqui.

---

## Paso 3: Schemas y validaciones

> **Centralizado (Feb 2026):** La mayoria de schemas y APIs ahora importan automaticamente de `lib/config/oposiciones.ts`. Solo quedan 2 archivos con listas manuales de temas/bloques.

### Archivos que se actualizan AUTOMATICAMENTE (no tocar):

Estos archivos importan de la config central y se actualizan solos al modificar `lib/config/oposiciones.ts`:

| Archivo | Que importa de config central |
|---------|-------------------------------|
| `lib/api/theme-stats/schemas.ts` | `VALID_OPOSICIONES`, `OPOSICION_TO_POSITION_TYPE`, z.enum |
| `lib/api/topic-data/queries.ts` | `SLUG_TO_POSITION_TYPE` (mapa slug→positionType) |
| `lib/api/temario/schemas.ts` | `OPOSICIONES` (derivado automaticamente) |
| `lib/api/filtered-questions/schemas.ts` | `POSITION_TYPES_ENUM` (z.enum de positionTypes) |
| `app/api/topics/[numero]/route.ts` | `ALL_OPOSICION_SLUGS` (validacion de oposiciones) |
| `app/sitemap-static.xml/route.ts` | `OPOSICIONES` (paginas y temas generados dinamicamente) |

### Archivos que SI necesitan actualizacion manual:

| Archivo | Que actualizar |
|---------|---------------|
| `lib/api/topic-data/schemas.ts` | Solo `VALID_TOPIC_RANGES` (rangos de temas por bloque) |
| `components/test/TestHubPage.tsx` | Solo `BLOQUE_CONFIG` (rangos min/max para agrupar temas en el hub) |
| `components/InteractiveBreadcrumbs.js` | Deteccion `is*`, `getCurrentSection`, `getSectionOptions`, `showAsLink`, `linkHref`, `labelText`, `basePath`, condiciones de visibilidad |
| `components/OposicionDetector.js` | `OPOSICION_DETECTION` map |
| `components/OnboardingModal.js` | `OFFICIAL_OPOSICIONES` array |
| `components/UserProfileModal.js` | `getOposicionName` map |
| `app/perfil/page.tsx` | Array `oposiciones` del selector |
| `app/nuestras-oposiciones/page.js` | Array de tarjetas |
| `app/page.js` | Links en seccion "Test por Oposicion" y tarjeta en "Temarios Completos" |
| `app/sitemap-oposiciones.xml/route.ts` | Array `oposicionesList` |

### Tests a actualizar:

| Archivo | Que cambiar |
|---------|------------|
| `__tests__/api/theme-stats/themeStats.test.js` | `toHaveLength(N)` para VALID_OPOSICIONES y OPOSICION_TO_POSITION_TYPE |
| `__tests__/config/oposicionesCentralConfig.test.ts` | `toHaveLength(N)` para slugs y positionTypes |

### Detalle de archivos manuales:

#### `lib/api/topic-data/schemas.ts` (solo VALID_TOPIC_RANGES)

El z.enum y el mapa `OPOSICION_TO_POSITION_TYPE` ya se importan automaticamente. Solo hay que anadir los rangos de temas:

```typescript
export const VALID_TOPIC_RANGES = {
  ...,
  'slug-con-guiones': {
    bloque1: { min: 1, max: 9 },
    bloque2: { min: 10, max: 16 },
  },
}
```

**IMPORTANTE:** `OposicionKey` se define como `keyof typeof VALID_TOPIC_RANGES`, asi que al anadir aqui la oposicion automaticamente se acepta en las validaciones.

#### `components/test/TestHubPage.tsx` (solo BLOQUE_CONFIG)

El nombre/badge/icono ahora se obtiene automaticamente de `getOposicionBySlug()`. Solo hay que anadir la configuracion de bloques:

```typescript
const BLOQUE_CONFIG = {
  ...,
  'slug-con-guiones': [
    { id: 'bloque1', name: 'Bloque I: ...', icon: '⚖️', min: 1, max: 9 },
    { id: 'bloque2', name: 'Bloque II: ...', icon: '📋', min: 10, max: 16 },
  ],
}
```

#### `components/InteractiveBreadcrumbs.js`

Hay que anadir la nueva oposicion en **9 lugares diferentes** dentro de este archivo:

1. `getCurrentSection()` - pathname check para pagina principal
2. `const is<Nombre> = pathname.includes('/slug-con-guiones')` - nueva variable
3. `isStandaloneTest` - excluir de la condicion
4. `isInInfo` - anadir a la condicion
5. `getSectionOptions()` - anadir bloque con opciones (Info, Tests, Temario)
6. Condicion de visibilidad del breadcrumb de oposicion
7. `showAsLink`, `linkHref`, `labelText` - las tres cadenas ternarias
8. Condicion del separador
9. `basePath` en la seccion de Tests/Temario

#### `components/OposicionDetector.js`

```javascript
const OPOSICION_DETECTION = {
  ...,
  'slug-con-guiones': {
    id: 'slug_con_underscores',
    name: 'Nombre Completo',
    categoria: 'C2',
    administracion: 'autonomica',
    slug: 'slug-con-guiones'
  },
}
```

#### `components/OnboardingModal.js`

```javascript
const OFFICIAL_OPOSICIONES = [
  ...,
  {
    id: 'slug_con_underscores',
    nombre: 'Nombre Completo',
    categoria: 'C2',
    administracion: 'Autonomica',
    icon: '🏛️'
  },
]
```

#### `components/UserProfileModal.js`

```javascript
const oposiciones = {
  ...,
  'slug_con_underscores': 'Nombre Completo'
}
```

#### `app/perfil/page.tsx`

```typescript
const oposiciones = [
  ...,
  {
    value: 'slug_con_underscores',
    label: 'Nombre Completo',
    data: {
      name: 'Nombre Completo',
      slug: 'slug-con-guiones',
      categoria: 'C2',
      administracion: 'Autonomica'
    }
  }
]
```

#### `app/nuestras-oposiciones/page.js`

Anadir tarjeta con todos los datos de la oposicion (nombre, badge, color, descripcion, features, requirements, href).

---

## Paso 4: Rutas Next.js

Copiar estructura de una oposicion existente (ej: `app/tramitacion-procesal/`) adaptando:

```
app/<slug-con-guiones>/
  page.tsx                              -- Landing con metadata SEO
  test/
    page.tsx                            -- <TestHubPage oposicion="slug-con-guiones" />
    layout.tsx                          -- Metadata del layout
    aleatorio/page.tsx                  -- <RandomTestPage oposicion="slug-con-guiones" />
    test-personalizado/page.tsx         -- Config con positionType
    test-aleatorio-examen/page.tsx      -- Modo examen
    tema/[numero]/
      page.tsx                          -- Pagina de detalle del tema
      test-personalizado/page.js        -- Test personalizado por tema
      test-examen/page.js              -- Test examen por tema
  temario/
    layout.js                           -- Metadata
    page.tsx                            -- Lista de temas con TemarioClient
    TemarioClient.tsx                   -- Copiar y adaptar
    [slug]/
      page.tsx                          -- getTopicContent + generateStaticParams
      TopicContentView.tsx              -- Copiar y adaptar getBlockInfo
```

**Archivos que necesitan adaptacion especifica:**

- `page.tsx` (landing): metadata SEO, convocatoria, plazas, JSON-LD
- `test/tema/[numero]/page.tsx`: validacion de rango de temas, `getBloque()`
- `test/test-personalizado/page.tsx`: `OPOSICION_BLOCKS_CONFIG['slug-con-guiones']`
- `test/test-aleatorio-examen/page.tsx`: positionType
- `temario/page.tsx`: `BLOQUES` estatico con temas. **Marcar `disponible: false` en temas sin topic_scope**
- `temario/[slug]/page.tsx`: `generateStaticParams` con N temas
- `temario/[slug]/TopicContentView.tsx`: `getBlockInfo` con rangos correctos

---

## Paso 5: Home y SEO

### 5a. `app/page.js` (Home)

Anadir la oposicion en dos secciones:

**Seccion "Test por Oposicion"** - Anadir link bajo la categoria correspondiente (Administracion General, Comunidades Autonomas, Justicia):

```jsx
<p className="text-xs text-slate-500 ... uppercase tracking-wide pt-2">Comunidades Autonomas</p>
<Link href="/slug-con-guiones/test" className="block py-2 px-4 ...">
  Nombre Corto (C2)
</Link>
```

**Seccion "Temarios Completos"** - Anadir tarjeta:

```jsx
<Link href="/slug-con-guiones/temario" className="block py-4 px-4 ... relative">
  <span className="absolute top-2 right-2 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Nuevo</span>
  <span className="block text-2xl mb-2">🏛️</span>
  <span className="block font-medium ...">Nombre Corto</span>
  <span className="block text-xs ...">N temas</span>
</Link>
```

### 5b. `app/sitemap-static.xml/route.ts` (AUTOMATICO)

> **No necesita cambios manuales.** Este archivo genera automaticamente las paginas principales (landing, test, temario) y los temas del temario para todas las oposiciones importando desde `lib/config/oposiciones.ts`.

### 5c. `app/sitemap-oposiciones.xml/route.ts`

Anadir al array `oposicionesList`:

```typescript
const oposicionesList = [
  ...,
  'slug-con-guiones'
];
```

---

## Paso 6: Verificacion

### Build

```bash
npm run build
```

Debe completar sin errores. Las rutas de la nueva oposicion deben aparecer en el output.

### Tests

```bash
npm run test:ci
```

Si hay tests con `toHaveLength(N)` para conteos de oposiciones, actualizarlos.

### Funcional

1. `/<slug>/` - Landing carga correctamente
2. `/<slug>/test` - Hub de tests muestra todos los temas en bloques correctos
3. Temas sin topic_scope muestran "En desarrollo" (no clickeables)
4. `/<slug>/test/tema/X` - Carga datos del tema
5. `/<slug>/test/tema/X/test-personalizado` - Test funciona y carga preguntas
6. `/<slug>/temario` - Lista de temas
7. `/<slug>/temario/tema-X` - Contenido del tema
8. Breadcrumbs funcionan (dropdown cambia seccion, muestra nombre correcto)
9. Perfil: la oposicion aparece en el selector
10. Onboarding: la oposicion aparece para nuevos usuarios

---

## Errores frecuentes

### "Oposicion no valida"
Si la oposicion esta en `lib/config/oposiciones.ts`, las APIs la aceptan automaticamente. Si el error persiste, verificar que el slug esta bien escrito en la config central.

### "Parametros invalidos" en test personalizado
Verificar que el `positionType` esta en la config central. `filtered-questions/schemas.ts` ahora importa `POSITION_TYPES_ENUM` automaticamente.

### 404 en tema con contenido
Falta la oposicion en `lib/api/topic-data/schemas.ts` (`VALID_TOPIC_RANGES`). Este es uno de los 2 archivos que aun necesitan actualizacion manual.

### Breadcrumbs vacios o sin dropdown
Falta la oposicion en `components/InteractiveBreadcrumbs.js` (9 lugares a actualizar).

### Tema no aparece en hub de tests
Falta en `BLOQUE_CONFIG` de `components/test/TestHubPage.tsx`. Este es el otro archivo que necesita actualizacion manual de rangos.

### theme-stats devuelve 400
Si la oposicion esta en `lib/config/oposiciones.ts`, theme-stats la acepta automaticamente (importa `OPOSICION_SLUGS_ENUM` desde config central).

### Tests fallan con "Expected length: N"
Actualizar `__tests__/api/theme-stats/themeStats.test.js` y `__tests__/config/oposicionesCentralConfig.test.ts`.

### Temas sin contenido aparecen clickeables en el temario
En `app/<slug>/temario/page.tsx`, los temas sin topic_scope deben marcarse con `disponible: false` en el array `BLOQUES`. Si no, el usuario entra y ve "Contenido no disponible". El componente `TemarioClient.tsx` ya soporta este flag y muestra "En elaboracion" automaticamente.

### Oposicion no aparece en Google
Falta en los sitemaps (`app/sitemap-static.xml/route.ts` y/o `app/sitemap-oposiciones.xml/route.ts`).

### Oposicion no aparece en la home
Falta en `app/page.js` (seccion "Test por Oposicion" y/o "Temarios Completos").

---

## Convencion de nombres

| Contexto | Formato | Ejemplo |
|----------|---------|---------|
| URL / slug | guiones | `auxiliar-administrativo-carm` |
| BD position_type | underscores | `auxiliar_administrativo_carm` |
| BD oposicion id | underscores | `auxiliar_administrativo_carm` |
| Config id | underscores | `auxiliar_administrativo_carm` |
| Config slug | guiones | `auxiliar-administrativo-carm` |

---

## Nota sobre centralizacion (Feb 2026)

La mayoria de schemas y APIs se centralizaron para importar de `lib/config/oposiciones.ts`. Ahora anadir una oposicion requiere:

1. **`lib/config/oposiciones.ts`** - Source of truth (array OPOSICIONES)
2. **BD** - oposicion, topics, topic_scope
3. **2 archivos manuales** - `VALID_TOPIC_RANGES` y `BLOQUE_CONFIG` (rangos de temas divergen de la config por razones historicas)
4. **Rutas Next.js** - `app/<slug>/`
5. **Componentes UI** - InteractiveBreadcrumbs, OposicionDetector, OnboardingModal, UserProfileModal, perfil
6. **SEO** - Home, nuestras-oposiciones, sitemap-oposiciones

Los siguientes archivos ya NO necesitan actualizacion manual (importan de config central):
- `lib/api/theme-stats/schemas.ts`
- `lib/api/topic-data/queries.ts`
- `lib/api/temario/schemas.ts`
- `lib/api/filtered-questions/schemas.ts`
- `app/api/topics/[numero]/route.ts`
- `app/sitemap-static.xml/route.ts`
- `TestHubPage.tsx` (nombres/badges, pero BLOQUE_CONFIG sigue manual)
