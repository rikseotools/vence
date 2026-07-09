# Manual de Scraping — OpofimáticaEstado

> **Fecha:** Julio 2026 (RECON + AUDITORÍA con sesión logueada)
> **Estado:** 🟢 **Auditado con acceso** — estructura de extracción confirmada, listo para scrapear (cookie de sesión en `scripts/opofimatica-cookies.json`)
> **URL:** https://www.opofimaticaestado.com/plataforma-de-test/
> **Qué es:** Plataforma de tests de **Ofimática** (Word/Excel/Windows/Outlook) para oposiciones del Estado. Nicho: la parte ofimática que otros proveedores cubren mal — encaja con el split Office web/escritorio de Vence (examen Aragón = Word/Excel 365) y con la demanda de TAI/Aux. Admin.

---

## 1. Tech stack (confirmado en RECON)

| Componente | Valor | Cómo se detectó |
|---|---|---|
| **CMS** | WordPress 7.0 | `<meta name="generator">` |
| **Tema** | Kadence | `wp-content/themes/kadence/` |
| **Plugin de test** | **Quiz Maker (ays-pro)** | `wp-content/plugins/quiz-maker/` → 200; clases JS `ays_quiz_*` |
| **Paywall / membresía** | **Paid Member Subscriptions Pro** (PMS) | `plugins/paid-member-subscriptions-pro/`; gateways Stripe + PayPal + cupones |
| **Popups** | ays-popup-box (mismo vendor ays-pro) | JS en la home |
| **Stats** | wp-statistics | namespace REST `wp-statistics/v2` |
| **PDF** | html2pdf.js (cdnjs) | probablemente para descargar resultados |

**No es** LearnDash/H5P/LifterLMS (post types REST estándar, sin `sfwd-quiz`). **No expone** namespace REST propio del quiz: Quiz Maker usa **`admin-ajax.php`**, no la WP REST API.

## 2. Cómo entrega las preguntas (vector de scraping)

- La página `/plataforma-de-test/` **NO server-renderiza las preguntas** (0 contenedores `ays-question-container` en el HTML) y **pide login** ("iniciar sesión"). Los tests están **tras el paywall PMS**.
- Quiz Maker (Pro) carga las preguntas por **`admin-ajax.php`** (feature "load questions via AJAX", que las oculta del view-source).
- Las **respuestas correctas se resuelven en cliente** (clases `ays_quiz_correct_answer`, `ays_quiz_checked_answer_div`) → **una vez autenticado, la respuesta AJAX incluye la correcta** (+ la explicación de acierto/fallo). Esto lo hace **muy scrapeable** con sesión válida.

### Estructura conocida de Quiz Maker (ays-pro)

Plugin muy documentado. Guarda en tablas propias:
- `wp_aysquiz_quizes` — tests (id, título, settings).
- `wp_aysquiz_questions` — preguntas (question HTML, type, `correct_answer`, right/wrong answer text = explicación, image).
- `wp_aysquiz_answers` — opciones (answer text, `correct` 0/1).
- `wp_aysquiz_results` — intentos.

Front: shortcode `[ays_quiz id="N"]` → contenedor `ays-quiz-container` → AJAX a `admin-ajax.php` (`action=ays_quiz_...`). El JSON de respuesta trae preguntas + opciones + flag de correcta + explicación.

## 3. Autenticación

- **Requiere membresía de pago (PMS Pro)** — Stripe o PayPal. Hay cupones (`discount-codes`), mirar si hay prueba/descuento.
- Auth = **cookie de sesión de WordPress** (login PMS estándar), NO JWT. Tras login, `admin-ajax.php` acepta la cookie.
- Para scrapear: (a) crear cuenta de pago (1 mes), (b) loguear en Chrome, (c) F12 → Network → hacer un test → capturar la petición `admin-ajax.php` (action + params + payload de respuesta con las preguntas/correctas).

