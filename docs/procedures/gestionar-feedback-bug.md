# Gestionar Feedback de Bug

**Este manual es una METODOLOGÍA DE INVESTIGACIÓN genérica.** No intenta diagnosticar bugs — te enseña DÓNDE buscar datos para que TÚ (Claude) hagas el diagnóstico. Funciona para cualquier tipo de bug: tests no guardados, contenido incorrecto, UI rota, errores de pago, etc.

**Principio: recopilar datos primero, diagnosticar después.** Ejecuta TODOS los pasos antes de sacar conclusiones.

> 🔒 **ORDEN OBLIGATORIO para feedbacks de BUG (decisión Manuel 11/07). NO saltárselo ni responder antes de tiempo:**
> 1. **Diagnosticar el fallo A CIENCIA CIERTA** — no suponer, no "seguramente fue transitorio". Usa la observabilidad que tenemos (`validation_error_logs`, `observable_events`, `user_interactions`/journey, `question_lifecycle_history`, tablas de dominio) y **SIMULA con los datos reales del usuario** (replica su query/endpoint con su `target_oposicion`, su id, su hora). Distingue con evidencia entre las ramas del código (p.ej. error de red vs respuesta vacía → distinta pantalla). Si un dato no se puede recuperar por falta de observabilidad, dilo explícitamente — ese hueco suele ser parte del bug.
> 2. **Proponer a Manuel FIX(es) robustos, profesionales y escalables — sin chapuzas.** Ataca la causa raíz y el modo de fallo de CLASE (no solo el síntoma de ese usuario): p.ej. anti-dead-end + detección (evento de observabilidad) + cerrar el hueco de auditoría. Esperar su elección antes de implementar.
> 3. **Solo entonces, responder al usuario** (borrador + OK, como siempre). La respuesta se apoya en el diagnóstico real, no en conjeturas.
>
> **Caso de referencia (Alfonso, 11/07): "en el apartado de leyes dice que no hay leyes disponibles".** Tentación: "fallo transitorio, recarga". Realidad (simulando con sus datos): la pantalla "Sin leyes disponibles" solo sale con API `success:true` + lista **vacía** (no con 503, que muestra otra pantalla); su oposición actual devuelve 23 leyes, pero su perfil cambió de oposición ese día → a la hora del fallo tenía seleccionada una oposición **sin leyes mapeadas** → callejón sin salida. Fix de clase: fallback a todas las leyes cuando el scope da 0 + evento de detección + auditoría de cambios de `target_oposicion` (el hueco que impidió recuperar su oposición exacta).

> ⚠️ **OBLIGATORIO SIEMPRE: analizar el JOURNEY del usuario antes de responder.** Para CUALQUIER feedback (bug, contenido, duda, sugerencia), reconstruye primero su recorrido y su **historial de feedbacks/impugnaciones** (Paso 3) — no te quedes con el texto literal del mensaje. El journey revela lo que el usuario **de verdad** quiere y da el contexto que cambia el diagnóstico.
>
> **Caso de referencia (Isabel B, Aragón, 04/07/2026):** preguntó "¿habéis hecho un inciso de las diferencias de Word/Excel 365 Web vs escritorio?". Leído literal parecía "añadid un extra". Pero su **historial** (había cazado antes que la versión estaba mal —Office 2016 en vez de 365— y había enlazado la nota oficial del IAAP) mostró que su verdadera intención era **verificar que el contenido coincide con la versión exacta que le examinan**. El journey convirtió "sugerencia menor" en "el contenido está en la variante equivocada según el spec oficial". Sin analizar el journey, la respuesta habría sido incorrecta.
>
> **Caso de referencia (Gonzalo/Vero, aux. admin. Comunidad de Madrid, 17/07/2026) — verifica si hay una convocatoria MÁS NUEVA, no solo la que tienes en BD:** dos usuarios avisaron de que su examen es sobre Windows 11 y nuestro Tema 16 estaba en Windows 10. Verifiqué contra la convocatoria que teníamos cargada (`is_current` en BD: Orden 264/2026, examen octubre → Windows 10) y respondí "es Windows 10". **Era incorrecto para ellos:** existía una convocatoria **más reciente** del MISMO cuerpo (Orden 1628/2026, publicada después, inscripción abierta, examen 2027) que examina **Windows 11** y que **NO estaba en nuestra BD**. Pueden coexistir **DOS convocatorias abiertas** a la vez (una con examen inminente, otra recién convocada). **Regla:** cuando un usuario afirma una versión / fecha / nº de plazas que NO cuadra con nuestra BD, NO te quedes en verificar la convocatoria que tienes cargada — busca en la **fuente oficial** (BOE / boletín autonómico) si hay una convocatoria **posterior** que la nuestra aún no refleja. Nuestra BD puede ir por detrás de la realidad. (Los PDF de boletín suelen venir firmados y `WebFetch` no los extrae → bájalos y usa `pdftotext -layout`.)

## 🔒 Reparto entre sesiones (claim) — antes de coger un feedback

Si hay **varias sesiones** trabajando la cola a la vez (2-10), **coge** cada feedback antes de analizarlo para no pisar a otra sesión (mismo sistema que impugnaciones). Lee/escribe RDS (`pg`/`DATABASE_URL`), nunca `@supabase/supabase-js` (Supabase congelado → datos viejos):

