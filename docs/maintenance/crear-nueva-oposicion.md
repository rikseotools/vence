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
  short_name, grupo, subgrupo, is_active, temas_count, bloques_count,
  titulo_requerido,
  diario_oficial, diario_referencia,
  programa_url, seguimiento_url,
  -- Estado del proceso selectivo
  estado_proceso, oep_decreto, oep_fecha,
  convocatoria_numero, convocatoria_fecha, convocatoria_dogv
) VALUES (
  'Nombre Completo de la Oposicion',
  'libre',
  'Comunidad Autonoma / Estado / Justicia',
  'C2',
  'slug-de-la-oposicion',
  'Nombre Corto',
  'C',      -- grupo: A, B o C
  'C2',     -- subgrupo: A1, A2, B, C1 o C2
  false,    -- INACTIVA hasta verificar todo
  21,
  2,
  'Graduado en ESO o equivalente',
  'BOE',                                      -- o BOCM, BOJA, DOE, DOCM, etc.
  'BOE-A-2025-26262',                         -- referencia en el diario oficial
  'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',  -- URL al programa
  'https://sede.inap.gob.es/...',             -- URL de seguimiento del proceso
  -- Estado del proceso
  'oep_aprobada',                             -- ver tabla de estados abajo
  'RD 1052/2025',                             -- decreto de la OEP (ver nota sobre multiples OEPs)
  '2025-12-22',                               -- fecha de aprobacion de la OEP (la mas reciente)
  NULL,                                       -- numero de convocatoria (cuando se publique)
  NULL,                                       -- fecha de la convocatoria
  NULL                                        -- referencia del diario de la convocatoria
);
```

### 2a.1 Estados del proceso selectivo (`estado_proceso`)

El campo `estado_proceso` indica en que fase se encuentra la oposicion. Es **obligatorio** y determina que informacion se muestra al usuario en la landing y en el temario.

| Estado | Significado | Que se muestra al usuario |
|--------|------------|--------------------------|
| `sin_oep` | No hay OEP aprobada. Solo existe la oposicion en la plataforma | "Pendiente de OEP" |
| `oep_aprobada` | OEP aprobada (decreto publicado) pero sin convocatoria | "X plazas (OEP 2026). Pendiente de convocatoria" |
| `convocada` | Convocatoria publicada pero inscripcion no abierta | "Convocada. Inscripcion proxima" |
| `inscripcion_abierta` | Plazo de inscripcion abierto | "Inscripcion abierta hasta DD/MM/YYYY" |
| `inscripcion_cerrada` | Inscripcion cerrada, esperando siguiente fase | "Inscripcion cerrada. Pendiente de lista admitidos" |
| `lista_admitidos` | Lista de admitidos publicada | "Lista admitidos publicada" |
| `pendiente_examen` | Fecha de examen conocida, esperando | "Examen: DD/MM/YYYY" |
| `examen_realizado` | Examen ya realizado, esperando resultados | "Examen realizado. Pendiente de resultados" |
| `resultados` | Resultados publicados | "Resultados publicados" |
| `nombramientos` | Proceso finalizado | "Nombramientos realizados" |

**IMPORTANTE:** Actualizar `estado_proceso` cuando cambie la fase. El seguimiento de convocatorias (cron) detecta cambios en la pagina de seguimiento, pero hay que actualizar manualmente el estado.

### 2a.2 Campos de la OEP vs la Convocatoria

La OEP y la convocatoria son documentos diferentes publicados en momentos distintos:

| Campo | Fuente | Cuando se rellena |
|-------|--------|-------------------|
| `oep_decreto` | Decreto de la OEP (ej: "Decreto 16/2026") | Al crear la oposicion |
| `oep_fecha` | Fecha publicacion de la OEP en el diario oficial | Al crear la oposicion |
| `plazas_libres`, `plazas_*` | OEP o convocatoria | Al crear o al publicarse convocatoria |
| `convocatoria_numero` | Convocatoria (ej: "14/23") | Cuando se publica la convocatoria |
| `convocatoria_fecha` | Fecha publicacion convocatoria | Cuando se publica |
| `convocatoria_dogv` | Referencia diario (ej: "DOGV-C-2026-xxxx") | Cuando se publica |
| `inscription_start/deadline` | Convocatoria | Cuando se publica |
| `exam_date` | Convocatoria o resolucion posterior | Cuando se conozca |
| `programa_url` | Convocatoria (anexo con el temario) | Cuando se publica |
| `seguimiento_url` | Pagina de seguimiento del proceso | **DEBE SER URL ESPECIFICA, no buscador generico** |

**Error clasico con `seguimiento_url`:** NO poner un buscador generico de empleo publico (ej: `sede.gva.es/busc_empleo_publico`). Debe ser la URL de la ficha concreta del proceso selectivo. Si aun no existe (porque no esta convocada), usar la URL de la pagina de la OEP donde aparecera cuando se convoque.

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

### 2a.3 Multiples OEPs acumuladas (caso frecuente)

Es habitual que una convocatoria acumule plazas de varias OEPs (ej: OEP 2024 + OEP 2025). En ese caso:

**Campo `oep_decreto`:** Listar TODOS los decretos separados. Ejemplo:
```
'Decreto 275/2024 (OEP 2024) y Decreto 214/2025 (OEP 2025)'
```

**Campo `oep_fecha`:** Usar la fecha de la OEP MAS RECIENTE:
```
'2025-12-30'  -- fecha del Decreto 214/2025, la OEP mas reciente
```

**Campo `plazas_libres`:** Sumar las plazas de TODAS las OEPs pendientes de convocar:
```
-- OEP 2024: 30 plazas + OEP 2025: 44 plazas = 74 plazas totales
74
```

**Campo `boe_reference`:** Referenciar ambas publicaciones:
```
'BOJA 252/2024 (OEP 2024) y BOJA 250/2025 (OEP 2025)'
```

**Plazas de discapacidad intelectual:** Si hay un proceso SEPARADO para discapacidad intelectual (frecuente en Andalucia, Estado), esas plazas NO se suman a `plazas_libres`. Se mencionan en las FAQs como informacion adicional.

**Ejemplo real (Andalucia marzo 2026):**
| OEP | Decreto | Plazas TL | Plazas DI (proceso aparte) |
|-----|---------|-----------|---------------------------|
| 2024 | Decreto 275/2024 | 30 | 22 |
| 2025 | Decreto 214/2025 | 44 | 20 |
| **Total** | | **74** | 42 |

**Cuando se publique la convocatoria:** actualizar los campos de convocatoria (`convocatoria_numero`, `convocatoria_fecha`, `estado_proceso` → `convocada`, etc.) y ajustar las plazas si la convocatoria trae numeros distintos a la OEP.

### 2a.4 Campos JSONB para la landing page

La landing dinamica usa varias columnas JSONB. Rellenarlas al crear la oposicion permite que la landing muestre informacion rica desde el primer dia.

#### `examen_config` (estructura del examen)

```json
{
  "tipo": "test",
  "penalizacion": "1/3 del valor del acierto",
  "total_preguntas": 100,
  "duracion_total_minutos": 180,
  "partes": [
    {
      "nombre": "Parte teorica",
      "preguntas": 75,
      "reserva": 4,
      "puntuacion_max": 90,
      "puntuacion_min": 36,
      "valor_acierto": 1.2
    },
    {
      "nombre": "Parte practica (Ofimatica)",
      "preguntas": 25,
      "reserva": 3,
      "puntuacion_max": 30,
      "puntuacion_min": 12,
      "valor_acierto": 1.2
    }
  ],
  "notas": "Basado en convocatoria anterior. Puede variar."
}
```

Si la oposicion aun NO tiene convocatoria, rellenar con datos de la convocatoria anterior del mismo cuerpo (suele ser identica o muy similar). Indicar en `notas` que es estimacion.

#### `landing_faqs` (preguntas frecuentes)

```json
[
  {
    "pregunta": "¿Cuantas plazas hay?",
    "respuesta": "Las OEP 2024 y 2025 acumulan {plazasLibres} plazas..."
  }
]
```

Variables disponibles: `{plazasLibres}`, `{temasCount}`, `{bloquesCount}`, `{tituloRequerido}`, `{salarioMin}`, `{salarioMax}`. Se resuelven automaticamente.

**Minimo 4-5 FAQs:** plazas, temario, estructura examen, requisitos, fecha examen.

#### `landing_estadisticas` (4 tarjetas hero)

```json
[
  { "numero": "{plazasLibres}", "texto": "Plazas OEP 2024+2025", "color": "text-green-600" },
  { "numero": "{temasCount}", "texto": "Temas oficiales", "color": "text-blue-600" },
  { "numero": "100", "texto": "Preguntas en el examen", "color": "text-purple-600" },
  { "numero": "ESO", "texto": "Titulo requerido", "color": "text-orange-600" }
]
```

Si no se conocen las plazas, usar `"—"` como numero.

#### `requisitos_especiales` (si aplica)

```json
[
  { "tipo": "ofimatica", "descripcion": "LibreOffice 7.6 (no Microsoft Office)" }
]
```

Usar cuando la oposicion tiene requisitos que la diferencian de otras similares (ej: suite ofimatica distinta, idioma cooficial, conducir).

### 2a.5 Oposiciones sin convocatoria publicada

Es valido crear una oposicion cuando solo hay OEP aprobada pero no hay convocatoria aun. Configuracion:

| Campo | Valor |
|-------|-------|
| `estado_proceso` | `oep_aprobada` |
| `is_convocatoria_activa` | `false` |
| `convocatoria_*` | `NULL` (todos) |
| `exam_date` | `NULL` |
| `inscription_*` | `NULL` |
| `programa_url` | URL del programa de la convocatoria ANTERIOR (mismo cuerpo) |
| `seguimiento_url` | URL de la ficha del proceso (si existe) o pagina general de empleo publico |
| `examen_config` | Basado en convocatoria anterior + nota aclaratoria |

La landing se genera igualmente, mostrando "Pendiente de convocatoria" y los datos de la OEP. Los usuarios pueden empezar a estudiar con el temario de la convocatoria anterior (que suele ser identico o muy similar).

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
| `components/InteractiveBreadcrumbs.tsx` | **No requiere cambios** — se adapta automáticamente desde OPOSICIONES |
| `components/OnboardingModal.js` | `OFFICIAL_OPOSICIONES` array |
| `app/perfil/page.tsx` | Array `oposiciones` del selector |
| `app/nuestras-oposiciones/page.js` | Tarjeta de la oposicion |
| `app/page.js` | Links en "Test por Oposicion" y tarjeta en "Temarios" |

### 4d. Tests a actualizar

| Archivo | Que cambiar |
|---------|------------|
| `__tests__/api/theme-stats/themeStats.test.js` | `toHaveLength(N)` |
| `__tests__/config/oposicionesCentralConfig.test.ts` | `toHaveLength(N)` |

### 4e. InteractiveBreadcrumbs.tsx — NO requiere cambios

El componente detecta la oposición automáticamente desde `OPOSICIONES` config:
```typescript
const currentOpo = OPOSICIONES.find(o => pathname.includes('/' + o.slug))
```
Labels, banderas, links y secciones se derivan dinámicamente. No hay código hardcodeado por oposición.

---

## FASE 5: Frontend

Copiar estructura de una oposicion existente (ej: `app/tramitacion-procesal/`):

```
app/<slug-con-guiones>/
  (NO crear page.tsx — la landing se genera automaticamente desde app/[oposicion]/page.tsx)
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
    page.tsx                            -- Thin wrapper (20 lineas, ver abajo)
    [slug]/
      page.tsx                          -- getTopicContent + generateStaticParams
      TopicContentView.tsx              -- Copiar y adaptar getBlockInfo
