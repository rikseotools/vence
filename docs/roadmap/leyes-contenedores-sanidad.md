# Pista B — Artículos virtuales de temario (sanidad/TCAE/Correos): dar teoría real a preguntas colgadas de placeholders vacíos

> **Origen (02/06/2026):** la auditoría del lote "Aula Plus - Legislación autonómica" destapó que muchas preguntas cuelgan de **artículos-placeholder vacíos** (contenedores de tema sin contenido). Al escanear bank-wide, el problema es mucho mayor: **~28.838 preguntas activas** sobre **64 artículos-placeholder vacíos**.

## Problema

Un artículo-placeholder es una fila en `articles` que existe como "contenedor de tema" pero con `content` vacío. Consecuencias:
1. **El opositor no tiene teoría que estudiar** — el tema sale "en blanco".
2. **Se incumple la regla del artículo literal** — el `primary_article_id` no contiene la respuesta.
3. **El gate de lifecycle** (`transition_question_state`, ver `revisar-preguntas-con-agente.md` §19) impide auto-aprobar como perfectas las preguntas con `article_ok=false`; con placeholder vacío, `article_ok` nunca puede ser `true`.

## Objetivo

Para cada contenedor: **crear/importar los artículos con la teoría que responde literalmente las preguntas, con fuente oficial/autorizada**, re-distribuir las preguntas a su sub-artículo, re-verificar y dejar `article_ok=true`. Es el mismo patrón de la **completación de informática (16/05/2026)** y de la **Ley SO agnóstica de Galicia**, a escala de temario.

## ⭐ Principio rector: ESCALABLE y CROSS-OPOSICIÓN

El contenido se crea **una sola vez** y sirve a **todas las oposiciones de todas las CCAA y entidades**. No se duplica por comunidad.

- **Contenido AGNÓSTICO = artículo canónico ÚNICO compartido**, mapeado a las oposiciones vía `topic_scope`. Aplica a lo que es igual en todas partes:
  - **Clínico TCAE/Celador/Enfermería** (esterilización, movilización, RCP, higiene, úlceras, constantes, oxigenoterapia, sondajes…): una esterilización es idéntica en SERGAS (Galicia), SALUD (Aragón), Osakidetza (Euskadi), SERMAS (Madrid), SMS (Murcia), SAS (Andalucía)… → **un solo juego de artículos** sirve a **todas** las CCAA.
  - **Informática, Inglés y normativa ESTATAL** (CE, Ley 39/2015, Ley 40/2015, EBEP, Estatuto Marco Ley 55/2003, LPRL…): canónico y compartido por todas las oposiciones (sanitarias y no sanitarias).
- **Contenido REGION-SPECIFIC = artículo propio por CCAA**, solo donde la norma es genuinamente autonómica: Ley de Salud de cada CCAA, decretos de provisión autonómicos, planes autonómicos (euskera, salud mental de X), estructura del servicio de salud de X.

**Regla de decisión al poblar un contenedor:** ¿el contenido sería idéntico en otra CCAA? → SÍ = canónico agnóstico (crear una vez, mapear a todas vía `topic_scope`); NO = region-specific (por CCAA).

**Anti-patrón a corregir:** parte de los 64 placeholders son **el mismo tema clínico duplicado** por fuente/CCAA. La escalabilidad exige **consolidar duplicados en el artículo canónico agnóstico** y re-mapear, no poblar cada copia. (Los contenedores clínicos grandes — "Esterilización y desinfección", "Movilización y posiciones"… — YA están nombrados de forma agnóstica, no por CCAA; el piloto los aprovecha tal cual.)

**Beneficio cross-oposición:** al dar de alta una oposición nueva de cualquier CCAA/entidad, sus temas clínicos/informática/inglés/estatales **reutilizan** el contenido canónico ya creado (cero re-trabajo); solo hay que crear lo autonómico propio. Cada artículo agnóstico poblado multiplica su valor por el nº de oposiciones que lo comparten.

## Alcance (bank-wide, 02/06/2026)

**~28.838 preguntas / 64 placeholders.** Familias principales:
- **TCAE clínico** (la mayor): Esterilización y desinfección (1.476), Movilización y posiciones (~1.348), Alimentación y nutrición (~1.066), Paciente quirúrgico (~970), Eliminación y sondajes (~903), Salud mental TCAE (~894), Urgencias y RCP (~852), Oxigenoterapia (~829), Funciones del TCAE (~816), Higiene del paciente (~790), Úlceras por presión (~777), Atención al anciano, Farmacología TCAE, Infecciones nosocomiales, Constantes vitales, Atención mujer gestante, Cuidados paliativos, Comunicación sanitaria, Muestras biológicas…
- **Correos**: T3 (~2.229), T4 (~1.348), T12 (~1.089), T9, T1, T7, T10, T8, T6…
- **Inglés** (PN ~681).
- **Legislativo sanitario autonómico**: Personal Estatutario SERGAS Galicia, Ley Salud y SALUD Aragón, LOSCAM Madrid/SERMAS, Derechos Usuarios SMS Murcia, planes Osakidetza, etc. (estos tienen norma real importable: BOE/BOA/DOG).

