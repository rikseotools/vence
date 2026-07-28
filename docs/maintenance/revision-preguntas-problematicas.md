# Manual Conciso - Revisión Sistemática de Preguntas Problemáticas

## Proceso en 6 Pasos

### PASO 1: Análisis SQL Inicial
```sql
SELECT 
    'PREGUNTA PROBLEMÁTICA' as categoria,
    q.question_text,
    'A) ' || q.option_a as opcion_a,
    'B) ' || q.option_b as opcion_b,
    'C) ' || q.option_c as opcion_c,
    'D) ' || q.option_d as opcion_d,
    q.correct_option as numero_respuesta,
    CASE q.correct_option
        WHEN 0 THEN 'A) ' || q.option_a
        WHEN 1 THEN 'B) ' || q.option_b
        WHEN 2 THEN 'C) ' || q.option_c
        WHEN 3 THEN 'D) ' || q.option_d
    END as respuesta_marcada,
    q.explanation,
    'Art. ' || a.article_number || ' - ' || l.short_name as articulo,
    a.content as contenido_articulo
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.id = 'ID_PREGUNTA';
```

### PASO 2: Verificar Tracking
```sql
SELECT status, resolution_action, admin_notes
FROM problematic_questions_tracking 
WHERE question_id = 'ID_PREGUNTA';
```

### PASO 3: Análisis Lógico
1. **Coherencia pregunta-artículo**: ¿Corresponde el contenido?
2. **Respuesta correcta**: ¿Es realmente correcta según el artículo?
3. **Opciones**: ¿Son claras y sin ambigüedades?
4. **Explicación**: ¿Justifica adecuadamente la respuesta?

### PASO 4: Verificar BOE (Si es necesario)
Si hay dudas sobre el contenido del artículo, solicitar texto oficial BOE.

### PASO 5: Aplicar Corrección
**A) Mejorar explicación** (pregunta correcta):
```sql
UPDATE questions 
SET explanation = 'Explicación mejorada con análisis por descarte...',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**B) Corregir respuesta** (respuesta incorrecta):
```sql
UPDATE questions 
SET correct_option = X, -- 0=A, 1=B, 2=C, 3=D
    explanation = 'Nueva explicación justificando la respuesta correcta...',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**C) Reasignar artículo** (asignación incorrecta):
```sql
UPDATE questions 
SET primary_article_id = 'NUEVO_ARTICLE_ID',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

### PASO 6: Cerrar Tracking
```sql
INSERT INTO problematic_questions_tracking (
    question_id,
    detection_type,
    failure_rate,
    abandonment_rate,
    users_affected,
    total_attempts,
    status,
    resolution_action,
    admin_notes,
    resolved_by,
    resolved_at
) VALUES (
    'ID_PREGUNTA',
    'high_abandonment', -- o 'high_failure'
    XX.XX, -- porcentaje error
    XX.XX, -- porcentaje abandono
    X, -- usuarios afectados
    X, -- intentos totales
    'resolved',
    'ACCIÓN_REALIZADA', -- explanation_improved, correct_answer_changed, etc.
    'DESCRIPCIÓN_DETALLADA_DE_LA_CORRECCIÓN',
    auth.uid(),
    NOW()
);
```

## Tipos de Resolución

| Problema | Acción | resolution_action |
|----------|--------|-------------------|
| Explicación insuficiente | Mejorar explicación | `explanation_improved` |
| Respuesta incorrecta | Cambiar respuesta | `correct_answer_changed` |
| Artículo mal asignado | Reasignar artículo | `article_reassigned` |
| Bug frontend | Sin cambios BD | `no_changes_needed` |
| Redacción confusa | Mejorar opciones | `options_clarified` |

## Sistema de Respuestas
**OBLIGATORIO**: 0=A, 1=B, 2=C, 3=D

## Reglas Importantes
- **NUNCA eliminar preguntas** como solución
- **SIEMPRE** verificar con BOE si hay dudas
- **SIEMPRE** actualizar explicación para ser educativa
- **SIEMPRE** registrar en tracking la resolución
- **SIEMPRE** incluir análisis por descarte

## Template de Explicación Mejorada

> ⚠️ **La plantilla de abajo quedó OBSOLETA el 27-28/07.** Escribía un texto que **no es ninguno de
> los dos formatos canónicos**, así que la explicación resultante **no se puede transcribir** y la
> pregunta se queda fuera del barajado para siempre (hoy hay 47.388 activas bloqueadas justo por
> esto). Además su sección final `CLAVE:` incumple §5.1 del manual de impugnaciones, que exige
> integrar el resumen como párrafo natural, y el texto no arranca por *"La respuesta correcta es…"*,
> que es lo que `validar-explicacion.cjs` comprueba. Se conserva solo como referencia histórica.

**Cómo se escribe HOY: la estructura, y el texto lo genera la herramienta.**

```bash
npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply
```

El JSON lleva `cita` (`ref`+`texto`, o `bloque` para el literal íntegro), una razón **por opción**
keada a su índice (`"0".."3"`), `outro` opcional y `estilo: "impugnacion"`. Las razones se refieren
al **CONTENIDO** de la opción, nunca a su letra ni a su posición, porque al barajar dejarían de ser
ciertas. La apertura (*"La respuesta correcta es la **X**"*) y los veredictos los pone el render, no
tú. Detalle y ejemplos: manual de impugnaciones, §5.1 y §🔀.

**Tres cosas que se comprueban solas y conviene conocer antes de pelearte con ellas:**

- **La cita se verifica ENTERA** contra el artículo vinculado, no solo su arranque (§5.1.bis del
  manual de impugnaciones). Se admite elidir con `(...)` y cerrar con la referencia.
- **Preguntas de «señale la INCORRECTA»**: el marco se deduce del enunciado y el render etiqueta
  `ES LA INCORRECTA` / `VERDADERA`. No escribas tú el veredicto peleándote con la etiqueta.
- **Si NO reescribes la explicación**, prueba igualmente
  `scripts/backfill-explanation-data.ts --pregunta <qid> --apply`: transcribe sin cambiar una coma o
  no toca nada.

<details>
<summary>Plantilla histórica (no usar)</summary>

```
ESTRUCTURA/CONTEXTO:
- Información relevante del artículo/tema

