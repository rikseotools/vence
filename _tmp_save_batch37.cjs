require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.21.4 portal web silencio
  const exp1 = `**Articulo 21.4 de la Ley 39/2015** (Obligacion de resolver - publicacion):

> "Las Administraciones Publicas deberan publicar y mantener actualizadas, en el portal web, a efectos informativos, las relaciones de procedimientos, con indicacion de los **plazos maximos de duracion** de los mismos, asi como de los **efectos que produzca el silencio administrativo**."

**Por que A es correcta:**
El art. 21.4 obliga a publicar en el portal web los efectos del silencio administrativo de cada procedimiento. Asi el ciudadano sabe, antes de iniciar un tramite, que pasara si la Administracion no responde a tiempo (silencio positivo o negativo).

**Por que las demas son incorrectas:**

- **B)** "Plazos previstos para la **notificacion** de los actos que pongan termino". Falso: el art. 21.4 obliga a publicar los plazos maximos de **duracion** de los procedimientos, no los plazos de notificacion. Son conceptos distintos: duracion (cuanto puede tardar el procedimiento) vs notificacion (plazo para comunicar la resolucion).

- **C)** "Relaciones de **pruebas** que se consideren admisibles". Falso: el art. 21.4 no menciona la publicacion de pruebas admisibles. Las relaciones son de **procedimientos**, no de pruebas. La prueba se regula en los arts. 77-78 de la Ley 39/2015.

- **D)** "Plazos generales para interponer **recursos**". Falso: el art. 21.4 no exige publicar plazos de recursos en el portal. Los plazos de recursos se indican en la propia resolucion (art. 88.3: "indicara los recursos que contra la misma procedan").

**Contenido obligatorio del portal web (art. 21.4):**
1. Relacion de procedimientos
2. Plazos maximos de duracion
3. Efectos del silencio administrativo`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c0185230-ae82-42ca-a097-a54b7e3709a3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.21.4 portal (" + exp1.length + " chars)");

  // #2 - CE art.161 TC competencias
  const exp2 = `**Articulo 161.1 de la Constitucion Espanola** (Competencias del TC):

> "El Tribunal Constitucional tiene jurisdiccion en todo el territorio espanol y es competente para conocer:
> a) Del recurso de inconstitucionalidad contra leyes y **disposiciones normativas con fuerza de ley**.
> b) Del recurso de amparo [...]
> c) De los **conflictos de competencia** entre el Estado y las CCAA o de los de estas entre si.
> d) De las demas materias que le atribuyan la Constitucion o las **leyes organicas**."

**Por que A es correcta:**
El art. 161.1.c) atribuye expresamente al TC los conflictos de competencia entre CCAA. "Conflictos de competencia entre comunidades autonomas" esta incluido en la formula "o de los de estas entre si".

**Por que las demas son incorrectas:**

- **B)** "Recurso de inconstitucionalidad contra leyes y **reglamentos**". Falso: el art. 161.1.a) dice "leyes y **disposiciones normativas con fuerza de ley**", no "reglamentos". Los reglamentos no tienen fuerza de ley y no son impugnables ante el TC. Se impugnan ante la jurisdiccion contencioso-administrativa.

- **C)** "Recurso de **casacion**". Falso: el recurso de casacion es competencia del **Tribunal Supremo** (art. 123 CE), no del Tribunal Constitucional. El TC conoce de amparo e inconstitucionalidad, no de casacion.

- **D)** "Materias que le atribuyan leyes estatales y **leyes de las CCAA**". Falso: el art. 161.1.d) dice "la Constitucion o las **leyes organicas**", no "leyes estatales y leyes de CCAA". Solo las leyes organicas (y la propia CE) pueden atribuir competencias al TC. Las leyes autonomicas no pueden hacerlo.

**Competencias del TC (art. 161.1):**
- a) Recurso de inconstitucionalidad
- b) Recurso de amparo
- c) Conflictos de competencia (Estado-CCAA y CCAA-CCAA)
- d) Demas materias de la CE o leyes organicas`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "55c8cfc6-147a-4545-becf-bd753da72921");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.161 TC competencias (" + exp2.length + " chars)");
})();