```bash
node scripts/impugnaciones/cola.cjs list                                 # las 3 colas + quién tiene qué
node scripts/impugnaciones/cola.cjs next --sid <tu-id-de-sesión> --queue feedback   # coge el más antiguo libre
node scripts/impugnaciones/cola.cjs release <feedback_id> --sid <id>     # soltar sin cerrar
```

El claim es atómico (`FOR UPDATE SKIP LOCKED`), se guarda en `user_feedback.claimed_by/claimed_at` y **se auto-libera a las 2h**. El cierre (`/api/v2/feedback/respond`) lo saca del pool. Detalle: manual de impugnaciones §1.bis.

👤 **Una sesión = un usuario entero.** `cola.cjs next --queue feedback` coge el feedback más antiguo libre **y además todos los demás pendientes del MISMO usuario** (respetando los que ya tenga otra sesión). Es a propósito: el journey ya lo reconstruyes una vez (Paso 3) y vale para todos sus feedbacks — la misma sesión que tiene ese contexto los resuelve todos, con mejor diagnóstico. Sigue **UNA POR UNA** en la respuesta (cada feedback su propio borrador + OK + cierre; nunca un mensaje agrupado), pero **una sola sesión** los lleva.

## ⚠️ Orden de prioridad de la cola

**Prioriza los feedbacks con valor de RETENCIÓN/AYUDA primero; las eliminaciones de cuenta van SIEMPRE las ÚLTIMAS.**

1. **Bugs** (sobre todo de premium: se cierra la app, no se guarda, no encuentra algo) → churn/reembolso inminente, actuar ya.
2. **Facturación / confusión de premium recién pagado** → riesgo de reembolso, alto valor de retención.
3. **Contenido / dudas / demandas de oposición** → ayudar, aclarar, o valorar montar.
4. **`account_deletion` — SIEMPRE lo ÚLTIMO.** El usuario ya decidió irse: no hay retención que salvar y la eliminación tiene ventana RGPD (no es instantánea), así que se procesa al final, cuando no queda nada con valor de retención por atender. (Sigue teniendo su propio runbook obligatorio, ver abajo — pero NO se prioriza sobre lo demás.)

## Triaje por `type` antes de empezar

Antes de aplicar la metodología, mira el campo `user_feedback.type`. No todos los feedbacks son bugs — algunos tienen su propio runbook:

| `type` | Runbook |
|---|---|
| `account_deletion` | **`docs/maintenance/eliminacion-cuentas.md`** — investigación + `deletion_reason` exhaustivo + `/api/admin/delete-user`. NO uses este manual. |
| **Facturación: cancelar suscripción / le han cobrado / reembolso / darse de baja** (cualquier `type`; suele venir como `other`) | **`docs/procedures/reembolsos.md`** — la metodología de investigación es la de este manual, pero el flujo de acción (Stripe + cancelar sub + degradar + audit) es el de reembolsos. La **decisión de reembolso es de Manuel**. |
| `email` (reply a newsletter/aviso) | Este manual + sección "Email threading" más abajo para mantener el hilo en Gmail. |
| **Temario / epígrafes / scope** (duda de qué entra en un tema, artículos de más o de menos, "esto no entra"/"falta esto"; suele venir como `other`) | **Sección "Feedback de TEMARIO / epígrafes / scope" abajo** + `docs/runbooks/verificar-epigrafes-scope.md`. NO respondas directo: primero Paso 1 (clonación epígrafe) → Paso 2 (auditar scope) → usuario. |
| `bug`, `other`, resto | Este manual. |

Si el feedback es `account_deletion`, **detente y abre el manual de eliminación**. El flujo es distinto (RGPD Art. 17 + retención contable) y exige `deletion_reason` con journey completo antes de ejecutar nada.

### 🎁 Recompensar al usuario tras resolver su aviso

Si el usuario reportó un **bug real / mejora de usabilidad** y **lo resolvemos** (o compartió una **opinión genuina** de Vence), tiene derecho a una recompensa del **Programa de Embajadores** (bug 3 € / opinión 5 €, acumuladas y pagadas en gift card de Amazon.es).

> **⚠️ Solo usuarios PREMIUM son candidatos a recompensa.** El Programa de Embajadores (bug/opinión/referido) es **exclusivo de premium** — son los embajadores y solo ellos tienen panel y saldo. Un usuario **free NO recibe recompensa** aunque su bug/opinión sea válido (mira `user_profiles.plan_type` antes de plantearte crearla). El endpoint `/api/admin/rewards` **no** lo comprueba (solo `requireAdmin`), así que la regla la aplicas TÚ. A un free que reporta algo útil: agradécelo y, si procede, úsalo como gancho de conversión (§ Pre-venta), pero sin recompensa. Al crear la recompensa, el usuario recibe **solo el badge del icono 🎁** (bug/ugc **NO envían email** — decisión Manuel 10/07: la recompensa nace de un feedback que ya le respondes por su hilo, así que el email sería redundante). **Avísale de la recompensa en tu propia respuesta al feedback.** Cómo crearla por API (y pagar): **`docs/runbooks/embajadores-recompensas.md`** (§2). Solo para bugs/usabilidad genuinos que nos sirven — NO para impugnaciones de preguntas (esas tienen su propio proceso).

