# Manual de Scraping — Testea (App Android)

> **Fecha:** 16 Abril 2026
> **Estado:** ✅ API **100% mapeada y probada en vivo** desde IP ES. Listo para scrapear.
> **App objetivo:** `com.bogo.testea` — https://play.google.com/store/apps/details?id=com.bogo.testea
> **Backend real:** `https://glados-cakeserver.com/api/` (CakePHP en DinaHosting Madrid)

---

## 1. Resumen ejecutivo

Testea es una app Android **híbrida Cordova + Framework7** (HTML/CSS/JS en WebView). Bundle JS plano de 1.3 MB en `assets/www/assets/index-*.js`, con todas las URLs hardcodeadas como strings legibles — mapeo trivial con `grep`.

**Backend:** CakePHP en `glados-cakeserver.com` (DinaHosting Madrid). Auth por token opaco en URL path, requests en `multipart/form-data`, respuestas en JSON, **sin filtrado de `solution` en preguntas** (respuesta correcta visible sin auth).

### Volumen real medido (16 abril 2026)

| Métrica | Valor |
|---------|-------|
| **Preguntas únicas totales** | **12,225** (confirmado por `get-random-test.num-questions`) |
| **Leyes publicadas** | **31** (todas `publish: YES`) |
| **Tests únicos** | **823** (719 normales + 64 realexam + 40 simulacros) |
| **Preguntas por test** | 15 (constante) |
| **Ratio de repetición** | **1.0x** — cada pregunta aparece en exactamente 1 test |
| **Tiempo estimado scraping completo** | **~7 minutos** (823 × 500ms) |
| **Imágenes en preguntas** | **0** (modelo de datos no incluye imageName) |

**El dataset es 100% texto** — Constitución, LPAC, LRJSP, TREBEP, Ley de Contratos, etc. Todo oposiciones **AGE / Auxiliar Administrativo del Estado**. Foco perfecto para Vence.

### Ventajas del backend de Testea vs. Aulaplus/OpositaTest

| | Testea | Aulaplus | OpositaTest |
|-|--------|----------|-------------|
| Framework app | Cordova (WebView) | React Native + Hermes | Web + Android native |
| Dificultad mapeo | 🟢 grep directo | 🟡 `strings` sobre bytecode | 🟡 mitmproxy |
| Respuesta correcta visible sin auth | ✅ en `solution` | ❌ vacía hasta responder | ❌ endpoint aparte |
| Explicación HTML con BOE citado | ✅ en `textClarification_es` | ~45% enfermería, ~1% admin | variable |
| Campos "official" (oficial vs simulacro) | ✅ flag `q.official` + `test.type=realexam` | ✅ `origin.name` | ✅ tag |
| Jerarquía Ley→Título→Capítulo→Sección→Art | ✅ | ❌ solo subject | ✅ |
| Imágenes | ❌ no hay | ✅ ~1K | ✅ |
| Filtrado anti-scraping | 🔴 geo-IP (solo ES) | ❌ ninguno | ❌ ninguno |
| Volumen | 12.2K únicas | 139K (sanidad+admin) | 500K+ |

**Testea es el corpus más pequeño pero más limpio para Aux Admin Estado.**

---

## 2. Información de la app

| Campo | Valor |
|-------|-------|
| Package name | `com.bogo.testea` |
| Version name / code | `1.9.4` / `10904` |
| Min SDK | 24 (Android 7) |
| Target SDK | 34 (Android 14) |
| Framework | Cordova + Framework7 (hybrid WebView) |
| Motor JS | WebView del sistema (Chromium embebido) |
| Tamaño (XAPK v1.9.4) | 14.3 MB |
| ABI disponibles | `arm64-v8a` únicamente (1.2 MB — solo libs Crashlytics) |
| Fuente APK | https://apkcombo.com/testea/com.bogo.testea/ · https://testea.en.uptodown.com/android |
| Developer | Paco Barbié / BOGO-SAILTI (indie) |
| Apple App ID | `6451379804` |
| Google Play referrer ID | `143499230758` |
| Min app version enforced (server) | 10900 (confirmado en `get-testea-info.ver`) |

**Plugins Cordova:** admob-plus (2.0.0-alpha.19), device (3.0.0), firebasex (18.0.5), inappbrowser (6.0.0), keyboard (1.2.0), statusbar (4.0.0).

---

## 3. Análisis estático del APK (procedimiento)

### 3.1 Descarga del XAPK

Desde APKCombo o Uptodown (~14 MB). Chrome puede etiquetarlo como `Sin confirmar NNNNN.crdownload` → clicar "Conservar". Es un ZIP válido con header `PK`.

### 3.2 Extracción

```bash
mkdir -p /tmp/testea-analysis && cd /tmp/testea-analysis
unzip -q ~/Descargas/testea.xapk
mkdir -p base-extracted && unzip -q com.bogo.testea.apk -d base-extracted
```

### 3.3 Detección del framework

```bash
ls base-extracted/assets/
# → dexopt/  www/       ← "www/" confirma Cordova
```

**Reconocimiento rápido de framework:**

| Path presente | Framework |
|----------------|-----------|
| `assets/www/` con `cordova.js` | Cordova / Ionic |
| `assets/public/` con `@capacitor/` | Capacitor |
| `assets/index.android.bundle` | React Native |
| `lib/*/libflutter.so` + `libapp.so` | Flutter |
| Ninguno | Nativo Java/Kotlin → requiere `jadx` |

### 3.4 Localización del bundle JS

```bash
cd base-extracted/assets/www
ls -lh
#   index.html (1.2 KB loader)
#   cordova.js (63 KB Cordova runtime)
#   cordova_plugins.js (1.7 KB metadata)
#   assets/index-ebcbbf20.js (1.3 MB) ⭐ TODA LA LÓGICA
#   assets/index-161568b5.css (574 KB)

file assets/index-ebcbbf20.js
# → JavaScript source, ASCII text  (NO bytecode)
```

### 3.5 Extracción de endpoints

```bash
cd base-extracted/assets/www/assets

# Dominios
grep -oE 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}' index-ebcbbf20.js | sort -u
# → https://glados-cakeserver.com   ← BACKEND
# → http://testea.localhost          ← URL de dev
# → https://www.bogo.ai              ← segundo dominio del dev

# Todos los endpoints construidos
grep -oE 'baseUrl\+"[^"]+"' index-ebcbbf20.js | sort -u
```

Output (23 endpoints):

