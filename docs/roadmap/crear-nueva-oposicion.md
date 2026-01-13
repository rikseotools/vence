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
       ├─ LO 6/1985 (LOPJ) → arts. 122-148, 541-584 (CGPJ + MF)
       ├─ CE → arts. 117-127 (Título VI)
       └─ Ley 38/1988 → toda la ley
```

### ⚠️ 2.3 CRÍTICO: article_numbers según epígrafe (NO toda la ley)

**ERROR COMÚN:** Incluir TODOS los artículos de una ley cuando el epígrafe solo menciona parte.

**Ejemplo del error:**
```
Tema 1: La Constitución
Epígrafe: "Corona. Cortes Generales. Tribunal Constitucional."

❌ INCORRECTO: article_numbers = [1-169] (toda la CE)
✅ CORRECTO:   article_numbers = [1-9, 56-65, 66-96, 159-165]
                                 (Preliminar, Corona, Cortes, TC)
```

**Regla:** Leer el epígrafe LITERAL y solo incluir los artículos que corresponden a lo mencionado.

**Tabla de referencia CE:**
| Contenido del Epígrafe | Título CE | Artículos |
|------------------------|-----------|-----------|
| Estructura, principios | Preliminar | 1-9 |
| Derechos fundamentales | I | 10-55 |
| Corona | II | 56-65 |
| Cortes Generales, elaboración leyes | III | 66-96 |
| Gobierno y Administración | IV | 97-107 |
| Relaciones Gobierno-Cortes | V | 108-116 |
| Poder Judicial | VI | 117-127 |
| Economía y Hacienda | VII | 128-136 |
| Organización territorial, CCAA | VIII | 137-158 |
| Tribunal Constitucional | IX | 159-165 |
| Reforma constitucional | X | 166-169 |

**Tabla de referencia LOPJ:**
| Contenido del Epígrafe | Libro/Título LOPJ | Artículos |
|------------------------|-------------------|-----------|
| TS, AN, TSJ, AP | Libro I Títulos I-IV | 53-81 |
| Tribunales Instancia, Juzgados Paz | Libro I Títulos V-VI | 82-106 |
| CGPJ | Libro II | 122-148 |
| Resoluciones judiciales | Libro III Título III | 244-269 |
| Oficina judicial, LAJ | Libro V | 435-469 |
| Cuerpos funcionarios | Libro VI | 470-540 |
| Ministerio Fiscal | Libro VII Título I | 541-584 |

**Verificación post-creación:**
Después de crear topic_scope, revisar tema por tema que los artículos correspondan al epígrafe, no a toda la ley.

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

### 3.7 🏛️ Importar Preguntas Oficiales (CRÍTICO)

Las preguntas de exámenes oficiales son **oro** porque indican qué artículos son importantes **para esta oposición específica**. Un artículo puede ser crítico para Tramitación pero irrelevante para Auxiliar.

#### Al insertar preguntas oficiales - OBLIGATORIO:

```sql
INSERT INTO questions (
  question_text,
  option_a, option_b, option_c, option_d,
  correct_option,
  primary_article_id,
  is_official_exam,        -- ✅ SIEMPRE true
  exam_source,             -- ✅ SIEMPRE especificar
  is_active
) VALUES (
  'Texto de la pregunta...',
  'Opción A', 'Opción B', 'Opción C', 'Opción D',
  0,  -- A=0, B=1, C=2, D=3
  'uuid-del-articulo',
  true,                                    -- ✅ CRÍTICO
  'Examen 2024 Tramitación Procesal',      -- ✅ CRÍTICO (año + oposición)
  true
);
```

#### Actualizar hot_articles después de importar:

La tabla `hot_articles` trackea qué artículos son importantes **por oposición**. Después de importar preguntas oficiales:

```sql
-- Recalcular hot_articles para la oposición
INSERT INTO hot_articles (
  article_id, law_id, target_oposicion, article_number, law_name,
  total_official_appearances, unique_exams_count, priority_level, hotness_score
)
SELECT
  a.id, a.law_id,
  'tramitacion_procesal',  -- ← Ajustar según oposición
  a.article_number, l.short_name,
  COUNT(*),
  COUNT(DISTINCT q.exam_source),
  CASE
    WHEN COUNT(*) >= 5 THEN 'critical'
    WHEN COUNT(*) >= 3 THEN 'high'
    WHEN COUNT(*) >= 2 THEN 'medium'
    ELSE 'low'
  END,
  COUNT(*) * 10
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.is_official_exam = true AND q.is_active = true
GROUP BY a.id, a.law_id, a.article_number, l.short_name
ON CONFLICT (article_id, target_oposicion)
DO UPDATE SET
  total_official_appearances = EXCLUDED.total_official_appearances,
  unique_exams_count = EXCLUDED.unique_exams_count,
  priority_level = EXCLUDED.priority_level,
  hotness_score = EXCLUDED.hotness_score,
  updated_at = NOW();