> **⚠️ Opinión (UGC 5 €) ≠ compartir el enlace de referido (referido 10 €). ABRE la captura antes de crear la recompensa UGC** (aprendizaje 11/07, caso Mari). Si la "aportación" es una **reseña nombrando Vence SIN su enlace de referido** → UGC legítima (5 €). Si es soltar su **enlace `vence.es/r/<code>`** con un pitch → eso es Programa de **Referidos** (ya cobra 10 €/venta + 2 €/registro activo) → **NO crees UGC** (sería doble pago + incentivo a spamear el link); respóndele explicando la diferencia. Detalle: `docs/runbooks/embajadores-recompensas.md` §2.

Si el feedback es de **facturación**, el estado real está en **Stripe**, no en la BD: `user_subscriptions`/`payment_settlements` pueden estar desincronizadas (p.ej. la BD marca la suscripción activa hasta fin de periodo cuando en Stripe ya está cerrada, o no refleja un cargo ya reembolsado). Verifica SIEMPRE facturas + charges + refunds en Stripe (`docs/procedures/reembolsos.md` §0 y TRAMPA #5) antes de prometer o diagnosticar nada.

## Feedback de TEMARIO / epígrafes / scope — ORDEN OBLIGATORIO (Paso 1 → Paso 2 → usuario)

Cuando el usuario pregunta algo sobre **qué entra en un tema** (epígrafes, artículos de más o de menos, "esto no entra", "falta esto", dudas de temario), **NO respondas directo a lo que dice**. Lee el runbook **`docs/runbooks/verificar-epigrafes-scope.md`** y sigue este orden — la BD es **trackeable**, mírala antes de trabajar:

1. **¿Está hecha la clonación del epígrafe oficial (Paso 1)?** Mira `topic_epigrafe_verification` de esa oposición. Si NO está (`never_sourced`), **hazla primero**: clonar el temario LITERAL oficial (convocatoria / DOGV / BOE) → `topics.epigrafe`, confirmarlo y registrarlo (`verified_literal` + `source_url` del PDF exacto). Es **bloqueante**: sin epígrafe de fiar no se puede auditar el scope.
2. **¿Está auditada toda la oposición (Paso 2)?** Mira `topic_scope_verification`. Si NO, **audita la oposición ENTERA** (workflow `verify-scope-oposicion` → `verify:scope plan` → `apply`), no solo el tema del usuario — de paso caza otros errores.
3. **Revisa lo que dice el usuario** — SIEMPRE al final, ya sobre base firme.
4. **Si has TOCADO `topic_scope`** (cambiado `article_numbers` de algún tema al corregir), **revalida cache al terminar**: invalidar los tags `temario` + `test-counts` (y `teoria` si cambia lo visible en la página de teoría), o `node scripts/purge-all-cache.js` si el cambio es masivo. Si no, el temario/teoría se sigue viendo con el estado viejo cacheado aunque la BD ya esté bien. El tag `'questions'` NO basta: solo cubre respuesta/explicación de la pregunta, no el scope. Ver `docs/maintenance/cache-revalidation.md`.

**Atajo:** si la BD ya dice que la oposición está auditada (Paso 1 `verified_literal` + Paso 2 `verified_correct`, frescos), **NO repitas la auditoría** — ve directo a revisar el punto concreto del usuario contra el scope/epígrafe ya verificados.

> **No recompensable:** temario/epígrafes/scope es contenido, no un fallo funcional de la app → NO lleva recompensa (regla `feedback_recompensa_solo_bug_app_no_contenido`). Se corrige si procede, pero no se paga.

> **Ejemplo real (subalterno_gva, 13/07):** Sonia preguntó por 2 temas; al no estar hecho el Paso 1, se clonó el epígrafe oficial (15/15 `verified_literal` contra el PDF primario del DOGV) y se auditó el scope entero (15/15 `verified_correct`) ANTES de contestarle — lo que de paso destapó 3 errores reales que ella no había visto (Ley 4/2023 sobre-scope, Ley 9/2003 ausente, Decreto 42/2019 vacío). Lo que ella señalaba ya estaba bien.

## Feedback de PRE-VENTA / conversión (usuario free preguntando por premium) — PERSONALIZAR

Cuando un usuario **free** pregunta qué incluye el pago, si merece la pena, qué diferencia hay con el gratis, o dice que "está pensando en pagar" (suele venir como `other`/`suggestion`), **NO es una consulta de soporte: es una oportunidad de conversión.** No respondas genérico — **personaliza a esa persona y sus circunstancias** (aprendizaje 07/07/2026, caso Sonia González, preventa Subalterno GVA):

1. **Investiga su ciudad** para proponerle **oposiciones cruzadas** de su zona: `SELECT ciudad, registration_ip, target_oposicion FROM user_profiles WHERE id=…` (si `ciudad` es null, geolocaliza la `registration_ip`). Ej.: Valencia + Subalterno GVA → sugerir Auxiliar Administrativo de la Generalitat Valenciana (C2, un nivel por encima) y del Ayuntamiento de Valencia.
2. **Gancho estrella (lo MÁS valorado por los alumnos): estadísticas compartidas.** Buena parte del temario es **común** entre oposiciones (Constitución, Ley 39/2015, Ley 40/2015, Estatuto/Consell autonómicos, Función Pública, igualdad…). Con premium, **al practicar ese contenido común avanzas a la vez en varias oposiciones con las mismas estadísticas**: estudias una vez y progresas en varias convocatorias, multiplicando oportunidades. Enfatízalo.
3. **Beneficios premium a nombrar** (`app/premium/page.tsx` es la fuente): preguntas/tests **ilimitados** (vs 25/día free), **lectura por voz del temario** (TTS — véndelo para estudiar en paseos/transporte público/tareas), **chat con IA ilimitado**, **acceso a todas las oposiciones a la vez**, **cursos de informática**.
4. **Comprueba qué features APLICAN a SU oposición vs a las cruzadas — no mientas.** Ej.: los *cursos de informática* NO aplican a Subalterno GVA (su temario de informática es solo "Seguridad digital", sin ofimática), pero SÍ a Auxiliar GVA (Windows/Word/Excel) → nómbralos ahí, no como si fueran de su temario. Igual con cualquier feature: mira su temario real (`topics.epigrafe`) antes de prometer.
5. **Responde su pregunta literal primero** (si pregunta "¿hay temario o solo tests?": sí, ambos — el temario/teoría se lee gratis, los tests son lo que premium hace ilimitado) y luego el pitch personalizado. Cierre estándar Manuel: *"Para cualquier asunto estamos a tu disposición."*

#### Playbook: «¿tenéis código de promoción / descuento / cupón?» (caso Eva Malo, Córdoba, 11/07) — para ir rápido

Es el sub-tipo de pre-venta más común. Estructura que funcionó (en este orden):

1. **NO hay códigos.** Vence **no da cupones** (ver [[feedback_vence_nunca_cupones]]). Díselo claro: *"los códigos de referido solo los tienen los usuarios que ya son Premium (nuestros embajadores); nosotros no damos códigos de promoción para nuevos alumnos."* El ahorro va **en la duración del plan** (más largo = menos €/mes). Precios actuales en [[project_pricing_v2_planes]] (hoy: mensual 29 · trimestral 39 · semestral 69 · **anual 99 €, ≈8,25 €/mes**) — verifícalos, cambian.
2. **Su oposición + VARIEDAD concreta de su zona** (que vea que tendrá dónde elegir). Query para nombrar oposiciones REALES construidas de su nivel/zona: `SELECT nombre FROM oposiciones WHERE is_active=true AND nombre ILIKE '%administrativ%' ORDER BY nombre;` → filtra por su comunidad y nombra 3-5. Ej. Córdoba: Aux. Admin. del Ayuntamiento de Córdoba (su ciudad), de la Junta de Andalucía, del Estado, diputaciones de Cádiz/Huelva, ayuntamientos de Sevilla/Granada. **Solo las `is_active=true`** (construidas), nunca prometas una catalogada-sin-contenido.
3. **Cierra con el plan ANUAL, y ponlo el ÚLTIMO párrafo.** A quien tiene claro que quiere ser funcionaria y va a largo plazo: el anual es **lo más económico y rentable**, porque **puede cambiar de oposición sin límite y presentarse a varias a la vez hasta que apruebe** (acceso a todas, con **estadísticas independientes por oposición**), + tests ilimitados, chat IA sin límite, lectura por voz.
4. **Estilo (correcciones de Manuel):** paréntesis, **no** guiones largos (—…—); no listes features que no apliquen a su oposición (los *vídeos de informática* confunden si no es seguro que su temario los tenga → mejor omitirlos); no prometas descuentos.

### En CUALQUIER pregunta sobre el temario, recomienda siempre esto (engagement/retención)

Cuando pregunten por el temario —¿está completo?, ¿se amplía según estudio?, dudas de contenido— (sea free o premium), **no te quedes en responder: convierte la duda en un empujón para que empiece/siga** (aprendizaje 07/07/2026, caso Lú Henao — premium recién pagada con 0 actividad):
- **Tranquiliza:** el temario está **completo y disponible desde ya** (todos los temas con teoría + tests); no se desbloquea según avanza. Lo que sí hacemos es **mantenerlo al día** (reformas legales + preguntas de exámenes oficiales recientes).
- **Recomienda la lectura por voz:** además de leerlo, puede **escucharlo** — ideal para repasar **haciendo deporte o en transporte público**, sin perder tiempo.
- **Foco + ánimo:** ir tema a tema con constancia, apoyarse en los tests para fijar, y un **ánimo** final ("lo tienes a tu alcance").

## Paso 0: ¿YA está respondido / resuelto? (mirar ANTES de redactar nada)

Un feedback con `status='pending'` **NO significa que esté sin atender** — puede estar respondido y resuelto pero sin cerrar. Antes de redactar, busca la respuesta en la tabla correcta:

- **`user_feedback.admin_response`** (campo de texto): aquí está la respuesta del admin. **Mirar SIEMPRE este campo primero** — la respuesta NO siempre se guarda en `feedback_messages`.
- **`feedback_messages`** (si hay hilo): columnas `is_admin` + `sender_id` + `message` — **NO `sender_type`** (consultar con una columna inexistente puede devolver vacío sin error y hacerte creer que no hay respuesta). El `conversation_id` del mensaje puede no coincidir con el de `feedback_conversations`; cruza por `user_id`/`feedback_id`, no asumas el link.
- Si ya está respondido y atendido, **no mandes otra respuesta**: cierra con `finalStatus:'resolved'` sin `message` (cierre silencioso, §Paso 10 caso B).

> **⚠️ Síntoma "No puedo leer vuestras respuestas" (visto 03/07/2026 — José Andrés, CARM):** el usuario abre un 2º feedback quejándose de que no ve nuestra respuesta. **Causa típica:** la respuesta al feedback anterior se guardó **solo en `user_feedback.admin_response`** (vía legacy) y **nunca se insertó en `feedback_messages`**, así que su conversación en la app aparece **vacía** (0 mensajes) — el chat lee de `feedback_messages`, no de `admin_response`. El email de aviso (`soporte_respuesta`) puede haberse enviado, pero si el usuario no lo abre (`email_events.open_count = 0`) se queda a ciegas. **Fix:** reponer esa respuesta llamando a `/api/v2/feedback/respond` (que sí inserta en `feedback_messages`), reconociendo al usuario que tenía razón. No basta con tener el texto en `admin_response`.

## Paso 1: Identificar al usuario y contexto

```js
// Perfil del usuario
const { data: profile } = await supabase.from('user_profiles')
  .select('id, email, full_name, plan_type, target_oposicion')
  .eq('id', userId).single();
```

Datos clave: **plan_type** (free/premium afecta límites), **target_oposicion** (qué oposición usa).

## Paso 2: Verificar qué versión del código tiene el usuario

```js
// deploy_version en interacciones recientes
const { data } = await supabase.from('user_interactions')
  .select('deploy_version, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .not('deploy_version', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);
```

```bash
# Commit actual en producción
git log --oneline -1
```

Si el `deploy_version` del usuario NO coincide con el commit actual → tiene código cacheado. Hook `useVersionCheck` fuerza recarga al volver de background, pero si no ha cambiado de pestaña no se activa.

## Paso 3: Reconstruir el journey completo del usuario

```js
// Timeline: QUÉ hizo el usuario y CUÁNDO
const { data } = await supabase.from('user_interactions')
  .select('event_type, action, element_text, page_url, deploy_version, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA_INICIO')
  .order('created_at', { ascending: true });
```

**Qué buscar en el journey:**
- `page_view` → páginas visitadas (ruta del bug)
- `test_answer_selected` → respuestas dadas
- `test_test_completed` → tests terminados
- `page_exit` → cuándo sale de la página
- Patrones: ¿navegó entre temas sin recargar? ¿Hizo muchos tests seguidos? ¿Estuvo horas sin cerrar?

Ver también: `docs/procedures/investigar-journey-usuario.md`

## Paso 4: Comparar lo que hizo vs lo que se guardó

```js
// Tests del usuario en el periodo del bug
const { data: tests } = await supabase.from('tests')
  .select('id, score, total_questions, is_completed, created_at, test_type, deploy_version')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });

// Para cada test, contar respuestas guardadas
for (const t of tests) {
  const { count } = await supabase.from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', t.id);
  console.log(`[${t.created_at}] ${t.test_type} score:${t.score}/${t.total_questions} saved:${count} done:${t.is_completed} [v:${t.deploy_version}]`);
}

// Total interacciones de respuesta
const { count: interactions } = await supabase.from('user_interactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('event_type', 'test_answer_selected')
  .gte('created_at', 'FECHA');

// daily_question_usage
const { data: usage } = await supabase.from('daily_question_usage')
  .select('date, questions_used')
  .eq('user_id', userId)
  .gte('date', 'FECHA')
  .order('date', { ascending: false });
```

**Qué cruzar:**
- `interactions` > 0 pero `tests` = 0 → sesión de test no se creó
- `tests` con `saved:0` → respuestas no llegaron a `test_questions`
- `tests` con `saved < total_questions` → algunas respuestas se perdieron a mitad
- `daily_question_usage` null → contador de preguntas no se actualiza

> **Cuando la observabilidad NO capturó los parámetros de la petición — reconstruye el comportamiento desde los artefactos guardados (caso Laura, psicotécnicos, 17/07/2026):** reportó que al filtrar una subcategoría ("sinónimos y antónimos") le salían también preguntas de otras (definiciones, frases). Ni `user_interactions` (guarda la `page_url` SIN el query string) ni la sesión (`psychometric_test_sessions.sections_selected` iba **siempre NULL**) registraban QUÉ pidió → el bug NO era diagnosticable con los logs. **No te rindas ni le pidas más datos al usuario:** reconstruye el comportamiento real desde lo que SÍ se guardó — aquí, los `question_ids` de cada sesión (`questions_data`) → deriva de cada pregunta su sección/subtipo. El patrón lo delató: muchas sesiones **homogéneas** de UNA sección (el filtro SÍ funcionaba) frente a una sesión que **mezclaba las 6 secciones** del bloque (la instancia real del bug). **Lecciones:** (1) sesiones homogéneas vs mixtas revelan si un filtro se aplicó o no; (2) que dos usuarios/sesiones "correctas" existan no descarta el bug — busca la instancia que lo reproduce; (3) al arreglar, **cierra también el hueco de observabilidad** (persistir la selección pedida) para que el PRÓXIMO caso se vea de un vistazo, sin reconstruirlo a mano. Filosofía martillo: si la observabilidad podía haberlo capturado y no lo hizo, arréglalo en el mismo trabajo.

## Paso 5: Buscar TODOS los errores del usuario

```js
// TODOS los errores, sin filtrar por endpoint
const { data: errors } = await supabase.from('validation_error_logs')
  .select('created_at, endpoint, error_type, error_message, deploy_version, http_status, severity')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });

// Si el userId podría no estar en el log (errores client-side anónimos),
// buscar también por endpoint + rango temporal
const { data: globalErrors } = await supabase.from('validation_error_logs')
  .select('created_at, endpoint, error_type, error_message, user_id, deploy_version')
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false })
  .limit(50);
```

**Campos clave de cada error:**
- `endpoint` → qué API o componente falló
- `error_message` → incluye `component:` si viene de client-side (answerSaveQueue, TestLayout, etc.)
- `deploy_version` → qué versión del código generó el error
- `http_status` → 400 (datos mal), 401 (auth), 500 (servidor)

## Paso 6: Verificar alcance — ¿es solo este usuario o es global?

```js
// Tests recientes con saved:0 de CUALQUIER usuario
const { data: recentTests } = await supabase.from('tests')
  .select('user_id, id, score, total_questions, is_completed, created_at')
  .gte('created_at', 'FECHA_RECIENTE')
  .eq('is_completed', true)
  .order('created_at', { ascending: false })
  .limit(50);

// Contar cuántos tienen saved:0
for (const t of recentTests) {
  const { count } = await supabase.from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', t.id);
  if (count === 0) console.log(`saved:0 → user:${t.user_id.slice(0,8)} test:${t.id.slice(0,8)}`);
}

// Errores globales recientes (sin filtrar usuario)
const { data: globalErrors } = await supabase.from('validation_error_logs')
  .select('endpoint, error_type, user_id, created_at')
  .gte('created_at', 'FECHA_RECIENTE')
  .order('created_at', { ascending: false })
  .limit(100);
```

Si afecta a 1 usuario → problema específico (auth, dispositivo, red).
Si afecta a muchos → bug de código o infraestructura.

## Paso 7: Leer el código fuente involucrado

Con los datos recopilados, TÚ (Claude) decides QUÉ código leer. No hay una lista fija — depende de lo que hayas encontrado. Ejemplos:

- Errores en `answerSaveQueue` → leer `utils/answerSaveQueue.ts`
- Sesión no creada → leer `components/TestLayout.tsx` (creación de sesión)
- Error de API → leer el endpoint en `app/api/`
- Contenido incorrecto → leer fetchers (`lib/testFetchers.ts`, `lib/lawFetchers.ts`)
- UI rota → leer componente mencionado en la URL del feedback

**Buscar en el código:**
- Catches vacíos (`catch {}`, `catch { return null }`) → puntos de fallo silencioso
- Returns sin logging → datos que se pierden sin traza
- Condiciones que asumen datos que pueden ser null

## Paso 8: Diagnosticar y proponer fix

Con datos + código, identificar:
1. **Causa raíz** (no el síntoma)
2. **Por qué no había logging** (si es fallo silencioso)
3. **Alcance** (1 usuario vs global)
4. **Fix** con código concreto
5. **Verificación** — cómo confirmar que el fix funciona

## Paso 9: Proponer borrador de respuesta al usuario

**Esperar a tener diagnóstico antes de redactar.** Proponer borrador al admin — NUNCA enviar directamente.

El borrador debe incluir:
- Qué pasó (sin tecnicismos)
- Si está arreglado o pendiente
- Qué debe hacer el usuario (recargar, esperar, nada)

### 📝 FORMATO OBLIGATORIO del mensaje (plantilla fija — no improvisar)

Todo mensaje al usuario sigue SIEMPRE esta estructura:

```
Hola <Nombre>,

Gracias por escribirnos.

<cuerpo: 1-3 párrafos, separados por línea en blanco>

<cierre cordial: "Cualquier otra duda, aquí estamos." / "Para lo que necesites, aquí estamos.">

Un saludo
Equipo de Vence
```

Reglas estrictas (de feedback de Manuel):
- **Saludo:** `Hola <Nombre>,` — coma **DESPUÉS del nombre**, NO entre "Hola" y el nombre (es "Hola Rosa," no "Hola, Rosa" ni "Hola Rosa" sin coma). Es lo profesional. El `<Nombre>` es el **nombre real** del perfil (`user_profiles.full_name`, primer nombre) — NUNCA inventarlo ni derivarlo del email. Si el `full_name` está vacío o parece falso/derivado del email → usar `Hola,` a secas.
- **ENSEÑAR a navegar, NO pegar links** (feedback Manuel 15/07): cuando el usuario no encuentra algo en la app (una oposición, una opción, una sección), NO le pegues una URL — **explícale la RUTA en la interfaz** ("arriba, en el botón de **Test**, pulsa **Cambiar oposición**"; "en tu **perfil**…"; "en el menú de arriba…"). Enseñar a moverse por la app > darle un enlace (aprende a hacerlo solo y no depende del link). Cita los nombres EXACTOS de los botones tal como aparecen en la UI.
- **Antes de dirigir a un usuario a una oposición/sección, VERIFÍCALA a fondo** — que no esté a medias (Paso 1 epígrafe + Paso 2 scope hechos, temas sin 0 preguntas). No prometas "está completa y al día" si no lo has comprobado (caso Esther/Ayuntamiento Madrid 15/07: activa pero con 2 temas vacíos + sin verificar → NO se le dijo "completa").
- **Segunda línea SIEMPRE:** `Gracias por escribirnos.`
- **Firma SIEMPRE:** dos líneas → `Un saludo` + `Equipo de Vence`.
- **Sin guiones largos** (— o -) como conector; usar comas, dos puntos o frases separadas.
- **Sin disculpas excesivas** ("perdón", "sentimos las molestias" repetido). Directo y cordial.
- Verbo: "mejorar", nunca "pulir".
- Párrafos separados por línea en blanco (el email respeta los saltos).
- Un solo email por usuario aunque tenga varios feedbacks a la vez (agrupar; no enviar correos seguidos). Cerrar los demás en silencio (sin `message`).

## Paso 10: Enviar la respuesta y cerrar — `/api/v2/feedback/respond` (post-14/04/2026)

> 🆕 **Post-refactor (14/04/2026):** usa el endpoint `POST /api/v2/feedback/respond`. Antes había que hacer 5 pasos manuales (INSERT message + INSERT notification_log + fetch send-support-email + cerrar conversation + cerrar feedback). Ahora **una sola llamada atómica** encapsula todo con garantías transaccionales.

### Casos de uso

**A) Responder al usuario con mensaje (flujo normal)**

