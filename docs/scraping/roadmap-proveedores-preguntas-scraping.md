# Roadmap de Scraping de Proveedores

> **Fecha:** Abril 2026
> **Estado:** Planificado
> **Propósito:** Priorizar y planificar el scraping de nuevos proveedores de preguntas

---

## Proveedores ya scrapeados

| Proveedor | Manual | Scraping |
|---|---|---|
| OpositaTest | `opositatest-api-manual.md` | Completado |
| InnoTest | `innotest-app-manual.md` | Completado |
| Testea | `testea-app-manual.md` | Completado |
| Aula Plus | `aulaplus-app-manual.md` | Completado |
| TuTestDigital | `tutestdigital-api-manual.md` | Completado |

**Total scrapeado:** ~700K+ preguntas

---

## ⚠️ Estado de IMPORTACIÓN a BD (verificado 2026-06-03)

> **`Scraping` ≠ `Importado a BD`.** Tener el JSON en `preguntas-para-subir/`
> NO significa que las preguntas estén en la tabla `questions`. Esta tabla
> distingue ambas cosas para no re-importar lo ya hecho ni dar por hecho lo
> que falta. **No existe columna `source` en `questions`** — el origen no queda
> trazado en BD; la única forma fiable de saber si un proveedor está subido es
> muestrear textos del disco y buscarlos por `ilike` en `question_text`
> (lo que se hizo para esta tabla, muestra de ~20 por proveedor).

| Proveedor | En disco | Importado a BD | Evidencia (muestra ilike) |
|---|---|---|---|
| **OpositaTest** | ~95K (`preguntas-para-subir/Tema_*`, `source: opositatest`) | ✅ **Sí** | 20/20 en BD |
| **InnoTest** | 71.833 (`innotest-*`) | ✅ **Sí** | 20/20 en BD |
| **Aula Plus — sanitaria / TCAE** | ~128K (`aula-plus/raw/`, ramas ENFERMERÍA/CELADOR/AUX ENFERMERÍA…) | ✅ **Parcial** | Importada en la verificación clínica FASE 2 (~17.546 re-vinculadas/enriquecidas, `/tmp/aulaplus_audit`). La parte importada es la TCAE legislativa+técnica, NO el banco clínico íntegro. Ver `docs/roadmap/fase2-verificacion-preguntas-alteradas.md` |
| **Aula Plus — AUXILIAR ADMINISTRATIVO** | 11.281 (`aula-plus/raw/`, branch id 6) | ❌ **NO** | 0/8 en BD. **Pendiente de importar** — es el material para SMS (origin 18 Región de Murcia: 555 preg.) y CLM (origin 12 Castilla-La Mancha: 981 preg.). Solo ~1% trae explicación → requiere vincular artículo + redactar explicación con agentes |
| **TuTestDigital** | 171.034 (`tutestdigital/`) | ❌ **NO** | 1/20 en BD. **Pendiente de importar** (mucho mayor que los ~5K de Extremadura que decía la nota antigua) |
| **Testea** | 12,2K (`testea/flat/questions.ndjson`) | ❌ **NO** | 3/20 en BD, y esos 3 son duplicados de ley común (CE/LPAC/TREBEP) ya presentes vía OpositaTest/InnoTest |

**Resumen:** Subidos OpositaTest e InnoTest (completos) y la rama sanitaria de Aula Plus (parcial, FASE 2). **Pendientes: TuTestDigital (171K), Aula Plus aux. admin (11K) y Testea (12K).**

---

## Nuevos proveedores — Roadmap

### Fase 1: Acceso inmediato, sin coste (~15 min)

#### 1.1 OposicionesTest.es — ❌ NO ES GRATIS (descartado Fase 1)

| Campo | Valor |
|---|---|
| **URL** | https://oposicionestest.es/ |
| **Preguntas** | 7,541 justificadas (pero solo 10 en demo gratuito) |
| **Oposiciones** | 5 leyes: CE, TREBEP, LPAC, Ley 55/2003, Ley 3/2018 |
| **Autenticacion** | **Pago obligatorio** (6.99€/mes minimo) |
| **Tech stack** | PHP + jQuery, server-rendered, Stripe/PayPal |
| **Dificultad** | Trivial una vez con acceso |
| **Valor para Vence** | Medio — solo 5 leyes, explicaciones con articulo citado |

