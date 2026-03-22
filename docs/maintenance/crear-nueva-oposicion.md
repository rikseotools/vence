# Crear una Nueva Oposicion - Guia Completa

Manual para escalar Vence a nuevas oposiciones. Marzo 2026.

---

## Modelo de datos (entender antes de empezar)

```
Ley (laws)
  └─ Articulo (articles)          ← FUENTE DE VERDAD del contenido
       └─ Pregunta (questions)    ← Cuelga del articulo, NO del tema

Topic (topics)                    ← Tema del temario de UNA oposicion
  └─ Topic_scope                  ← Mapea el tema a leyes + articulos
       ├─ law_id + article_numbers['1','2','3']   ← articulos concretos
       └─ law_id + article_numbers: NULL           ← toda la ley
```

El articulo es la unidad base. Las preguntas se vinculan al articulo via `primary_article_id`. Los temas de cada oposicion se forman a traves de `topic_scope`, que dice "este tema incluye estos articulos de estas leyes".

**Consecuencia:** el mismo articulo y sus preguntas pueden servir para multiples oposiciones. Cuando creas topic_scope para una oposicion nueva, automaticamente hereda todas las preguntas que ya existen para esos articulos. No hay que duplicar nada.

**Ejemplo real:** El art. 14 de la CE tiene 50 preguntas. Esas 50 preguntas aparecen automaticamente en:
- Auxiliar Estado T1 (CE arts. 1-55)
- Auxiliar Madrid T1 (CE arts. 1-55)
- Administrativo Estado T1 (CE arts. 1-55)
- Tramitacion Procesal T1 (CE arts. 1-55)

---

## Resumen de fases

```
FASE 1: Programa oficial       → Leer BOE, extraer epigrafes literales
FASE 2: Base de datos          → oposicion, topics (con epigrafes)
FASE 3: Topic scope con IA     → Analizar epigrafes, mapear a leyes/articulos
FASE 4: Config y schemas       → oposiciones.ts, archivos manuales
FASE 5: Frontend               → Rutas Next.js, landing, temario, tests
FASE 6: Verificacion           → Build, tests, funcional
FASE 7: Examenes oficiales     → exam_position, hot_articles, mapas (si aplica)
```

---

## FASE 1: Programa oficial

### Obtener los epigrafes del BOE/BOCM

**CRITICO:** Los epigrafes se sacan SIEMPRE del boletin oficial (BOE o boletin autonomico). NUNCA de webs de academias.

1. Buscar la convocatoria en el boletin oficial
2. Localizar el ANEXO con el programa (suele ser el ultimo anexo)
3. Copiar los epigrafes LITERALES de cada tema

**Ejemplo:** Para Madrid, la Orden 264/2026 publicada en BOCM el 18/02/2026 contiene el programa en su anexo.

### Por que importan los epigrafes literales

El epigrafe determina EXACTAMENTE que articulos entran en el topic_scope. Ejemplo:

```
Epigrafe: "La Constitucion. Caracteristicas. Principios constitucionales.
           Derechos y deberes fundamentales. Su garantia y suspension."

→ CE arts. 1-55 (Titulo Preliminar + Titulo I) + art. 116 (estados excepcion)
→ NO incluye Titulo III (Cortes), Titulo IV (Gobierno), etc.
```

Si el epigrafe dijera "La Constitucion Española de 1978: estructura y contenido completo" entonces SI seria toda la CE. El epigrafe manda.

### Guardar el programa

Crear `data/temarios/<slug>.json` con los datos de la convocatoria y los epigrafes.

---

## FASE 2: Base de datos

### 2a. Insertar en tabla `oposiciones`

```sql
INSERT INTO oposiciones (
  nombre, tipo_acceso, administracion, categoria, slug,
  short_name, grupo, is_active, temas_count, bloques_count,
  titulo_requerido,
  diario_oficial, diario_referencia,
  programa_url, seguimiento_url
) VALUES (
  'Nombre Completo de la Oposicion',
  'libre',
  'Comunidad Autonoma / Estado / Justicia',
  'C2',
  'slug-de-la-oposicion',
  'Nombre Corto',
  'C2',
  false,    -- INACTIVA hasta verificar todo
  21,
  2,
  'Graduado en ESO o equivalente',
  'BOE',                                      -- o BOCM, BOJA, DOE, DOCM, etc.
  'BOE-A-2025-26262',                         -- referencia en el diario oficial
  'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',  -- URL al programa
  'https://sede.inap.gob.es/...'              -- URL de seguimiento del proceso
);
```