```js
// Obtener Bearer token admin (generateLink + verifyOtp, igual que impugnaciones)
const { data: link } = await adminClient.auth.admin.generateLink({
  type: 'magiclink', email: 'manueltrader@gmail.com',
});
const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: ses } = await anonClient.auth.verifyOtp({
  token_hash: link.properties.hashed_token, type: 'magiclink',
});
const accessToken = ses.session.access_token;

const res = await fetch('https://www.vence.es/api/v2/feedback/respond', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    feedbackId,
    adminUserId,                   // 2fc60bc8-... (Manuel)
    message: borradorAprobado,
    finalStatus: 'resolved',       // default si hay mensaje
  }),
});

const result = await res.json();
// result = {
//   success: true, feedbackId, conversationId, messageId,
//   bellSent: boolean, bellSkipReason: 'external_contact' | 'send_bell_false_flag' | null,
//   emailSent: boolean, emailId: string | null, emailError: string | null,
//   emailSkipReason: 'empty_message' | 'no_user_email' | 'user_actively_browsing' | 'user_preferences' | 'send_email_false_flag' | null,
//   finalStatus: 'resolved' | 'dismissed' | null,
// }
```

**B) Cierre silencioso (spam, duplicado, prueba propia)**

```js
await fetch('https://www.vence.es/api/v2/feedback/respond', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({
    feedbackId,
    adminUserId,
    finalStatus: 'dismissed',
    // Sin message → no INSERT, no campana, no email. Solo UPDATE de status.
  }),
});
```