```

### 5.1 Temario dinamico (desde 05/04/2026)

**El temario se lee de BD — NO hay hardcoded.** El `page.tsx` es un thin wrapper que usa el componente compartido `DynamicTemarioPage`:

```tsx
// app/<slug>/temario/page.tsx
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

export const revalidate = false  // static, invalidar con revalidateTag('temario')

export const metadata = {
  title: 'Temario <Nombre Oposicion> | Vence.es',
  description: 'Temario oficial de <nombre> con legislación literal del BOE...',
  alternates: { canonical: 'https://www.vence.es/<slug>/temario' },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="<slug>"
      oposicionDisplayName="<Nombre Display>"
    />
  )
}
```

**NO crear `TemarioClient.tsx`** — ya es compartido en `/components/temario/TemarioClient.tsx`.

**Datos que lee de BD:**
- `oposicion_bloques` (position_type, bloque_number, titulo, icon)
- `topics` (title, descripcion_corta, bloque_number, display_number, disponible)

**Flujo de creación completo:**

1. **Insertar bloques** en `oposicion_bloques`:
```sql
INSERT INTO oposicion_bloques (position_type, bloque_number, titulo, icon, sort_order)
VALUES
  ('<position_type>', 1, 'Bloque I: Nombre', '🏛️', 1),
  ('<position_type>', 2, 'Bloque II: Nombre', '⚖️', 2);