## 4. Plan de scraping (procedimiento estándar §398 del roadmap)

1. **RECON** ✅ (este documento).
2. **AUTH** — crear cuenta PMS de pago (buscar cupón), obtener cookie de sesión.
3. **MAPEO** — con DevTools, capturar el `admin-ajax.php` que carga cada test:
   - Confirmar la `action` exacta (p.ej. `ays_quiz_load_box` / `load_quiz_data`).
   - Params: `quiz_id`, nonce (`ays_quiz_public_nonce` suele ir localizado en la página).
   - Enumerar los `quiz_id` disponibles (mirar los shortcodes de cada página de test tras el paywall).
4. **SCRAPING** — Node `fetch` con la cookie + nonce, iterar `quiz_id`:
   - Dos vías: (a) `admin-ajax.php` directo (rápido), o (b) Playwright con sesión persistente (`.opofimatica-session/`) leyendo el DOM tras la carga AJAX (robusto si hay nonce/anti-bot). Mismo patrón que `opositatest-*.cjs`.
   - Delays 500ms-1s; checkpoint de progreso para reanudar.
5. **TRANSFORM** — a formato Vence: `question`, `options[]` (A-D con `isCorrect`), `correctLetter`, `explanation`. Quiz Maker da HTML → limpiar. Salida en `preguntas-para-subir/opofimaticaestado/`.
6. **IMPORT** — `is_active=false`, verificar con IA, activar gradual. **Ojo ofimática:** vincular a la ley/tema no aplica (no es normativa) → van a los temas de **ofimática/informática** (Word/Excel/Windows), no a artículos. Ver split Office web/escritorio (memoria `project_office_web_escritorio_split`).
7. **DOC** — actualizar este manual con la `action`, los `quiz_id` y el volumen real.

## 4.bis AUDITORÍA COMPLETA (con sesión logueada, 08/07/2026)

### 🔓 Fallo de seguridad suyo: las preguntas + la CORRECTA van en el HTML

Para un usuario logueado, cada página de test **server-renderiza las 30 preguntas con la respuesta correcta marcada** (scoring en cliente). NO hace falta admin-ajax. Estructura por pregunta:

```html
<div class='step' data-question-id='175' data-type='radio'>
  <p class='ays-question-counter'>3 / 30</p>
  ...Categoría:<strong>Word</strong>
  <div class='ays_quiz_question'><p>3. ¿Qué acción realiza la herramienta EDITOR de Word 365?</p></div>
  <div class='ays-quiz-answers'>
    <div class='ays-field'>
      <input type='hidden' name='ays_answer_correct[]' value='0'/>   <!-- 0=incorrecta, 1=CORRECTA -->
      <input type='radio' ... value='696'/>
      <label for='ays-answer-696-7'>A) Abre una nueva ventana...</label>
    </div>
    ... (B con value='1' = correcta, C, D)
  </div>
</div>
```
- **Correcta:** la opción cuyo `ays_answer_correct[]` = `1`.
- **Opciones:** texto en `<label for='ays-answer-{id}-{quiz}'>` (A/B/C/D).
- **Explicación:** clase `ays_questtion_explanation` (embebida por pregunta).
- El `quiz_maker_ajax_public` NO lleva nonce; `admin-ajax.php` solo para submit (`ays_finish_quiz`) — irrelevante para scrapear.

### 📥 Inventario descargable (sitemap: 195 URLs)

**1. Tests (11 categorías "aleatorio") — el oro.** Cada página muestra **30 preguntas ALEATORIAS** de un pool mayor → **recargar-hasta-saturar**. Verificado: Word acumuló **164 únicas en 6 recargas** (~28 nuevas/recarga) → pool de cientos por categoría. Con las 11 categorías = **~2.000-4.000 preguntas** de ofimática con correcta + explicación:

