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
- 02/06: alcance medido (28.838/64).
- ✅ **Contenedor 1 — Esterilización y desinfección** (`b239fadb`): 4 artículos poblados + 1.476 re-distribuidas. Cross-oposición: 8.
- ✅ **Contenedor 2 — Movilización y posiciones** (`0be3a9c2`): 5 artículos poblados (Posición anatómica/posiciones del paciente, Preparación de camas, Cambios posturales, Drenajes y catéteres, Deambulación y traslado) + 1.305 re-distribuidas (posiciones 848, camas 176, deambulación 180, cambios 80, drenajes 21). Cross-oposición: 7.
- ✅ **Contenedor 3 — Alimentación y nutrición** (`811f6470`): 4 artículos poblados (Clasificación de alimentos, Dietas terapéuticas, Vías de alimentación, Nutrición enteral por SNG) + 1.083 re-distribuidas (clasificación 628, dietas 270, SNG 98, vías 87). Cross-oposición: 7. Fuentes: factores de Atwater, rueda de los alimentos SEDCA (7 grupos), vitaminas carenciales, tipos de sonda (Levin/Salem/Foucher).
- ✅ **Contenedor 4 — Paciente quirúrgico** (`8f12fd67`): 4 artículos poblados (Posiciones para exploración, Material médico-quirúrgico, Preoperatorio, Intervención y postoperatorio) + 762 re-distribuidas (material 301, posiciones 245, interv/postop 149, preop 67). Cross-oposición: 6. Fuentes: instrumental de hemostasia (Crile/mosquito/Kocher/Pean), pinza de campo Backhaus, Magill, clasificación de heridas quirúrgicas.
- ✅ **Contenedor 5 — Eliminación y sondajes** (`bf443efe`): 5 artículos poblados (Diuresis y defecación, Bolsas de diuresis, Enemas, Sondajes urinarios/digestivos/rectales, Ostomías) + 950 re-distribuidas (diuresis/defecación 417, enemas 255, sondajes 181, ostomías 96). Cross-oposición: 7. Fuentes: sondas vesicales (Foley/Nélaton/Tiemann/Couvelaire), calibre French, tipos de enema, contraindicaciones.
- ✅ **Contenedor 6 — Higiene del paciente** (`c50356ee`): 4 artículos (Concepto, Piel y faneras, Encamado total/parcial, Baño asistido) + 839 re-distribuidas (piel/capilar 462, encamado 178, concepto 185, baño 14). Cross-oposición: 8. Fuentes: lesiones elementales de la piel, higiene de zonas específicas.
- ✅ **Contenedor 7 — Úlceras por presión** (`e840d65f`): 4 artículos (Concepto/estadios, Localización y factores, Prevención, Cambios posturales/piel) + 789 re-distribuidas (localiz/factores 336, concepto/estadios 301, prevención 91, cambios/piel 61). Cross-oposición: 7. Fuentes: estadios GNEAUPP/NPUAP, escala Norton, factores intrínsecos/extrínsecos.
- ✅ **Contenedor 8 — Constantes vitales** (`15370683`): 4 artículos (Principios, Técnicas de toma, Gráficas y registros, Balance hídrico) + 721 re-distribuidas (principios 592, gráficas 51, técnicas 42, balance 36). Cross-oposición: 6. Fuentes: valores normales FC/FR/TA, clasificación de la fiebre.
- ✅ **Contenedor 9 — Oxigenoterapia** (`1de4dd6e`): 3 artículos (Métodos de administración, Precauciones, Limpieza del material) + 851 re-distribuidas (métodos 778, precauciones 70, limpieza 3). Cross-oposición: 7. Fuentes: dispositivos bajo/alto flujo, mascarilla Venturi (FiO2 controlada).
- ✅ **Contenedor 11 — Salud mental TCAE** (`9736a577`): 3 artículos (Problemas de salud mental, Alcoholismo y drogodependencias, Técnicas de inmovilización) + 846 re-distribuidas (problemas SM 580, alcohol/drogas 180, inmovilización 86). Cross-oposición: 7. Fuentes: clasificación de drogas OMS, delirium tremens, contención mecánica.
- ✅ **Contenedor 12 — Urgencias y RCP** (`c2bdfd5b`): 6 artículos (Concepto, Primeros auxilios/politrauma/quemados, Shock/intoxicación/heridas/hemorragias, RCP básica, Carro de parada, Inmovilizaciones/traslado) + 861 re-distribuidas. Cross-oposición: 8. Fuentes: RCP básica ERC 2021 (30:2, 100-120/min, 5-6cm), regla de Wallace, tipos de shock, antídotos.
- ✅ **Contenedor 13 — Farmacología TCAE** (`05b32ba3`): 4 artículos (Tipos de medicamentos, Vías de administración, Precauciones, Conservación) + 717 re-distribuidas (tipos 480, vías 167, conservación 61, precauciones 9). Cross-oposición: 6. Fuentes: símbolos del envase, formas farmacéuticas, vías, LADME.
- ✅ **Contenedor 14 — Atención al anciano** (`49e19e67`): 4 artículos (Concepto/cambios del envejecimiento, Promoción y educación, Apoyo a la persona cuidadora, Atención a la demencia) + 859 re-distribuidas (envejecimiento 657, demencia 163, cuidador 36). Cross-oposición: 7. Fuentes: índice de Katz/Barthel/Lawton, cambios del envejecimiento, demencias.
- ✅ **Contenedor 15 — Infecciones nosocomiales** (`474b1307`): 4 artículos (Definición/cadena epidemiológica, Barreras higiénicas, Tipos de aislamiento, Lavado de manos) + 614 re-distribuidas. Cross-oposición: 8. Fuentes: cadena epidemiológica, tipos de aislamiento, índice de Swaroop, OMS 5 momentos higiene de manos.
- ✅ **Contenedor 16 — Atención mujer gestante** (`66c359d7`): art1 RENOMBRADO a "Atención al embarazo, parto y recién nacido" (el contenedor cubre obstetricia+neonatología+pediatría, mucho más que los 3 títulos) + Higiene durante el embarazo + Ejercicio y reposo. 574 re-distribuidas (general 556, higiene 2, ejercicio/reposo 16). Fuentes: ácido fólico/listeriosis, fases del parto, test de Apgar (5 parámetros), constantes RN (FC 120-160), reflejos Moro/Babinski, vérnix, IgG placenta, posiciones lactancia, edad pediátrica 14a (MedlinePlus, HealthyChildren AAP, inatal, SalusPlay).
- ✅ **Contenedor 17 — Cuidados paliativos** (`4c8d9a57`): 4 artículos (Actitud ante la muerte/paliativos, Duelo, Apoyo al cuidador y familia, Cuidados post mortem) + 545 re-distribuidas (art1 316, duelo 94, cuidador 23, post mortem 112). Fuentes: escalera analgésica OMS, vía oral prioritaria, síntoma refractario, modelo Kübler-Ross, fenómenos cadavéricos precoces/tardíos, amortajamiento TCAE (OMS/SEOM, Ocronos, manualclinico HUVR).
- ✅ **Contenedor 18 — Comunicación sanitaria** (`f36de7ef`): 4 artículos (Concepto y tipos, Habilidades, Empatía y escucha activa, Relación de ayuda y control del estrés) + 542 re-distribuidas (art1 371, habilidades 52, empatía/escucha 86, ayuda/estrés 33). Fuentes: elementos del proceso comunicativo, barreras, asertividad, relación de ayuda Carl Rogers, burnout.
- ✅ **Contenedor 19 — Muestras biológicas** (`9712d340`): 3 artículos (Concepto y tipos, Procedimientos de toma, Manipulación/transporte/conservación) + 443 re-distribuidas (art1 129, procedimientos 230, transporte 84). Fuentes: orina 24h, urocultivo chorro medio, hemocultivo en pico febril, transporte sin agitación/luz (HUSC, H. Macarena SAS, Enfermería Práctica, HUVN).
- ✅ **Contenedor 20 — Documentación sanitaria** (`2069097c`): 4 artículos (Doc. clínica y no clínica, Sistemas de información AP/Hospital, Servicio de admisión y atención al usuario, Consentimiento informado) + 275 re-distribuidas (art1 206, SI 22, admisión 30, CI 17). Fuentes: HC Ley 41/2002, exploración física, carta de servicios, CI por representación.
- ✅ **Contenedor 21 — Bioética sanitaria** (`2a8aa2bd`): 3 artículos (Principios fundamentales, Dilemas éticos, Secreto profesional) + 253 re-distribuidas (art1 165, dilemas 34, secreto 54). Fuentes: 4 principios Beauchamp-Childress, DVA, signos de muerte cierta (apnea/asistolia/midriasis), excepciones del secreto, LO 3/2021 eutanasia.
- ✅ **Contenedor 22 — Termoterapia y crioterapia** (`fd4bd49a`): 3 artículos (Indicaciones frío/calor, Efectos sobre el organismo, Procedimientos y precauciones) + 253 re-distribuidas (art1 87, efectos 22, procedimientos 144). Fuentes: termoterapia/crioterapia, vasodilatación/vasoconstricción, calor/frío seco y húmedo, crenoterapia/talasoterapia, 15-20 min.
- ✅ **Contenedor 23 — Residuos sanitarios** (`371d36e9`): 3 artículos (Clasificación, Transporte/eliminación/tratamiento, Manipulación de citostáticos) + 163 re-distribuidas (art1 108, transporte 27, citostáticos 28). Fuentes: clasificación 4 grupos (variación CCAA, Madrid 7 clases), Grupo III biosanitarios especiales, cortopunzantes galga 69, citostáticos cabina flujo laminar (Comunidad Madrid, EHU, SAS).
- ✅ **Contenedor 24 — Trabajo en equipo sanitario** (`15f0eb91`): 3 artículos (Concepto de equipo/multidisciplinar, Integración-consenso-motivación, Colaboración con otros profesionales) + 73 re-distribuidas (art1 41, integración/motivación 18, colaboración 14). Fuentes: equipo multidisciplinar, cohesión, motivación/satisfacción laboral, notificación de incidentes.
- ✅ **Contenedor 25 — Informática básica TCAE** (`67795461`): artículo único poblado (hardware/software, periféricos, redes LAN/MAN/WAN, IP/Internet/Intranet, correo CC/CCO, ofimática) + 22 preguntas. Cross-oposición: contenido agnóstico de informática básica.

