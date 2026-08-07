# Manual: Resolver Impugnaciones con Claude Code

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

## Resumen

Este manual documenta cómo resolver impugnaciones de preguntas usando Claude Code como agente. Es más rápido que el proceso manual y permite verificar artículos directamente en la base de datos.

---

## ▶ Procedimiento operativo — el flujo a seguir

> **Empieza por aquí.** Secuencia canónica para resolver una impugnación. Las secciones §1-§16 son el detalle.

**Reglas que NO se saltan nunca:**
- 🛠️ **OBLIGATORIO usar las 2 herramientas** (`scripts/impugnaciones/`, creadas 15/07 porque Claude se saltaba pasos del manual): **(1)** `node scripts/impugnaciones/revisar-impugnacion.cjs <dispute_id>` genera el **dossier** con los datos + los dos checks pre-rellenados + la checklist de 9 puntos — **empieza SIEMPRE por aquí** al analizar. **(2)** `node scripts/impugnaciones/validar-explicacion.cjs <question_id> <fichero>` es un **guardarraíl que DEBE pasar en verde ANTES de aplicar cualquier explicación**: verifica formato §5.1 (análisis por opción + saltos de línea, no apelotonado), cita literal del blockquote en el artículo vinculado (caza citas inventadas — **la comprueba ENTERA**, ver §5.1.bis), y coherencia clave↔opción marcada CORRECTA. Si falla, **NO se aplica** la explicación hasta arreglarla. El código no se despista aunque Claude sí. **Desde el 27/07 dice además si la explicación será BARAJABLE** (🔀) y da el comando para transcribirla tras aplicarla; si avisa de que NO se podrá, reescríbela con una razón por opción — que es el mismo §5.1 que el manual ya exige.
- 🗺️ **ENFORCEMENT de scope/epígrafe (en el dossier, desde 24/07):** cuando la impugnación va de **temario / epígrafe / scope / "no entra" / "es de otro tema"**, el dossier imprime un **CHECK SCOPE/EPÍGRAFE** con el estado de verificación de la oposición del usuario (Paso 1 epígrafe clonado + Paso 2 scope) y un **aviso BLOQUEANTE 🛑 si el Paso 1 está `never_sourced`** — porque resolver un scope contra un epígrafe sin clonar del oficial es un **falso verde** (caso Sara 24/07: casi se rechaza como "falso positivo" con el scope `verified_correct` pero el epígrafe `never_sourced`). Es la "Regla previa OBLIGATORIA" de `verificar-epigrafes-scope.md`, ahora enforzada por código (módulo `scripts/impugnaciones/lib/scope-enforcement.cjs`, compartido con el dossier de feedback; test `__tests__/impugnaciones/scopeEnforcement.test.js`). **No resuelvas una queja de scope si el dossier saca el 🛑 — haz el Paso 1 primero.**
- 🚪 **QUEJA DE TEMARIO = LEER EL MANUAL DE EPÍGRAFES Y DEJAR SU OPOSICIÓN EN ORDEN, ANTES de analizar (Manuel, 04/08/2026).** Si la impugnación va de temario / epígrafe / scope / «no entra» / «es de otro tema», el orden es: (1) leer `docs/runbooks/verificar-epigrafes-scope.md`; (2) `npm run epigrafe:revision -- <position_type> --pregunta <question_id>` y **dejarlo en verde**; (3) *entonces* analizar la impugnación. **Lo exige `cerrar.ts`**, que no manda el email si los temas que sirven esa pregunta no están verificados (escape `--temario-igualmente "<motivo>"`). Nace de que el 🛑 del dossier salió, se leyó y se siguió igual: pedía clonar los 21 epígrafes de la oposición para contestar a quien preguntaba por un artículo, y un bloqueo imposible se aprende a rodear. Ahora exige **solo los temas que sirven la pregunta** — y desconfía del `verified_correct` sellado fuera del pipeline (**711 temas en 45 oposiciones**, 550 sin Paso 1).
- NUNCA cerrar / rechazar / modificar sin **borrador del mensaje + aprobación explícita** de Manuel.
- 💶 **Cerrar como `resolved` PAGA 1 € automáticamente** (desde 28/07/2026): si la impugnación la escribió un usuario **premium** y el **motivo es de los verificables** (no `explicacion_confusa`/`explicacion_mejorable`/`otro`), el cierre le concede 1 € solo, sin que tú hagas nada — ver §6.bis. Consecuencia operativa: **`resolved` significa "tenía razón", no "le damos la razón para quedar bien"**. Un cierre de cortesía ahora cuesta dinero y ensucia la señal de calidad. Si la impugnación no es válida, es `rejected` (no paga y no penaliza al usuario). Y **NUNCA menciones la recompensa en el mensaje** — el badge 🎁 ya se lo comunica.
- 💶 **UN FALLO O HALLAZGO, UNA RECOMPENSA (Manuel, 30/07/2026).** Cuando varias impugnaciones son **el mismo hallazgo** (la misma pregunta duplicada en varias versiones, el mismo error repetido en preguntas hermanas), **solo la primera cobra el euro**. Las demás se cierran **`resolved` igual** —tenían razón, y rechazarlas le enseña a no volver a avisar justo a quien nos encuentra los fallos— pero pasando **`skipRewardReason`** al endpoint con el porqué (p. ej. *«mismo hallazgo que ce143c99: la misma pregunta duplicada»*). Sin ese parámetro el euro se concede solo. Queda registrado como `dispute_reward_skipped`. La condición está **publicada** en `/recompensas`, así que no es arbitrariedad: se puede citar. Caso origen: tres impugnaciones de `pregunta_repetida` de la misma usuaria, del mismo artículo, que eran cuatro versiones de la misma pregunta.
- 🎁 **CONCEDER el euro A MANO cuando el motivo es `otro`/`explicacion_confusa`/`explicacion_mejorable` (T-388).** El automatismo se retiró el 28/07 para esos tres motivos (61 % de lo que se pagaba, una sola usuaria concentraba 70), pero **lo subjetivo no se queda sin premio**: si el caso concreto SÍ encontró algo verificable —comparado el caso `4d1fa832` (Cristina: acertó que la descripción de la Plataforma de Intermediación no estaba en el art. 28 → mejoró la pregunta) contra `27c60429` (Mario: observación correcta pero la pregunta no tenía defecto → `rejected`)—, concédelo pasando **`grantRewardReason`** al endpoint (o `--con-recompensa "<motivo>"` en `cerrar.ts`) con el porqué. Sigue exigiendo premium, origen humano, tope mensual y anti-duplicado — solo salta la condición del TIPO, no es una puerta trasera al automatismo que se retiró. Queda registrado como `dispute_reward_granted`, con el resultado REAL (puede seguir sin conceder si el usuario no es premium o ya tocó el tope ese mes). **`skipRewardReason` y `grantRewardReason` son incompatibles entre sí** (uno quita, el otro concede; el endpoint rechaza con 400 si llegan los dos). Y la regla de siempre sigue aplicando: **NUNCA menciones la recompensa en el mensaje al usuario**.
- 🔒 **CLAIM antes de analizar (varias sesiones a la vez).** Para que 2-10 sesiones repartan la cola SIN pisarse, **coge** cada item antes de trabajarlo: `node scripts/impugnaciones/cola.cjs next` — coge atómicamente la más antigua libre (`FOR UPDATE SKIP LOCKED`). **No hace falta pasar `--sid`: se identifica sola** por `CLAUDE_CODE_SESSION_ID` (cada sesión de Claude Code trae el suyo). `revisar-impugnacion.cjs <id>` también **la reserva de verdad** al abrir el dossier — desde el 31/07 la condición viaja DENTRO del `UPDATE`, así que **arbitra la base de datos**: si no te la da, es de otra y te lo dice en rojo. Antes decidía en JavaScript y escribía sin condición, de modo que dos sesiones que leían «libre» a la vez la escribían las dos y la segunda pisaba a la primera **en silencio** (pasó con un feedback de un usuario). **Y la reserva ya NO caduca por reloj:** caduca cuando MUERE su sesión (deja de latir), con un suelo de 2 h por debajo del cual no se toca.
  **Y desde el 02/08 la reserva se EXIGE al cerrar, no solo al repartir ([T-474]):** `cerrar.ts` y `cerrar-feedback.ts` **abortan** si no tienes el caso reservado — sea porque lo lleva otra sesión viva o porque no lo cogiste nunca. Hasta ese día los dos comandos que mandan el email y conceden el euro **no miraban `claimed_by` ni una vez**, y se notaba: de 165 impugnaciones cerradas en 14 días **28 (17 %) nunca habían pasado por reserva**, y de 111 feedbacks, **58 (52 %)**. Si sigues el flujo de este manual **no vas a ver la puerta nunca**, porque `revisar-impugnacion.cjs` ya reserva al abrir el dossier; si la ves, es que te saltaste el claim. Se satisface con un comando (`cola.cjs claim <id>`), que además te dirá al instante si otra sesión estaba en ello. Escape con motivo: `--igualmente "<por qué>"`, que queda contado. Así una revisión larga pero VIVA la conserva sin tope de horas, y un ordenador apagado la libera solo. Ver [T-412]. `cola.cjs list` muestra la cola con quién tiene qué. **No analices un item que otra sesión ya está revisando.**
- 🔬 **SI EL FALLO PUEDE SER SISTÉMICO, MÍRALO EN LA BD ANTES DE CERRAR (Manuel, 30/07/2026) — y desde el 04/08 el cierre NO TE DEJA saltártelo ([T-520]).** `cerrar.ts` **aborta** sin `--sistemico`, con taxonomía cerrada de tres salidas y cada una con la prueba que le toca: `--sistemico "aislado: <por qué no puede haber más casos>"` (≥25 caracteres) · `--sistemico "medido: <qué medí> → <N> casos"` (**exige la CIFRA**: sin número, «medido» es una forma elegante de decir que no se midió) · `--sistemico "ficha T-nnn: <qué se abrió>"`. Escape contado: `--sistemico-omitido "<por qué no procede>"`. **Por qué hizo falta la puerta:** la regla llevaba una semana escrita aquí, el dossier IMPRIME las hermanas del artículo y la checklist lleva el 4.bis — tres avisos, y se seguía olvidando; además el dossier se lee al EMPEZAR y el cierre llega media hora después con el mensaje ya aprobado, así que para entonces la pregunta se había quedado por el camino. Lo dijo Manuel el 04/08: *«que no se te olvide, porque si no no avanzamos nada»*. Una impugnación llega por UNA pregunta, pero casi nunca es un caso aislado: quien la escribe solo ha visto la punta. **Antes de responder, mide en la base de datos cuántos casos iguales hay** — mismo artículo, misma ley, mismo patrón — y decide con ese número si basta con arreglar esa pregunta o hace falta ficha aparte. Ejemplo real (30/07): una usuaria impugnó una pregunta repetida sobre los capítulos del Título I; al medir aparecieron **cuatro versiones de esa misma pregunta** y, en ese artículo, **100 pares de enunciados casi idénticos entre 136 preguntas activas**. Arreglar solo la suya habría dejado el problema intacto y a ella impugnando de una en una. *Consulta útil para duplicados: agrupar por `primary_article_id` y comparar enunciados normalizados (solape de palabras ≥70%).*
  - ⚠️ **AL MEDIR, NO NORMALICES LO QUE LA PREGUNTA EXAMINA — o fabricarás defectos que no existen (31/07/2026).** Esta regla te manda medir, y una medición descuidada es peor que no medir: sale un número gordo, te lo crees y escribes una ficha sobre un fenómeno inventado. Pasó el mismo día que se estrenó la regla, comprobando la impugnación `626059c8` (*«la respuesta A y C son idénticas»*, que era falso): dos consultas seguidas dieron **48 preguntas con 8 «irresolubles»** cuando eran **33 y ninguna**. Las dos causas son trampas normales de SQL, no despistes raros:
    1. **`lower()` para comparar opciones.** Hay preguntas cuya respuesta ES la mayúscula: `=MAYUSC("administración")` → `ADMINISTRACIÓN` vs `Administración`, `=NOMPROPIO`, Vi `i` vs `I`, plurales en inglés. Al bajarlo todo a minúsculas esas opciones se vuelven «idénticas» y aparecen 8 preguntas rotas que están perfectas.
    2. **Regex mal escapada al colapsar espacios.** Un `\s+` escrito dentro de un `node -e` con comillas dobles llega a Postgres como `s+`, así que `regexp_replace` **borra las eses**: `wardrobes` y `wardrobess` pasan a ser la misma cadena. Otros 8 fantasmas.
    - **Regla práctica:** normaliza **solo el espacio en blanco** (`trim` + colapso), nunca mayúsculas ni tildes, y **haz la comparación en JS desde un fichero `.cjs`**, no con `node -e` — el escapado de `\s` a través de bash + template literal es donde se rompe. Y antes de creerte un número, **abre tres casos y léelos**: los 8 fantasmas se caían al primer vistazo.
  - 🧰 **Para «pregunta repetida» NO improvises la consulta: `node scripts/calidad/duplicados-exactos.cjs`** (31/07/2026). Simula por defecto y cubre los **dos** bancos: `--banco legislativas` (jubila con `retired_duplicate`, TERMINAL) y `--banco psicotecnicas` (desactiva con `is_active=false`, reversible). Y `--parafraseadas` saca la clase que el corte exacto **no puede ver**: mismas opciones con el enunciado redactado distinto — la que se le escapó entera a la deduplicación de mayo y la que destapó la impugnación `b6787619`. El criterio vive en `lib/calidad/duplicados.js` (con tests) y tiene dos guardas que no son opcionales: la banda se decide por el **TEXTO** de la respuesta correcta y nunca por `correct_option` (las copias vienen barajadas), y en psicotécnicas la clave del grupo lleva la huella de `image_url`+`content_data` (sin ella, 95 de 98 grupos son falsos positivos). Colas abiertas: [T-408] (legislativas) y [T-410] (psicotécnicas).
  - 🔑 **Y `--misma-clave` saca la clase que los otros DOS cortes no pueden ver** (04/08/2026, [T-519]): mismo artículo y **misma respuesta correcta** con **otros distractores**. Los dos cortes anteriores exigen que las OPCIONES coincidan, así que sobre este caso dan **cero**; y es justo como se acumulan las paráfrasis generadas en tandas distintas. Lo destapó la impugnación `9e0d7418`: la usuaria pidió un test del **art. 2 de la LGSS**, le salieron 10 preguntas y **ocho examinaban la misma frase** (el artículo servía 13 activas y 11 preguntaban lo mismo). **Al medir NO te quedes en «misma respuesta»**: un artículo con una enumeración (LOFCS art. 5) tiene N preguntas que piden subhechos DISTINTOS y comparten la etiqueta como respuesta — en crudo son 41.063 parejas, casi todas legítimas. El corte cruza la respuesta con lo que **pide el enunciado** (palabras de contenido, sin la cita legal), calibrado con anclas leídas a mano: falsos positivos conocidos en 0,12-0,27, ciertos de 0,48 arriba. **Lista y no escribe**, como sus hermanos, y ordena por exposición (`--limite N`): el 80% del daño cabe en los 326 primeros grupos. La **prevención** va en el punto de escritura: `analizarDuplicados` compara ya la clave contra las vivas, no solo intra-lote — antes una pregunta nueva con otro enunciado y la misma respuesta entraba sin un aviso.
  - 🧬 **Al adjudicar una gemela, la explicación te dice cuál es la mala — no lo decidas por criterio propio.** Estos clones nacen de **cambiar un detalle del enunciado dejándoles la clave y la explicación de la variante original**, así que la errónea se delata sola: una preguntaba por `>` y su explicación describía `<`; otra decía *«el detalle está en que NO aparece entre comillas»* cuando su propio enunciado sí las llevaba. **Lee las dos explicaciones antes de elegir**: normalmente una contradice a su enunciado. Y **fíate del recuerdo del impugnante aunque él dude**: el 31/07 Laura Zurdo escribió *«creo recordar… y la respuesta correcta era 64.000»* y había cuatro versiones de esa pregunta, dos servidas a la vez con claves opuestas. Verificado así en 5 grupos / 12 preguntas ([T-408]).
- 📮 **SI YA PREGUNTASTE POR ESTE CASO EN EL EMBUDO, EL CIERRE MIRA LA RESPUESTA (T-609, 06/08/2026).** Incidente: cuatro preguntas en el embudo pidiendo OK para el borrador de rechazo de Manolo (arts. 108/110/112/114 CE); Manuel respondió **«NO ENVIAR TAL CUAL»** a las 06:16 — y a las 06:24-26 OTRA sesión cerró tres **sin mirarlo** y mandó el texto vetado. `cerrar.ts` ahora busca en `session_questions` (por `question`/`context`/`draft_target`, no solo por columna estructurada — el id de la impugnación vivía en la PROSA de la pregunta) si hay una respuesta que VETA el envío, y **aborta** con el texto delante si la encuentra. Escape propio: `--embudo-igualmente "<motivo>"` (si el veto ya no aplica y se ha hablado por otro canal). **No es un sustituto de leer el embudo tú mismo antes de cerrar** — es la red que salta si no lo hiciste.
  - ⚠️ **Y el mismo incidente destapó que `--igualmente` (la puerta de RESERVA) se saltaba TAMBIÉN el claim VIVO de otra sesión**, no solo «nadie la tiene» — así que el mismo escape que dejó pasar el correo vetado además pisó a la sesión `colas-06ago` que tenía las cuatro impugnaciones reservadas. **Arreglado:** un claim vivo de otra sesión ya no admite `--igualmente` — se resuelve hablando con ella, no saltándola (ver `lib/impugnaciones/puertaCierre.cjs`).
- **UNA POR UNA.** Resolver cada impugnación de forma **individual y completa** (§2): su propio análisis, su propio borrador, su propia aprobación y su propio email. **NUNCA agrupar** varias impugnaciones del mismo usuario en un solo mensaje/email, aunque compartan causa raíz o sea el mismo usuario. El análisis de denominador común (§7.5) sirve para **entender** el fallo, no para **fusionar** la respuesta. No presentar análisis de varias a la vez: terminar una (analizar → borrador → OK → cerrar) antes de empezar la siguiente.
- SIEMPRE obtener el **nombre real** del usuario antes de redactar (§11). Nombre claramente ficticio → "Hola," sin nombre.
- Cerrar SIEMPRE vía endpoint `/api/v2/dispute/resolve` — nunca UPDATE directo (§6, §15).
- 🚪 **El cierre EXIGE que la explicación esté adaptada al formato estructurado (desde 29/07/2026).**
  `/api/v2/dispute/resolve` **rechaza** un cierre en `resolved` de una impugnación legislativa si la
  pregunta sigue sin `explanation_data`. No es un aviso: devuelve error y no cierra. Escríbela con
  `scripts/aplicar-explicacion.ts … --apply` y vuelve a cerrar. Escape legítimo (jubilar la pregunta,
  duplicada que se desactiva) → repetir la llamada con `skipShuffleReason: "<por qué>"`, que queda
  registrado como `dispute_shuffle_gate_skipped`. Núcleo puro: `lib/api/v2/dispute/shuffleReadiness.ts`.
  **Por qué se cerró así:** el manual pedía «evaluar SIEMPRE la explicación», y las tres piezas del
  flujo solo AVISABAN (el dossier imprime el check, `validar-explicacion.cjs` dice literalmente «no
  bloquea», y el endpoint no miraba nada). Medido el 29/07: de 8 impugnaciones resueltas ese día, 1 se
  cerró dejando la pregunta sin adaptar, y las 4 legislativas pendientes apuntaban a preguntas sin
  estructura. La puerta exige estar ADAPTADA (tener estructura), **no** que `shuffle_safety` sea
  `safe`: hay preguntas legítimamente no barajables y confundirlo volvería la puerta un estorbo.
- ⚠️ **`validar-explicacion.cjs` solo entiende el formato de TEXTO antiguo.** Ante una explicación ya
  estructurada devuelve ❌ («no empieza con "La respuesta correcta es…"»), que es un falso negativo.
  Para el formato nuevo, la comprobación equivalente es el **dry-run de `aplicar-explicacion.ts`**,
  que renderiza con el mismo render que usa el serve.