```

#### Comportamiento en la app:

1. **Si la pregunta ES oficial** (`is_official_exam = true`):
   - Badge púrpura: "🏛️ PREGUNTA DE EXAMEN OFICIAL"
   - Muestra fuente: "📋 Examen: {exam_source}"

2. **Si el artículo tiene preguntas oficiales** (aunque esta no lo sea):
   - Badge naranja: "🔥 Artículo importante - apareció en X exámenes oficiales"

**¡NUNCA añadir preguntas oficiales sin marcar `is_official_exam = true`!**

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
    ├── page.tsx               # Hub de tests (usa componente SSR compartido)
    ├── layout.tsx             # Metadata SEO
    ├── aleatorio/
    │   └── page.tsx           # Test aleatorio
    └── tema/
        └── [numero]/
            └── page.tsx       # Test por tema individual
```

#### Hub de Tests SSR (Componente Compartido)

El hub de tests usa un **componente SSR compartido** para mejor SEO y mantenimiento:

**Archivos del sistema:**
- `components/test/TestHubPage.tsx` - Server Component (obtiene temas de BD)
- `components/test/TestHubClient.tsx` - Client Component (interactividad)

**Para añadir nueva oposición, solo crear `app/<slug>/test/page.tsx`:**

```tsx
// app/<slug>/test/page.tsx - Solo 18 líneas
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests <Nombre Oposición> - Practica por Temas | Vence',
  description: 'Prepara tu oposición con tests organizados por temas...',
  keywords: ['test <oposicion>', 'oposiciones', ...],
}

export default function TestsPage() {
  return <TestHubPage oposicion="<slug>" />
}
```

**Configuración de bloques en `TestHubPage.tsx`:**

Si la nueva oposición tiene una estructura de bloques diferente, añadir en `BLOQUE_CONFIG`:

```typescript
const BLOQUE_CONFIG: Record<OposicionSlug, BloqueConfig[]> = {
  // ... existentes ...
  '<nuevo-slug>': [
    { id: 'bloque1', name: 'Bloque I: ...', icon: '🏛️', min: 1, max: 14 },
    { id: 'bloque2', name: 'Bloque II: ...', icon: '📋', min: 15, max: 28 },
  ],
}
```

Y en `OPOSICION_NAMES`:

```typescript
const OPOSICION_NAMES = {
  // ... existentes ...
  '<nuevo-slug>': { short: 'Nombre Corto', badge: 'C1', icon: '👤' },
}
```

**Beneficios del enfoque SSR:**
- SEO: Los temas aparecen en el HTML inicial (Google los indexa)
- Performance: Cache de 1 hora (`revalidate = 3600`)
- Mantenimiento: Un solo componente para todas las oposiciones
- Eficiencia: Temas vienen de BD, no hardcodeados

#### Componentes reutilizables (copiar y ajustar):

- `TemarioClient.tsx` - Ya usa prop `oposicion`, solo copiar
- `TopicContentView.tsx` - Ya usa prop `oposicion`, solo copiar
- `TestConfigurator` - Componente global, usar con `positionType="tramitacion_procesal"`

#### Cambios específicos en cada página:

