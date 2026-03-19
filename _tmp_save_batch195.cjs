require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 6/2023 art.122.6 efectos económicos carrera horizontal 1 enero
  const exp1 = `**Articulo 122.6 del RDL 6/2023 - Efectos economicos de la carrera horizontal:**

> Art. 122.6.b): "En todo caso, los efectos economicos del reconocimiento de cada tramo de carrera horizontal se produciran a partir del **1 de enero del ano siguiente**."

**Por que D es correcta (1 de enero del ano siguiente):**
El art. 122.6.b) establece que los efectos economicos (es decir, el incremento retributivo derivado del ascenso de tramo) no se producen inmediatamente ni el mes siguiente, sino a partir del **1 de enero del ano siguiente** al reconocimiento del tramo.

**Por que las demas son incorrectas:**

- **A)** "**Inmediatamente**." Falso: los efectos economicos no son inmediatos. El reconocimiento del tramo puede producirse en cualquier momento del ano, pero los efectos retributivos se posponen hasta el 1 de enero siguiente.

- **B)** "A partir del dia 1 del **mes siguiente**." Falso: el art. 122.6 no establece efectos mensuales. Aunque seria logico pensar en el mes siguiente, la norma fija una fecha concreta: el 1 de enero del ano siguiente.

- **C)** "A partir del dia **15 del mes siguiente**." Falso: ni el dia 15 ni el mes siguiente corresponden a lo establecido en la norma. Esta opcion inventa un plazo que no existe en el art. 122.6.

**Carrera horizontal (art. 122 RDL 6/2023):**
- Es el reconocimiento del desarrollo profesional mediante **tramos**
- Caracter **voluntario**
- No requiere cambio de puesto de trabajo
- Efectos economicos: **1 de enero del ano siguiente** al reconocimiento

**Clave:** Los efectos economicos del tramo de carrera horizontal se producen el **1 de enero del ano siguiente**, no inmediatamente ni el mes siguiente.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b67c2a79-c124-4715-a73d-b2a54dd8dbef");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 6/2023 art.122.6 efectos economicos (" + exp1.length + " chars)");

  // #2 - RDL 6/2023 art.122.4 excedencia voluntaria agrupación familiar no computa
  const exp2 = `**Articulo 122.4 del RDL 6/2023 - Computo de permanencia en tramo de carrera:**

> Art. 122.4: "A los efectos del cumplimiento de los periodos minimos de permanencia en un tramo de carrera, se computara el tiempo que permanezca el personal funcionario en la situacion de **servicios especiales**, **excedencia por cuidado de familiares**, **excedencia por violencia de genero** y **excedencia por violencia terrorista**."

**Por que D es la respuesta (excedencia voluntaria por agrupacion familiar NO computa):**
El art. 122.4 enumera taxativamente las situaciones cuyo tiempo **si** computa: servicios especiales, excedencia por cuidado de familiares, por violencia de genero y por violencia terrorista. La **excedencia voluntaria por agrupacion familiar** no aparece en esa lista, por lo que su tiempo **no** se computa para la permanencia en tramo.

**Por que las demas SI computan:**

- **A)** "Excedencia por **cuidado de familiares**." **SI computa**: esta expresamente incluida en el art. 122.4. Se protege al funcionario que se dedica al cuidado de hijos o familiares dependientes.

- **B)** "Excedencia por razon de **violencia terrorista**." **SI computa**: incluida expresamente en el art. 122.4. Protege a las victimas del terrorismo.

- **C)** "**Servicios especiales**." **SI computa**: incluida expresamente en el art. 122.4. El funcionario en servicios especiales (cargos politicos, organismos internacionales, etc.) no pierde tiempo de carrera.

**Situaciones que computan para permanencia en tramo (art. 122.4):**

| Situacion | Computa |
|-----------|---------|
| Servicios especiales | **SI** |
| Excedencia cuidado familiares | **SI** |
| Excedencia violencia de genero | **SI** |
| Excedencia violencia terrorista | **SI** |
| **Excedencia voluntaria agrupacion familiar** | **NO** |
| Excedencia voluntaria por interes particular | **NO** |

**Clave:** Computan las excedencias "protegidas" (cuidado, violencia) y servicios especiales. La excedencia voluntaria por agrupacion familiar, al ser voluntaria sin causa protegida, no computa.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c45427d7-7bff-4766-9c15-05be67beb463");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RDL 6/2023 art.122.4 excedencia (" + exp2.length + " chars)");

  // #3 - RDL 6/2023 art.115 órganos selección temporalidad NO es característica
  const exp3 = `**Articulo 115 del RDL 6/2023 - Organos de seleccion:**

> Art. 115: "La composicion y funcionamiento de dichos organos garantizaran los principios de imparcialidad, profesionalidad y **especializacion** de sus integrantes, [...] asi como la **permanencia** y **renovacion periodica** de sus miembros."

**Por que A es la respuesta (temporalidad NO es una caracteristica):**
La "**temporalidad**" no es una caracteristica de los organos de seleccion segun el art. 115 RDL 6/2023. De hecho, la temporalidad es lo contrario de una de las caracteristicas reales: la **permanencia**. Los organos de seleccion deben ser **permanentes**, no temporales.

**Por que las demas SI son caracteristicas:**

- **B)** "**Renovacion**." **Correcto**: el art. 115 establece la "renovacion periodica" de los miembros de los organos de seleccion. Se renuevan los integrantes para evitar el anquilosamiento, pero el organo en si es permanente.

- **C)** "**Especializacion**." **Correcto**: el art. 115 exige la "especializacion" de los integrantes. Los miembros deben tener conocimientos tecnicos adecuados para evaluar las pruebas selectivas.

- **D)** "**Permanencia**." **Correcto**: el art. 115 exige la "permanencia" de los organos de seleccion. Son organos estables, no constituidos ad hoc para cada proceso. Precisamente la permanencia es lo opuesto a la temporalidad.

**Caracteristicas de los organos de seleccion (art. 115 RDL 6/2023):**
- **Especializacion** de sus integrantes
- **Permanencia** del organo
- **Renovacion** periodica de los miembros
- Imparcialidad y profesionalidad

**Clave:** Los organos de seleccion son **permanentes** (no temporales), **especializados** y con **renovacion** periodica de sus miembros. La "temporalidad" contradice la permanencia.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "027d6e38-782c-4e7d-9e2d-7de43db1b619");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RDL 6/2023 art.115 organos seleccion (" + exp3.length + " chars)");
})();