- 🔗 **TODO ENLACE QUE MANDES SE ABRE ANTES Y SE COMPRUEBA QUE DICE LO QUE TÚ DICES (Manuel, 01/08/2026).**
  Vale para cualquier mensaje, no solo para los rechazos: BOE, boletín autonómico, Microsoft Support.
  **No basta con que la URL responda 200** — el fallo caro es el enlace que abre **otra cosa**:
  el ancla del BOE **no es `#a<nº de artículo>` en todos los textos** (Ley 39/2015 → `#a95` ✅;
  Código Civil → `#art3`, mientras que `#a3` **existe y lleva a «Artículo 301 a 324. (Derogados)»**).
  Así no da 404 ni se nota al escribir: el opositor pincha, lee un artículo que no tiene nada que ver,
  y la respuesta que iba a convencerle prueba lo contrario. **Tabla de anclas comprobadas + el comando
  de verificación (30 s, y de paso confirma la cita literal): §7.3.quater punto 2.**
- ⚠️ **Listar/consultar SIEMPRE contra RDS (`pg` + `DATABASE_URL`), NUNCA con `@supabase/supabase-js`.** Desde el cutover 04/07 la BD viva es **AWS RDS**; el cliente `@supabase/supabase-js` (`NEXT_PUBLIC_SUPABASE_URL`, sea ANON o SERVICE_ROLE) apunta al **Supabase CONGELADO** y devuelve datos desactualizados — muestra como `pending` disputes que en RDS ya están `resolved` (incidente 17/07: `supabase-js` dio 1 pendiente cuando RDS tenía 6; una dispute "pending" en el backup llevaba resuelta desde el 05/07). **Fíate del dossier `revisar-impugnacion.cjs`** (lee RDS). Ver aviso CLAUDE.md → "CUTOVER A RDS".

**Pasos:**

1. **Listar** las pendientes — tablas `question_disputes` Y `psychometric_question_disputes`, estados `pending` + `appealed` (§1, §7.0).

2. **Analizar a fondo** (§2): enunciado, opciones, respuesta marcada, explicación, artículo vinculado, `ai_verification_results`. Tabla por opción con su fundamento legal.

3. **Clasificar el tipo** — decide la rama:
   - **Informática** (Word/Excel/Access/Outlook/Windows/Internet) → la fuente es el ARTÍCULO; verifícalo y, si hace falta, corrígelo contra Microsoft Support (§5.1.1, §5.1.2, §5.1.3, §7.6). NO parchear solo la explicación. **Comprueba SIEMPRE que el artículo vinculado responde LITERALMENTE a la pregunta** (que el atajo/función concreto que se pregunta aparece tal cual en el contenido del artículo, §5.1.2); si el artículo no lo recoge, re-vincula al artículo correcto — igual que en preguntas legislativas.
   - **`tema_incorrecto`** → es un problema de `topic_scope`, no de la pregunta (§7.2).
   - **Supuesto práctico huérfano** (cita "el supuesto" pero no se ve) → `exam_case_id` NULL (§7.4.ter).
   - **Mismo usuario con 3+ impugnaciones** → buscar el denominador común; suele ser un fallo sistémico (§7.5).
   - **Estructural / metadatos de la ley** → vincular al "Art. 0" (§7.1.1).

4. **Diagnóstico** (§2.6): ¿respuesta correcta? ¿artículo responde literalmente? ¿explicación didáctica? ¿impugnación válida o falso positivo?

5. **Corregir** lo que esté mal (§5): no oficial + mejorable = se mejora aunque la queja sea parcial (§7.3); oficial = no se toca enunciado/opciones. Re-vincular artículo exige explicación nueva coherente. Si la pregunta estaba oculta, transicionar lifecycle (§5.2).

6. **Redactar el mensaje** (§6): conciso, aireado, reconocer si el usuario tenía razón, firmar "Equipo de Vence". Mostrar el borrador y ESPERAR aprobación.
   - ⚖️ **Si la vas a RECHAZAR, la respuesta tiene que convencer, no solo informar (§7.3.quater):** cita literal del artículo, nombre de la ley, **el enlace a la fuente que prueba lo que él discute — pero SOLO si la cita no lo prueba ya** (si con la frase literal la duda queda resuelta, el enlace sobra; y cuando sí hace falta: el BOE si discute lo que dice la norma; **sus bases** si discute si entra en el temario; ninguno si discute cómo está construida la pregunta — ver §7.3.quater punto 2) y —lo que de verdad resuelve la duda— **por qué él vio otra cosa** (una redacción anterior, un apunte sin actualizar, un plazo parecido de otra norma). Un «no procede» a secas hace que la próxima vez no nos avise de un fallo real.

> **NUNCA afirmes categóricamente que está resuelto (Manuel, 30/07/2026).** Escribe **«no debería
> volver a salirte»**, no «dejará de salirte»; **«ya debería estar resuelto»**, no «ya está
> arreglado». No estás delante de su pantalla: puede tener la página cacheada, otra sesión, otro
> dispositivo, o el arreglo puede no cubrir su caso exacto. Prometer en absoluto y que le vuelva a
> fallar cuesta mucho más que el condicional. Y **nada de «gracias por la paciencia»** ni disculpas
> por el fallo: **«Muchas gracias.»** y punto (disculparse ante quien decide si te paga te hace
> parecer débil, y subraya lo que salió mal en vez de que ya está resuelto).

> **No detalles NUESTROS fallos.** Reconoce el fallo y di que está corregido; ahí se acaba. Nada de
> cuánto tiempo llevaba, a cuánta gente afectó ni métricas internas. Corrección de Manuel (28/07,
> impugnación `dc236653`): un borrador decía *"este fallo llevaba meses y lo sufría mucha gente sin
> decírnoslo"* → **"no des tantos detalles de nuestros fallos, parecemos tontos o incompetentes"**.
> El usuario quiere saber que se le ha escuchado y que ya funciona: una frase para el
> reconocimiento y otra para lo que cambia para él.
>
> **⚠️ Y NO CUENTA COMO EXCEPCIÓN QUE EL DETALLE SEA «LA EXPLICACIÓN DE POR QUÉ PASÓ» (Manuel, 05/08/2026).**
> Reincidencia con la regla escrita justo aquí arriba, y por eso se anota: en la impugnación
> `8055a01c` (Lucia, UC3M) el borrador decía *«estaba redactada con los términos de la ley anterior,
> que ya está derogada, y hablaba de "ficheros" y de "la LOPDCP" en vez de los términos que usa la
> ley vigente»*. Veredicto de Manuel: **«muy mal, si dices eso quedamos como incompetentes»**.
>
> **Por qué es el mismo error aunque no lo parezca:** eso NO es información para ella, es el
> diagnóstico interno de cómo nació la pregunta. Al opositor le da igual de qué ley copiamos mal;
> lo que necesita saber es que acertó y qué le entra. Contárselo solo añade la imagen de que
> servimos preguntas escritas desde una norma derogada.
>
> **La trampa concreta:** el detalle se cuela disfrazado de §7.3.quater («explícale por qué él vio
> otra cosa»). No es lo mismo. Esa regla es para cuando la impugnación **NO procede** y hay que
> convencerle de que la pregunta está bien —ahí el «por qué viste otra cosa» está de su lado, es su
> redacción, su fuente, su versión—. Cuando la impugnación **SÍ procede**, el «por qué» es nuestro
> defecto, y ese no se cuenta.
>
> **El mensaje que se envió, entero, como referencia de longitud:**
> *«Hola Lucia, tenías razón. Ya está corregida: la pregunta se corresponde ahora con el artículo 2.3
> de la Ley Orgánica 3/2018, que entra en tu tema 6. Muchas gracias. Equipo de Vence»* — reconocer,
> decir lo único que le sirve (qué entra y dónde), y parar.

7. **Cerrar** vía `/api/v2/dispute/resolve` (`resolved` / `rejected`) — comprobar `emailSent` y `bellSent` en la respuesta.

8. **Continuar** con la siguiente sin preguntar "¿seguimos?" hasta terminarlas todas.

---

## 0.bis ⚖️ ALEGACIONES: qué son y por qué no las veías (arreglado 28/07/2026)

Un usuario cuya impugnación se cierra puede **alegar** desde la app. Hasta el 28/07 eso funcionaba
a medias y en silencio:

| Pieza | Qué hacía | Estado |
|---|---|---|
| CHECK de `question_disputes.status` | Admitía solo `pending`, `reviewing`, `resolved`, `rejected` | ❌ **`appealed` era imposible**: 0 filas en 1.887 |
| `/api/v2/disputes/appeal` | `SET status='appealed'` | ❌ fallaba SIEMPRE contra el CHECK |
| `/api/dispute` PATCH (el que usa la app) | `SET status='pending'` + guarda `appeal_text` | ⚠️ funcionaba, pero la alegación volvía a la cola **disfrazada de impugnación nueva** |
| Panel `/admin/impugnaciones` | Pinta el texto solo `if (status === 'appealed')` | ❌ no lo mostró jamás |

**Por qué importa para ti:** una alegación que entra como `pending` no se distingue de una queja
nueva. Quien la coge no ve que ya se le respondió, la analiza de cero y al cerrarla **le manda al
usuario un segundo correo con lo mismo**. Estuvo a punto de pasar el 28/07.

**Cómo está ahora:** migración `20260728_dispute_status_appealed.sql` abre el dominio, el camino v1
escribe `appealed`, y `cola.cjs list` las muestra con ese estado. Recuperadas las **3 alegaciones
reales que se habían quedado sin respuesta** (una esperaba desde el 21/03). Guardarraíl para que no
vuelva a divergir: `__tests__/guardrails/disputeStatusEnDominioDeLaBD.test.ts` compara lo que el
código escribe con lo que la BD admite.

**Al trabajar una `appealed`:** lee primero tu respuesta anterior (`admin_response`) y el texto de
la alegación (`appeal_text`). No es una impugnación nueva: es una segunda vuelta sobre algo que ya
contestaste, y el usuario merece que se le note que lo has leído.

> ⚠️ **IGNORA el «🛑 PASO 0 — YA RESPONDIDA → NO re-respondas» cuando el estado es `appealed`**
> (defecto conocido, [T-402]). Ese aviso caza el desync del 504 (respuesta emailada, estado sin
> voltear) mirando si hay `admin_response`… y en una apelación **siempre la hay**: es justo la
> respuesta que la persona está replicando. Salta, por tanto, en el 100 % de las réplicas y te
> manda cerrarla en silencio. Una réplica **se contesta** por el flujo normal (`cerrar.ts` →
> `/resolve`, que manda el email nuevo). El aviso solo es de verdad cuando el estado es `pending`.
> Y el `appeal_text` **no sale en el dossier**: sácalo de `question_disputes` antes de analizar.

> ⚠️ **Si la impugnación es PSICOTÉCNICA, `cerrar.ts` necesita `--psicotecnica`, y si se te olvida
> el endpoint responde `HTTP 404: «Impugnacion no encontrada»`** (31/07/2026). Ese mensaje se lee
> como *«ese id no existe / ya no está pendiente»* y manda a comprobar la cola, cuando lo único que
> pasa es que se buscó en la tabla equivocada: sin el flag, el cuerpo va con
> `questionType: 'legislative'` y `question_disputes` no tiene esa fila. Las psicotécnicas viven en
> `psychometric_question_disputes` — la cola las marca `[psychometric]`, así que ahí es donde se
> mira antes de dar por perdida la impugnación.
>
> 💡 **`cerrar.ts` necesita `AUTH_SECRET`** (no está en `.env.local`). El script te imprime el
> comando; en una línea:
> `AUTH_SECRET="$(aws --profile vence --region eu-west-2 ssm get-parameter --name /vence-frontend/AUTH_SECRET --with-decryption --query Parameter.Value --output text)" npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts <id> --estado resolved|rejected --mensaje <fichero> --aplicar`

## 1. Ver Impugnaciones Pendientes

```
mira a ver si hay impugnaciones abiertas
```

> ⚠️ **Consulta la BD VIVA (RDS), no el Supabase congelado** (ver regla dura arriba y CLAUDE.md → "CUTOVER A RDS"). `@supabase/supabase-js` da datos desactualizados. Usa `pg` con `DATABASE_URL`:

```javascript
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const leg = await sql`
  SELECT id, question_id, user_id, dispute_type, description, status, created_at
  FROM question_disputes
  WHERE status IN ('pending','appealed')
  ORDER BY created_at`;              // ascending = la más antigua primero (la "primera" a resolver)
const psy = await sql`
  SELECT id, question_id, user_id, dispute_type, description, status, created_at
  FROM psychometric_question_disputes
  WHERE status IN ('pending','appealed')
  ORDER BY created_at`;
```

**Resultado:** Lista de impugnaciones pendientes y con alegación (ambas requieren atención).

> 💡 **Antes de empezar cada impugnación de la cola, revalida su `status` en RDS**: en sesiones paralelas otra sesión puede haberla cerrado entre medias (incidente 17/07: 2 disputes de la cola se cerraron en otra sesión mientras se trabajaba). No la des por abierta sin comprobar.

### 1.bis Reparto entre sesiones (claim) — `cola.cjs`

> 🧩 El diseño completo del reparto entre sesiones (por qué la reserva caduca cuando muere su
> sesión y no por reloj, y el resto del andamiaje) está en
> [`../runbooks/sistema-sesiones-paralelas.md`](../runbooks/sistema-sesiones-paralelas.md).

Para que **2-10 sesiones** trabajen la cola a la vez sin analizar la misma impugnación (incidente 17/07), cada sesión **coge** items con `scripts/impugnaciones/cola.cjs` (lee/escribe RDS). El claim es atómico (`FOR UPDATE SKIP LOCKED`): dos sesiones nunca reciben la misma fila.

```bash
# Ver la cola (impugnaciones legislativas + psicotécnicas + feedback) con quién tiene qué:
node scripts/impugnaciones/cola.cjs list

# Coger la siguiente impugnación libre (o feedback con --queue feedback):
node scripts/impugnaciones/cola.cjs next                                  # sid automático (CLAUDE_CODE_SESSION_ID)
node scripts/impugnaciones/cola.cjs next --sid <id> --queue feedback

node scripts/impugnaciones/cola.cjs mine --sid <id>                        # tus claims activos
node scripts/impugnaciones/cola.cjs release <dispute_id> --sid <id>        # soltar sin cerrar
```

- **Claim = protege el ANÁLISIS *y*, desde T-474, el CIERRE.** El cierre saca la fila del pool sola, y además **exige tenerla reservada** (`lib/impugnaciones/puertaCierre.cjs`): cerrar sin reservar es lo que **provoca** la colisión, porque mientras la trabajabas la cola le estaba ofreciendo ese mismo caso a las demás sesiones. El backstop 409 sigue estando por debajo, para el caso de que dos coincidan igualmente.
- **`cola.cjs list` dice ahora POR QUÉ una reserva está o no libre** (`🔒 sesion-0 — lleva 3.0 h pero su sesión sigue viva (latido hace 1 min)`). Antes pintaba con un reloj propio de 2 h mientras el claim decidía por señal de vida, así que una fila que llevaba una sesión VIVA salía como «claim viejo (libre)» y la siguiente sesión se ponía con ella. Comprobable: `npm run sim:cola-reserva`.
- 👤 **Una sesión = un usuario entero.** `cola.cjs next` coge la impugnación más antigua libre **y además todas las demás pendientes del MISMO usuario** (respetando las que ya tenga otra sesión). Es a propósito: la misma sesión que ya reunió el journey/oposición de ese usuario resuelve **todas** las suyas → más contexto, mejor diagnóstico y detección del fallo sistémico (§7.5). **Ojo:** coger el cluster es solo para el reparto; se sigue respondiendo **UNA POR UNA** (su propio borrador, su propia aprobación, su propio email — nunca un email agrupado).
- **Auto-libera a las 2h** (una sesión que muere no bloquea la cola para siempre). No hay cron ni "renew".
- El id de sesión se coge solo de `CLAUDE_CODE_SESSION_ID` (o del `.session-id` que escribe `crear-worktree.sh`, o `--sid` explícito). Se guarda en `claimed_by`. **No hay que teclear nada.**
- Alternativa integrada: `revisar-impugnacion.cjs <id> --sid <id>` coge la impugnación al generar el dossier y avisa si otra sesión ya la tiene fresca.
- Diseño y sizing (2-10 sesiones; el límite real es tu aprobación, no la BD): migración `supabase/migrations/20260717_dispute_feedback_claim.sql`.

## 2. Analizar una Impugnación a Fondo

```
analiza la impugnación [número] a fondo
```

Claude debe obtener y verificar **todos** estos elementos:

### 2.1 Datos de la pregunta
- Texto completo de la pregunta
- Opciones A, B, C, D
- Respuesta marcada como correcta (índice 0-3)
- Explicación didáctica actual

### 2.2 Artículo vinculado
- `primary_article_id` → Artículo principal
- Ley a la que pertenece (short_name)
- Contenido completo del artículo
- **Nota:** Solo se puede vincular UN artículo principal

### 2.3 Verificación de cada opción
Crear una tabla analizando cada opción:

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. X dice... | ✅/❌ |
| B | Art. Y dice... | ✅/❌ |
| C | Art. Z dice... | ✅/❌ |
| D | ... | ✅/❌ |

### 2.4 Preguntas clave a responder
1. **¿La respuesta marcada es correcta?** - Verificar contra el artículo
2. **¿El artículo vinculado es el correcto?** - ¿Responde la pregunta literalmente? Aplica igual a preguntas legislativas y a preguntas de informática (el temario de informática ya tiene artículos reales — ver §5.1.2)
3. **¿La explicación es didáctica?** - ¿Explica POR QUÉ cada opción es correcta/incorrecta?
4. **¿La explicación solo transcribe?** - Si solo copia el artículo sin explicar, hay que mejorarla

### 2.5 Verificación AI existente
Consultar `ai_verification_results`:
- `answer_ok`: ¿La respuesta es correcta?
- `explanation_ok`: ¿La explicación es correcta?
- `article_ok`: ¿El artículo vinculado es correcto?
- `ai_model`: Qué modelo verificó
- `explanation`: Análisis del modelo

### 2.6 Diagnóstico final
Crear tabla resumen:

| Aspecto | Estado | Acción |
|---------|--------|--------|
| Respuesta correcta | ✅/❌ | Corregir si es necesario |
| Explicación | ✅/⚠️/❌ | Mejorar si no es didáctica |
| Artículo vinculado | ✅/❌ | Cambiar si es incorrecto |
| Impugnación | Válida/Falso positivo | Resolver/Rechazar |

## 3. Buscar el Artículo Correcto

Si la explicación es incorrecta o falta el artículo:

```
busca en nuestra BD el artículo que habla de [tema de la pregunta]
```

Claude buscará en la tabla `articles` por contenido relevante.

**Ejemplo:**
```
busca el artículo 16 de la Ley 39/2015
```

## 4. Diagnosticar Por Qué Falló la Verificación

Antes de corregir, es importante entender **por qué** la pregunta tiene errores:

```
¿esta pregunta fue verificada? muéstrame su estado de verificación
```

Claude consultará:

### 4.1 Estado de la pregunta

> 🆕 **Post-03/05/2026 (lifecycle):** la fuente de verdad de visibilidad es `lifecycle_state`. `is_active` es `GENERATED ALWAYS AS (lifecycle_state IN ('approved','tech_approved'))` — no se puede actualizar directo. Las columnas `verification_status`, `topic_review_status` y `verified_at` siguen existiendo para compatibilidad pero **no controlan visibilidad**.

```javascript
supabase
  .from('questions')
  .select('lifecycle_state, is_active, verified_at, verification_status, topic_review_status')
  .eq('id', questionId);
```

> ⚠️ La relación pregunta↔tema **no** está en una columna `topic_id` de `questions` (no existe esa columna). Si te hace falta el tema, hay que mirar la(s) tabla(s) de unión correspondientes (`question_topics` y `topics`) — fuera del scope de la mayoría de impugnaciones.

Estados lifecycle posibles: `draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`. Solo `approved` y `tech_approved` hacen visible la pregunta. Ver `lib/constants/lifecycleReasons.ts` para taxonomía completa.

### 4.2 Resultados de verificación AI
```javascript
supabase
  .from('ai_verification_results')
  .select('*')
  .eq('question_id', questionId);
```

### 4.3 Posibles causas de fallo

