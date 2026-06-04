# Crear una Nueva Oposicion - Guia Completa

Manual para escalar Vence a nuevas oposiciones. Marzo 2026.

---

## 0. Dos tipos de oposiciones en Vence (CRÍTICO)

Antes de crear nada hay que entender esta distinción. **Todo el resto del manual presupone este concepto.**

### 0.1 Catálogo implementado vs aspiracional

| Tipo | Dónde vive | Qué tiene | Para qué sirve |
|---|---|---|---|
| **Implementada (real)** | `OPOSICIONES` en `lib/config/oposiciones.ts` | Temario completo, topics con epígrafes, topic_scope, landing, tests funcionales, FAQs, estadísticas, convocatoria | Oposición que el usuario puede estudiar de verdad |
| **Aspiracional (fantasma)** | `OFFICIAL_OPOSICIONES` en `components/OnboardingModal.tsx` | Solo `{ id, nombre, categoria, administracion, icon }` | Capturar demanda: qué oposiciones quiere la gente que aún no hemos creado |

### 0.2 Reglas fundamentales

1. **Todas las implementadas deben estar también en OFFICIAL_OPOSICIONES.** El onboarding y el selector de cambio de oposición leen de ahí.
2. **Las aspiracionales NO están en OPOSICIONES** (no tienen contenido, si lo tuvieran serían implementadas).
3. **`user_profiles.target_oposicion` puede apuntar a cualquiera de las dos.** Cuando apunta a una aspiracional, eso **es** la captura de demanda: podemos consultar `GROUP BY target_oposicion` para saber qué oposiciones priorizar.
4. **No hay tabla aparte de "demanda"**. La demanda vive directamente en `user_profiles.target_oposicion`.

### 0.3 UX diferenciada (post-16/04/2026)

Ambas aparecen mezcladas en el onboarding y el selector de cambio. Se distinguen visualmente:

| Implementada | Aspiracional |
|---|---|
| Click guarda `target_oposicion` + navega a `/slug/test` | Click guarda `target_oposicion` + muestra mensaje inline "🔜 En elaboración. Estamos trabajando en ella. Queda registrado tu interés" + no navega |
| Sin badge especial | Badge "🔜 En elaboración" visible antes de clickar |

**Consulta rápida para ver demanda acumulada:**

```sql
SELECT target_oposicion, COUNT(*) AS interesados
FROM user_profiles
WHERE target_oposicion NOT IN (SELECT position_type FROM topics WHERE is_active = true)
GROUP BY target_oposicion
ORDER BY interesados DESC;
```

(O más preciso: verificar contra `OPOSICIONES` de `lib/config/oposiciones.ts`.)

### 0.4 Promocionar una aspiracional a implementada

Cuando decidimos crear una oposición que ya era aspiracional (ej. `auxiliar_ayuntamiento` pasa de aspiracional a implementada):

**REGLA DE ORO: mantener el mismo `id`.**

Si el id coincide:
- Los usuarios con `target_oposicion = <id>` heredan automáticamente la implementación.
- El badge "🔜 En elaboración" desaparece solo (es condicional a que no esté en `OPOSICIONES`).
- El click empieza a navegar a `/slug/test` sin tocar nada más del modal.
- El newsletter `novedad-convocatoria` (ver §14) los encuentra automáticamente con el filtro estándar `target_oposicion = '<slug_underscores>'` y les envía "Tu oposición ya está lista para practicar".

Si el id tiene que cambiar (ej. aspiracional genérica `auxiliar_ayuntamiento` se desdobla en `auxiliar_ayuntamiento_madrid` + `auxiliar_ayuntamiento_valencia`):
- Es una **mala idea** salvo que sea inevitable.
- Los usuarios con target_oposicion antiguo quedarían huérfanos.
- Hay que hacer migración explícita:
  ```sql
  UPDATE user_profiles
  SET target_oposicion = 'auxiliar_ayuntamiento_madrid'
  WHERE target_oposicion = 'auxiliar_ayuntamiento'
    AND ciudad ILIKE '%madrid%';
  -- etc por ciudad
  ```
- Documentar la migración en el PR.

### 0.5 Retirar una aspiracional (si no se va a crear nunca)

Casos raros (ej. oposición saturada en el mercado, demanda nula, o nos damos cuenta de que está mal llamada):

1. Ver cuántos usuarios la tienen como target: `SELECT COUNT(*) FROM user_profiles WHERE target_oposicion = '<id>'`.
2. Migrar esos usuarios a una oposición similar implementada: `UPDATE user_profiles SET target_oposicion = '<nueva>' WHERE target_oposicion = '<vieja>'`.
3. Enviar email informando del cambio.
4. Eliminar la entrada de `OFFICIAL_OPOSICIONES` en `OnboardingModal.tsx`.

### 0.6 Añadir una nueva aspiracional sin implementarla

Para captar demanda de una oposición nueva que aparece (ej. convocan Ayto Bilbao y queremos medir interés antes de crearla):

1. Añadir entrada en `OFFICIAL_OPOSICIONES` de `OnboardingModal.tsx` con un id claro (usar convención `position_type` con underscores).
2. **No añadir a `OPOSICIONES`** hasta que decidamos implementarla.
3. Aparecerá con badge "🔜 En elaboración" automáticamente.
4. Monitorizar la demanda con la query de §0.3.

---

## 0.bis Criterio PREVIO: coste de creación — temario normativo vs editorial

**Antes de comprometerse a crear una oposición, clasificar su temario por TIPO de contenido.** Esto determina el coste y si la podemos hacer en casa o no. Es el primer filtro al decidir entre una oposición y otra.

### Dos tipos de contenido por tema

| Tipo | Qué es | Coste | Cómo se cubre |
|---|---|---|---|
| **Normativo (ley)** | El tema deriva de un texto legal literal (ley/decreto del BOE/BOC) | **Bajo y autónomo** | O ya tenemos el banco en BD (reutilizable vía `topic_scope`), o lo generamos: importar la norma del boletín → generar preguntas IA contra el articulado literal → triple auditoría (ver `generar-preguntas-con-ia.md`). Cero dependencia externa. |
| **Editorial** | El tema NO sale de un texto legal: materia técnica, doctrina, protocolos, oficios, "manuales" | **Alto y con dependencia** | Necesita un **editor humano** que redacte el contenido primero. No se puede citar artículo → la IA no puede generar preguntas fiables sin fuente literal. |

### Cómo aplicarlo

1. Al leer el programa oficial (FASE 1), etiquetar **cada tema**: ¿sale de una ley/decreto concreto, o es materia editorial?
2. **Priorizar oposiciones con temario mayoritariamente normativo.** Las administrativas (C2/C1) lo son casi siempre → baratas y rápidas.
3. Los temas **genéricos sin ley pero estándar** (ofimática, atención al público, suministros, nómina, registro/archivo) son una zona intermedia: NO tienen artículo de respaldo, pero son materia común y la IA los genera bien (la ofimática ya tiene miles de preguntas sin ser "ley"). Avisar de que no hay cita literal de respaldo.
4. **Señal de alarma:** si una parte importante del temario es editorial puro (p.ej. oposiciones técnicas/sanitarias con protocolos clínicos, oficios con materia práctica), el coste se dispara y conviene posponerla o asumir que necesita editor.

**Caso real SCS Canarias (02/06/2026):** 22 temas, prácticamente todos normativos (Ley 41/2002, Ley 55/2003, Ley 39/2015, LO 3/2018, LGSS, Ley 9/2017, LPRL, 4 decretos canarios) + 2 genéricos estándar (suministros, nómina) + ofimática. Cero temas editoriales → buena elección de "primera a crear" por este criterio. Solo hubo que importar 4 decretos canarios pequeños y generar preguntas; ningún editor.

