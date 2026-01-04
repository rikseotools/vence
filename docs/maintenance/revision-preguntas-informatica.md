# Revisión y Corrección de Preguntas de Informática

> Procedimiento estándar para revisar preguntas de temas de informática (Outlook, Internet, Word, Excel, etc.)

## Sistema de Respuestas

**IMPORTANTE:** El sistema usa índices numéricos para las respuestas:
- `correct_option = 0` → Respuesta A
- `correct_option = 1` → Respuesta B
- `correct_option = 2` → Respuesta C
- `correct_option = 3` → Respuesta D

## Procedimiento de Revisión

### 1. Identificar el tema a revisar

```javascript
// Buscar la ley/tema por nombre
const { data } = await supabase
  .from('laws')
  .select('id, name, short_name')
  .ilike('name', '%NOMBRE_TEMA%');
```

### 2. Contar preguntas activas

```javascript
const { data, count } = await supabase
  .from('questions')
  .select('id, articles!inner(law_id)', { count: 'exact' })
  .eq('articles.law_id', LAW_ID)
  .eq('is_active', true);
```

### 3. Revisar en lotes de 50 preguntas

```javascript
const { data } = await supabase
  .from('questions')
  .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, articles!inner(law_id)')
  .eq('articles.law_id', LAW_ID)
  .eq('is_active', true)
  .order('id', { ascending: true })
  .range(0, 49); // Cambiar rango para cada lote
```

## Tipos de Errores a Buscar

### 1. Atajos de teclado incorrectos
- **Verificar SIEMPRE** con la fuente oficial de Microsoft en español
- Fuente Outlook: `https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-outlook-3cdeb221-7ae5-4c1d-8c1d-9e63216c1efd`
- Fuente Edge: `https://support.microsoft.com/es-es/microsoft-edge/métodos-abreviados-de-teclado-en-microsoft-edge-50d3edab-30d9-c7e4-21ce-37fe2713cfad`

### 2. Información factual incorrecta
- Ejemplo: "Qwen es de Baidu" → Incorrecto, es de Alibaba
- **Siempre verificar** con búsqueda web antes de corregir

### 3. Preguntas sin explicación
- Buscar: `explanation IS NULL` o `explanation = 'Sin explicación disponible'`
- Añadir explicación didáctica + fuente

### 4. Explicaciones sin fuente
- Todas las explicaciones deben incluir fuente verificable
- **IMPORTANTE:** Fuente en español para que el usuario pueda verificar

### 5. Opciones vacías (iconos no visibles)
- Preguntas que mencionan iconos pero las opciones están vacías
- **Solución:** Desactivar (`is_active = false`)

## Formato de Explicaciones

Las explicaciones deben ser:
1. **Didácticas** - Explicar el concepto, no solo la respuesta
2. **Completas** - Mencionar por qué las otras opciones son incorrectas
3. **Con fuente** - Incluir URL verificable en español

### Plantilla de Explicación

```
[Explicación del concepto y por qué la respuesta es correcta].
[Mención de las otras opciones y por qué son incorrectas - opcional pero recomendado].
Fuente: [Nombre de la fuente] ([URL en español])
```

### Ejemplo

```
El atajo Ctrl+U marca el mensaje seleccionado como no leído en Outlook,
mostrando de nuevo la marca de color azul en el margen izquierdo.
Por el contrario, Ctrl+Q marca el mensaje como leído.
Fuente: Microsoft Support - Métodos abreviados de teclado en Outlook
(https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-outlook-3cdeb221-7ae5-4c1d-8c1d-9e63216c1efd)
```

## Cómo Corregir

### Corregir opción incorrecta

```javascript
await supabase
  .from('questions')
  .update({
    option_X: 'Nueva opción correcta',
    explanation: 'Nueva explicación con fuente'
  })
  .eq('id', 'UUID_PREGUNTA');
```

### Cambiar respuesta correcta

```javascript
await supabase
  .from('questions')
  .update({
    correct_option: 1, // 0=A, 1=B, 2=C, 3=D
    explanation: 'Nueva explicación con fuente'
  })
  .eq('id', 'UUID_PREGUNTA');
```

### Desactivar pregunta (iconos no visibles, etc.)

```javascript
await supabase
  .from('questions')
  .update({ is_active: false })
  .eq('id', 'UUID_PREGUNTA');
```

## Fuentes Oficiales por Tema

| Tema | Fuente en Español |
|------|-------------------|
| Outlook | https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-outlook-3cdeb221-7ae5-4c1d-8c1d-9e63216c1efd |
| Edge | https://support.microsoft.com/es-es/microsoft-edge/métodos-abreviados-de-teclado-en-microsoft-edge-50d3edab-30d9-c7e4-21ce-37fe2713cfad |
| Word | https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-word |
| Excel | https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-excel |
| Windows | https://support.microsoft.com/es-es/windows/métodos-abreviados-de-teclado-en-windows |

## Checklist de Revisión

- [ ] Verificar que la respuesta marcada sea correcta
- [ ] Verificar atajos de teclado con fuente oficial
- [ ] Verificar información factual (nombres, fechas, empresas)
- [ ] Comprobar que la explicación sea didáctica
- [ ] Comprobar que la explicación tenga fuente en español
- [ ] Buscar preguntas con opciones vacías (iconos)
- [ ] Buscar preguntas sin explicación

## Estadísticas de Referencia

| Tema | Preguntas | Errores Típicos |
|------|-----------|-----------------|
| Outlook (Correo electrónico) | ~312 | Atajos de teclado incorrectos |
| La red Internet | ~369 | Información factual desactualizada |

## Notas Importantes

1. **NUNCA corregir sin verificar** - Siempre buscar la fuente oficial primero
2. **Pedir confirmación** - Mostrar el error y la corrección al usuario antes de aplicar
3. **Fuentes en español** - El usuario debe poder verificar la información
4. **Ser didáctico** - Las explicaciones son para aprender, no solo para memorizar
5. **Leyes virtuales** - Los temas de informática son "leyes virtuales" sin artículos reales, por eso las explicaciones son cruciales para el aprendizaje