| Causa | Síntoma | Solución |
|-------|---------|----------|
| **Artículo incorrecto vinculado** | AI verificó contra artículo equivocado | Vincular artículo correcto |
| **Modelo AI poco preciso** | Usado Haiku en vez de Opus/Sonnet | Re-verificar con mejor modelo |
| **Sin topic_id** | Pregunta no asignada a ningún tema | Asignar al topic correcto |
| **Sin artículo vinculado** | `question_articles` vacío | Buscar y vincular artículo |
| **Verificación no ejecutada** | `verified_at: null` + `lifecycle_state='draft'` | Ejecutar verificación |
| **Pregunta oculta tras corrección** | Lleva en `needs_review`/`needs_human`/`quarantine` y no transicionó a `approved` | Transicionar lifecycle (ver §5.2) |
| **AI dio conclusión errónea** | `answer_ok: false` pero respuesta es correcta | Corregir manualmente |

### 4.4 Ejemplo de diagnóstico real

```
=== RESULTADO AI ===
Article ID: b7186672...        ← Artículo INCORRECTO (prórrogas)
Answer OK: false               ← AI dijo que D era incorrecta
Explanation OK: false          ← Detectó explicación errónea
Model: claude-3-haiku          ← Modelo pequeño, menos preciso

Análisis: "según el artículo, los documentos presentados en forma
diferente se tendrán por presentados..." ← INCORRECTO
```

**Diagnóstico:** El AI verificó contra el artículo equivocado (6.6 prórrogas) en vez del correcto (16.8 registros), y además usó Haiku que es menos preciso para verificación legal.

**Acción:** Documentar este caso para mejorar el sistema de verificación:
- Asegurar que las preguntas tengan el artículo correcto ANTES de verificar
- Usar modelos más capaces (Sonnet/Opus) para verificación legal
- Revisar preguntas sin `topic_id` ya que pueden tener datos incompletos

---

## 5. Corregir la Pregunta

Una vez identificado el problema:

```
corrige la pregunta pero no cierres la impugnación
```

Claude actualizará:

### 5.1 Formato de Explicaciones

Las explicaciones deben tener formato markdown con saltos de línea para ser legibles:

**Formato correcto:**
```
La respuesta correcta es X.

Según el artículo Y de la Ley Z:

**A)** INCORRECTA. Razón...

**B)** CORRECTA. El artículo dice literalmente...

**C)** INCORRECTA. Razón...

**D)** INCORRECTA. Razón...
```

> ⚠️ **La negrita cierra JUSTO tras el paréntesis: `**A)** INCORRECTA`, no `**A) INCORRECTA**`.**
> No es cosmética. El transcriptor a `explanation_data` (§🔀) reconoce las opciones con
> `/\*\*([A-E])\)\*\*/`, así que la variante con el veredicto dentro de la negrita **no se puede
> transcribir** y deja la pregunta fuera del barajado para siempre. El banco lo confirma: 13.836
> preguntas activas usan `**A)** …` (transcribibles) frente a 2.148 con `**A) INCORRECTA**`
> (condenadas a la pasada LLM). Este ejemplo documentaba la variante mala y por eso se seguía
> generando: cazado el 27/07 al corregir tres impugnaciones que nacieron no transcribibles.
> El validador te lo dice antes de aplicar (🔀 Barajable / aviso), así que **hazle caso**.

> ### 🔻 Enunciados de «señale la INCORRECTA»: pon `"frame": "select_incorrect"`
> En estas preguntas, la opción que hay que marcar es la que contiene la afirmación **falsa**. Con
> el frame puesto, el render etiqueta esa opción **`ES LA INCORRECTA`** y las demás **`VERDADERA`**,
> y `validar-explicacion.cjs` lo reconoce (las etiquetas están acordadas entre los dos: cambiar una
> sin la otra tumba textos impecables).
>
> **Sin el frame**, la opción a señalar salía como `**A)** CORRECTA — …que es falsa`, una
> contradicción en la misma línea, y había que escribir la razón peleándose con la etiqueta
> (*«No es la que hay que señalar, porque la afirmación es verdadera: …»*). **Esa pauta queda
> retirada**: era un apaño para un defecto del render, no una forma de escribir. Arreglado el 28/07
> (T-212); lo destapó la impugnación `afe7c8bb` (art. 33 CE).
>
> Las razones se escriben derechas, diciendo por qué la afirmación es verdadera o falsa —nunca
> «no es la que hay que señalar»—, y el aplicador **avisa** si el enunciado pide la falsa y te has
> dejado el frame.

**Evitar:**
- Texto corrido sin saltos de línea ni formato.
- Secciones tipo "Truco", "Consejo", "Tip" o similares. El resumen final debe integrarse como un párrafo natural, no como una sección aparte.
- Referencias a la POSICIÓN de otra opción («como se vio en la primera», «las dos últimas»): no sobreviven al barajado ni con estructura.

> **Preguntas de «señale la afirmación INCORRECTA» — redáctalas así hasta que se arregle [T-212].**
> El render de estilo impugnación etiqueta cada bloque por la CLAVE, no por si la afirmación es
> verdadera, y **todavía ignora el campo `frame: 'select_incorrect'`** (el render de boletín sí lo
> aplica). Si escribes las razones dando por hecho que la etiqueta acompaña, sale
> `**A)** INCORRECTA — Afirmación verdadera: …`, que se lee como una contradicción.
> **Fórmula que encaja con la etiqueta:** *"No es la que hay que señalar, porque la afirmación es
> verdadera: …"* para las tres verdaderas, y *"Es la que hay que señalar, porque la afirmación es
> falsa: …"* para la clave. Ejemplo aplicado: `65313a59` (art. 33 CE, propiedad privada).

### 5.1.bis La cita del blockquote se comprueba ENTERA (post-27/07/2026)

`validar-explicacion.cjs` comparaba solo los **primeros 80 caracteres** normalizados de la cita
(`nq.slice(0, 80)`) y el resto no lo miraba nunca. Un guardarraíl que existe para *"cazar citas
inventadas"* era ciego justo donde más duele: **el arranque de un precepto suele ser genérico**
(*"El plazo de presentación de solicitudes será de…"*) y lo que decide la respuesta —plazos,
mayorías, anchuras, órgano competente— **vive al final**.

**Cómo se cazó (27/07):** atacando al propio validador. Se invirtió el FINAL de la cita del art. 4.1
CE (*"siendo la **roja** de doble anchura que cada una de las **amarillas**"*, lo contrario de la
norma y exactamente el error que esa pregunta examina) y lo dio por **VÁLIDO**. No era regresión del
arreglo de T-204: el `slice(0, 80)` ya estaba antes.

**Qué hace ahora:** trocea la cita por las elisiones (`(...)`, `…`) y exige **cada fragmento**
literal en el artículo. Dos concesiones, ambas medidas, para no castigar la cita honrada:

| Se acepta | Por qué |
|---|---|
| Elidir tramos con `(...)` o `…` | Es práctica legítima; cada tramo se verifica por separado |
| Cerrar la cita con su propia referencia (*"…de autogobierno (art. 27 de la LO 1/1981)"*) | La coletilla la ponemos nosotros y nunca está dentro del artículo. Se poda **solo si con ello la cita pasa a casar**: si el cuerpo sigue sin aparecer, falla igual |

**Calibración (medida sobre 5.000 explicaciones vivas):** sin esas dos concesiones el check estricto
levantaba **942 (18,8 %)**, casi todas correctas; con ellas, **165 (3,3 %)**, y las revisadas a mano
eran de verdad no literales (citas que siguen más allá de donde acaba el artículo, o enumeraciones
compactadas que el precepto lista por letras). Regresión fijada en
`__tests__/impugnaciones/validarExplicacionCitaEntera.test.ts`.

> **Para ti, al corregir:** si el validador te dice *"tramo que falla"*, no toquetees la cita hasta
> que pase — **léela contra el artículo**. Ese aviso es casi siempre una cita que mezcla dos
> preceptos o que continúa con texto que el artículo vinculado no tiene.

### 5.1.1 Preguntas de Informática (Word, Excel, Access, Windows, Outlook, Internet)

> 🖥️🌐 **Antes de dar/quitar la razón en una impugnación de atajo o función: comprueba la variante ESCRITORIO vs WEB de la oposición del impugnante.** La clave puede diferir (en Office para la Web las teclas F no operan salvo Excel F2/F4 y Word F3; KeyTips Alt+letra cambian). Si la pregunta cuelga de `Word/Excel 365 Escritorio` y sirve a una oposición de escritorio, verifícala con la app de escritorio; si es una oposición de versión web (p.ej. Aragón), con Office para la Web. No cierres una impugnación aplicando la regla de la variante equivocada. Modelo: `crear-nueva-oposicion.md` §3c + memoria `project_office_web_escritorio_split`.

Para preguntas de temas técnicos/informáticos, la explicación **SIEMPRE** debe:

1. **Ser didáctica con markdown:** negrita, listas, análisis por opción (A, B, C, D)
2. **Incluir fuente oficial en español al final:** enlace a Microsoft Support en español (`support.microsoft.com/es-es/...`) — **EXCEPCIÓN en atajos de LETRA, ver el aviso de abajo**
3. **Verificar la fuente antes de usarla:** buscar con WebSearch y confirmar que la URL existe y es relevante

> ⛔ **EN ATAJOS DE LETRA, MICROSOFT SUPPORT es-es NO SIRVE COMO FUENTE — y enlazarla contradice tu propia respuesta (04/08/2026).** Esa página es una **traducción** del original inglés que **conserva las teclas inglesas**, así que en los atajos que Word/Office SÍ localizan dice lo contrario que el programa instalado en español. El punto 2 de arriba, aplicado a ciegas, te hace cerrar la explicación con un enlace que le da la razón a quien impugna.
>
> **Caso que lo fija (impugnación `75dfeb94`, Cristina):** *«¿qué hace Ctrl+K en Word 365?»*, clave **cursiva**. Ella sostenía «insertar hipervínculo» —que es lo correcto en el Word **inglés**—. Un `WebFetch` a la página es-es devolvió *«Ctrl+K: Insertar un hipervínculo»* **y** *«Ctrl+I: cursiva»*, contradiciéndose en la misma respuesta y dando el atajo inglés para la cursiva. **Fiándose de esa única fuente se habría roto una clave correcta.**
>
> **Qué hacer en su lugar:**
> - **Prueba discriminante** (memoria `project-informatica-atajos-es-vs-en`): mira si el **SET completo** de la familia está desplazado por iniciales españolas. Word ES: `Ctrl+N` **N**egrita · `Ctrl+K` cursiva · `Ctrl+S` **S**ubrayado (en inglés B-I-U). Si el set es coherente en español y difiere **en bloque** del inglés, está localizado. Al ocupar la cursiva la «K», el hipervínculo se corre a **`Ctrl+Alt+K`**.
> - **Cruza fuentes, nunca un solo WebFetch** (puede confabular, y dos a la misma página ya se han contradicho): temario de oposiciones AGE (`age.josenrique.es/leccion/atajos-de-teclado-word/`), PDFs de academias españolas, hilos de MS Q&A.
> - **Mira el propio banco:** suele corroborarse solo. Aquí `cfa27a3e` ya preguntaba por el hipervínculo con clave `Ctrl+Alt+K`, y de las 13 activas que mencionan `Ctrl+K` **ninguna** lo clavaba a hipervínculo.
> - Y **«desconfía de la traducción» es una sospecha, no un veredicto**: hay contraejemplos donde la página es-es acierta (T-394, `Ctrl+A` en el Explorador de Win11). Aplica la prueba discriminante y **acepta el resultado aunque salga a favor de la página**.

**Formato obligatorio para preguntas de informática:**
```
La respuesta correcta es **X) Texto de la opción**.

[Explicación del concepto con markdown]

**A) CORRECTA/INCORRECTA** — Razón...

**B) CORRECTA/INCORRECTA** — Razón...

**C) CORRECTA/INCORRECTA** — Razón...

**D) CORRECTA/INCORRECTA** — Razón...

Fuente: [Microsoft Support - Título descriptivo](https://support.microsoft.com/es-es/office/...)
```

**Fuentes comunes de Microsoft Support en español:**
- Excel: `https://support.microsoft.com/es-es/excel`
- Word: `https://support.microsoft.com/es-es/word`
- Access: `https://support.microsoft.com/es-es/access`
- Outlook: `https://support.microsoft.com/es-es/outlook`
- Windows: `https://support.microsoft.com/es-es/windows`
- Atajos Word: `https://support.microsoft.com/es-es/office/keyboard-shortcuts-in-word-95ef89dd-7142-4b50-afb2-f762f663ceb2`

**IMPORTANTE:** No inventar URLs. Siempre buscar y verificar que la fuente existe antes de incluirla.

### 5.1.2 Verificación de preguntas técnicas con artículos de informática (post-16/05/2026)

> **Actualización (16/05/2026):** el temario de informática ha sido completado con artículos reales en la BD (Word, Excel, Access, Outlook, Windows, Internet). Las preguntas técnicas **ya no son "virtuales"** en el sentido de carecer de artículo — cada pregunta debe tener un `primary_article_id` cuyo contenido responda literalmente a la pregunta, igual que cualquier pregunta legislativa.

**Regla del artículo literal — aplica también a informática:**

> El artículo vinculado (`primary_article_id`) debe contener la información que permite responder la pregunta directamente. Si el artículo habla de un concepto adyacente pero no dice explícitamente lo que la pregunta pregunta, hay que buscar y vincular el artículo correcto.

Ejemplo de la sesión 16/05/2026: pregunta sobre `Win+D` estaba vinculada a Art. "Fundamentos del SO Windows 11" — correcto porque dicho artículo recoge el atajo. Pregunta sobre atajos de Outlook vinculada a Art. 3 "Atajos de teclado" — correcto porque el artículo lista `Ctrl+4 = Contactos` literalmente.

**Flujo al resolver impugnaciones de preguntas técnicas:**

1. **Verificar artículo vinculado:** ¿el contenido del artículo responde literalmente la pregunta? Si no, buscar artículo correcto en `articles` y cambiar `primary_article_id`.
2. **Comprobar `ai_verification_results`:** si solo hay verificación de `gpt-4o-mini` con flag negativo no resuelto, ese flag suele ser correcto y conviene reescribir.
3. **Añadir fuente MS Support** a la explicación (ver §5.1.1).

**Para verificación masiva de técnicas:** usar agente Opus/Sonnet con prompt adaptado: "compara con el contenido del artículo vinculado Y con la documentación oficial de Microsoft Support en español; busca con WebSearch y verifica con WebFetch; si el artículo no responde la pregunta, marca `article_ok=false`".

**Auditoría periódica:** sacar lista de técnicas con `gpt-4o-mini` `answer_ok=false` o `explanation_ok=false` no resueltos y procesarlas con Opus/Sonnet en oleadas.

**Incidente que motivó la regla anterior (14/04/2026):** pregunta `7fc7f0b0...` Excel `=EXTRAE(A1;12;2)` tenía la explicación de OTRA pregunta (sobre concatenación con `&`), totalmente cruzada. `gpt-4o-mini` lo detectó hace meses pero la pregunta nunca fue revisada por agente Opus.

**Incidente que motiva la regla (14/04/2026):** pregunta `7fc7f0b0...` Excel `=EXTRAE(A1;12;2)` tenía la explicación de OTRA pregunta (sobre concatenación con `&`), totalmente cruzada. `gpt-4o-mini` lo detectó (`answer_ok=false, explanation_ok=false`, descripción correcta) hace meses, pero la pregunta nunca fue revisada por agente Opus, así que siguió activa hasta que la impugnó la usuaria Farida.

### 5.1.3 Impugnaciones de informática: verifica y arregla el ARTÍCULO, no solo la pregunta (post-22/05/2026)

Al resolver una impugnación de informática (Word, Excel, Outlook, Windows…), el artículo vinculado (`primary_article_id`) **puede estar mal él mismo**. Arreglar solo la explicación de la pregunta es un parche que NO escala:

- El artículo es la **teoría** que estudia el opositor — si está mal, le enseña el error igualmente.
- La explicación "corregida" **contradice** a su propio artículo vinculado.
- Cualquier **otra pregunta** vinculada al mismo artículo hereda el error.

**Regla:** verifica el contenido del artículo vinculado contra Microsoft Support. Si el artículo está mal, **corrige el artículo** (`articles.content`) — es la fuente única. Así se arreglan de golpe todas las preguntas que dependen de él, y la explicación de la pregunta solo tiene que ser coherente con el artículo.

**Dos trampas propias de informática:**

1. **El contenido es volátil entre versiones.** Microsoft remapea atajos y renombra funciones entre versiones (p. ej. Outlook clásico vs. Nuevo Outlook). Un atajo correcto hace años puede haber cambiado. Verifica siempre contra la página VIGENTE de Microsoft Support; la respuesta puede depender de versión.

2. **El mismo término nombra funciones distintas.** Ej.: Outlook tiene a la vez "Tareas" (módulo clásico, Ctrl+8) y "To Do" (Ctrl+5) — son cosas diferentes. Una pregunta que dice "la lista de tareas" es ambigua. Si Microsoft usa un nombre parecido para dos funciones, reformula el enunciado para que sea inequívoco.

**Incidente que motiva la regla (22/05/2026 — Alex Diaz, atajo Outlook):** impugnación `respuesta_incorrecta` sobre "¿atajo para la lista de tareas?", marcada Ctrl+5. El artículo vinculado decía "Ctrl+5 = Tareas (To Do)" y omitía Ctrl+8. Microsoft Support: **Ctrl+5 = To Do, Ctrl+8 = Tareas**. Se corrigió el **artículo** (tabla de navegación Ctrl+1–8 completa) y luego se reformuló el enunciado para que preguntara inequívocamente por "To Do".

### 5.2 Explicación + transición lifecycle (post-03/05/2026)

> 🆕 **Decide primero si hace falta transición:**
>
> - **Si la pregunta YA está en `approved` o `tech_approved`** (caso típico de bug menor: redacción mejorable, explicación pobre, errata) → **NO transicionar**. La función SQL rechaza same-state (`Same-state transition not allowed`). Solo `UPDATE explanation`/`question_text` + invalidar cache. La pregunta sigue visible mientras tanto.
> - **Si la pregunta está en `needs_review`/`needs_human`/`quarantine`/`draft`** → **SÍ transicionar** a `approved`/`tech_approved` tras corregir. Sin esta transición, `is_active` (GENERATED) sigue en false y la pregunta queda invisible al estudiante aunque la explicación esté arreglada.
>
> Comprobar siempre `lifecycle_state` antes de decidir (consulta de §4.1).

**Flujo en dos pasos:**

```javascript
// Paso 1: actualizar la explicación + columnas legacy (sin tocar is_active ni lifecycle_state directamente)
await supabase
  .from('questions')
  .update({
    explanation: nuevaExplicacion,
    verification_status: 'verified',           // legacy, opcional
    verified_at: new Date().toISOString(),     // legacy, opcional
  })
  .eq('id', questionId);
```

```javascript
// Paso 2: transicionar lifecycle vía endpoint admin (única vía legítima).
// Necesitas Bearer token admin (igual patrón que dispute/resolve).
const res = await fetch('https://www.vence.es/api/admin/questions/lifecycle/transition', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    questionId,
    expectedState: estadoActual,    // p.ej. 'needs_review' (lectura previa, sirve de optimistic check)
    newState: 'approved',           // o 'tech_approved' si es pregunta de informática
    reasonCode: 'admin_marked_perfect',
    notes: 'Impugnación XYZ resuelta: explicación reescrita',
  }),
});
```

**Reason codes admin más usados** (taxonomía cerrada en `lib/constants/lifecycleReasons.ts`):

| Caso | reasonCode | newState |
|------|------------|----------|
| Corregido y queda perfecto | `admin_marked_perfect` | `approved` (o `tech_approved` informática) |
| Necesita aún decisión humana | `admin_marked_problem` | `needs_human` |
| Pipeline IA aplicó fix | `auto_fix_applied` | `approved` |
| Imagen no recuperable | `admin_image_unavailable` | `retired_irreparable` |
| Ley derogada | `admin_law_derogated` | `retired_irreparable` |
| Pregunta anulada en oficial | `admin_exam_annulled` | `retired_irreparable` |
| Duplicada de otra | `admin_duplicate_of` | `retired_duplicate` |
| Estructural reparada | `admin_repaired_quarantine` | `draft` |