```

2. **Insertar topics** con `bloque_number` + `descripcion_corta` + `disponible`:
```sql
INSERT INTO topics (position_type, topic_number, title, description, epigrafe,
                    bloque_number, descripcion_corta, disponible, is_active)
VALUES (...);
```

3. **Marcar `disponible = false`** los temas sin topic_scope con preguntas (aparecen "En elaboracion" en el listado automaticamente).

4. **Invalidar cache:**
```bash
curl -X POST https://www.vence.es/api/admin/revalidate-temario
```

**Verificación:**
```bash
# Test de integridad BD
npm test __tests__/integration/temarioEpigrafeIntegrity.test.ts

# Build local (debe generar la ruta como estática)
npm run build | grep "<slug>/temario"
```

### 5a. Landing page (AUTOMATICA - no hay que crear archivo)

La landing se genera automaticamente desde `app/[oposicion]/page.tsx` (template unico). **NO hay que crear ningun archivo page.tsx para la landing.**

Solo necesitas que los datos esten en la tabla `oposiciones` (fase 2a) y la config en `oposiciones.ts` (fase 4). El template lee todo de BD y genera el HTML estatico con ISR (24h).

**Datos que usa el template (columnas de `oposiciones`):**

| Columna | Uso en landing |
|---------|---------------|
| `plazas_libres/promocion/discapacidad` | Hero, caja de convocatoria, FAQs |
| `exam_date`, `inscription_start/deadline` | Texto de examen, estado inscripcion |
| `boe_reference`, `boe_publication_date` | Caja de convocatoria |
| `programa_url`, `seguimiento_url` | Links oficiales (tarjetas) |
| `oep_decreto`, `oep_fecha` | Linea OEP en la caja de convocatoria |
| `diario_oficial` | Texto del link oficial ("Ver en BOCYL") |
| `titulo_requerido`, `salario_min/max` | FAQs |
| `color_primario` | Color del gradiente (emerald, cyan, violet, etc.) |
| `seo_title`, `seo_description` | Meta tags SEO |
| `landing_faqs` (JSONB) | Preguntas frecuentes especificas |
| `examen_config` (JSONB) | Estructura del examen |
| `landing_estadisticas` (JSONB) | Las 4 tarjetas hero (plazas, temas, etc.) |
| `requisitos_especiales` (JSONB) | Requisitos extra (idiomas, etc.) |

**Variables en FAQs y estadisticas:** Los textos en `landing_faqs` y `landing_estadisticas` pueden usar variables como `{plazasLibres}`, `{temasCount}`, `{tituloRequerido}`, etc. El template las resuelve automaticamente con los datos de BD.

**Colores disponibles:** emerald, cyan, blue, purple, red, amber, orange, rose, green, violet. Se configuran en `color_primario`. El mapa completo esta en `lib/utils/landing-colors.ts`.

**Helpers de formato** estan en `lib/utils/format.ts` (compartidos, NO hay que duplicarlos):
- `formatNumber(n)` → "1.700"
- `formatDateLarga(str)` → "22 de diciembre de 2025"
- `formatDateCorta(str)` → "22/12/2025"

### 5b. Timeline de hitos del proceso selectivo

#### Procedimiento para crear hitos

1. **Obtener la `seguimiento_url`** de la tabla `oposiciones` (pagina oficial del proceso)
2. **Leer la pagina de seguimiento** y extraer todas las fechas y eventos publicados
3. **Clasificar cada hito** con su status:
   - `completed` → ya ocurrio (fecha pasada y confirmado)
   - `current` → en curso ahora (plazo abierto, fase activa)
   - `upcoming` → pendiente (fecha futura)
4. **Insertar en BD** con orden cronologico

#### Hitos tipicos de un proceso selectivo

| Orden | Hito | Notas |
|-------|------|-------|
| 1 | Convocatoria publicada en [diario] | Incluir referencia y num. plazas. URL al PDF |
| 2 | Apertura plazo de inscripcion | |
| 3 | Cierre plazo de inscripcion | Notar si se amplio |
| 4 | Listas provisionales admitidos/excluidos | URL a la pagina de seguimiento |
| 5 | Fin plazo subsanacion | |
| 6 | Listas definitivas admitidos | |
| 7 | Examen | Hora, sedes si se conocen |
| 8 | Publicacion plantillas respuestas | Fecha estimada si no se conoce |
| 9 | Resultados | Fecha estimada |

No todos los procesos tienen todos los hitos. Algunos tienen extras (calendario actuaciones, composicion tribunal, comunicacion legislacion vigente). Incluir solo los relevantes para el opositor.

#### SQL de insercion

```sql
-- Obtener el UUID de la oposicion
SELECT id FROM oposiciones WHERE slug = 'auxiliar-administrativo-madrid';

