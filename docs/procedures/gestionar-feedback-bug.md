# Gestionar Feedback de Bug

**Este manual es una METODOLOGÍA DE INVESTIGACIÓN genérica.** No intenta diagnosticar bugs — te enseña DÓNDE buscar datos para que TÚ (Claude) hagas el diagnóstico. Funciona para cualquier tipo de bug: tests no guardados, contenido incorrecto, UI rota, errores de pago, etc.

**Principio: recopilar datos primero, diagnosticar después.** Ejecuta TODOS los pasos antes de sacar conclusiones.

> 🔒 **ORDEN OBLIGATORIO para feedbacks de BUG (decisión Manuel 11/07). NO saltárselo ni responder antes de tiempo:**
> 1. **Diagnosticar el fallo A CIENCIA CIERTA** — no suponer, no "seguramente fue transitorio". Usa la observabilidad que tenemos (`validation_error_logs`, `observable_events`, `user_interactions`/journey, `question_lifecycle_history`, tablas de dominio) y **SIMULA con los datos reales del usuario** (replica su query/endpoint con su `target_oposicion`, su id, su hora). Distingue con evidencia entre las ramas del código (p.ej. error de red vs respuesta vacía → distinta pantalla). Si un dato no se puede recuperar por falta de observabilidad, dilo explícitamente — ese hueco suele ser parte del bug.
> 2. **Proponer a Manuel FIX(es) robustos, profesionales y escalables — sin chapuzas.** Ataca la causa raíz y el modo de fallo de CLASE (no solo el síntoma de ese usuario): p.ej. anti-dead-end + detección (evento de observabilidad) + cerrar el hueco de auditoría. Esperar su elección antes de implementar.
> 3. **Solo entonces, responder al usuario** (borrador + OK, como siempre). La respuesta se apoya en el diagnóstico real, no en conjeturas.
>
> **Caso de referencia (Alfonso, 11/07): "en el apartado de leyes dice que no hay leyes disponibles".** Tentación: "fallo transitorio, recarga". Realidad (simulando con sus datos): la pantalla "Sin leyes disponibles" solo sale con API `success:true` + lista **vacía** (no con 503, que muestra otra pantalla); su oposición actual devuelve 23 leyes, pero su perfil cambió de oposición ese día → a la hora del fallo tenía seleccionada una oposición **sin leyes mapeadas** → callejón sin salida. Fix de clase: fallback a todas las leyes cuando el scope da 0 + evento de detección + auditoría de cambios de `target_oposicion` (el hueco que impidió recuperar su oposición exacta).

> **Caso de referencia (MariSol, Valencia, 28/07/2026) — cuando la UI se contradice, busca la SEGUNDA FUENTE DE VERDAD (y no te fíes de cómo el usuario nombra el fallo):** reportó que *«las bolitas verde/roja del historial salen al revés de vez en cuando»* con tres capturas. Replayeando **sus intentos reales** por la misma función que pinta el panel (`scripts/sim/sim-evolucion-marisol.ts`), las bolitas y el porcentaje coincidían **exactamente** con `test_questions` en los tres casos: **lo que mentía era la cabecera**, no las bolitas — el usuario acierta en QUE algo falla y suele fallar en QUÉ falla. La causa no era un cálculo mal hecho sino que **el mismo recuadro bebía de dos sitios**: las bolitas de la fila guardada (el servidor revalida) y la cabecera del resultado que calcula el cliente. **Regla:** ante una pantalla que se contradice a sí misma, no persigas el síntoma — localiza los dos orígenes y **haz que mande uno solo** (el autoritativo). Y añade un evento para la discrepancia: este bug no dejaba **ningún** rastro (la BD guardaba lo correcto, así que ninguna alerta lo veía) y solo se supo porque una usuaria mandó capturas. Dos trampas que costaron tiempo aquí: culpar al cambio reciente que "cuadraba" (el barajado — se descartó viendo que sus 20 respuestas se sirvieron en orden natural y la clave guardada coincidía con la original en las 20) y dar por buena una hipótesis sin comprobar su detector (el de desincronía **no había emitido un solo evento en 30 días**).
>
> **Caso de referencia (Manuel Querino, Administrativo del Estado, 03/08/2026) — «no carga X»: MIRA LO QUE SIRVE PRODUCCIÓN, y son DOS capas de caché:** escribió *«No carga la página de test»* y su rastro no ayudaba (ninguna petición suya falló con 5xx, sus errores de consola eran los `Failed to fetch` normales de navegar, y su oposición tenía los 45 temas intactos en la BD). Lo que lo resolvió en un minuto fue **pedir la página como la pide él**: `curl` a `/administrativo-estado/test` devolvía la pantalla roja *«Error cargando temas»*, sin un solo tema. El componente atrapaba un fallo de la consulta y devolvía ese aviso… en una página con `revalidate = false`, así que **se horneó como si fuera la página buena** y llevaba así ~17 h. **Dos lecciones operativas:** (1) ante un «no carga / no aparece», compara **lo que la BD dice** con **lo que el HTML servido enseña** antes de bucear en el journey — son cosas distintas y solo la segunda es lo que ve el usuario; (2) al arreglarlo, **hay DOS cachés y la primera no basta**: `revalidatePath` regeneró el origen y **CloudFront siguió sirviendo la copia rota** hasta invalidar el CDN. Distinguirlas cuesta diez segundos: con `?cb=$RANDOM` te contesta el ORIGEN, sin él el CDN (`docs/maintenance/cache-revalidation.md` §CloudFront). Barrer la clase entera también es barato y dice si es de uno o de todos: las 126 oposiciones activas, 1 rota. Prevención por construcción: `lib/calidad/erroresHorneados.cjs` ([T-506]).
>
> ⚠️ **OBLIGATORIO SIEMPRE: analizar el JOURNEY del usuario antes de responder.** Para CUALQUIER feedback (bug, contenido, duda, sugerencia), reconstruye primero su recorrido y su **historial de feedbacks/impugnaciones** (Paso 3) — no te quedes con el texto literal del mensaje. El journey revela lo que el usuario **de verdad** quiere y da el contexto que cambia el diagnóstico.
>
> **Caso de referencia (Isabel B, Aragón, 04/07/2026):** preguntó "¿habéis hecho un inciso de las diferencias de Word/Excel 365 Web vs escritorio?". Leído literal parecía "añadid un extra". Pero su **historial** (había cazado antes que la versión estaba mal —Office 2016 en vez de 365— y había enlazado la nota oficial del IAAP) mostró que su verdadera intención era **verificar que el contenido coincide con la versión exacta que le examinan**. El journey convirtió "sugerencia menor" en "el contenido está en la variante equivocada según el spec oficial". Sin analizar el journey, la respuesta habría sido incorrecta.
>
> **Caso de referencia (Laura García, Murcia, 27/07/2026) — el BOLETÍN NO es el estado ACTUAL del plazo: comprueba la SEDE:** antes de darle a una usuaria dos fechas de plazo, verifiqué las dos contra su boletín (BOE + BORM base 3.2 para la UMU; BOCM Orden 1628/2026 base 4.5 para Madrid) y el cómputo de días hábiles cuadraba: 31/07 y 10/08. **La de Madrid estaba mal:** la Comunidad había **ampliado el plazo hasta el 11/08 "por incidencia técnica"**, y esa ampliación **solo estaba publicada en la sede electrónica** (`sede.comunidad.madrid/oferta-empleo/…`), no en ningún BOCM posterior (barrí los sumarios del 14 al 27/07: nada). Nuestra BD arrastraba el 10/08 del boletín. **Regla: el boletín fija el plazo ORIGINAL; el estado VIGENTE vive en la sede o en el portal de solicitudes.** Verifica los dos antes de dar una fecha a un usuario, y si difieren manda la sede (y corrige la BD + revalida caché `landing` y `oposiciones-catalog`). Los portales de solicitud suelen ser la confirmación más limpia: ConvocUM de la UMU lista cada convocatoria vigente con su `F. Inicio`/`F. Fin` (es JSF, requiere Playwright: `chromium.launch()` + clic en "Acceder" + paginar; con `curl` solo sale el HTML vacío). El BORM además tiene WAF (Radware) en sus endpoints de servicios, aunque el PDF del anuncio (`/services/anuncio/ano/AAAA/numero/NNNN/pdf`) sí baja con `curl`.
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