```
baseUrl+"api/auth/create-new-user/"
baseUrl+"api/auth/login/"
baseUrl+"api/auth/recovery-user/"
baseUrl+"api/auth/update-password/"
baseUrl+"api/auth/validate-code/"
baseUrl+"api/testea/delete-user"
baseUrl+"api/testea/get-chapter"
baseUrl+"api/testea/get-last-test"
baseUrl+"api/testea/get-last-tests/page/"
baseUrl+"api/testea/get-law"
baseUrl+"api/testea/get-laws"
baseUrl+"api/testea/get-options/"
baseUrl+"api/testea/get-publish-info/ids/"
baseUrl+"api/testea/get-random-test"
baseUrl+"api/testea/get-statistics"
baseUrl+"api/testea/get-test"
baseUrl+"api/testea/get-test/id/"
baseUrl+"api/testea/get-testea-info"
baseUrl+"api/testea/get-title"
baseUrl+"api/testea/set-questionary"
baseUrl+"api/testea/set-question-challenge"
baseUrl+"api/testea/update-token/"
baseUrl+"api/testea/update-userinfo/"
```

### 3.6 Variables clave del código

```bash
grep -oE '(baseUrl|enviroment|appleId|androidId)["]?\s*:\s*"[^"]+"' index-ebcbbf20.js | sort -u
```

- `enviroment: "production"` (typo del dev — `environment` sin 2ª `n` — NOTA: grepar por `enviroment` no por `environment`)
- `baseUrl: "https://glados-cakeserver.com/"`
- `appleId: "6451379804"` · `androidId: "143499230758"`
- Prefijo de localStorage: `{appleId}_authtoken`, `{appleId}_email`, `{appleId}_userId`, etc.

---

## 4. API Reference completa (probada en vivo)

Todos los endpoints bajo `https://glados-cakeserver.com/api/`. El bundle JS usa `fetch(baseUrl + "api/..." + queryPath)`.

### 4.1 Convenciones generales

**Content-Type de requests:**
- POSTs de auth y escritura: `multipart/form-data` (FormData, NO JSON)
- GETs: sin body (params en URL path)

**Formato de respuestas:**
- Siempre HTTP 200 (excepto errores 500 del server)
- Body JSON con campo `error`: `0` = OK, `1` = error de negocio + `errorMessage`
- **NUNCA usar `curl -f`**: los errores de negocio vienen con HTTP 200.

**Autenticación en GETs:**
- Sin sesión → llamar endpoint "a pelo" (sin path suffix)
- Con sesión → añadir `/user/{TOKEN}/path/{ROUTE_ENCODED}` al final
- `ROUTE_ENCODED` es la ruta del router de Framework7 con `/` reemplazados por `@@` (sólo telemetría, el backend la ignora para routing). Valor dummy tipo `@@scraper@@` funciona.

**User-Agent:** cualquier UA decente pasa. La app usa el default del WebView Android. Ejemplo:
`Mozilla/5.0 (Linux; Android 11; Cordova) TesteaApp/1.9.4`.

### 4.2 Auth (5 endpoints)

#### `POST api/auth/login/`

```http
POST /api/auth/login/ HTTP/1.1
Content-Type: multipart/form-data; boundary=---XXX

login=usuario@dominio.com
password=contraseña
```

Respuesta OK:
```json
{
  "error": 0,
  "userdata": {
    "token": "opaque-string-NOT-jwt",
    "id": 12345,
    "name": "...",
    "email": "...",
    "phone": "",
    "duration_time": "60",
    "error_format": "0",
    "exam_simulation": "0"
  }
}
```

Respuesta error:
```json
{"error":1,"errorMessage":"Credenciales inválidas"}
```

Notas:
- Campo de login es `login`, acepta email o username.
- Token no caduca dentro de una sesión razonable (TTL exacto desconocido, probablemente días).
- Contraseña enviada en texto plano por form-data (HTTPS, pero el server la recibe así).

#### Resto de endpoints de auth

| Endpoint | Body (FormData) | Qué hace |
|----------|------------------|----------|
| `POST api/auth/create-new-user/` | `name`, `email` | Crear cuenta; devuelve token inmediato + envía email con código |
| `POST api/auth/validate-code/` | `code` (del email) | Confirmar cuenta creada |
| `POST api/auth/update-password/` | `password` (+ session token) | Fijar password tras validate-code |
| `POST api/auth/recovery-user/` | `email` | Enviar email de recuperación |

### 4.3 Endpoints de lectura de contenido (sin auth necesaria)

#### `GET api/testea/get-testea-info`

```bash
curl -sS https://glados-cakeserver.com/api/testea/get-testea-info
```

Respuesta (70 bytes):
```json
{"error":0,"ver":10900,"ver_ios":10900,"ver_android":10900,"ads":true}
```

Campos:
- `ver` / `ver_ios` / `ver_android`: versión mínima requerida de la app (actual: `10900` = 1.9.0)
- `ads`: flag global de ads en la app

#### `GET api/testea/get-options/`

Devuelve los catálogos de UI: formatos de corrección y duraciones permitidas.

```json
{
  "error": 0,
  "error_formats": {
    "0": "No resta",
    "25": "Resta 0,25 (Cada 4 resta 1)",
    "33": "Resta 0,33 (Cada 3 resta 1)",
    "50": "Resta 0,50 (Cada 2 resta 1)",
    "100": "Resta 1"
  },
  "duration_times": ["Sin tiempo", "5 min", "10 min", ... "120 min"]
}
```

#### `GET api/testea/get-laws` ⭐ Punto de entrada del scraping

Devuelve la lista completa de leyes publicadas (23 KB).

```json
{
  "error": 0,
  "arLaws": [
    {
      "id": "5",
      "code": "CONSTITUCIÓN",
      "ordinal": "CONSTITUCIÓN",
      "order": "1",
      "order_def": "AAAA1",
      "publish": "YES",
      "name_es": "Constitución Española de 1978",
      "acronim_es": "Constitución Española"
    },
    ...
  ]
}
```

Campos de cada ley:
- `id` (string numérico) — ID interno
- `code` (string) — código identificador sin espacios (`CONSTITUCIÓN`, `L39/2015`, `RDL5/2015`, `RUE679/2016`, `Agenda 2030`, `Gobierno Abierto`, ...)
- `ordinal` — variante de `code` usada para ordenar alfabéticamente
- `order` (string numérico) — orden de aparición en la UI (1 = Constitución, 31 = Incompatibilidades)
- `order_def` — clave de ordenación compuesta (`"AAAA1"`, `"AAAA1BBBB1"`, etc.)
- `publish`: siempre `"YES"` (las no publicadas se filtran server-side)
- `name_es` — nombre completo oficial
- `acronim_es` — nombre corto

**No hay paginación** — devuelve las 31 leyes directamente.

#### `GET api/testea/get-law/idlaw/{lawId}` ⭐ Detalle ley + jerarquía

⚠️ El parámetro es **`idlaw`** en minúsculas. `id`, `idLaw`, `idLaw` NO funcionan (devuelven `"error":1`).

