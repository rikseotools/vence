require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.22 derecho de asociación trampas en opciones
  const exp1 = `**Articulo 22 de la Constitucion Espanola - Derecho de asociacion:**

> Art. 22.1: "Se reconoce el **derecho de asociacion**."
> Art. 22.2: "Las asociaciones que persigan fines o utilicen medios tipificados como delito son **ilegales**."
> Art. 22.5: "Se prohiben las asociaciones **secretas** y las de caracter **paramilitar**."

**Por que D es correcta:**
La opcion D reproduce literalmente el art. 22.1 CE: "Se reconoce el derecho de asociacion." Es una afirmacion simple y directa que coincide con la Constitucion.

**Por que las demas son incorrectas (cada una contiene una trampa):**

- **A)** "Se reconoce el derecho de **reunion** pacifica y sin armas." Falso: esta frase corresponde al art. **21** CE (derecho de reunion), no al art. 22 (derecho de asociacion). La pregunta se refiere al art. 22. Son derechos diferentes: la asociacion implica vinculacion estable; la reunion es un acto puntual.

- **B)** "Son ilegales las asociaciones secretas y las de caracter **confidencial**." Falso por dos errores: (1) el art. 22.5 dice "caracter **paramilitar**", no "confidencial"; (2) las asociaciones secretas y paramilitares estan "**prohibidas**" (art. 22.5), mientras que las que persiguen fines delictivos son "**ilegales**" (art. 22.2). La opcion mezcla conceptos.

- **C)** "Las asociaciones que persigan fines o utilicen medios tipificados como delito estaran **prohibidas**." Falso: el art. 22.2 dice que son "**ilegales**", no "prohibidas". La distincion es importante: "ilegales" (art. 22.2) se refiere a las que persiguen fines delictivos; "prohibidas" (art. 22.5) se refiere a las secretas y paramilitares.

**Art. 22 CE - Resumen:**

| Apartado | Contenido |
|----------|-----------|
| 22.1 | Derecho de asociacion |
| 22.2 | Fines delictivos = **ilegales** |
| 22.3 | Inscripcion en registro (publicidad) |
| 22.4 | Disolucion solo por **resolucion judicial** |
| 22.5 | Secretas/paramilitares = **prohibidas** |

**Clave:** Ilegales (fines delictivos) vs prohibidas (secretas/paramilitares). No confundir art. 21 (reunion) con art. 22 (asociacion).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4084ecd9-fdef-48a7-90b7-2028b765bfc1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.22 asociacion (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.2.2.c Universidades aplicación supletoria
  const exp2 = `**Articulo 2 de la Ley 39/2015 (LPAC) - Ambito subjetivo de aplicacion:**

> Art. 2.2.c): "Las **Universidades publicas**, que se regiran por su **normativa especifica** y **supletoriamente** por las previsiones de esta Ley."

**Por que A es correcta (Universidades publicas):**
El art. 2.2.c) establece que la Ley 39/2015 se aplica a las Universidades publicas de manera **supletoria**: primero se aplica su normativa especifica (LO 2/2023 LOSU, estatutos universitarios) y solo en lo no regulado por ella se aplica la LPAC. Es la unica opcion donde la aplicacion es supletoria.

**Por que las demas tienen aplicacion directa (no supletoria):**

- **B)** "Entidades que integran la **Administracion Local**." Falso como aplicacion supletoria: el art. 2.1.c) incluye a la Administracion Local dentro del ambito de aplicacion **directa** de la Ley. Se les aplica la LPAC plenamente, no supletoriamente.

- **C)** "Organismos publicos y entidades de **derecho publico**." Falso como aplicacion supletoria: el art. 2.2.a) los incluye en el sector publico institucional con aplicacion **directa** de la Ley. Son Administraciones Publicas a efectos del art. 2.3.

- **D)** "Entidades de **derecho privado** vinculadas a las AAPP." Falso como aplicacion supletoria: el art. 2.2.b) les aplica la Ley en lo que se refiera especificamente a ellas y, en todo caso, cuando ejerzan potestades administrativas. No es una aplicacion supletoria sino especifica/condicionada.

**Niveles de aplicacion de la LPAC (art. 2):**

| Sujeto | Tipo de aplicacion |
|--------|-------------------|
| AGE, CCAA, AALL | **Directa** y plena |
| Organismos/entidades derecho publico | **Directa** |
| Entidades derecho privado | **Especifica** (cuando ejerzan potestades) |
| **Universidades publicas** | **Supletoria** |
| Corporaciones de Derecho Publico | **Supletoria** (art. 2.4) |

**Clave:** Las Universidades publicas son el ejemplo tipico de aplicacion supletoria de la LPAC. Se rigen primero por su normativa propia y solo subsidiariamente por la LPAC.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e5084d00-cbc6-416f-bf9b-989a24d92ad2");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.2 Universidades (" + exp2.length + " chars)");

  // #3 - CE art.159.3 TC 9 años renovación terceras partes cada 3
  const exp3 = `**Articulo 159.3 de la Constitucion Espanola - Mandato del TC:**

> "Los miembros del Tribunal Constitucional seran designados por un periodo de **nueve anos** y se renovaran por **terceras partes** cada **tres**."

**Por que A es correcta (9 anos, terceras partes cada 3):**
El art. 159.3 CE establece: mandato de **9 anos**, renovacion por **tercios** (4 magistrados) cada **3 anos**. Al ser 12 magistrados en total, cada tercio son 4 magistrados, y cada 3 anos se renueva uno de los tres tercios (los propuestos por el Congreso, los del Senado, o los del Gobierno + CGPJ).

**Por que las demas son incorrectas:**

- **B)** "**Cuatro** anos, por **mitades** cada tres." Falso: el mandato es de 9 anos, no 4. La renovacion es por tercios, no por mitades. Ningun dato coincide con el art. 159.3.

- **C)** "**Seis** anos, por **mitades** cada dos." Falso: el mandato es de 9 anos, no 6. Por mitades cada dos no corresponde al TC; es la formula del **CGPJ** (art. 122.3 CE: renovacion cada 5 anos) o del Senado constitucional de otros paises, pero no del TC espanol.

- **D)** "**Tres** anos, por **mitades** cada dos." Falso: el mandato es de 9 anos, no 3. Ademas, la renovacion es por tercios, no por mitades.

**Composicion del TC (art. 159 CE):**

| Dato | Valor |
|------|-------|
| Total magistrados | **12** |
| Mandato | **9 anos** |
| Renovacion | Por **tercios** (4) cada **3 anos** |
| Propuestos por Congreso | 4 (mayoria 3/5) |
| Propuestos por Senado | 4 (mayoria 3/5) |
| Propuestos por Gobierno | 2 |
| Propuestos por CGPJ | 2 |

**Clave:** TC = 12 magistrados, 9 anos, renovacion por tercios cada 3 anos. Mnemotecnia: 12-9-3 (12 miembros, 9 anos, cada 3 se renueva un tercio).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "43f617fa-1223-4ad1-bd25-20b7cbc96531");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.159.3 TC 9 anos (" + exp3.length + " chars)");
})();