**Campos obligatorios de convocatoria:**
- `diario_oficial`: nombre del boletin (BOE, BOCM, BOJA, BOC, DOE, DOCM, DOGV, DOG, BOA, BOPA, BOIB, BORM, BOCYL)
- `diario_referencia`: referencia unica en el diario
- `programa_url`: URL directa al PDF/HTML con el programa oficial
- `seguimiento_url`: URL de la pagina de seguimiento del proceso selectivo (INAP, sede electronica, portal empleo publico)

**Campos opcionales de convocatoria (si se conocen):**
- `plazas_libres`, `plazas_promocion_interna`, `plazas_discapacidad`: numero de plazas
- `exam_date`: fecha del examen (YYYY-MM-DD)
- `inscription_start`, `inscription_deadline`: fechas de inscripcion
- `boe_publication_date`: fecha de publicacion en el boletin
- `salario_min`, `salario_max`: rango salarial anual bruto
- `is_convocatoria_activa`: true si hay convocatoria en curso

Estos campos se usan automaticamente en las landings dinamicas (ver FASE 5).

### 2b. Insertar topics con epigrafes literales

```sql
INSERT INTO topics (position_type, topic_number, title, description, epigrafe, difficulty, estimated_hours, is_active)
VALUES
  ('slug_con_underscores', 1, 'La Constitucion Espanola de 1978',
   'Caracteristicas. Los principios constitucionales y los valores superiores.',
   'La Constitucion Espanola de 1978. Caracteristicas. Los principios constitucionales y los valores superiores. Derechos y deberes fundamentales de los espanoles. Su garantia y suspension.',
   'medium', 12, true),
  -- ... repetir para todos los temas
;
```

**IMPORTANTE:**
- `position_type` usa underscores (ej: `auxiliar_administrativo_madrid`), NO guiones
- El slug de URL usa guiones (ej: `auxiliar-administrativo-madrid`)
- `epigrafe`: texto EXACTO del programa oficial (BOE/diario autonomico). Es la fuente de verdad para crear el topic_scope
- `description`: resumen corto para mostrar al usuario (puede ser mas breve que el epigrafe)

### 2b.1 Numeracion de temas: LEER LA CONVOCATORIA REAL

**CRITICO:** Cada oposicion tiene su propia estructura de numeracion en el programa oficial. NO asumir que todas son iguales.

Ejemplos reales de como numeran distintas convocatorias:

| Oposicion | Numeracion en el programa oficial |
|-----------|-----------------------------------|
| Auxiliar Estado (BOE) | Secuencial por bloques: Bloque I temas 1-16, Bloque II temas 101-112 |
| Administrativo Estado (BOE) | Reinicia en cada bloque: Bloque I 1-11, Bloque II 1-4, Bloque III 1-7... |
| Tramitacion Procesal (BOE) | Secuencial: temas 1-37 |
| Madrid (BOCM) | Secuencial: temas 1-21 |
| Aragon (BOA) | Parte comun 1-25 + Parte especifica E1-E5 |
| Asturias (BOPA) | Temas 1-20 + Ofimatica O1-O5 |

**Proceso para determinar el `topic_number` correcto:**

1. Leer la convocatoria REAL (PDF del boletin oficial)
2. Anotar como numera cada tema y cada bloque
3. Decidir como mapear a nuestro `topic_number`:
   - Si el programa usa numeracion secuencial (1-37) → usar esa directamente
   - Si reinicia por bloque (Bloque II tema 1) → usar prefijo de bloque (201, 301...)
   - Si tiene partes separadas (comun + especifica) → usar rangos distintos
4. **Documentar el mapeo** en `lib/config/oposiciones.ts` para que quede claro

**El `topic_number` en BD debe coincidir con lo que usa `oposiciones.ts` en blocks.themes[].id.** Si hay duda, consultar primero la config existente de oposiciones similares.

### 2c. Insertar convocatoria con enlaces oficiales