> Este criterio complementa la priorización por **demanda/vendibilidad** del roadmap `docs/roadmap/activacion-oposiciones-vendibles.md` (convocatoria abierta / examen 1-6 meses / nº candidatos). Demanda dice *cuáles interesan*; este criterio dice *cuáles son baratas de montar*. Cruzar ambos.

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
FASE 4: Config y schemas       → oposiciones.ts, archivos manuales, logo/bandera/escudo oficial (CcaaFlag §4c.bis)
FASE 5: Frontend               → Rutas Next.js, landing, temario, tests
FASE 6: Verificacion           → Build, tests, funcional, revalidar caches
FASE 7: Examenes oficiales     → exam_position, hot_articles, mapas (si aplica)
FASE 8: Campaña Google Ads     → captación (tras is_active=true); runbook google-ads-analisis §Crear campaña
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

### 2a.3.1 Checklist post-acumulación: campos derivados que NO se deben olvidar

Cuando una convocatoria existente se actualiza por acumulación (nueva Orden que acumula OEPs adicionales y añade plazas), es fácil actualizar los campos numéricos y olvidar los derivados en texto libre. El resultado son inconsistencias invisibles en hero vs SEO, timeline y enlaces.

Caso real Extremadura (abril 2026): Orden original de 23/12/2024 con 30 plazas (DOE 250). Acumulación con Orden de 17/12/2025 elevó a 146 plazas (DOE 244). Se actualizaron `plazas_libres` 23→126, `plazas_discapacidad`, `boe_reference`, `convocatoria_dogv`. Se **olvidaron** y quedaron desincronizados:

| Campo | Valor obsoleto | Síntoma |
|-------|----------------|---------|
| `seo_description` | "106 plazas" | Google mostraba cifra incorrecta en snippet |
| `landing_description` | "DOE 27/12/2024" y "146 plazas convocadas" mezclados | Contradicción visible en la web |
| `programa_url` | PDF de la Orden original (30 plazas) | Botón "Ver convocatoria" abría el PDF antiguo |
| `convocatoria_hitos[order_index=1].descripcion` | "106 plazas acceso libre" | Timeline mostraba cifra incorrecta bajo del hero |
| `convocatoria_hitos[order_index=1].url` | PDF de corrección de errores, no la Orden acumulada | Enlace del hito apuntaba al documento equivocado |

**Checklist obligatorio tras cualquier acumulación o ampliación de plazas:**

```
□ oposiciones.plazas_libres y plazas_discapacidad actualizados (suma real)
□ oposiciones.boe_reference menciona el nuevo DOE/BOE (y opcionalmente el acumulado)
□ oposiciones.boe_publication_date = fecha del DOE/BOE de la acumulación
□ oposiciones.convocatoria_dogv incluye ambos DOEs: "DOE núm. X (acum. DOE núm. Y)"
□ oposiciones.seo_description menciona la cifra TOTAL actual (146, no 106)
□ oposiciones.landing_description refleja DOE vigente y cifra total
□ oposiciones.programa_url apunta al PDF de la Orden acumulada (no a la original)
□ convocatoria_hitos[order_index=1].descripcion con cifra total correcta
□ convocatoria_hitos[order_index=1].url apunta al PDF de la Orden acumulada
□ Ejecutar node scripts/purge-all-cache.js tras los UPDATEs
□ Verificar con tests: npx jest __tests__/integration/oposicionesDataConsistency --no-coverage
```

Los tests de consistencia (§6a) detectan automáticamente 4 de estas 5 inconsistencias. Si el test falla tras una acumulación, revisar el checklist entero antes de publicar.

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

> ⚠️ **CRITICO — esquema exacto** (incidente 18/05/2026, 500 en producción):
> Las tres claves son **literalmente** `numero`, `texto`, `color`. NO usar `label`/`value` ni otro alias. El template `app/[oposicion]/page.tsx:174` llama `resolveVars(s.numero)` que invoca `.replace(...)` — si `numero` es `undefined`, **toda la landing tira 500 SSR**. Caso real: el script `_tmp_create_<slug>_oposicion.cjs` insertó `{label, value}`, la cache `unstable_cache` con `revalidate: false` retuvo el snapshot, y la URL devolvió 500 hasta que la lambda se recicló. El template ahora filtra defensivamente entries sin `numero`, pero **NO confíes en el fallback** — escribe el esquema bien.
>
> Idéntico para `landing_faqs`: claves `pregunta` y `respuesta` (no `q`/`a` ni `question`/`answer`).

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
2. **Si NO esta en BD:** Dejar el tema SIN scope. Se marca como `disponible: false` en el temario. Se puede importar la ley despues (ver **[`monitoreo-boe-y-crear-leyes-nuevas.md`](./monitoreo-boe-y-crear-leyes-nuevas.md)** — crear ley desde URL del BOE, o `includeDisposiciones: true` para añadir disposiciones a una ley existente) y el tema se activa automaticamente al crear el scope. Si la ley existe pero el tema queda con 0 preguntas, generarlas con **[`generar-preguntas-con-ia.md`](./generar-preguntas-con-ia.md)**.

### 3e. Error clasico: meter ley entera

```
Tema 4: "Las fuentes del ordenamiento juridico. La Constitucion. Las Leyes.
         Decretos-leyes y Decretos legislativos. Los reglamentos."

MAL:  CE → arts. 1-169 (toda la CE)
BIEN: CE → arts. 1, 9, 53, 81-87, 93-94, 96-97, 128, 133, 149, 150
      (solo los articulos que hablan de tipos de normas y fuentes)
```

Meter la ley entera diluye el tema con preguntas irrelevantes. El usuario de Tema 4 veria preguntas sobre la Corona o el Poder Judicial, que no tienen nada que ver.

### 3f. Verificar epigrafes vs scope: trampas frecuentes

**Ver manual detallado:** [`docs/maintenance/verificar-epigrafe-topic-scope.md`](./verificar-epigrafe-topic-scope.md) — sección "Lecciones aprendidas (post-abril 2026)".

Resumen de las trampas mas frecuentes:

1. **Epigrafe pide contenido sin nombrar la norma:** Buscar el reglamento de desarrollo ademas de la ley citada.
2. **`article_numbers: null` (ALL):** Casi siempre incorrecto excepto para leyes virtuales o decretos pequenos.
3. **BOE sync trae ley equivocada:** Verificar art 1 tras sincronizar.
4. **OpositaTest clasifica mal:** Si tenemos la oposicion scrapeada, cruzar los articulos que referencian las preguntas contra el scope para detectar divergencias.