-- Insertar hitos
INSERT INTO convocatoria_hitos (oposicion_id, fecha, titulo, descripcion, url, status, order_index)
VALUES
  ('<uuid>', '2025-05-13', 'Convocatoria publicada en BOCM', 'Orden 1081/2025. 551 plazas.', 'https://...', 'completed', 1),
  ('<uuid>', '2025-05-14', 'Apertura plazo de inscripcion', NULL, NULL, 'completed', 2),
  ('<uuid>', '2025-06-13', 'Cierre plazo de inscripcion', 'Ampliado por problemas tecnicos.', NULL, 'completed', 3),
  ('<uuid>', '2025-12-29', 'Listas provisionales admitidos y excluidos', NULL, 'https://...', 'completed', 4),
  ('<uuid>', '2026-02-17', 'Listas definitivas admitidos y excluidos', NULL, 'https://...', 'completed', 5),
  ('<uuid>', '2026-04-12', 'Examen', '09:00h primer ejercicio, 12:00h segundo.', NULL, 'upcoming', 6),
  ('<uuid>', '2026-06-15', 'Resultados', 'Fecha estimada.', NULL, 'upcoming', 7);
```

#### Status de cada hito en la UI

- `completed` → check verde, texto normal
- `current` → circulo azul animado, badge "En curso"
- `upcoming` → circulo gris, texto opaco

El timeline se renderiza entre los links oficiales y el temario. Los hitos con `url` son clickeables.

**JSON-LD Event:** Ademas del FAQPage schema, se genera un schema `Event` con la fecha del examen para rich snippets de Google.

#### Actualizar hitos cuando hay cambios

Cuando el monitoreo detecta un cambio (ver 5c), actualizar los hitos:

```sql
-- Marcar un hito como completado
UPDATE convocatoria_hitos SET status = 'completed'
WHERE oposicion_id = '<uuid>' AND titulo ILIKE '%listas definitivas%';