**Orden fijado por Manuel (30/07/2026). Se atiende en este orden, no por antigüedad:**

1. **BUGS — lo primero y urgente.** Algo no funciona: se cierra la app, no se guarda una respuesta, no puede pagar, no encuentra lo suyo. Cada minuto que pasa es alguien intentándolo otra vez y fallando.
2. **FREE que pregunta ANTES de comprar (pre-venta).** Va por delante del resto de premium, y no es por generosidad: **esa persona no se fía todavía y está midiendo dos cosas a la vez — si el producto es serio y cuánto tardamos en contestar.** La respuesta es la prueba. Quien ya es premium tiene margen para esperar unas horas; quien está decidiendo, no: se va a otra parte y no vuelve. Señales de pre-venta: pregunta si tenemos su oposición, si el temario está completo, cuánto cuesta, si hay supuestos, si sirve para el examen de tal fecha.
3. **RESTO DE PREMIUM.** Dudas, contenido, sugerencias, temario. Dentro de este grupo, **primero lo que huele a dinero**: cobro que no reconoce, suscripción que no se renovó, petición de reembolso (→ `docs/procedures/reembolsos.md`).
4. **SUGERENCIAS QUE EXIGEN CONSTRUIR UNA HERRAMIENTA — las penúltimas (Manuel, 30/07/2026).** Una mejora que hay que desarrollar es lo más caro de la cola, y además **se responde DESPUÉS de construirla, no antes**: primero se hace, se despliega, y entonces se le escribe pidiéndole que lo pruebe. Contestar «buena idea, lo apuntamos» y dejarlo ahí gasta el turno de esa persona sin darle nada; contestar cuando ya está vivo convierte su sugerencia en algo que puede usar el mismo día. Si al mirarla se ve que **no** se va a construir, entonces sí se responde en su sitio normal (grupo premium) diciendo qué se va a hacer y qué no. *Caso origen: una embajadora pidió ver qué aportación generó cada euro de su cartera; se construyó primero y se le respondió con la función ya desplegada.*
5. **`account_deletion` — SIEMPRE lo ÚLTIMO.** Ya decidió irse: no hay retención que salvar y la eliminación tiene ventana RGPD (no es instantánea), así que se procesa cuando no queda nada con valor de retención por atender. (Tiene runbook propio obligatorio, ver abajo — pero NO se prioriza sobre lo demás.)

> **No depende de que te acuerdes:** el orden vive en `lib/feedback/prioridadCola.js` (núcleo puro, con tests) y lo aplica `scripts/vigia.cjs`, que enseña la cola ya ordenada con su etiqueta (`BUG`, `PREVENTA`, `PREMIUM`, `BAJA`). Si cambia el criterio, se cambia ahí y el manual lo cita — no dos verdades.

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