**Hallazgos (27/04/2026):**
- Solo existe `/test-ejemplo/modo-estudio` gratuito con **10 preguntas fijas** (siempre las mismas)
- Las preguntas estan en HTML inline con `<input type="hidden" name="respuesta_correcta" value="d" />`
- Cada pregunta incluye ID, referencia a articulo del BOE, y explicacion con literalidad
- El contenido real (7.5K) esta detras de pago (6.99€/1 mes, 12.99€/3 meses, 21.99€/6 meses)
- No hay API, es server-rendered con jQuery
- **Movido a Fase 2** — requiere suscripcion

**Estructura de datos (confirmada):**
```html
<input type="hidden" name="respuesta_correcta" value="d" />
<input type="hidden" name="pregunta[0]" value="45" />  <!-- ID -->
<div class="pregunta">1. Segun lo dispuesto en la Ley 39/15...</div>
<div class="opcion-item"><div class="opcion"> La libertad</div></div>
<div id="referencia">
  <a href="https://oposicionestest.es/boe/ley-39-15#Artículo-10">Articulo 10.4</a>
  <div>1. Interesados => firmar a traves de cualquier medio que:...</div>
</div>
```

---

#### 1.2 OpoSapiens — ✅ API MAPEADA, LISTO PARA SCRAPEAR

| Campo | Valor |
|---|---|
| **URL** | https://oposapiens.com/ |
| **Package** | `com.opotest.es` |
| **Version** | 100.01.07 |
| **Tamano APK** | 2.6 MB (base APK) / 11.46 MB (XAPK con splits) |
| **Developer** | Smart Cat SC |
| **Framework** | **Cordova** (WebView puro → `oposapiens.com/oposapiensapp/`) |
| **Preguntas totales** | **29,024** (271 normas/leyes) |
| **Preguntas gratuitas** | **~6,000** (~20-30 por norma sin auth) |
| **Oposiciones** | Aux Estado, GC, Policia Nacional, Justicia, Correos, IIPP, Admin Local, CCAA |
| **Autenticacion** | **Ninguna** para contenido free (solo header X-Requested-With) |
| **Dificultad** | **Trivial** — API PHP sin auth, JSON directo |
| **Valor para Vence** | 6K preguntas gratuitas con articulo + literalidad, multi-oposicion |

**Estado (27/04/2026): API 100% mapeada y probada en vivo.**

**Arquitectura descubierta:**
- App = Cordova wrapper que abre `https://oposapiens.com/oposapiensapp/index.php?usuario_prueba=usuario_prueba`
- Backend = PHP plano en `oposapiens.com/oposapiensapp/`
- Frontend = jQuery Mobile 1.4.5 + `funcionalidad_v37.js` (185 KB, 77 funciones)
- Auth: Solo requiere header `X-Requested-With: com.opotest.es` O `Referer: https://oposapiens.com/` (sin ambos → 403)
- Sin rate limiting detectado, sin tokens, sin cookies

**Endpoints descubiertos:**

| Endpoint | Metodo | Params | Respuesta |
|---|---|---|---|
| `cargar_pagina_normas.php` | POST (vacio) | ninguno | JSON: 271 normas con id, nombre, articulos, titulos, num_preguntas |
| `cargar_lista_test.php` | POST | id, num_preguntas | JSON: [0]=total, [1..N]=preguntas (max 30 free) |
| `cargar_pagina_sectores_oposiciones.php` | POST (vacio) | ninguno | JSON: 9 sectores (Admin, Hacienda, Justicia, Sanidad, Educacion, Seguridad, Informatica, Correos, IIPP) |
| `cargar_pagina_oposiciones.php` | POST | id, nombre (del sector) | JSON: oposiciones del sector |
| `cargar_pagina_examenes_oficiales.php` | POST | id, nombre (de la opo) | JSON: examenes oficiales (vacio para free) |
| `cargar_preguntas_examen_oficial.php` | POST | idExamen, nombre | JSON: preguntas del examen (premium) |
| `cargar_examenes_personalizados.php` | POST | ? | Tests personalizados del usuario |
| `cargar_estadisticas_usuario.php` | POST | ? | Stats del usuario |
| `cargar_estadisticas_test.php` | POST | ? | Stats por test |
| `actualizar_estadisticas_usuario.php` | POST | ? | Guardar progreso |