```sql
INSERT INTO convocatorias (
  oposicion_id, año, fecha_examen, tipo_examen,
  plazas_convocadas, boe_fecha,
  boletin_oficial_url, pagina_informacion_url,
  observaciones
) VALUES (
  '<uuid-oposicion>',
  2026,
  '2026-10-01',        -- fecha estimada del examen
  'ordinaria',
  645,
  '2026-02-18',        -- fecha de publicacion en el boletin
  'https://www.bocm.es/...',      -- PDF del boletin oficial (BOE, BOCM, BORM, BOJA...)
  'https://www.comunidad.madrid/...', -- pagina oficial de seguimiento del proceso
  'Orden 264/2026, de 4 de febrero. BOCM num. 41, 18/02/2026.'
);
```

Estos enlaces se muestran automaticamente en la landing via el componente `<ConvocatoriaLinks>`.

---

## FASE 3: Topic scope con IA (CRITICO)

Esta es la fase mas importante. Determina que preguntas vera el usuario en cada tema.

### 3a. Concepto

El topic_scope dice: "Para el tema X de esta oposicion, las preguntas salen de estos articulos de estas leyes."

```
topic_scope = {
  topic_id:        UUID del topic
  law_id:          UUID de la ley
  article_numbers: ['1','2','3'] o NULL (toda la ley)
}
```

### 3b. Proceso para cada tema

Para cada tema, seguir estos pasos:

**1. Leer el epigrafe literal**

```
Tema 5: "El acto administrativo. Caracteristicas generales. Requisitos.
         Eficacia. Actos nulos y anulables. La revision de los actos
         administrativos. Los recursos administrativos: Concepto y clases.
         Responsabilidad de las autoridades y personal al servicio de las
         Administraciones Publicas."
```

**2. Identificar las leyes que corresponden**

Del epigrafe se deduce:
- Acto administrativo, requisitos, eficacia, nulidad → Ley 39/2015 (Titulo III y IV)
- Recursos administrativos → Ley 39/2015 (Titulo V)
- Revision de actos → Ley 40/2015 (Titulo Preliminar, Cap. II revision)
- Responsabilidad → Ley 40/2015 (Titulo Preliminar, Cap. IV)

**3. Seleccionar los articulos CONCRETOS (no la ley entera)**

```
Ley 39/2015 → arts. 34-52 (actos) + 106-126 (recursos)
Ley 40/2015 → arts. 32-37 (revision y responsabilidad)
```

NO meter toda la Ley 39/2015 (133 articulos). Solo los que corresponden al epigrafe.

**4. Verificar con oposiciones existentes**

Antes de inventar, consultar como tienen el scope oposiciones similares:

```javascript
// Ver scope de un tema similar en otra oposicion
const { data } = await supabase
  .from('topic_scope')
  .select('law_id, article_numbers, laws(short_name)')
  .eq('topic_id', '<uuid-tema-similar-otra-oposicion>');
```

Los topic_scope de temas compartidos (CE, LPAC, TREBEP, LCSP, igualdad, ofimatica) suelen ser identicos o muy similares entre oposiciones.

### 3c. Reutilizar de otras oposiciones

Muchos temas son comunes entre oposiciones. La regla:

| Si el epigrafe menciona... | Reutilizar scope de... |
|----------------------------|------------------------|
| CE, derechos fundamentales | Cualquier T1 de auxiliar |
| LPAC, procedimiento | Aux Estado T11 o CARM T5-T7 |
| TREBEP, empleado publico | Aux Estado T13-T14 o CARM T8 |
| Transparencia + LOPD | Aux Estado T7+T12 o CARM T16 |
| Contratos sector publico | Aux Estado T9 o CARM T9 |
| Igualdad, violencia genero | Aux Estado T16 |
| Seguridad Social | Aux Estado T11 (LGSS) |
| Ofimatica (Word, Excel...) | Leyes virtuales compartidas |

**Leyes virtuales de ofimatica** (compartidas entre todas las oposiciones):