**C) Responder sin enviar email** (ej. usuario sin email, o notificación interna)

```js
body: JSON.stringify({
  feedbackId, adminUserId,
  message: borrador,
  sendEmail: false,    // solo campana
})
```

**D) Responder sin campana** (poco habitual)

```js
body: JSON.stringify({
  feedbackId, adminUserId,
  message: borrador,
  sendBell: false,     // solo email
})
```

### Notas

- **El endpoint requiere Bearer token admin.** Validado contra email whitelist (mismo patrón que `/api/v2/dispute/resolve`).
- **Atomicidad:** INSERT de message + campana + UPDATE de estado van en una transacción Drizzle. Si falla cualquiera, se revierte todo (excepto el email, que va después de la TX para no rollback por fallos de Resend).
- **Skip automático de campana** para contactos externos (`user_id = null`) — no se puede insertar por FK constraint. `bellSkipReason` = `'external_contact'`.
- **Skip automático de email** si:
  - No hay mensaje (`empty_message`).
  - El usuario no tiene email (`no_user_email`).
  - El usuario tiene sesión activa <5s (`user_actively_browsing`) — verá la campana.
  - El usuario optó por no recibir emails de soporte (`user_preferences`).
  - El caller pasó `sendEmail: false` (`send_email_false_flag`).