**Formato de pregunta (JSON):**
```json
{
  "id": 1,
  "id_norma": 1,
  "enunciado": "Segun el articulo 1 de la CE, ¿Cual de estos NO es un valor superior...?",
  "a": "La libertad",
  "b": "La igualdad",
  "c": "La fraternidad",
  "d": "El pluralismo politico",
  "correcta": "c",
  "articulo": 1,
  "libro": null,
  "titulo": 0,
  "capitulo": null,
  "seccion": null,
  "tema": null,
  "tipo_psicotecnico": null,
  "literalidad": "Espana se constituye en un Estado social y democratico de Derecho...",
  "justificacion": null
}
```

**Normas mas relevantes para Vence (free questions):**

| Norma | Total | Free | Relevancia |
|---|---|---|---|
| Constitucion Espanola | 614 | 30 | Aux Estado, GC, todas |
| Ley 39/2015 (LPAC) | 574 | 30 | Aux Estado |
| TREBEP RDL 5/2015 | 471 | 30 | Aux Estado, todas |
| LRJSP Ley 40/2015 | 401 | 30 | Aux Estado |
| LBRL Ley 7/1985 | 324 | 30 | Admin Local |
| Ley 55/2003 (Estatuto Marco) | 290 | 30 | TCAE/Sanidad |
| Ley 7/2005 FP CyL | 141 | 20 | CyL |
| LOPDGDD Ley 3/2018 | 156 | 20 | Aux Estado |
| LO 2/1986 FCSE | 80 | 10 | GC |

**Script de scraping (listo para ejecutar):**
```bash
# Scrapear las ~6,000 preguntas free de las 271 normas
# Tiempo estimado: ~15 min (271 requests × 200ms delay)
node scripts/scrape-oposapiens.cjs
```

**Limitaciones:**
- Solo ~20-30 preguntas free por norma (el resto es premium)
- Examenes oficiales vacios para usuarios free (0 en todas las oposiciones)
- Sin campo `justificacion` en la mayoria (solo `literalidad` del articulo)
- Premium desbloquea las 29K completas + examenes oficiales (precio desconocido)

---

### Fase 2: Esfuerzo medio, requiere pago (3-5 dias)

#### 2.0 OposicionesTest.es (movido desde Fase 1)

Requiere suscripcion de **6.99€/mes**. Ver seccion 1.1 para detalles tecnicos completos.
Una vez con acceso: scrapear todos los tests en modo estudio (HTML parsing, ~30 min).

---

#### 2.1 ActivaTest (App Android)

| Campo | Valor |
|---|---|
| **URL** | https://activatest.com/ |
| **Package** | `com.app.activa_test.android` |
| **Developer** | ACTIVATEST SOCIEDAD LIMITADA |
| **Preguntas** | 30,870 |
| **Oposiciones** | Aux Estado, GC, Policia Nacional, Correos, SERMAS celador, Inst. Penitenciarias, Admin SS |
| **Autenticacion** | Registro + suscripcion (CE y LPAC gratis) |
| **Dificultad** | Media |
| **Valor para Vence** | Oposiciones que coinciden 1:1 con oferta actual + futuras |

**Approach:**
1. Descargar APK desde Play Store / APKPure
2. Analisis estatico:
   - Detectar framework (Cordova / RN / Flutter / Nativa)
   - Extraer endpoints del bundle
3. Registrar cuenta (CE y LPAC son gratis, el resto requiere pago)
4. Mapear API con contenido gratuito
5. Si la estructura es consistente, el mismo script sirve para todo

**Notas:**
- Solo 1K descargas → empresa pequena, seguridad probablemente basica
- Web es WordPress puro → la API de la app sera independiente
- Publicacion semanal de tests nuevos → corpus crece

---

#### 2.2 ExaminaTest.es

| Campo | Valor |
|---|---|
| **URL** | https://www.examinatest.es/ |
| **Preguntas** | 145,561 (50 oposiciones) |
| **Oposiciones relevantes** | Aux Estado (2.5K), GC (4K), Administrativo Estado (10K), Justicia (10K+), Policia Nacional (5.8K), Correos, Hacienda (7.3K) |
| **Autenticacion** | Suscripcion (estimado ~10€/mes) |
| **Tech stack** | Web app — framework no identificado (no SPA visible) |
| **Dificultad** | Media |
| **Valor para Vence** | Segundo mayor corpus (145K), 99% con explicacion citando articulo |