Respuesta (~7 KB para Constitución):
```json
{
  "error": 0,
  "law": { /* misma estructura que en arLaws */ },
  "arTitles": [
    {
      "id": "97",
      "idLaw": "5",
      "code": "ESTRUCTURA Y PREÁMBULO",
      "ordinal": "Y PREÁMBULO",
      "order": "1",
      "order_def": "AAAA1BBBB1",
      "name_es": "Estructura y Preámbulo",
      "text_es": "Estructura y Preámbulo"
    },
    ...
  ],
  "arArticles": [],  // vacío a nivel ley; los artículos vienen al entrar en título
  "pt": true,        // boolean — probablemente "has partial titles"
  "qByLaw": {
    "5": {
      "mainLevel": ["203","204","238","239",...],  // IDs de tests "nivel principal"
      "subLevel":  ["24","25","26",...],           // IDs de tests "nivel sub-título"
      "userDone": 0                                 // 0 si no logueado
    }
  },
  "qByLawNew": {
    "5": {
      "mainLevel": {
        "exam":     ["204","238","239",...],       // tests simulacro
        "realexam": ["203","246","253",...]        // tests preguntas reales oficiales
      },
      "subLevel": [...],
      "userDone": 0,
      "recent": 0
    }
  },
  "qByTitle": {
    "19": {"mainLevel":["24","25",...], "subLevel":[], "recent":0},
    "20": {...}
  },
  "qByArticle": []
}
```

**Claves para el scraper:**

- `arTitles` — todos los títulos de esta ley (cuentan desde 1 al N, incluyendo "Estructura y Preámbulo" y "DISPOSICIONES" como pseudo-títulos)
- `qByLaw[{lawId}].mainLevel` + `subLevel` — IDs de todos los tests asociados (descargar uno a uno con `get-test/id/{N}`)
- `qByLawNew[{lawId}].mainLevel.realexam` — IDs de tests de **preguntas oficiales** (se marcan también con `test.type=realexam`)
- `qByLawNew[{lawId}].mainLevel.exam` — IDs de tests de simulacro

#### `GET api/testea/get-title/idtitle/{titleId}`

Parámetro: **`idtitle`** en minúsculas.

Respuesta (~2 KB):
```json
{
  "error": 0,
  "law":   { /* ley padre */ },
  "title": {
    "id": "19",
    "idLaw": "5",
    "code": "TÍTULO PRELIMINAR",
    "ordinal": "PRELIMINAR",
    "order": "2",
    "order_def": "AAAA2BBBB1",
    "name_es": "Título Preliminar",
    "text_es": "Artículos del 1 al 9"
  },
  "arChapters": [],       // capítulos si los hay, vacío si el título tiene artículos directamente
  "arArticles": [
    {
      "id": "6307",
      "idLaw": "1",
      "idTitle": "1",
      "idChapter": "0",
      "idSection": "0",
      "code": "Artículo 0",
      "ordinal": "0",
      "order": "1",
      "name_es": "Estructura",
      "text_es": ""        // ⚠️ NORMALMENTE VACÍO — ver §5.3
    },
    ...
  ],
  "$arIdsArticles": [...],  // IDs de artículos (duplicado con arArticles)
  "qByTitle":   {...},
  "qByChapter": {...},
  "qByArticle": {...}
}
```

#### `GET api/testea/get-chapter/idchapter/{chapterId}`

Parámetro: **`idchapter`** en minúsculas.

Respuesta (~2 KB):
```json
{
  "error": 0,
  "law":     { ... },
  "title":   { ... },
  "chapter": {
    "id": "1",
    "idLaw": "...",
    "idTitle": "...",
    "code": "CAPÍTULO I",
    "ordinal": "...",
    "order": "1",
    "name_es": "...",
    "text_es": ""
  },
  "arSections": [...],
  "arArticles": [...],
  "qByChapter": {...}
}
```

#### `GET api/testea/get-test/id/{testId}` ⭐⭐⭐ EL ENDPOINT DE ORO

Devuelve metadata del test + **todas las preguntas con respuestas, solución y explicación HTML**. SIN auth necesaria. **Respuesta correcta visible en `solution` (1-4).**

Ejemplo `GET /api/testea/get-test/id/33` (17 KB):

```json
{
  "error": 0,
  "test": {
    "id": "33",
    "idLaw": "5",
    "idTitle": "19",
    "idChapter": "0",
    "idSection": "0",
    "idArticle": "0",
    "idContest": null,
    "code": "CONSTITUCION_TP_010",
    "publish": "YES",
    "type": "test",              // "test" | "realexam"
    "duration_time": "0",
    "real_date": "2023-04-18T23:00:00+02:00",   // fecha del examen original
    "publish_date": "2023-09-01T00:00:00+02:00", // fecha de publicación en Testea
    "error_format": "0",
    "note_to_pass": "0",
    "max_fail_answers": "-1",
    "law_code": "CONSTITUCIÓN",
    "law_name": "Constitución Española de 1978",
    "title_code": "TÍTULO PRELIMINAR",
    "title_name": "Título Preliminar",
    "chapter_code": "",
    "chapter_name": "",
    "section_code": "",
    "section_name": "",
    "article_code": "",
    "article_name": "",
    "name": "CONSTITUCIÓN - Título Preliminar",
    "q": [
      [ "1509","1512","1946",...  /* 15 IDs de preguntas (q.id) */ ],
      [
        {
          "id": "4864",              // ID del "question slot" en el test
          "order": "1",
          "q": {                     // objeto pregunta
            "id": "1509",             // ID global de la pregunta
            "idLaw": "5",
            "idTitle": null,
            "idChapter": null,
            "idArticle": "316",
            "solution": "2",          // ⭐ respuesta correcta (1, 2, 3 o 4)
            "official": false,        // ⭐ pregunta de examen oficial
            "text_es": "El artículo 9.2 de la Constitución obliga a los poderes públicos a facilitar la participación...",
            "answer1_es": "Los españoles mayores de edad.",
            "answer2_es": "Todos los ciudadanos.",
            "answer3_es": "Los españoles residentes en España.",
            "answer4_es": "Los distintos territorios, regiones y nacionalidades del Estado español.",
            "textClarification_es": "<p><strong>Artículo 9</strong></p><p>1. Los ciudadanos y los poderes públicos...</p>"
          }
        },
        ...
      ]
    ]
  },
  "stats": [],                        // estadísticas del usuario (vacío sin auth)
  "error_formats": {...},             // duplicado de get-options
  "duration_times": [...],
  "max_fail_answers": {...},
  "challenge_types": [                // tipos de "reportar pregunta"
    {"id":"1","order":"1","publish":"YES","name_es":"Redacción de pregunta incorrecta."},
    {"id":"2","order":"2","publish":"YES","name_es":"Cambio de respuesta a otra opción."},
    {"id":"3","order":"3","publish":"YES","name_es":"Varias respuestas correctas."},
    {"id":"4","order":"4","publish":"YES","name_es":"Ninguna respuesta correcta."},
    {"id":"5","order":"5","publish":"YES","name_es":"Desactualizada."},
    {"id":"6","order":"6","publish":"YES","name_es":"Ninguna de las anteriores."}
  ]
}
```