### 3g. Verificar resultado

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
  // Penalización oficial del modo examen — OBLIGATORIO (ver 4a.ter).
  // penaltyDivisor: N = cada N erróneas restan 1 correcta; null = no penaliza.
  examScoring: { penaltyDivisor: 4, source: 'DOE nº244 19/12/2025: cada 4 erroneas resta 1 (1/4)' },
  // Aliases de búsqueda (refactor 07-may-2026): términos alternativos que
  // los usuarios escriben en los buscadores (Onboarding, Cambio de
  // oposición, Guard de tests). El test `oposicionAliases.test.ts` exige
  // ≥3 aliases para oposiciones con tráfico relevante. Filtrado central en
  // `lib/utils/searchOposicion.ts`.
  aliases: ['cam', 'comunidad de madrid', 'auxiliar madrid', 'admin madrid'],
  navLinks: [/* patron estandar */]
}
```

**Reglas para los aliases:**
- Mínimo 3 caracteres por alias (regex anti-falsos-positivos en el helper).
- Incluye siglas comunes (CAM, GVA, JCYL, JCCM, DGA, CAIB, etc.) y nombres usuales en español/lengua cooficial.
- Si la oposición es popular (Estado, autonomías grandes, justicia), añadir mínimo 5-8 aliases.
- Para añadir un alias después: editar el campo `aliases` aquí, propaga automáticamente a los 3 buscadores.

#### `officialExams[]` (exámenes oficiales pasados — opcional)

Si la oposición tiene exámenes oficiales importados en BD, añadir el array
`officialExams` a la entrada para que aparezcan en el TestHubClient
(`/<slug>/test` → tarjeta "Convocatoria 20XX"). Cada convocatoria con sus
partes:

```typescript
officialExams: [
  {
    date: '2026-04-12',
    title: 'Convocatoria 2026 (551 plazas)',
    oep: 'OEP 2023-2024',
    partes: [
      {
        id: 'primera',
        icon: '📘',
        title: 'Primer ejercicio',
        // FORMATO PREFERIDO — estructurado (validado por test de coherencia):
        ordinaryCount: 60,            // preguntas ordinarias (sin reserva)
        reserveCount: 5,              // preguntas de reserva
        durationMin: 65,              // minutos del ejercicio
        breakdown: [                  // suma debe ser ordinaryCount
          { label: 'psicotécnicas', count: 30 },
          { label: 'Bloque I', count: 30 },
        ],
        // notes: '(1 anulada en plantilla)'  ← opcional, texto libre
      },
      {
        id: 'segunda',
        icon: '📗',
        title: 'Segundo ejercicio',
        ordinaryCount: 30,
        reserveCount: 5,
        durationMin: 35,
        breakdown: [{ label: 'Bloque II Ofimática', count: 30 }],
      },
    ],
  },
]
```

**Reglas:**
- El helper `formatParteDescription(parte)` (en el mismo `oposiciones.ts`) genera el string mostrado al usuario desde los campos estructurados. Fuente única → imposible que dos vistas diverjan.
- `breakdown` libre: usa los labels que tengan sentido para la oposición (`'psicotécnicas'`, `'Bloque I'`, `'supuesto práctico'`, `'Bloque II Ofimática'`…). El test `__tests__/config/officialExamsCoherence.test.ts` exige que la suma cuadre con `questions + psychometric_questions` activas en BD por `exam_date + exam_position`. Si CI falla aquí, audita BD antes de tocar los números.
- Las entries antiguas tienen `description: string` literal — se acepta como **legacy fallback**, pero toda convocatoria nueva debe usar el formato estructurado.

**Workflow completo de importar un examen oficial** (PDFs → preguntas en BD → entry en `officialExams`): ver `docs/maintenance/importar-examen-oficial-completo.md`. Incluye lifecycle inicial `draft`, verificación con agentes Sonnet, formato exacto de `exam_source` (parseado por `getExamPart()`), reservas, psicotécnicas con figura, supuestos prácticos compartidos, y el §9.4 sobre el schema estructurado de partes.

### 4a.ter `examScoring` — penalización del modo examen (OBLIGATORIO, verificar en la convocatoria)

El modo examen (`ExamLayout`, `OfficialExamLayout`) y la pantalla de revisión
(`ExamReviewLayout`) calculan la nota restando puntos por respuesta incorrecta.
**Cada convocatoria penaliza distinto** y hay que leerlo en las bases oficiales
del BOE/boletín autonómico — NO asumir 1/3. Auditoría 03/06/2026: de 47
oposiciones, ~18 NO eran 1/3 (muchas 1/4, varias sin penalización, Policía
Nacional 1/2 por tener 3 alternativas, Diputación de Cádiz 3/8).

```typescript
examScoring: {
  penaltyDivisor: 4,   // N: cada N respuestas INCORRECTAS restan 1 correcta
                       //    (penalización = 1/N por fallo). null = NO penaliza.
  source: 'DOE nº244 19/12/2025 (Orden 17/12/2025): cada 4 erroneas resta 1 (1/4)',
}
```

**Cómo obtener el valor (en las bases de la convocatoria, no inventar):**
- *"se penalizará con un tercio del valor de una respuesta correcta"* → `penaltyDivisor: 3`.
- *"cada 4 erróneas resta 1"* / *"un cuarto del valor"* → `penaltyDivisor: 4`.
- Fórmula *"aciertos − errores/(nº alternativas − 1)"* → divisor = `alternativas − 1` (4 opciones → 3; 3 opciones → 2). **Cuidado con Policía Nacional (3 alternativas → 2).**
- Valores en puntos (ej. acierto 0,20 / error −0,075) → divisor = acierto/error (= 8/3 en Cádiz). Se admite no-entero.
- *"las respuestas incorrectas no se valoran / no penalizan"* (Correos, varios servicios de salud, Osakidetza) → `penaltyDivisor: null`.

**`source` es obligatorio y debe citar el boletín** (BOE-A-…, DOE/BOJA/BORM/DOG/etc. nº y fecha) + la regla, con `confidence:alta/media/baja` si no se pudo extraer literal del PDF.

**Enforcement:** `__tests__/config/examPenaltyCoherence.test.ts` **falla en CI** si la
oposición nueva no lleva `examScoring`, si `source` está vacío, o si `penaltyDivisor`
no es `null` ni un número positivo. No hay default silencioso: el helper
`getExamPenaltyPerWrong()` solo cae a 1/3 para identificadores inexistentes.
El backend (`/api/v2/official-exams/complete`) guarda el acierto crudo; la
penalización es solo cálculo de nota en cliente, así que basta con el config.

### 4a.bis Patrones de matching en queries (OBLIGATORIO si hay `officialExams`)

Sin esto, los exámenes oficiales **no aparecen** aunque la entry esté en
`oposiciones.ts` y las preguntas estén en BD:

| Archivo | Constante | Qué añadir | Cuándo |
|---|---|---|---|
| `lib/api/official-exams/queries.ts` | `oposicionToExamPosition` | `'<slug>': '<positionType>'` | Siempre que haya legi/ofi oficiales |
| `lib/api/official-exams/queries.ts` | `oposicionToExamSourcePattern` | `'<slug>': '%<patrón ILIKE>%'` (más específico mejor) | Siempre |
| `lib/api/psychometric-test-data/queries.ts` | `examSourcePatterns` (línea ~189) | `'<positionType>': '%<patrón ILIKE>%'` | **SOLO si hay psicotécnicas OFICIALES en BD** (ver §4a.ter abajo) |
| `lib/config/exam-positions.ts` | `EXAM_POSITION_MAP` + `HOT_ARTICLE_TARGET_MAP` | Ambos mapas con el positionType | Siempre (sin esto, el filtro cross-oposición bloquea todas las oficiales) |

⚠️ **Especificidad del patrón:** si la oposición se llama "Madrid", el patrón
`%Madrid%` colisionará con "Ayuntamiento de Madrid". Usar siempre el nombre
oficial discriminante (`%Comunidad de Madrid%`, `%CARM Murcia%`,
`%Auxiliar Administrativo Estado%`…). Incidente 18/05/2026.

### 4a.ter Botón "Seleccionar lo más importante para [oposición]" en psicotécnicos

El botón aparece en `/psicotecnicos/test` y permite al usuario seleccionar solo
las categorías psicotécnicas que **han caído ≥3 veces en exámenes oficiales**
de su oposición (badge ⭐ Frecuente). Componente:
`app/psicotecnicos/test/PsicotecnicosTestClient.tsx:211-260`.

**UX (post-19/05/2026):** El botón se renderiza **siempre que haya
`target_oposicion` en el perfil del usuario**, en una de dos variantes:

| Hay psicotécnicos oficiales en BD | Variante mostrada |
|---|---|
| Sí (≥1 pregunta `is_official_exam=true` con `exam_source` matcheando) | Botón activo "Seleccionar lo más importante para [oposición]" |
| No (0 preguntas) | Botón deshabilitado en gris: **"[oposición]: sin psicotécnicos en exámenes pasados"** + tooltip explicativo |

La variante deshabilitada existe porque ocultar el botón confunde al usuario
(se pregunta por qué no está). El mensaje explícito es mejor UX.

**Para activar la variante con datos** (función `getCategoryExamFrequency` en
`lib/api/psychometric-test-data/queries.ts:177-282`):

**Pre-requisito (verificar ANTES de tocar config):**
1. El examen oficial de esa oposición **¿incluye parte psicotécnica?** Lee las bases de la convocatoria.
2. **¿Hay preguntas psicotécnicas con `is_official_exam=true` y `exam_source` específico de la oposición en `psychometric_questions`?**
   ```bash
   node -e "
   require('dotenv').config({path: '.env.local'});
   const { createClient } = require('@supabase/supabase-js');
   const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   s.from('psychometric_questions').select('exam_source', { count:'exact' })
     .ilike('exam_source', '%<patrón oposición>%')
     .eq('is_official_exam', true).then(r => console.log(r.count));
   "
   ```
3. **¿Hay ≥3 convocatorias distintas?** Con menos de 3, no aparecerá ningún badge `'frequent'` (solo `'appears'`).

**Decisión:**

| Resultado | Acción |
|---|---|
| Examen oficial SÍ tiene psicotécnicas + ≥3 convocatorias en BD | Añadir el patrón a `examSourcePatterns` |
| Examen oficial SÍ tiene psicotécnicas pero solo 1-2 convocatorias | Añadir el patrón igual (los usuarios verán `📋 Aparece en examen`, no ⭐ Frecuente) |
| Examen oficial **NO tiene parte psicotécnica** (ej: Extremadura, Estatuto auxiliar) | **NO añadir el patrón.** Añadirlo da falsa expectativa que el sistema no puede cumplir (no hay datos que filtrar). |
| BD no tiene aún las psicotécnicas oficiales importadas | NO añadir hasta importar — el botón se activaría con 0 datos y la UX sería confusa |

**Reglas de cálculo del `examFrequency`** (lib/api/psychometric-test-data/queries.ts:177-282):
- Agrupa por `questionSubtype` y cuenta exámenes distintos.
- `examCount >= 3` → `examFrequency = 'frequent'` (⭐ badge)
- `examCount in {1,2}` → `examFrequency = 'appears'` (📋 badge)
- Sin datos → categoría sin badge (botón "más importante" no se renderiza para ella)

**Caso real Extremadura (verificado 19/05/2026):** el examen oficial Auxiliar
Administrativo Junta Extremadura OEP 2018 **no incluye parte psicotécnica** —
solo 30 teóricas + 20 prácticas ofimática. Confirmado por query:
`psychometric_questions WHERE exam_source ILIKE '%Extremadura%' AND is_official_exam=true` → 0 filas.
Por tanto **NO se añadió Extremadura a `examSourcePatterns`** porque no hay
datos que filtrar. Si se añadiera, el botón seguiría sin activarse y daría
una falsa expectativa.

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
| `lib/config/exam-positions.ts` | **OBLIGATORIO** si la oposición tiene examenes oficiales propios. Añadir entrada en `EXAM_POSITION_MAP` y `HOT_ARTICLE_TARGET_MAP`. Sin esto, el filtro cross-oposición bloquea todas las oficiales (default seguro post-15/04/2026). El log emite `[scope] sin mapeo exam_position para "..."` cuando falta. |
| `components/InteractiveBreadcrumbs.tsx` | **No requiere cambios** — se adapta automáticamente desde OPOSICIONES |
| `components/OnboardingModal.tsx` | `OFFICIAL_OPOSICIONES` array. **Obligatorio para toda oposición** (implementada o aspiracional — ver §0.1). Si no está aquí, no aparece ni en el onboarding ni en el selector de cambio. Si ya existía como aspiracional, **mantener el mismo id** para heredar los usuarios con target_oposicion en ese id (ver §0.4). **Los aliases YA NO se ponen aquí** (refactor 07-may-2026): viven en el campo `aliases` de la oposición en `lib/config/oposiciones.ts`. |
| `app/perfil/page.tsx` | Array `oposiciones` del selector |
| `app/oposiciones/page.tsx` | Tarjeta de la oposición (lee de tabla `oposiciones` automáticamente, no requiere cambio si la oposición está en BD). La ruta legacy `/nuestras-oposiciones` es 308 redirect → `/oposiciones` desde 07-may-2026. |
| `app/page.js` | Links en "Test por Oposicion" y tarjeta en "Temarios" |
| `components/CcaaFlag.tsx` | **Logo/bandera/escudo oficial** de la oposición. Ver §4c.bis. Casi siempre la nueva oposición YA matchea por palabra clave (CCAA, "estado/estatal", provincia…) y no hay que tocar nada; **verificar siempre** que resuelve a algo y no cae al emoji de fallback. |

### 4c.bis Logo / bandera / escudo oficial de la oposición (verificar SIEMPRE)

Cada oposición debe mostrar su **identidad visual oficial** (no un emoji genérico) en breadcrumbs, tarjetas y cabeceras. Lo resuelve `components/CcaaFlag.tsx` a partir del `id`/slug de la oposición, por **prioridad**:

1. **Escudo/logo oficial propio del cuerpo** → `<img>` de un SVG en `public/escudos/`, vía `ESCUDO_KEYWORDS`. Tiene prioridad sobre cualquier bandera. Es el caso de cuerpos con emblema institucional: **Guardia Civil** (`/escudos/guardia-civil.svg`), **Policía Nacional** (`/escudos/policia-nacional.svg`). Una **policía municipal** o un cuerpo con logo propio iría aquí también (NO los municipales bajo la bandera de su ayto).
2. **Bandera de lugar específico** (ciudad/provincia/isla, más concreta que la CCAA) → SVG inline en `FLAG_PATHS` + entrada en `PLACE_KEYWORDS`. Ej.: `ayuntamiento-zaragoza` → `zaragoza-ciudad`, `diputacion-zaragoza` → `zaragoza-provincia`.
3. **Bandera de la CCAA / España** → SVG inline en `FLAG_PATHS` vía `KEYWORD_TO_FLAG`. Las **estatales** (AGE, Justicia, cuerpos estatales, INGESA Ceuta/Melilla) caen en el grupo `'espana'`; las **autonómicas** matchean por palabra clave de su CCAA (incluye servicio sanitario, provincias, islas, universidades).
4. **Fallback**: si no resuelve nada, se usa el emoji de la oposición → señal de que **falta** configurar la identidad visual.

**Qué hacer al crear la oposición (decidir el caso y verificar):**

| Tipo de oposición | Acción en `CcaaFlag.tsx` |
|---|---|
| Estatal (AGE, justicia, cuerpo estatal, INGESA) | Suele matchear ya por `'estado'`/`'estatal'`. Si el slug es atípico, **añadir su palabra clave al grupo `'espana'`** de `KEYWORD_TO_FLAG`. |
| Autonómica (CCAA, servicio sanitario, universidad, provincia, isla) | Suele matchear por la palabra clave de su CCAA. Si es un cuerpo/servicio nuevo, **añadir su keyword** al lote de esa CCAA (ej.: `'-sms'` → `murcia`, `'sescam'` → `clm`). |
| Ayuntamiento / Diputación con escudo propio | **Dibujar el SVG** del escudo en `FLAG_PATHS` (`'<lugar>-ciudad'` / `'-provincia'`) + entrada en `PLACE_KEYWORDS`. Si no, hereda la bandera de su CCAA (aceptable como mínimo). |
| Cuerpo con emblema institucional (Guardia Civil, Policía, etc.) | **Colocar el SVG oficial en `public/escudos/`** + entrada en `ESCUDO_KEYWORDS`. |

**Verificación obligatoria** (no asumir que matchea): comprobar que `resolveEscudo(id)` o `resolveFlagKey(id)` devuelven algo para el nuevo `position_type` y para el slug. El orden de `KEYWORD_TO_FLAG` importa: lo más específico primero (p.ej. `castilla-la-mancha` antes que `castilla`, `las-palmas`/`cabildo` antes que `palma`). Para escudos nuevos, usar SVG (escala sin pérdida) y respetar el blasón/identidad oficial (CLAUDE.md: precisión en contenido oficial).

**Cómo obtener el logo/escudo oficial:** la web institucional del organismo casi siempre lo expone. Pasos:
1. Descargar el HTML de la home oficial (`curl -sL <web> -o /tmp/home.html`) y grepear `src="...logo...\.(svg|png)"` / `head_logo` / `marca`. Los portales del Estado (gestor JCR/AEM) sirven los assets bajo `/dam/jcr:<uuid>/<nombre>.(svg|png)`.
2. Descargar el asset a `public/escudos/<slug>.<ext>` (`curl -sL <url> -o public/escudos/<slug>.svg`). **SVG preferible**; **PNG es aceptable** (el componente usa `<img>` con `object-contain`, no se deforma). Verificar que es imagen válida (`file public/escudos/<slug>.svg`).
3. Añadir la entrada en `ESCUDO_KEYWORDS` y verificar que `resolveEscudo()` lo devuelve. Commitear el asset + el cambio de `CcaaFlag.tsx` juntos y desplegar (el logo es estático, aparece tras el deploy; si CloudFront cachea, invalidar).

**Ejemplo real — INGESA (04/06/2026):** mostraba la bandera de España por estar en el grupo `'espana'`. INGESA tiene logo institucional propio → se añadió `[['ingesa'], { src: '/escudos/ingesa.png', alt: 'Logo del INGESA...' }]` a `ESCUDO_KEYWORDS` (la keyword `'ingesa'` cubre los 4 cuerpos: aux-admin, tcae, celador, enfermero). Logo descargado de `ingesa.sanidad.gob.es` (`/dam/jcr:.../head_logo-ingesa.png`, PNG 95×72). El escudo tiene prioridad sobre la bandera, así que NO hace falta sacar `'ingesa'` del grupo `'espana'` (queda de fallback).

### 4d. Tests a actualizar

| Archivo | Que cambiar |
|---------|------------|
| `__tests__/api/theme-stats/themeStats.test.ts` | `toHaveLength(N)` y conteos `byAdmin('autonomica')` etc. |
| `__tests__/config/oposicionesCentralConfig.test.ts` | `ALL_OPOSICION_SLUGS.length` y `byAdmin(<administracion>).length` |
| `__tests__/config/oposicionAliases.test.ts` | Si la nueva oposición es popular y necesita aliases obligatorios, añadir su id a `REQUIRES_ALIASES`. |

### 4d.bis Buscador unificado (refactor 07-may-2026)

Los 3 componentes que filtran oposiciones por término (`OnboardingModal`,
`OposicionChangeModal`, `OposicionGuard`) usan `matchesOposicion(o, term)`
de `lib/utils/searchOposicion.ts`. **No dupliques lógica de filtrado en
componentes nuevos** — importa el helper.

El helper:
- Normaliza tildes (`Autonómica` === `autonomica`).
- Es case-insensitive.
- Matchea por `nombre`/`name`, `categoria`/`badge`, `administracion`, y `aliases`.
- Anti-falsos-positivos: aliases <3 caracteres no permiten partial match.

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

> ⚠️ **`descripcion_corta` es NOT NULL** desde la migración `2026-05-08-topics-descripcion-corta-not-null.sql`. Si no proporcionas un texto específico, usa `title` como fallback razonable. Es lo que se ve en el listado del temario y en las cards. El test `temarioEpigrafeIntegrity` falla si algún topic queda sin él.

3. **Marcar `disponible = false`** los temas sin topic_scope con preguntas (aparecen "En elaboracion" en el listado automaticamente).

4. **Invalidar cache:** ver [`docs/maintenance/cache-revalidation.md`](./cache-revalidation.md). Tras crear/modificar temas hay que invalidar al menos el tag `temario`. Si los cambios son masivos (leyes nuevas, scopes nuevos), usar `node scripts/purge-all-cache.js` que revalida ~550 rutas en ~2 min (landings + tests + temarios + leyes + estáticas).

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

**Tests de consistencia BD obligatorios antes de flip `is_active=true`:**

```bash
# Coherencia entre campos (plazas, URLs, fechas, hitos)
npx jest __tests__/integration/oposicionesDataConsistency --no-coverage

