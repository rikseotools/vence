require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Access función de agregado Var (varianza)
  const exp1 = `**Funciones de agregado en Microsoft Access:**

**Por que C es correcta (Var SI es una funcion de agregado de Access):**
La funcion **Var** (Varianza) es una funcion de agregado disponible en Access. Calcula la **varianza** de un conjunto de valores en una columna, es decir, mide cuanto se dispersan los datos respecto a su media. Se utiliza en consultas de totales y en expresiones de calculo.

**Por que las demas son incorrectas:**

- **A)** "**Moda**." Falso: la Moda (valor mas frecuente) **no** esta disponible como funcion de agregado predefinida en Access. Para calcular la moda seria necesario crear una consulta personalizada con agrupacion y ordenacion.

- **B)** "**Producto**." Falso: Access no incluye una funcion de agregado "Producto" (multiplicacion de todos los valores). Para multiplicar valores de una columna habria que recurrir a expresiones VBA o subconsultas.

- **D)** "Ninguna de las respuestas anteriores es correcta." Falso: la opcion C (Var) si es una funcion de agregado valida en Access, por lo que esta opcion es incorrecta.

**Funciones de agregado disponibles en Access:**

| Funcion | Que calcula |
|---------|------------|
| **Suma** | Total de los valores |
| **Promedio** (Avg) | Media aritmetica |
| **Contar** (Count) | Numero de registros |
| **Min** | Valor minimo |
| **Max** | Valor maximo |
| **DesvEst** (StDev) | Desviacion estandar |
| **Var** | **Varianza** |
| **Primero** (First) | Primer valor |
| **Ultimo** (Last) | Ultimo valor |

**Clave:** Var (varianza) y DesvEst (desviacion estandar) si existen en Access. Moda y Producto no estan disponibles como funciones de agregado predefinidas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f2f318ce-c0e3-4bf4-b61e-7d140a4f4999");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Access Var agregado (" + exp1.length + " chars)");

  // #2 - CE art.10.1 fundamento del orden político y la paz social
  const exp2 = `**Articulo 10.1 de la Constitucion Espanola - Fundamento del orden politico:**

> "La **dignidad de la persona**, los **derechos inviolables** que le son inherentes, el **libre desarrollo de la personalidad**, el **respeto a la ley** y a los **derechos de los demas** son fundamento del orden politico y de la paz social."

**Por que C es correcta:**
La opcion C reproduce literalmente el contenido del art. 10.1 CE, que enumera cinco elementos como fundamento del orden politico y la paz social: dignidad, derechos inviolables inherentes, libre desarrollo de la personalidad, respeto a la ley y respeto a los derechos de los demas.

**Por que las demas son incorrectas (contienen textos de otros articulos):**

- **A)** "La **libertad y la igualdad** del individuo y de los grupos." Falso: esta formulacion se aproxima al art. **9.2** CE, que habla de promover la "libertad e igualdad del individuo y de los grupos". No es el contenido del art. 10.1.

- **B)** "El **respeto de los ciudadanos y los poderes publicos a la CE** y al resto del ordenamiento juridico." Falso: esto corresponde al art. **9.1** CE: "Los ciudadanos y los poderes publicos estan sujetos a la Constitucion y al resto del ordenamiento juridico." Es el principio de sujecion a la CE, no el fundamento del orden politico del art. 10.1.

- **D)** "La **participacion** de todos los ciudadanos en la vida politica, economica, cultural y social." Falso: esto corresponde al art. **9.2** CE, que encomienda a los poderes publicos facilitar la participacion de los ciudadanos. No es el contenido del art. 10.1.

**Art. 10 CE completo:**

| Apartado | Contenido |
|----------|-----------|
| **10.1** | Fundamento del orden politico: dignidad, derechos inviolables, libre desarrollo, respeto a la ley y derechos de los demas |
| 10.2 | Interpretacion de derechos fundamentales conforme a la DUDH y tratados internacionales |

**Clave:** Art. 10.1 = dignidad + derechos inviolables + libre desarrollo + respeto a la ley + derechos de los demas. No confundir con art. 9.1 (sujecion a la CE) ni art. 9.2 (libertad, igualdad y participacion).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ec1f5737-6263-4242-b464-129cdf122c6d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.10.1 fundamento orden politico (" + exp2.length + " chars)");

  // #3 - CE art.152.1 Asamblea Legislativa NO todas las CCAA obligadas
  const exp3 = `**Articulo 152.1 de la Constitucion Espanola - Organizacion institucional autonomica:**

> "En los Estatutos aprobados por el procedimiento a que se refiere el **articulo anterior** [art. 151], la organizacion institucional autonomica se basara en una **Asamblea Legislativa**, elegida por sufragio universal [...]"

**Por que D es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion D dice que "**todas** las CCAA deberan contar con una Asamblea Legislativa". Falso: el art. 152.1 CE solo exige Asamblea Legislativa para las CCAA que accedieron por la **via del art. 151** (via rapida): Pais Vasco, Cataluna, Galicia y Andalucia. Las demas CCAA, constituidas por la via del art. 143 (via lenta), no estan constitucionalmente obligadas a tenerla, aunque en la practica todas la incluyen en sus Estatutos.

**Por que las demas SI son correctas:**

- **A)** "Los Estatutos solo podran ser modificados mediante los procedimientos en ellos establecidos y con **referendum**." **Correcto**: el art. 152.2 CE establece que la reforma de los Estatutos aprobados por via del art. 151 requerira referendum, ademas de seguir el procedimiento previsto en el propio Estatuto.

- **B)** "El control del ejercicio de funciones delegadas (art. 150.2) se ejercera por el **Gobierno**." **Correcto**: el art. 150.2 CE preve que el Estado puede transferir competencias y que "la ley preve en cada caso [...] las formas de control que se reserve el Estado", incluyendo el control gubernamental.

- **C)** "Las Corporaciones locales podran establecer y exigir **tributos**." **Correcto**: el art. 133.2 CE dispone que "las Corporaciones locales podran establecer y exigir tributos, de acuerdo con la Constitucion y las leyes".

**Art. 152.1 CE - Solo via rapida (art. 151):**

| Organo exigido | Detalle |
|----------------|---------|
| Asamblea Legislativa | Elegida por sufragio universal, representacion proporcional |
| Consejo de Gobierno | Funciones ejecutivas y administrativas |
| Presidente | Elegido por la Asamblea, nombrado por el Rey |

**Clave:** La CE solo exige Asamblea Legislativa a las CCAA de la via rapida (art. 151). Las de via lenta (art. 143) la tienen por sus Estatutos, no por obligacion constitucional directa.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "91f366fd-9bdb-4baf-b523-84a707862abc");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.152.1 Asamblea Legislativa (" + exp3.length + " chars)");
})();
