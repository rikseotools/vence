require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.162 procedimiento restringido 5 no 3
  const exp1 = `**Articulo 162.2 de la Ley 9/2017 (LCSP)** - Procedimiento restringido:

> "El organo de contratacion senalara el numero minimo de empresarios a los que invitara a participar en el procedimiento, que **no podra ser inferior a cinco**."

**Por que A es la INCORRECTA:**
La opcion A dice "no podra ser inferior a **tres**", pero el art. 162.2 LCSP dice "no podra ser inferior a **cinco**". El numero minimo de candidatos invitados en el procedimiento restringido es **5**, no 3.

**Por que las demas son correctas:**

- **B)** SI: art. 162.1 LCSP. Con caracter previo al anuncio de licitacion, el organo debe haber establecido los criterios objetivos de solvencia (arts. 87-91) para elegir a los candidatos.

- **C)** SI: art. 162.3 LCSP. Comprobada la personalidad y solvencia, se selecciona a los candidatos y se les invita **simultaneamente y por escrito** a presentar proposiciones.

- **D)** SI: art. 162.2 LCSP. Puede fijar un numero maximo de candidatos invitados (ademas del minimo de 5).

**Numeros minimos de candidatos por procedimiento:**
| Procedimiento | Minimo candidatos | Articulo |
|--------------|-------------------|----------|
| Restringido | **5** | Art. 162.2 |
| Licitacion con negociacion | 3 | Art. 166.1 |
| Dialogo competitivo | 3 | Art. 172.1 |

**Clave:** Restringido = minimo **5** (no 3). Los 3 candidatos minimos son para otros procedimientos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "191d6f41-d820-4297-b743-4978a0db7982");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.162 restringido (" + exp1.length + " chars)");

  // #2 - CE art.99/100 nombramiento Gobierno
  const exp2 = `**Articulos 99 y 100 de la Constitucion Espanola:**

> Art. 100: "Los demas miembros del Gobierno seran nombrados y separados por el **Rey**, a **propuesta** de su Presidente."

**Por que C es la INCORRECTA:**
La opcion C dice que los miembros del Gobierno "seran nombrados y separados por el **Presidente del Gobierno**". Falso: el art. 100 CE dice que los nombra y separa el **Rey**, aunque lo hace **a propuesta** del Presidente del Gobierno. El Presidente propone, pero el acto formal de nombramiento es del Rey.

**Por que las demas son correctas:**

- **A)** SI: art. 99.3 CE. En la segunda votacion de investidura (48 horas despues de la primera), basta la **mayoria simple** del Congreso. La primera votacion exige mayoria absoluta.

- **B)** SI: art. 99.3 CE. El Presidente del Gobierno **siempre** es nombrado por el Rey, tras obtener la confianza del Congreso. Es un acto formal del Rey.

- **D)** SI: art. 99.1 CE. El Rey propone candidato a la Presidencia "**a traves del Presidente del Congreso**". El Presidente del Congreso actua como intermediario.

**Nombramiento del Gobierno:**
| Cargo | Quien nombra | A propuesta de |
|-------|-------------|----------------|
| Presidente del Gobierno | **Rey** | Congreso (investidura) |
| Demas miembros | **Rey** | Presidente del Gobierno |

**Clave:** Tanto el Presidente como los demas miembros son nombrados formalmente por el **Rey**. El Presidente del Gobierno **propone**, pero no nombra directamente.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "77f3364e-2f84-4c03-a139-52f5732a5181");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.99/100 nombramiento (" + exp2.length + " chars)");

  // #3 - LCSP art.324 autorizacion Consejo Ministros
  const exp3 = `**Articulo 324 de la Ley 9/2017 (LCSP)** - Autorizacion del Consejo de Ministros:

Para obtener la autorizacion del Consejo de Ministros, el art. 324.3 exige remitir al menos estos documentos:

> a) Justificacion sobre la **necesidad e idoneidad** del contrato.
> b) Certificado de existencia de **credito** (o documento equivalente).
> c) El **informe del servicio juridico** al pliego.
> d) El pliego de clausulas administrativas **particulares** y el de prescripciones tecnicas.

**Por que D es la INCORRECTA:**
La opcion D dice "pliego de clausulas administrativas **generales**", pero el art. 324.3.d) exige el pliego de clausulas administrativas **particulares** (no generales). Son documentos distintos:
- **Particulares**: especificos de cada contrato concreto (SI se exigen)
- **Generales**: aplicables a una categoria de contratos de forma generica (NO se exigen para la autorizacion)

**Por que las demas son correctas:**

- **A)** SI: art. 324.3.a). La justificacion de necesidad e idoneidad es un documento obligatorio.

- **B)** SI: art. 324.3.b). El certificado de existencia de credito o documento equivalente que acredite financiacion es obligatorio.

- **C)** SI: art. 324.3.c). El informe del servicio juridico al pliego es uno de los documentos exigidos.

**Clave:** La trampa esta en "**generales**" vs "**particulares**". El art. 324.3 exige el pliego de clausulas administrativas **particulares**, no las generales.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "14e02986-fc21-4642-85e2-46b17f78dfe1");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.324 autorizacion CM (" + exp3.length + " chars)");
})();