- **Fallos de email NO revierten el feedback:** la respuesta incluye `emailError` con el motivo. El feedback queda resuelto y el email puede reintentarse manualmente si hace falta.
- **Contactos externos con email:** el endpoint nuevo skippea automáticamente (emailSkipReason='no_user_email'). Para mandarles email, llamar también a `/api/send-support-email` con el email del payload — ese endpoint sigue vivo para ese caso concreto.

> **⚠️ Gotcha 504/502 de CloudFront (visto 03/07/2026 — José Andrés):** igual que en `/api/v2/dispute/resolve` (impugnaciones §15.7), a veces `/api/v2/feedback/respond` devuelve **HTML de error 504/502** en lugar del JSON porque el proxy corta por timeout **durante `sendEmailV2`**, que va **fuera** de la TX. Cuando pasa: la transacción **ya hizo commit** → el mensaje **sí quedó en `feedback_messages`**, el feedback quedó `resolved`, la conversación cerrada y la campana enviada; **solo falta el email** (0 filas nuevas en `email_events`). Síntoma desde script: `res.json()` peta con "Unexpected token '<'".
>
> **NO reintentes a ciegas.** El workaround de disputas (reabrir + reenviar) **aquí DUPLICA el mensaje**, porque el INSERT en `feedback_messages` ya se aplicó (en disputas se reabre poniendo `admin_response=null`, no hay INSERT que duplicar). **Verifica SIEMPRE en BD** (no en el HTTP): si el mensaje ya está en `feedback_messages`, el usuario **ya puede leer la respuesta en la app + campana** — que es lo que resuelve su queja. El email de aviso es secundario; solo fuérzalo (asumiendo el mensaje duplicado, o vía `/api/send-support-email`) si de verdad hace falta.