> Si haces UPDATE directo a `lifecycle_state` desde script, el trigger `tg_questions_lifecycle_audit_fallback` lo detecta y registra como `bypass_detected` en `question_lifecycle_history`. Funciona — pero **no lo hagas**: pasa siempre por el endpoint o llamando directamente a la función SQL `public.transition_question_state(...)` para tener audit con `changed_by` correcto.

### 5.2.1 Atajo desde Claude Code: llamar la función SQL vía `pg` (sin Bearer token)

Cuando Claude Code resuelve impugnaciones desde local con `DATABASE_URL` ya cargado de `.env.local`, mintear un Bearer admin (generateLink + verifyOtp) es engorroso. La función SQL `public.transition_question_state(...)` es `SECURITY DEFINER` y `EXECUTE` está dado a `service_role` (que es el rol del `DATABASE_URL` de servicio) — se puede invocar directamente:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const QUESTION_ID    = 'PONER_UUID';
const EXPECTED_STATE = 'needs_review';                          // estado leído antes; sirve de optimistic check
const NEW_STATE      = 'approved';                              // o 'tech_approved' (informática)
const REASON_CODE    = 'admin_marked_perfect';                  // ver tabla §5.2
const CHANGED_BY     = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';  // admin user_id (Manuel)
const NOTES          = 'Impugnación XYZ resuelta';              // opcional