**Estructura de `test.q`** (rara):

- `q[0]` = array de IDs de preguntas (puede ignorarse)
- `q[1]` = array de objetos `{id, order, q:{…}}` — usar este

**El scraper solo necesita `q[1]`.**

#### `GET api/testea/get-random-test`

Devuelve UN test aleatorio + total global de preguntas.

```json
{
  "error": 0,
  "random-test": {
    "id": "33",
    "idLaw": "5",
    "idTitle": "19",
    "idChapter": "0",
    "idSection": "0",
    "idArticle": "0",
    "idContest": null,
    "code": "CONSTITUCION_TP_010",
    "publish": "YES",
    "type": "test",
    "duration_time": "0",
    "real_date": "...",
    "publish_date": "...",
    "error_format": "0",
    "note_to_pass": "0",
    "max_fail_answers": "-1",
    "index": 5
  },
  "num-questions": 12225   // ⭐ total global de preguntas únicas en la app
}
```

**Uso para el scraper:** `num-questions` es **la verdad** sobre cuántas preguntas hay. Si después de scrapear no te salen ~12,225, falta algo. Número constante entre llamadas (cacheado server-side).

#### `GET api/testea/get-publish-info/ids/{comma_separated_ids}`

Marca qué contenidos tienen "recent" updates. Usado por la app para invalidar cache UI.

```bash
curl -sS "$BASE/testea/get-publish-info/ids/1,5,10,27"
```

```json
{
  "error": 0,
  "ids": "1,5,10,27",
  "recentInfo": {
    "1":  {"recent": 0},
    "5":  {"recent": 0},
    "10": {"recent": 0},
    "27": {"recent": 0}
  }
}
```

Útil para el scraper: antes de re-scrapear, llamar aquí con todos los law IDs conocidos y ver cuáles tienen `recent > 0` → re-scrapear solo esos.

### 4.4 Endpoints que requieren auth (user token)

Devuelven HTTP 500 o `error:1` sin token válido. Formato: añadir `/user/{TOKEN}/path/@@dummy@@` al path del GET.

| Endpoint | Método | Notas |
|----------|--------|-------|
| `api/testea/get-last-test` | GET | Último test del usuario. Sin auth → HTTP 500 |
| `api/testea/get-last-tests/page/{N}` | GET | Historial paginado |
| `api/testea/get-statistics` | GET | Estadísticas globales del usuario |
| `api/testea/set-questionary` | POST | Guardar resultado de test completado |
| `api/testea/set-question-challenge` | POST | Reportar pregunta con `challenge_type_id` |
| `api/testea/update-token/` | POST | Actualizar FCM/APNS push token |
| `api/testea/update-userinfo/` | POST | Actualizar perfil |
| `api/testea/delete-user` | POST | Eliminar cuenta |

**Para scraping puro de contenido NO hacen falta.** Los endpoints de lectura funcionan todos sin auth.

---

## 5. Modelo de datos completo

### 5.1 Entidades y jerarquía

```
Law (arLaws)
 └── Title (arTitles, por Law)
      ├── Chapter (arChapters, por Title — opcional)
      │    ├── Section (arSections, por Chapter — opcional)
      │    │    └── Article (arArticles, por Section — opcional)
      │    └── Article (directo, si no hay secciones)
      ├── Article (directo, si no hay capítulos — Constitución TP)
      └── Test (relación muchos-a-muchos via qByTitle, qByChapter, etc.)
           └── Question (15 preguntas por test, vía test.q[1][].q)
```

### 5.2 Schema de cada entidad (campos observados)

**Law** (31 en total, todos `publish:"YES"`):

| Campo | Tipo | Ejemplo | Notas |
|-------|------|---------|-------|
| id | string numérico | `"5"` | PK |
| code | string | `"CONSTITUCIÓN"`, `"L39/2015"` | ID humano |
| ordinal | string | `"CONSTITUCIÓN"`, `"L39/2015"` | Variante para ordenar |
| order | string numérico | `"1"` ... `"31"` | Orden en UI |
| order_def | string | `"AAAA1"` | Clave compuesta |
| publish | enum | `"YES"` | Siempre YES |
| name_es | string | `"Constitución Española de 1978"` | Nombre completo |
| acronim_es | string | `"Constitución Española"` | Nombre corto |

**Title** (en `arTitles` al hacer get-law):

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| id | string | `"19"` |
| idLaw | string | `"5"` |
| code | string | `"TÍTULO PRELIMINAR"` |
| ordinal | string | `"PRELIMINAR"` |
| order | string | `"2"` |
| order_def | string | `"AAAA2BBBB1"` |
| name_es | string | `"Título Preliminar"` |
| text_es | string | `"Artículos del 1 al 9"` (descripción, a veces vacío) |

**Chapter** — mismos campos que Title, con `idTitle` en vez de `idLaw`.

**Section** — misma estructura, con `idChapter`.

**Article** (en `arArticles`):

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| id | string | `"6307"` |
| idLaw | string | `"1"` |
| idTitle | string | `"1"` |
| idChapter | string | `"0"` (0 = no chapter) |
| idSection | string | `"0"` |
| code | string | `"Artículo 0"` |
| ordinal | string | `"0"` |
| order | string | `"1"` |
| name_es | string | `"Estructura"` |
| text_es | string | **vacío** casi siempre — ver §5.3 |

**Test** (`test` en respuesta de `get-test/id/N`):

Los 27 campos:

| Campo | Tipo | Ejemplo | Notas |
|-------|------|---------|-------|
| id | string | `"33"` | PK |
| idLaw | string | `"5"` | → Law |
| idTitle | string | `"19"` | → Title (0 si test abarca varios) |
| idChapter | string | `"0"` | → Chapter |
| idSection | string | `"0"` | → Section |
| idArticle | string | `"0"` | → Article |
| idContest | null \| string | `null` | Para tests de concursos/convocatorias específicas |
| code | string | `"CONSTITUCION_TP_010"` | ID humano |
| publish | enum | `"YES"` | |
| type | enum | `"test"` \| `"realexam"` | ⭐ **realexam = preguntas oficiales** |
| duration_time | string | `"0"` | 0 = sin límite |
| real_date | ISO 8601 | `"2023-04-18T23:00:00+02:00"` | Fecha del examen real |
| publish_date | ISO 8601 | `"2023-09-01T00:00:00+02:00"` | Fecha de alta en Testea |
| error_format | string | `"0"` | Formato de corrección preferido |
| note_to_pass | string | `"0"` | Nota para aprobar (0 = sin nota) |
| max_fail_answers | string | `"-1"` | -1 = sin límite |
| law_code, law_name | string | `"CONSTITUCIÓN"`, `"..."` | Denormalizado |
| title_code, title_name | string | `"TÍTULO PRELIMINAR"`, `"..."` | Denormalizado |
| chapter_code, chapter_name | string | `""`, `""` | Vacío si no aplica |
| section_code, section_name | string | `""`, `""` | Vacío si no aplica |
| article_code, article_name | string | `""`, `""` | Vacío si no aplica |
| name | string | `"CONSTITUCIÓN - Título Preliminar"` | Display |
| q | `[IDs[], Objects[]]` | ver §4.3 | 15 preguntas |

