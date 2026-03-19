require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.86 Decretos-leyes afirmación NO correcta
  const exp1 = `**Articulo 86 de la Constitucion Espanola - Decretos-leyes:**

> Art. 86.1: "En caso de **extraordinaria y urgente necesidad**, el **Gobierno** podra dictar disposiciones legislativas provisionales que tomaran la forma de Decretos-leyes y que **no podran afectar** al ordenamiento de las instituciones basicas del Estado, a los derechos, deberes y libertades de los ciudadanos regulados en el Titulo I, al regimen de las CCAA ni al Derecho electoral general."
>
> Art. 86.2: "Los Decretos-leyes deberan ser **inmediatamente sometidos** a debate y votacion de totalidad al **Congreso** de los Diputados [...] en el plazo de los **treinta dias** siguientes a su promulgacion."

**Por que D es la afirmacion NO correcta (y por tanto la respuesta):**
La opcion D dice que "la intervencion de las Cortes Generales sera con **caracter previo** sin necesidad de que se produzca una situacion excepcional." Falso por dos motivos: (1) la intervencion de las Cortes (concretamente del Congreso) es **posterior**, no previa: el Gobierno dicta primero el Decreto-ley y luego el Congreso lo convalida o deroga en 30 dias (art. 86.2); (2) si se requiere una situacion excepcional: "extraordinaria y urgente necesidad" (art. 86.1).

**Por que las demas SI son correctas:**

- **A)** "Se dictan en casos de **extraordinaria y urgente necesidad**." **Correcto**: reproduce literalmente el art. 86.1 CE. El presupuesto habilitante es la situacion de extraordinaria y urgente necesidad.

- **B)** "El organo del que emanan es el **Gobierno**." **Correcto**: el art. 86.1 atribuye al Gobierno la potestad de dictar Decretos-leyes. Es un acto del poder ejecutivo con rango de ley.

- **C)** "Existen materias reservadas a la Ley y expresamente **prohibidas** al Decreto-ley." **Correcto**: el art. 86.1 enumera las materias vedadas: instituciones basicas del Estado, derechos y libertades del Titulo I, regimen de CCAA y Derecho electoral general.

**Caracteristicas del Decreto-ley (art. 86 CE):**

| Aspecto | Detalle |
|---------|---------|
| Presupuesto | Extraordinaria y urgente necesidad |
| Organo emisor | **Gobierno** |
| Rango | Ley (disposicion legislativa provisional) |
| Materias prohibidas | Instituciones basicas, Titulo I, CCAA, electoral |
| Control parlamentario | **Posterior** (Congreso, 30 dias) |
| Tramitacion alternativa | Como proyecto de ley por urgencia (art. 86.3) |

**Clave:** El Congreso interviene DESPUES (convalidacion en 30 dias), no ANTES. Y siempre se requiere "extraordinaria y urgente necesidad".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d2f24140-8e2c-4be7-bb71-434ac61a8159");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.86 Decretos-leyes NO correcta (" + exp1.length + " chars)");

  // #2 - CE art.94 tratados opción incorrecta "paramilitar"
  const exp2 = `**Articulo 94.1 de la Constitucion Espanola - Tratados internacionales:**

> "La prestacion del consentimiento del Estado para obligarse por medio de tratados o convenios requerira la previa autorizacion de las Cortes Generales, en los siguientes casos:
> a) Tratados de caracter **politico**.
> b) Tratados o convenios de caracter **militar**.
> c) [...] que afecten a la integridad territorial o a los derechos y deberes fundamentales del Titulo I.
> d) [...] que impliquen obligaciones **financieras** para la Hacienda Publica.
> e) [...] que supongan **modificacion o derogacion** de alguna ley [...]."

**Por que B es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion B dice "tratados de caracter **paramilitar**". Falso: el art. 94.1.b) CE dice "de caracter **militar**", no "paramilitar". La palabra "paramilitar" no aparece en ningun lugar de la Constitucion. La trampa consiste en anadir el prefijo "para-" a "militar" para crear un termino que suena similar pero tiene un significado completamente diferente.

**Por que las demas SI son correctas:**

