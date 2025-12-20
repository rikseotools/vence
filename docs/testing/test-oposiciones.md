# 📋 Tests de Oposiciones - Manual de Implementación

> 🎯 **Sistema escalable** para crear tests organizados por títulos y capítulos de leyes

## 🏗️ Arquitectura del Sistema

### 📊 Base de Datos

#### Tabla: `law_sections`
Almacena la estructura jerárquica de cada ley (títulos, capítulos, secciones).

```sql
CREATE TABLE law_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- 'titulo', 'capitulo', 'seccion'
  section_number TEXT NOT NULL, -- 'I', 'II', 'preliminar', '1', '2'
  title TEXT NOT NULL,
  description TEXT,
  article_range_start INTEGER,
  article_range_end INTEGER,
  slug TEXT UNIQUE NOT NULL, -- para URLs amigables
  order_position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Relaciones:
- `law_id` → `laws.id` (Cada sección pertenece a una ley)
- `article_range_start/end` → Define qué artículos incluye cada sección

### 🗂️ Estructura de Archivos

```
app/test-oposiciones/
├── layout.js                              # Layout general
├── page.js                                # Índice de todas las leyes
└── test-[ley-slug]/
    ├── page.js                            # Landing page de la ley
    ├── layout.js                          # Metadata SEO de la ley
    └── [seccion-slug]/
        ├── page.js                        # Test de la sección
        └── layout.js                      # Metadata SEO de la sección
```

## 🚀 Implementación por Ley

### ✅ Estado Actual:

#### 🏛️ Constitución Española (CSR - Client-Side Rendering)
- **Método:** Datos hardcodeados en cada página
- **Renderizado:** CSR con `'use client'`
- **URLs:** `/test-oposiciones/test-de-la-constitucion-espanola-de-1978/[seccion]/`
- **Estado:** ✅ Funcionando completamente
- **Secciones:** 11 títulos + preámbulo + disposiciones
- **SEO:** ⚠️ Limitado (metadata estática)

#### ⚖️ Ley 39/2015 (SSR - Server-Side Rendering) 🌟
- **Método:** Tabla `law_sections` + SSR con metadata dinámica
- **Renderizado:** SSR con `generateMetadata` automático
- **URLs:** `/test-oposiciones/test-ley-39-2015/[seccion]/`
- **Estado:** ✅ Completamente optimizado para SEO
- **Secciones:** 15 títulos/capítulos + test de plazos
- **SEO:** ✅ Optimizado (pre-renderizado + metadata específica)

### 🎯 Patrones de Implementación

#### ❌ Opción A: CSR - Client-Side Rendering (Constitución)
```javascript
// ❌ NO recomendado para nuevas leyes
'use client'
const sectionConfig = {
  title: 'Título II. De la Corona',
  description: 'Test del Título II sobre la Corona (Art. 56-65)',
  lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  articleRange: { start: 56, end: 65 },
  slug: 'titulo-ii-de-la-corona'
}
```

#### ✅ Opción B: SSR - Server-Side Rendering (Ley 39/2015) - RECOMENDADO
```javascript
// ✅ PATRÓN RECOMENDADO para todas las nuevas leyes
import { loadSectionData, generateSectionMetadata } from '../../../lib/lawSSR'

// Metadata dinámica para SEO
export async function generateMetadata({ params }) {
  const data = await loadSectionData(params.seccion)
  return generateSectionMetadata(data.config)
}

// Pre-renderizado en servidor
export default async function SectionPage({ params }) {
  const { config, stats } = await loadSectionData(params.seccion)
  // Renderizado híbrido: SSR + componentes cliente donde necesario
}
```

### 🏗️ Arquitectura SSR vs CSR

#### CSR (Client-Side Rendering) - Constitución
```
Browser Request → HTML vacío → JS descarga → Datos fetch → Render
❌ SEO limitado: Buscadores ven contenido vacío inicial
❌ Metadata estática: No específica por sección  
❌ Tiempo de carga: Múltiples round-trips
✅ Interactividad: Inmediata una vez cargado
```

#### SSR (Server-Side Rendering) - Ley 39/2015 ⭐
```
Browser Request → Servidor procesa → HTML completo → Hidratación JS
✅ SEO optimizado: Contenido pre-renderizado para buscadores
✅ Metadata dinámica: Específica y optimizada por sección
✅ Tiempo de carga: Primer paint más rápido
✅ Interactividad: Componentes híbridos (SSR + client)
```

## 📝 Cómo Agregar una Nueva Ley (Patrón SSR) ⭐

> **IMPORTANTE:** Para todas las nuevas leyes, usar siempre el patrón SSR (Ley 39/2015) por SEO y rendimiento.

### Paso 1: Crear Estructura en Base de Datos

```javascript
// scripts/add-ley-[nombre]-structure.js
const leyStructure = [
  {
    law_id: 'UUID-DE-LA-LEY', // ID de la ley en tabla laws
    section_type: 'titulo',    // titulo, capitulo, seccion, libro, parte
    section_number: 'Preliminar',
    title: 'Título Preliminar - Disposiciones Generales',
    description: 'Disposiciones generales y principios básicos',
    article_range_start: 1,
    article_range_end: 12,
    slug: 'titulo-preliminar', // URL-friendly para routing
    order_position: 1
  },
  // ... más secciones
]