| Contenido | law_id | Notas |
|-----------|--------|-------|
| Informatica Basica | `82fd3977-ecf7-4f36-a6df-95c41445d3c2` | |
| Windows 11 | `932efcfb-5dce-4bcc-9c6c-55eab19752b0` | Para opos que piden W11 |
| Windows 10 | `cb536623-fb75-429c-a839-0154b76ee27b` | Para opos que piden W10 (CLM, EXT, VAL) |
| Explorador Windows 11 | `9c0b25a4-c819-478c-972f-ee462d724a40` | |
| Explorador Windows 10 | `9a4d819f-50d6-421b-b3ea-d66d72b8524b` | Para Madrid T16, CLM T15 |
| Procesadores de texto (Word) | `86f671a9-4fd8-42e6-91db-694f27eb4292` | |
| Excel | `c7475712-5ae4-4bec-9bd5-ff646c378e33` | |
| Access | `b403019a-bdf7-4795-886e-1d26f139602d` | |
| Correo electronico (Outlook) | `c9df042b-15df-4285-affb-6c93e2a71139` | |
| Internet | `7814de3a-7c9c-4045-88c2-d452b31f449a` | |

### 3d. Temas especificos de comunidad autonoma

Los temas de legislacion autonomica (Estatuto de Autonomia, Ley de Gobierno, Hacienda autonomica, Funcion Publica autonomica) NO se pueden reutilizar de otras oposiciones. Opciones:

1. **Si la ley autonomica esta en BD:** Crear topic_scope normal
2. **Si NO esta en BD:** Dejar el tema SIN scope. Se marca como `disponible: false` en el temario. Se puede importar la ley despues y el tema se activa automaticamente al crear el scope.

### 3e. Error clasico: meter ley entera

```
Tema 4: "Las fuentes del ordenamiento juridico. La Constitucion. Las Leyes.
         Decretos-leyes y Decretos legislativos. Los reglamentos."

MAL:  CE → arts. 1-169 (toda la CE)
BIEN: CE → arts. 1, 9, 53, 81-87, 93-94, 96-97, 128, 133, 149, 150
      (solo los articulos que hablan de tipos de normas y fuentes)
```

Meter la ley entera diluye el tema con preguntas irrelevantes. El usuario de Tema 4 veria preguntas sobre la Corona o el Poder Judicial, que no tienen nada que ver.

### 3f. Verificar resultado

Despues de crear todos los scopes, contar preguntas por tema:

```javascript
// Para cada topic, contar preguntas via scope → articles → questions
for (const topic of topics) {
  const scopes = await getScopes(topic.id);
  let total = 0;
  for (const scope of scopes) {
    const articles = await getArticles(scope.law_id, scope.article_numbers);
    for (const art of articles) {
      total += await countQuestions(art.id);
    }
  }
  console.log(`T${topic.topic_number}: ${total} preguntas`);
}
```

Temas con 0 preguntas = o falta scope, o falta la ley en BD, o no hay preguntas para esos articulos.

### 3g. Ejemplo real: Auxiliar Madrid (marzo 2026)

21 temas, 34 topic_scopes creados, 8.601 preguntas reutilizadas:

| Tema | Leyes en scope | Preguntas |
|------|---------------|-----------|
| T1 CE | CE (arts. 1-55, 116) | 396 |
| T2 Estatuto CAM | SIN SCOPE (ley no en BD) | 0 |
| T3 Gobierno CAM | SIN SCOPE (ley no en BD) | 0 |
| T4 Fuentes | CE + Ley 39 + Ley 40 + CC | 362 |
| T5 Acto admin. | Ley 39 + Ley 40 | 402 |
| T6 LPAC | Ley 39/2015 | 799 |
| T7 LJCA | Ley 29/1998 | 424 |
| T8 Transparencia | Ley 19/2013 + LO 3/2018 + RGPD | 711 |
| T9 Contratos | Ley 9/2017 | 78 |
| T10 TREBEP | RDL 5/2015 | 781 |
| T11 Seg. Social | RDL 8/2015 | 94 |
| T12 Hacienda | Ley 47/2003 (parcial) | 382 |
| T13 Igualdad | LO 3/2007 + LO 1/2004 + Ley 15/2022 + Ley 4/2023 | 274 |
| T14 Admin electr. | Ley 39 + Ley 40 + RD 203/2021 | 368 |
| T15 Documentos | Ley 39 + Ley 40 + RD 1708 + RD 203 | 201 |
| T16-21 Ofimatica | Leyes virtuales compartidas | 3.329 |

---

