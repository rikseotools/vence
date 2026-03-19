require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Excel CONTAR.SI
  const exp1 = `**Funcion CONTAR.SI (COUNTIF) en Excel:**

> \`=CONTAR.SI(rango; criterio)\`

Cuenta el numero de celdas dentro de un rango que cumplen un criterio determinado. Es la funcion especifica para contar cuantas veces aparece un valor.

**Por que B es correcta (CONTAR.SI):**
CONTAR.SI es exactamente la funcion disenada para este proposito. Ejemplo: \`=CONTAR.SI(A1:A100;"Madrid")\` cuenta cuantas veces aparece "Madrid" en el rango A1:A100.

**Por que las demas son incorrectas:**

- **A)** "Ninguna de las funciones anteriores". Falso: CONTAR.SI si permite contar ocurrencias de un valor en un rango. Esta opcion solo seria correcta si las tres funciones propuestas fueran inadecuadas.

- **C)** "BUSCAR.H" (BUSCARH / HLOOKUP). Falso: BUSCARH busca un valor en la **primera fila** de una tabla y devuelve un valor de la misma columna en otra fila. Sirve para buscar datos en tablas horizontales, **no para contar** cuantas veces aparece un valor.

- **D)** "ENCONTRAR.H". Falso: esta funcion **no existe** como tal en Excel. Existe ENCONTRAR (FIND), que busca una cadena de texto **dentro de otra cadena** y devuelve la posicion. Pero "ENCONTRAR.H" no es una funcion valida de Excel.

**Funciones de conteo en Excel:**
- **CONTAR** (COUNT): cuenta celdas con numeros
- **CONTARA** (COUNTA): cuenta celdas no vacias
- **CONTAR.SI** (COUNTIF): cuenta celdas que cumplen **un** criterio
- **CONTAR.SI.CONJUNTO** (COUNTIFS): cuenta celdas que cumplen **varios** criterios

**Clave:** Para contar cuantas veces aparece un valor = **CONTAR.SI**. BUSCARH busca, no cuenta. ENCONTRAR.H no existe.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2b5c30e8-0820-4ad6-9077-3cc85af3056a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Excel CONTAR.SI (" + exp1.length + " chars)");

  // #2 - RD 208/1996 art.5 jefatura unidad informacion administrativa
  const exp2 = `**Articulo 5.1 del RD 208/1996** (Servicios de informacion administrativa):

> "En cada Ministerio el titular de la **Subdireccion General** que tenga encomendada la competencia sobre la informacion administrativa **ostentara la jefatura** de la unidad departamental de informacion administrativa."

**Por que D es correcta:**
La jefatura de la unidad departamental de informacion administrativa corresponde al **titular de la Subdireccion General** que tenga asignada dicha competencia. No es un cargo generico, sino el Subdirector General especifico responsable de informacion administrativa en cada Ministerio.

**Por que las demas son incorrectas:**

- **A)** "El Subsecretario, en todo caso". Falso: aunque el Subsecretario es el segundo cargo del Ministerio y tiene funciones de organizacion interna, la jefatura de esta unidad concreta la ostenta el titular de la Subdireccion General competente, no el Subsecretario directamente.

- **B)** "La Comision Interministerial de Informacion Administrativa". Falso: la Comision Interministerial (art. 18 del mismo RD) es un organo **colegiado** de coordinacion entre Ministerios. No puede "ostentar la jefatura" de una unidad dentro de un Ministerio concreto, ya que es un organo transversal.

- **C)** "El titular del Departamento" (el Ministro). Falso: el Ministro dirige el Departamento en su conjunto, pero no ostenta personalmente la jefatura de cada unidad. La jefatura de la unidad de informacion administrativa es un nivel de gestion asignado al Subdirector General competente.

**Clave:** Jefatura de la unidad departamental de informacion administrativa = **Subdirector General** con competencia en informacion administrativa (no el Subsecretario ni el Ministro).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "06f66130-4ebd-474b-9839-84f8e511d841");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 208/1996 jefatura info (" + exp2.length + " chars)");

  // #3 - LBRL art.34 delegacion Presidente Diputacion
  const exp3 = `**Articulo 34.2 de la Ley 7/1985 (LBRL):**

> "El Presidente puede delegar el ejercicio de sus atribuciones, **salvo** las de convocar y presidir las sesiones del Pleno y de la Junta de Gobierno, decidir los empates con voto de calidad, la concertacion de operaciones de credito, la jefatura superior de todo el personal, la separacion del servicio de funcionarios y el despido del personal laboral [...]"

**Por que B es correcta (representar a la Diputacion):**
"Representar a la Diputacion" (art. 34.1.b) **NO esta en la lista de competencias indelegables** del art. 34.2. Por tanto, el Presidente SI puede delegarla. Es logico: un Vicepresidente o Diputado Delegado puede representar a la Diputacion en actos publicos, firmas de convenios, etc.

**Por que las demas son incorrectas (todas son indelegables):**

- **A)** "Dirigir el gobierno y la administracion de la provincia". **Indelegable**: es la funcion de direccion politica suprema, inherente al cargo de Presidente.

- **C)** "Desempenar la jefatura superior de todo el personal". **Indelegable**: esta expresamente excluida de la delegacion en el art. 34.2. La jefatura superior del personal es una atribucion inherente.

- **D)** "Acordar la separacion del servicio de los funcionarios". **Indelegable**: la separacion del servicio es la sancion mas grave (expulsion definitiva) y el art. 34.2 la excluye expresamente de la delegacion.

**Competencias indelegables del Presidente de la Diputacion (art. 34.2):**
- Convocar y presidir Pleno y Junta de Gobierno
- Decidir empates con voto de calidad
- Concertacion de operaciones de credito
- **Jefatura superior del personal**
- **Separacion de servicio** de funcionarios / despido de laborales

**Clave:** La **representacion** es delegable. La jefatura del personal y la separacion del servicio **no** lo son.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d40ef7cf-b1fd-4d26-81e6-4a876d73431b");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LBRL delegacion Pdte Diputacion (" + exp3.length + " chars)");
})();