### ✅ TODOS los contenedores clínicos/generales TCAE COMPLETADOS (1-25, ~16.400q)

### 🟢 PISTA B1 — Legislativo sanitario regional (importar norma real contra fuente oficial)

> 🚨 **CORRECCIÓN DE MÉTODO (02/06, Manuel):** para leyes legislativas, **resumir/agrupar temáticamente es chapuza**. Lo correcto (manual `monitoreo-boe-y-crear-leyes-nuevas.md`, regla PROHIBIDO truncar/parafrasear): **crear la ley real con su ARTICULADO LITERAL del BOE y vincular cada pregunta a su artículo real**. El primer intento de los contenedores 26-29 fue resumen temático → hay que rehacerlos literales. Método validado: `/api/verify-articles/sync-all` da **504 en producción** (CloudFront), así que se usa la **API de datos abiertos del BOE** (`/datosabiertos/api/legislacion-consolidada/id/<BOE-ID>/texto/indice` + `/texto/bloque/aN`) que devuelve el texto literal por `<p>`. Secuencia: aparcar preguntas en `_tmp_hold` → borrar artículos inventados → insertar articulado literal (nº real) → revincular por nº de artículo citado (los nº del banco COINCIDEN con la numeración real) + keyword fallback. Los **decretos regionales (BORM/DOG/BOPV) no están en BOE opendata** → inserción literal manual desde su boletín. **El Estatuto Marco (Ley 55/2003) YA EXISTE como ley real (85 arts, id `437f7e81`)** → el SERGAS 419 debe enlazar a ESA.
>
> Estado de la corrección:
> - ✅ **26 Murcia (Ley 3/2009) REHECHO con articulado literal** (81 arts del BOE-A-2011-2493; 73 preguntas vinculadas a artículos reales; 13 de decretos conexos D.80/2005 y D.236/2010 pendientes de crear como leyes propias).
> - ⏳ **27 LOSCAM Madrid, 28 Galicia (Ley 8/2008), 29 Aragón (Ley 6/2002): pendientes de rehacer literales** (siguen con los resúmenes temáticos del primer intento). Madrid y Aragón son cajón de sastre multi-ley (varias leyes reales + topic_scope multi-ley); Galicia es ley única limpia (como Murcia).
> - ✅ **30 Carta Social Europea: NO rehacer** — sus 31 artículos ya eran el articulado real; solo se redistribuyó + enriqueció (correcto).



