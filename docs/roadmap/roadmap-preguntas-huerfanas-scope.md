# Preguntas huérfanas: activas con artículo pero sin topic_scope

**Fecha:** 25 marzo 2026
**Detectadas:** 276 preguntas activas vinculadas a artículos que no están en ningún topic_scope.
**Impacto:** Estas preguntas nunca aparecen en los tests de ninguna oposición.

## Origen del problema

Las preguntas se importaron y vincularon a artículos correctos, pero los topic_scopes no incluyen esos artículos. Esto pasa cuando:
1. Se importan preguntas de una ley y solo se añaden algunos artículos al scope (no todos los que tienen preguntas)
2. Se crean preguntas nuevas para artículos que no están en ningún scope
3. Se corrige el artículo vinculado de una pregunta (ej: de TREBEP Art. 12 a RD 365/1995 Art. 12) pero el nuevo artículo no está en scope

## Preguntas huérfanas por ley (276 total)

| Ley | Preguntas | Artículos afectados | Prioridad |
|-----|-----------|-------------------|-----------|
| Orden 01/02/1996 | 49 | 2, 5, 6, 24, 42, 77, 78, 82-87 | Alta |
| LECrim | 28 | 8, 14, 15, 18, 21, 25-29, 37, 100, 101, 105, 108, 112, 118, 149, 152, 160, 840, 845, 999 | Alta |
| RDL 670/1987 | 17 | 5-7, 11, 12, 18, 19, 34, 35, 41, 42 | Media |
| Ley 2/2014 | 17 | 41, 47-50, 54, 57, 58, 60 | Media |
| RD 2271/2004 | 12 | 1, 4, 8, 11 | Media |
| LO 6/1985 (LOPJ) | 11 | 229, 232, 234-236, 235 bis, 610 ter | Media |
| Ley 11/1986 CM | 10 | 3, 7, 8, 10, 11, 14 | Media |
| RD 203/2021 | 10 | 1, 26, 28, 29, 33, 56, 58, 61, 64 | Media |
| RD 725/1989 | 10 | 1, 2, 5, 6 | Media |
| RD 33/1986 | 9 | 6, 11, 14, 20, 30, 35-37, 45 | Media |
| Orden PRE/1576/2002 | 6 | 8, 9 | Baja |
| Orden APU/1461/2002 | 6 | 2, 6, 8 | Baja |
| Ley 17/2009 | 5 | 5-8 | Baja |
| Ley 3/2015 | 5 | 1, 2 | Baja |
| RD 1405/1986 | 5 | 3, 4, 12, 15 | Baja |
| Res. 20/01/2014 DGP | 5 | 12, 24, 25 | Baja |
| RD 210/2024 | 5 | 1, 10 | Baja |
| Orden HFP/266/2023 | 5 | 1, 4, 6, 7, 9 | Baja |
| Ley 8/1994 | 4 | 1, 2 | Baja |
| RD 349/2001 | 4 | 3 | Baja |
| RD 577/1997 | 4 | 1 | Baja |
| Reglamento PE 9ª | 3 | 22, 24, 26 | Baja |
| Orden HAC/974/2025 | 3 | 6 | Baja |
| Reglamento Comisión UE | 3 | 5, 9 | Baja |
| Reglamento Ingreso Justicia (RD 1451/2005) | 3 | 22, 38 | Baja |
| Orden HFP/134/2018 | 3 | 0, 00 | Baja |
| Orden 30/07/1992 | 3 | 4, 6 | Baja |
| RD 456/1986 | 3 | 1, 3 | Baja |
| RD 127/2015 | 3 | 1, 3, 4 | Baja |
| Otras (16 leyes) | 20 | 1-2 preguntas cada una | Baja |

## Proceso para resolver (por ley)

Para cada ley de la tabla:

1. **Identificar a qué tema/oposición pertenecen las preguntas**
   - Leer el contenido de las preguntas
   - Ver qué epígrafes mencionan esa ley o esa materia
   - Determinar el topic_id correcto

2. **Verificar si la ley ya está en algún scope**
   - Si sí: ampliar el array `article_numbers` para incluir los artículos que faltan
   - Si no: crear un nuevo topic_scope para el tema correcto

3. **Verificar que los artículos responden las preguntas**
   - Leer el contenido del artículo
   - Comparar con las opciones de la pregunta
   - Si no responde: la pregunta puede estar mal vinculada

4. **No crear scopes a ciegas**
   - Siempre verificar contra el epígrafe del programa oficial
   - Si el artículo no entra en ningún epígrafe, la pregunta debería desactivarse

## Leyes ya corregidas (25 marzo 2026)

| Ley | Acción | Preguntas recuperadas |
|-----|--------|----------------------|
| RD 364/1995 | Scope ampliado de 13 a 51 arts (Aux Estado T13) | 119 |
| RD 365/1995 | Scope ampliado de 1 a 8 arts (Aux Estado T13) | 21 |
| RD 2073/1999 | Scope ampliado de 6 a 15 arts (Aux Estado T13) | 55 |

## Cómo detectar nuevas huérfanas

```javascript
// Script para encontrar preguntas activas sin scope
const { data: questions } = await supabase.from('questions')
  .select('id, primary_article_id')
  .eq('is_active', true)
  .not('primary_article_id', 'is', null);

for (const q of questions) {
  const { data: art } = await supabase.from('articles')
    .select('law_id, article_number')
    .eq('id', q.primary_article_id).single();

  const { data: scopes } = await supabase.from('topic_scope')
    .select('article_numbers')
    .eq('law_id', art.law_id);

  const inScope = scopes.some(s =>
    !s.article_numbers || s.article_numbers.includes(art.article_number)
  );

  if (!inScope) console.log('Huérfana:', q.id);
}
```

## Recomendación

Crear un check automático en `/admin/calidad` que detecte preguntas huérfanas, similar a los checks existentes (explicaciones apelotonadas, imágenes no disponibles, etc.).