## FASE 4: Config y schemas

### 4a. `lib/config/oposiciones.ts` (source of truth)

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
  color: 'amber',
  blocks: [
    {
      id: 'bloque1',
      title: 'Bloque I: Nombre del Bloque',
      subtitle: null,
      icon: '⚖️',
      themes: [
        { id: 1, name: 'Titulo tema 1' },
        // id = topic_number en BD (lo que usan las APIs)
        // Si el id interno no coincide con el numero visible al usuario,
        // anadir displayNumber: N (ver oposiciones.ts header para detalles)
      ]
    },
  ],
  totalTopics: 21,
  navLinks: [/* patron estandar */]
}
```

### 4b. Archivos que se actualizan AUTOMATICAMENTE (no tocar)

Importan de `lib/config/oposiciones.ts` y se actualizan solos:

- `lib/api/theme-stats/schemas.ts`
- `lib/api/topic-data/queries.ts`
- `lib/api/temario/schemas.ts`
- `lib/api/filtered-questions/schemas.ts`
- `lib/api/random-test-data/schemas.ts`
- `app/api/random-test-data/route.ts`
- `app/api/random-test-data/theme-details/route.ts`
- `app/api/topics/[numero]/route.ts`
- `app/sitemap-static.xml/route.ts`
- `app/sitemap-oposiciones.xml/route.ts`
- `components/test/TestHubPage.tsx`
- `components/OposicionDetector.tsx`
- `components/UserProfileModal.js`

### 4c. Archivos que SI necesitan actualizacion manual

| Archivo | Que actualizar |
|---------|---------------|
| `lib/api/topic-data/schemas.ts` | `VALID_TOPIC_RANGES` (rangos de temas por bloque) |
| `components/InteractiveBreadcrumbs.js` | 9 lugares (ver detalle abajo) |
| `components/OnboardingModal.js` | `OFFICIAL_OPOSICIONES` array |
| `app/perfil/page.tsx` | Array `oposiciones` del selector |
| `app/nuestras-oposiciones/page.js` | Tarjeta de la oposicion |
| `app/page.js` | Links en "Test por Oposicion" y tarjeta en "Temarios" |

### 4d. Tests a actualizar

| Archivo | Que cambiar |
|---------|------------|
| `__tests__/api/theme-stats/themeStats.test.js` | `toHaveLength(N)` |
| `__tests__/config/oposicionesCentralConfig.test.ts` | `toHaveLength(N)` |

### 4e. InteractiveBreadcrumbs.js (9 lugares)

1. `getCurrentSection()` - pathname check
2. `const is<Nombre> = pathname.includes('/slug-con-guiones')` - nueva variable
3. `isStandaloneTest` - excluir de la condicion
4. `isInInfo` - anadir a la condicion
5. `getSectionOptions()` - anadir bloque con opciones
6. Condicion de visibilidad del breadcrumb
7. `showAsLink`, `linkHref`, `labelText` - cadenas ternarias
8. Condicion del separador
9. `basePath` en la seccion de Tests/Temario

---

## FASE 5: Frontend

Copiar estructura de una oposicion existente (ej: `app/tramitacion-procesal/`):

```
app/<slug-con-guiones>/
  page.tsx                              -- Landing dinamica con datos de BD
  test/
    page.tsx                            -- <TestHubPage oposicion="slug" />
    layout.tsx                          -- Metadata
    aleatorio/page.tsx                  -- <RandomTestPage oposicion="slug" />
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

**En `temario/page.tsx`:** marcar `disponible: true` los temas que YA tienen topic_scope con preguntas. Los temas SIN scope (ej: leyes autonomicas no importadas) se dejan como `disponible: false` — el componente TemarioClient muestra "En elaboracion" automaticamente.

### 5a. Landing page dinamica (PATRON ACTUAL - marzo 2026)

Usar `app/auxiliar-administrativo-estado/page.tsx` como referencia. La landing lee datos de BD:

```tsx
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

export const revalidate = 86400 // ISR 24h en Vercel

export default async function LandingPage() {
  const data = await getOposicionLandingData('slug-con-guiones')
  const hitos = await getHitosConvocatoria('slug-con-guiones')

  // Datos con fallbacks
  const plazasLibres = data?.plazasLibres ?? 0
  const boeRef = data?.boeReference ?? ''
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  // ...etc
}
```