- **A)** "Tratados de caracter **politico**." **Correcto**: reproduce literalmente el art. 94.1.a) CE. Los tratados politicos requieren autorizacion previa de las Cortes.

- **C)** "Tratados que supongan **modificacion o derogacion** de alguna ley o exijan medidas legislativas para su ejecucion." **Correcto**: reproduce el art. 94.1.e) CE.

- **D)** "Tratados que impliquen **obligaciones financieras** para la Hacienda Publica." **Correcto**: reproduce el art. 94.1.d) CE.

**Tratados que requieren autorizacion de las Cortes (art. 94.1 CE):**

| Letra | Tipo de tratado |
|-------|----------------|
| a) | De caracter **politico** |
| b) | De caracter **militar** (no "paramilitar") |
| c) | Integridad territorial o derechos Titulo I |
| d) | Obligaciones **financieras** Hacienda Publica |
| e) | Modificacion/derogacion de leyes |

**Clave:** El art. 94.1.b) dice "militar", no "paramilitar". Las trampas habituales en este articulo consisten en alterar una sola palabra para crear opciones falsas que suenan casi identicas.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7703992a-8fa9-4633-84c9-7be6cbc18042");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.94 tratados paramilitar (" + exp2.length + " chars)");

  // #3 - CE art.82.3 delegación legislativa se agota por uso
  const exp3 = `**Articulo 82.3 de la Constitucion Espanola - Delegacion legislativa:**

> "La delegacion legislativa habra de otorgarse al **Gobierno** de forma **expresa** para materia concreta y con fijacion del **plazo** para su ejercicio. La delegacion se **agota por el uso** que de ella haga el Gobierno mediante la publicacion de la norma correspondiente. **No podra** entenderse concedida de modo **implicito** o por **tiempo indeterminado**. Tampoco podra permitir la **subdelegacion** a autoridades distintas del propio Gobierno."

**Por que A es correcta (la delegacion se agota por el uso):**
El art. 82.3 CE establece que la delegacion legislativa **se agota por el uso**: una vez que el Gobierno publica la norma correspondiente (Real Decreto Legislativo), la delegacion queda consumida y no puede volver a utilizarse. Es un uso unico.

**Por que las demas son incorrectas (contradicen el art. 82.3):**

- **B)** "Se podra permitir la **subdelegacion** a autoridades distintas del propio Gobierno." Falso: el art. 82.3 dice exactamente lo contrario: "**tampoco** podra permitir la subdelegacion a autoridades distintas del propio Gobierno." La delegacion es al Gobierno y solo al Gobierno.

- **C)** "Se podra entenderse concedida de modo **implicito** o por **tiempo indeterminado**." Falso: el art. 82.3 dice lo contrario: "**No podra** entenderse concedida de modo implicito o por tiempo indeterminado." Siempre debe ser expresa, para materia concreta y con plazo.

- **D)** "Habra de otorgarse al Gobierno **u autoridad competente** de forma **expresa o tacita**." Falso por dos motivos: (1) solo puede otorgarse al **Gobierno**, no a otra "autoridad competente"; (2) debe ser de forma **expresa**, no cabe la delegacion "tacita" (art. 82.3: "no podra entenderse concedida de modo implicito").

**Limites de la delegacion legislativa (art. 82.3 CE):**

| Requisito | Lo que dice la CE | Trampa habitual |
|-----------|-------------------|-----------------|
| Destinatario | Solo el **Gobierno** | "Gobierno u otra autoridad" |
| Forma | **Expresa** | "Expresa o tacita/implicita" |
| Materia | **Concreta** | "General" |
| Plazo | **Determinado** | "Tiempo indeterminado" |
| Subdelegacion | **No** permitida | "Si" permitida |
| Uso | Se **agota** al publicar | Reutilizable |

**Clave:** La delegacion se agota por el uso (publicacion de la norma). Ademas: solo al Gobierno, expresa, materia concreta, plazo fijo, sin subdelegacion.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "65055eda-8341-4f54-a78c-fecebaeef4a6");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.82.3 delegacion agota uso (" + exp3.length + " chars)");
})();