1. **page.tsx principal:** Actualizar textos, estadísticas
2. **temario/page.tsx:** Actualizar `BLOQUES` con los temas correctos
3. **test/page.tsx:** Solo importar `TestHubPage` con el slug correcto
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

## Temas Transversales: Informática (Leyes Virtuales Compartidas)

Los temas de informática (Word, Excel, Windows, etc.) son **transversales** a varias oposiciones. Para evitar duplicar contenido, se usan **leyes virtuales compartidas**.

### Concepto

```
Pregunta de Word ────► Artículo virtual ────► Ley virtual "Procesadores de texto"
                                                        │
                              ┌──────────────────────────┼──────────────────────────┐
                              │                          │                          │
                              ▼                          ▼                          ▼
                    Auxiliar (tema 108)      Administrativo (tema 604)    Tramitación (tema 35)
```

**Una sola pregunta sirve para múltiples oposiciones.**

### Leyes Virtuales de Informática Disponibles

| Ley Virtual | ID | Preguntas |
|-------------|----|-----------:|
| Informática Básica | `82fd3977-ecf7-4f36-a6df-95c41445d3c2` | 471 |
| Windows 11 | `932efcfb-5dce-4bcc-9c6c-55eab19752b0` | 93 |
| Explorador Windows 11 | `9c0b25a4-c819-478c-972f-ee462d724a40` | 29 |
| Procesadores de texto (Word) | `86f671a9-4fd8-42e6-91db-694f27eb4292` | 1,091 |
| Excel | `c7475712-5ae4-4bec-9bd5-ff646c378e33` | 506 |
| Access | `b403019a-bdf7-4795-886e-1d26f139602d` | 383 |
| Correo electrónico (Outlook) | `c9df042b-15df-4285-affb-6c93e2a71139` | 307 |
| Internet | `7814de3a-7c9c-4045-88c2-d452b31f449a` | 369 |

**Total: ~3,249 preguntas de informática compartidas**

### Cómo Enlazar Temas de Informática

Para cada tema de informática de la nueva oposición, crear `topic_scope` apuntando a la ley virtual correspondiente:

```javascript
// Ejemplo: Enlazar tema 35 (Word) de Tramitación Procesal
await supabase.from('topic_scope').insert({
  topic_id: '<id-del-tema-35>',
  law_id: '86f671a9-4fd8-42e6-91db-694f27eb4292', // Procesadores de texto
  article_numbers: null // toda la ley
});
```

### Mapeo Típico de Temas de Informática

| Contenido | Ley Virtual a usar |
|-----------|-------------------|
| Informática básica, hardware, software | Informática Básica |
| Sistema operativo Windows | Windows 11 |
| Explorador de archivos | Explorador Windows 11 |
| Word, procesadores de texto | Procesadores de texto |
| Excel, hojas de cálculo | Excel |
| Access, bases de datos | Access |
| Outlook, correo electrónico | Correo electrónico |
| Internet, navegadores, web | Internet |

---

## Errores Comunes a Evitar

### Errores de Contenido
1. **NO buscar programa en webs de academias** - Siempre usar BOE oficial
2. **NO confiar ciegamente en embeddings** - Verificar con agente IA
3. **NO activar sin validar con exámenes reales** - Cobertura debe ser 100%
4. **NO añadir todas las leyes sugeridas** - Muchas son falsos positivos
5. **NO olvidar enlazar temas de informática** - Deben tener topic_scope a leyes virtuales compartidas (ver sección "Temas Transversales")

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

### Componentes Compartidos SSR (actualizar configuración)
- `components/test/TestHubPage.tsx` - Server Component del hub de tests (añadir `BLOQUE_CONFIG` y `OPOSICION_NAMES`)
- `components/test/TestHubClient.tsx` - Client Component para interactividad (no requiere cambios)

### Frontend (crear para cada nueva oposición)
- `app/<slug>/page.tsx` - Página principal
- `app/<slug>/temario/` - Páginas del temario
- `app/<slug>/test/page.tsx` - Hub de tests (solo importa `TestHubPage`)
- `app/nuestras-oposiciones/page.js` - Listado de oposiciones