-- Insertar nuevo hito
INSERT INTO convocatoria_hitos (oposicion_id, fecha, titulo, descripcion, url, status, order_index)
VALUES ('<uuid>', '2026-04-12', 'Examen', 'Sedes publicadas.', 'https://...', 'upcoming', 8);

-- Cambiar hito de upcoming a current
UPDATE convocatoria_hitos SET status = 'current'
WHERE oposicion_id = '<uuid>' AND titulo ILIKE '%subsanacion%';
```

### 5c. Monitoreo de seguimiento (automatico)

Al crear la oposicion con `seguimiento_url`, el cron diario (`/api/cron/check-seguimiento`) empezara a monitorearla automaticamente. Cuando detecte cambios:

1. Badge "CAMBIO" en `/admin/seguimiento-convocatorias`
2. El admin avisa a Claude
3. Claude lee la pagina de seguimiento, extrae los hitos nuevos
4. Actualiza `convocatoria_hitos` (INSERT nuevos, UPDATE status de existentes)
5. La landing se regenera en 24h (ISR) con el timeline actualizado

**Paginas de seguimiento por tipo de administracion:**

| Administracion | Portal de seguimiento | Ejemplo |
|----------------|----------------------|---------|
| Estado (AGE) | sede.inap.gob.es | Auxiliar/Administrativo Estado |
| Justicia | mjusticia.gob.es | Tramitacion Procesal, Auxilio Judicial |
| Madrid | comunidad.madrid | Auxiliar Madrid |
| Canarias | gobiernodecanarias.org | Auxiliar Canarias |
| Valencia | sede.gva.es | Auxiliar Valencia |
| Otras CCAA | Portal empleo publico de cada CCAA | Ver tabla oposiciones |

---

## FASE 6: Verificacion

### 6a. Tests automatizados

```bash
npm run build     # Sin errores
npm run test:ci   # Actualizar toHaveLength si procede
```

**Test de integridad de landings** (`__tests__/config/landingDataIntegrity.test.ts`):

Despues de migrar una landing, anadir el slug al array `MIGRATED_SLUGS` en el test:

```typescript
const MIGRATED_SLUGS = [
  'auxiliar-administrativo-estado',
  'auxiliar-administrativo-madrid',
  // Anadir aqui cada nueva landing migrada
]
```

El test verifica automaticamente:
- Template dinamico `app/[oposicion]/page.tsx` existe y tiene todas las secciones
- Cada oposicion en DYNAMIC_SLUGS NO tiene page.tsx estatico (usa template)
- Cada oposicion tiene config valida en `oposiciones.ts` con bloques
- Config central: slugs/positionTypes validos, totalTopics correcto

```bash
# Ejecutar solo los tests de landing
npx jest landingDataIntegrity --no-coverage
```

### 6b. Tildes en landings (CRITICO para SEO)

**SIEMPRE usar tildes correctas en el contenido de las landings.** Google distingue "Constitucion" de "Constitución". Los titulos de temas deben coincidir exactamente con los de la BD (tabla `topics.title`).

Palabras frecuentes que necesitan tilde:
- Constitución, Administración, Jurisdicción, Protección
- Autonomía, público, jurídico, básico, electrónico
- cálculo, información, inscripción, promoción
- género, discriminación, Ofimática

El test `no mezcla acentos con texto sin acentos` detecta inconsistencias.

### 6c. Verificar epigrafes contra BD

Los titulos de los temas en la landing DEBEN coincidir con `topics.title` en BD. Verificar con:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data } = await supabase.from('topics').select('topic_number, title')
    .eq('position_type', 'slug_con_underscores').eq('is_active', true).order('topic_number');
  data.forEach(d => console.log('T' + d.topic_number + ': ' + d.title));
})();
"
```

