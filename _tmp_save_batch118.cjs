require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.117.2 jueces inamovilidad sancionados no aparece
  const exp1 = `**Articulo 117.2 de la Constitucion Espanola:**

> "Los Jueces y Magistrados no podran ser **separados**, **suspendidos**, **trasladados** ni **jubilados**, sino por alguna de las causas y con las garantias previstas en la ley."

**Por que D es la INCORRECTA (y por tanto la respuesta):**
La palabra "**sancionados**" no aparece en el art. 117.2 CE. Este articulo recoge la garantia de **inamovilidad** de los jueces, que protege su independencia frente a decisiones arbitrarias del poder politico. La lista es cerrada: separados, suspendidos, trasladados y jubilados. "Sancionados" no forma parte de esta garantia constitucional.

**Por que las demas SI aparecen en el art. 117.2:**

- **A)** "Trasladados". **SI**: un juez no puede ser trasladado de destino como forma de presion. Solo por las causas legalmente previstas.

- **B)** "Suspendidos". **SI**: un juez no puede ser suspendido de funciones arbitrariamente. Solo en los casos previstos por ley (ej: procesamiento penal).

- **C)** "Jubilados". **SI**: un juez no puede ser jubilado anticipadamente como forma de apartarle. Solo por las causas legales (edad, incapacidad).

**Las 4 garantias de inamovilidad (art. 117.2 CE):**
1. No **separados** (destitucion)
2. No **suspendidos** (apartamiento temporal)
3. No **trasladados** (cambio de destino)
4. No **jubilados** (retiro forzoso)

**Clave:** Separados, suspendidos, trasladados, jubilados. No incluye "sancionados". La trampa anade una palabra que suena logica pero no esta en el articulo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "00dc9fa4-fb05-4699-b389-17a21e18eaaf");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.117.2 inamovilidad (" + exp1.length + " chars)");

  // #2 - CE art.123.2 Presidente TS nombrado en la forma que determine la ley
  const exp2 = `**Articulo 123.2 de la Constitucion Espanola:**

> "El Presidente del Tribunal Supremo sera nombrado por el **Rey**, a propuesta del **Consejo General del Poder Judicial**, en la forma que determine **la ley**."

**Por que A es correcta ("en la forma que determine la ley"):**
El art. 123.2 CE establece tres elementos para el nombramiento del Presidente del TS:
1. **Quien nombra:** el Rey (acto formal)
2. **Quien propone:** el CGPJ (decision sustantiva)
3. **Como se regula:** la ley (remision al legislador)

La pregunta se centra en el tercer elemento: la **forma** del nombramiento la determina "la ley".

**Por que las demas son incorrectas:**

- **B)** "En la forma que determine **el Rey**". Falso: el Rey **nombra**, pero no determina la forma del nombramiento. El Rey realiza un acto debido (obligatorio) a propuesta del CGPJ. No tiene discrecionalidad sobre como se hace.

- **C)** "En la forma que determine **el Consejo General del Poder Judicial en pleno**". Falso: el CGPJ **propone** al candidato, pero no determina la forma del procedimiento. Ademas, el art. 123.2 no dice "en pleno" (aunque de hecho el Pleno del CGPJ es quien elige).

- **D)** "En la forma que determine **la ley o el real decreto al efecto**". Falso: el art. 123.2 dice solo "la ley", no "la ley o el real decreto". La regulacion del nombramiento requiere rango de ley (LOPJ), no puede hacerse por real decreto. La trampa anade "o el real decreto" que no esta en el texto constitucional.

**Clave:** "En la forma que determine **la ley**" (solo la ley, sin alternativas). Rey nombra, CGPJ propone, ley regula.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "74c79411-e8d8-460b-befb-37ed52060cd3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.123.2 Presidente TS (" + exp2.length + " chars)");

  // #3 - CE art.43 + 53.3 proteccion salud principio rector jurisdiccion ordinaria
  const exp3 = `**Articulo 53.3 de la Constitucion Espanola:**

> "El reconocimiento, el respeto y la proteccion de los principios reconocidos en el **Capitulo tercero** informaran la legislacion positiva, la practica judicial y la actuacion de los poderes publicos. Solo podran ser alegados ante la **Jurisdiccion ordinaria** de acuerdo con lo que dispongan las **leyes que los desarrollen**."

**Por que A es correcta:**
El derecho a la proteccion de la salud (art. 43 CE) esta en el **Capitulo III del Titulo I** ("Principios rectores de la politica social y economica", arts. 39-52). Los principios rectores tienen el nivel de proteccion mas bajo del Titulo I: solo pueden alegarse ante tribunales ordinarios y conforme a las leyes que los desarrollen (art. 53.3). No gozan de proteccion reforzada.

**Por que las demas son incorrectas (confunden niveles de proteccion):**

- **B)** "Ha de ser desarrollado mediante Ley Organica". Falso: la reserva de Ley Organica es para los **derechos fundamentales** de la Seccion 1a del Capitulo II (arts. 15-29), segun el art. 81.1 CE. Los principios rectores del Capitulo III se desarrollan por **ley ordinaria**, no organica.

- **C)** "Es susceptible de tutela a traves de recursos de amparo ante el TC". Falso: el recurso de amparo (art. 53.2 CE) solo protege los derechos del **art. 14** y la **Seccion 1a del Capitulo II** (arts. 15-29). Los principios rectores del Capitulo III **no** tienen recurso de amparo.

- **D)** "Solo pueden ser tutelados ante los Tribunales ordinarios por un procedimiento preferente y sumario". Falso: el procedimiento preferente y sumario es la garantia del art. **53.2** CE, reservada a los derechos del art. 14 y Seccion 1a (arts. 15-29). Los principios rectores no tienen procedimiento preferente ni sumario.

**Tres niveles de proteccion (art. 53 CE):**

| Nivel | Derechos | Garantias |
|-------|----------|-----------|
| Maximo | Arts. 14-29 | LO + preferencia y sumariedad + amparo TC |
| Medio | Arts. 30-38 | Ley ordinaria + vinculan poderes publicos |
| **Minimo** | **Arts. 39-52** | **Informan + alegacion ante tribunales segun leyes** |

**Clave:** Art. 43 (salud) = Capitulo III = principio rector = solo alegable ante jurisdiccion ordinaria segun leyes. Sin amparo, sin LO, sin procedimiento preferente.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "1920cb3c-2ecf-40d9-8030-977a44b2f129");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.43+53.3 salud principio rector (" + exp3.length + " chars)");
})();
