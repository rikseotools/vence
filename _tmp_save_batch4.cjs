require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.68.2 distribucion diputados
  const exp1 = `**Articulo 68.2 de la Constitucion Espanola** (Distribucion de Diputados):

> **68.2:** "La circunscripcion electoral es la **provincia**. Las poblaciones de Ceuta y Melilla estaran representadas cada una de ellas por un Diputado. La ley distribuira el numero total de Diputados, asignando una **representacion minima inicial** a cada circunscripcion y distribuyendo los demas en **proporcion a la poblacion**."

**Por que A es correcta:**
Reproduce literalmente el art. 68.2: representacion minima inicial a cada circunscripcion + distribucion proporcional a la poblacion. Este sistema combina dos criterios: un minimo territorial y un componente poblacional.

**Por que las demas son incorrectas:**

- **B)** "A cada Comunidad Autonoma". Falso: la circunscripcion electoral es la **provincia** (art. 68.2), no la Comunidad Autonoma. La representacion minima se asigna a cada provincia, no a cada CCAA.

- **C)** "Representacion proporcional a cada circunscripcion en funcion de la poblacion". Incompleto y por tanto falso: falta el primer paso (la representacion **minima inicial**). El sistema no es puramente proporcional; primero se asigna un minimo a cada provincia y luego se reparte el resto por poblacion.

- **D)** "Representacion igualitaria a cada circunscripcion". Falso: no es igualitaria. Madrid no tiene los mismos diputados que Soria. El reparto depende de la poblacion (tras asignar el minimo).

**En la practica (Ley Organica 5/1985 LOREG):**
- Congreso: 350 Diputados (dentro del rango 300-400 del art. 68.1)
- Minimo por provincia: 2 Diputados
- Ceuta y Melilla: 1 cada una
- Resto: proporcional a la poblacion`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "735c4558-97c9-4912-bb9f-4bcf5128e604");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.68.2 distribucion (" + exp1.length + " chars)");

  // #2 - CE art.24 tutela judicial
  const exp2 = `**Articulo 24 de la Constitucion Espanola** (Tutela judicial efectiva):

> **24.2:** "Todos tienen derecho al **Juez ordinario predeterminado por la ley**, a la defensa y a la **asistencia de letrado**, a ser informados de la acusacion formulada contra ellos, a un proceso publico sin **dilaciones indebidas** y con todas las garantias [...]"

**Por que C es correcta:**
"El derecho al Juez ordinario predeterminado por la ley" esta literalmente recogido en el art. 24.2 CE. Es el principio del juez natural: nadie puede ser juzgado por un tribunal ad hoc creado para su caso.

**Por que las demas son incorrectas:**

- **A)** "Abogado de oficio en caso de que su situacion economica no le permita costearse uno". El art. 24.2 habla de "asistencia de letrado", pero NO menciona "de oficio" ni la situacion economica. El derecho a la **justicia gratuita** se regula en el art. 119 CE, no en el 24.

- **B)** "Proceso publico con las **dilaciones debidas**". Trampa clasica: el art. 24.2 dice "sin dilaciones **indebidas**", no "con las dilaciones debidas". La diferencia es total: el derecho constitucional es a NO sufrir retrasos injustificados.

- **D)** "Ser informados de la acusacion en el **momento de la detencion**". El art. 24.2 dice "ser informados de la acusacion formulada contra ellos" pero NO anade "en el momento de la detencion". Los derechos del detenido se regulan en el art. 17.3 CE, que es un precepto distinto.

**Derechos del art. 24.2 CE (lista completa):**
- Juez ordinario predeterminado por la ley
- Defensa y asistencia de letrado
- Ser informado de la acusacion
- Proceso publico sin dilaciones indebidas
- Medios de prueba pertinentes
- No declarar contra si mismo
- No confesarse culpable
- Presuncion de inocencia`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9b3b5414-a264-46ea-a521-8e064cf5abcb");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.24 tutela judicial (" + exp2.length + " chars)");

  // #3 - RD 1708/2011 art.10 archivo central
  const exp3 = `**Articulo 10 del RD 1708/2011** (Funciones del Archivo Central):

El Archivo Central custodia documentos una vez finalizada su tramitacion. Sus funciones incluyen:

> 1. Coordinar y controlar archivos de gestion
> 2. Identificar series y elaborar cuadro de clasificacion
> 3. Describir fracciones de serie
> 4. Valoracion documental (propuestas de eliminacion/conservacion)
> **5. Tramitar expedientes de eliminacion de documentos**, cumplidos los requisitos y calendarios de conservacion
> 6. Transferencias al archivo intermedio
> 7. Proporcionar al archivo intermedio instrumentos de descripcion

**Por que D es correcta:**
Reproduce literalmente la funcion 5a del art. 10: "Tramitar, en su caso, los expedientes de eliminacion de documentos, una vez cumplidos los requisitos exigidos por la normativa vigente y de acuerdo con los calendarios de conservacion aprobados."

**Por que las demas son incorrectas:**

- **A)** "Establecer y valorar estrategias de conservacion a largo plazo (emulacion, migracion, conversion de formatos)". Esta es una funcion del **archivo intermedio** o del **archivo historico** (arts. 11-12 RD 1708/2011), no del archivo central. La conservacion a largo plazo de documentos electronicos corresponde a archivos de fase posterior.

- **B)** "Impulsar programas de difusion y gestion cultural del patrimonio documental". Esta es una funcion del **archivo historico** (art. 12 RD 1708/2011). La difusion cultural es propia de la fase final del ciclo documental.

- **C)** "Programas de reproduccion en soportes alternativos para conservacion y difusion". Tambien es funcion del **archivo historico** (art. 12 RD 1708/2011). La reproduccion para difusion no corresponde al archivo central.

**Ciclo de vida del documento (RD 1708/2011):**

| Archivo | Fase | Funciones principales |
|---------|------|----------------------|
| De gestion | Tramitacion activa | Uso frecuente |
| **Central** | Post-tramitacion | Clasificacion, valoracion, **eliminacion** |
| Intermedio | Conservacion media | Estrategias conservacion, transferencias |
| Historico | Conservacion permanente | Difusion, reproduccion, cultura |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "8507dcb8-439a-45bc-bc81-b3cd7fa93a22");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 1708/2011 archivo central (" + exp3.length + " chars)");
})();
