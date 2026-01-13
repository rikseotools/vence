# Hoja de Ruta: Crear Nueva Oposición

> Proceso completo para añadir una nueva oposición a la plataforma con validación de cobertura al 100%.
>
> **Última actualización:** Enero 2026 (Tramitación Procesal)

## Resumen del Proceso

```
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 1: PREPARACIÓN                                                │
│  - Obtener programa oficial del BOE (NO de webs externas)           │
│  - Crear JSON del temario con epígrafes LITERALES                   │
│  - Verificar leyes disponibles en BD                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 2: ESTRUCTURA                                                 │
│  - Crear registro en oposiciones (INACTIVA)                         │
│  - Crear topics con epígrafes literales                             │
│  - Generar topic_scope inicial con leyes principales                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 3: VALIDACIÓN CON EXÁMENES (CRÍTICA)                          │
│  - Descargar exámenes oficiales PDF                                 │
│  - Parsear preguntas a JSON                                         │
│  - Validar cobertura con embeddings                                 │
│  - Verificar con agente IA                                          │
│  - Ajustar topic_scope hasta 100%                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 4: VALIDACIÓN DEL PROGRAMA COMPLETO                           │
│  - Analizar cada epígrafe con embeddings                            │
│  - Identificar leyes faltantes por tema                             │
│  - Verificar con agente IA (filtrar falsos positivos)               │
│  - Añadir leyes realmente necesarias                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 5: FRONTEND Y APIs (CRÍTICA)                                  │
│  - Actualizar 4 archivos de schemas/APIs                            │
│  - Crear rutas frontend en TypeScript (.tsx)                        │
│  - Añadir a página nuestras-oposiciones                             │
│  - Verificar que todas las rutas funcionan                          │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 6: ACTIVACIÓN                                                 │
│  - Verificar cobertura exámenes = 100%                              │
│  - Verificar todas las rutas frontend                               │
│  - Marcar oposición como activa                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Preparación

### 1.1 Obtener Programa Oficial del BOE

**IMPORTANTE:** El programa SIEMPRE se obtiene del BOE oficial, NO de webs de academias.

**Proceso:**
1. El usuario proporciona la URL del BOE de la convocatoria más reciente
2. Leer el BOE y extraer el **ANEXO VI** (o equivalente) con el programa
3. Copiar los epígrafes **LITERALES** de cada tema

**Ejemplo de URL BOE:**
```
https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-27053
```

**Datos a extraer:**
- Referencia BOE (ej: BOE-A-2025-27053)
- Fecha publicación
- Número de plazas (libres, discapacidad)
- Programa completo con epígrafes literales

### 1.2 Crear JSON del Temario

**Ubicación:** `data/temarios/<slug>.json`

**Estructura:**
```json
{
  "oposicion": {
    "nombre": "Tramitación Procesal y Administrativa",
    "slug": "tramitacion-procesal",
    "short_name": "Tramitación Procesal",
    "grupo": "C1",
    "administracion": "Administración de Justicia",
    "position_type": "tramitacion_procesal",
    "boe_referencia": "BOE-A-2025-27053",
    "boe_fecha": "2025-12-30",
    "plazas_libres": 1039,
    "plazas_discapacidad": 116,
    "titulo_requerido": "Bachillerato o equivalente"
  },
  "bloques": [
    { "numero": 1, "nombre": "Bloque I", "temas": [1, 2, 3, ...] }
  ],
  "temas": [
    {
      "numero": 1,
      "titulo": "La Constitución Española de 1978",
      "epigrafe": "La Constitución española de 1978: Estructura y contenido. Las atribuciones de la Corona..."
    }
  ],
  "leyes_principales": [
    "Constitución Española",
    "LOPJ - Ley Orgánica del Poder Judicial",
    ...
  ]
}
```

### 1.3 Verificar Leyes en BD

```bash
# Verificar que tenemos las leyes principales
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const leyes = ['LO 6/1985', 'Ley 1/2000', 'LECrim', ...];
  for (const ley of leyes) {
    const { data } = await supabase.from('laws').select('id, short_name').ilike('short_name', '%' + ley + '%');
    console.log(ley + ': ' + (data?.length ? '✅' : '❌'));
  }
})();
"
```

Si falta alguna ley, importarla primero con el script de importación.

---

## FASE 2: Estructura

### 2.1 Script de Creación

**Script:** `scripts/oposiciones/crear-<oposicion>.cjs`

El script debe:
1. Crear registro en `oposiciones` con `is_active = false`
2. Crear todos los `topics` con epígrafes literales
3. Crear `topic_scope` inicial vinculando leyes a temas

**Ejemplo de ejecución:**
```bash
node scripts/oposiciones/crear-tramitacion-procesal.cjs
```

**Output esperado:**
```
✅ Oposición creada: Tramitación Procesal y Administrativa
✅ Topics creados: 37
✅ Topic_scopes creados: 44
```

### 2.2 Estructura de topic_scope

**Concepto clave:**
- `topic` = Tema del temario (ej: Tema 6: El Poder Judicial)
- `topic_scope` = Qué leyes/artículos cubren ese tema

**Ejemplo:**
```
Tema 6: El Poder Judicial
  └─ topic_scope:
       ├─ LO 6/1985 (LOPJ) → arts. 1-50, 117-127
       ├─ CE → arts. 117-127
       └─ Ley 38/1988 → toda la ley