**Question** (dentro de `test.q[1][].q`):

Los 13 campos:

| Campo | Tipo | Ejemplo | Notas |
|-------|------|---------|-------|
| id | string | `"1509"` | PK global de la pregunta (únicos: 12,225) |
| idLaw | string | `"5"` | → Law |
| idTitle | null \| string | `null` | ⚠️ Casi siempre null a nivel q (está a nivel test) |
| idChapter | null \| string | `null` | ⚠️ Idem |
| idArticle | string | `"316"` | → Article (referencia directa) |
| solution | enum `"1"..."4"` | `"2"` | ⭐ Respuesta correcta (1-indexed) |
| official | boolean | `false` / `true` | ⭐ Pregunta de convocatoria oficial |
| text_es | string | `"El artículo 9.2..."` | Enunciado |
| answer1_es | string | `"Los españoles mayores de edad."` | Opción A |
| answer2_es | string | `"Todos los ciudadanos."` | Opción B |
| answer3_es | string | `"..."` | Opción C |
| answer4_es | string | `"..."` | Opción D |
| textClarification_es | string HTML | `"<p><strong>Artículo 9</strong>...</p>"` | ⭐ Explicación con **texto del artículo BOE** citado |

**Campos NO presentes** (importante saber que NO existen):

- Imágenes: no hay `imageName`, `questionImage`, `image`, `picture`. El modelo de datos **no soporta imágenes**.
- Dificultad: no hay `difficulty`, `level`.
- Tags/categorías adicionales: solo la jerarquía Law→…→Article.
- Timestamps de create/update en preguntas: no hay (los hay en tests con `real_date` + `publish_date`).
- Autor: no hay.
- Feedback por respuesta (A/B/C/D): solo hay `textClarification_es` global de la pregunta.

### 5.3 Texto del artículo BOE

El campo `article.text_es` **está vacío casi siempre** en Testea. Pero el **texto del artículo está embebido en cada `question.textClarification_es`** como HTML, porque Testea lo usa para justificar cada respuesta.

Ejemplo real para pregunta sobre art. 9 de la Constitución:

```html
<p><strong><span style="font-size:12px;">Artículo 9</span></strong></p>

<p>1. Los ciudadanos y los poderes públicos están sujetos a la Constitución y al resto del ordenamiento jurídico.</p>

<p>2. Corresponde a los poderes públicos promover las condiciones para que la libertad y la igualdad del individuo y de los grupos en que se integra sean reales y efectivas; remover los obstáculos que impidan o dificulten su plenitud y facilitar la participación <strong>de todos los ciudadanos</strong> en la vida política, económica, cultural y social.</p>

<p>3. La Constitución garantiza el principio de legalidad, la jerarquía normativa, la publicidad de las normas, la irretroactividad de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad jurídica, la responsabilidad y la interdicción de la arbitrariedad de los poderes públicos.</p>
```

**Implicación para el scraper:** si necesitas el texto del artículo (p.ej. para alimentar los artículos de Vence), extráelo parseando el HTML de `textClarification_es` — está ahí casi siempre. Agrupa por `q.idArticle` y quédate con el HTML más largo/limpio.

### 5.4 Catálogos estáticos

**`error_formats`** (formatos de corrección con penalización por error):
```json
{"0":"No resta", "25":"Resta 0,25 (Cada 4 resta 1)",
 "33":"Resta 0,33 (Cada 3 resta 1)", "50":"Resta 0,50 (Cada 2 resta 1)",
 "100":"Resta 1"}
```

**`duration_times`** (25 valores): `["Sin tiempo","5 min","10 min","15 min",...,"120 min"]` (5-min steps)

**`max_fail_answers`** (22 entradas): `{-1: "No hay un número de errores máximos", 0: "0", 1: "1", ..., 20: "20"}`

**`challenge_types`** (6 tipos — para reportar problemas en una pregunta):

| id | name_es |
|----|---------|
| 1 | Redacción de pregunta incorrecta. |
| 2 | Cambio de respuesta a otra opción. |
| 3 | Varias respuestas correctas. |
| 4 | Ninguna respuesta correcta. |
| 5 | Desactualizada. |
| 6 | Ninguna de las anteriores. |

**Test types** (enum de `test.type`): `"test"` (normal) · `"realexam"` (preguntas reales oficiales)

---

## 6. Inventario completo de las 31 leyes

Medido en vivo el 16/04/2026. `tests` = tests únicos por ley; `realexam` = tests de preguntas oficiales; `exam` = tests de simulacro tipo examen.

