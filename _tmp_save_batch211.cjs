require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.14 derecho de igualdad
  const exp1 = `**Articulo 14 de la Constitucion Espanola - Derecho de igualdad:**

> "Los espanoles son **iguales ante la ley**, sin que pueda prevalecer discriminacion alguna por razon de nacimiento, raza, sexo, religion, opinion o cualquier otra condicion o circunstancia personal o social."

**Por que D es correcta (articulo 14):**
El derecho de **igualdad** ante la ley esta regulado en el **art. 14 CE**. Es el primer articulo de la Seccion 1.a del Capitulo Segundo del Titulo I, y constituye un principio transversal que informa todo el ordenamiento juridico. Prohibe la discriminacion por cualquier condicion personal o social.

**Por que las demas son incorrectas (contienen otros derechos):**

- **A)** "Articulo **16**." Falso: el art. 16 CE regula la **libertad ideologica, religiosa y de culto**, no la igualdad. Tambien establece que "ninguna confesion tendra caracter estatal" (aconfesionalidad del Estado).

- **B)** "Articulo **15**." Falso: el art. 15 CE regula el **derecho a la vida y a la integridad fisica y moral**. Tambien abolio la pena de muerte (salvo lo que pudieran disponer las leyes penales militares en tiempo de guerra, ya derogado).

- **C)** "Articulo **13**." Falso: el art. 13 CE regula los **derechos de los extranjeros** en Espana. Establece que gozaran de las libertades publicas en los terminos que establezcan los tratados y la ley.

**Articulos clave del Titulo I (secuencia 13-16):**

| Articulo | Contenido |
|----------|-----------|
| 13 | Derechos de los extranjeros |
| **14** | **Igualdad ante la ley** |
| 15 | Derecho a la vida e integridad fisica |
| 16 | Libertad ideologica, religiosa y de culto |

**Clave:** Art. 14 = igualdad. Art. 15 = vida. Art. 16 = libertad ideologica/religiosa. Art. 13 = extranjeros.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5e27bfa2-fb5b-458c-9b12-a4ef39b193cb");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.14 igualdad (" + exp1.length + " chars)");

  // #2 - Ley 9/2017 art.15.1 concesión de servicios Poderes Adjudicadores
  const exp2 = `**Articulo 15.1 de la Ley 9/2017 (LCSP) - Contrato de concesion de servicios:**

> "El contrato de concesion de servicios es aquel en cuya virtud uno o varios **poderes adjudicadores** encomiendan a titulo oneroso a una o varias personas, naturales o juridicas, la gestion de un servicio cuya prestacion sea de su titularidad o competencia [...]"

**Por que B es correcta (todos los Poderes Adjudicadores):**
El art. 15.1 LCSP utiliza la expresion "uno o varios **poderes adjudicadores**", sin restringirlo a un tipo concreto. Por tanto, cualquier ente con la consideracion de Poder Adjudicador puede celebrar contratos de concesion de servicios. Los Poderes Adjudicadores incluyen las Administraciones Publicas y otros entes del sector publico que cumplen determinados requisitos (art. 3.3 LCSP).

**Por que las demas son incorrectas:**

- **A)** "Solo los entes de la **Administracion General del Estado**." Falso: la AGE es un Poder Adjudicador, pero no el unico. Tambien lo son las CCAA, entidades locales, organismos autonomos, universidades publicas y otros entes del sector publico. Limitar a la AGE excluye injustificadamente a los demas.

- **C)** "Todos los entes del **Sector Publico**." Falso: no todos los entes del sector publico son Poderes Adjudicadores. El art. 15.1 se refiere especificamente a "poderes adjudicadores", que es un subconjunto del sector publico. Hay entes del sector publico que no son poderes adjudicadores y que celebran "contratos privados", no concesiones.

- **D)** "Solo los entes con consideracion de **Administracion Publica**." Falso: la Administracion Publica (art. 3.2 LCSP) es un subconjunto de los Poderes Adjudicadores (art. 3.3 LCSP). Hay Poderes Adjudicadores que no son Administracion Publica pero si pueden celebrar concesiones de servicios.

**Niveles del sector publico en la LCSP (art. 3):**

| Nivel | Ambito |
|-------|--------|
| Sector publico (art. 3.1) | El mas amplio (todos los entes) |
| **Poderes Adjudicadores (art. 3.3)** | **Pueden celebrar concesion de servicios** |
| Administraciones Publicas (art. 3.2) | El mas restringido |

**Clave:** Concesion de servicios = Poderes Adjudicadores (no solo AGE, no solo Administracion Publica, no todo el sector publico).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a10f8deb-c6da-489f-9d88-70f091ab7ff8");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.15.1 concesion servicios (" + exp2.length + " chars)");

  // #3 - Ley 9/2017 art.335 Tribunal de Cuentas umbrales
  const exp3 = `**Articulo 335.1 de la Ley 9/2017 (LCSP) - Remision al Tribunal de Cuentas:**

> "Dentro de los tres meses siguientes a la formalizacion del contrato [...] debera remitirse al Tribunal de Cuentas u organo externo de fiscalizacion de la Comunidad Autonoma una copia certificada del documento en el que se hubiere formalizado aquel, acompanada de un extracto del expediente [...] siempre que el precio de adjudicacion del contrato [...] exceda de **600.000 euros**, tratandose de obras, concesiones de obras y concesiones de servicios, de **450.000 euros**, tratandose de suministros, y de **150.000 euros**, tratandose de servicios y contratos administrativos especiales."

**Por que A es correcta (150.000 euros para servicios y contratos administrativos especiales):**
El art. 335.1 LCSP establece el umbral de **150.000 euros** como limite a partir del cual debe remitirse la copia del contrato al Tribunal de Cuentas cuando se trata de **servicios** y **contratos administrativos especiales**.

**Por que las demas son incorrectas (umbrales equivocados):**

- **B)** "150.000 euros tratandose de **suministros**." Falso: el umbral para suministros es **450.000 euros**, no 150.000. Se confunde el umbral de servicios (150.000) con el de suministros (450.000).

- **C)** "300.000 euros tratandose de **suministros**." Falso: 300.000 euros no es ninguno de los umbrales del art. 335.1. El umbral correcto para suministros es **450.000 euros**.

- **D)** "450.000 euros tratandose de **obras, concesiones de obras, concesiones de servicios y acuerdos marco**." Falso: el umbral para obras y concesiones es **600.000 euros**, no 450.000. Se confunde el umbral de suministros (450.000) con el de obras/concesiones (600.000).

**Umbrales de remision al Tribunal de Cuentas (art. 335.1 LCSP):**

| Tipo de contrato | Umbral |
|-----------------|--------|
| Obras, concesiones de obras, concesiones de servicios | **600.000** euros |
| Suministros | **450.000** euros |
| **Servicios, contratos administrativos especiales** | **150.000** euros |

**Clave:** Servicios = 150.000. Suministros = 450.000. Obras/concesiones = 600.000. Memorizarlos en orden ascendente: 150 - 450 - 600.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "72a3cd02-95e1-453d-98f9-23f35b08a2de");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.335 Tribunal Cuentas (" + exp3.length + " chars)");
})();