```

---

## FASE 3: Validación con Exámenes

### 3.1 Descargar Exámenes Oficiales

**Ubicación:** `data/examenes/<slug>/`

**Estructura:**
```
data/examenes/tramitacion-procesal/
  ├── fuentes.json          # URLs de los PDFs oficiales
  ├── pdfs/                  # PDFs descargados
  │   ├── 2018-libre-A.pdf
  │   └── 2018-libre-A.txt   # Texto extraído con pdftotext
  ├── 2018-libre-A.json      # Preguntas parseadas
  └── informe-cobertura.json # Resultado de validación
```

**Extraer texto de PDF:**
```bash
pdftotext -layout data/examenes/tramitacion-procesal/pdfs/2018-libre-A.pdf
```

### 3.2 Parsear Preguntas

**Script:** `scripts/oposiciones/parsear-examen-txt.cjs`

```bash
node scripts/oposiciones/parsear-examen-txt.cjs \
  data/examenes/tramitacion-procesal/pdfs/2018-libre-A.txt \
  data/examenes/tramitacion-procesal/2018-libre-A.json
```

**Formato de salida:**
```json
{
  "archivo": "2018-libre-A.txt",
  "total_preguntas": 104,
  "preguntas": [
    {
      "numero": 1,
      "texto": "La capacidad y legitimación para intervenir...",
      "opciones": {
        "A": "opción A",
        "B": "opción B",
        "C": "opción C",
        "D": "opción D"
      }
    }
  ]
}
```

### 3.3 Validar Cobertura con Regex

**Script:** `scripts/oposiciones/validar-cobertura-real.cjs`

```bash
node scripts/oposiciones/validar-cobertura-real.cjs tramitacion_procesal
```

**Proceso:**
1. Identifica ley mencionada en cada pregunta usando patrones regex
2. Verifica si esa ley está en el topic_scope
3. Clasifica: CUBIERTA, NO_CUBIERTA, SIN_LEY_IDENTIFICADA

### 3.4 Validar con Embeddings

**Script:** `scripts/oposiciones/analizar-preguntas-sin-ley.cjs`

```bash
node scripts/oposiciones/analizar-preguntas-sin-ley.cjs tramitacion_procesal
```

**Proceso:**
1. Para preguntas sin ley identificada por regex
2. Genera embedding de la pregunta
3. Busca artículos similares en BD
4. Verifica si están en topic_scope

### 3.5 Verificar con Agente IA

**Importante:** El embedding puede dar falsos positivos. Usar agente IA para verificar:

```
Para cada pregunta clasificada por embedding:
1. Leer la pregunta completa
2. Verificar si el artículo/ley asignado es correcto
3. Identificar la ley REAL si el embedding falló
```

### 3.6 Ajustar topic_scope

Añadir leyes faltantes según resultados de validación:

```javascript
// Ejemplo: Añadir Ley 7/1985 al tema 4
await supabase.from('topic_scope').insert({
  topic_id: tema4Id,
  law_id: ley7_1985Id,
  article_numbers: null  // null = toda la ley
});
```

**Iterar hasta cobertura 100%**

---

## FASE 4: Validación del Programa Completo

### 4.1 Por qué es necesaria

Los exámenes solo cubren lo que ha caído en años anteriores. El programa oficial puede tener contenido que nunca ha sido preguntado.

### 4.2 Validar Epígrafes

**Script:** `scripts/oposiciones/validar-programa-completo.cjs`

```bash
node scripts/oposiciones/validar-programa-completo.cjs tramitacion_procesal
```

**Proceso:**
1. Para cada tema, toma el epígrafe
2. Genera embedding del epígrafe
3. Busca artículos similares
4. Verifica si esos artículos están en el topic_scope DEL TEMA

### 4.3 Analizar con Agente IA

**CRÍTICO:** El embedding sugiere muchas leyes, pero muchas son falsos positivos.

Usar agente IA para analizar:
```
Para cada tema con cobertura < 80%:
1. Leer el epígrafe literal
2. Revisar las leyes sugeridas por embedding
3. Determinar cuáles son REALMENTE necesarias
4. Identificar falsos positivos a ignorar
```

**Criterios:**
- Si el epígrafe menciona "Tribunal Constitucional" → necesita LOTC
- Si menciona "procedimientos penales" → necesita LECrim (no CP)
- Ignorar reglamentos muy específicos
- Ignorar leyes de otros ámbitos (ej: LPI para tema de justicia)

### 4.4 Añadir Leyes Verificadas

Solo añadir las leyes que el agente IA confirmó como necesarias:

```javascript
const leyesAnadir = [
  { tema: 1, ley: 'LOTC' },      // Tribunal Constitucional
  { tema: 10, ley: 'RDL 6/2023' }, // Eficiencia digital
  { tema: 15, ley: 'LPRL' },     // Prevención riesgos
  // ... solo las confirmadas por IA
];
```

---

## FASE 5: FRONTEND Y APIs

### 5.1 Actualizar Schemas y APIs (CRÍTICO)

**IMPORTANTE:** Sin estos cambios, las páginas darán error 404 o "no disponible".

#### Archivos a modificar:

| Archivo | Qué añadir |
|---------|------------|
| `lib/api/topic-data/schemas.ts` | Añadir al enum `oposicion`, `OPOSICION_TO_POSITION_TYPE` y `VALID_TOPIC_RANGES` |
| `lib/api/topic-data/queries.ts` | Añadir al `POSITION_TYPE_MAP` |
| `app/api/topics/[numero]/route.ts` | Añadir a la validación de oposiciones |
| `lib/api/temario/schemas.ts` | Añadir a `OPOSICIONES` |
| `components/InteractiveBreadcrumbs.js` | Añadir detección, opciones y lógica de bloques |

#### Ejemplo para `lib/api/topic-data/schemas.ts`:

```typescript
// 1. Añadir al enum (línea ~10)
oposicion: z.enum(['auxiliar-administrativo-estado', 'administrativo-estado', 'tramitacion-procesal']),