| id | order | code | acronim | tests | realexam | exam |
|----|-------|------|---------|-------|----------|------|
| 5 | 1 | `CONSTITUCIÓN` | Constitución Española | 220 | 25 | 8 |
| 1 | 2 | `L39/2015` | Ley 39/2015, del Procedimiento Administrativo Común | 113 | 19 | 10 |
| 10 | 3 | `L40/2015` | Ley 40/2015 - Régimen Jurídico del Sector Público | 51 | 9 | 0 |
| 4 | 4 | `RDL5/2015` | RDL 5/2015 - TREBEP | 76 | 7 | 16 |
| 27 | 5 | `L9/2017` | Ley 9/2017 - Contratos del Sector Público | 134 | 1 | 0 |
| 22 | 6 | `L47/2003` | Ley 47/2003 - General Presupuestaria | 63 | 1 | 0 |
| 26 | 7 | `RDL6/2023` | RDL 6/2023 - medidas urgentes | 11 | 0 | 0 |
| 25 | 8 | `Agenda 2030` | Agenda 2030 para el Desarrollo Sostenible | 4 | 0 | 0 |
| 12 | 9 | `L50/1997` | Ley 50/1997 - del Gobierno | 20 | 0 | 4 |
| 24 | 10 | `LO3/2007` | LO 3/2007 - Igualdad efectiva | 12 | 2 | 2 |
| 23 | 11 | `RUE679/2016` | Reglamento (UE) 2016/679 - RGPD | 9 | 0 | 0 |
| 21 | 12 | `L2/2014` | Ley 2/2014 - Acción y Servicio Exterior del Estado | 6 | 0 | 0 |
| 16 | 13 | `RD208/1996` | RD 208/1996 - Info administrativa | 3 | 0 | 0 |
| 17 | 14 | `RD366/2007` | RD 366/2007 - Accesibilidad | 5 | 0 | 0 |
| 18 | 15 | `RD2271/2004` | RD 2271/2004 - Acceso empleo público | 3 | 0 | 0 |
| 19 | 16 | `RD1708/2011` | RD 1708/2011 - Sistema Español de Archivos | 6 | 0 | 0 |
| 20 | 17 | `RD951/2005` | RD 951/2005 - Marco calidad AGE | 5 | 0 | 0 |
| 7 | 18 | `RD364/1995` | RD 364/1995 - Ingreso/Provisión/Promoción | 5 | 0 | 0 |
| 8 | 19 | `RD365/1995` | RD 365/1995 - Situaciones Administrativas | 0 | 0 | 0 |
| 31 | 20 | `L4/2023` | Ley 4/2023 - Igualdad real LGTBI | 11 | 0 | 0 |
| 14 | 21 | `LO3/1981` | LO 3/1981 - Defensor del Pueblo | 6 | 0 | 0 |
| 33 | 22 | `LO4/2001` | LO 4/2001 - Derecho de petición | 2 | 0 | 0 |
| 34 | 23 | `RD33/1986` | RD 33/1986 - Régimen Disciplinario | 0 | 0 | 0 |
| 36 | 24 | `LO2/1979` | LO 2/1979 - Tribunal Constitucional | 8 | 0 | 0 |
| 41 | 25 | `LO2/1982` | LO 2/1982 - Tribunal de Cuentas | 4 | 0 | 0 |
| 15 | 26 | `L7/1985` | Ley 7/1985 - Bases del Régimen Local | 23 | 0 | 0 |
| 30 | 27 | `L19/2013` | Ley 19/2013 - Transparencia | 3 | 0 | 0 |
| 35 | 28 | `L38/2003` | Ley 38/2003 - General de Subvenciones | 9 | 0 | 0 |
| 44 | 29 | `LO1/2004` | LO 1/2004 - Violencia de Género | 4 | 0 | 0 |
| 61 | 30 | `Gobierno Abierto` | Gobierno Abierto | 4 | 0 | 0 |
| 6 | 31 | `L53/1984` | Ley 53/1984 - Incompatibilidades | 3 | 0 | 0 |

**Totales:** 31 leyes · 823 tests únicos · 64 realexam · 40 exam · **12,225 preguntas únicas**.

**2 leyes con 0 tests** (`RD 365/1995` y `RD 33/1986`): están publicadas (`publish:"YES"`) pero aún no tienen tests asociados. Pueden estar en desarrollo por el dev. El scraper debe tolerarlas.

---

## 7. Bloqueo geo-IP del backend

### 7.1 Diagnóstico

`glados-cakeserver.com` está hosteado en DinaHosting Madrid (`82.98.188.189`, AS42612 DinaHosting S.L.) y **filtra TODO el tráfico TCP desde IPs no españolas**:

```bash
# Desde IP no-ES:
ping -c 3 glados-cakeserver.com        # 100% packet loss
timeout 5 bash -c '</dev/tcp/glados-cakeserver.com/443'
# exit 124 — SYN dropeado sin RST (filtrado, no cerrado)

# Desde IP ES (Mullvad ES · HostRoyale Barcelona · otros):
curl -sS https://glados-cakeserver.com/api/testea/get-testea-info
# → 70 bytes JSON en ~500ms ✅
```

**Confirmación:** `www.bogo.ai` (mismo developer, backend diferente) sí responde desde cualquier IP — el bloqueo geo es específico de `glados-cakeserver.com`.

### 7.2 Cómo pasar el bloqueo

Cualquier IP española funciona. Testado en vivo con:

- **Mullvad VPN** con server ES → ✅ funciona
- **HostRoyale Barcelona** (confirmado, IP outbound ES) → ✅ funciona

Opciones:

- **VPN con salida ES** (más práctico para scraping manual): Proton, Nord, Mullvad, Surfshark, etc.
- **VPS en España** (para scrapers automatizados): Clouding.io, Stackscale, Arsys, OVH Gravelines (cerca pero FR).
- **Tu conexión doméstica si ya estás en España** (no aplica para servidores/CI fuera).

### 7.3 Verificación antes de scrapear

```bash
curl -sS --max-time 5 https://ipinfo.io/json | jq '.country, .city, .org'
# Debe dar "ES" + ciudad + proveedor

# Sanity check del backend:
curl -sS --max-time 5 https://glados-cakeserver.com/api/testea/get-testea-info
# → {"error":0,"ver":10900,"ver_ios":10900,"ver_android":10900,"ads":true}
```

Si el get-testea-info tarda más de 2s o timeout, la IP no es realmente ES o el hosting está saturado.

---

## 8. Plan de scraper completo

### 8.1 Algoritmo

```
1. Descargar metadata global:
   a. GET /api/testea/get-testea-info        → versión y flags
   b. GET /api/testea/get-options/           → catálogos
   c. GET /api/testea/get-laws               → 31 leyes

2. Por cada ley (31 iteraciones):
   a. GET /api/testea/get-law/idlaw/{N}      → arTitles + qByLaw
   b. Guardar arTitles, recolectar test IDs de:
      - qByLaw[N].mainLevel      (tests level-principal)
      - qByLaw[N].subLevel       (tests nested por título)
      - qByLawNew[N].mainLevel.realexam  (redundante con main, pero etiqueta "realexam")
      - qByLawNew[N].mainLevel.exam      (redundante, etiqueta "exam")
   c. Union → set único de test IDs de esta ley

3. Para cada título de cada ley (13-97 por ley):
   a. GET /api/testea/get-title/idtitle/{N}  → arChapters + arArticles + $arIdsArticles
   b. Guardar jerarquía

4. Para cada capítulo con chapters:
   a. GET /api/testea/get-chapter/idchapter/{N} → arSections + arArticles

5. Para cada test ID descubierto en paso 2 (823 tests en total):
   a. GET /api/testea/get-test/id/{N}        → 15 preguntas completas
   b. Guardar raw response en /tmp/testea-scrape/tests/test_{N}.json
   c. Delay 500ms

6. Post-proceso:
   a. Deduplicar preguntas por q.id (deberían ser únicas → verificar == 12,225)
   b. Extraer texto de artículo desde q.textClarification_es (agrupar por q.idArticle)
   c. Validar integridad: cross-check con num-questions de get-random-test
```

### 8.2 Implementación sugerida (Node.js)

```javascript
// scripts/testea-api-scraper.cjs
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://glados-cakeserver.com/api';
const UA = 'Mozilla/5.0 (Linux; Android 11; Cordova) TesteaApp/1.9.4';
const OUT = 'preguntas-para-subir/testea';
const DELAY_MS = 500;

// ... ver implementación completa en §8.3
```

### 8.3 Estructura de output