**Datos dinamicos de tabla `oposiciones`:**
- Plazas (libres, promocion, discapacidad)
- Fechas (examen, inscripcion inicio/fin, publicacion BOE)
- BOE reference y diario oficial
- Salario min/max
- Titulo requerido
- URLs (programa_url → link BOE, seguimiento_url → link INAP/sede)

**Helpers de formato (definir en el page.tsx):**
- `formatNumber(n)` → regex `\B(?=(\d{3})+(?!\d))` (NO usar toLocaleString, falla en servidores sin es-ES)
- `formatDateLarga(str)` → "22 de diciembre de 2025"
- `formatDateCorta(str)` → "22/12/2025"

**Estado de inscripcion (derivado):**
```tsx
const inscripcionCerrada = data?.inscriptionDeadline
  ? new Date(data.inscriptionDeadline) < new Date()
  : true
```

**Links oficiales:** se renderizan como tarjetas fuera de la seccion verde de convocatoria (2 columnas, iconos, hover effects).

### 5b. Timeline de hitos del proceso selectivo

La tabla `convocatoria_hitos` almacena los hitos del proceso:

```sql
INSERT INTO convocatoria_hitos (oposicion_id, fecha, titulo, descripcion, url, status, order_index)
VALUES
  ('<uuid>', '2025-12-22', 'Convocatoria publicada en BOE', 'BOE-A-2025-26262', 'https://...', 'completed', 1),
  ('<uuid>', '2026-01-22', 'Cierre plazo inscripcion', NULL, NULL, 'completed', 2),
  ('<uuid>', '2026-05-23', 'Examen', 'Ejercicio unico 90 min', NULL, 'upcoming', 3);
```

**Status de cada hito:**
- `completed` → check verde, texto normal
- `current` → circulo azul animado, badge "En curso"
- `upcoming` → circulo gris, texto opaco

El timeline se renderiza entre los links oficiales y el temario. Los hitos con `url` son clickeables.

**JSON-LD Event:** Ademas del FAQPage schema, se genera un schema `Event` con la fecha del examen para rich snippets de Google.

### 5c. Monitoreo de seguimiento (automatico)

Al crear la oposicion con `seguimiento_url`, el cron diario (`/api/cron/check-seguimiento`) empezara a monitorearla automaticamente. Cuando detecte cambios:

1. Badge "CAMBIO" en `/admin/seguimiento-convocatorias`
2. El admin avisa a Claude
3. Claude lee la pagina de seguimiento, extrae los hitos nuevos
4. Actualiza `convocatoria_hitos` (INSERT nuevos, UPDATE status de existentes)
5. La landing se regenera en 24h (ISR) con el timeline actualizado

---

## FASE 6: Verificacion

### Build y tests

```bash
npm run build     # Sin errores
npm run test:ci   # Actualizar toHaveLength si procede
```

### Funcional

1. `/<slug>/` - Landing carga
2. `/<slug>/test` - Hub muestra temas en bloques correctos
3. `/<slug>/test/aleatorio` - Genera test con preguntas
4. `/<slug>/test/tema/X` - Carga datos del tema
5. `/<slug>/test/tema/X/test-personalizado` - Test funciona
6. `/<slug>/temario` - Lista de temas (sin scope → "En elaboracion")
7. `/<slug>/temario/tema-X` - Contenido del tema
8. Breadcrumbs funcionan
9. Perfil: oposicion aparece en selector
10. Onboarding: oposicion aparece para nuevos usuarios

---

## FASE 7: Examenes oficiales (si se importan)

Si la oposicion tiene examenes oficiales anteriores y se importan preguntas:

### 7a. Campo `exam_position` en preguntas (OBLIGATORIO)

Todas las preguntas oficiales DEBEN tener `exam_position` relleno con el `position_type` de la oposicion:

```sql
UPDATE questions
SET exam_position = 'auxiliar_administrativo_madrid'
WHERE is_official_exam = true
  AND exam_source ILIKE '%Madrid%'
  AND exam_position IS NULL;
```

El sistema usa `exam_position` (campo estructurado) para filtrar preguntas oficiales por oposicion. Sin este campo, las preguntas no apareceran en el modo examen oficial.