> **⚠️ Solo usuarios PREMIUM son candidatos a recompensa.** El Programa de Embajadores (bug/opinión/referido) es **exclusivo de premium** — son los embajadores y solo ellos tienen panel y saldo. Un usuario **free NO recibe recompensa** aunque su bug/opinión sea válido (mira `user_profiles.plan_type` antes de plantearte crearla). El endpoint `/api/admin/rewards` **no** lo comprueba (solo `requireAdmin`), así que la regla la aplicas TÚ. A un free que reporta algo útil: agradécelo y, si procede, úsalo como gancho de conversión (§ Pre-venta), pero sin recompensa. Al crear la recompensa, el usuario recibe **solo el badge del icono 🎁** (bug/ugc **NO envían email** — decisión Manuel 10/07: la recompensa nace de un feedback que ya le respondes por su hilo, así que el email sería redundante). **NUNCA menciones la recompensa en el mensaje al usuario** (decisión Manuel 24/07): queda cutre, y el **badge 🎁 parpadeante ya se la comunica**. Se crea en silencio; el texto de respuesta va solo del bug. Cómo crearla por API (y pagar): **`docs/runbooks/embajadores-recompensas.md`** (§2). Solo para bugs/usabilidad genuinos que nos sirven — NO para impugnaciones de preguntas (esas tienen su propio proceso).

> **⚠️ Una recompensa por ASUNTO, no por mensaje (decisión de Manuel, 30/07/2026).** Si ya se le pagó a alguien por proponer una mejora y después reporta un **bug de esa misma mejora**, **NO se paga otra vez** — aunque el primer mensaje fuera `suggestion` y el segundo `bug`, y aunque sean feedbacks distintos. Caso: Laura Zurdo propuso las preguntas favoritas y el día del estreno reportó dos fallos de esa función; se le agradece y se arregla, pero sin recompensa nueva. (En su caso concreto no constaba recompensa por la propuesta: la decisión fue de criterio, no un anti-duplicado.) La comprobación es por **historial del usuario**, no por `feedback_id`: el endpoint no lo valida, así que lo aplicas tú antes de crearla.

> **⚠️ Opinión (UGC 5 €) ≠ compartir el enlace de referido (referido 10 €). ABRE la captura antes de crear la recompensa UGC** (aprendizaje 11/07, caso Mari). Si la "aportación" es una **reseña nombrando Vence SIN su enlace de referido** → UGC legítima (5 €). Si es soltar su **enlace `vence.es/r/<code>`** con un pitch → eso es Programa de **Referidos** (ya cobra 10 €/venta + 2 €/registro activo) → **NO crees UGC** (sería doble pago + incentivo a spamear el link); respóndele explicando la diferencia. Detalle: `docs/runbooks/embajadores-recompensas.md` §2.
>
> **Excepción — DEFENDER la marca sí es UGC, aunque haya enlace (decisión de Manuel, 27/07/2026, caso Laura García):** la regla de arriba existe para no pagar dos veces por spamear el link, no para castigar a quien da la cara por nosotros. Laura compartió su enlace en un grupo nacional de opositores, el enlace aterrizaba entonces en `/embajadores` ("Trae opositores activos 2 €"), otro miembro lo capturó llamándolo *"Creepy"* y ella **respondió defendiendo la plataforma** delante de 32 personas. Manuel mantuvo la UGC de 5 €: *"nos defendió y se lo merece"*. **Criterio:** si la captura muestra únicamente el link + pitch → Referidos, sin UGC; si además hay **defensa pública genuina de Vence** (o se come una reacción hostil por recomendarnos), la UGC se mantiene. Ante la duda, **abre la captura y pregunta a Manuel** antes de crear o anular nada: una recompensa ya comunicada al usuario no se retira sin su orden explícita.

