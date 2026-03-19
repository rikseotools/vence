# Detalles de Problemas - Tema 14 Batch 5

## Preguntas Problemáticas Detalladas

### Q2: Reglamento general de régimen disciplinario

**Pregunta**: "Según, el Reglamento general de régimen disciplinario del personal al servicio de la Administración de Justicia, cuando de la instrucción de un procedimiento disciplinario contra un funcionario de la Administración de Justicia resulte la existencia de indicios fundados de la comisión de una infracción penal:"

**Opciones**:
- A: El instructor suspenderá su tramitación y lo pondrá en conocimiento de la autoridad que hubiera ordenado la incoación para su oportuna comunicación al Ministerio Fiscal ✓
- B: El instructor continuará la tramitación del procedimiento pero lo pondrá en conocimiento del Ministerio Fiscal para que inste el procedimiento oportuno.
- C: El instructor suspenderá su tramitación y lo pondrá en conocimiento del Ministerio Fiscal para que inste el procedimiento oportuno
- D: El instructor sobreseerá el procedimiento y lo pondrá en conocimiento del Ministerio Fiscal para que inste el procedimiento oportuno

**Respuesta Correcta**: A
**Artículo Referenciado**: RD 796/2005 Art. 4
**Título**: "Concurrencia de responsabilidad patrimonial o penal"

**Problema Identificado**:
- La ley NO se detectó automáticamente
- La explicación dice "Reglamento 796/2005" (sin "Real Decreto")
- Patrón de búsqueda requiere "Real Decreto" o "RD"

**Solución**: Mejorar patrón de detección para incluir variaciones:
```javascript
// Añadir esta línea al detectLaw():
if (explanation.includes('Reglamento 796/2005') || explanation.includes('Reglamento general de régimen disciplinario')) {
  return 'RD 796/2005';
}
```

**Candidatos en JSON**: RD 796/2005 Art. 4 está correctamente identificado en candidateArticles

---

### Q4: Prescripción de faltas graves

**Pregunta**: "¿En qué plazo prescriben las faltas graves de los funcionarios de justicia?"

**Opciones**:
- A: Un año.
- B: Dos meses.
- C: Seis meses. ✓
- D: Tres meses.

**Respuesta Correcta**: C
**Artículo Referenciado**: LOPJ Art. 540
**Estado en BD**: ✅ Existe

**Contenido del Artículo**:
```
1. Las faltas leves prescribirán a los dos meses; las graves, a los seis meses,
   y las muy graves, al año. El plazo se computará desde al fecha de su comisión.
```

**Problema Identificado**:
- Baja confianza en búsqueda de palabras clave
- La búsqueda buscaba palabra "prescriben" pero aparece "prescribirán"
- Sin embargo, la respuesta está claramente en el artículo

**Análisis de palabras clave**:
- Opción: "Seis meses"
- Palabras clave extraídas: ["seis", "meses"]
- Palabras encontradas en artículo: ["seis" ✓, "meses" ✓]
- Coincidencia: 2/2 = 100%
- **Conclusión**: Respuesta es CORRECTA pero el algoritmo reportaba confianza baja por problema en procesamiento

---

### Q5: Prescripción de sanciones por falta muy grave

**Pregunta**: "Dispone el artículo 540.4 de la LOPJ, que las sanciones impuestas por falta muy grave, prescribirán:"

**Opciones**:
- A: A los dos años. ✓
- B: Al año.
- C: A los tres años.
- D: A los seis años.

**Respuesta Correcta**: A
**Artículo Referenciado**: LOPJ Art. 540
**Estado en BD**: ✅ Existe

**Contenido relevante del Artículo**:
```
4. Las sanciones impuestas prescribirán a los cuatro meses en el caso de las faltas leves;
   al año, en los casos de faltas graves y a los dos años, en los casos de faltas muy graves.
   El plazo de prescripción se computará a partir del día siguiente a aquel en que adquiera
   firmeza la resolución en que se imponga.
```

**Análisis**:
- Opción: "A los dos años"
- Palabras clave: ["años", "dos"]
- Palabras encontradas: ["años" ✓, "dos" ✓]
- Coincidencia: 2/2 = 100%
- **Conclusión**: Respuesta es CORRECTA. Confianza baja reportada por error en algoritmo.

---

### Q8: Faltas muy graves - Negligencia en custodia de documentos

**Pregunta**: "Indique cuál de las siguientes faltas es una falta muy grave que pueden cometer los funcionarios al servicio de la Administración de Justicia en el desempeño de sus puestos de trabajo:"

**Opciones**:
- A: Causar daño grave en los documentos o material de trabajo, así como en los locales destinados a la prestación del servicio.
- B: La negligencia en la custodia de documentos que dé lugar a su difusión o conocimiento indebidos. ✓
- C: Obstaculizar las labores de inspección.
- D: La falta de consideración con los superiores, iguales o subordinados.