### 7b. Tabla `hot_articles` (para badges "OFICIAL" en ArticleModal)

Cuando un usuario abre un articulo, el modal muestra si ese articulo ha aparecido en examenes oficiales de **su oposicion**. Esto se controla via la tabla `hot_articles`:

```sql
INSERT INTO hot_articles (
  article_id, law_id, target_oposicion,
  article_number, law_name,
  total_official_appearances, unique_exams_count,
  priority_level, hotness_score
)
SELECT
  a.id, a.law_id,
  'auxiliar-administrativo-madrid',  -- GUIONES, no underscores
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
WHERE q.is_official_exam = true
  AND q.exam_position = 'auxiliar_administrativo_madrid'
  AND q.is_active = true
GROUP BY a.id, a.law_id, a.article_number, l.short_name
ON CONFLICT (article_id, target_oposicion)
DO UPDATE SET
  total_official_appearances = EXCLUDED.total_official_appearances,
  unique_exams_count = EXCLUDED.unique_exams_count,
  priority_level = EXCLUDED.priority_level,
  hotness_score = EXCLUDED.hotness_score,
  updated_at = NOW();
```

**IMPORTANTE:**
- `target_oposicion` en `hot_articles` usa **guiones** (ej: `auxiliar-administrativo-madrid`)
- `exam_position` en `questions` usa **underscores** (ej: `auxiliar_administrativo_madrid`)
- Si no hay filas en `hot_articles` para la oposicion, simplemente no se muestran badges oficiales (correcto)

### 7c. Mapa `oposicionToExamPosition` (solo para modo examen oficial completo)

Si la oposicion tiene el modo "Examen Oficial" (reproducir un examen real completo), anadir entrada en `lib/api/official-exams/queries.ts`:

```typescript
const oposicionToExamPosition: Record<string, string> = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo_estado',
  'tramitacion-procesal': 'tramitacion_procesal',
  'auxilio-judicial': 'auxilio_judicial',
  // Anadir nueva:
  'auxiliar-administrativo-madrid': 'auxiliar_administrativo_madrid',
}
```

Y tambien en `oposicionToExamSourcePattern` (fallback para preguntas psicotecnicas que no tienen campo `exam_position`).

---

## Errores frecuentes

| Error | Causa | Solucion |
|-------|-------|----------|
| "Oposicion no valida" | Falta en `oposiciones.ts` | Anadir a OPOSICIONES |
| "Parametros invalidos" en test | `positionType` no reconocido | Se importa auto de config |
| 404 en tema con contenido | Falta en `VALID_TOPIC_RANGES` | Anadir rangos en `topic-data/schemas.ts` |
| Breadcrumbs vacios | Falta en InteractiveBreadcrumbs | Anadir en 9 lugares |
| Tema sin preguntas | Falta topic_scope o ley en BD | Crear scope o importar ley |
| Tema muestra preguntas irrelevantes | topic_scope demasiado amplio | Restringir article_numbers al epigrafe |
| Temas con contenido dicen "En elaboracion" | `disponible: false` en temario/page.tsx | Cambiar a `disponible: true` los temas con topic_scope |
| Temas sin contenido clickeables | Falta `disponible: false` | Marcar en temario/page.tsx |
| Tests fallan "Expected length: N" | Conteos hardcodeados | Actualizar en test files |
| ArticleModal muestra "oficial" de otra oposicion | Falta fila en `hot_articles` para esta oposicion | Ejecutar INSERT de hot_articles (Fase 7b) |
| Examen oficial no encuentra preguntas | Falta `exam_position` en preguntas | Ejecutar UPDATE (Fase 7a) |
| Examen oficial da "Oposicion no soportada" | Falta en `oposicionToExamPosition` | Anadir en `official-exams/queries.ts` (Fase 7c) |

---

## Convencion de nombres

| Contexto | Formato | Ejemplo |
|----------|---------|---------|
| URL / slug | guiones | `auxiliar-administrativo-madrid` |
| BD position_type | underscores | `auxiliar_administrativo_madrid` |
| BD oposicion id | underscores | `auxiliar_administrativo_madrid` |
| Config id | underscores | `auxiliar_administrativo_madrid` |
| Config slug | guiones | `auxiliar-administrativo-madrid` |