### Email threading (post-14/04/2026 — caso Isabel/Galicia)

Cuando un usuario responde por email a un newsletter o aviso de Vence, Resend Inbound captura el reply y lo transforma en un feedback con `type='email'`. Antes de hoy, nuestra respuesta admin se enviaba como **email NUEVO** (asunto genérico, sin In-Reply-To), por lo que en Gmail aparecía como conversación distinta a la del usuario.

**Ahora el flujo es automático:**

1. **Webhook inbound (`/api/webhooks/resend-inbound`)** extrae `Message-ID` del email entrante y lo guarda en `user_feedback.referrer`. El asunto original ya se guardaba en `user_feedback.message`.
2. **`/api/send-support-email`** lee `referrer` (Message-ID) y `message` (Subject) del feedback cuando `type='email'` y los pasa a:
   - `sendEmailV2` (usuario registrado): añade headers `In-Reply-To` y `References`, y prefija subject con `Re: ` (sin duplicar si ya está).
   - `sendDirectEmail` (contacto externo): mismo tratamiento.

**Resultado**: la respuesta aparece en el mismo hilo del email original en Gmail/Outlook. Caso Isabel resuelto.

**Si el Message-ID no se pudo capturar** (header ausente en payload y Received API), el reply va como email nuevo — comportamiento anterior, sin regresión.

