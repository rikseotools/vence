require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/1981 art.19 Defensor del Pueblo auxilio preferente y urgente
  const exp1 = `**Articulo 19.1 de la LO 3/1981 - Defensor del Pueblo:**

> "**Todos los poderes publicos** estan **obligados** a auxiliar, con caracter **preferente y urgente**, al Defensor del Pueblo en sus investigaciones e inspecciones."

**Por que B es correcta (preferente y urgente):**
El art. 19.1 de la LO 3/1981 establece tres elementos clave: (1) **todos** los poderes publicos (no solo algunos), (2) estan **obligados** (no es facultativo), y (3) el auxilio debe prestarse con caracter **preferente y urgente**. Esto refleja la importancia constitucional del Defensor del Pueblo como garante de los derechos fundamentales (art. 54 CE).

**Por que las demas son incorrectas:**

- **A)** "**Pueden** auxiliarle, pero **no estan obligados** a ello, salvo que asi lo indique el superior jerarquico." Falso por dos motivos: (1) el auxilio es **obligatorio**, no facultativo; el art. 19.1 dice "estan obligados", no "pueden"; (2) la obligacion no depende del superior jerarquico, sino que es directa por ley para todos los poderes publicos.

- **C)** "Con caracter **subsidiario**, salvo disposicion en contrario del superior jerarquico." Falso: el caracter del auxilio es **preferente y urgente**, no subsidiario. "Subsidiario" significaria que solo se presta en defecto de otro mecanismo, lo cual es lo contrario de lo que dice la ley. Ademas, tampoco depende del superior jerarquico.

- **D)** "En aquellos casos en los que exista **resolucion judicial** sobre los hechos objeto de la investigacion." Falso: el art. 19.1 no condiciona el auxilio a la existencia de resolucion judicial. La obligacion es general y no depende de que haya un procedimiento judicial previo. De hecho, el Defensor del Pueblo puede investigar incluso sin procedimiento judicial.

**Auxilio al Defensor del Pueblo (art. 19 LO 3/1981):**

| Aspecto | Detalle |
|---------|---------|
| Obligados | **Todos** los poderes publicos |
| Naturaleza | **Obligatorio** (no facultativo) |
| Caracter | **Preferente y urgente** |
| Condicion | Ninguna (incondicional) |

**Clave:** Todos los poderes publicos + obligados + preferente y urgente. Son las tres palabras clave del art. 19.1.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "84b71f7a-f543-4eeb-b219-b402b0af96f1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/1981 art.19 auxilio preferente urgente (" + exp1.length + " chars)");

  // #2 - Ley 40/2015 art.63 Subsecretarios control eficacia
  const exp2 = `**Articulo 63.1.b) de la Ley 40/2015 - Subsecretarios:**

> "Los Subsecretarios ostentan la representacion ordinaria del Ministerio, dirigen los servicios comunes [...] b) **Asistir al Ministro en el control de eficacia** del Ministerio y sus Organismos publicos."

**Por que D es correcta (Subsecretarios):**
El art. 63.1.b) de la Ley 40/2015 atribuye expresamente a los **Subsecretarios** la competencia de asistir al Ministro en el control de eficacia del Ministerio y sus Organismos publicos. Ademas, los Subsecretarios ostentan la representacion ordinaria del Ministerio y dirigen los servicios comunes.

**Por que las demas son incorrectas (otros organos directivos):**

- **A)** "Los **Secretarios generales tecnicos**." Falso: los Secretarios generales tecnicos (art. 65 Ley 40/2015) tienen funciones de asistencia tecnica, produccion normativa, asistencia juridica y publicaciones, pero **no** la de control de eficacia del Ministerio.

- **B)** "Los **Secretarios de Estado**." Falso: los Secretarios de Estado (art. 62 Ley 40/2015) son organos superiores que dirigen y coordinan las Direcciones Generales bajo su dependencia, pero la funcion especifica de "asistir al Ministro en el control de eficacia" corresponde al Subsecretario.

- **C)** "Los **Secretarios generales**." Falso: los Secretarios generales (art. 64 Ley 40/2015) son organos directivos con rango de Subsecretario que ejercen competencias sobre un sector de actividad determinado, pero no tienen asignada la funcion de control de eficacia del Ministerio.

**Organos superiores y directivos del Ministerio (Ley 40/2015):**

| Organo | Articulo | Funcion principal |
|--------|----------|-------------------|
| Ministro | Art. 60-61 | Direccion del Ministerio |
| Secretario de Estado | Art. 62 | Direccion de un sector (organo superior) |
| **Subsecretario** | **Art. 63** | **Control de eficacia + servicios comunes** |
| Secretario general | Art. 64 | Sector de actividad especifico |
| Secretario general tecnico | Art. 65 | Asistencia tecnica y normativa |
| Director general | Art. 66 | Gestion de area funcional |
| Subdirector general | Art. 67 | Ejecucion de proyectos |

**Clave:** Control de eficacia del Ministerio = Subsecretarios (art. 63.1.b). No confundir con Secretarios generales tecnicos (asistencia tecnica) ni con Secretarios de Estado (direccion de sector).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9e26899f-4658-441d-a5c8-09f9a81f392a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 40/2015 art.63 Subsecretarios eficacia (" + exp2.length + " chars)");
})();