- ✅ **Contenedor 26 — SMS Murcia / Ley 3/2009** (`d459c687`): importada contra **BOE-A-2011-2493 consolidado** + Decreto 80/2005 (instrucciones previas) + Decreto 236/2010 (atención al ciudadano). De 1 artículo cajón-de-sastre a **11 artículos** fieles a la estructura de la ley (8 títulos): (1) Disposiciones generales y destinatarios, (2) Ámbitos de protección y derechos básicos arts 9/11, (3) Elección facultativo y segunda opinión arts 12/14, (4) Intimidad/confidencialidad/acompañamiento arts 21/22, (5) Información sanitaria y asistencial arts 29-31, (6) Consentimiento informado y alta arts 41-47, (7) Instrucciones previas arts 50-51+Decreto 80/2005, (8) Documentación sanitaria HC/alta/certificados arts 53-62 (conservación 20 años), (9) Deberes art 63, (10) Protección y líneas de actuación Título VIII, (11) Decreto 236/2010. **88 preguntas re-distribuidas** (a1:6 a2:2 a3:8 a4:12 a5:8 a6:7 a7:14 a8:16 a9:3 a10:3 a11:9). Gotcha del router: el propio título "derechos y **deberes**" contamina el matching → hay que strip del boilerplate del nombre de la ley antes de enrutar. Patrón B1 validado: estructura oficial vía WebFetch BOE consolidado + respuestas verificadas del banco oficial → insertar arts reales → re-distribuir.

