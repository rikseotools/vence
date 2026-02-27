# Crear una Nueva Oposicion - Guia Completa

Manual para escalar Vence a nuevas oposiciones. Basado en la implementacion real de Auxiliar Administrativo CARM (Murcia), febrero 2026.

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
- Reutilizar leyes existentes cuando el temario solape con otras oposiciones

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
        { number: 1, title: 'Titulo tema 1' },
        // ...
      ]
    },
    {
      id: 'bloque2',
      title: 'Bloque II: Nombre del Bloque',
      subtitle: null,
      icon: '📋',
      themes: [
        { number: 10, title: 'Titulo tema 10' },
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

**CRITICO: Hay MUCHOS archivos con listas de oposiciones validas. Hay que actualizar TODOS o la oposicion falla en diferentes puntos.**

### Lista completa de archivos a actualizar:

| Archivo | Que actualizar |
|---------|---------------|
| `lib/api/topic-data/schemas.ts` | z.enum en request schema, `OPOSICION_TO_POSITION_TYPE`, `VALID_TOPIC_RANGES` |
| `lib/api/topic-data/queries.ts` | `POSITION_TYPE_MAP` |
| `lib/api/temario/schemas.ts` | `OPOSICIONES` const |
| `lib/api/theme-stats/schemas.ts` | `VALID_OPOSICIONES` array, `OPOSICION_TO_POSITION_TYPE` |
| `lib/api/filtered-questions/schemas.ts` | z.enum de `positionType` (aparece 2 veces) |
| `app/api/topics/[numero]/route.ts` | Array `.includes()` de oposiciones validas |
| `components/test/TestHubPage.tsx` | `BLOQUE_CONFIG`, `OPOSICION_NAMES` |
| `components/test/TestHubClient.tsx` | Interface `Topic` (ya tiene `hasContent`) |
| `components/InteractiveBreadcrumbs.js` | Deteccion `is*`, `getCurrentSection`, `getSectionOptions`, `showAsLink`, `linkHref`, `labelText`, `basePath`, condiciones de visibilidad |
| `components/OposicionDetector.js` | `OPOSICION_DETECTION` map |
| `components/OnboardingModal.js` | `OFFICIAL_OPOSICIONES` array |
| `components/UserProfileModal.js` | `getOposicionName` map |
| `app/perfil/page.tsx` | Array `oposiciones` del selector |
| `app/nuestras-oposiciones/page.js` | Array de tarjetas |
| `app/page.js` | Links en seccion "Test por Oposicion" y tarjeta en "Temarios Completos" |
| `app/sitemap-static.xml/route.ts` | Paginas principales (landing, test, temario) + temas del temario |
| `app/sitemap-oposiciones.xml/route.ts` | Array `oposicionesList` |

### Tests a actualizar:

| Archivo | Que cambiar |
|---------|------------|
| `__tests__/api/theme-stats/themeStats.test.js` | `toHaveLength(N)` para VALID_OPOSICIONES y OPOSICION_TO_POSITION_TYPE |

### Detalle de cada archivo:

#### `lib/api/topic-data/schemas.ts`

```typescript
// 1. Anadir al z.enum
oposicion: z.enum([..., 'slug-con-guiones']),

// 2. Anadir al mapa
export const OPOSICION_TO_POSITION_TYPE = {
  ...,
  'slug-con-guiones': 'slug_con_underscores',
}

// 3. Anadir rangos de temas
export const VALID_TOPIC_RANGES = {
  ...,
  'slug-con-guiones': {
    bloque1: { min: 1, max: 9 },
    bloque2: { min: 10, max: 16 },
  },
}
```

#### `lib/api/topic-data/queries.ts`

```typescript
const POSITION_TYPE_MAP = {
  ...,
  'slug-con-guiones': 'slug_con_underscores',
}
```

#### `lib/api/temario/schemas.ts`

```typescript
export const OPOSICIONES = {
  ...,
  'slug-con-guiones': {
    id: 'slug_con_underscores',
    name: 'Nombre Completo',
    totalTopics: 16,
    positionType: 'slug_con_underscores',
  },
}
```

#### `lib/api/theme-stats/schemas.ts`

```typescript
export const VALID_OPOSICIONES = [
  ...,
  'slug-con-guiones',
] as const

export const OPOSICION_TO_POSITION_TYPE = {
  ...,
  'slug-con-guiones': 'slug_con_underscores',
}
```

#### `lib/api/filtered-questions/schemas.ts`

```typescript
// HAY DOS z.enum - actualizar AMBOS
positionType: z.enum([..., 'slug_con_underscores']),
```

**Nota:** Este schema usa `positionType` con underscores (no slug con guiones).

#### `app/api/topics/[numero]/route.ts`

```typescript
if (!oposicion || !['auxiliar-administrativo-estado', ..., 'slug-con-guiones'].includes(oposicion)) {
```

#### `components/test/TestHubPage.tsx`

```typescript
const BLOQUE_CONFIG = {
  ...,
  'slug-con-guiones': [
    { id: 'bloque1', name: 'Bloque I: ...', icon: '⚖️', min: 1, max: 9 },
    { id: 'bloque2', name: 'Bloque II: ...', icon: '📋', min: 10, max: 16 },
  ],
}

const OPOSICION_NAMES = {
  ...,
  'slug-con-guiones': { short: 'Nombre Corto', badge: 'C2', icon: '🏛️' },
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
- `temario/page.tsx`: `BLOQUES` estatico con temas
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

### 5b. `app/sitemap-static.xml/route.ts`

Anadir las 3 paginas principales y los temas del temario:

```typescript
// En el array staticPages:
{ loc: '/slug-con-guiones', priority: 0.9, changefreq: 'weekly' },
{ loc: '/slug-con-guiones/test', priority: 0.8, changefreq: 'weekly' },
{ loc: '/slug-con-guiones/temario', priority: 0.7, changefreq: 'monthly' },

// Temas del temario (despues de los staticPages):
for (let i = 1; i <= 16; i++) {
  urls.push(`
  <url>
    <loc>${SITE_URL}/slug-con-guiones/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
}
```

**Nota:** Si la oposicion usa numeracion por bloques (ej: 1-15, 101-111, 201-211), generar cada rango por separado.

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
Falta anadir el slug a alguna API. Buscar con grep:
```bash
grep -rn "auxiliar-administrativo-estado.*administrativo-estado" app/api/ lib/api/
```

### "Parametros invalidos" en test personalizado
Falta `positionType` en `lib/api/filtered-questions/schemas.ts` (z.enum). **Ojo: usa underscores, no guiones.**

### 404 en tema con contenido
Falta la oposicion en `lib/api/topic-data/schemas.ts` (VALID_TOPIC_RANGES o OPOSICION_TO_POSITION_TYPE).

### Breadcrumbs vacios o sin dropdown
Falta la oposicion en `components/InteractiveBreadcrumbs.js` (9 lugares a actualizar).

### Tema no aparece en hub de tests
Falta en `BLOQUE_CONFIG` de `components/test/TestHubPage.tsx`.

### theme-stats devuelve 400
Falta en `lib/api/theme-stats/schemas.ts` (VALID_OPOSICIONES).

### Tests fallan con "Expected length: N"
Actualizar `__tests__/api/theme-stats/themeStats.test.js`.

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

## Nota sobre escalabilidad

Muchos de estos archivos tienen listas hardcodeadas que deberian derivarse de la config central (`lib/config/oposiciones.ts`). En un futuro refactor, centralizar para que anadir una oposicion sea modificar un solo archivo + BD + rutas.

Archivos que YA usan la config central (no necesitan cambios manuales):
- `InteractiveBreadcrumbs.js` (dropdown de oposiciones, linea 64-70)
- `OposicionContext.js` (menu de oposiciones)

Archivos que todavia tienen listas hardcodeadas (candidatos a refactor):
- `InteractiveBreadcrumbs.js` (deteccion `is*` y condicionales)
- `app/api/topics/[numero]/route.ts`
- `lib/api/filtered-questions/schemas.ts`
- `lib/api/theme-stats/schemas.ts`
- `components/test/TestHubPage.tsx`