(async () => {
  try {
    // 0. Leer estado actual + is_active (sanity check)
    const [before] = await sql\`
      SELECT lifecycle_state, is_active FROM public.questions WHERE id = \${QUESTION_ID}\`;
    console.log('ANTES:', before);

    // 1. Transicionar
    await sql\`
      SELECT public.transition_question_state(
        \${QUESTION_ID}::uuid,
        \${EXPECTED_STATE}::text,
        \${NEW_STATE}::text,
        \${REASON_CODE}::text,
        \${CHANGED_BY}::uuid,
        NULL::uuid,                  -- ai_verification_id (opcional)
        \${NOTES}::text
      )\`;

    // 2. Confirmar (is_active GENERATED debe seguir lifecycle_state)
    const [after] = await sql\`
      SELECT lifecycle_state, is_active FROM public.questions WHERE id = \${QUESTION_ID}\`;
    console.log('DESPUÉS:', after);

    // 3. Verificar audit en history
    const hist = await sql\`
      SELECT to_state, reason_code, changed_at
      FROM public.question_lifecycle_history
      WHERE question_id = \${QUESTION_ID}
      ORDER BY changed_at DESC LIMIT 1\`;
    console.log('HISTORY:', hist[0]);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await sql.end();
  }
})();
"
```

**Errores típicos que devuelve la función SQL** (capturarlos por `e.message`):

| Mensaje | Causa | Acción |
|---------|-------|--------|
| `State mismatch: expected X but is Y` | El `expectedState` no coincide con la BD (alguien cambió el estado entre tu lectura y este UPDATE) | Releer estado actual y reintentar |
| `Cannot transition from terminal state X` | La pregunta está en `retired_*`. No admite transición de salida | Crear pregunta nueva o rechazar dispute |
| `Illegal transition: X → Y` | El par estado-actual → estado-nuevo no está en la matriz de transiciones legales (ver `isLegalTransition` en `lib/constants/lifecycleReasons.ts`) | Revisar qué transición pretendías. Casi siempre es bug del caller |
| `Same-state transition not allowed: X → X` | Ya está en ese estado | No transicionar — solo UPDATE de `explanation` |
| `Invalid p_new_state: X` | El `newState` no está en los 8 estados válidos | Revisar typo |
| `p_reason_code is required` | Pasaste null/empty | Pasar uno de la taxonomía |

**Ventajas vs endpoint Bearer:**
- Sin pasos de auth (un solo `node -e`).
- Audit idéntico: history queda con `changed_by` correcto y `reason_code` taxonómico.
- Errores con mensaje SQL claro, sin capa de mapeo HTTP.

**Cuándo usar el endpoint (`POST /api/admin/questions/lifecycle/transition`) en lugar de este atajo:**
- Desde la app web (admin UI) — ahí el Bearer ya existe en sesión.
- Desde un cliente que NO tenga acceso a `DATABASE_URL` (ej. integración externa).
- Cuando quieras los códigos HTTP estructurados (409 conflict, 404 not found, 400 bad request).

> **⚠️ INVALIDAR CACHE:** desde el commit que añadió `unstable_cache` a la
> validation query (`lib/api/v2/answer-and-save/queries.ts`), el endpoint
> `/api/v2/answer-and-save` cachea la respuesta correcta + explicación con
> tag `'questions'` (TTL 1h). Tras un UPDATE manual a `questions` desde
> script (sin pasar por `/api/v2/dispute/resolve`), invalidar el cache:
>
> ```bash
> curl -X POST https://www.vence.es/api/admin/revalidate \
>   -H "Content-Type: application/json" \
>   -H "x-cron-secret: $CRON_SECRET" \
>   -d '{"tag":"questions"}'
> ```
>
> Si NO se invalida, los users verán la explicación / respuesta antigua
> hasta máximo 1h (TTL). Cerrar la dispute via `/api/v2/dispute/resolve`
> invalida automáticamente el tag — solo es problema si haces UPDATE
> manual y luego cierras la dispute via UPDATE directo en BD (lo cual
> NO se debe hacer, ver §6).

### 5.3 Vincular artículo (tabla `question_articles`)
```javascript
supabase
  .from('question_articles')
  .insert({ question_id: questionId, article_id: articleId });
```

### 5.4 Actualizar verificación AI (tabla `ai_verification_results`)
```javascript
supabase
  .from('ai_verification_results')
  .update({
    article_id: correctArticleId,
    article_ok: true,
    answer_ok: true,
    explanation_ok: true,
    confidence: 'alta',
    ai_provider: 'claude_code',
    ai_model: 'claude-opus-4-6',
    verified_at: new Date().toISOString(),
    explanation: 'Verificación corregida...',
    article_quote: 'Cita del artículo...'
  })
  .eq('question_id', questionId);
```

## 6. Cerrar la Impugnación

> **IMPORTANTE:**
> - NUNCA cerrar la impugnación sin aprobación explícita del mensaje.
> - SIEMPRE obtener el nombre del usuario ANTES de proponer el mensaje, para dirigirse a él por su nombre.
> - Claude debe mostrar el mensaje propuesto y esperar confirmación antes de ejecutar cualquier cambio en `question_disputes`.

Antes de cerrar, pedir el mensaje personalizado:

```
cierra la impugnación pero antes dime qué le vas a poner al usuario
```

**Formato del mensaje (post-14/04/2026):**
```
Hola [Nombre],

[Confirmación del problema reportado, reconociendo si tenían razón]

[Explicación de la corrección aplicada]

Muchas gracias.

Equipo de Vence
```

**Notas de tono:**
- Firmar siempre con "Equipo de Vence" al final.
- **SIEMPRE en PRIMERA PERSONA DEL PLURAL** (Manuel, 05/08/2026, textual: *«además he comprobado no,
  hemos comprobado, siempre en plural»*). *«Hemos comprobado»*, *«hemos revisado»*, *«te
  confirmamos»* — **nunca** *«he comprobado»*, *«he revisado»*, *«no puedo»*. Es la firma vista
  desde dentro del texto: si el mensaje lo firma un equipo, el singular delata a un individuo
  detrás y rompe justo lo que la firma construye. Medido el 05/08 sobre los borradores de la
  flota: **4 de 26** se habían escrito en singular, y ninguna de las capas lo miraba.
- **NO usar fórmulas de apertura tipo "Gracias por avisar", "gracias por ayudarnos a mejorar la plataforma"** ni "gracias por el reporte. Mucho ánimo con la oposición!". Los opositores no quieren ayudarnos, quieren resolver su asunto. NO abrir el mensaje agradeciendo el aviso: entrar directo al reconocimiento ("Tenías razón…") o a la corrección. El único agradecimiento válido es el cierre "Muchas gracias." al final.
- Cuando el usuario tenía razón, decirlo claramente ("Tenías razón…", "Tienes razón…"). Refuerza confianza en la plataforma.
- **NO ahondar en los fallos en el mensaje al usuario** (para no parecer incompetentes). Reconocer que el usuario tenía razón y comunicar la mejora aplicada, pero **sin detallar/enumerar los defectos internos** (explicación cruzada de otra pregunta, referencias de artículos intercambiadas, clave equivocada, etc.). Basta un "Hemos mejorado la explicación para que quede más clara" + el punto clave correcto. El análisis exhaustivo del fallo es para el diagnóstico interno, no para el email. Compatible con la línea anterior: se puede decir "Tenías razón" sin listar todo lo que estaba mal.
- Mensajes concisos y aireados (no apelotonados): saltos de línea entre párrafos, frases cortas. El usuario no quiere leer un muro de texto.

### 6.0.bis Cuando NO tiene razón: enseñarle, no ganarle la discusión (31/07/2026)

**Regla:** demostrar que la pregunta está bien **no basta**. La respuesta tiene que llevar el texto
**literal**, el **enlace** para que lo compruebe él mismo, y sobre todo **reconstruir por qué él vio
otra cosa**. Un usuario que se queda sin argumentos no es lo mismo que un usuario que lo entiende, y
solo el segundo vuelve a estudiar tranquilo.

**El caso (`349b5132`, Estela).** Impugnó `desacuerdo_correcta` con una sola palabra:
*«Desactualizado»*. **No tenía razón** — el párrafo está en el texto vigente. La respuesta que se le
dio hizo cuatro cosas, y las cuatro cuentan:

1. **Dijo dónde está y por qué se pasa por alto:** *«dentro de la letra c) del artículo 9.2. Va en
   mitad de esa letra, sin punto y aparte»*. Explica su error sin culparla de nada.
2. **Citó el párrafo literal**, con las elisiones marcadas `(…)`, y dio el **enlace con ancla**
   (`…#a9`) para que lo viera ella misma.
3. **Reconstruyó lo que ELLA estaba mirando** — la pieza que de verdad la convenció: *«Esa redacción
   la introdujo la Ley 11/2022… La anterior no hablaba de dos meses, sino de una autorización previa
   de tres, así que si el texto que ves dice eso, tienes seleccionada una redacción antigua (en el
   BOE hay un desplegable "Seleccionar redacción")»*. No solo le dijo que se equivocaba: le dijo
   **en qué** se equivocaba y **dónde está el botón** para que no le vuelva a pasar.
4. **Cogió su propio argumento y le dio la vuelta:** ella citaba la disposición adicional octava, y
   la respuesta contesta *«tu lectura es correcta… justo por eso confirma que el plazo existe»*.
   Llevarla a la conclusión con su propio razonamiento, en vez de contradecirla.

**Cómo terminó:** replicó a los pocos minutos diciendo *«no había caído en que estaba consultando
una redacción distinta, ahora me ha quedado completamente claro»*, se disculpó por insistir y añadió
que **por esa atención va a contratar Premium**. Es decir: una impugnación **rechazada en el fondo**
acabó en intención de compra. El «cómo» pesó más que el «quién tenía razón».

> **Tres asteriscos, para que nadie saque de aquí la lección equivocada:**
> · **Tardamos 25,3 horas** en contestarle, no minutos (ella lo llama «rapidez», pero el número es
>   ese; no lo uses para concluir que un día de espera está bien).
> · **Sigue en `free`**: dijo que pagaría, no ha pagado. No lo cuentes como conversión.
> · **Es 1 caso entre 29** réplicas escritas por una persona en toda la historia (de 427 con
>   `appeal_text`, **398 son la conformidad automática** que nadie escribió). Esto es un ejemplo de
>   cómo redactar, **no** un patrón del que derivar reglas de proceso.

Una vez aprobado, **llamar al endpoint `/api/v2/dispute/resolve`** (NO hacer UPDATE directo en BD):

```javascript
// Necesitas un access_token de admin. Para minteo programatico desde Node:
//   1) generateLink type='magiclink' con SERVICE_ROLE_KEY
//   2) verifyOtp con ANON_KEY → session.access_token
// (Ver script de ejemplo en /tmp/test_e2e_auth.mjs si sigue existiendo.)

const res = await fetch('https://www.vence.es/api/v2/dispute/resolve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    disputeId,
    questionType: isPsychometric ? 'psychometric' : 'legislative',
    status: 'resolved', // o 'rejected'
    adminResponse: mensaje,
  }),
});

const result = await res.json();
// result = {
//   success: true,
//   disputeId, status,
//   emailSent: boolean,
//   emailId: string | null,
//   emailError: string | null,
//   emailSkipReason: 'empty_response' | 'no_user_email' | 'user_preferences' | null
// }
```

> **El email se envía en el mismo flujo de aplicación** (`sendEmailV2` directo, sin saltos HTTP intermedios). Si `emailSent === false`, revisar `emailError` o `emailSkipReason`. La disputa **siempre queda resuelta** aunque el email falle (no hay rollback).

> ⚠️ **`emailSkipReason: 'user_preferences'` NO es un detalle técnico: significa que le has contestado
> y NO se ha enterado** (le queda la campana dentro de la app, nada más). Y casi nunca es una
> elección suya: la respuesta a una impugnación es categoría `soporte`, que solo bloquea
> `email_soporte_disabled`… pero el botón **«Desactivar TODOS los emails»** de `/unsubscribe` apaga
> esa columna de propina, pese a prometer bajo el propio botón que solo corta lo *«automático»*.
> Medido el 31/07/2026: de los **80** usuarios con el soporte apagado, **79 llegaron por ese botón**
> y solo **1** lo eligió a propósito; hay **29 respuestas a impugnaciones y 10 a feedbacks** escritas
> y no entregadas, 22 de ellas a la misma persona, que sigue impugnando. **Si ves ese
> `emailSkipReason`, dilo en el resumen de la sesión** — no lo des por cerrado. Arreglo de fondo:
> [T-369]. Los dos scripts de cierre (`cerrar.ts`, `cerrar-feedback.ts`) ya lo cantan en vez de
> enterrarlo en el JSON.

> **NO hagas UPDATE directo en BD.** El trigger PG antiguo fue eliminado el 14/04/2026 porque fallaba en silencio por cold-start de Vercel. Si haces UPDATE directo, **NO se enviará email al usuario**.

## 6.bis Cerrar como `resolved` concede 1 € al usuario (post-28/07/2026)

**Decisión Manuel (28/07):** aceptar una impugnación recompensa al usuario con **1 €** en su saldo del Programa de Recompensas. **Es automática**: la concede `resolveDispute` en el mismo cierre, así que **no tienes que crear nada** — ni `POST /api/admin/rewards` ni SQL. Si lo haces a mano, duplicas.

**Cuándo se concede** (todo tiene que cumplirse):
| Condición | Detalle |
|---|---|
| Estado `resolved` | `rejected` no paga — y tampoco penaliza al usuario |
| Usuario **premium** | El programa es solo-premium. Un free no cobra aunque su impugnación sea impecable |
| La escribió una persona | `source='user'`. Las auto-detectadas por IA (`ai_auto`, §12.1) no pagan: no hay a quién |
| **Motivo VERIFICABLE** | Pagan `respuesta_incorrecta`, `desacuerdo_correcta`, `no_literal`, `mal_formulada`, `pregunta_repetida`, `tema_incorrecto`, `error_pregunta_respuesta`. **NO pagan solas** `explicacion_confusa`, `explicacion_mejorable` ni `otro` (ver abajo) |
| Bajo el tope | **10 aceptadas/mes por usuario** (`IMPUGNACION_MONTHLY_CAP`). Al llegar al tope se sigue resolviendo igual, simplemente no suma |

**Por qué el motivo importa (28/07):** la regla es **objetividad, no esfuerzo**. Se paga cuando aceptar significa que teníamos un **error demostrable contra la fuente**; no cuando significa que **hemos mejorado algo a partir de una opinión**. Medido a 90 días, el **61 % de lo aceptado a premium era subjetivo** (`otro` 113, `explicacion_confusa` 47, `explicacion_mejorable` 35) y una sola usuaria concentraba 70 — y como §7.3 manda mejorar toda explicación mejorable, `explicacion_confusa` era un camino casi garantizado al tope entero sin error nuestro alguno. **Lo subjetivo se sigue premiando A MANO** cuando la aportación lo merece; lo que se retira es el automatismo. Política única en `lib/referrals/disputeRewardPolicy.js` (si añades un motivo al formulario y no lo clasificas, **no compila**).

**Concederlo a mano (T-388, el simétrico de `skipRewardReason` — «UN FALLO O HALLAZGO, UNA RECOMPENSA» arriba en la checklist):** pasa **`grantRewardReason`** al endpoint (o `--con-recompensa "<motivo>"` en `cerrar.ts`) con el porqué. Solo salta la condición del TIPO — sigue exigiendo `resolved`, premium, origen humano, tope mensual y anti-duplicado, así que puede seguir sin conceder nada (p. ej. si ya tocó el tope ese mes). Queda registrado como `dispute_reward_granted` con el resultado real. Es incompatible con `skipRewardReason` (el endpoint rechaza con 400 si llegan los dos: uno quita, el otro concede, no hay un ganador implícito).

**No decidas de memoria: el dossier te lo dice.** `revisar-impugnacion.cjs` imprime junto al tipo una línea `💶 Recompensa:` con la consecuencia real de aceptar — ya concedida / no premium / motivo que no paga / tope alcanzado / `concede 1 € … lleva X/10 este mes`. Léela antes de cerrar.

**Lo que esto cambia en tu criterio, que es lo importante:** cerrar `resolved` una impugnación que en realidad es un falso positivo ya no es solo un error de registro — **paga 1 € y contamina la métrica de precisión de la IA** (§12.2). El manual ya decía que un falso positivo se rechaza (§10.1); ahora además cuesta dinero. No cambies tu criterio para "premiar" al usuario, ni al revés: si tenía razón, `resolved` y punto.

**Detalles que evitan sustos:**
- **No es retroactiva.** Las ~1.268 impugnaciones resueltas antes del 28/07 no generan nada.
- **Re-resolver no paga dos veces.** El anti-duplicado es físico (índice único sobre `reward_submissions.dispute_id`), no depende de que te acuerdes.
- **Si la concesión falla, la impugnación se resuelve igual.** Nunca bloquea el cierre; el fallo queda en `observable_events` (`referral_error`, `metadata.step='dispute_reward'`).
- **El usuario se entera por el badge 🎁**, no por email. **NUNCA lo menciones en el mensaje de respuesta** (decisión Manuel 24/07 para bug/ugc, aplica igual aquí): queda cutre y el mensaje va del asunto, no del dinero.
- **Comprobarlo:** `SELECT amount, created_at FROM reward_submissions WHERE dispute_id = '<id>'`.

**Por qué se hizo junto al arreglo del formulario (T-198):** hasta el 28/07 el formulario **enviaba la impugnación al pulsar el motivo**, sin dejar escribir — el 54% llegaba sin una palabra del usuario. Pagar por impugnación aceptada con ese formulario habría premiado el volumen (pulsar motivos a voleo salía rentable). Por eso el envío ahora es **explícito** (botón, nunca al pulsar el motivo) y el usuario **llega al textarea y decide**. El texto se PIDE pero es **opcional** salvo en `otro` (decisión Manuel 28/07: se probó obligatorio en todos y se revirtió — el motivo del radio ya dice qué falla, y exigir 10 caracteres para reportar un fallo NUESTRO es ponerle un peaje al usuario). **Si alguien reintroduce el auto-envío, esta recompensa se convierte en un incentivo a spamear.**

Detalle del programa y de las otras 4 fuentes: `docs/runbooks/embajadores-recompensas.md`. Implementación: `lib/referrals/disputeReward.ts` (política pura en `lib/referrals/logic.ts`).

---

## 7. Tablas Involucradas

| Tabla / Endpoint | Uso |
|-------|-----|
| `question_disputes` | Impugnaciones de preguntas legislativas |
| `psychometric_question_disputes` | Impugnaciones de preguntas psicotécnicas |
| `questions` | Preguntas legislativas y explicaciones (lee `lifecycle_state`, NO actualizar `is_active` — es GENERATED) |
| `question_lifecycle_history` | Audit append-only de transiciones de `lifecycle_state` (post-03/05/2026) |
| `psychometric_questions` | Preguntas psicotécnicas (sin lifecycle aún, fuera de scope) |
| `question_articles` | Relación pregunta-artículo (tabla de unión) |
| `articles` | Artículos de leyes |
| `ai_verification_results` | Resultados de verificación AI |
| `user_profiles` / `auth.users` | Datos del usuario para personalizar mensaje |
| `POST /api/admin/questions/lifecycle/transition` | **Única vía legítima** para cambiar `lifecycle_state` (= visibilidad) |
| `public.transition_question_state(...)` | Función SQL `SECURITY DEFINER` que valida transiciones + escribe history |

### 7.0 Dos Tablas de Impugnaciones

**IMPORTANTE:** Las impugnaciones están en DOS tablas diferentes:

| Tabla | Tipo de Pregunta | Campos Principales |
|-------|------------------|-------------------|
| `question_disputes` | Legislativas | `question_id` → `questions` |
| `psychometric_question_disputes` | Psicotécnicas | `question_id` → `psychometric_questions` |

**Para ver TODAS las impugnaciones pendientes** (⚠️ **RDS vía `pg`, no `supabase-js`** — ver §1):

```javascript
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });

// 1. Legislativas pendientes (incluye alegaciones)
const legDisputes = await sql`
  SELECT id, question_id, user_id, dispute_type, description, status, created_at
  FROM question_disputes
  WHERE status IN ('pending','appealed')
  ORDER BY created_at`;

// 2. Psicotécnicas pendientes
const psyDisputes = await sql`
  SELECT id, question_id, user_id, dispute_type, description, status, created_at
  FROM psychometric_question_disputes
  WHERE status IN ('pending','appealed')
  ORDER BY created_at`;

console.log('Legislativas:', legDisputes.length);
console.log('Psicotécnicas:', psyDisputes.length);
```

**Para corregir preguntas psicotécnicas:** (⚠️ mismo criterio RDS que arriba — escribe con `pg`/`DATABASE_URL`, no `supabase-js`, o el cambio irá al backup congelado y no a producción; los ejemplos `supabase` de abajo son ilustrativos del qué, no del cliente)

```javascript
// Actualizar pregunta psicotécnica
await supabase
  .from('psychometric_questions')
  .update({
    explanation: nuevaExplicacion,
    correct_option: nuevoIndice  // 0=A, 1=B, 2=C, 3=D
  })
  .eq('id', questionId);

// Cerrar impugnación psicotécnica
await supabase
  .from('psychometric_question_disputes')
  .update({
    status: 'resolved',  // o 'rejected'
    admin_response: mensaje,
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

### 7.1 Dos formas de vincular artículos

Las preguntas pueden tener artículos vinculados de **dos formas**:

| Campo | Ubicación | Uso |
|-------|-----------|-----|
| `primary_article_id` | Columna en `questions` | Artículo principal (directo) |
| `question_articles` | Tabla de unión | Artículos adicionales (múltiples) |

**Importante:** Al investigar una pregunta, verificar AMBOS:

```javascript
// 1. Artículo principal
const { data: q } = await supabase
  .from('questions')
  .select('primary_article_id')
  .eq('id', questionId);

// 2. Artículos adicionales
const { data: qa } = await supabase
  .from('question_articles')
  .select('article_id')
  .eq('question_id', questionId);
```

Si `primary_article_id` apunta al artículo incorrecto, corregirlo:

```javascript
await supabase
  .from('questions')
  .update({ primary_article_id: correctArticleId })
  .eq('id', questionId);
```

### 7.1.1 Preguntas estructurales → vincular al "Artículo 0" de la ley

Las preguntas que **no versan sobre el contenido de un artículo concreto**, sino sobre la **estructura o los metadatos de la ley** (número de artículos, títulos, capítulos, disposiciones; cuándo se aprobó; cuántas reformas ha tenido y cuáles; etc.) **NO deben vincularse al artículo concreto** al que se refieran de pasada, sino al **"Artículo 0"** de esa ley.

El **Art. 0** es un artículo especial (`article_number = '0'`, p. ej. titulado "Estructura de la Constitución CE") que recopila la estructura completa de la norma y sus datos meta. Es el único `primary_article_id` cuyo contenido responde literalmente este tipo de preguntas.

**Ejemplo (sesión 22/05/2026):** las preguntas "¿cuándo se produjo la X reforma de la Constitución?" estaban vinculadas cada una al artículo que esa reforma modificó (13, 135, 49). Es incorrecto: la pregunta no va del contenido del art. 13, va de la *historia de reformas*. Todas se re-vincularon al Art. 0 de la CE, cuya sección "Reformas constitucionales" sí responde la pregunta. Si el Art. 0 no recoge aún el dato (p. ej. una reforma nueva), **hay que actualizar el Art. 0** además de re-vincular.

**Cómo detectarlo:** si al aplicar la regla del artículo literal (el artículo vinculado debe responder la pregunta literalmente) ningún artículo de contenido responde la pregunta porque ésta es de tipo "estructura/historia/metadatos" → el destino correcto es el Art. 0.

## 7.2 Impugnaciones de `tema_incorrecto` o "esta pregunta es de otro tema"

Cuando la queja del usuario no es sobre el contenido de la pregunta sino sobre el **tema** en el que aparece, **no es un problema de la pregunta sino del `topic_scope`**. Antes de tocar nada:

> 📖 **Lectura obligatoria:** `docs/maintenance/verificar-epigrafe-topic-scope.md` — explica cómo el `topic_scope` mapea artículos a temas y la regla de oro "scope debe reflejar el epígrafe oficial".

### Checklist específica para `tema_incorrecto`

1. **Buscar el `primary_article_id` en TODOS los `topic_scope` de la oposición**, no solo en el tema "esperado". Filtrar por `position_type` + `law_id` y comprobar qué temas (de cualquier bloque) tienen ese artículo. Lo habitual es encontrar 2+ temas y uno es el erróneo.
2. **Comparar el contenido del artículo con el `topics.epigrafe` oficial** de cada tema donde aparece. Si el artículo trata de algo que **no se menciona en el epígrafe**, sobra ahí — quitarlo del `article_numbers` de ese scope.
3. **Aplicar la regla del manual de epígrafes** (sección "Solapamientos entre temas"): solo estrechar cuando el contenido pertenece **claramente** a otro tema del mismo programa. Si hay duda genuina, mantener.
4. **Usar la nomenclatura del usuario en TODO momento** (mensaje al usuario, análisis previo, borradores, e incluso comunicación con el desarrollador). NUNCA mencionar el `topic_number` interno (T5, T101, T201, etc.) — el opositor no lo entiende y al desarrollador le confunde igual. Regla **estricta y única** para todos los temas:
   - **Siempre escribir "Tema X del Bloque Y"** (ej.: "Tema 5 del Bloque I", "Tema 1 del Bloque II"), incluso si es Bloque I.
   - X = `display_number` si está informado; si no, `topic_number` (válido en Bloque I porque coinciden).
   - Y = `bloque_number`, en romanos (I, II, III...).
   - Consulta: `SELECT topic_number, bloque_number, display_number, title, epigrafe FROM topics WHERE …`.
   - Si te descubres escribiendo "T101", "T5", etc. en cualquier lado → reescribir.
5. **Revalidar cache tras tocar `topic_scope`** (paso obligatorio, distinto del tag `'questions'`). Cambiar `article_numbers` de un scope cambia qué artículos/preguntas se asignan a cada tema → el **temario** y los conteos siguen cacheados con el estado viejo hasta invalidar. Invalidar **`temario` + `test-counts`** (y `teoria` si además cambia lo que se ve en la página de teoría). Ver `docs/maintenance/cache-revalidation.md`:
   ```bash
   for T in temario test-counts; do
     curl -X POST https://www.vence.es/api/admin/revalidate \
       -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" \
       -d "{\"tag\":\"$T\"}"
   done
   ```
   Si el cambio es masivo (varios scopes/temas/leyes), usar `node scripts/purge-all-cache.js` en su lugar.

### Incidente que motiva la regla (14/04/2026 — Isabel Iglesias, aux admin estado)

Pregunta sobre art. 103.2 CE (órganos de la Admin del Estado creados por ley) aparecía en el "Tema 1 del Bloque II - Atención al ciudadano" (T101 interno), cuyo epígrafe oficial trata solo de acogida, información y discapacidad. El art. 103 estaba en el `topic_scope` de T101 sin justificación en el epígrafe; pertenece claramente a T5 ("El Gobierno y la Administración"). Fix: quitar `"103"` del `article_numbers` de T101.

Misma usuaria, mismo día, otra impugnación: art. 13 CE (derechos de extranjeros) aparecía en T2 ("Tribunal Constitucional. Reforma. Corona") cuando solo encaja en T1 ("Derechos y deberes fundamentales"). Mismo patrón, misma solución.

**Patrón a vigilar:** topic_scopes que añaden artículos "por contigüidad numérica" (porque el tema toca arts cercanos del mismo título) sin comprobar si cada artículo concreto encaja en el epígrafe.

## 7.3 Filosofía: "no oficial + mejorable = se mejora" (post-14/04/2026)

**Regla:** si una pregunta es `is_official_exam = false` y se puede dejar perfecta tocando algo, **se toca**, aunque la queja del usuario sea parcial o no apunte al punto débil real. Aprovechar cada impugnación para subir el nivel de la pregunta.

**Por qué:** las preguntas no oficiales no tienen restricciones de literalidad de examen. Cualquier mejora — opción más literal, explicación didáctica, fuente añadida, errata corregida, programa especificado — sube la calidad del banco. Si el usuario notó algo, casi siempre hay más por pulir alrededor.

**Casos típicos vistos el 14/04/2026:**

- Eduardo (#5574b5e0) pidió añadir "sobre todo en materia criminal" → reformulamos opción C entera para que fuera **cita literal** del art. 120.2 CE.
- Cristina (#e9cd059b, #8dd09f3b) pidió que se indicara el programa → añadimos "En Microsoft Word/Excel" + reescribimos explicación con análisis A/B/C/D + fuente Microsoft Support en español (estándar §5.1.1).
- Tinokero (#e50300fb) discrepaba con la respuesta correcta → su queja era infundada, pero detectamos explicación monolínea sin formato; **rechazamos su queja PERO mejoramos la explicación** según §5.1.1.

**Contraste:** si la pregunta es **oficial** (`is_official_exam = true`), no se toca enunciado ni opciones — solo se mejora la explicación, se corrige el `primary_article_id` y se reescribe la cita textual si era engañosa (caso #ca60036f Carmen Pavón, examen oficial CyL).

## 7.3.bis Cifras legales volátiles (umbrales, IPREM, SMI) — verificar vigencia, no descartar a ciegas (post-02/06/2026)

Algunas preguntas dependen de **importes que se revisan periódicamente** (umbrales de contratación armonizada de la UE, IPREM, SMI, indemnizaciones, etc.). Una impugnación `explicacion_mejorable`/`respuesta_incorrecta` sobre una cifra **no implica que la cifra esté mal**: puede que el usuario estudiara con el valor de otro periodo.

**Regla:** verifica contra fuente oficial **el valor vigente para la fecha de hoy**. Si nuestro contenido coincide con el periodo actual, la pregunta es correcta — **no cambies la cifra** (cambiarla la dejaría obsoleta en la siguiente revisión). Mejora la explicación añadiendo una **nota de vigencia** que despeje la confusión.

**Incidente que motiva la regla (02/06/2026 — Roberto, LCSP art. 22):** umbral de regulación armonizada de servicios para entidades distintas de la AGE marcado en **216.000 €**. Es correcto: es el valor **vigente desde el 1 de enero de 2026** (Orden HAC/1517/2025); en 2024-2025 era 221.000 € — justo lo que despistaba al usuario. Fix: mantener la cifra, reestructurar la explicación con los tres umbrales + nota de vigencia. Reconcilia con la trampa de "contenido volátil entre versiones" del §5.1.3 (allí informática, aquí legislación).

## 7.3.quater RECHAZAR exige explicar MEJOR, no menos: con el artículo, la ley y la fuente (post-01/08/2026)

> **Regla (Manuel, 01/08/2026):** cuando la impugnación NO procede, la respuesta tiene que dejar al
> usuario **satisfecho y convencido**, no simplemente informado de que se equivocaba. Eso significa
> **citar el artículo concreto y nombrar la ley**, y darle el enlace **si con la cita no le basta**
> para comprobarlo él mismo. Un «tu impugnación no procede» a secas es la peor respuesta posible: el
> opositor se queda pensando que no le hemos mirado el caso, y la próxima vez que vea un fallo real
> **ya no nos lo dice**.

**Qué tiene que llevar una respuesta de `rejected`:**

1. **La cita literal del precepto**, entrecomillada y con su referencia exacta (artículo, apartado y
   letra). No parafrasear: el opositor quiere ver la frase.
2. **El enlace directo a la fuente que prueba LO QUE SE DISCUTE** — y solo si hay algo que probar
   **y la cita no lo prueba ya**.
   > 🔗 **PRIMERO decide SI enlazar; solo después, CUÁL (Manuel, 06/08/2026).** El criterio es
   > sencillo: **si la cita literal ya convence por sí sola, el enlace sobra**. Se pone cuando con la
   > frase no basta — porque el usuario tendría que ver el contexto, porque la duda va de qué
   > redacción está vigente, o porque lo que se discute no cabe en una cita.
   >
   > La tabla de abajo contesta a la pregunta SIGUIENTE (con qué fuente), no a ésta. Aplicarla sin
   > pasar antes por aquí es lo que convierte el enlace en un reflejo.
   >
   > **Caso que lo fija (06/08/2026, impugnación `00208e53`, Estela):** sostenía que el plazo del
   > art. 9.2.c) de la Ley 39/2015 eran tres meses. La respuesta ya llevaba la cita literal
   > («habrán de transcurrir **dos meses** desde dicha comunicación») **y** la explicación de por qué
   > ella recordaba tres (el RD-ley 14/2019 daba ese plazo a la autorización previa que la Ley
   > 11/2022 suprimió). Con eso la duda queda resuelta; el enlace al BOE no añadía nada que ella
   > fuera a abrir. Se envió sin él.
   > 🎯 **EL ENLACE AL BOE NO ES UN ADORNO QUE SE PONE EN TODAS (Manuel, 06/08/2026).** Esta regla
   > se leía como «toda respuesta de `rejected` lleva su enlace al BOE», y así se volvió un reflejo:
   > se pegaba el enlace sin preguntarse qué demuestra. **Antes de ponerlo, contesta a una pregunta:
   > ¿qué es exactamente lo que el usuario discute?** Porque cada queja se prueba con una fuente
   > distinta, y la equivocada no es neutral: aparenta rigor mientras contesta a otra cosa.
   >
   > | Lo que discute | Lo que lo prueba |
   > |---|---|
   > | Qué **dice** la norma (clave errónea, cita no literal, redacción vieja) | El **BOE/boletín** del artículo, con su ancla |
   > | Si el artículo **entra en su temario** («no corresponde», «fuera de temario») | **SUS bases** (`oposiciones.programa_url`), citando el epígrafe literal |
   > | Cómo está **construida** la pregunta (mal formulada, doble solución, orden de las opciones) | El **razonamiento**, no un enlace: ya sabe lo que dice la norma |
   > | Que la **app** hace algo raro (no le sale, se ve vacío, se repite) | Nada externo: lo que cambia para él |
   >
   > **Caso que lo destapa (06/08/2026, impugnación `1aac9e3c`, Natalia Suárez):** se quejaba de que
   > el art. 12 de la LO 3/2007 *«no corresponde al temario»*, y el borrador llevaba el enlace al
   > BOE del artículo. Ese enlace prueba **lo que dice el artículo**, que es justo lo único que ella
   > **no** discutía. Lo que contestaba a su queja estaba en **sus bases** (`BOP-A-2025-1439`), cuyo
   > tema c) dice literalmente «La Igualdad efectiva de mujeres y hombres…», el epígrafe exacto de
   > su Tema 3. Se cambió el enlace por esa cita. **Su convocatoria la publica el BOP de Córdoba, no
   > el BOE: para una queja de temario, el BOE no pinta nada.**
   >
   > Y cuando el enlace no aporta —porque la cita literal ya va en el mensaje y el usuario no
   > discute el texto—, **no se pone**: un enlace de más obliga a quien lee en el móvil a
   > comprobar algo que no le preocupaba.
   > ⚠️ **ABRE EL ENLACE ANTES DE MANDARLO Y COMPRUEBA QUE DICE LO QUE DICES (Manuel, 01/08/2026).**
   > **El ancla NO es `#a<número de artículo>` en todos los textos** — es un id de bloque del
   > consolidado, y la convención cambia de norma a norma:
   >
   > | Norma | Ancla del artículo | Comprobado |
   > |---|---|---|
   > | Ley 39/2015 (`BOE-A-2015-10565`) | `#a95` → «Artículo 95. Requisitos y efectos» | ✅ |
   > | Código Civil (`BOE-A-1889-4763`) | `#art3`, `#art4` | ✅ |
   > | Código Civil — `#a3` | ❌ **lleva a «Artículo 301 a 324. (Derogados)»** | — |
   > | LO 3/2018 (`BOE-A-2018-16673`) | art. 17 → **`#a1-9`** (`#a17` y `#art17` **no existen**) | ✅ |
   >
   > **Son tres convenciones distintas en tres normas**, así que no hay patrón que memorizar: hay
   > que mirarlo. Y el fallo no avisa — en el Código Civil el patrón `#aN` **existe pero apunta a
   > otro artículo**, así que no da 404: el usuario pincha, lee un artículo derogado que no tiene
   > nada que ver, y la respuesta que pretendía convencerle demuestra lo contrario. Cazado el 01/08
   > al ir a mandarle a Marta Pérez (`1e9c09f6`) un `#a3` para el art. 3.2 CC.
   >
   > **Cómo se verifica** (30 s, y de paso confirma la cita del punto 1):
   > ```bash
   > curl -s "https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763" -o /tmp/norma.html
   > grep -o 'id="art3"' /tmp/norma.html        # ¿existe el ancla?
   > # y localizar la frase citada para ver qué bloque la contiene:
   > python3 -c "import re,html;s=open('/tmp/norma.html',encoding='utf-8',errors='replace').read();i=s.find('La equidad habrá de ponderarse');print(re.findall(r'id=\"([^\"]+)\"',s[i-3000:i])[-4:])"
   > ```
   > La regla de fondo es la de siempre en esta casa: **no se cita lo que no se ha abierto.** Vale
   > igual para el enlace de Microsoft Support de §5.1.1 («No inventar URLs») y para cualquier
   > boletín autonómico.
   >
   > **Y ese `grep` léelo entero:** en el caso de la LO 3/2018, un `grep … | head -8` devolvió
   > `id="a1"…id="a8"` y se leyó como «las anclas van por número», cuando eran las únicas nueve que
   > había. Un `head` sobre la comprobación de un guardarraíl convierte la comprobación en su
   > contrario.
3. **Por qué ÉL vio otra cosa** — que casi siempre tiene explicación y es lo que de verdad resuelve
   la duda: una redacción anterior, un texto de academia sin actualizar, otra ley con un plazo
   parecido, una versión distinta del programa. Si se le nombra el motivo concreto, entiende el
   desajuste; si no, se queda con la sensación de que uno de los dos miente.
4. **Tratar sus argumentos secundarios**, aunque el principal no proceda. Si citó otro artículo o
   una disposición adicional, dile qué dice esa también.
5. Y aun así, **mejorar la pregunta si se puede** (§7.3): que la queja no proceda no significa que
   no haya nada que pulir.

**Caso de éxito que da origen a la regla — impugnación `349b5132` (Estela Jiménez, 31/07-01/08):**

- Impugnó `desacuerdo_correcta` sobre el plazo del **art. 9.2.c) de la Ley 39/2015** (cuántos meses
  desde la comunicación a la SGAD hasta la eficacia jurídica del sistema de identificación), con un
  único comentario: *«Desactualizado»*. La clave —**dos meses**— era CORRECTA.
- La respuesta **no se limitó a decir que no procedía**: le transcribió la letra c) entera
  entrecomillada, le dio el enlace al artículo en el BOE, y —esto es lo que lo resolvió— le explicó
  **por qué ella no encontraba el párrafo**: la redacción vigente la introdujo la **Ley 11/2022** (30
  de junio de 2022) y la anterior no hablaba de dos meses sino de una autorización previa a resolver
  en tres; si consultaba el BOE con otra redacción seleccionada, veía justo eso. Además se le
  contestó el argumento secundario (la disposición adicional octava y el art. 10.2.c), dándole la
  razón en esa parte.
- **Su réplica, literal:** *«Muchas gracias por la aclaración y por haberos tomado el tiempo de
  explicármelo con tanto detalle… no había caído en que estaba consultando una redacción distinta.
  Ahora ya me ha quedado completamente claro. Me ha gustado mucho la atención que me habéis dado y
  la rapidez… Precisamente por este tipo de soporte creo que voy a animarme a contratar la versión
  Premium».* Una impugnación **rechazada** que acaba en una posible alta de pago.
- **Y se aprovechó igualmente para mejorar la pregunta:** su explicación abría con *«La respuesta
  correcta es la **D**»* —letra clavada en la narrativa, que impide barajar (§🔀)—, así que se
  reescribió estructurada, incorporando como razón de la opción «3 meses» **la propia confusión de
  Estela** (que era el plazo de la redacción anterior) y una nota de vigencia de la Ley 11/2022. La
  duda de una usuaria se convirtió en el material didáctico de la pregunta.

> **Cómo se cerró, que también importa:** su réplica era un **agradecimiento**, no una queja nueva.
> Ahí NO se contesta otra vez —mandar un correo para decir «de nada» es ruido—: se hace **cierre
> silencioso**. ⚠️ Y OJO con cómo: `/api/v2/dispute/resolve` escribe `adminResponse: trimmedResponse || null`,
> así que cerrar con mensaje vacío **borra la respuesta que sí se le envió** (1.770 caracteres, en
> este caso). El cierre silencioso es un `UPDATE` del `status` **preservando `admin_response`** —la
> única excepción legítima a «cerrar siempre por el endpoint» (§6), porque aquí el email es
> exactamente lo que no se quiere.

## 7.3.ter «Según la ley sí, pero en la práctica no»: la jurisprudencia va a la EXPLICACIÓN, no a la clave (post-31/07/2026)

Hay un tipo de impugnación que llega bien argumentada y **no cambia la respuesta**: la que opone
a la letra del artículo una **doctrina del TC o del TS** que lo ha dejado inaplicable, matizado o
vaciado en la práctica. El usuario suele tener razón en el fondo y equivocarse en la conclusión.

**Regla:** verifica las dos cosas por separado.

1. **¿Qué dice el artículo VIGENTE?** Es lo que se examina, y de las opciones ofrecidas normalmente
   solo una lo refleja. Si la clave es esa, **la clave se queda**.
2. **¿Qué dice la sentencia que él cita?** Léela en el BOE — no te fíes del resumen de un blog ni
   del titular. Importa muchísimo el **fallo**: una sentencia puede razonar que el precepto no se
   aplica a cierto supuesto y aun así **desestimar** la cuestión, dejándolo vigente.

Y entonces: **`rejected`, pero con la explicación reescrita incluyendo la nota jurisprudencial.**
La impugnación no procede (la respuesta no cambia) y aun así el usuario ha detectado algo cierto
que a la explicación le faltaba. Es el mismo movimiento que §7.3.bis hace con las cifras volátiles
—mantener el dato, añadir la nota que despeja la confusión— y el mismo espíritu que el caso
Tinokero de §7.3: *rechazar la queja no exime de mejorar la pregunta*.

**Incidente que motiva la regla (31/07/2026 — Roberto Benito, impugnación `b9ae32e2`):** pregunta
oficial (Aux. Admin. Madrid OEP 2020-2022) sobre el plazo para interponer el recurso
contencioso-administrativo contra un **acto presunto**; clave *seis meses*, que es literal del
**art. 46.1 LJCA**. Él alegó que «según modificación del TC no hay plazo». Y es verdad: la **STC
52/2014, de 10 de abril** (Pleno) razona que *«la impugnación jurisdiccional de las desestimaciones
por silencio no está sujeta al plazo de caducidad previsto en el art. 46.1 LJCA»*, en línea con el
TS. **Pero su fallo DESESTIMA la cuestión de inconstitucionalidad**: el precepto sigue vigente con
esa redacción y es lo que pregunta el examen. Se cerró `rejected`, reconociéndole expresamente que
tenía razón en el fondo, y la explicación pasó a incluir la cita del artículo + la nota de la STC.

> ⚠️ **La pregunta era OFICIAL**, así que no se podía atender lo que además pedía («que la pregunta
> diga "según la Ley 29/1998"»): en oficiales no se toca enunciado ni opciones (§7.3). Cuando la
> petición del usuario sea razonable pero imposible por eso, **dilo en el mensaje** en vez de
> ignorarla; si no, parece que no se le ha leído.

**Y mide si hay hermanas antes de cerrar** (regla de los fallos sistémicos): buscando por el
enunciado apareció `d54d7dd4`, la MISMA pregunta con las opciones en otro orden y no oficial. Su
clave también era correcta, pero era una **duplicada servida** — se jubiló como `retired_duplicate`
(`admin_duplicate_of`). Un `ILIKE` sobre `question_text` cuesta un minuto.

## 7.4 Cross-contamination de explicaciones entre preguntas (post-14/04/2026)

**Patrón detectado:** preguntas cuya explicación pertenece a **otra pregunta distinta** del banco — texto coherente y bien formateado, pero del tema equivocado.

**Caso motivador (14/04/2026 — Farida Oulad, dispute `5a1f5508`):** pregunta sobre `=EXTRAE(A1;12;2)` en Excel cuya explicación hablaba enteramente del operador `&` y la función CONCAT (concatenación). La explicación estaba bien escrita, pero pertenecía a una pregunta distinta sobre concatenación. `gpt-4o-mini` lo detectó (`explanation_ok=false`) hace meses; `claude-opus-4-5` lo dejó pasar como `perfect`.

**Por qué pasa:** sugiere bug en algún punto del pipeline de generación o importación masiva donde explicaciones se asignaron cruzadas (mismo lote, mismo tema técnico, distinta función concreta).

**Cómo detectar masivamente:** auditar preguntas técnicas donde palabras clave del enunciado **no aparecen** en la explicación (ej.: enunciado contiene "EXTRAE" pero explicación no menciona "EXTRAE"). Script sugerido:

```js
// preguntas con función mencionada en enunciado pero no en explicación
const keywords = ['EXTRAE','BUSCARV','CONCATENAR','SUMAR.SI','PROMEDIO','SI','HOY','AHORA','...'];
for (const kw of keywords) {
  const { data } = await s.from('questions')
    .select('id, question_text, explanation')
    .ilike('question_text', `%${kw}%`)
    .not('explanation', 'ilike', `%${kw}%`)
    .eq('is_active', true);
  console.log(`${kw}: ${data?.length || 0} sospechosas`);
}
```

## 7.4.ter Supuestos prácticos huérfanos (`exam_case_id IS NULL` en preguntas marcadas como "Supuesto práctico") — post-19/05/2026

**Síntoma típico:** usuario impugna `mal_formulada` o `respuesta_incorrecta` sobre una pregunta cuyo enunciado dice "de los mencionados en el supuesto", "según los datos del supuesto", etc., pero al verla la pregunta NO muestra ningún texto de supuesto encima. La pregunta es irresoluble sin ese contexto.

**Diagnóstico:** la pregunta tiene `exam_case_id = NULL` y `exam_source` contiene "Supuesto práctico". O bien (a) el texto narrativo nunca se importó a `exam_cases`, o bien (b) se importó pero no se vinculó.

**Resolución:**

1. Buscar el texto del supuesto en los PDFs locales (`data/examenes-oficiales/<oposicion>/<carpeta>/cuestionario.txt`).
2. INSERT en `exam_cases` con `case_text`, `case_title`, `exam_date`, `exam_source`, `oposicion_type=<slug-con-guion>`.
3. UPDATE `questions.exam_case_id` para todas las preguntas del bloque del supuesto.
4. Lifecycle: si las preguntas están en `needs_human` por este motivo, transicionarlas a `approved` (`reasonCode=admin_marked_perfect`).
5. Invalidar cache `'questions'`.

**Defensas activas tras el incidente CARM 19/05/2026** (ver detalle en `importar-examen-oficial-completo.md` §7.4.ter):

- **Trigger BD** `tg_questions_require_exam_case_for_supuesto`: impide INSERT/UPDATE que dejaría una pregunta con `exam_source ILIKE '%Supuesto práctico%'` en `approved`/`tech_approved` sin `exam_case_id`. Si lo intentas, falla con `ERRCODE = check_violation`.
- **Tests de integración** `__tests__/integration/supuestoPracticoOrphans.test.ts`: auditan periódicamente (CI) que no haya huérfanas, por etiqueta y por heurística de texto.

Si al resolver una dispute te aparece error del trigger al intentar transicionar a `approved`, es porque la pregunta sigue sin `exam_case_id`. Crear primero el `exam_case` y vincular, luego transicionar.

## 7.4.quater Psicotécnicas visuales: "no se ve la imagen" / imagen ambigua → REPARAR como data-driven (post-21/07/2026)

**Síntoma:** impugnación `mal_formulada`/`imagen_no_visible` sobre una psicotécnica de contar/analizar un cuadro (subtype `data_tables`, series, matrices de símbolos, etc.) cuya respuesta depende de una **imagen**. Casos: la imagen no renderiza (404 / no carga en el cliente), o **existe pero es ambigua/ilegible** y no puedes verificar la clave a ciencia cierta (recuento que da 5 o 6 según cómo leas la rejilla).

**Diagnóstico primero:**
1. `SELECT question_subtype, image_url, content_data, is_official_exam, exam_source FROM psychometric_questions WHERE id=…`.
2. ¿La imagen carga? `curl -s -o /tmp/q.png -w '%{http_code}' <image_url>` y **ábrela con Read** para contar tú mismo.
3. ¿Es oficial? Si `is_official_exam=false` + `exam_source=null` + `is_verified=false` → la clave **no tiene respaldo**; no te fíes de ella.

**La REPARACIÓN (mejor que retirar): pásala a data-driven.** El front (`ContentDataRenderer`) pinta `content_data` como **rejilla/tabla HTML nativa** (soporta `content_data.tables[]` = matriz de filas, `table_data`, e incluso `image_base64`), así que **NO hace falta generar un PNG** (no tenemos stack de imagen: ni canvas ni sharp ni puppeteer). De 785 `data_tables`, 271 ya son data-driven y ~388 son solo-imagen (deuda). Para reparar una de conteo:

1. **NO transcribas la imagen ambigua** (heredas su error y no hay clave oficial que valide). En su lugar, **genera una rejilla NUEVA con respuesta CONTROLADA**: coloca el símbolo objetivo de forma que EXACTAMENTE K cumplan la condición (K = la respuesta que sabes con certeza), con distractores que NO la cumplan; sin el símbolo en bordes de fila (evita ambigüedad de vecino entre filas); ningún objetivo adyacente a otro. **Verifica K por código** antes de escribir.
2. Escribe `content_data = { instruction, tables:[{ title, rows:[[...],...] }] }`, pon `correct_option` a la opción de K, `is_verified=true`, **`image_url=NULL`** (para que no salga el PNG viejo), `deactivation_reason=NULL`, y una `explanation` coherente. Invalida caché `questions`.
3. Resultado: misma pregunta, pero **verificable y sin ambigüedad**, como las 271 buenas. El generador sirve para toda la clase (deuda de las ~388 solo-imagen — candidato a backlog). Ejemplo: dispute `28b9327d` (Esther, "¿cuántas veces ￦ entre dos figuras iguales?", 21/07): imagen existía pero el recuento daba 5-6; no oficial/sin fuente → regenerada rejilla 10×14 con 5 exactos, verificada, `image_url` a NULL.

> Retirar (`is_active=false`) solo si NO tiene sentido reconstruirla (p.ej. pregunta de imagen no reproducible por su naturaleza). Si es de conteo/tabla, casi siempre es mejor repararla data-driven.

## 7.5 Same-user clustering: red flag de fallo sistémico (post-14/04/2026)

**Regla:** si un mismo usuario (mismo `user_id`) abre **3+ impugnaciones** seguidas en poco tiempo, antes de tratarlas como casos independientes, buscar el **denominador común**. Casi siempre revela un fallo sistémico (de scope, de pipeline, de versión de programa, etc.) en lugar de N preguntas malas independientes.

> 👤 **Por eso una MISMA sesión debe llevar TODAS las de un usuario.** Repartir las impugnaciones de un mismo usuario entre varias sesiones destruye el contexto que revela la causa raíz (cada sesión ve 1 pieza y ninguna ve el patrón). El reparto (`cola.cjs next`, §1.bis) ya lo hace por ti: al coger una impugnación coge **también todas las demás pendientes de ese usuario**, para que la sesión que ya montó su journey/oposición las resuelva todas. Sigue siendo **una por una** en la respuesta (email individual), pero **una sola sesión** en el análisis.

> ⚠️ **El clustering es solo para el diagnóstico, NO para la respuesta.** Detectar la causa raíz común no autoriza a fusionar el cierre: cada impugnación se sigue resolviendo **una por una** con su propio borrador, su propia aprobación y su propio email (ver regla "UNA POR UNA" del Procedimiento operativo). No agrupar varias del mismo usuario en un único mensaje/email aunque la raíz sea idéntica.

**Caso motivador (14/04/2026):** Isabel Iglesias abrió 3 impugnaciones (`af869052`, `259780d8`, `70329edc`) en pocos días sobre 3 preguntas distintas. Tratadas individualmente parecían inconexas; en realidad las 3 tenían la misma raíz: artículos de la CE (art. 13, art. 103) que aparecían en topic_scopes equivocados (T2 Bloque I, T1 Bloque II) por error de configuración inicial. Un solo fix de scope cerró las 3.

**Cómo detectar:**

```js
const { data } = await s.from('question_disputes')
  .select('user_id, count(*)')
  .eq('status', 'pending')
  .group('user_id')
  .order('count', { ascending: false });
// Cualquier user_id con count >= 3 → investigar denominador común
```

**Qué buscar como denominador:** misma ley, mismo artículo, mismo topic, mismo bloque, misma oposición, mismo tipo de bug (scope, traducción, versión, errata).

## 7.6 Verificación de fuentes Microsoft Support (post-14/04/2026)

**Flujo obligatorio antes de incluir una URL `support.microsoft.com/es-es/...` en una explicación:**

1. **Buscar con WebSearch** restringido al dominio:
   ```
   WebSearch(query: "tema concreto Excel Word Outlook ...", allowed_domains: ["support.microsoft.com"])
   ```
2. **Tomar la URL más relevante** del resultado (suele ser la primera de Office o de la app concreta).
3. **Si la URL es `/en-us/`, sustituir por `/es-es/`** manteniendo el resto del slug y el ID hexadecimal final.
4. **Verificar con WebFetch** que la página existe en español y trata el tema:
   ```
   WebFetch(url: "...", prompt: "¿Existe esta página en español? ¿Trata sobre [tema]?")
   ```
5. **Solo si WebFetch confirma** que la página existe y aborda el tema → incluir como `Fuente:` al final de la explicación. Si devuelve 404 o el contenido no encaja, repetir desde paso 1 con otra búsqueda.

**Por qué:** las URLs de Microsoft Support cambian, los IDs caducan y la versión `es-es` no siempre existe para la misma URL `en-us`. Inventar o asumir URLs lleva a `Fuente:` rotas que dañan la confianza del usuario.

## 7.7 Barrido de fallos similares tras una impugnación (post-02/06/2026)

Cuando una impugnación destapa un defecto que **puede ser sistémico** (clave intercambiada, pregunta con contexto regional colgada de ley nacional, defecto ligado a un lote de importación / `exam_source`), después de resolver la impugnación individual conviene un **barrido del mismo patrón** en el banco — distinto del clustering por mismo-usuario (§7.5), que es por autor.

**Escalado proporcional al tamaño:**
1. **Barrido acotado (SQL/heurística):** busca el mismo patrón (mismo `exam_source`, mismo eje de confusión, opciones duplicadas, etc.) y verifica a mano el subconjunto sospechoso. Avisa SIEMPRE de qué cubriste y qué no (no dar por auditado lo que no miraste).
2. **Auditoría de lote con workflow (read-only)** si el lote es grande: agentes en paralelo verifican cada pregunta contra su artículo vinculado + coherencia interna, y cada hallazgo se **verifica adversarialmente** para cortar falsos positivos. Los hallazgos se corrigen con el flujo normal por pregunta (uno a uno, con OK).
3. **Fix estructural** si el barrido revela que el sistema de revisión dejó pasar el defecto → ver `revisar-preguntas-con-agente.md` §19 (gate de contenido en `transition_question_state` + detector mecánico bank-wide).

**Incidente que motiva la regla (02/06/2026 — Pilar, Galicia):** impugnación `respuesta_incorrecta` (control de la Xunta: Presidente vs Parlamento) → barrido de 48 preguntas Presidente/Parlamento del Estatuto de Galicia (limpias salvo esa) → auditoría workflow del lote completo "Aula Plus - Legislación autonómica" (2.220 preguntas, 74 agentes) → 28 hallazgos confirmados (4 clave equivocada) + descubrimiento de que 1.822/2.220 cuelgan de artículos-placeholder vacíos → gate estructural anti "false-perfect". Dos patrones sistémicos recurrentes que conviene vigilar al barrer: pregunta regional colgada de ley nacional (se cuela en bancos de otras CCAA) y cifras legales volátiles (§7.3.bis).

## 7.8 ⚠️ Formato de la pregunta (nº de opciones) según la oposición — NO "arreglar" una opción D vacía sin comprobarlo (post-29/06/2026)

**Regla:** una opción `D` (o `E`) **vacía/null NO es un defecto por sí sola**. Algunas oposiciones usan preguntas de **3 alternativas (A/B/C)** por diseño — sobre todo **Policía Nacional (CNP) Escala Básica**, cuyo examen oficial es de 3 opciones. Antes de añadir una 4ª opción para "completar" una pregunta, **comprueba el formato del banco/oposición**:

- **Verifica el `exam_position`/`tags` de la pregunta y el formato de su oposición.** Tags tipo `["InnoTest","PN",...]` = banco de Policía Nacional = **3 opciones**. Dato real (29/06): preguntas oficiales de policía **989/991 con D vacía (99,8%)**; banco InnoTest PN **10.464/10.664 con D vacía (98%)** → 3-opciones por diseño.
- **Si la oposición es de 3 opciones, una D null es CORRECTA.** Añadir una 4ª opción **rompe** el realismo del examen. El front ya renderiza solo las opciones no-nulas (`lib/testFetchers.ts` ~391: `[a,b,c,d,e].filter(non-null)`), así que la pregunta se muestra bien con 3.
- **Solo añade/repara la opción D si la oposición es de 4 opciones Y la pregunta debería tenerla** (p.ej. una pregunta de auxiliar/administrativo a la que de verdad le falta una opción).

**Espejismo del "leak de 3-opciones a oposiciones de 4":** una pregunta de 3-opc cuelga de un artículo compartido (CE, TUE…) y por el modelo nuclear aparece en el **pool** de muchas oposiciones (incl. de 4-opc) — eso asusta al contarlo (vi "7% del pool de aux. admin. estado son de 3-opc"). **PERO la capa de selección filtra por `exam_position` (`EXAM_POSITION_MAP` + `applyExamPositionFilter` en `testFetchers`), así que en la PRÁCTICA NO se sirven** (verificado empíricamente: usuarios de aux. admin. estado, 8.678 servidas/7d → **1 de 3-opc = 0,01%**). **Lección doble: (1) mide lo SERVIDO (`test_questions` reales por oposición), no el pool bruto por artículo; (2) no confundas "scopeada en el pool" con "mostrada al usuario".**

**Incidente que motiva la regla (29/06/2026 — alba heredia, CNP):** impugnación `desacuerdo_correcta` sobre "¿órgano ejecutivo de la UE?" (clave B=Comisión, correcta; ella eligió A=Consejo Europeo, falso positivo). La pregunta tenía `D=null` y, creyéndola rota, **se le añadió una 4ª opción** ("Consejo de la UE") — ERROR: era una pregunta CNP de 3 opciones. Revertido. Journey confirmó que estaba en `/policia-nacional/test` (su oposición, 3-opc correcto). Manuel cazó el error.

## 8. Columnas de `question_disputes`

| Columna | Descripción |
|---------|-------------|
| `id` | UUID de la impugnación |
| `question_id` | UUID de la pregunta |
| `user_id` | UUID del usuario |
| `dispute_type` | Tipo: `otro`, `no_literal`, `respuesta_incorrecta`, etc. |
| `description` | Descripción del usuario |
| `status` | `pending` / `resolved` / `rejected` / `appealed` |
| `admin_response` | Respuesta al usuario |
| `resolved_at` | Fecha de resolución |
| `source` | `user` (manual) / `ai_auto` (auto-detectada por IA del chat) |
| `ai_chat_log_id` | UUID del `ai_chat_logs` que generó la disputa (solo `ai_auto`) |

## 9. Flujo Completo

> El flujo canónico es el **"Procedimiento operativo"** del inicio del manual. El esquema de abajo es un ejemplo conversacional más detallado, paso a paso.

```
1. "mira si hay impugnaciones abiertas"
   ↓
2. "analiza la impugnación 1"
   ↓
3. "¿fue verificada? ¿por qué falló?"  ← DIAGNÓSTICO
   ↓
4. "busca el artículo correcto en nuestra BD"
   ↓
5. "corrige la pregunta pero no cierres la impugnación"
   ↓
6. "actualiza el registro AI"
   ↓
7. Re-verifica la pregunta contra el artículo correcto:
   - articleOk, answerOk, explanationOk
   - **Transiciona `lifecycle_state` a `approved`** (o `tech_approved`) vía endpoint
     `/api/admin/questions/lifecycle/transition` con `reasonCode: 'admin_marked_perfect'`
   - Eso reactiva la pregunta (is_active=true GENERATED). El UPDATE legacy a
     `topic_review_status` es opcional (compatibilidad), no controla visibilidad.
   ↓
8. Claude obtiene el NOMBRE del usuario (sección 11)
   ↓
9. Claude propone mensaje personalizado con nombre
   ↓
10. Usuario aprueba mensaje → Claude cierra la impugnación
```

## 10. Ejemplo Real #1: Impugnación Válida (Corregir)

**Impugnación:** "La explicación no se corresponde con la pregunta"

**Diagnóstico realizado:**
- `verified_at`: null (nunca verificada correctamente)
- AI verification existía pero con artículo incorrecto
- Modelo usado: Haiku (poco preciso para legal)
- AI concluyó erróneamente que respuesta C era correcta

**Problema encontrado:**
- Pregunta sobre Art. 16.8 (documentos en forma diferente)
- Explicación hablaba de Art. 6.6 (prórrogas de poderes)
- Artículo vinculado era incorrecto
- AI verificó contra artículo equivocado → conclusiones erróneas

**Correcciones:**
1. Nueva explicación basada en Art. 16.8
2. Vinculado artículo 16 de Ley 39/2015
3. Actualizado `ai_verification_results`
4. Cerrada con mensaje personalizado

**Mensaje enviado:**
```
Hola Nila,

Efectivamente, la explicación no correspondía con la pregunta.
Hablaba de "prórrogas de poderes con validez de 5 años" (Art. 6.6)
cuando la pregunta trata sobre documentos presentados en forma
diferente a su régimen especial.

Se ha corregido la explicación con el artículo correcto
(Art. 16.8 Ley 39/2015).

Gracias por el reporte. Mucho ánimo con la oposición!
```

---

## 10.1 Ejemplo Real #2: Falso Positivo (Rechazar)

**Impugnación auto-detectada:** "La respuesta B es incorrecta según Art. 67.1 CE"

**Pregunta:** "El cargo de Senador es compatible con el cargo de:"
- A) Diputado de las Cortes Generales
- B) Miembro de una Asamblea de CCAA ← Marcada correcta
- C) Miembro de una Junta Electoral
- D) Con ninguno de los anteriores

