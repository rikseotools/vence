require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 364/1995 art.20 resolución admitidos/excluidos NO indicará
  const exp1 = `**Articulo 20.1 del RD 364/1995 - Listas de admitidos y excluidos:**

> "En dicha resolucion [...] se indicaran los **lugares** en que se encuentran expuestas al publico las listas certificadas completas, senalandose un plazo de **diez dias habiles** para subsanacion y determinandose el **lugar y fecha de comienzo de los ejercicios** y, en su caso, el **orden de actuacion** de los aspirantes."

**Por que A es lo que NO indicara la resolucion (publicacion de resultados):**
La opcion A dice "el lugar y fecha de **publicacion de los resultados** de las pruebas." Falso: el art. 20.1 no exige que la resolucion de admitidos y excluidos indique donde se publicaran los resultados futuros. Esa informacion se comunica despues de celebradas las pruebas, no antes. La resolucion indica el **comienzo** de los ejercicios, no la publicacion de sus resultados.

**Por que las demas SI estan en la resolucion:**

- **B)** "El **lugar y fecha de comienzo** de los ejercicios." **Correcto**: el art. 20.1 dice "determinandose el lugar y fecha de comienzo de los ejercicios". Es informacion esencial para que los aspirantes sepan cuando empiezan las pruebas.

- **C)** "En su caso, el **orden de actuacion** de los aspirantes." **Correcto**: el art. 20.1 dice "y, en su caso, el orden de actuacion de los aspirantes". Se indica "en su caso" porque no siempre es necesario (depende del tipo de pruebas).

- **D)** "Los **lugares** en que se encuentran expuestas al publico las listas certificadas completas." **Correcto**: el art. 20.1 dice "se indicaran los lugares en que se encuentran expuestas al publico las listas certificadas completas de aspirantes admitidos y excluidos".

**Contenido de la resolucion de admitidos/excluidos (art. 20.1 RD 364/1995):**

| Contenido | Incluido |
|-----------|----------|
| Lugares de exposicion de listas | **Si** |
| Plazo de subsanacion (10 dias habiles) | **Si** |
| Lugar y fecha de **comienzo** de ejercicios | **Si** |
| Orden de actuacion (en su caso) | **Si** |
| Lugar y fecha de publicacion de **resultados** | **No** |

**Clave:** La resolucion indica cuando EMPIEZAN los ejercicios (lugar y fecha de comienzo), no cuando se PUBLICAN los resultados. No confundir "comienzo de ejercicios" con "publicacion de resultados".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "852bffcc-3a93-4b2a-acc5-53138bb5e877");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 364/1995 art.20 admitidos excluidos (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.13 Defensor Pueblo quejas Administración Justicia
  const exp2 = `**Articulo 13 de la LO 3/1981 - Defensor del Pueblo y Administracion de Justicia:**

> "Cuando el Defensor del Pueblo reciba quejas referidas al funcionamiento de la **Administracion de Justicia**, debera dirigirlas al **Ministerio Fiscal** para que este investigue su realidad y adopte las medidas oportunas con arreglo a la ley, o bien de traslado de las mismas al Consejo General del Poder Judicial [...]"

**Por que D es correcta (Ministerio Fiscal):**
El art. 13 de la LO 3/1981 establece que cuando el Defensor del Pueblo recibe quejas sobre la Administracion de Justicia, debe dirigirlas al **Ministerio Fiscal**. Esto se debe a que el Defensor del Pueblo no tiene competencia para supervisar directamente la actividad judicial (los jueces son independientes, art. 117 CE), por lo que canaliza estas quejas a traves del Ministerio Fiscal.

**Por que las demas son incorrectas:**

- **A)** "A las **Cortes Generales**." Falso: el Defensor del Pueblo informa a las Cortes con caracter general (informe anual, art. 32 LO 3/1981), pero las quejas sobre la Justicia se dirigen especificamente al **Ministerio Fiscal**, no a las Cortes.

- **B)** "Al **Consejo General del Poder Judicial**." Parcialmente falso como respuesta principal: el art. 13 dice que el Ministerio Fiscal puede dar traslado de las quejas al CGPJ segun el tipo de reclamacion, pero el destinatario directo de las quejas es el **Ministerio Fiscal**, no el CGPJ. El CGPJ recibe las quejas indirectamente, a traves del Fiscal.

- **C)** "Al **Ministro de Justicia**." Falso: el art. 13 no menciona al Ministro de Justicia como destinatario de estas quejas. El Ministro de Justicia tiene competencias administrativas, pero las quejas sobre el funcionamiento judicial van al Ministerio Fiscal.

**Tramitacion de quejas segun su objeto:**

| Quejas sobre... | Se dirigen a... |
|-----------------|----------------|
| Administracion General del Estado | Directamente investigadas por el DP |
| **Administracion de Justicia** | **Ministerio Fiscal** (art. 13) |
| Actividad militar | Limitaciones especificas (art. 14) |

**Clave:** Quejas sobre Justicia = al Ministerio Fiscal (art. 13 LO 3/1981). El Fiscal puede trasladarlas al CGPJ, pero el destinatario directo es el Fiscal.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "862549fb-6778-4106-905c-834dfb6def21");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 art.13 DP quejas Justicia (" + exp2.length + " chars)");

  // #3 - CE art.23 derecho participar asuntos públicos
  const exp3 = `**Articulo 23 de la Constitucion Espanola - Participacion politica:**

> Art. 23.1: "Los ciudadanos tienen el derecho a **participar en los asuntos publicos**, directamente o por medio de representantes, libremente elegidos en elecciones periodicas por sufragio universal."
>
> Art. 23.2: "Asimismo, tienen derecho a **acceder en condiciones de igualdad a las funciones y cargos publicos**, con los requisitos que senalen las leyes."

**Por que B es correcta (participar en asuntos publicos):**
El art. 23 CE regula el derecho de participacion politica en sus dos vertientes: (1) participar en los asuntos publicos (directamente o por representantes) y (2) acceder a funciones y cargos publicos en igualdad. Es un derecho fundamental de la Seccion 1.a del Capitulo II del Titulo I.

**Por que las demas son incorrectas (articulos diferentes):**

- **A)** "El derecho a la **libertad de catedra**." Falso: la libertad de catedra se reconoce en el articulo **20.1.c)** CE, dentro del derecho a la libertad de expresion e informacion (art. 20), no en el art. 23.

- **C)** "El derecho a la **educacion**." Falso: el derecho a la educacion se regula en el articulo **27** CE, no en el 23. El art. 27 establece que todos tienen derecho a la educacion y reconoce la libertad de ensenanza.

- **D)** "El derecho a la **libre sindicacion**." Falso: la libre sindicacion se reconoce en el articulo **28.1** CE, no en el 23. El art. 28 regula tanto la sindicacion (28.1) como la huelga (28.2).

**Derechos fundamentales de la Seccion 1.a (ubicacion):**

| Articulo | Derecho |
|----------|---------|
| Art. 20 | Expresion, informacion, **catedra** (20.1.c) |
| **Art. 23** | **Participacion en asuntos publicos + acceso cargos** |
| Art. 27 | Educacion |
| Art. 28 | Sindicacion (28.1) y huelga (28.2) |

**Clave:** Art. 23 = participacion politica (asuntos publicos + cargos). No confundir con educacion (27), sindicacion (28) o catedra (20.1.c).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "6db8acdb-b6cc-416b-adb8-908392c8f300");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.23 participacion politica (" + exp3.length + " chars)");
})();