**Approach:**
1. Registrar cuenta de pago (1 mes minimo)
2. Inspeccionar Network al hacer tests:
   - Identificar API de preguntas (JSON endpoint probable)
   - Mapear parametros: oposicion, tema, cantidad
3. Si es server-rendered (PHP clasico):
   - Parsear HTML de cada test completado
   - Mas lento pero viable
4. Si tiene API REST:
   - Scrapear paginado por oposicion/tema
5. Estimar: 145K preguntas / ~50 por test = 2,900 tests a completar
   - Con API directa: ~2-4 horas
   - Con HTML parsing: ~8-12 horas

**Valor critico:** El 99% de explicaciones con articulo citado permite vinculacion automatica a leyes en BD. Esto ahorra MESES de revision manual.

---

### Fase 3: Mayor esfuerzo, corpus premium (1-2 semanas)

#### 3.1 Adams Test (App Android — Adobe AIR)

| Campo | Valor |
|---|---|
| **URL** | https://www.adams.es/adams-test/ |
| **Package** | `air.es.adams.testsadams` |
| **Version** | 1.2.1 |
| **Framework** | Adobe AIR (ActionScript/Flash) |
| **Developer** | ADAMS Formacion (68 anos, lider en Espana) |
| **Preguntas** | 50K-100K estimado |
| **Oposiciones** | TODAS (Aux Estado, GC, Justicia, Policia, Correos, CCAA, etc.) |
| **Autenticacion** | Suscripcion (20-75€ segun plan) |
| **Dificultad** | Alta (stack inusual) |
| **Valor para Vence** | Corpus premium de la mayor academia de Espana |

**Approach:**
1. Descargar APK desde APKPure
2. Extraer y descompilar AIR:
   ```bash
   unzip air.es.adams.testsadams.apk -d adams-extracted
   # Los SWF estan en assets/
   # Usar JPEXS Free Flash Decompiler para extraer ActionScript
   java -jar ffdec.jar -export script ./output ./adams-extracted/assets/*.swf
   ```
3. Buscar endpoints en el ActionScript decompilado:
   ```bash
   grep -r "http" ./output/ | grep -i "api\|test\|question\|pregunta"
   ```
4. Mapear API (probablemente HTTP simple, sin mucha seguridad dado lo antiguo)
5. Registrar cuenta (plan Express 20€/1 mes)
6. Interceptar token y scrapear via API

**Riesgos:**
- Adobe AIR esta deprecated — la app podria dejar de funcionar pronto
- Si Adams migra a nueva app, este trabajo se pierde
- API podria tener autenticacion mas robusta de lo esperado

**Nota:** Adams tambien tiene apps especificas por oposicion (ej: `air.com.cycleit.nexttest.adams.gestionprocesal`) — mismo backend probable.

---

#### 3.2 Testeate.es

| Campo | Valor |
|---|---|
| **URL** | https://testeat.es/ |
| **Preguntas** | 19,000+ |
| **Oposiciones** | Aux Estado, Hacienda Publica, Seguridad Social, AEAT |
| **Autenticacion** | Suscripcion (130-599€) |
| **Tech stack** | WordPress + WooCommerce |
| **Dificultad** | Media |
| **Valor para Vence** | Contenido creado por funcionarios, psicotecnicos actualizados Win11/M365 |

**Approach:**
1. Verificar `/wp-json/` (WP REST API)
2. Identificar plugin de quiz usado (LearnDash, WP Quiz, H5P, custom)
3. Suscribir 1 mes al plan mas barato (Intensivo €130-150)
4. Mapear endpoints del quiz plugin via Network tab
5. Scrapear preguntas + explicaciones

**Notas:**
- Precio alto — solo vale la pena si el contenido es realmente diferenciado
- Psicotecnicos de Win11/M365 son interesantes (actualizados 2026)
- Preguntas de Hacienda/SS utiles si se anaden esas oposiciones a Vence

---

### Fase 4: Oportunistas (bajo valor relativo, cuando convenga)

#### 4.1 TestOposicionesOficiales.com

| Campo | Valor |
|---|---|
| **Preguntas** | 5,000+ (examenes oficiales reales) |
| **Autenticacion** | Gratis |
| **Valor** | Examenes oficiales que quiza no tengamos |

Solo interesa si tienen examenes oficiales que no estan ya en Vence.

#### 4.2 TestsOposiciones.es

| Campo | Valor |
|---|---|
| **Preguntas** | Desconocido |
| **Autenticacion** | Gratis parcial |
| **Valor** | Bajo — contenido basico |