ANÁLISIS DE OPCIONES:
A) INCORRECTA/CORRECTA: Razón específica
B) INCORRECTA/CORRECTA: Razón específica  
C) INCORRECTA/CORRECTA: Razón específica
D) INCORRECTA/CORRECTA: Razón específica

CLAVE: Punto fundamental para recordar
```
</details>

## Verificación Final
```sql
-- Confirmar corrección aplicada
SELECT explanation, correct_option, updated_at
FROM questions WHERE id = 'ID_PREGUNTA';

-- Confirmar tracking cerrado
SELECT status, resolved_at FROM problematic_questions_tracking 
WHERE question_id = 'ID_PREGUNTA';
```

## 🔀 Explicación BARAJABLE: tras aplicar una explicación, transcríbela

> **¿En qué formato escribo la explicación? Escríbela YA en el NUEVO (estructurada).**
>
> Se escribe un JSON con una razón por opción —referida al CONTENIDO, nunca a la letra— y el
> texto de siempre lo **genera** la herramienta:
>
> ```bash
> npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply
> ```
>
> Escribe las DOS columnas coherentes: `explanation_data` (la estructura, que permitirá barajar)
> y `explanation` (el texto renderizado, que es lo que el opositor ve hoy porque el render nuevo
> aún no está desplegado). La pregunta nace **barajable** y no hay ningún paso que se pueda
> olvidar.
>
> **Por qué así y no al revés:** escribir el texto y parsearlo después es heurístico y falla
> —medido el 27/07: solo se transcribe el 43,7% del formato de generación y el 15,3% del de
> impugnaciones—. De la estructura al texto, en cambio, es un render determinista: no puede
> fallar. El parseo se reserva para el HISTÓRICO, que es lo único que no se puede reescribir.
>
> Rechaza razones que digan «la opción A», «como se ha visto en la primera»… porque al barajar
> dejan de ser ciertas. Y para lo antiguo sigue existiendo el camino inverso:
> `scripts/backfill-explanation-data.ts`.

Desde el 27/07/2026 la explicación puede vivir en dos sitios: el texto de siempre (`explanation`)
y la versión ESTRUCTURADA (`explanation_data`), con las razones keadas a cada opción y sin letras
dentro. **Los dos conviven a propósito** mientras se transcribe el histórico; el barajado de
opciones se encenderá cuando la cobertura sea suficiente.

Por qué te afecta: una explicación que cita las opciones por letra («la B es correcta») **impide
barajar esa pregunta para siempre**. Hoy 47.388 preguntas activas están bloqueadas solo por eso.
Si corriges una explicación y la dejas únicamente en texto, la pregunta sigue bloqueada.

**Después de aplicar la explicación, un comando:**

```bash
npx tsx --env-file=.env.local scripts/backfill-explanation-data.ts --pregunta <question_id> --apply
```

Transcribe esa pregunta si puede hacerlo **sin cambiar una coma de lo que ve el opositor** (lo
comprueba con `mismoContenidoExplicacion`, el mismo comparador que vigila el canary). Si no puede,
no toca nada y lo dice: la pregunta queda para la pasada LLM. Nunca inventa ni recorta.

**Y si escribes la explicación a mano**, ayuda a que sea transcribible: mantén el formato canónico
del manual (una razón por opción, en su propio bloque) y evita frases que solo tengan sentido por
la POSICIÓN («como se ha visto en la primera opción», «las dos últimas son incorrectas»): esas no
sobreviven al barajado ni con estructura.