// 2. Añadir al mapa de posición (línea ~148)
export const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',  // ← AÑADIR
} as const

// 3. Añadir rangos de temas (línea ~156)
export const VALID_TOPIC_RANGES = {
  // ... existentes ...
  'tramitacion-procesal': {
    bloque1: { min: 1, max: 15 },
    bloque2: { min: 16, max: 31 },
    bloque3: { min: 32, max: 37 },
  },
} as const
```

#### Ejemplo para `lib/api/temario/schemas.ts`:

```typescript
export const OPOSICIONES = {
  // ... existentes ...
  'tramitacion-procesal': {
    id: 'tramitacion_procesal',
    name: 'Tramitación Procesal y Administrativa',
    totalTopics: 37,
    positionType: 'tramitacion_procesal',
  },
} as const
```

#### Ejemplo para `components/InteractiveBreadcrumbs.js`:

Buscar y añadir en estos lugares:
1. `getCurrentSection()` - añadir pathname de la oposición
2. `oppositionOptions` - añadir opción con key, label, path, oposicionId
3. `const isTramitacionProcesal = pathname.includes(...)` - añadir detección
4. `isInInfo` - añadir pathname de la oposición
5. `OPOSICION_NAMES` - añadir nombre legible
6. `getSectionOptions()` - añadir caso con opciones de sección
7. En el JSX: añadir `isTramitacionProcesal` a todas las condiciones de renderizado
8. En la lógica de bloques/temas: añadir rangos de temas por bloque

### 5.2 Crear Rutas del Frontend (TypeScript)

**IMPORTANTE:** Crear SIEMPRE en TypeScript (.tsx), no JavaScript (.js).

#### Estructura de carpetas a crear:

```
app/<slug>/
├── page.tsx                    # Página principal de la oposición
├── temario/
│   ├── page.tsx               # Lista de temas
│   ├── layout.tsx             # Metadata SEO
│   ├── TemarioClient.tsx      # Copiar de otra oposición (reutilizable)
│   └── [slug]/
│       ├── page.tsx           # Detalle del tema
│       └── TopicContentView.tsx  # Copiar de otra oposición
└── test/
    ├── page.tsx               # Hub de tests
    ├── layout.tsx             # Metadata SEO
    ├── aleatorio/
    │   └── page.tsx           # Test aleatorio
    └── tema/
        └── [numero]/
            └── page.tsx       # Test por tema individual