# Completitud de datos (campos mínimos para landing)
npx jest __tests__/integration/oposicionDataCompleteness --no-coverage
```

Estos tests detectan el tipo de bug del caso Extremadura (§2a.3.1): cifras de plazas desincronizadas entre `plazas_libres` y los campos de texto (`seo_description`, hito #1 descripción), y `programa_url` apuntando a un PDF de boletín distinto al hito principal.

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

### 6f. Revalidar cachés (OBLIGATORIO al terminar)

**Procedimiento detallado:** ver [`docs/maintenance/cache-revalidation.md`](./cache-revalidation.md).

Tras crear una oposición nueva (con cualquier combinación de los pasos anteriores), invalidar **al menos estos 3 tags**. Si no, los listados (homepage, `/oposiciones`) y los conteos de temas servirán datos viejos hasta la próxima invalidación natural (24h+).

| Tag | Por qué hay que revalidar al crear oposición | Comando |
|---|---|---|
| `landing` | Lista de oposiciones en homepage, `/oposiciones` (incluye filtros `[filtro]`), sitemaps | `curl -X POST .../api/admin/revalidate -d '{"tag":"landing"}'` |
| `temario` | Topics nuevos + topic_scope nuevos. Sin esto, las páginas `/<slug>/temario` cacheadas pueden mostrar "En elaboración" en temas que sí tienen scope | `... -d '{"tag":"temario"}'` |
| `test-counts` | Conteo de preguntas por tema (usado por `/test`, `/test/aleatorio`). Sin esto, los selectores muestran 0 en temas con preguntas reutilizadas | `... -d '{"tag":"test-counts"}'` |

**Comando completo (con `CRON_SECRET` de `.env.local`):**

```bash
SECRET="<CRON_SECRET>"
for tag in landing temario test-counts; do
  curl -sS -X POST "https://www.vence.es/api/admin/revalidate" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $SECRET" \
    -d "{\"tag\": \"$tag\"}"
  echo
done
```

**Si después importas preguntas (FASE 7 o sesión posterior):** repetir `temario` + `test-counts` o ejecutar `node scripts/purge-all-cache.js` (revalida ISR completo).

**Otras situaciones que requieren revalidar:** sincronización BOE (`teoria` + `temario`), cambios de hitos/plazas (`landing` + ruta específica via `purge-cache`), añadir leyes (`laws`). Tabla completa en el manual de cache-revalidation.

**Workflow automático:** el push a `main` dispara `warm-cache-post-deploy.yml` que calienta ~963 URLs. Pero ese workflow **no invalida tags** — solo precarga páginas con cache existente. Por eso los 3 `revalidateTag` de arriba son obligatorios además del deploy.

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

## FASE 8: Campaña de Google Ads (captación, fase final)

Una vez la oposición está **pública y verificada** (`is_active=true`, desplegada, landing/temario/tests OK), el último paso para captar leads es crearle una **campaña de Google Ads**. El proceso completo, el modelo de campaña y los gotchas están en el runbook **[`../runbooks/google-ads-analisis.md`](../runbooks/google-ads-analisis.md) §"Crear una campaña nueva para una oposición"** — seguirlo siempre (no improvisar).

**Prerrequisitos (no crear sin esto):**
- `oposiciones.is_active=true` y landing viva (la campaña manda tráfico a `vence.es/<slug>`; si no está viva, se quema presupuesto en una página rota).
- `oposiciones.exam_date` relleno (sin fecha de examen no se conoce la ventana de venta; el gasto solo convierte cerca del examen — aprendizaje clave del runbook).

**Modelo (el de las campañas que funcionan):** Search · **Maximizar clics** (`target_spend`) con **CPC máx 0,05€** (`cpc_bid_ceiling_micros: 50000`) · **~3€/día** · geo = **comunidad de la oposición** (regional; **España=2724** solo para oposiciones NACIONALES como Estado/INGESA/Justicia/Guardia Civil) · idioma español (`languageConstants/1003`) · 1 grupo · 1 anuncio RSA · **keywords de intención SIN marca** (nunca "vence oposiciones": ya rankea gratis en orgánico).

**Nombre (norma Manuel):** prefijo de grupo `C2` (Auxiliar Administrativo, Auxilio Judicial…) o `C1` (Administrativo, Tramitación…) + nombre claro y desambiguado territorialmente (comunidad ≠ ayuntamiento).

**Creación:** no hay comando `ads:campaign create` (ese script solo hace pause/enable/budget). Se crea con un `customer.mutateResources([...])` atómico a medida (temp IDs negativos: budget→campaign→criterios geo+idioma→ad_group→RSA→keywords), **SIEMPRE con `{validate_only:true}` (dry-run) antes de aplicar**. Obligatorio `contains_eu_political_advertising='DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'`. El anuncio pasa revisión de Google antes de servir. Es **gasto real** → confirmar con Manuel antes del create definitivo.

**Tras crearla:** verificar con `npm run ads:report` que aparece, y a las 3-4 semanas cruzar coste vs ingreso real con `npm run ads:roi` (no optimizar por "conversiones"=registros; el ROI real es cerca del examen).

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

### Caso Extremadura (abril 2026)

#### 13. Post-acumulación: actualizar TODOS los campos derivados

Ver §2a.3.1 para el checklist completo. Resumen del incidente: la Orden original (23/12/2024, DOE 250, 30 plazas) se acumuló con una segunda Orden (17/12/2025, DOE 244, 116 plazas adicionales → 146 totales). Se actualizaron los campos numéricos pero quedaron obsoletos `seo_description` ("106 plazas"), `landing_description` (fecha antigua), `programa_url` (PDF de la Orden original con 30 plazas), `convocatoria_hitos[#1].descripcion` y `.url` (corrección de errores, no la Orden acumulada).

**Regla:** después de un UPDATE por acumulación, recorrer el checklist §2a.3.1 punto por punto y ejecutar los tests de consistencia (§6a). Los tests cross-field detectan 4 de las 5 inconsistencias de este patrón.

#### 14. Newsletter post-publish: dos plantillas distintas según audiencia

Al publicar una oposición nueva, el envío de newsletter se hace en dos tandas con plantillas diferentes:

| Audiencia | Filtro | Plantilla | Mensaje |
|-----------|--------|-----------|---------|
| Target directo | `user_profiles.target_oposicion = '<slug_underscores>'` | `novedad-convocatoria` | "Tu oposición ya está lista para practicar" |
| Cross-sell local | `user_sessions.region` o `city` en la CCAA + `target_oposicion` distinto (excluir oposiciones administrativas incompatibles) | `oposicion-cruzada` | "Prepara <nueva oposición> sin empezar de cero" (aprovecha temas comunes con la actual) |

Para el cross-sell local, filtrar por ciudades (mayor precisión que solo región) y descartar usuarios con pocas sesiones (ej: `>=5` sesiones o `>=50%` del total) para evitar falsos positivos de usuarios "de paso". Detalles de flujo en `docs/maintenance/oeps-convocatorias-seguimiento.md` §7b y `docs/procedures/enviar-newsletter-con-plantilla-bd.md`.

**Variables específicas de `oposicion-cruzada`:**
- `oposicionActual` — se resuelve automáticamente por destinatario (no se pasa manualmente)
- `nuevaOposicion`, `nuevaOposicionCorta` — nombre de la oposición a promocionar
- `temasComunesHtml` — lista de `<li>` con temas que comparten ambas oposiciones (ej: TREBEP, Ley 39/2015, Ley 40/2015, PRL). Ver regla anti-ofimática en "Gotchas reales aprendidos en producción (cross-sell)".
- `ctaUrl` — apuntar a la landing (no al /test) para que el destinatario conozca primero la oposición nueva

### Caso Galicia (marzo 2026)

### 1. Temas sin preguntas deben decir "En elaboración"

Un tema puede tener scope (artículos vinculados) pero 0 preguntas. Si el usuario entra a hacer un test de ese tema, ve un test vacío y se frustra.

**Solución implementada:** `TestHubPage.tsx` verifica que cada tema tenga al menos 1 pregunta activa. Si no tiene, muestra "En desarrollo" en vez de un enlace activo.

**Regla:** Después de crear los scopes de una oposición nueva, SIEMPRE contar preguntas por tema (sección 3f). Los temas con 0 preguntas deben quedar visibles pero deshabilitados hasta que se importen preguntas.

### 2. Temas de contenido virtual (ofimática, gestión documental) sin ley → marcar como inactivos

Si un tema requiere una ley virtual que no existe (ej: LibreOffice Writer, gestión documental de una CCAA), marcar el topic como `is_active: false` en la BD. Esto hace que aparezca como "En elaboración" en tests y temario.

**No vincular leyes de otra suite/sistema:** Si el programa pide LibreOffice, NO vincular leyes de Microsoft Office. Los contenidos son diferentes y las preguntas serían incorrectas.

#### 2.1 Señales de "En elaboración" y cómo REACTIVAR un tema

Un tema aparece como "En elaboración" en la UI por **3 señales independientes** (cualquiera de ellas lo activa):

| Señal | Campo BD | Dónde se comprueba |
|-------|----------|---------------------|
| `topics.is_active = false` | booleano | `TestHubPage.tsx`, temario |
| `topics.disponible = false` | booleano | `TemarioClient.tsx` (línea `disponible !== false`) |
| `topics.descripcion_corta` empieza con `"En elaboracion."` o similar | texto hardcoded | Renderizado literal en listado |

**Cuando un tema pasa de "En elaboración" a tener contenido real** (porque se han creado las leyes, scope y preguntas), hay que ejecutar **TODOS** estos pasos o el tema seguirá apareciendo como en elaboración:

```
□ topics.is_active = true
□ topics.disponible = true
□ topics.descripcion_corta — BORRAR el prefijo "En elaboracion." si lo tiene
  (reescribir con una frase corta descriptiva del tema)
□ Revalidar cache (datos + paginas ISR de la oposicion):
  ver docs/maintenance/cache-revalidation.md (recomendado: node scripts/purge-all-cache.js)
```

**Query SQL de reactivación rápida:**
```sql
UPDATE topics SET
  is_active = true,
  disponible = true,
  descripcion_corta = REGEXP_REPLACE(descripcion_corta, '^En elaboraci[oó]n\.\s*', '')
WHERE position_type = '<slug_con_underscores>'
  AND topic_number IN (N1, N2, ...);
```

**Verificación post-reactivación:**
```javascript
// Ninguna debe quedar con is_active=false, disponible=false, o "elaboracion" en descripcion_corta
SELECT topic_number, is_active, disponible, descripcion_corta
FROM topics
WHERE position_type = '<slug>'
  AND (is_active = false OR disponible = false OR descripcion_corta ILIKE '%elaboraci%');
```

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

Las páginas del temario y tests se generan en build time (`revalidate = false` o `revalidate = 2592000`). Después de cambios en la BD hay que invalidar caché.

**Procedimiento detallado, comandos vigentes y endpoints actuales:** ver [`docs/maintenance/cache-revalidation.md`](./cache-revalidation.md). No replicar comandos aquí — pueden quedar obsoletos.

---

## Gotchas reales aprendidos en producción (cross-sell con otras oposiciones)

Cuando una oposición nueva se anuncia, suele seguir un cross-sell newsletter promocionándola a opositores que preparan oposiciones relacionadas. Al redactar ese cross-sell hay dos errores reales que se han cometido.

### 1. Overlap de temario: verificar tema a tema contra `lib/config/oposiciones.ts`

Es tentador escribir frases tipo **"prepara las dos a la vez, comparten casi todo"**. Es falso en la mayoría de casos.

**Dato verificado** (Estado C2 ↔ Galicia C2, abril 2026): solo **~40% del temario** es realmente común. Los 6 temas idénticos son:

1. Constitución Española de 1978
2. Ley 39/2015 (LPAC) — ley estatal, idéntica en ambas
3. Ley 40/2015 (LRJSP) — ley estatal, idéntica en ambas
4. Unión Europea (instituciones + derecho derivado)
5. Informática básica y sistemas operativos
6. Marco común de protección de datos, transparencia e igualdad

**Lo que parece común pero NO lo es**:
- **Transparencia**: Estado = Ley 19/2013 estatal / Galicia = Ley 1/2016 autonómica. El marco general coincide, pero el articulado no.
- **Empleo público**: Estado = EBEP general / Galicia = Ley 2/2015 autonómica. Base común, desarrollo distinto.
- **Igualdad**: Estado = LO 3/2007 / Galicia = Ley 7/2023 autonómica. Temas distintos en preguntas.

**Lo específico de cada una** (no mencionar como común):
- **Solo Estado**: Corona, Cortes Generales, TC, Poder Judicial, Gobierno, AGE
- **Solo Galicia**: Estatuto de Autonomía, Ley 16/2010 organización Admin Galicia, régimen financiero y presupuestario gallego, Ley 31/1995 PRL (este en algunas otras CCAA tampoco está)

**Regla para redactar cross-sell**:

1. Abrir `lib/config/oposiciones.ts` y localizar los dos `positionType` implicados.
2. Comparar `blocks[*].themes[*].name` tema a tema.
3. Listar solo los **realmente idénticos** (misma ley, mismo programa).
4. Para los que comparten "marco" pero no articulado (transparencia, empleo público, igualdad), mencionar como *"marco común"* sin prometer que sea el mismo tema.
5. Nunca vender como común algo que el opositor tendría que re-estudiar.

### 2. Ofimática Estado ≠ Ofimática Galicia (Microsoft vs LibreOffice)

Aunque ambos temarios tienen un "bloque de ofimática" con nombres similares (Word, Excel, procesador de textos, hoja de cálculo), son **dos mundos incompatibles**:

| Oposición | Suite ofimática | Programas específicos |
|---|---|---|
| Aux Admin Estado | Microsoft Office 365 | Word, Excel, Access, Windows 11 |
| Aux Admin Xunta Galicia | LibreOffice | Writer, Calc, Impress |
| Adm Galicia | LibreOffice | Writer, Calc, Impress |

**Incidente a evitar**: incluir ofimática en `temasComunesHtml` de un cross-sell Estado↔Galicia es un error de fondo. Aunque el usuario domine Excel, tendría que aprender Calc desde cero (atajos distintos, menús distintos, formato de archivo distinto, preguntas distintas).

**Regla**: si alguna de las dos oposiciones implica LibreOffice (la mayoría de CCAA) y la otra Microsoft Office (Estado + algunas), **nunca** listar ofimática como tema común en cross-sell. Recordar esta asimetría al escribir landing pages o material comercial.

### 3. Cross-sell: excluir usuarios ya en la oposición destino

Al construir la audiencia del cross-sell, filtrar explícitamente los `target_oposicion` de destino. Un email "prepara Galicia" a quien ya prepara Galicia es absurdo y daña la confianza.

```javascript
const DESTINO = new Set(['auxiliar_administrativo_galicia', 'administrativo_galicia']);
const candidatos = gallegos.filter(u => !DESTINO.has(u.target_oposicion));
```

Esto se suma a los filtros genéricos de audiencias descritos en `docs/procedures/enviar-newsletter-con-plantilla-bd.md` (target_oposicion corrupto, paginación Supabase, etc.).

### 4. Referencia cruzada con el manual de newsletters

Para el resto de gotchas operativos al enviar el cross-sell (paginación Supabase a 1000 filas, `previewData` que rompe el render, subject sin userName, `fromEmail` correcto, matching de ciudades), ver `docs/procedures/enviar-newsletter-con-plantilla-bd.md` → sección *"Gotchas reales aprendidos en producción"*.

---

## Lecciones aprendidas creando Aux. Admin. Diputación de León (abr 2026)

Gotchas que el manual no dejaba claros y se descubrieron al crear la oposición 33:

### 1. `topics.description` debe estar poblado (no solo `descripcion_corta`)

El test `temarioEpigrafeIntegrity` exige que `description` no sea nulo/vacío. Y el test `temarioSemanticCoherence` exige que `descripcion_corta` tenga **≥40% de keywords presentes en `title`+`description`**. La receta segura:

```sql
UPDATE topics
SET descripcion_corta = title,
    description       = epigrafe
WHERE position_type = '<position_type>';
```

Si pones `descripcion_corta = epigrafe` (el texto largo) sueles caer por debajo del 40% de overlap con el title y el test `temarioSemanticCoherence` falla.

### 2. BOCYL/BOPZ ≠ BOE: la fecha que dispara el plazo es la del BOE

En oposiciones autonómicas/locales hay **dos publicaciones**:
- **Boletín autonómico** (BOCYL, BOPZ, DOG, etc.) → publica las bases completas
- **BOE** → publica el *resumen* de convocatoria. **Esta es la que dispara el plazo de 20 días hábiles**.

Consecuencia en BD:
- `boe_publication_date` debe ser la del **BOE** (no la del boletín autonómico), porque de ahí se calcula el `inscription_deadline`
- `boe_reference` puede ser del BOE; opcional añadir "(BOCYL dd/mm/yyyy)" entre paréntesis
- El hito BOCYL y el hito BOE son dos entradas distintas en `convocatoria_hitos`

### 3. Tests con conteos hardcoded que se rompen al añadir oposición

Al incorporar una oposición nueva hay que incrementar los literales en **tres tests**:

| Test | Qué actualizar |
|------|----------------|
| `__tests__/config/oposicionesCentralConfig.test.ts` | `ALL_OPOSICION_SLUGS.length` y `ALL_POSITION_TYPES.length` |
| `__tests__/api/theme-stats/themeStats.test.ts` | `VALID_OPOSICIONES.toHaveLength(N)` (×2) + lista de `toContain` |
| `__tests__/temario/articleTestButton.test.ts` | Conteo de `TopicContentView.tsx` (uno por oposición con rutas propias) |

### 4. `PositionType` Zod schema es derivado (NO editar a mano)

`lib/api/tema-resolver/schemas.ts` genera el enum Zod dinámicamente desde `OPOSICIONES`:
```ts
export const PositionTypeSchema = z.enum(OPOSICIONES.map(o => o.positionType) as [string, ...string[]])
```
Basta con añadir la entrada en `lib/config/oposiciones.ts`. No hay enum manual que actualizar.

### 5. `convocatoria_hitos.fecha` es NOT NULL

No se pueden insertar hitos *upcoming* sin fecha como placeholder. O se espera a tener la fecha real, o se pone una estimada y se corrige después. Insertar solo los hitos ya ocurridos es una estrategia válida: el cron de seguimiento (`/api/cron/check-seguimiento`) detecta cambios en la web oficial y se añaden posteriormente.

### 6. Técnica cp+sed para duplicar rutas Next.js de una oposición hermana

Para oposiciones con estructura de rutas similar a otra ya existente (p.ej. Diputación León ← Diputación Zaragoza):

```bash
cp -r app/<oposicion-hermana> app/<oposicion-nueva>
cd app/<oposicion-nueva>
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" \) \
  -exec sed -i 's/<slug-hermana>/<slug-nueva>/g; s/<position_type_hermana>/<position_type_nueva>/g; s/<Nombre Hermano>/<Nombre Nuevo>/g' {} +
```

**Después, revisar a mano:**
- `temario/[slug]/page.tsx` → `generateStaticParams` usa `length: N` (número de temas)
- `temario/[slug]/TopicContentView.tsx` → función `getBlockInfo` tiene rangos de bloques cableados
- `temario/layout.js`, `test/page.tsx`, `test/layout.tsx` → keywords SEO con literales "N temas" y "M bloques" — hay que sustituirlos también

### 7. Reutilización máxima de leyes ya existentes

Antes de crear leyes nuevas, hacer inventario en BD. Muchas oposiciones CyL/La Rioja/Zaragoza ya tienen cargadas **todas** las leyes autonómicas y estatales habituales (Estatuto CyL, Función Pública CyL, Régimen Local CyL, Transparencia CyL, Igualdad CyL, etc.). Querying por `short_name` con los códigos típicos (`Ley X/YYYY CyL`, `LO 14/2007`, `LPRL`, etc.) evita duplicar y asegura que las preguntas heredadas se reutilizan automáticamente vía `topic_scope`.

Ejemplo real: al añadir Dip. León (25 temas), **no hubo que crear ninguna ley nueva** y se heredaron ~10k preguntas automáticamente de las otras oposiciones.

---

## Lecciones aprendidas creando Aux. Admin. SCS Canarias (jun 2026)

Primera oposición **sanitaria estatutaria** creada de cero (22 temas, 12 con banco heredado + 10 generados con IA, incluidos 4 decretos canarios y 2 temas genéricos). Aprendizajes que corrigen o completan estos manuales:

### 1. `scope='regional'`, NO `'autonomic'`, al crear leyes
El check constraint de `laws.scope` admite `'national' | 'regional' | 'local' | 'eu'`. El ejemplo del Paso 1 de **`monitoreo-boe-y-crear-leyes-nuevas.md`** comenta `'autonomic'` — es incorrecto y **rompe el INSERT**. Para una ley/decreto autonómico usar `scope: 'regional'`.

### 2. Decretos autonómicos (BOC/DOG/DOGC…) NO están en el consolidado del BOE
El flujo "crear ley nueva" de `monitoreo-boe-…` asume `boe_url` + `/api/verify-articles/sync-all` (parsea boe.es). Los **decretos autonómicos no suelen estar en el consolidado del BOE** → el sync no encuentra artículos. Hay que **crear los artículos a mano** (INSERT en `articles` con el texto literal extraído del BOC oficial). Mismo resultado: ley + artículos + `topic_scope`, pero sin sync. Verificar el texto contra el PDF oficial del boletín autonómico (Libro Azul / sede del Gobierno autonómico), nunca academias.

### 3. El temario puede estar en un boletín ANTERIOR referenciado por la convocatoria
En categorías estatutarias (SCS y otros servicios de salud), la **convocatoria no incluye el temario en su anexo**: su Anexo de temarios **remite a una Resolución/BOC anterior** que aprobó los programas (caso SCS: convocatoria BOC 116/2025 → temario en BOC 117/2019). En FASE 1, tras localizar la convocatoria, **buscar a qué norma remite el anexo de temarios** y extraer el programa de ahí.

### 4. `transition_question_state` exige los CUATRO checks `=true` (incluido `options_ok`)
El RPC de promoción a `approved` requiere una verificación con `article_ok + answer_ok + options_ok + explanation_ok` **todos true**. El ejemplo del **Paso 8 de `generar-preguntas-con-ia.md`** solo escribe 3 (`article_ok/answer_ok/explanation_ok`) → hoy la promoción **falla** (`AI promotion blocked: lacks a complete passing verification`). Incluir siempre `options_ok: true` en el upsert a `ai_verification_results`.

### 5. Preguntas "intruso": opciones reales también literales + un bullet por distractor
`generar-preguntas-con-ia.md` §2.2 exige literalidad de la **opción correcta**. Pero en preguntas tipo "¿cuál NO figura?", el auditor Sonnet rechaza (con razón) que las **3 opciones que SÍ reproducen el artículo** estén truncadas: el opositor debe poder verificarlas contra la ley. Regla práctica: **toda opción que cite el artículo va en literal íntegro, sea correcta o distractor**. Y en la explicación, **un bullet por cada distractor** (no agrupar "B), C) y D)…").

### 6. Temas genéricos sin ley → crear una "ley virtual" de contenido de referencia
Para temas estándar sin norma concreta (suministros/almacén, nómina, atención al público), el patrón de las leyes virtuales de ofimática es replicable: crear una **ley virtual** (`type='law'`, `scope='national'`, `boe_url=null`, `verification_status='actualizada'`) con **artículos de contenido de referencia fiel** (conceptos administrativos estándar), mapear `topic_scope` y generar preguntas contra ese contenido. La auditoría pasa a ser de **coherencia interna** (no hay fuente legal literal); avisar de que no hay respaldo normativo. Caso SCS: ley virtual `gestion-administrativa-suministros-nomina` (art 1 suministros, art 2 nómina) para T16 y T18.

### 7. Multi-convocatoria: una fila `oposiciones` = la convocatoria VIGENTE
Cuando una oposición encadena convocatorias (p. ej. OEP 2024 ya celebrada + OEP nueva), la fila debe reflejar **solo la convocatoria vigente** (`convocatoria_numero`, plazas, `exam_date`). Los hitos de la convocatoria ANTERIOR **se borran de `convocatoria_hitos`** (su historia queda en `officialExams` de `oposiciones.ts`); si se dejan, aparecen `order_index` duplicados y el test `oposicionesDataConsistency` falla (hito #1 con plazas viejas, exam_date ≠ hito examen). Ver `oeps-convocatorias-seguimiento.md` §4d (reindexar) y §4e (hitos = solo hechos de la convocatoria vigente). Tras limpiar, reindexar `order_index` secuencial por fecha.

> **Pendientes de portar a su manual** (no editados aquí por estar esas guías en edición paralela): lecciones 1-2 → `monitoreo-boe-y-crear-leyes-nuevas.md`; lecciones 4-5 → `generar-preguntas-con-ia.md`; lección 7 → `oeps-convocatorias-seguimiento.md`.

---

## Manuales relacionados

Crear una oposición encadena con el resto del flujo de contenido:

- **[`verificar-epigrafe-topic-scope.md`](./verificar-epigrafe-topic-scope.md)** — audita cada `topic_scope` creado en FASE 3 contra el epígrafe oficial (excesos, huecos, solapamientos). Obligatorio antes de `is_active=true`.
- **[`monitoreo-boe-y-crear-leyes-nuevas.md`](./monitoreo-boe-y-crear-leyes-nuevas.md)** — cuando un tema necesita una ley/disposición que NO está en BD (FASE 3d): créala o sincronízala desde el BOE (`includeDisposiciones: true` para disposiciones adicionales).
- **[`generar-preguntas-con-ia.md`](./generar-preguntas-con-ia.md)** — para temas con scope correcto pero 0 preguntas (leyes autonómicas/locales recién creadas, materia sin banco).
- **[`importar-examen-oficial-completo.md`](./importar-examen-oficial-completo.md)** — FASE 7: importar exámenes oficiales pasados (PDFs → preguntas verificadas).
- **[`oeps-convocatorias-seguimiento.md`](./oeps-convocatorias-seguimiento.md)** — alta de `seguimiento_url`, hitos del proceso y modelo "Claude mete, el cron revisa".
- **[`cache-revalidation.md`](./cache-revalidation.md)** — revalidar tags `landing`/`temario`/`test-counts` al terminar (FASE 6f).
- **[`../runbooks/google-ads-analisis.md`](../runbooks/google-ads-analisis.md)** — FASE 8: crear la campaña de Google Ads de captación (§"Crear una campaña nueva"), tras `is_active=true`.