Si el feedback es de **facturación**, el estado real está en **Stripe**, no en la BD: `user_subscriptions`/`payment_settlements` pueden estar desincronizadas (p.ej. la BD marca la suscripción activa hasta fin de periodo cuando en Stripe ya está cerrada, o no refleja un cargo ya reembolsado). Verifica SIEMPRE facturas + charges + refunds en Stripe (`docs/procedures/reembolsos.md` §0 y TRAMPA #5) antes de prometer o diagnosticar nada.

## Feedback de TEMARIO / epígrafes / scope — ORDEN OBLIGATORIO (Paso 1 → Paso 2 → usuario)

Cuando el usuario pregunta algo sobre **qué entra en un tema** (epígrafes, artículos de más o de menos, "esto no entra", "falta esto", dudas de temario), **NO respondas directo a lo que dice**. Lee el runbook **`docs/runbooks/verificar-epigrafes-scope.md`** y sigue este orden — la BD es **trackeable**, mírala antes de trabajar:

1. **¿Está hecha la clonación del epígrafe oficial (Paso 1)?** Mira `topic_epigrafe_verification` de esa oposición. Si NO está (`never_sourced`), **hazla primero**: clonar el temario LITERAL oficial (convocatoria / DOGV / BOE) → `topics.epigrafe`, confirmarlo y registrarlo (`verified_literal` + `source_url` del PDF exacto). Es **bloqueante**: sin epígrafe de fiar no se puede auditar el scope.
2. **¿Está auditada toda la oposición (Paso 2)?** Mira `topic_scope_verification`. Si NO, **audita la oposición ENTERA** (workflow `verify-scope-oposicion` → `verify:scope plan` → `apply`), no solo el tema del usuario — de paso caza otros errores.
3. **Revisa lo que dice el usuario** — SIEMPRE al final, ya sobre base firme.
4. **Si has TOCADO `topic_scope`** (cambiado `article_numbers` de algún tema al corregir), **revalida cache al terminar**: invalidar los tags `temario` + `test-counts` (y `teoria` si cambia lo visible en la página de teoría), o `node scripts/purge-all-cache.js` si el cambio es masivo. Si no, el temario/teoría se sigue viendo con el estado viejo cacheado aunque la BD ya esté bien. El tag `'questions'` NO basta: solo cubre respuesta/explicación de la pregunta, no el scope. Ver `docs/maintenance/cache-revalidation.md`.

**Atajo:** si la BD ya dice que la oposición está auditada (Paso 1 `verified_literal` + Paso 2 `verified_correct`, frescos), **NO repitas la auditoría** — ve directo a revisar el punto concreto del usuario contra el scope/epígrafe ya verificados.

> **🔄 REGLA CAMBIADA (decisión de Manuel, 28/07/2026) — el scope EVIDENTE sí se recompensa.**
> Antes decía: *"temario/epígrafes/scope es contenido, no un fallo funcional de la app → NO lleva recompensa"*.
> **Ya no.** Cuando el usuario señala un defecto de temario/scope y **tiene razón de forma evidente**
> (se comprueba contra el epígrafe oficial y encaja), **lleva recompensa de bug (3 €)**. El motivo lo dijo
> Manuel así: *"nos permite mejorar la plataforma"*. Esta gente nos está haciendo la auditoría de scope
> que ningún detector hace, y pagarla sale barato.
>
> **Las dos condiciones, que siguen mandando:**
> 1. **Solo PREMIUM comprometidos.** Un `free` no cobra aunque acierte, y **a quien se está dando de baja
>    tampoco** (decisión de Manuel, 28/07: *"a un usuario que se van no"*). Ver [[feedback-recompensa-solo-usuarios-de-pago]].
> 2. **Que sea EVIDENTE.** Si la queja es discutible, o resulta que el scope estaba bien, se le responde
>    con el porqué y no se paga. Se recompensa el acierto comprobado, no el aviso.
>
> Sigue haciendo falta **orden explícita** para crearla ([[feedback-recompensa-requiere-orden-explicita]]) y
> **nunca se menciona en el mensaje** ([[feedback-recompensa-no-mencionar-en-mensaje]]).
>
> **Contexto de por qué cambió:** la práctica ya iba por delante de la regla escrita. A la usuaria Luisa
> (`auxiliar_administrativo_sms`, 52 avisos, casi todos certeros) se le habían aprobado **dos** recompensas
> de bug por avisos de scope puros (Tema 8 el 17/07, Tema 10 el 22/07) mientras el manual decía que eso no
> se pagaba. El 28/07, al acertar de nuevo con el Decreto 53/1989 —donde además le habíamos dicho que no y
> ella tenía razón—, Manuel ordenó el vale y cambiar la regla. La única anulada de sus recompensas lo fue
> por *"creada sin orden explícita"*, **no** por ser de scope.

> **Ejemplo real (subalterno_gva, 13/07):** Sonia preguntó por 2 temas; al no estar hecho el Paso 1, se clonó el epígrafe oficial (15/15 `verified_literal` contra el PDF primario del DOGV) y se auditó el scope entero (15/15 `verified_correct`) ANTES de contestarle — lo que de paso destapó 3 errores reales que ella no había visto (Ley 4/2023 sobre-scope, Ley 9/2003 ausente, Decreto 42/2019 vacío). Lo que ella señalaba ya estaba bien.

## Feedback de PRE-VENTA / conversión (usuario free preguntando por premium) — PERSONALIZAR

Cuando un usuario **free** pregunta qué incluye el pago, si merece la pena, qué diferencia hay con el gratis, o dice que "está pensando en pagar" (suele venir como `other`/`suggestion`), **NO es una consulta de soporte: es una oportunidad de conversión.** No respondas genérico — **personaliza a esa persona y sus circunstancias** (aprendizaje 07/07/2026, caso Sonia González, preventa Subalterno GVA):

1. **Investiga su ciudad** para proponerle **oposiciones cruzadas** de su zona: `SELECT ciudad, registration_ip, target_oposicion FROM user_profiles WHERE id=…` (si `ciudad` es null, geolocaliza la `registration_ip`). Ej.: Valencia + Subalterno GVA → sugerir Auxiliar Administrativo de la Generalitat Valenciana (C2, un nivel por encima) y del Ayuntamiento de Valencia.
2. **Gancho estrella (lo MÁS valorado por los alumnos): estadísticas compartidas.** Buena parte del temario es **común** entre oposiciones (Constitución, Ley 39/2015, Ley 40/2015, Estatuto/Consell autonómicos, Función Pública, igualdad…). Con premium, **al practicar ese contenido común avanzas a la vez en varias oposiciones con las mismas estadísticas**: estudias una vez y progresas en varias convocatorias, multiplicando oportunidades. Enfatízalo.
3. **Beneficios premium a nombrar** (`app/premium/page.tsx` es la fuente): preguntas/tests **ilimitados** (vs 25/día free), **descarga/impresión del temario en PDF** para estudiar en papel, **lectura por voz del temario** (TTS — véndelo para estudiar en paseos/transporte público/tareas), **chat con IA ilimitado**, **acceso a todas las oposiciones a la vez**, **cursos de informática**.

> **Pregunta RECURRENTE — "¿puedo descargar / imprimir el temario para estudiarlo en papel?"** (p.ej. Antonio Rivera 22/07). Respuesta canónica: **la descarga/impresión del temario en PDF es PREMIUM** (botón por tema; gate `isPremiumPlan`, ruta `/api/temario/[oposicion]/[topic]/pdf`; el free ve el botón con 👑 + modal). **El plan FREE puede: ver el temario ONLINE y practicar tests con tope de 25 preguntas/día — NO descargar.** No prometas la descarga a un free; dile que es premium y ofrécesela como conversión. (GOTCHA: temas gigantes de ofimática dan 413 al descargar hasta que despliegue T-086.)
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

## ❓ Preguntas frecuentes — respuestas canónicas (línea oficial, no improvisar)

Preguntas que se repiten y ya tienen respuesta acordada con Manuel. **Usa esta línea**: improvisar aquí acaba prometiendo cosas que no existen o negando cosas que sí.

### «¿Tenéis supuestos prácticos / casos prácticos?» (línea fijada 29/07/2026, caso Sergio, TAG Ayto. Madrid)

**Respuesta canónica:** **Vence es una plataforma de TESTS.** Los supuestos prácticos existen **solo en algunas oposiciones concretas**, no en todas, y no se prometen para la suya. **Están en los planes**: primero terminamos de construir **las oposiciones mayoritarias de España** y después se generan los supuestos para todas ellas. **Sin cifras** de catálogo en el mensaje al usuario (decisión Manuel 29/07: no damos números).

**Dónde están de verdad los supuestos (verifícalo antes de nombrar ninguno):**
- Las preguntas con `exam_case_id` están **excluidas por código de TODOS los flujos normales**: test aleatorio, por tema, por ley, falladas, simulacro y configurador (`lib/api/random-test/queries.ts`, `random-test-data`, `topic-data`, `user-failed-questions`, `simulacro`, `filtered-questions` — todas con `isNull(questions.examCaseId)`).
- La **única** vía es la parte `supuesto` dentro de **Exámenes Oficiales** (`lib/api/official-exams/queries.ts`, filtro `parte === 'supuesto'`). Ruta en la UI: hub `/{oposicion}/test` → **«📋 Exámenes Oficiales»** → tarjeta de la convocatoria → fila de la parte (su texto cambia por oposición: «Supuesto práctico», «Segunda prueba (supuestos prácticos)», «Segundo ejercicio»…).
- Declarada solo en 4 oposiciones (29/07): `tramitacion-procesal`, `auxiliar-administrativo-ayuntamiento-zaragoza`, `administrativo-carm`, `administrativo-seguridad-social`. **No dirijas a un usuario a un supuesto sin comprobar que su oposición lo tiene.**

**No hagas esto:** ofrecerle practicar las leyes del supuesto como sucedáneo. Se propuso en el borrador de Sergio y Manuel lo quitó: el usuario pregunta si tenemos supuestos, y la respuesta es qué tenemos y qué haremos, no un consejo de estudio que no ha pedido.

### «Mi suscripción no se ha renovado / yo no la he cancelado» (línea fijada 29/07/2026, caso Rocío)

**Antes de responder, MIRA STRIPE.** Puede ser una baja del usuario… o una cancelación NUESTRA. En julio de 2026, al vaciar la cuenta antigua de Stripe, se pusieron ~200 suscripciones en «no renovar» (`cancel_at_period_end`) y se fueron apagando solas. A esas personas **les habíamos enviado antes** el correo de recordatorio diciendo *"tu suscripción se renovará automáticamente el DD/MM por X €"* y *"si deseas seguir, no tienes que hacer nada"*. Hicieron lo que les pedimos: nada. Y se quedaron sin premium.

**Cómo distinguirlo (2 minutos):**
```js
// Cuenta según `user_profiles.payment_account`; si no aparece, prueba en ambas.
const subs = await s.subscriptions.list({ customer: cus.id, status: 'all' })
// canceled_at + cancellation_details.reason:
//   'cancellation_requested' en una fecha de operación masiva → LA CANCELAMOS NOSOTROS
//   baja del usuario → coincide con su actividad en el portal
```
Mira también las facturas: si las últimas están `paid` y no hay ninguna posterior, no fue impago.

**Respuesta canónica cuando la baja fue nuestra** (aprobada 29/07): reconocer que **tiene razón y que no fue cosa suya**, decir que **su plan antiguo ya no forma parte de los planes actuales** (sin entrar en el detalle interno del cambio de cuenta de cobro) y ofrecer los planes vigentes destacando el **€/mes**, que es donde se ve la ventaja:

| Plan | Precio | €/mes |
|---|---|---|
| Mensual | 29 € | 29,00 |
| Trimestral | 39 € | 13,00 |
| Semestral | 69 € | 11,50 |
| Anual | 99 € | 8,25 |

> ⚠️ **Precios corregidos el 29/07/2026 — y el aviso de abajo se incumplió el mismo día.** Esta tabla decía 35 € y 59 €, y con esas cifras se le respondió a Rocío. Son de un juego de precios ANTIGUO: en la cuenta Nila conviven **dos juegos activos** (20/35/59 y 29/39/69/99) y la web sirve el NUEVO. Le dimos dos de tres precios equivocados a la persona a la que ya le habíamos cancelado la suscripción sin avisar.
>
> **Cómo verificarlo bien (no basta con leer `.env.local`, que traía los ids viejos):** los `NEXT_PUBLIC_STRIPE_PRICE_*` se hornean en el bundle, así que la verdad está en lo que sirve la web:
> ```bash
> # ids REALES que usa producción hoy
> curl -s https://www.vence.es/premium > /tmp/p.html
> for u in $(grep -oE '/_next/static/chunks/[A-Za-z0-9._~-]+\.js' /tmp/p.html | sort -u); do
>   curl -s "https://www.vence.es$u" | grep -oE 'price_1T[A-Za-z0-9]+'; done | sort -u
> # y luego stripe.prices.retrieve(<id>) en la cuenta NILA para el importe
> ```
> Contraste adicional gratis: la **última sesión de checkout** del propio usuario (`checkout.sessions.list`) dice el precio EXACTO que vio en pantalla.

**NO ofrecer de entrada mantenerle el precio antiguo** (decisión Manuel 29/07). Los planes largos ya salen **más baratos** que el mensual con descuento que tenían (18 €), así que no hace falta; y mantener un precio a medida sienta precedente con el resto de afectados. Si alguien insiste en seguir mes a mes, el cupón `loyalty_10` (10 %) está clonado en la cuenta nueva y reproduce ese precio exacto sobre el mensual de 20 €, pero eso se decide caso a caso.

> 🛠️ **Si se decide mantenerle el precio (o darle uno concreto), el cómo está en `docs/runbooks/oferta-precio-personalizada.md`.** Una orden: `node scripts/stripe/precio-heredado.cjs crear <email> <importe> --intervalo <…> --motivo "…" --feedback <uuid>`. Crea el precio en Stripe, registra la oferta y ella la contrata en **vence.es/premium/personal** (dentro de Vence, no un enlace de pago suelto). **Avísale de que entre con la sesión iniciada**: sin ella la página solo ofrece iniciar sesión, y el 29/07 eso costó un *«no puedo acceder a la oferta»* y tres horas de espera.

**Aprovecha para el cross-sell de su zona** (§ PRE-VENTA): temario común entre oposiciones + estadísticas independientes por oposición. Nombra **solo oposiciones `is_active = true`**, comprobadas en BD.

**¿Y a los que NO han escrito?** **Nada** (decisión Manuel, 29/07/2026): se atiende a quien reclama, no se contacta proactivamente a los afectados. En la ventana del 18-22/07 hubo **21 suscripciones canceladas** en esa operación y **17 con el periodo ya vencido**; solo una escribió. Avisar al resto sería destapar a gente que no ha notado nada.

> ⚠️ **Punto ciego conocido:** el recordatorio de renovación **no deja rastro consultable** (no hay tabla, ni columna, ni fila en `email_events` con ese usuario). En el caso Rocío, la única prueba de que se había enviado fue **la captura que mandó ella**. Si necesitas saber a quién se avisó, hoy no se puede: cuéntalo como hueco de observabilidad, no des por hecho que no se envió.

### «¿Puedo descargar / imprimir el temario para estudiarlo en papel?»

Ver la respuesta canónica en § Feedback de PRE-VENTA (arriba): **la descarga/impresión en PDF es PREMIUM**; el free ve el temario online y practica con el tope diario, pero no descarga.

> 👁️ **Vigía (29/07/2026) — `node scripts/vigia.cjs feedback` / `impugnaciones`.** Avisa de lo que
> ENTRA en vez de mirar la cola cada rato: con ~7 feedbacks al día, revisar a intervalos fijos son
> 72 comprobaciones diarias en vacío y aun así llegas tarde. Imprime una línea por novedad
> (`CLASE|id|tipo|email|plan|texto`) y distingue dos cosas que **no se atienden igual**:
> **NUEVO** (sin responder) y **REPLICA** (te han contestado). La réplica es la que importa: cuando
> respondemos, el hilo se cierra como resuelto y el mensaje siguiente de la persona **desaparece de
> toda lista de pendientes**. El 29/07 eso dejó a una usuaria tres horas esperando mientras
> abandonaba cuatro pagos. En impugnaciones el equivalente es la **apelación** (con la guarda de no
> confundirla con la conformidad automática *«Usuario de acuerdo con la respuesta del administrador»*).
> Con `--loop [--cada 600]` no repite lo ya avisado: es lo que se lanza en segundo plano al empezar
> una sesión de cola. **Vive solo mientras dure la sesión** — convertirlo en alerta permanente es
> [T-288].

## Paso 0: ¿YA está respondido / resuelto? (mirar ANTES de redactar nada)

> 🛠️ **OBLIGATORIO — empieza SIEMPRE por el dossier, no improvises la consulta:**
> ```bash
> node scripts/impugnaciones/revisar-feedback.cjs <feedback_id> --sid <tu-id-de-sesión>
> ```
> Vuelca la **CONVERSACIÓN ENTERA** (por `conversation_id`, el link fiable) + un **veredicto de Paso 0**: si el último mensaje es del USUARIO tras haberle respondido, dice *"NO re-envíes lo anterior, responde a su ÚLTIMO mensaje"*. Coge (claim) el feedback y avisa si otra sesión lo tiene.
>
> **POR QUÉ ES OBLIGATORIO (incidente 21/07 — se DUPLICÓ la respuesta a una usuaria):** al mirar solo el 1er mensaje (o al consultar `feedback_messages` con una columna que no existe y tragarse el error) parece que "no hay respuesta" → se re-envía y le llega el mensaje DOS veces. **Regla dura: lee la conversación ENTERA y responde al ÚLTIMO mensaje del usuario, nunca al primero a ciegas.** El script no se despista aunque tú sí.

Un feedback con `status='pending'` **NO significa que esté sin atender** — puede estar respondido y resuelto pero sin cerrar. Antes de redactar, busca la respuesta en la tabla correcta:

- **`user_feedback.admin_response`** (campo de texto): aquí está la respuesta del admin. **Mirar SIEMPRE este campo primero** — la respuesta NO siempre se guarda en `feedback_messages`.
- **`feedback_messages`** (si hay hilo): columnas `is_admin` + `sender_id` + `message` — **NO `sender_type`** (consultar con una columna inexistente puede devolver vacío sin error y hacerte creer que no hay respuesta). El `conversation_id` del mensaje puede no coincidir con el de `feedback_conversations`; cruza por `user_id`/`feedback_id`, no asumas el link.
- Si ya está respondido y atendido, **no mandes otra respuesta**: cierra con `finalStatus:'resolved'` sin `message` (cierre silencioso, §Paso 10 caso B).

> **⚠️ Síntoma "No puedo leer vuestras respuestas" (visto 03/07/2026 — José Andrés, CARM):** el usuario abre un 2º feedback quejándose de que no ve nuestra respuesta. **Causa típica:** la respuesta al feedback anterior se guardó **solo en `user_feedback.admin_response`** (vía legacy) y **nunca se insertó en `feedback_messages`**, así que su conversación en la app aparece **vacía** (0 mensajes) — el chat lee de `feedback_messages`, no de `admin_response`. El email de aviso (`soporte_respuesta`) puede haberse enviado, pero si el usuario no lo abre (`email_events.open_count = 0`) se queda a ciegas. **Fix:** reponer esa respuesta llamando a `/api/v2/feedback/respond` (que sí inserta en `feedback_messages`), reconociendo al usuario que tenía razón. No basta con tener el texto en `admin_response`.

### 🧵 REGLA DURA: cada hilo se responde en SU hilo (decisión de Manuel, 30/07/2026)

**Un hilo de feedback es una conversación con su pregunta y su cierre.** Se responde
**dentro del hilo donde se preguntó**, y **solo a lo que se preguntó ahí**. Nunca se
contesta en un hilo algo que la persona planteó en otro, ni se juntan dos asuntos en un
mensaje porque «es la misma persona».

Para quien escribe, mezclarlo es un lío: recibe la respuesta donde no preguntó, el hilo que
sí abrió se queda mudo, y ninguno de los dos se puede cerrar con claridad. Nosotros vemos
un usuario; la persona ve sus conversaciones abiertas, cada una esperando su respuesta.

**Antes de redactar, mira TODOS sus feedbacks abiertos** (no solo el que estás atendiendo):

```sql
SELECT id, type, status, created_at, left(replace(message, chr(10), ' '), 90) AS msg
  FROM user_feedback
 WHERE user_id = '<uuid>'
 ORDER BY created_at;
```

Y decide con eso:

- **Varios hilos, varios asuntos** → un borrador por hilo, cada uno respondiendo a lo suyo.
  Si un asunto aparece de pasada en otro hilo, se contesta igualmente **en el hilo propio**.
- **Varios hilos, el MISMO asunto** (duplicados: la persona pulsó dos veces o reescribió a
  los minutos) → se responde al **primero** y el resto se cierra en **silencio**
  (`finalStatus:'resolved'` sin `message`, §Paso 10 caso B). Dos avisos con el mismo texto
  parecen un fallo nuestro.
- **Un solo hilo con varias preguntas dentro** → ahí sí van juntas, en el orden en que las
  hizo.

> **Caso origen (Chema, 29-30/07/2026):** abrió tres feedbacks — uno pidiendo el Parque
> Móvil del Estado y **dos idénticos**, con tres minutos de diferencia, preguntando por los
> temas incompletos de Policía Municipal de Madrid. Como en el hilo del Parque Móvil también
> mencionó de pasada la Policía Municipal, el borrador inicial contestaba las dos cosas ahí
> y dejaba los otros dos hilos sin tocar, sin responder desde el día anterior. Se separó
> antes de enviar: un mensaje por asunto, en su hilo, y el duplicado cerrado en silencio.

> **⚠️ Un hilo SIN mensajes nuestros dentro NO significa que esté sin responder (T-512,
> 03/08/2026).** Quien pregunta lo mismo en tres hilos recibe la respuesta en uno y deja los
> otros dos cerrados y mudos: el panel «🧵 OTROS HILOS» del dossier los daba por vivos y
> mandaba escribir a gente cuyo hilo se cerró hace mes y medio (**94 falsos de 99** medidos
> ese día, 29 personas). Lo decide ahora el estado de la conversación —**`waiting_admin`, la
> misma señal que cuenta el panel de admin**— y no «¿hay mensajes nuestros?».
> **Antes de escribirle por un hilo viejo, mira si se le contestó en OTRO hilo suyo**
> (`feedback_messages` de la persona por fechas, no solo del hilo que tienes abierto): una
> respuesta que llega semanas tarde es peor que ninguna. Núcleo puro
> `scripts/lib/hilos-abiertos.cjs`, con el caso real como regresión.

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

> **🚫 NO desvelar más problemas de los que el usuario ha visto** (decisión de Manuel, 28/07/2026).
> Nada de *"con tu aviso lo hemos arreglado también en otras oposiciones"*, *"afectaba a N temas"*,
> *"resulta que pasaba en más sitios"*. Se confirma lo suyo, se dice que está arreglado y se agradece.
> **Punto.**
>
> **Por qué:** en sus palabras, *"parecemos tontos desvelando más problemas de los que nos comunican"*.
> El usuario reportó UN caso; si le contestas que has encontrado otros veinte, lo que lee no es
> *"qué bien que avisé"* sino *"esto está lleno de fallos"*. La intención de agradecerle el aviso
> acaba siendo publicidad de nuestros propios defectos. **El alcance real va al commit, a la ficha y
> a este manual**, que es donde sirve de algo.
>
> **Caso que lo fijó** (Laura García, nº de tema en el PDF): el fallo afectaba a 619 temas de 21
> oposiciones, y el borrador aprobado no menciona ni uno:
> *"Tienes razón: es el tema 7 de específica, no el 14. El fallo estaba en el PDF descargable, que
> numeraba mal la portada. Ya está corregido, así que descárgatelo otra vez y lo verás bien.
> Gracias por avisar."*
>
> **Misma vena que la regla de no decir que el contenido lo hace una IA:** hay cosas ciertas que no
> se le cuentan al usuario porque le restan confianza sin aportarle nada.
>
> **Y no te pases de explicaciones.** Si el fallo estaba en un sitio distinto del que él miraba, basta
> con nombrarlo en una frase; no hace falta contarle cómo lo guardamos por dentro. Un borrador largo
> explicando nuestras tripas transmite lo mismo que enumerar los otros fallos.

### Formato y firma (convención de la casa)

El `message` que se envía es **texto plano** (el chat/email respetan los `\n`), así que **redacta con saltos de línea reales**, no en un párrafo-ladrillo:
- **Saludo** en su propia línea (`¡Hola <Nombre>! 👋`), con el nombre de pila (`user_profiles.full_name`) si lo hay.
- **Un párrafo corto por idea**, separados por línea en blanco (`\n\n`). Listas con `- ` cuando respondes varios puntos.
- **Enlaces oficiales en su propia línea** para que se puedan tocar (ej. la convocatoria del DOGV/BOE cuando afirmas algo sobre el examen: da la fuente y que lo verifique el propio usuario).
- **Cierre + firma** SIEMPRE, con esta forma (dos líneas, precedidas de línea en blanco):
  ```
  Un saludo,
  El equipo de Vence
  ```
  Variantes válidas del cierre: «Muchas gracias,» / «Para cualquier asunto estamos a tu disposición.» + la firma `El equipo de Vence`. **Nunca firmar como una persona** ni decir que el contenido lo hace una IA (memoria [[feedback-nunca-decir-ia]]).
- Incisos entre paréntesis, no con guiones (memoria [[feedback-parentesis-no-guiones]]).

### 📝 FORMATO OBLIGATORIO del mensaje (plantilla fija — no improvisar)

Todo mensaje al usuario sigue SIEMPRE esta estructura:

```
Hola <Nombre>,

Gracias por escribirnos.        ← SOLO en el primer mensaje que recibe (ver regla abajo)

<cuerpo: 1-3 párrafos, separados por línea en blanco>

<cierre cordial: "Cualquier otra duda, aquí estamos." / "Para lo que necesites, aquí estamos.">

Un saludo
Equipo de Vence
```

Reglas estrictas (de feedback de Manuel):
- **Saludo:** `Hola <Nombre>,` — coma **DESPUÉS del nombre**, NO entre "Hola" y el nombre (es "Hola Rosa," no "Hola, Rosa" ni "Hola Rosa" sin coma). Es lo profesional. El `<Nombre>` es el **nombre real** del perfil (`user_profiles.full_name`, primer nombre) — NUNCA inventarlo ni derivarlo del email. Si el `full_name` está vacío o parece falso/derivado del email → usar `Hola,` a secas.
- **ENSEÑAR a navegar, NO pegar links** (feedback Manuel 15/07): cuando el usuario no encuentra algo en la app (una oposición, una opción, una sección), NO le pegues una URL — **explícale la RUTA en la interfaz** ("arriba, en el botón de **Test**, pulsa **Cambiar oposición**"; "en tu **perfil**…"; "en el menú de arriba…"). Enseñar a moverse por la app > darle un enlace (aprende a hacerlo solo y no depende del link). Cita los nombres EXACTOS de los botones tal como aparecen en la UI.
- **Antes de dirigir a un usuario a una oposición/sección, VERIFÍCALA a fondo** — que no esté a medias (Paso 1 epígrafe + Paso 2 scope hechos, temas sin 0 preguntas). No prometas "está completa y al día" si no lo has comprobado (caso Esther/Ayuntamiento Madrid 15/07: activa pero con 2 temas vacíos + sin verificar → NO se le dijo "completa").
- **Segunda línea, SOLO en el PRIMER mensaje que le mandas:** `Gracias por escribirnos.`
  **En las respuestas siguientes del mismo hilo, o en otro hilo de la misma persona el mismo
  día, se QUITA** (decisión de Manuel, 30/07/2026): repetir la misma fórmula de cortesía en
  mensajes seguidos suena a plantilla automática, y quien recibe tres mensajes que empiezan
  igual deja de leerlos como escritos por alguien. Se entra directo al asunto después del
  saludo. Lo mismo vale para cualquier muletilla que ya le hayas dicho antes.
- **Firma SIEMPRE:** dos líneas → `Un saludo` + `Equipo de Vence`.
- **Sin guiones largos** (— o -) como conector; usar comas, dos puntos o frases separadas.
- **Sin disculpas excesivas** ("perdón", "sentimos las molestias" repetido). Directo y cordial.
- **🚫 PROHIBIDO «gracias por la paciencia» / «sentimos el ir y venir» y variantes (Manuel, 30/07/2026).** Se escribe **«Muchas gracias.»** y punto. Disculparse por un fallo propio delante de quien está decidiendo si pagarnos **nos hace parecer débiles**, y encima subraya lo que salió mal en vez de que ya está resuelto. El fallo se arregla, se cuenta lo justo y se sigue.
- **No afirmes el arreglo con rotundidad: escribe «ya debería estar resuelto» + «si puedes probar ahora»** (misma decisión, 30/07). Tú no estás delante de su pantalla: puede tener la página cacheada, otra sesión, otro dispositivo. Decir «ya está arreglado» y que le vuelva a fallar cuesta mucho más que haberlo dicho con un condicional — pasó tres veces seguidas con la misma usuaria esta semana.
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