| Página | Categoría |
|---|---|
| `/test-aleatorio-word/` | Word |
| `/test-aleatorio-excel/` | Excel |
| `/test-aleatorio-access/` | Access |
| `/test-aleatorio-outlook/` | Outlook |
| `/test-aleatorio-windows/` | Windows 10 |
| `/test-aleatorio-windows-11/` | Windows 11 |
| `/test-aleatorio-internet/` | Internet |
| `/test-aleatorio-informatica/` | Informática |
| `/test-aleatorio/`, `/test-aleatorio-word-excel/`, `/test-aleatorio-2026/` | mixtos |

Los `/patreon-*` dan **0 preguntas** con este tier (Patreon aparte).

**2. Teoría — 38 lecciones de curso** (texto + imágenes): `curso-word-1..12` (12), `curso-excel-01..13` (13), `curso-access-1..7` (7), `curso-de-outlook*` (5), `curso-windows11` (1).

**3. PDFs / ejercicios descargables:** ruta predecible `https://www.opofimaticaestado.com/docs/curso-{word,excel,access,outlook}/NN-ejercicioN.pdf` (6 solo en Word).

### 🕷️ Plan de scraping (confirmado, sin cuenta extra)

1. **Auth:** cookie de sesión ya capturada (`scripts/opofimatica-cookies.json`, `wordpress_logged_in_*`). Reutilizar; re-loguear si caduca (script `opofimatica-capture.cjs`).
2. **Preguntas:** por cada una de las 11 categorías, `fetch` la página con la cookie **N veces** (reload-to-saturate, `?_=i` para cache-bust), parsear `.step[data-question-id]` (dedupe por id) → pregunta, opciones A-D, correcta (`ays_answer_correct[]=1`), explicación, categoría. Parar cuando K recargas seguidas no aporten nuevas. Delay 500-800ms.
3. **Teoría:** `fetch` las 38 páginas `curso-*` → extraer texto + descargar PDFs de `/docs/`.
4. **Transform + import:** formato Vence (`question`, `options[]`, `correctLetter`, `explanation`, `category`). Salida `preguntas-para-subir/opofimaticaestado/`. Van a temas de **ofimática/informática** (Word/Excel/Windows), NO a artículos de ley. `is_active=false` → verificar IA → activar.

### APIs descubiertas (resumen auditoría)
- **WP REST** (`/wp-json/wp/v2`): estándar, sin datos de quiz. Namespaces: oembed, cky, sowb, wp-statistics, wp/v2, site-health, block-editor, abilities.
- **admin-ajax.php**: acciones Quiz Maker (`ays_finish_quiz`, `ays_questtion_explanation`, `ays_questions_nav_question`) — **no necesarias** (todo va en el HTML).
- **Sin API custom.** Todo el contenido de valor sale por HTML server-rendered con la cookie.

## 5. Valor para Vence

- **Nicho ofimático** poco cubierto por OpositaTest/InnoTest (que son legislativos). Útil para **TAI del Estado**, **Aux. Admin.** (bloque ofimática) y psicotécnicos-adjacentes de Office.
- Contenido **Word/Excel/Outlook/Windows** con respuesta + explicación → material directo para los temas de informática que aún están `disponible:false` en TAI (Bloques II-IV).
- Añadirlo también al **analizador de competidores** (`competitors` + `competitors.instagram` si tiene IG) — es un competidor de nicho.

## 6. Pendiente / gotchas

- **Falta la cuenta de pago** para cerrar el mapeo (action + nonce + quiz_ids + volumen). Sin ella, RECON llega hasta "sistema identificado".
- Nonce por sesión: `admin-ajax` de Quiz Maker suele exigir `nonce` (localizado en la página como `ays_quiz_public_nonce` o similar) → re-extraer si caduca.
- Anti-bot: no se detectó Cloudflare/JS-challenge en RECON (curl simple funciona para el HTML). Confirmar tras login.
- **Verificar términos**: es contenido de pago; el scraping es solo para inteligencia de competidores / referencia interna, no republicar.