#### 4.3 OpoAcademy (campus.opoacademy.com)

| Campo | Valor |
|---|---|
| **Preguntas** | 3,000 (Correos) |
| **Tech** | Moodle 4.2.2 (desactualizado, vulnerable) |
| **Valor** | Solo util si se anade Correos a Vence |

Solo plantear si/cuando Correos sea oposicion activa en Vence.

---

## Resumen de prioridades por oposicion

### Para Auxiliar Administrativo del Estado (actual)
1. **OpoSapiens** (6K free, CE/TREBEP/LPAC/LRJSP — listo ya)
2. ExaminaTest (2.5K + 10K admin estado — requiere pago 10€)
3. ActivaTest (corpus especifico — requiere pago)
4. OposicionesTest.es (7.5K leyes comunes — 7€/mes)
5. Adams (corpus premium — 20€/mes)
6. Testeate (19K, funcionarios — 130€+)

### Para Guardia Civil (actual)
1. **OpoSapiens** (LO 2/1986 FCSE, CE — listo ya)
2. ActivaTest (GC especifico)
3. ExaminaTest (4K GC)
4. Adams (GC premium)

### Para futuras oposiciones (Correos, Policia, OPIS)
1. ActivaTest (Correos, PN, Inst. Penitenciarias)
2. ExaminaTest (todos)
3. InnoTest web (ya mapeado, muchas opos disponibles)
4. Adams (todos)

---

## Criterios de calidad post-scraping

Aplicar a TODOS los proveedores (leccion aprendida de TuTestDigital):

1. **Verificar vinculacion articulo**: El articulo citado en la explicacion DEBE coincidir con el contenido real
2. **Deduplicar**: Comparar contra corpus existente (hash de enunciado normalizado)
3. **Validar con IA**: Batch de revision para detectar preguntas incorrectas/obsoletas
4. **Marcar origen**: Campo `source` en BD para trazabilidad
5. **Activacion gradual**: Importar como `is_active = false`, activar tras verificacion

---

## Estimacion de esfuerzo total

| Fase | Tiempo | Preguntas nuevas estimadas | Coste |
|---|---|---|---|
| Fase 1 (OpoSapiens) | **15 min** | ~6K free | 0€ |
| Fase 2 (ActivaTest + ExaminaTest + OposicionesTest) | 3-5 dias | ~175K | ~17€ |
| Fase 3 (Adams + Testeate) | 1-2 semanas | ~70K | ~150€+ |
| Fase 4 (Oportunistas) | Cuando convenga | ~8K | 0€ |
| **Total** | **~3 semanas** | **~260K preguntas brutas** | **~170€** |

Descontando duplicados entre proveedores (~30-40% solapamiento esperado): **~160K preguntas netas nuevas**.

**Nota:** OpoSapiens (Fase 1) esta 100% mapeado y listo para ejecutar sin coste ni preparacion adicional.

---

## Procedimiento estandar por proveedor

```
1. RECONOCIMIENTO
   - Identificar tech stack (web/app, framework)
   - Descargar APK si aplica
   - Detectar framework (Cordova/RN/Flutter/Nativa/AIR)
   - Mapear endpoints (strings/grep/DevTools)

2. AUTENTICACION
   - Crear cuenta (gratis o pagando 1 mes)
   - Obtener token (DevTools > Network > Authorization header)
   - Documentar formato y expiracion del token

3. MAPEO DE API
   - Listar endpoints disponibles
   - Identificar estructura de datos (JSON schema)
   - Documentar paginacion y limites
   - Probar rate limiting

4. SCRAPING
   - Script Node.js con delays razonables (500ms-1s entre requests)
   - Guardar raw JSON en /tmp o directorio temporal
   - Log de progreso y errores
   - Checkpoint para resume si falla

5. TRANSFORMACION
   - Parsear a formato Vence (enunciado, opciones, correcta, explicacion)
   - Vincular a leyes/articulos en BD
   - Detectar preguntas con imagen (separar para tratamiento especial)
   - Deduplicar contra corpus existente

6. IMPORTACION
   - Insertar como is_active = false
   - Verificar con agentes IA (batches de 40-70)
   - Activar progresivamente

7. DOCUMENTACION
   - Crear manual en docs/scraping/{proveedor}-manual.md
   - Documentar endpoints, auth, quirks, volumen
```
