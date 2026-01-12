# Vinculación de Preguntas a Temas

> **IMPORTANTE**: Este documento aclara cómo funciona realmente la vinculación de preguntas a temas en la plataforma. Leer con atención para evitar errores de clasificación.

## Resumen Ejecutivo

Las preguntas se vinculan a temas **a través de artículos y topic_scope**, NO a través de tags.

```
CORRECTO:  question.primary_article_id → article → topic_scope → topic
INCORRECTO: question.tags = ["T1", "T2", "T101"]  ❌ (no determina el tema)
```

## El Flujo Real de Vinculación

### 1. Cada pregunta tiene un artículo principal

```sql
questions.primary_article_id → articles.id
```

La pregunta está vinculada a un artículo específico de una ley.

### 2. Cada artículo pertenece a una ley

```sql
articles.law_id → laws.id
articles.article_number → "23", "140 bis", etc.
```

### 3. topic_scope define qué artículos pertenecen a qué tema

La tabla `topic_scope` es la **clave** del sistema:

| Campo | Descripción |
|-------|-------------|
| `topic_id` | ID del tema (ej: Tema 1 de Auxiliar) |
| `law_id` | ID de la ley |
| `article_numbers` | Array de artículos de esa ley que pertenecen al tema |

**Ejemplo de topic_scope para Tema 1 de Auxiliar Administrativo:**

```
topic_id: 123 (Tema 1 - La Constitución Española)
law_id: 1 (Constitución Española)
article_numbers: ["1", "2", "3", "4", "5", ..., "169"]
```

### 4. La consulta para saber a qué tema pertenece una pregunta

```sql
-- Dada una pregunta, obtener su tema:
SELECT t.topic_number, t.title
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN topic_scope ts ON ts.law_id = a.law_id
  AND a.article_number = ANY(ts.article_numbers)
JOIN topics t ON ts.topic_id = t.id
WHERE q.id = 'pregunta-uuid';
```

## Los Tags NO Son Para Identificar Temas

### Error común (NO HACER)

```javascript
// ❌ INCORRECTO - Esto NO determina el tema de la pregunta
question.tags = ["T1"];      // No significa que sea del Tema 1
question.tags = ["T101"];    // No significa que sea del Tema 101
```

### Por qué existen los tags

Los tags fueron diseñados para **agrupar contenido por tipo**, no para clasificación temática:

- Agrupar artículos virtuales vs reales
- Marcar contenido generado por IA vs oficial
- Otros metadatos de contenido

### El problema del T101

En el pasado, se etiquetaron 258 preguntas con "T101" pensando que así se asignarían al Tema 101. Esto fue un **error de concepto**:

- Muchas preguntas de Tribunal Constitucional tenían "T101"
- Preguntas del Defensor del Pueblo tenían "T101"
- Preguntas de la Corona tenían "T101"

Ninguna de estas pertenece al Tema 101 (Atención al ciudadano). El tag no determina nada.

## Cómo Clasificar Preguntas Correctamente

### Para que una pregunta aparezca en un tema:

1. **La pregunta debe tener `primary_article_id`** apuntando a un artículo válido
2. **Ese artículo debe estar en `topic_scope`** para el tema correspondiente
3. **El topic_scope debe existir** para la oposición correcta (position_type)

### Para verificar si una pregunta está bien clasificada:

```javascript
// Script de verificación
const { data: question } = await supabase
  .from("questions")
  .select("id, primary_article_id")
  .eq("id", questionId)
  .single();

const { data: article } = await supabase
  .from("articles")
  .select("law_id, article_number")
  .eq("id", question.primary_article_id)
  .single();

const { data: scopes } = await supabase
  .from("topic_scope")
  .select("topics(topic_number, title)")
  .eq("law_id", article.law_id)
  .contains("article_numbers", [article.article_number]);

// scopes contiene los temas a los que pertenece esta pregunta
```

## Diferentes Oposiciones, Diferentes topic_scope

Cada oposición tiene su propia estructura de temas:

| position_type | Ejemplo de Tema 1 |
|---------------|-------------------|
| `auxiliar_administrativo` | La Constitución Española de 1978 |
| `administrativo` | Puede tener diferente contenido |

La misma pregunta puede pertenecer a diferentes temas según la oposición, porque `topic_scope` es específico por `topics.position_type`.

## Tablas Involucradas

```
questions
  └── primary_article_id ──→ articles
                               ├── law_id ──→ laws
                               └── article_number
                                        ↓
                               topic_scope
                                 ├── topic_id ──→ topics
                                 ├── law_id
                                 └── article_numbers[]
```

## Scripts Útiles

### Ver topic_scope de una oposición

```bash
node scripts/view-topic-scopes.cjs
```

### Verificar artículo → tema

```bash
node scripts/verify-article-topic.cjs
```

## Conclusiones

1. **No usar tags para clasificar preguntas por tema** - Es inútil
2. **El `primary_article_id` es la clave** - Sin él, la pregunta no tiene tema
3. **`topic_scope` es el puente** - Define qué artículos pertenecen a qué temas
4. **Cada oposición tiene su topic_scope** - No mezclar entre position_types

## Referencias

- `docs/maintenance/agregar-tema-actualizado-dic2025.md` - Cómo agregar nuevos temas
- `db/schema.ts` - Schema completo de la base de datos
- `docs/database/tablas.md` - Documentación de tablas