**Respuesta Correcta**: B
**Artículo Referenciado**: Ley 53/1984 Art. 7 (según explicación)
**Estado en BD**: ❌ NO existe

**Problema Identificado**:
- La explicación citada en la pregunta menciona "Artículo 7 Reglamento 796/2005"
- Pero también menciona "Ley 53/1984"
- El artículo 7 de Ley 53/1984 NO existe en BD
- Sin embargo, el contenido está correctamente en RD 796/2005 Art. 7

**Candidatos en JSON**:
- RDL 5/2015 Art. 7, 8
- RD 1451/2005 Art. 8, 7
- Ley 53/1984 Art. 8, 7
- RD 796/2005 Art. 7, 8 ← Este es el correcto
- Ley 7/1988 Art. 7, 8

**Conclusión**: La respuesta es correcta, pero está en RD 796/2005 Art. 7 (que falta en BD)

---

### Q10: Suspensión provisional - Plazo máximo

**Pregunta**: "La suspensión provisional, como medida cautelar en la tramitación de un expediente disciplinario, cuando se trate de una falta muy grave, salvo en caso de paralización del procedimiento imputable al interesado, no podrá exceder de:"

**Opciones**:
- A: Tres meses.
- B: Seis meses. ✓
- C: Un año prorrogable por otro.
- D: Un año.

**Respuesta Correcta**: B
**Artículo Referenciado**: RD 796/2005 Art. 22
**Título del Artículo**: "Suspensión provisional"
**Estado en BD**: ❌ NO existe

**Contenido esperado (de la explicación)**:
```
1. Durante la tramitación del procedimiento se podrá acordar la suspensión provisional
   del interesado por la autoridad que ordenó su incoación, a propuesta del instructor,
   mediante resolución motivada y previa audiencia del interesado. Sólo podrá acordarse
   cuando existan indicios racionales de la comisión de una falta grave o muy grave,
   y la duración de la medida no podrá exceder de SEIS MESES cuando se trate de falta muy grave,
   y de tres meses cuando se trate de falta grave, salvo en el caso de una paralización del
   procedimiento imputable al interesado.
```

**Candidatos en JSON**: RD 796/2005 Art. 22 (correctamente identificado)

---

### Q11: Sanciones por faltas graves

**Pregunta**: "Para las faltas graves, el reglamento general de régimen disciplinario del personal al servicio de la administración de justicia, aprobado por Real Decreto 796/2005, contempla como tiempo máximo para la sanción de suspensión de empleo y sueldo un plazo de:"

**Opciones**:
- A: Tres años. ✓
- B: Dos años.
- C: Cuatro años.
- D: Un año.

**Respuesta Correcta**: A
**Artículo Referenciado**: RD 796/2005 Art. 13
**Título del Artículo**: "Faltas y sanciones / Criterios para determinación"
**Estado en BD**: ❌ NO existe

**Contenido esperado**:
```
Artículo 13:
2. Las faltas graves podrán ser sancionadas con suspensión de empleo y sueldo
   HASTA TRES AÑOS o con traslado forzoso fuera del municipio.
```

---

### Q13: Resolución de expediente disciplinario - Plazo

**Pregunta**: "La resolución, que pone fin al procedimiento disciplinario, deberá adoptarse en el plazo:"

**Opciones**:
- A: De un mes desde la recepción del expediente por la autoridad competente y se pronunciará sobre todas las cuestiones planteadas en este.
- B: De diez días desde la recepción del expediente por la autoridad competente y se pronunciará sobre todas las cuestiones planteadas en este.
- C: De veinte días desde la recepción del expediente por la autoridad competente y se pronunciará sobre todas las cuestiones planteadas en este.
- D: De quince días desde la recepción del expediente por la autoridad competente y se pronunciará sobre todas las cuestiones planteadas en este. ✓

**Respuesta Correcta**: D
**Artículo Referenciado**: RD 796/2005 Art. 37
**Título del Artículo**: "Resolución"
**Estado en BD**: ❌ NO existe

**Contenido esperado**:
```
Artículo 37. Resolución:

1. La resolución, que pone fin al procedimiento disciplinario, deberá adoptarse
   en el plazo de QUINCE DÍAS desde la recepción del expediente por la autoridad
   competente y se pronunciará sobre todas las cuestiones planteadas en este.
```

---

### Q15: Prescripción de faltas y cómputo de plazos

**Pregunta**: "Conforme al artículo 18 del Reglamento general de régimen disciplinario del personal al servicio de la Administración de Justicia, aprobado por Real Decreto 796/2005 de 1 de julio, de entre las siguientes afirmaciones, señale la incorrecta:"