```

#### Componentes reutilizables (copiar y ajustar):

- `TemarioClient.tsx` - Ya usa prop `oposicion`, solo copiar
- `TopicContentView.tsx` - Ya usa prop `oposicion`, solo copiar
- `TestConfigurator` - Componente global, usar con `positionType="tramitacion_procesal"`

#### Cambios específicos en cada página:

1. **page.tsx principal:** Actualizar textos, colores (purple para justicia), estadísticas
2. **temario/page.tsx:** Actualizar `BLOQUES` con los temas correctos
3. **test/page.tsx:** Actualizar `BLOQUE1_THEMES`, `BLOQUE2_THEMES`, etc.
4. **test/tema/[numero]/page.tsx:** Cambiar validación de rangos y `oposicion` en API calls

### 5.3 Añadir a Página de Oposiciones

Editar `app/nuestras-oposiciones/page.js` y añadir al array `oposiciones`:

```javascript
{
  id: 'tramitacion-procesal',
  name: 'Tramitación Procesal y Administrativa',
  shortName: 'Tramitación Procesal',
  badge: 'C1',
  icon: '⚖️',
  color: 'blue',  // Usar azul para consistencia con el resto de la app
  // ... resto de campos
  href: '/tramitacion-procesal',
  boeUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-27053'
}
```

### 5.4 Esquema de Colores

**IMPORTANTE:** Usar **azul** para todas las oposiciones, no colores diferentes por tipo.

- Los colores en las páginas de test (`test/page.tsx`, `test/tema/[numero]/page.tsx`) deben usar clases `blue-*` de Tailwind
- Mantener consistencia visual entre temario y tests
- Evitar morado/purple aunque parezca apropiado para oposiciones de justicia

---

## FASE 6: Activación

### 6.1 Verificación Final

```bash
# Validar cobertura de exámenes
node scripts/oposiciones/validar-cobertura-real.cjs tramitacion_procesal
# Debe dar: COBERTURA TOTAL: 100%

# Validar programa completo (informativo)
node scripts/oposiciones/validar-programa-completo.cjs tramitacion_procesal
```

### 6.2 Verificar Rutas Frontend

Probar manualmente:
- `/<slug>` - Página principal
- `/<slug>/temario` - Lista de temas
- `/<slug>/temario/tema-1` - Detalle de tema
- `/<slug>/test` - Hub de tests
- `/<slug>/test/tema/1` - Test de tema individual

### 6.3 Activar Oposición

```javascript
await supabase
  .from('oposiciones')
  .update({ is_active: true })
  .eq('slug', 'tramitacion-procesal');