```
preguntas-para-subir/testea/
├── metadata/
│   ├── testea-info.json          # versión app + flags
│   ├── options.json               # error_formats, duration_times
│   ├── challenge_types.json       # 6 tipos de report
│   └── scrape-meta.json           # fecha scraping, IP ES usada, versión app, num-questions esperado
├── laws/
│   ├── 05_CONSTITUCION.json       # get-law response raw
│   ├── 01_L39-2015.json
│   └── ... (31 ficheros)
├── titles/
│   ├── 19_Titulo_Preliminar.json  # get-title response raw
│   └── ... (~200 ficheros)
├── chapters/
│   └── ...                        # get-chapter responses
├── tests/
│   ├── 0033_CONSTITUCION_TP_010.json  # get-test response raw
│   └── ... (823 ficheros)
├── questions-flat.ndjson          # una pregunta por línea (dedup por q.id)
├── articles-inferred.ndjson       # texto de artículos extraído de textClarification_es
└── scrape-progress.json           # cursor para reanudar
```

### 8.4 Mapeo a Vence (post-proceso)

**Ley → Ley de Vence:**

Usar `law.acronim_es` o `law.code` para matchear contra `laws.short_name` / `laws.slug` en Vence. Mapping manual para las que no coinciden:

```javascript
const LAW_MAPPING = {
  'CONSTITUCIÓN':      { vence_slug: 'constitucion-espanola-1978' },
  'L39/2015':          { vence_slug: 'ley-39-2015-lpac' },
  'L40/2015':          { vence_slug: 'ley-40-2015-lrjsp' },
  'RDL5/2015':         { vence_slug: 'trebep' },
  'L9/2017':           { vence_slug: 'ley-9-2017-contratos' },
  // ...
};
```

**Artículo → Artículo de Vence:**

- Testea usa IDs internos (`q.idArticle`) y `article.code` (tipo `"Artículo 9"`).
- Extraer número de artículo con regex: `/Art[íi]culo\s+(\d+)/` sobre `article.code` o `article.name_es`.
- Match contra `articles.article_number` en Vence (donde `article_number` coincide y `articles.law_id` es la ley mapeada).

**Pregunta:**

- `solution` (1-4) → `correct_option` (0-3 en Vence): restar 1.
- `official: true` → `is_official: true` en Vence.
- `text_es` → `question_text`.
- `answer{1..4}_es` → `options` array `[a1, a2, a3, a4]`.
- `textClarification_es` → `explanation` (mantener HTML o convertir a markdown).

**Dedup contra preguntas existentes:** hash normalizado de `text_es` + `answer[1-4]_es` contra existentes en Vence (mismo `primary_article_id`).

### 8.5 Volumen estimado

- Requests totales: 31 (leyes) + ~200 (titles) + ~N (chapters) + 823 (tests) + 3 (metadata) = **~1050-1100 requests**
- Con 500ms delay: **~9 minutos**
- Con 200ms delay: **~3.5 minutos**

**Rate limit observado:** ninguno en 1000+ requests de prueba. API Platform + CakePHP sin WAF visible aparte del filtro geo.

**Delay recomendado:** 500ms por request. Podría reducirse pero por cortesía y para no levantar alertas.

---

## 9. Caveats y lecciones aprendidas

### 9.1 Parámetros case-sensitive

Los endpoints exigen el param exacto:

| Endpoint | Param correcto | ❌ NO funciona |
|----------|----------------|---------------|
| `get-law` | `idlaw` | `id`, `idLaw`, `lawId` |
| `get-title` | `idtitle` | `id`, `idTitle`, `titleId` |
| `get-chapter` | `idchapter` | `id`, `idChapter` |
| `get-test` | `id` | `idtest`, `testId` |

Si devuelve `"error":1,"arTitles":[]` o similar con array vacío → param incorrecto.

### 9.2 El typo `enviroment` en el código JS

El dev escribió `enviroment` consistentemente (sin la 2ª `n`). Al grepear: usa `enviroment`, no `environment`.

### 9.3 Estructura rara de `test.q`

Es `[IDs_array, Objects_array]` — dos arrays paralelos. Ignorar `q[0]`, usar `q[1]` que contiene los objetos con `{id, order, q:{...}}`.

Cada `q[1][i].q` tiene el objeto real de la pregunta.

### 9.4 Errores de negocio vienen con HTTP 200

```json
{"error":1,"errorMessage":"El test no existe"}
```

**NO usar `curl -f`** (ignora errores de negocio). Siempre parsear JSON y comprobar `data.error`.

### 9.5 Fechas con timezone

`real_date` y `publish_date` vienen en ISO 8601 con timezone europea:
- `"2023-04-18T23:00:00+02:00"` (horario de verano CEST)
- `"2023-10-30T00:00:00+01:00"` (horario estándar CET)

Al parsear, normalizar a UTC o ignorar hora si solo importa la fecha.

### 9.6 Campos vacíos vs null

Algunos endpoints devuelven `""` (string vacío) y otros `null`:
- `test.chapter_code: ""` cuando el test no tiene capítulo específico
- `q.idTitle: null` cuando la pregunta está a nivel de ley, no de título

Manejar ambos como "ausente" en el scraper.

### 9.7 El hash del bundle cambia entre versiones

El JS está en `assets/index-ebcbbf20.js` para v1.9.4. En versiones futuras el hash cambia. El scraper no depende del bundle (solo el mapeo inicial), pero para **re-descubrir endpoints** en una versión nueva hay que volver a hacer §3.

### 9.8 `num-questions: 12225` es el canary del scraper

Al terminar el scraping completo, **debe haber exactamente 12,225 preguntas únicas** (por `q.id`). Si tienes más, hay duplicados en `q.id` (imposible según el modelo). Si tienes menos, falta algún test.

Verificación final:

```bash
jq -s 'group_by(.id)|map(.[0])|length' questions-flat.ndjson
# → debe ser 12225
```

### 9.9 2 leyes sin tests

`RD 365/1995` (law id=8) y `RD 33/1986` (law id=34) están publicadas pero sin tests. El scraper debe tolerar leyes con 0 tests.

### 9.10 Responsabilidad ética

- El backend filtra geo-IP intencionadamente → respetar. No usar VPN para brute force o DoS.
- Los endpoints de auth (`login`, `create-new-user`, etc.) no tienen rate limit visible → NO hacer enumeración de cuentas.
- Delay ≥500ms en requests de scraping.
- Identificar con User-Agent honesto si tienes uno (no hace falta enmascararlo).

---

## 10. Cheatsheet — probar la API rápidamente