**Análisis de cada opción:**

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. 67.1: "Nadie podrá ser miembro de las dos Cámaras simultáneamente" | ❌ |
| B | Art. 67.1: prohíbe acumular Asamblea CCAA con **Diputado**, NO con Senador | ✅ |
| C | Art. 70.1.f: miembros de Juntas Electorales son inelegibles | ❌ |
| D | Falso, B sí es compatible | ❌ |

**Diagnóstico:**
- La IA auto-detectora leyó mal el Art. 67.1 CE
- El artículo dice "Diputado al Congreso", no "Senador"
- Verificación Opus 4.5 confirmó: "B correcta"
- La pregunta ES CORRECTA

**Problema de la explicación:**
- Solo transcribía los artículos sin explicar didácticamente
- No explicaba POR QUÉ cada opción era correcta/incorrecta

**Acciones:**
1. Rechazar impugnación (la pregunta es correcta)
2. Mejorar explicación didáctica (opcional pero recomendado)

**Explicación mejorada:**
```
La respuesta correcta es B) Miembro de una Asamblea de CCAA.

Según el artículo 67.1 CE: "Nadie podrá ser miembro de las dos
Cámaras simultáneamente, ni acumular el acta de una Asamblea de
Comunidad Autónoma con la de Diputado al Congreso."

A) INCORRECTA - Art. 67.1 prohíbe ser de ambas Cámaras.
B) CORRECTA - La prohibición solo afecta a Diputados, no Senadores.
C) INCORRECTA - Art. 70.1.f hace inelegibles a miembros de Juntas Electorales.
D) INCORRECTA - B sí es compatible.

La clave: el art. 67.1 dice "Diputado al Congreso", no "Senador".
```