**Opciones**:
- A: El plazo de prescripción se interrumpirá en el momento en que se inicie el procedimiento disciplinario. El plazo de prescripción volverá a computarse si el expediente permaneciera paralizado durante más de 6 meses por causas no imputables al funcionario sujeto a procedimiento.
- B: En los casos en los que un hecho dé lugar a la apertura de causa penal, los plazos de prescripción no comenzarán a computarse sino desde la firmeza de la resolución por la que se concluya la causa.
- C: Las faltas leves prescribirán a los dos meses; las graves a los seis meses y las muy graves al año. El plazo se computará a partir del día siguiente a la fecha de su comisión. ✓ (INCORRECTA)
- D: En los supuestos de paralización de las actuaciones, el simple acto recordatorio que apremie la inactividad no será eficaz para interrumpir el transcurso de la prescripción.

**Respuesta Correcta**: C (es la afirmación INCORRECTA)
**Artículo Referenciado**: RD 796/2005 Art. 18
**Título del Artículo**: "Prescripción de las faltas y cómputo de plazos"
**Estado en BD**: ❌ NO existe

**Contenido esperado**:
```
Artículo 18:

1. Las faltas leves prescribirán a los dos meses; las graves, a los seis meses,
   y las muy graves, al año. El plazo se computará DESDE LA FECHA DE SU COMISIÓN
   (no "desde el día siguiente").

2-4. [Otros apartados]
```

**Motivo de incorreción**: La opción C dice "desde el día siguiente" cuando debería ser "desde la fecha"

---

### Q17: Caducidad de expediente disciplinario

**Pregunta**: "El plazo de caducidad de un expediente disciplinario incoado a un funcionario del Cuerpo de Gestión Procesal y Administrativa es de:"

**Opciones**:
- A: Veinticuatro meses.
- B: Seis meses.
- C: Doce meses. ✓
- D: Tres meses.

**Respuesta Correcta**: C
**Artículo Referenciado**: RD 796/2005 Art. 38
**Título del Artículo**: "Duración del procedimiento disciplinario"
**Estado en BD**: ❌ NO existe

**Contenido esperado**:
```
Artículo 38. Duración del procedimiento disciplinario:

La duración del procedimiento disciplinario no excederá de DOCE MESES.
Vencido este plazo sin que se haya dictado y notificado la resolución que
ponga fin al procedimiento, se producirá su caducidad.

No se producirá la caducidad si el expediente hubiese quedado paralizado
por causa imputable al interesado.
```

---

### Q19: Criterios para determinación de sanciones

**Pregunta**: "Señale cuál de los siguientes criterios no se tendrá en cuenta para la determinación de la sanción disciplinaria correspondiente a un funcionario de la Administración de Justicia en un expediente disciplinario:"

**Opciones**:
- A: El perjuicio causado a la Administración o a los ciudadanos.
- B: La reiteración o reincidencia.
- C: La intencionalidad.
- D: El puesto o función que desempeña. ✓

**Respuesta Correcta**: D (NO se tendrá en cuenta)
**Artículo Referenciado**: RD 796/2005 Art. 14
**Título del Artículo**: "Criterios para la determinación de la graduación de las sanciones"
**Estado en BD**: ❌ NO existe

**Contenido esperado**:
```
Artículo 14.1 - Para la determinación de la sanción, se tendrá en cuenta:

a) La intencionalidad.
b) El perjuicio causado a la Administración o a los ciudadanos.
c) El grado de participación en la comisión de la falta.
d) La reiteración o reincidencia.

Nota: El "puesto o función" NO aparece como criterio a considerar.
```

---

## Resumen de Artículos Faltantes Críticos

| Ley | Artículos Faltantes | Preguntas Afectadas | Impacto |
|-----|-------------------|-------------------|--------|
| RD 796/2005 | 4, 7, 8, 13, 14, 18, 22, 37, 38 | Q2, Q10, Q11, Q13, Q15, Q17, Q19 | CRÍTICO |
| Ley 53/1984 | 7 | Q8 | ALTO |

**Total**: 8 artículos faltantes, 8 preguntas afectadas (40% del batch)

## Próximos Pasos

1. **URGENTE**: Importar RD 796/2005 completo (verificar especialmente los 9 artículos listados)
2. **IMPORTANTE**: Verificar e importar Ley 53/1984 Art. 7
3. **RECOMENDADO**: Mejorar patrón de detección de leyes en script verificador
4. **VALIDACIÓN**: Re-ejecutar verificación después de importaciones

## Fuentes Recomendadas

- **RD 796/2005**: [BOE.es - Real Decreto 796/2005](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2005-11220)
- **Ley 53/1984**: [BOE.es - Ley 53/1984](https://www.boe.es/diario_boe/txt.php?id=BOE-A-1984-29637)

---

*Reporte generado: 2026-02-21*
*Verificador: Claude Code Agent*