// Poblar automáticamente
await supabase.from('law_sections').insert(leyStructure)
```

### Paso 2: Crear Funciones SSR Helper

```javascript
// lib/[ley-short-name]SSR.js
import { createClient } from '@supabase/supabase-js'

// Cargar datos de la ley para página principal (SSR)
export async function loadLeyData() {
  const supabase = getServerSupabaseClient()
  // Lógica para cargar secciones + estadísticas
  return { sections, stats }
}

// Cargar datos de sección específica (SSR)
export async function loadSectionData(sectionSlug) {
  const supabase = getServerSupabaseClient()
  // Lógica para cargar config + stats de sección
  return { config, stats }
}

// Generar metadata dinámica para SEO
export function generateSectionMetadata(sectionConfig) {
  return {
    title: \`Test \${sectionConfig.title} - [Ley] | Vence\`,
    description: \`\${sectionConfig.description}. Artículos...\`,
    keywords: 'test [ley], [sección], oposiciones...'
  }
}
```

### Paso 3: Página Principal de la Ley (SSR)

```javascript
// app/test-oposiciones/test-[ley-slug]/page.js
import { loadLeyData } from '../../../lib/[ley]SSR'

// ✅ SSR: Pre-renderizado en servidor
export default async function TestLeyPage() {
  const { sections, stats } = await loadLeyData()
  
  return (
    <div>
      {/* Header con stats pre-renderizadas */}
      <div>{stats.totalSections} Secciones</div>
      <div>{stats.totalQuestions} Preguntas</div>
      
      {/* Grid de secciones pre-renderizado */}
      {sections.map(section => (
        <Link href={\`/test-oposiciones/test-[ley-slug]/\${section.slug}\`}>
          {section.title}
        </Link>
      ))}
    </div>
  )
}
```

### Paso 4: Páginas de Sección Individuales (SSR + Híbrido)

```javascript
// app/test-oposiciones/test-[ley-slug]/[seccion]/page.js
import { loadSectionData, generateSectionMetadata } from '../../../../lib/[ley]SSR'
import SectionClientComponents from './SectionClientComponents'

// ✅ Metadata dinámica para SEO óptimo
export async function generateMetadata({ params }) {
  const data = await loadSectionData(params.seccion)
  return generateSectionMetadata(data.config)
}

// ✅ SSR: Pre-renderizado en servidor  
export default async function SectionPage({ params }) {
  const { config, stats } = await loadSectionData(params.seccion)
  
  return (
    <div>
      {/* ✅ Contenido pre-renderizado para SEO */}
      <h1>{config.title}</h1>
      <p>{config.description}</p>
      <div>{stats.questionsCount} preguntas</div>
      
      {/* ✅ Componentes interactivos hidratados en cliente */}
      <SectionClientComponents.StartTestButton 
        sectionConfig={config}
        questionsCount={stats.questionsCount}
      />
      <SectionClientComponents.TabsSection sectionConfig={config} />
    </div>
  )
}
```

### Paso 5: Componentes Cliente Separados

```javascript
// app/test-oposiciones/test-[ley-slug]/[seccion]/SectionClientComponents.js
'use client' // ✅ Solo interactividad específica en cliente

export default {
  StartTestButton: ({ sectionConfig, questionsCount }) => {
    const [showTest, setShowTest] = useState(false)
    // Lógica interactiva para mostrar TestPageWrapper
  },
  
  TabsSection: ({ sectionConfig }) => {
    const [activeTab, setActiveTab] = useState('overview')
    // Tabs interactivos entre "Test" y "Contenido"
  }
}
```

### Paso 6: Layout con Metadata Base

```javascript
// app/test-oposiciones/test-[ley-slug]/layout.js
export const metadata = {
  title: 'Tests [Ley] - Todas las Oposiciones | Vence',
  description: 'Tests [ley] por títulos y capítulos. Oposiciones Auxiliar Administrativo, AGE, Técnico Gestión, Administración Local...',
  keywords: 'test [ley], [siglas], oposiciones auxiliar administrativo, AGE...',
  openGraph: { ... },
  twitter: { ... }
}
```

### Paso 7: Script de Automatización

```javascript
// scripts/generate-law-ssr-pages.js
// Genera automáticamente todas las páginas SSR para una ley
node scripts/generate-law-ssr-pages.js [ley-short-name]
```

## 🔧 Scripts de Utilidad

### Poblar Estructura de Ley
```bash
node scripts/add-ley-structure.js [ley-short-name]
```

### Verificar Estructura
```bash
node scripts/verify-law-structure.js [ley-short-name]
```

### Generar Páginas Automáticamente
```bash
node scripts/generate-law-pages.js [ley-short-name]
```

## 📊 Ejemplos de Estructuras

### Ley 39/2015 - Procedimiento Administrativo Común

```javascript
const ley39Structure = [
  {
    section_type: 'titulo',
    section_number: 'Preliminar',
    title: 'Título Preliminar de la Ley 39/2015',
    description: 'Disposiciones generales del procedimiento administrativo común',
    article_range_start: 1,
    article_range_end: 12,
    slug: 'titulo-preliminar'
  },
  {
    section_type: 'titulo',
    section_number: 'I',
    title: 'Título I - De los interesados en el procedimiento',
    description: 'Capacidad de obrar y concepto de interesado',
    article_range_start: 13,
    article_range_end: 20,
    slug: 'titulo-i-interesados'
  },
  // ... más títulos
]
```

### Código Penal (Ejemplo Futuro)

```javascript
const codigoPenalStructure = [
  {
    section_type: 'libro',
    section_number: 'I',
    title: 'Libro I - Disposiciones Generales',
    description: 'Principios generales del derecho penal',
    article_range_start: 1,
    article_range_end: 137,
    slug: 'libro-i-disposiciones-generales'
  },
  // ... más libros
]
```

## 🎯 Configuración de Tests

### TestPageWrapper Configuration

```javascript
const testConfig = {
  numQuestions: Math.min(stats?.questionsCount || 10, 20),
  excludeRecent: false,
  recentDays: 30,
  difficultyMode: 'random',
  adaptive: true,
  onlyOfficialQuestions: false,
  selectedLaws: ['LEY-SHORT-NAME'],
  selectedArticlesByLaw: {
    'LEY-SHORT-NAME': ['1', '2', '3', ...] // artículos específicos
  },
  customNavigationLinks: {
    backToLaw: {
      href: '/test-oposiciones/test-[ley-slug]',
      text: 'Volver a Tests de la [Ley]'
    }
  }
}
```

## 📈 SEO y URLs

### Estructura de URLs
```
/test-oposiciones/                                    # Índice general
├── test-de-la-constitucion-espanola-de-1978/        # Landing de Constitución
│   ├── titulo-ii-de-la-corona/                      # Test específico
│   └── titulo-i-derechos-y-deberes-fundamentales/   # Test específico
├── test-ley-39-2015/                                # Landing de Ley 39/2015
│   ├── titulo-preliminar/                           # Test específico
│   └── titulo-ii-capitulo-ii-terminos-plazos/       # Test específico
└── test-codigo-penal/                               # Futuro
    └── libro-i-disposiciones-generales/             # Futuro
```

### Keywords Objetivo
- `test [ley específica]`
- `test [título/capítulo específico]`
- `[ley] oposiciones [cargo]`
- `artículos [rango] [ley]`
- `preparar oposición [ley]`

## 🔄 Migración y Mantenimiento

### Hardcodeado → Base de Datos
Para migrar de hardcodeado a base de datos:

1. Extraer datos hardcodeados a script
2. Poblar tabla `law_sections`
3. Actualizar páginas para usar datos dinámicos
4. Verificar que todo funciona
5. Limpiar código hardcodeado

### Actualizaciones de Estructura
- Cambios en `law_sections` se reflejan automáticamente
- No requiere cambios en código
- Escalable para múltiples leyes

## 🚨 Consideraciones Importantes

### Rendimiento
- Usar `select('*')` específico, no `select('*')`
- Cachear datos de estructura cuando sea posible
- Índices en campos consultados frecuentemente

### SEO
- URLs semánticas y permanentes
- Metadata específica por sección
- Internal linking entre secciones relacionadas
- Sitemap.xml actualizado automáticamente

### Escalabilidad
- Estructura soporta cualquier tipo de ley
- `section_type` flexible (titulo, capitulo, libro, parte, etc.)
- `order_position` permite reordenar sin cambiar slugs

## ⚡ Mejores Prácticas SEO (Basadas en Ley 39/2015)

### 🎯 Metadata Dinámica
```javascript
// ✅ BIEN: Metadata específica por sección
export async function generateMetadata({ params }) {
  const data = await loadSectionData(params.seccion)
  return {
    title: `Test ${data.config.title} - Ley 39/2015 LPAC`,
    description: `${data.config.description}. Artículos ${data.config.articleRange.start}-${data.config.articleRange.end}. Oposiciones Auxiliar Administrativo, AGE, Técnico Gestión.`,
    keywords: `test ley 39/2015, ${data.config.slug}, LPAC, oposiciones auxiliar administrativo`
  }
}

// ❌ MAL: Metadata estática genérica
export const metadata = {
  title: 'Test de ley',
  description: 'Test genérico de ley'
}
```

### 🏗️ Estructura de URLs SEO-Friendly
```
✅ BIEN: /test-oposiciones/test-ley-39-2015/titulo-preliminar
   - Jerárquica y descriptiva
   - Keywords en URL
   - Consistente con estructura de ley

❌ MAL: /test/ley39/section1
   - URLs crípticas
   - Sin keywords
   - No descriptivas
```

### 📊 Pre-renderizado vs Client-Side
```javascript
// ✅ BIEN: SSR con datos pre-renderizados
export default async function SectionPage() {
  const { config, stats } = await loadSectionData(slug) // Servidor
  return <div>{config.title}</div> // HTML completo para crawlers
}

// ❌ MAL: CSR con carga cliente
'use client'
export default function SectionPage() {
  const [config, setConfig] = useState(null) // Cliente
  useEffect(() => loadData(), []) // Crawlers no ven contenido inicial
}
```

### 🔍 Contenido para Buscadores
```html
<!-- ✅ BIEN: Contenido estructurado y pre-renderizado -->
<h1>Test Título Preliminar de la Ley 39/2015</h1>
<p>Disposiciones generales del procedimiento administrativo común. Artículos 1-12.</p>
<div>20 preguntas disponibles</div>

<!-- ❌ MAL: Contenido vacío inicial -->
<div id="root"></div> <!-- JavaScript lo rellena después -->
```

### 📈 Monitoreo SEO
```bash
# Verificar pre-renderizado
curl -s https://vence.es/test-oposiciones/test-ley-39-2015/titulo-preliminar | grep -i "título preliminar"

# Verificar metadata
curl -s https://vence.es/... | grep -i "<title>"
curl -s https://vence.es/... | grep -i "<meta name=\"description\""

# Lighthouse SEO score
npx lighthouse https://vence.es/test-oposiciones/test-ley-39-2015 --only=seo
```

---

## ✅ Estado Final del Proyecto

### 📊 Progreso Completado:

1. ✅ **Tabla `law_sections`** creada en Supabase
2. ✅ **Ley 39/2015 SSR** - 15 secciones con metadata dinámica  
3. ✅ **Sistema híbrido** - SSR + componentes cliente
4. ✅ **SEO optimizado** - Pre-renderizado + metadata específica
5. ✅ **Templates automatizados** - Scripts para futuras leyes
6. ✅ **Documentación completa** - Guía para escalabilidad

### 🏆 Arquitectura Final:

```
📁 test-oposiciones/
├── 🏛️ Constitución (CSR) - Funcional, SEO limitado
└── ⚖️ Ley 39/2015 (SSR) ⭐ - Optimizada, SEO completo
    ├── 📊 Pre-renderizado servidor
    ├── 🎯 Metadata dinámica  
    ├── ⚡ Componentes híbridos
    └── 🔍 Indexación perfecta
```

### 🚀 Próximas Leyes:

> **Usar siempre el patrón Ley 39/2015 (SSR)** para:
> - ✅ SEO óptimo desde día 1
> - ✅ Mejor experiencia de usuario  
> - ✅ Escalabilidad automática
> - ✅ Maintenance simplificado

> 💡 **Nota:** Constitución se mantiene CSR por estabilidad. Nuevas leyes siempre SSR.