```bash
BASE="https://glados-cakeserver.com/api"
UA="Mozilla/5.0 (Linux; Android 11; Cordova) TesteaApp/1.9.4"
curl() { command curl -sS --max-time 10 -H "User-Agent: $UA" "$@"; }

# 0. Sanity (IP ES y backend responde)
curl https://ipinfo.io/json | jq '.country'        # debe dar "ES"
curl "$BASE/testea/get-testea-info" | jq .

# 1. Metadata
curl "$BASE/testea/get-options/" | jq .
curl "$BASE/testea/get-laws" | jq '.arLaws|length'       # → 31

# 2. Inspeccionar una ley (Constitución)
curl "$BASE/testea/get-law/idlaw/5" | jq '{
  titles: (.arTitles|length),
  tests_main: (.qByLaw."5".mainLevel|length),
  tests_sub: (.qByLaw."5".subLevel|length),
  realexam: (.qByLawNew."5".mainLevel.realexam|length),
  exam: (.qByLawNew."5".mainLevel.exam|length)
}'

# 3. Descargar un test completo con preguntas + respuesta correcta
curl "$BASE/testea/get-test/id/33" | jq '{
  meta: .test | del(.q),
  questions: [.test.q[1][] | {
    order, id: .q.id,
    text: .q.text_es,
    solution: .q.solution,       # 1-4
    correct: .q["answer"+.q.solution+"_es"],
    official: .q.official,
    article: .q.idArticle,
    boe_citado: .q.textClarification_es | .[0:100]
  }]
}'

# 4. Totales globales
curl "$BASE/testea/get-random-test" | jq '."num-questions"'  # → 12225
```

---

## 11. Auditoría exhaustiva del schema (16/04/2026)

Tras la primera pasada documental se hizo una **auditoría completa** bajando los 823 tests + 163 títulos + 268 capítulos, para verificar que NO había campos ocultos, multi-idioma o condicionales. Resultado:

### 11.1 Volumen scrapeado

| Entidad | Cantidad |
|---------|----------|
| Laws | 31 |
| Titles | 163 |
| Chapters | 268 |
| Sections (referenciadas) | 109 |
| Articles únicos descubiertos | 1,562 |
| Tests descargados | **823 / 823 (100%)** |
| Preguntas únicas deduplicadas por `q.id` | **12,227** (canary app: 12,225, diff +2) |
| Preguntas oficiales (`q.official=true`) | **1,658** |

### 11.2 Cobertura de campos (sobre los 823 tests y 14,289 slots de preguntas)

| Nivel | Campos | Cobertura |
|-------|--------|-----------|
| Top-level response | 7 (`error`, `test`, `stats`, `error_formats`, `duration_times`, `max_fail_answers`, `challenge_types`) | 100% |
| `test.*` | 27 campos | **100%** en los 823 tests |
| `slot.*` (items de `test.q[1]`) | 2 (`id`, `order`) | 100% |
| `q.*` (pregunta) | 13 campos | **100%** en las 14,289 preguntas |
| `title.*` | 8 campos | 100% en los 163 títulos |
| `chapter.*` | 7 campos | 100% en los 268 capítulos |
| `article.*` | 10 campos | 100% en los 1,562 artículos |

### 11.3 Hipótesis descartadas con evidencia

- 🚫 **Multi-idioma:** solo sufijo `_es` detectado. No existen `_en`, `_ca`, `_eu`, `_ga`, `_pt`, `_fr`. El sufijo `_es` es puramente convencional, no hay planes bilingües reflejados en la API.
- 🚫 **Imágenes:** no hay campos `imageName`, `image`, `picture`, `thumbnail`, `attachment` en ninguna capa (law/title/chapter/section/article/test/question). El modelo de datos **no soporta imágenes**.
- 🚫 **Dificultad, tags, keywords:** no existen. La única "categorización" es la jerarquía Ley→Título→Capítulo→Sección→Artículo.
- 🚫 **Timestamps en preguntas:** `q` no tiene `created_at`/`updated_at`. Los timestamps existen solo en `test.real_date` y `test.publish_date`.
- 🚫 **Feedback por respuesta (A/B/C/D):** no existe. Solo hay `q.textClarification_es` global de la pregunta.
- 🚫 **Campos condicionales (solo-realexam, solo-official, etc.):** todos los campos aparecen al 100%. El schema es totalmente consistente.

### 11.4 Anomalías de datos encontradas (no de API)

- **1 pregunta bug** con `q.id="0"`, `solution=null`, `text=""`, `official=null` en el test 497 (`type=exam`). Es un slot fantasma residual. **El scraper debe skippear preguntas con `q.id == "0"`**.
- **Distribución de `q.solution`** (12,226 preguntas válidas): 26% / 25% / 25% / 24% entre las opciones 1/2/3/4. Balance prácticamente uniforme → datos no sesgados.
- **`q.official=true` en 12.24%** de preguntas (1,658 / 12,227). De éstas, 99.94% están en tests con `type=realexam`.
- **2 leyes publicadas sin tests**: `RD 365/1995` (id=8) y `RD 33/1986` (id=34). El scraper las tolera (get-law devuelve OK pero con `qByLaw` vacío).

### 11.5 Datos scrapeados en disco

Ubicación: `preguntas-para-subir/testea/` (41 MB)

```
preguntas-para-subir/testea/
├── metadata/
│   ├── scrape-meta.json          # fecha, IP, totales, integridad
│   ├── discovery.json             # mapa test-id → law-id
│   ├── testea-info.json           # versión mínima app
│   └── options.json               # error_formats + duration_times
├── raw/
│   ├── _all-laws.json             # get-laws completo
│   ├── laws/law_NN.json           # 31 ficheros (get-law/idlaw/NN)
│   ├── titles/title_NN.json       # 163 ficheros (get-title/idtitle/NN)
│   ├── chapters/chapter_NN.json   # 268 ficheros (get-chapter/idchapter/NN)
│   └── tests/test_NN.json         # 823 ficheros (get-test/id/NN) ⭐ las preguntas
└── flat/
    └── questions.ndjson           # 16 MB · 12,227 preguntas deduplicadas por q.id
```

### 11.6 Velocidad real observada

Con 12 workers paralelos (sin delay, IP ES desde Barcelona HostRoyale):

- **823 tests en 88 segundos** (~9.3 req/s, ~100 ms/req)
- **163 títulos en 13 segundos**
- **268 capítulos en 22 segundos**
- **Total scrape completo: ~2 minutos**

El servidor aguantó 12 workers sin rate limiting ni 5xx. Para scrapes de producción **usar delays 500ms + serial** por cortesía, pero la infraestructura soporta mucho más.

### 11.7 Próximo paso

Pipeline de importación a Vence:

1. Mapping manual `laws/*.json` → Vence `laws` (31 entradas, §8.4)
2. Extraer texto de artículo desde `q.textClarification_es` → Vence `articles.content`
3. Transformar preguntas (`solution` 1-4 → `correct_option` 0-3)
4. Dedupe contra preguntas existentes en Vence (hash normalizado del enunciado + respuestas)
5. Pasar por pipeline estándar de `docs/maintenance/importar-preguntas-scrapeadas.md`