Si hay discrepancias, la BD es la fuente de verdad (viene del BOE oficial).

### 6d. Checklist funcional

1. `/<slug>/` - Landing carga con datos de BD
2. `/<slug>/test` - Hub muestra temas en bloques correctos
3. `/<slug>/test/aleatorio` - Genera test con preguntas
4. `/<slug>/test/tema/X` - Carga datos del tema
5. `/<slug>/test/tema/X/test-personalizado` - Test funciona
6. `/<slug>/temario` - Lista de temas (sin scope → "En elaboracion")
7. `/<slug>/temario/tema-X` - Contenido del tema
8. Breadcrumbs funcionan
9. Perfil: oposicion aparece en selector
10. Onboarding: oposicion aparece para nuevos usuarios
11. **Landing (automatica): plazas, fecha examen, BOE se muestran correctamente desde BD**
12. **Landing: links a convocatoria y seguimiento funcionan**
13. **Landing: timeline de hitos se renderiza (insertar hitos en `convocatoria_hitos`)**
14. **Landing: FAQs y estadisticas se muestran (insertar en columnas JSONB de `oposiciones`)**
15. **Admin: oposicion aparece en /admin/seguimiento-convocatorias**

### 6e. Tabla oposiciones (OBLIGATORIO para landings)

Crear fila en la tabla `oposiciones` con datos de la convocatoria. Sin esta fila, la landing dinamica no tiene datos que mostrar (plazas, fecha examen, BOE, etc.).