**Mensaje de rechazo:**
```
Esta impugnación fue generada automáticamente por IA, pero tras
revisión manual se confirma que la pregunta es CORRECTA.

El Art. 67.1 CE prohíbe acumular Asamblea de CCAA con "Diputado
al Congreso", pero NO menciona a los Senadores. Por tanto, un
Senador SÍ puede ser miembro de una Asamblea de CCAA.

Se ha mejorado la explicación didáctica de la pregunta.
```

## 11. Obtener Nombre del Usuario

Para personalizar el mensaje, hay dos opciones:

### Opción 1: Desde `user_profiles` (recomendada)
```javascript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('full_name, email')
  .eq('id', userId)
  .single();

const nombre = profile?.full_name?.split(' ')[0] || 'Usuario';
```

### Opción 2: Desde `auth.users` (requiere service role)
```javascript
const { data: { user } } = await supabase.auth.admin.getUserById(userId);
const nombre = user.user_metadata?.name || user.user_metadata?.full_name || 'Usuario';
```

**Nota:** La opción 2 requiere `SUPABASE_SERVICE_ROLE_KEY` para acceder a `auth.admin`.

## 12. Rechazar una Impugnación

A veces el usuario está equivocado y la pregunta es correcta. En ese caso:

```
rechaza la impugnación explicando por qué la pregunta es correcta
```

Claude actualizará:
```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'rejected',
    admin_response: 'Hola [Nombre],\n\nHemos revisado tu impugnación...\n\n[Explicación de por qué la pregunta es correcta]\n\nGracias por tu interés en mejorar la plataforma.',
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

**Importante:** Siempre explicar con detalle por qué se rechaza, citando el artículo relevante.

> **Nota — cierre silencioso `resolved`:** el patrón de §12.1 (admin_response=null + is_read=true) **es válido también con `status='resolved'`** cuando hay una **regla operativa específica del admin** que lo justifique (p. ej. una memoria del tipo "para el usuario X siempre cierre silencioso"). NO es el flujo por defecto — solo aplicable a excepciones documentadas. El flujo normal sigue siendo el del §6 (con mensaje aprobado vía `/api/v2/dispute/resolve`).

### 12.1 Rechazo Silencioso (Impugnaciones Auto-Detectadas por IA)

Las impugnaciones auto-detectadas se identifican por `source = 'ai_auto'` (y tienen `[AUTO-DETECTADO POR IA]` en la descripción). No son de usuarios reales. Se rechazan **sin notificación**:

```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'rejected',
    admin_response: null,   // → trigger dispara pero API NO envía email
    is_read: true,          // → NO aparece en la campana del usuario
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

**Por qué funciona:**
- `admin_response: null` → el endpoint `/api/send-dispute-email` comprueba `if (!dispute.admin_response?.trim())` y salta el envío
- `is_read: true` → el hook `useDisputeNotifications` filtra por `.eq('is_read', false)`, así que no aparece en la campana

**Flujo para impugnaciones auto-detectadas:**
1. Verificar si la IA tiene razón o es falso positivo
2. Si la pregunta es correcta → rechazar silenciosamente (este método)
3. Si la pregunta tiene error → corregirla y rechazar silenciosamente igualmente (el usuario no sabe que existe la impugnación)
4. Siempre mejorar la explicación si es pobre, independientemente del resultado

### 12.2 Precisión de la IA (Panel Admin)

El panel `/admin/impugnaciones` muestra métricas de precisión:
- **Filtro "Auto IA"** para ver solo disputas auto-creadas
- **Barra de precisión**: % de disputas aceptadas (IA acertó) vs rechazadas (IA erró)
- **Badge "Auto IA"** en cada tarjeta para identificarlas visualmente
- **Chat log vinculado**: si tiene `ai_chat_log_id`, se muestra el ID para revisar el razonamiento

Para consultar la precisión por SQL:
```sql
SELECT
  count(*) FILTER (WHERE status = 'resolved') AS aceptadas,
  count(*) FILTER (WHERE status = 'rejected') AS rechazadas,
  count(*) FILTER (WHERE status IN ('pending','reviewing')) AS pendientes,
  round(100.0 * count(*) FILTER (WHERE status = 'resolved')
    / NULLIF(count(*) FILTER (WHERE status IN ('resolved','rejected')), 0)) AS precision_pct
FROM question_disputes
WHERE source = 'ai_auto';
```

---

## 13. Consejos

- **CRÍTICO: Siempre pedir aprobación explícita** del mensaje antes de cerrar la impugnación. Mostrar el texto y esperar "sí" o "ok" del usuario.
- **CRÍTICO: Siempre obtener el nombre del usuario** antes de proponer el mensaje. Usar la consulta de la sección 11 para obtenerlo.
- **Siempre verificar** el artículo correcto en nuestra BD antes de corregir
- **No cerrar** la impugnación hasta aprobar el mensaje
- **Personalizar** el mensaje con el nombre del usuario (nunca "Hola," genérico)
- **Actualizar** `ai_verification_results` para que la verificación quede correcta
- **Transicionar `lifecycle_state`** vía `/api/admin/questions/lifecycle/transition` — **paso obligatorio** si la pregunta estaba oculta. Sin esto, la pregunta sigue invisible para el estudiante (post-03/05/2026, ver §5.2).
- **Opcional (compatibilidad legacy):** actualizar `verification_status`, `verified_at`, `topic_review_status`. No controlan visibilidad pero algunos readers todavía los leen.
- Si la pregunta **no tiene topic_id**, considerar asignarla al tema correcto

---

## 14. Gestión de Feedbacks (Chat de Soporte)

Los feedbacks de usuarios usan un sistema de **3 tablas** diferente a las impugnaciones:

### 14.1 Tablas del Sistema de Feedback

| Tabla | Uso |
|-------|-----|
| `user_feedback` | Feedback inicial del usuario (mensaje, status) |
| `feedback_conversations` | Conversación asociada (puede haber varias por feedback) |
| `feedback_messages` | Mensajes individuales de la conversación |

### 14.2 Ver Feedbacks Pendientes

```javascript
// Feedbacks que necesitan respuesta
const { data: feedbacks } = await supabase
  .from('user_feedback')
  .select('id, message, status, user_id, created_at')
  .in('status', ['pending', 'in_progress'])
  .order('created_at', { ascending: true });
```

### 14.3 Responder a un Feedback

**IMPORTANTE:** Para que el mensaje aparezca en el UI, hay que insertarlo en `feedback_messages`, NO en `user_feedback.admin_response`.

```javascript
// 1. Buscar la conversación del feedback
const { data: conv } = await supabase
  .from('feedback_conversations')
  .select('id')
  .eq('feedback_id', feedbackId)
  .single();

// 2. Obtener un sender_id de admin válido
const { data: adminMsg } = await supabase
  .from('feedback_messages')
  .select('sender_id')
  .eq('is_admin', true)
  .limit(1)
  .single();

// 3. Insertar el mensaje
await supabase
  .from('feedback_messages')
  .insert({
    conversation_id: conv.id,
    sender_id: adminMsg.sender_id,
    is_admin: true,
    message: 'Hola [Nombre],\n\n[Tu respuesta]\n\nEquipo de Vence'
  });
```

> **⚠️ OBSOLETO (pre-14/04/2026):** el fragmento anterior insertaba directamente en `feedback_messages` y confiaba en un trigger PG para email + campana. **Ese trigger fue eliminado.** Ahora hay que llamar al endpoint **`POST /api/v2/feedback/respond`** que hace INSERT msg + campana + email de forma atómica. Ver manual dedicado `docs/procedures/gestionar-feedback-bug.md` §10 con el patrón completo.

### 14.4 Cerrar un Feedback

**⚠️ IMPORTANTE:** NO cerrar la conversación manualmente. El sistema la cierra automáticamente si el usuario no responde en unos días.

Después de responder:
1. La conversación queda en `waiting_user`
2. Si el usuario responde, vuelve a aparecer como pendiente
3. Si no responde en X días, se cierra automáticamente

```javascript
// Solo actualizar el feedback si es necesario (opcional)
await supabase
  .from('user_feedback')
  .update({ status: 'resolved' })
  .eq('id', feedbackId);

// ❌ NO HACER: cerrar conversación manualmente
// await supabase
//   .from('feedback_conversations')
//   .update({ status: 'closed' })
//   .eq('feedback_id', feedbackId);
```

### 14.5 Corregir Fechas (si se alteraron)

Si el `updated_at` se actualizó y las conversaciones aparecen desordenadas:

```javascript
// Restaurar updated_at al valor original (created_at)
await supabase
  .from('user_feedback')
  .update({ updated_at: originalCreatedAt })
  .eq('id', feedbackId);
```

### 14.6 Estados de Conversación

| Estado | Significado |
|--------|-------------|
| `open` | Conversación activa |
| `waiting_user` | Admin respondió, esperando usuario |
| `closed` | Conversación cerrada |

### 14.7 El UI muestra "X por responder" cuando:

- La conversación NO está cerrada (`status != 'closed'`)
- Y el último mensaje NO es del admin (`is_admin = false`)
- O la conversación está vacía (sin mensajes)

### 14.8 Flujo Completo para Responder Feedback

```
1. "revisar si hay nuevas impugnaciones pendientes o feedback"
   ↓
2. Claude muestra feedbacks pendientes con resumen
   ↓
3. "investiga el feedback de [usuario]"
   ↓
4. Claude obtiene: user_id, mensaje, URL, user_agent (móvil/PC)
   ↓
5. Claude investiga eventos del usuario si es necesario
   ↓
6. Claude propone respuesta personalizada
   ↓
7. Usuario aprueba → Claude inserta en feedback_messages y cierra
```

### 14.9 Ejemplo Real: Usuario no puede guardar PDF

**Feedback recibido:**
```
Usuario: Osruben 7 (osruben75@gmail.com)
Plan: FREE
Mensaje: "Hola.como se guarda el PDF no me deja gracias"
URL: /tramitacion-procesal/temario/tema-6
User Agent: Android 10 / Chrome Mobile
```

**Investigación:**
- Usuario registrado hace 3 minutos (nuevo)
- Estaba en la página del temario
- Usa móvil Android

**Diagnóstico:**
- El PDF está disponible para usuarios FREE (no hay restricción)
- En móvil, `window.print()` abre diálogo del sistema
- Hay que elegir "Guardar como PDF" en vez de impresora

**Respuesta enviada:**
```
Hola Ruben,

Para guardar el PDF desde el móvil:
1. Pulsa el botón "Imprimir PDF"
2. En el diálogo que aparece, elige "Guardar como PDF" (en vez de una impresora)
3. Se descargará a tu carpeta de descargas

Un saludo,
Equipo de Vence
```

**Código ejecutado:**
```javascript
const conversationId = "97dc13f3-c103-4a01-8a35-81ef14b79949";
const adminId = "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f"; // Admin que responde

// 1. Insertar mensaje en la conversación
await supabase
  .from("feedback_messages")
  .insert({
    conversation_id: conversationId,
    sender_id: adminId,
    is_admin: true,
    message: mensaje
  });

// 2. Actualizar timestamp de la conversación (NO cerrar)
await supabase
  .from("feedback_conversations")
  .update({
    status: "waiting_user",  // Esperando respuesta del usuario
    last_message_at: new Date().toISOString()
  })
  .eq("id", conversationId);

// ❌ NO cerrar manualmente - el sistema lo hace automáticamente
```

### 14.10 Cómo Investigar al Usuario

Para entender mejor el contexto del feedback:

```javascript
// 1. Datos del feedback
const { data: feedback } = await supabase
  .from("user_feedback")
  .select("*")
  .eq("id", feedbackId)
  .single();

// user_agent revela: móvil vs PC, navegador, sistema operativo
console.log("User Agent:", feedback.user_agent);
// Ej: "Mozilla/5.0 (Linux; Android 10; K)..." = Móvil Android

// 2. Perfil del usuario
const { data: profile } = await supabase
  .from("user_profiles")
  .select("full_name, email, plan_type, created_at, target_oposicion")
  .eq("id", feedback.user_id)
  .single();

// 3. Eventos recientes (si existen)
const { data: events } = await supabase
  .from("user_events")
  .select("event_type, page_url, created_at")
  .eq("user_id", feedback.user_id)
  .gte("created_at", fechaHoy)
  .order("created_at", { ascending: true });
```

### 14.11 Obtener Admin ID para Respuestas

El `sender_id` debe ser un admin válido. Para obtenerlo:

```javascript
// Buscar un admin que haya respondido antes
const { data: adminMsg } = await supabase
  .from("feedback_messages")
  .select("sender_id")
  .eq("is_admin", true)
  .limit(1)
  .single();

const adminId = adminMsg.sender_id;
// Resultado: "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f" (Manuel)
```

---

## 15. Sistema de Notificaciones Automáticas

Las notificaciones (email + campana) al cerrar una impugnación o responder a un feedback ya **NO** dependen de triggers PostgreSQL llamando a HTTP. Tras el incidente del 14/04/2026 (ver §16) se migró a un patrón **in-process**: el endpoint admin que actualiza la BD también envía el email en el mismo flujo TypeScript.

### 15.1 Impugnaciones (legislativas + psicotécnicas) — POST-14/04/2026

**Endpoint:** `POST /api/v2/dispute/resolve`
**Función:** `resolveDispute()` en `lib/api/v2/dispute/queries.ts`
**Auth:** `requireAdmin` (Bearer token de admin)

**Flujo:**
1. Validación Zod del body (`resolveDisputeRequestSchema`).
2. Carga de la disputa con LEFT JOIN a `user_profiles` y `questions`/`psychometric_questions`.
3. Idempotencia: si `status` ya es `resolved`/`rejected` → 409.
4. UPDATE atómico de la disputa.
5. Llamada **directa** a `sendEmailV2(...)` (sin saltos HTTP, dentro del mismo contenedor Vercel del admin → sin cold start).
6. Respuesta tipada con `emailSent`, `emailId`, `emailError`, `emailSkipReason`.

**Trigger PG eliminado:** los triggers `trigger_send_dispute_email` y `trigger_send_psychometric_dispute_email`, junto con sus funciones, **se eliminaron** vía `database/migrations/2026-04-14-drop-dispute-email-triggers.sql`.

**Endpoints HTTP legacy:** `/api/send-dispute-email` y `/api/send-dispute-email/psychometric` se mantienen temporalmente por compatibilidad pero ya no son llamados por nada interno. Pueden eliminarse en commit posterior si nada externo los necesita.

**Por qué se eliminaron los triggers (resumen):** ver §16.

### 15.2 Feedbacks (post-14/04/2026) — POST `/api/v2/feedback/respond`

**Endpoint:** `POST /api/v2/feedback/respond`
**Función:** `respondFeedback()` en `lib/api/v2/feedback/queries.ts`
**Auth:** `requireAdmin` (Bearer token).