- ✅ **Contenedor 27 — LOSCAM Madrid / SERMAS** (`0bdba0c8`): cajón de sastre MULTI-NORMA importado contra **BOE-A-2002-4375 (Ley 12/2001) consolidado** + Ley 6/2009 (Libertad de Elección) + Ley 11/2017 (Buen Gobierno) + Convenio Colectivo Único Personal Laboral CM + Decreto 24/2008 + Decreto 246/2023. De 1 artículo a **10 artículos** por norma/tema: (1) Objeto/definiciones/principios Ley 12/2001, (2) Autoridad Sanitaria y competencias Consejería/Consejo de Gobierno, (3) Área Sanitaria Única y Red Sanitaria Única de Utilización Pública, (4) Derechos y deberes de los ciudadanos arts 26/27/30 + Comités de Ética, (5) SERMAS naturaleza/órganos/estructura (Consejo de Administración=gobierno, Director General=dirección), (6) Régimen patrimonial y presupuestario art 63, (7) Consejo de Salud/Agencia Sanitaria/Defensor del Paciente, (8) Ley 6/2009 Libertad de Elección, (9) Ley 11/2017 Buen Gobierno y órganos de gestión, (10) Convenio Colectivo personal laboral CM + otras (SUMMA-112, CPDI, distritos, RD 187/2008). **104 preguntas re-distribuidas** (a1:7 a2:1 a3:9 a4:11 a5:15 a6:10 a7:9 a8:10 a9:12 a10:20). Aprendizaje: los cajón-de-sastre se estructuran POR NORMA + tema, no por articulado de una sola ley.

- ✅ **Contenedor 28 — Ley de Salud de Galicia** (`d73d21ee`, 193q): importada contra **BOE-A-2008-14134 (Ley 8/2008) consolidado** + Ley 3/2001 (consentimiento informado), Decretos 54/2015 y 55/2015, Estrategias SERGAS. De 1 artículo a **8 artículos**: (1) Objeto y Sistema Público de Salud, (2) Derechos y deberes sanitarios + consentimiento informado, (3) Principios rectores art 32, (4) Niveles asistenciales y prestaciones, (5) Organización territorial áreas/distritos/zonas (7 áreas, 14 distritos), (6) Competencias y autoridades sanitarias (Consello da Xunta art 75 / Consellería art 76 / art 33), (7) SERGAS naturaleza/presidencia/funciones arts 92-96 (organismo autónomo administrativo, creado Ley 1/1989), (8) Infracciones/inspección/carrera/provisión/estrategias. **193 preguntas re-distribuidas** (a1:18 a2:8 a3:2 a4:23 a5:28 a6:24 a7:70 a8:20). Nota vigencia: Ley 8/2021 ajustó la estructura territorial, pero el banco testea 7 áreas/14 distritos → se escribe conforme al banco + nota.
- ✅ **Contenedor 29 — SALUD Aragón / Ley 6/2002** (`e3e6e305`, 317q): cajón de sastre multi-norma importado contra **BOE-A-2002-9667 (Ley 6/2002) consolidado** + Decreto Legislativo 2/2004 (TR Ley SALUD) + Decretos 174/2010 (estructura áreas/sectores), 168/2021 (mapa sanitario 8 áreas/8 sectores), 122/2020-181/2021 (estructura orgánica), 100/2003 (voluntades anticipadas), 37/2011 (selección), Orden SAN/441/2021 (PRL), Plan de Salud Aragón 2030. De 1 artículo a **10 artículos** por norma/tema: (1) Objeto y principios rectores art 2, (2) Derechos art 4, (3) Deberes art 5, (4) Información clínica/intimidad arts 8-11, (5) Consentimiento informado y voluntades anticipadas arts 12-15, (6) Estructura territorial áreas/sectores/zonas + mapa sanitario, (7) SALUD naturaleza/órganos/funciones (organismo autónomo, creado Ley 2/1989, Consejo de Dirección + Director Gerente), (8) Estructura orgánica Departamento + órganos centrales SALUD, (9) Órganos de participación y gestión (Consejos de Salud, EAP, gerencias de sector, hospital), (10) Personal/PRL/planificación/listas de espera/EFQM. **317 preguntas re-distribuidas** (a1:20 a2:10 a3:25 a4:31 a5:21 a6:49 a7:120 a8:19 a9:13 a10:9).