Campos minimos: slug, nombre, plazas, categoria (C1/C2), administracion, programa_url (BOE).

### 6f. Invalidar cache ISR (CRITICO despues de importar preguntas)

La pagina `/<slug>/test` tiene cache ISR de 30 dias. Si se crean los topics primero (sin preguntas) y luego se importan las preguntas, el cache sirve la version vieja donde los temas aparecen como "En desarrollo".

**Solucion:** Hacer un deploy (push a main) despues de importar las preguntas. El deploy regenera todas las paginas ISR con datos frescos.

**Si no se hace deploy:** Los temas apareceran como "En desarrollo" hasta que expire el cache (30 dias) o se haga un nuevo deploy.

**Recomendacion:** Importar las preguntas ANTES del primer deploy de la oposicion. Si no es posible, hacer un deploy adicional despues de la importacion.

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
| Breadcrumbs vacios | Falta en `OPOSICIONES` config | Anadir oposicion a `lib/config/oposiciones.ts` |
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

---

## Lecciones aprendidas

### Caso Andalucía (marzo 2026)

#### 8. Múltiples OEPs acumuladas — investigar TODAS antes de crear

Una oposición puede acumular plazas de 2-3 OEPs consecutivas. Antes de crear la fila en BD:

1. Buscar en el BOJA/BOE TODAS las OEPs publicadas para ese cuerpo
2. Verificar cuáles ya fueron convocadas (proceso terminado) y cuáles están pendientes
3. Sumar solo las plazas de OEPs PENDIENTES de convocatoria

**Ejemplo real:** Auxiliar Administrativo Junta de Andalucía tenía OEP 2022+2023 (ya convocada, 95 plazas, proceso terminado) y OEP 2024+2025 (74 plazas, pendiente de convocatoria). La oposición en Vence debe apuntar a las plazas PENDIENTES, no a las ya convocadas.

**Error evitado:** Se tenía `estado_proceso: 'resultados'` con `plazas_libres: 113`, mezclando datos del proceso terminado con el nuevo.

#### 9. Distinguir proceso turno libre de procesos de discapacidad intelectual

Andalucía y Estado convocan procesos SEPARADOS para discapacidad intelectual (DI). Las plazas DI NO se suman a `plazas_libres`:
- Turno libre + discapacidad general → `plazas_libres` + `plazas_discapacidad`
- Discapacidad intelectual → proceso aparte, mencionar en FAQs

#### 10. Convocatoria NO publicada: usar datos de la anterior

Si la nueva OEP aún no tiene convocatoria, el programa y la estructura del examen suelen ser idénticos a la convocatoria anterior del mismo cuerpo. Usar esos datos con una nota en `examen_config.notas`.

Para `programa_url`: enlazar la convocatoria anterior (que contiene el programa vigente). Cuando se publique la nueva, actualizar.

#### 11. Campos JSONB de landing: rellenar desde el principio

