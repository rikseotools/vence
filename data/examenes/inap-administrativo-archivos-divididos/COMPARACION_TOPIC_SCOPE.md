# Comparación con Topic Scope

## Archivos Generados

### 1. `temario_inap_2025.json`
JSON básico con el temario oficial y las leyes principales de cada tema.

### 2. `temario_inap_2025_detallado.json`
JSON completo con:
- **Número de tema** (1-37)
- **Sección** (I-V)
- **Título del tema**
- **Scope detallado**:
  - Ley aplicable
  - Artículos específicos
  - Títulos
  - Capítulos
  - Weight (peso relativo)
  - Notas sobre la ley

## Estructura del Temario INAP 2025

### I. Organización del Estado y de la Administración pública (Temas 1-11)
1. Constitución Española completa
2. La Corona (CE Título II)
3. Cortes Generales (CE Título III)
4. Poder Judicial (CE Título VI + LOPJ)
5. Gobierno y Administración (CE + Ley 50/1997)
6. Gobierno Abierto (Ley 19/2013 + Ley 40/2015)
7. Ley de Transparencia 19/2013
8. Administración General del Estado (Ley 40/2015)
9. Comunidades Autónomas (CE Título VIII)
10. Administración Local (CE + Ley 7/1985)
11. Unión Europea

### II. Organización de oficinas públicas (Temas 12-15)
12. Atención al público (RD 208/1996 + Ley 39/2015)
13. Documentos, registros y archivos (Ley 39/2015)
14. Administración electrónica (Ley 39/2015)
15. Protección de datos (LO 3/2018)

### III. Derecho administrativo general (Temas 16-22)
16. Fuentes del derecho (CE + Ley 39/2015)
17. Acto administrativo (Ley 39/2015)
18. Procedimiento administrativo (Ley 39/2015 + Ley 40/2015)
19. Contratos públicos (Ley 9/2017)
20. Actividad administrativa (Ley 40/2015)
21. Responsabilidad patrimonial (Ley 40/2015)
22. Igualdad y violencia de género (LO 1/2004 + LO 3/2007)

### IV. Gestión de Personal (Temas 23-31)
23. Personal público (EBEP)
24. Selección (CE + EBEP)
25. Funcionarios (EBEP)
26. Adquisición/pérdida y situaciones (EBEP)
27. Provisión, derechos y carrera (EBEP)
28. Incompatibilidades y régimen disciplinario (EBEP + Ley 53/1984)
29. Seguridad Social funcionarios (RDL 8/2015)
30. Personal laboral (EBEP)
31. Seguridad Social laboral (RDL 8/2015)

### V. Gestión financiera (Temas 32-37)
32. El presupuesto (Ley 47/2003)
33. Presupuesto del Estado (Ley 47/2003)
34. Ejecución presupuestaria (Ley 47/2003)
35. Retribuciones (EBEP)
36. Gastos y pagos (Ley 47/2003)
37. Contratos y subvenciones (Ley 9/2017 + Ley 38/2003)

## Leyes NO incluidas en el documento BOE-442

Las siguientes leyes están en el temario oficial pero NO están incluidas en el código PDF BOE-442 (aunque **SÍ están en vuestra base de datos**):
- ✅ Tratado de la Unión Europea (Tema 11) - En BD como: TUE
- ✅ Ley Orgánica 3/2018 de Protección de Datos (Tema 15) - En BD como: LO 3/2018
- ✅ Ley 9/2017 de Contratos del Sector Público (Temas 19, 37) - En BD como: Ley 9/2017
- ✅ Ley Orgánica 1/2004 contra la violencia de género (Tema 22) - En BD como: LO 1/2004
- ✅ Ley Orgánica 3/2007 para la igualdad efectiva (Tema 22) - En BD como: LO 3/2007
- ✅ Ley 53/1984 de Incompatibilidades (Tema 28) - En BD como: Ley 53/1984
- ✅ Real Decreto Legislativo 8/2015 Seguridad Social (Temas 29, 31) - En BD como: RDL 8/2015
- ✅ Ley 38/2003 General de Subvenciones (Tema 37) - En BD como: Ley 38/2003

**NOTA:** Estas leyes ya están en la base de datos. Solo significa que el documento BOE-442 no las incluye completas, pero sí están disponibles para consulta.

## Comparación con Topic Scope Actual

### Pasos para comparar:

1. **Consultar topics actuales:**
```sql
SELECT 
  t.topic_number,
  t.title,
  t.position_type
FROM topics t
WHERE t.position_type = 'auxiliar_administrativo_estado'
ORDER BY t.topic_number;
```

2. **Consultar topic_scope actual:**
```sql
SELECT 
  t.topic_number,
  l.short_name as ley,
  ts.article_numbers,
  ts.title_numbers,
  ts.chapter_numbers,
  ts.weight
FROM topic_scope ts
JOIN topics t ON ts.topic_id = t.id
JOIN laws l ON ts.law_id = l.id
WHERE t.position_type = 'auxiliar_administrativo_estado'
ORDER BY t.topic_number, l.short_name;
```

3. **Identificar diferencias:**
- Temas que existen en BD pero no en JSON oficial
- Temas que existen en JSON oficial pero no en BD
- Artículos que difieren entre BD y JSON oficial
- Leyes que faltan en la BD

## Cómo usar el JSON para actualizar la BD

### Opción 1: Script de migración
Crear un script que:
1. Lee el JSON
2. Compara con la BD actual
3. Genera un reporte de diferencias
4. Opcionalmente actualiza la BD

### Opción 2: Validación manual
1. Exportar topic_scope actual a JSON
2. Comparar archivos con herramienta diff
3. Actualizar manualmente las diferencias

### Ejemplo de estructura para inserción:

```typescript
// Para cada tema en el JSON
for (const topic of jsonData.topics) {
  // 1. Verificar/crear topic
  const topicId = await getOrCreateTopic({
    position_type: 'auxiliar_administrativo_estado',
    topic_number: topic.topic_number,
    title: topic.title
  });
  
  // 2. Para cada ley en el scope
  for (const scope of topic.scope) {
    const lawId = await getLawByName(scope.law);
    
    // 3. Crear/actualizar topic_scope
    await upsertTopicScope({
      topic_id: topicId,
      law_id: lawId,
      article_numbers: scope.articles,
      title_numbers: scope.titles,
      chapter_numbers: scope.chapters,
      weight: scope.weight
    });
  }
}
```

## Notas Importantes

1. **Artículos "Todos"**: Algunos temas abarcan toda la ley. En la BD esto puede representarse:
   - Dejando `article_numbers` como `NULL` o `[]`
   - Usando `include_full_law: true` (si se añade este campo)

2. **Weights**: Los pesos en el JSON son estimaciones basadas en la importancia relativa de cada ley para el tema.

3. **Verificación BOE**: Antes de actualizar, verificar que las leyes en la BD están actualizadas al 30/12/2025.

4. **Posición Type**: Todo este temario es para `position_type = 'auxiliar_administrativo_estado'`.

## Próximos Pasos

1. [ ] Comparar JSON con BD actual
2. [ ] Identificar leyes faltantes
3. [ ] Añadir leyes faltantes a la BD
4. [ ] Actualizar topic_scope con artículos correctos
5. [ ] Validar que todas las preguntas existentes tienen primary_article_id correcto
6. [ ] Actualizar hot_articles basándose en el nuevo topic_scope