```

---

## Scripts Disponibles

| Script | Descripción | Estado |
|--------|-------------|--------|
| `crear-tramitacion-procesal.cjs` | Crea oposición completa | ✅ Usado |
| `parsear-examen-txt.cjs` | Parsea TXT de examen a JSON | ✅ Usado |
| `validar-cobertura-real.cjs` | Valida con regex + embedding | ✅ Usado |
| `analizar-preguntas-sin-ley.cjs` | Analiza preguntas sin ley con embedding | ✅ Usado |
| `validar-programa-completo.cjs` | Valida cobertura del programa | ✅ Usado |

---

## Ejemplo Real: Tramitación Procesal (Enero 2026)

### Datos finales:
- **BOE:** BOE-A-2025-27053
- **Plazas:** 1.155 (1.039 libres + 116 discapacidad)
- **Temas:** 37 (31 derecho + 6 informática)
- **Topics:** 37
- **Topic_scopes:** 62
- **Leyes en scope:** 22+
- **Cobertura exámenes:** 100%

### Iteraciones realizadas:
1. Creación inicial: 44 topic_scopes
2. Validación exámenes: +6 scopes (Ley 7/1985, Ley 50/1997, TRRL, Ley 38/1988)
3. Validación programa: +12 scopes (LOTC, RDL 6/2023, LPRL, etc.)

### Leyes añadidas tras validación IA:
- LOTC → Tema 1 (Tribunal Constitucional)
- RDL 6/2023 → Temas 10, 31 (Eficiencia digital)
- LPRL → Tema 15 (Prevención riesgos)
- RDL 5/2015 (EBEP) → Temas 13, 14, 15 (Funcionarios)
- RD 1708/2011 → Tema 31 (Archivos)

---

## Errores Comunes a Evitar

### Errores de Contenido
1. **NO buscar programa en webs de academias** - Siempre usar BOE oficial
2. **NO confiar ciegamente en embeddings** - Verificar con agente IA
3. **NO activar sin validar con exámenes reales** - Cobertura debe ser 100%
4. **NO añadir todas las leyes sugeridas** - Muchas son falsos positivos
5. **NO olvidar los temas de informática** - No tienen topic_scope pero sí topics

### Errores de Frontend/APIs (Enero 2026)
6. **NO olvidar actualizar TODOS los schemas** - Hay 4 archivos diferentes que necesitan la nueva oposición:
   - `lib/api/topic-data/schemas.ts` (enum, mapa, rangos)
   - `lib/api/topic-data/queries.ts` (mapa duplicado)
   - `app/api/topics/[numero]/route.ts` (validación)
   - `lib/api/temario/schemas.ts` (OPOSICIONES)
7. **NO crear páginas en JavaScript (.js)** - Usar siempre TypeScript (.tsx)
8. **NO olvidar añadir a nuestras-oposiciones** - La oposición no aparecerá en el listado
9. **NO asumir que las APIs soportan la nueva oposición** - Verificar cada endpoint usado

---

## Archivos Relacionados

### Datos
- `data/temarios/<slug>.json` - JSON del temario
- `data/examenes/<slug>/` - Exámenes parseados

### Scripts
- `scripts/oposiciones/` - Scripts de creación y validación

### Base de Datos
- `db/schema.ts` - Schema Drizzle (topics, topic_scope, questions)

### APIs y Schemas (actualizar para cada nueva oposición)
- `lib/api/topic-data/schemas.ts` - Enum, mapas y rangos de temas
- `lib/api/topic-data/queries.ts` - Queries con mapa de position_type
- `lib/api/temario/schemas.ts` - Constante OPOSICIONES
- `app/api/topics/[numero]/route.ts` - Validación de oposiciones

### Frontend (crear para cada nueva oposición)
- `app/<slug>/page.tsx` - Página principal
- `app/<slug>/temario/` - Páginas del temario
- `app/<slug>/test/` - Páginas de tests
- `app/nuestras-oposiciones/page.js` - Listado de oposiciones