No dejar los campos JSONB vacíos o con datos placeholder (`"—"` en plazas, partes vacías en examen_config). Investigar y rellenar:
- `examen_config`: estructura completa del examen (partes, preguntas, tiempo, penalización)
- `landing_faqs`: mínimo 5 FAQs reales (plazas, temario, examen, requisitos, fecha)
- `landing_estadisticas`: las 4 tarjetas del hero con datos reales
- `requisitos_especiales`: si hay diferencias vs otras oposiciones (LibreOffice vs Office, idioma...)

Una landing con datos reales convierte mejor que una con placeholders.

#### 12. No confundir convocatorias de universidad con administración general

Al buscar "auxiliar administrativo BOJA", aparecen convocatorias de universidades andaluzas (Universidad de Huelva, Sevilla, etc.) que tienen temarios completamente diferentes (temas universitarios). Verificar que el organismo convocante sea la **Dirección General de Recursos Humanos y Función Pública** (administración general) o el organismo correcto.

### Caso Galicia (marzo 2026)

### 1. Temas sin preguntas deben decir "En elaboración"

Un tema puede tener scope (artículos vinculados) pero 0 preguntas. Si el usuario entra a hacer un test de ese tema, ve un test vacío y se frustra.

**Solución implementada:** `TestHubPage.tsx` verifica que cada tema tenga al menos 1 pregunta activa. Si no tiene, muestra "En desarrollo" en vez de un enlace activo.

**Regla:** Después de crear los scopes de una oposición nueva, SIEMPRE contar preguntas por tema (sección 3f). Los temas con 0 preguntas deben quedar visibles pero deshabilitados hasta que se importen preguntas.

### 2. Temas de contenido virtual (ofimática, gestión documental) sin ley → marcar como inactivos

Si un tema requiere una ley virtual que no existe (ej: LibreOffice Writer, gestión documental de una CCAA), marcar el topic como `is_active: false` en la BD. Esto hace que aparezca como "En elaboración" en tests y temario.

**No vincular leyes de otra suite/sistema:** Si el programa pide LibreOffice, NO vincular leyes de Microsoft Office. Los contenidos son diferentes y las preguntas serían incorrectas.

### 3. Epígrafes mandan sobre todo lo demás

El epígrafe literal del programa oficial determina EXACTAMENTE qué artículos van en el topic_scope. Ejemplo real del caso Galicia:

| Epígrafe | Scope correcto | Error evitado |
|----------|---------------|---------------|
| "LPRL: capítulo III" | Arts. 14-29 | Tenía arts. 33-40 (capítulo IV) |
| "Ley 40/2015: caps I-V título preliminar excepto subsección 2ª sec 3ª" | Arts. 1-18, 23-46 (sin 19-22) | Faltaba Cap I (1-4) y sobraba subsec 2ª |

### 4. Leyes autonómicas suelen estar en el BOE

Los estatutos de autonomía y leyes autonómicas publicadas en DOG/BOCM/BOJA etc. también suelen tener texto consolidado en el BOE (`buscar/act.php`). Usar la API de sincronización del BOE para importarlas automáticamente en vez de hacerlo manualmente.

### 5. Verificar scope contra programa oficial ANTES de activar

Proceso obligatorio antes de marcar una oposición como activa:

1. Leer programa oficial (BOE/diario autonómico)
2. Para CADA tema: verificar que el scope coincide con el epígrafe
3. Para CADA tema: contar preguntas — si es 0, no activar en tests
4. Los temas con 0 preguntas quedan visibles pero deshabilitados ("En elaboración")
5. Solo activar cuando el tema tiene scope correcto Y preguntas

### 6. Frontend hardcodeado — actualizar temario/page.tsx

La página del temario (`app/[oposicion]/temario/page.tsx`) tiene los temas hardcodeados con `disponible: true/false`. Al crear scopes nuevos, hay que actualizar este archivo para que los temas pasen a `disponible: true`. No se actualiza automáticamente desde la BD.

### 7. Caché estático en Vercel

Las páginas del temario y tests se generan en build time (`revalidate = false` o `revalidate = 2592000`). Después de cambios en la BD hay que:
- Hacer un deploy (push a main), o
- Llamar a `/api/revalidate?secret=vence-revalidate-2024&path=/[ruta]` para invalidar la caché de una página específica