## Script rápido (todo en uno)

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = 'PONER_USER_ID';
const fecha = 'PONER_FECHA';  // ej: '2026-04-04T00:00:00'

(async () => {
  // 1. Perfil
  const { data: profile } = await supabase.from('user_profiles')
    .select('email, full_name, plan_type, target_oposicion').eq('id', userId).single();
  console.log('Perfil:', JSON.stringify(profile));

  // 2. Tests + saved count
  const { data: tests } = await supabase.from('tests')
    .select('id, score, total_questions, is_completed, created_at, test_type, deploy_version')
    .eq('user_id', userId).gte('created_at', fecha)
    .order('created_at', { ascending: false });
  console.log('\\nTests:', tests?.length);
  for (const t of tests || []) {
    const { count } = await supabase.from('test_questions')
      .select('*', { count: 'exact', head: true }).eq('test_id', t.id);
    console.log(\`  [\${t.created_at?.slice(0,16)}] \${t.test_type} score:\${t.score}/\${t.total_questions} saved:\${count} done:\${t.is_completed} [v:\${t.deploy_version}]\`);
  }

  // 3. Interacciones
  const { count: interactions } = await supabase.from('user_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('event_type', 'test_answer_selected')
    .gte('created_at', fecha);
  console.log('\\nRespuestas (interactions):', interactions);

  // 4. Errores (TODOS, sin filtrar endpoint)
  const { data: errors } = await supabase.from('validation_error_logs')
    .select('created_at, endpoint, error_type, error_message, deploy_version, http_status')
    .eq('user_id', userId).gte('created_at', fecha)
    .order('created_at', { ascending: false });
  console.log('\\nErrores:', errors?.length);
  for (const e of errors || []) {
    console.log(\`  [\${e.created_at?.slice(0,16)}] \${e.endpoint} | \${e.error_type}: \${e.error_message?.slice(0,100)} [v:\${e.deploy_version}] http:\${e.http_status}\`);
  }

  // 5. Daily usage
  const { data: usage } = await supabase.from('daily_question_usage')
    .select('date, questions_used').eq('user_id', userId).gte('date', fecha.slice(0,10));
  console.log('\\nDaily usage:', usage);

  // 6. Impugnaciones
  const { data: disputes } = await supabase.from('question_disputes')
    .select('id, dispute_type, description, status, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  console.log('\\nImpugnaciones:', disputes?.length);
  for (const d of disputes || []) {
    console.log(\`  [\${d.created_at?.slice(0,10)}] \${d.status} - \${d.description?.slice(0,80)}\`);
  }
})();
"
```

## Manuales relacionados

- **Eliminación de cuentas (RGPD):** `docs/maintenance/eliminacion-cuentas.md` — runbook obligatorio para `type='account_deletion'`. Incluye plantilla de `deletion_reason` exhaustivo.
- **Journey detallado:** `docs/procedures/investigar-journey-usuario.md`
- **Impugnaciones:** `docs/maintenance/impugnaciones-claude-code.md` — **NUNCA cerrar sin aprobación explícita.**
- **Chat IA:** `docs/maintenance/revisar-chat-ai.md`
- **Epígrafes vs topic_scope:** `docs/maintenance/verificar-epigrafe-topic-scope.md`
- **OEPs y convocatorias:** `docs/maintenance/oeps-convocatorias-seguimiento.md`
