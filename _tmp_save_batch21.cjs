require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.55 derechos suspendibles
  const exp1 = `**Articulo 55.1 de la Constitucion Espanola** (Suspension de derechos):

> "Los derechos reconocidos en los articulos **17, 18.2 y 3, 19, 20.1.a y d y 5, 21, 28.2 y 37.2** podran ser suspendidos cuando se acuerde la declaracion del estado de excepcion o de sitio."

**Por que C es correcta (NO es suspendible):**
El derecho de acceso a cargos publicos (art. 23 CE) **no aparece** en la lista cerrada del art. 55.1. Solo los derechos expresamente listados pueden suspenderse. El art. 23 no esta entre ellos.

**Por que las demas son incorrectas (SI son suspendibles):**

- **A)** "Derecho de reunion (art. 21)". SI esta en la lista del art. 55.1. El derecho de reunion puede suspenderse en estados de excepcion y sitio.

- **B)** "Derecho a la libertad (art. 17)". SI esta en la lista del art. 55.1. Las garantias de libertad personal pueden suspenderse (detencion preventiva, plazos, etc.).

- **D)** "Derecho de huelga (art. 28)". SI esta en la lista del art. 55.1 (concretamente el art. 28.2, que es el derecho de huelga). Puede suspenderse en excepcion y sitio.

**Derechos suspendibles (lista cerrada art. 55.1):**
| Articulo | Derecho |
|----------|---------|
| 17 | Libertad y seguridad personal |
| 18.2 y 18.3 | Inviolabilidad domicilio y secreto comunicaciones |
| 19 | Libre circulacion y residencia |
| 20.1.a, 20.1.d, 20.5 | Libertad expresion, comunicacion y secuestro publicaciones |
| 21 | Reunion y manifestacion |
| 28.2 | Huelga |
| 37.2 | Conflicto colectivo |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "cde4f342-ba00-419c-a6a2-a6d85a1e91ce");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.55 derechos suspendibles (" + exp1.length + " chars)");

  // #2 - CE art.159 incompatibilidades TC
  const exp2 = `**Articulo 159.4 de la Constitucion Espanola** (Incompatibilidades del TC):

> "En lo demas, los miembros del Tribunal Constitucional tendran las incompatibilidades propias de los miembros del **poder judicial**."

**Por que D es correcta:**
El art. 159.4 CE establece expresamente que, ademas de sus incompatibilidades especificas, los miembros del TC tienen las incompatibilidades propias de los miembros del **Poder Judicial**. Esta remision tiene logica: ambos ejercen funciones jurisdiccionales (aunque de distinta naturaleza).

**Incompatibilidades especificas del TC (art. 159.4):**
- Todo mandato representativo
- Cargos politicos o administrativos
- Funciones directivas en partidos politicos o sindicatos
- Ejercicio de carreras judicial y fiscal
- Cualquier actividad profesional o mercantil

**Por que las demas son incorrectas:**

- **A)** "Miembros de las Cortes Generales". Falso: el art. 159.4 remite al Poder Judicial, no a las Cortes. Aunque ser miembro del TC es incompatible con mandato representativo, la remision general es al Poder Judicial.

- **B)** "Miembros del Gobierno". Falso: el art. 159.4 no remite a las incompatibilidades del Gobierno. Ser miembro del TC si es incompatible con cargos politicos, pero la remision "en lo demas" es al Poder Judicial.

- **C)** "Miembros del Tribunal de Cuentas". Falso: no hay remision al Tribunal de Cuentas en el art. 159.4. El TC se asimila al Poder Judicial en materia de incompatibilidades, no al Tribunal de Cuentas.

**Clave:** Incompatibilidades del TC = las propias + las del **Poder Judicial** (art. 159.4 CE).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e43801fd-cb25-47d3-9bba-ce4615922672");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.159 incompatibilidades TC (" + exp2.length + " chars)");

  // #3 - LO 3/1981 art.17.3 Defensor del Pueblo quejas
  const exp3 = `**Articulo 17.3 de la LO 3/1981** (Defensor del Pueblo - Rechazo de quejas):

> "Las decisiones por las que se rechacen las quejas **no seran susceptibles de recurso**."

**Por que D es correcta:**
El art. 17.3 es taxativo: las decisiones de rechazo de quejas del Defensor del Pueblo no admiten recurso de ninguna clase. Esto se debe a que el Defensor del Pueblo es un comisionado de las Cortes Generales, no un organo administrativo ni judicial. Sus actuaciones no son actos administrativos recurribles.

**Por que las demas son incorrectas:**

- **A)** "Recurribles en via administrativa". Falso: el Defensor del Pueblo no es un organo de la Administracion Publica. Sus decisiones no son actos administrativos, por lo que no cabe recurso de alzada ni de reposicion. No esta sujeto a la Ley 39/2015.

- **B)** "Recurribles ante la jurisdiccion contencioso-administrativa". Falso: la jurisdiccion contencioso-administrativa revisa actos de la Administracion Publica (art. 1 Ley 29/1998 LJCA). El Defensor del Pueblo no es Administracion, por lo que sus decisiones escapan a esta jurisdiccion.

- **C)** "Se denominaran dictamenes". Falso: la LO 3/1981 no denomina "dictamenes" a las decisiones de rechazo. Los dictamenes son propios de organos consultivos (como el Consejo de Estado). El Defensor del Pueblo emite resoluciones, recomendaciones y sugerencias.

**Naturaleza del Defensor del Pueblo:**
- Comisionado de las Cortes Generales (art. 54 CE)
- No es organo administrativo ni judicial
- Sus resoluciones son recomendaciones, no vinculantes
- Sus decisiones de rechazo de quejas: **irrecurribles**`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "ddc49ed4-8de4-4e20-adbe-0b4b7b4cd636");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/1981 art.17.3 quejas (" + exp3.length + " chars)");
})();