**Flujo:**
1. Valida body con Zod (`respondFeedbackRequestSchema`).
2. Carga feedback + conversation + usuario con LEFT JOIN.
3. En una transacción Drizzle: INSERT `feedback_messages` + INSERT `notification_logs` (campana) + UPDATE `feedback_conversations` + UPDATE `user_feedback` (status final).
4. Fuera de la TX (para no rollback por Resend caído): llama a `sendEmailV2` si el mensaje no está vacío, respetando `isUserActivelyBrowsing` + preferencias del usuario.
5. Devuelve respuesta tipada con `messageId`, `bellSent`, `emailSent`, `emailError`, `emailSkipReason`, `bellSkipReason`, `finalStatus`.

**Trigger PG eliminado:** `trigger_send_feedback_notification` y su función se eliminaron vía `database/migrations/2026-04-14-drop-feedback-trigger.sql`. Razón: mismo bug de cold-start que tenían los triggers de impugnaciones.

**Semántica decidida:** admin reply = feedback `'resolved'`. Si el usuario responde, `/api/feedback/message` lo reabre a `'pending'`.

**Manual detallado:** `docs/procedures/gestionar-feedback-bug.md` §10.

### 15.3 Arquitectura (post-14/04/2026)

```
┌─────────────────────────────────────────────────────────────┐
│ Admin UI /admin/impugnaciones   /admin/feedback             │
│ Scripts Claude                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch + Bearer admin
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Endpoint v2 (requireAdmin + Zod + withErrorLogging)         │
│  - POST /api/v2/dispute/resolve     (impugnaciones)         │
│  - POST /api/v2/feedback/respond    (feedbacks)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ resolveDispute() / respondFeedback()
                           │ (in-process, Drizzle TX)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ - UPDATE / INSERT en BD (Drizzle)                           │
│ - sendEmailV2() directo (misma función JavaScript)          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Resend (email) + email_events (logs éxito/fallo)            │
└─────────────────────────────────────────────────────────────┘
```

**No hay triggers PG intermedios. Cero HTTP calls internos. Cero cold-start posible.**

### 15.4 Dependencia: Extensión `http`

Los triggers usan la extensión PostgreSQL `http` para hacer llamadas HTTP. Esta extensión debe estar habilitada en Supabase:

```sql
-- Verificar que la extensión está habilitada
SELECT * FROM pg_extension WHERE extname = 'http';
```

### 15.5 Verificar que los Triggers Existen

```sql
-- Listar triggers en question_disputes (legislativas)
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'question_disputes';

-- Listar triggers en psychometric_question_disputes (psicotécnicas)
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'psychometric_question_disputes';

-- Listar triggers en feedback_messages
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'feedback_messages';
```

### 15.6 URL Base de los Triggers

Los triggers usan `current_setting('app.base_url', true)` con fallback a `https://www.vence.es`. Si se necesita cambiar la URL (ej: staging):

```sql
-- Cambiar URL base (solo para la sesión actual)
SET app.base_url = 'https://staging.vence.es';
```

### 15.7 Debugging del flujo nuevo (post-14/04/2026)

Si un email no se envía:

1. **Comprobar la respuesta del endpoint:** `result.emailSent`, `result.emailError`, `result.emailSkipReason`.
2. **Si `emailSkipReason === 'empty_response'`:** el adminResponse iba vacío → comportamiento esperado.
3. **Si `emailSkipReason === 'no_user_email'`:** el usuario no tiene email en `user_profiles` → arreglar a mano.
4. **Si `emailSkipReason === 'user_preferences'`:** el usuario optó por no recibir email de soporte → respetar.
5. **Si `emailError` está set:** error real de Resend o sendEmailV2. Mirar `email_events` por `event_type='failed'` y reintentar manualmente vía endpoint admin.
6. **Reintento manual:** llamar de nuevo al endpoint `/api/v2/dispute/resolve`. Como la disputa ya estará `resolved`/`rejected`, devolverá 409 — para reintentar **solo el email** habrá que añadir un endpoint específico (pendiente Fase 5).

> **⚠️ Gotcha recurrente — respuesta HTML 502/504 del proxy (visto 2× el 01/06/2026):** a veces `/api/v2/dispute/resolve` devuelve **HTML de error (504/502)** en lugar del JSON, porque el proxy/CDN corta por timeout **después** de que el UPDATE de la disputa ya se aplicó pero **antes** (o durante) del `sendEmailV2`. Resultado: la disputa queda `resolved`/`rejected` con `admin_response` correcto y campana enviada, **pero el email NO sale** (no hay fila en `email_events`). Síntoma desde script: `res.json()` peta con "Unexpected token '<'".
>
> **Workaround probado (mientras no exista el endpoint de solo-email de Fase 5):** **reabrir la disputa a `pending`** (`UPDATE question_disputes SET status='pending', admin_response=null, resolved_at=null WHERE id=...`) y **volver a llamar** a `/api/v2/dispute/resolve` con el mismo `adminResponse`. El segundo intento hace UPDATE+email limpios. Verificar SIEMPRE el resultado mirando `email_events` por el email del usuario (no fiarse del HTTP), porque el endpoint puede haber cortado aunque el cierre se aplicara. Patrón de script: si `result.emailSent !== true`, reabrir y reintentar una vez.
>
> **⚠️ El mismo 504 pasa en `/api/v2/feedback/respond` (feedbacks), pero el workaround NO es el mismo:** reintentar allí **DUPLICA el mensaje**, porque ese endpoint hace INSERT en `feedback_messages` (que ya commiteó) — no un UPDATE reabrible como aquí. Ver el matiz completo en `docs/procedures/gestionar-feedback-bug.md` §Paso 10 Notas.

### 15.8 Histórico: trigger de feedbacks (eliminado 14/04/2026)

El trigger `trigger_send_feedback_notification` (AFTER INSERT en `feedback_messages`) tenía el mismo problema de cold-start que los de impugnaciones. Se eliminó el mismo día y se sustituyó por el flujo in-process `respondFeedback()` / `POST /api/v2/feedback/respond` descrito en §15.2.

Migración documentada en §16 y en `docs/procedures/gestionar-feedback-bug.md`.

---

## 16. Incidente 14/04/2026 — Cold-start de triggers PG y migración a in-process

**Resumen:** los triggers PG `send_dispute_email_notification` y `send_psychometric_dispute_email_notification` fallaban en silencio cuando el endpoint Vercel correspondiente estaba frío. Diagnosticado tras detectar 6 impugnaciones psicotécnicas resueltas el 14/04/2026 cuyo email **nunca llegó al usuario**.

**Hipótesis confirmada empíricamente:**
- Test controlado: insert + UPDATE de una dispute psicotécnica de prueba → el `UPDATE` tardó 3,8 segundos.
- Esos 3,8s son consistentes con un **timeout de la extensión `http`** (default 5s) esperando respuesta de Vercel.
- Endpoints "activos" (legislativa, llamada >10x/día) → contenedor Vercel caliente → respuesta <500ms → trigger funciona "por suerte".
- Endpoints "rara vez llamados" (psicotécnica, ≤1x/día) → cold start de Vercel >5s → `http_post` da timeout → la función PG captura excepción con `EXCEPTION WHEN OTHERS` y solo emite `RAISE WARNING` que no es visible desde Supabase Dashboard.

**Por qué se descartaron alternativas:**

| Alternativa | Por qué no |
|---|---|
| Migrar trigger a `pg_net` (async) | Sigue acoplando BD a HTTP. No corrige la causa raíz. Mejor que `http`, pero no necesario para nuestro volumen. |
| Outbox pattern (cola en BD + cron worker) | Robusto pero overkill para 20 emails/semana. Cron requiere GitHub Actions cada 2 min → emails llegan en ráfagas, mala UX. |
| Inngest / QStash externos | Añade dependencia externa. No queríamos. |
| Database Webhooks de Supabase | Mismo problema de cold-start (llama HTTP). Configuración fuera del repo (no versionable). |

**Decisión adoptada:** **`resolveDispute()` in-process**. El admin (UI o script) llama al endpoint `/api/v2/dispute/resolve` que está dentro del mismo contenedor Vercel ya caliente sirviendo al admin. La función:
1. Hace UPDATE en BD.
2. Llama directamente a `sendEmailV2(...)` (función JavaScript, no HTTP) → sin cold start posible.
3. Devuelve resultado tipado.

Sin colas, sin crons, sin dependencias externas, sin tablas nuevas. ~80 líneas de código.

**Fases del rollout (impugnaciones):**
1. ✅ Función `resolveDispute()` + endpoint + tests (commit `1f9f4559`).
2. ✅ Refactor de `/api/v2/admin/disputes` POST para usar el nuevo endpoint internamente (commit `68a08dfc`).
3. ✅ Migration SQL aplicada en Supabase: triggers `trigger_send_dispute_email` y `trigger_send_psychometric_dispute_email` eliminados.
4. ✅ Endpoints legacy `/api/send-dispute-email` y `/api/send-dispute-email/psychometric` eliminados (commit `3774509e`).
5. ✅ Manual actualizado (§6, §15, §16).
6. ✅ E2E en producción confirmado (15/15 tests).

**Fases del rollout (feedback — misma fecha 14/04/2026):**
1. ✅ Función `respondFeedback()` + endpoint `/api/v2/feedback/respond` + 32 tests unit + 10 E2E.
2. ✅ Auth Bearer admin en `/api/send-support-email` (el legacy, antes público).
3. ✅ Admin UI `/admin/feedback` refactorizado: los 3 flujos (sendAdminMessage, sendInlineMessage, createAdminConversation) delegan en el endpoint v2.
4. ✅ Migration SQL aplicada: trigger `trigger_send_feedback_notification` eliminado.
5. ✅ Endpoint `/api/admin/feedback/message` eliminado (action='send_message' huérfana) + limpieza de `adminSendMessage()` / `createConversation()`.
6. ✅ Manual `docs/procedures/gestionar-feedback-bug.md` §10 actualizado.

**Lección general:** triggers PG llamando a HTTP desde Postgres son frágiles ante cold-starts de stack serverless. Cuando el productor del UPDATE es siempre código de la app (no jobs externos), preferir flujo in-process síncrono. Este patrón se aplicó a todos los flujos de notificación internos del 14/04/2026 (impugnaciones legislativas + psicotécnicas + feedback). Si aparecen nuevos casos similares, usar el mismo refactor.

## 🔀 EL BARAJADO YA ESTÁ ENCENDIDO (Valencia): la letra que dice el usuario NO es la de la BD

> ### 🟢 ESTADO — encendido el 28/07/2026, piloto en `auxiliar_administrativo_valencia`
> **Si la impugnación es de un usuario de Valencia, sus letras pueden no ser las nuestras.** En el
> resto de oposiciones, hoy, coinciden. Verificado al encenderlo: Valencia devuelve preguntas con
> `option_order` y `auxiliar_administrativo_estado`/`_madrid` devuelven 0.
>
> **Comprueba el alcance ACTUAL antes de fiarte de este párrafo** (el piloto se ampliará a más
> oposiciones, o se apagará si algo va mal):
> ```bash
> aws --profile vence --region eu-west-2 ssm get-parameters \
>   --names /vence-frontend/FEATURE_SHUFFLE_OPTIONS /vence-frontend/FEATURE_SHUFFLE_OPTIONS_SCOPE \
>   --query "Parameters[].[Name,Value]" --output text
> ```
> `FEATURE_SHUFFLE_OPTIONS=false` → nadie baraja. `_SCOPE` = CSV de `position_type`, o `all`.
>
> **Da igual lo que diga esto: el dossier lo resuelve solo** — mira la exposición REAL de esa
> persona, no la oposición. Pero saberlo evita leer el bloque 🔀 como si fuera ruido.
>
> Si aparece un `shuffle_option_order_invalid` en `observable_events`, es el detector de «clave
> rota» y **hay que apagar** (los comandos, en la ficha [T-080] del backlog). Seguimiento a los
> días: [T-235].

El serve permuta las opciones **por exposición** y guarda esa permutación en
`test_questions.option_order`. Así que cuando alguien escribe *«la opción C es errónea»* está
hablando de **la C que vio él**, que puede ser otra opción distinta en la BD. Analizar la C de la
BD sería diagnosticar la pregunta equivocada con total seguridad — y responderle nombrándole una
letra que él nunca vio.

**No hay que hacer nada a mano:** el dossier (`revisar-impugnacion.cjs`) reconstruye la exposición
más cercana a la fecha de la impugnación y, si estaba barajada, imprime el bloque

```
🔀 EL USUARIO VIO LAS OPCIONES BARAJADAS — sus letras NO son las de la BD:
   él vio A) = en BD es la C) …
   ⚠️ En su texto menciona: «C» → es la D) de la BD
      Analiza ESA opción, no la de su letra. Y al responderle, usa SU letra.
```

Si la exposición fue en orden natural lo dice también, en una línea. **Al redactar la respuesta,
usa la letra que vio el usuario**, no la de la BD: para él la nuestra no significa nada.

> ⚠️ **Y hay un tercer sitio donde las letras podían no cuadrar: la pantalla de REPASO** (`/revisar/<testId>`,
> que es donde está el botón de impugnar de un test ya terminado). Hasta el **01/08/2026** pintaba las
> opciones en el orden que vio el usuario pero resaltaba la correcta con la letra de la BD → **le
> señalaba la opción de al lado en el 77 % de las exposiciones barajadas** (446 de 577, 24 usuarios).
> Arreglado en **[T-472]** (`lib/shuffle/reviewCoords.ts`). **Para ti, al analizar:** si una
> impugnación de un usuario con barajado dice *«la correcta es X y no Y»* y **ambas opciones existen
> en la pregunta**, comprueba si su queja describe este desfase antes de tocar la pregunta — la
> pregunta puede estar impecable y el fallo ser nuestro, al enseñársela. Y **date cuenta de que
> tenía razón**: se cierra `resolved`, no `rejected`.

Mapeo y traducción son funciones puras (`mapaExposicion`, `traducirLetrasDelUsuario`) con 8 tests
en `__tests__/impugnaciones/dossierExposicionBarajada.test.ts`.

## 🔀 Explicación BARAJABLE: escríbela ya en el formato estructurado

> ### Aprovecha SIEMPRE la impugnación para dejar la pregunta barajable
>
> Una impugnación es la única ocasión en que alguien mira esa pregunta a fondo. Desaprovecharla
> significa que la pregunta sigue en el pozo de las **47.388 activas que hoy no pueden barajar**
> hasta que un barrido masivo la toque, quizá nunca. Dos caminos según lo que estés haciendo:
>
> | Situación | Qué haces |
> |---|---|
> | **Reescribes la explicación** (mejorable, cita mal, formato viejo) | Escríbela YA estructurada: `scripts/aplicar-explicacion.ts <qid> <fichero.json> --apply`. Nace barajable, sin paso que se pueda olvidar. |
> | **NO la reescribes** (la explicación está bien) | Prueba igualmente `scripts/backfill-explanation-data.ts --pregunta <qid> --apply`. Si está en formato canónico, la transcribe **sin cambiar una coma** (lo garantiza la guarda de no-regresión); si no puede, no toca nada y te lo dice. Cuesta dos segundos y la respuesta es binaria. |
>
> **No siempre saldrá, y no es un fallo tuyo.** El backfill solo mira el universo de los DOS formatos
> canónicos (el §8.1 de generación —«Por qué X es correcta» + «son incorrectas»— y el §5.1 de
> impugnaciones —arranca por «La respuesta correcta es»—) con `shuffle_mode='full'`. Una explicación
> en prosa con bullets sueltos queda fuera y devuelve `0 candidatas`. Ejemplo real (28/07,
> impugnación `1ef36204`, art. 81 Ley 39/2015): explicación correcta y bien argumentada, pero empieza
> por *"El artículo 81 de la Ley 39/2015 prevé dos informes…"*, así que ni entra. Ahí la única vía es
> reescribirla estructurada, y **solo merece la pena si además la explicación mejora**: reescribir una
> explicación buena únicamente para que baraje es cambiar lo que ve el opositor a cambio de nada.

> **¿En qué formato escribo la explicación? Escríbela YA en el NUEVO (estructurada).**
>
> Se escribe un JSON con una razón por opción —referida al CONTENIDO, nunca a la letra— y el
> texto de siempre lo **genera** la herramienta.
>
> ⚠️ **La regla «nunca la letra» vale IGUAL para el `intro` y el `outro`** (T-262, 29/07). Son los
> únicos campos que el render emite **verbatim en cualquier orden**: una letra ahí queda clavada y
> contradice a la que calcula el render («La respuesta correcta es la **C**.» arriba, «**A)** …»
> debajo). NO abras el `intro` anunciando la clave —esa línea la pone el render con la letra que
> toque— ni cierres el `outro` con «**Clave:** la B es…»; escríbelos por contenido («**Clave:** el
> art. 13.1 no admite siglas ni abreviaturas en ningún caso»). El aplicador **rechaza** el JSON si
> encuentra una letra ahí, así que lo sabrás antes de aplicar. Cómo se llegó a 1.211 explicaciones
> así y cómo se reparan (`npm run shuffle:narrativa`):
> `docs/roadmap/barajar-opciones-verificacion-robusta.md`.
>
> ```bash
> npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply
> ```
>
> Escribe las DOS columnas coherentes: `explanation_data` (la estructura) y `explanation` (el
> texto renderizado). **Desde el 28/07 producción ya sirve desde la estructura** cuando existe, así
> que lo que el opositor lee es el render; `explanation` se conserva como red de seguridad y es lo
> que se sirve en las preguntas que aún no la tienen. La pregunta nace **barajable** y no hay
> ningún paso que se pueda olvidar.
>
> **Por qué así y no al revés:** escribir el texto y parsearlo después es heurístico y falla
> —medido el 27/07: solo se transcribe el 43,7% del formato de generación y el 15,3% del de
> impugnaciones—. De la estructura al texto, en cambio, es un render determinista: no puede
> fallar. El parseo se reserva para el HISTÓRICO, que es lo único que no se puede reescribir.
>
> Rechaza razones que digan «la opción A», «como se ha visto en la primera»… porque al barajar
> dejan de ser ciertas. Y para lo antiguo sigue existiendo el camino inverso:
> `scripts/backfill-explanation-data.ts`.
>
> **La cita va en `{"cita": {"ref": "Artículo 4.1 CE", "texto": "…literal…"}}`** y el render la
> compone en dos líneas de blockquote. `validar-explicacion.cjs` **acepta esa forma** desde el
> 27/07: ignora la línea de la referencia (que nunca está dentro del artículo) y sigue exigiendo
> literal el texto entrecomillado. Antes la tumbaba como *«posible cita inventada»* — si ves ese
> mensaje hoy, la cita está mal de verdad, no es el guardarraíl.
>
> **Si el aplicador avisa de que la pregunta queda `unsafe`, tu explicación NO está mal.** Consulta
> el detector de opciones cruzadas: cuando una OPCIÓN cita a otra por su letra («La respuesta b) es
> correcta y además…»), esa pregunta no puede barajarse aunque la explicación sea perfecta. El
> bloqueo está en el enunciado de las opciones, y arreglarlo es otra decisión (reescribirlas cambia
> la pregunta). Lo que no hace ya es marcarla barajable a ciegas y dejar que el sweep nocturno lo
> descubra después.

Desde el 27/07/2026 la explicación puede vivir en dos sitios: el texto de siempre (`explanation`)
y la versión ESTRUCTURADA (`explanation_data`), con las razones keadas a cada opción y sin letras
dentro. **Los dos conviven a propósito** mientras se transcribe el histórico; el barajado de
opciones se encenderá cuando la cobertura sea suficiente.

Por qué te afecta: una explicación que cita las opciones por letra («la B es correcta») **impide
barajar esa pregunta para siempre** (medido el 27/07: 47.388 activas bloqueadas solo por eso).
Si corriges una explicación y la dejas únicamente en texto, la pregunta sigue bloqueada.

**Si has usado `aplicar-explicacion.ts`, aquí no hay nada más que hacer**: esa herramienta escribe
las dos columnas y la pregunta ya nace estructurada. El comando de abajo es para el OTRO caso —una
explicación que no has reescrito, o que escribiste a mano en el formato de siempre:

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