## Estrategia por contenedor

1. **Clasificar el contenedor:**
   - **Legislativo** (hay una norma real detrás) → importar/verificar el articulado real desde BOE/BOA/DOG y re-vincular (sub-track B1).
   - **Clínico / plan / editorial** (TCAE, Correos, Inglés) → construir **artículo(s) virtual(es)** con teoría de fuente autorizada (protocolos SAS/SERGAS/Osakidetza, Ministerio de Sanidad, manuales de referencia) (sub-track B2).
2. **Sourcing oficial obligatorio** (CLAUDE.md: nunca contenido sin verificar fuente). Verificar los hechos que las preguntas testan.
3. **Construir el/los artículo(s)** cubriendo las sub-materias reales (un contenedor suele tener 3-5 sub-artículos).
4. **Re-distribuir** las preguntas del placeholder a su sub-artículo por materia (clasificador por palabras clave + revisión).
5. **Re-verificar** las respuestas con el pipeline `topic-review/verify` (ahora posible porque hay contenido) → `article_ok=true` → pasan el gate.
6. **Triple auditoría** del contenido creado (auto + agente ciego + fix), como en los batches de informática.

## Plantilla validada — PILOTO: Esterilización y desinfección (✅ hecho 02/06)

Ley-contenedor `b239fadb` "Esterilización y desinfección" con 4 artículos (estaban vacíos, las 1.476 preguntas volcadas en el art.1):
- **art.1 Antisépticos y desinfectantes** — poblado (conceptos limpieza/desinfección/antisepsia/esterilización, antiséptico vs desinfectante, espectro bactericida/bacteriostático/fungicida/virucida, cualidades del desinfectante, niveles Spaulding, antisépticos y desinfectantes comunes). 1.063 preguntas.
- **art.2 Métodos de esterilización según tipo de material** — poblado (Spaulding crítico/semicrítico/no crítico; físicos: Poupinel/autoclave/radiaciones; químicos: óxido de etileno/plasma/glutaraldehído). 294 preguntas.
- **art.3 Tipos de controles** — poblado (físicos/químicos/biológicos, Bowie-Dick, Geobacillus stearothermophilus / Bacillus atrophaeus). 65 preguntas.
- **art.4 Manipulación y conservación del material estéril** — poblado (papel mixto/crepado, vida de anaquel, almacenamiento, manipulación). 54 preguntas.

**Cross-oposición YA REAL (validado):** esta ley canónica está mapeada vía `topic_scope` a **11 temas de 8 oposiciones de 8 CCAA/entidades**: Celador SCS Canarias, TCAE Canarias, TCAE SERMAS Madrid, Auxiliar Enfermería Osakidetza, TCAE Galicia, TCAE Murcia, Auxiliar Enfermería GVA (Valencia), TCAE Aragón. Es decir: **un solo juego de 4 artículos poblado → 8 oposiciones beneficiadas a la vez.** Confirma el principio rector en la práctica.

**Pendiente del piloto (fase 2):** correr `topic-review/verify` sobre las 1.476 → fijar `article_ok` por pregunta. (El contenido ya existe, así que ya es posible.)

## Priorización sugerida

Por impacto (nº preguntas) y facilidad de sourcing:
1. **TCAE clínico** (mayor volumen, fuente estándar y estable): tras Esterilización → Movilización, Alimentación, Paciente quirúrgico, Eliminación/sondajes, Higiene, Úlceras, Constantes vitales, Oxigenoterapia, Urgencias/RCP…
2. **Legislativo sanitario** (B1, importar norma real): SERGAS, SALUD Aragón, LOSCAM Madrid, Ley 3/2009 Murcia, etc.
3. **Correos** e **Inglés** (editorial, requiere fuente de temario específica).

## Calidad y gobernanza
- Fuente oficial/autorizada por artículo (sin esto NO se crea contenido).
- Triple auditoría del artículo y de las preguntas que cuelgan.
- El gate de lifecycle garantiza que nada se auto-aprueba como perfecto hasta tener `article_ok=true` real.
- Idealmente, workflow por contenedor (sourcing → redacción → auditoría por sub-materia) para escalar.

## Estado
- 02/06: alcance medido (28.838/64) + **piloto Esterilización completado** (4 artículos poblados + 1.476 re-distribuidas). Pendiente fase 2 del piloto (re-verificación) y el resto de los 63 contenedores.