- ⚠️ **PENDIENTE (cajón de sastre extremo, sin autopilotar) — Personal Estatutario SERGAS** (`a8b4a1f9`, 419q): NO es una sola ley sino un mega-tema "legislación + temario común SERGAS" que mezcla ~10 normas: **Estatuto Marco Ley 55/2003 (NACIONAL → agnóstico, posible cross-oposición)**, Decreto 206/2005 (provisión), Pacto selección temporal, Decreto 200/1993 (atención primaria), Decreto 198/2010 (admin electrónica), Ley 1/2016 (transparencia), Ley 16/2010 (organización admin Galicia), Ley 1/1983 (Xunta y Presidencia), LO 2/1979 (Tribunal Constitucional), Agenda 2030/ODS, FIS/investigación, Manual de Calidad, dominio @sergas.es, tarjeta sanitaria, funciones de celador. Requiere su **propio pase dedicado / workflow** (estructurar por norma; separar lo agnóstico estatal de lo gallego). NO autopiloteado para no hacer chapuza.

- ✅ **Contenedor 30 — Carta Social Europea (revisada)** (`803d9365`, 140q): tratado del Consejo de Europa. Los **31 artículos de la Parte II ya existían** con contenido breve fiel; las 140 preguntas estaban aparcadas en art0. Acciones: (1) **art0 reconvertido en artículo estructural** "Estructura, aceptación, control y disposiciones finales" (firma 1961/revisada 1996, vigor España 1/7/2021, aceptación art A núcleo duro 6 de 9 + 16 arts/63 párrafos, suspensión, control Comité de Expertos Independientes, denuncia tras 5 años + preaviso 6 meses, depósito ante Secretario General Consejo de Europa); (2) **13 artículos enriquecidos** con cifras testeadas (art 2 vacaciones 4 sem + info contrato 2 meses, art 7 edad 15/nocturno 18, art 8 maternidad 14 sem, art 4 igual retribución, arts 1/9/10/11/12/13/16/24/31); (3) **140 preguntas re-distribuidas** por nº de artículo citado → tema → estructural (a0:43 estructurales + resto en arts 1-31). Patrón "redistribución + enriquecimiento" para contenedores cuyos artículos ya existían.

### ⏸️ PENDIENTE — RESTO PISTA B1 + PISTA C

**PISTA B1 restante — Legislativo sanitario regional (precisión legal crítica, NO cross-oposición).** Por CLAUDE.md **importar el texto contra BOE/BOA/DOG/BOPV oficial**, no redactar de memoria. Varios son "cajón de sastre" (un único artículo vacío mezclando varias normas) y requieren decidir reestructuración:
  - **Personal Estatutario SERGAS (`a8b4a1f9` 419)** → pendiente (cajón de sastre extremo, ver arriba).
  - Demografía y Economía de Aragón (`9735750a` 188): NO es la Ley 6/2002 sino temario de geografía/economía de Aragón (otro dominio, va con la pista C territorial-aragonesa).
  - Osakidetza planes (`8d912b20` 196 + `0d7e592b` 80 euskera + `fd4108d0` 28 + `9bb8dee7` 24): planes de salud Euskadi.
  - Igualdad/Violencia Aragón (`877905aa` 67).

**PISTA C — No sanitarias (otras oposiciones, gran volumen).** Dominio distinto:
  - Inglés PN (`f90685a6` 3.494, 14 arts): teoría de gramática/vocabulario inglés.
  - Correos T1-T12 (`14e4eeb7`, `5f57438d`, `a1384a33`… ~9.000q): servicio postal, normativa Correos.
  - Ciencias Sociales PN (`3ad8772b` 1.411, 7 arts) + temas PN (ciberdelincuencia 174, vehículo prioritario 105, armas de fuego 96, inteligencia policial 94).

Recomendado para ambas pistas: **workflow por contenedor** (sourcing oficial → redacción/importación → auditoría por sub-materia). La pista B1 exige verificación BOE/DOG estricta; la pista C es de otro dominio. Pendiente además fase 2 (topic-review/verify → `article_ok`) de TODOS los contenedores hechos.
