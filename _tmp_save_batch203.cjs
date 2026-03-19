require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TFUE art.225 PE solicita a Comisión por mayoría de miembros
  const exp1 = `**Articulo 225 del TFUE - Iniciativa legislativa del Parlamento Europeo:**

> "Por decision de la **mayoria de los miembros que lo componen**, el Parlamento Europeo podra solicitar a la Comision que presente las propuestas oportunas sobre cualquier asunto que a juicio de aquel requiera la elaboracion de un acto de la Union para la aplicacion de los Tratados."

**Por que A es correcta (la mayoria de sus miembros):**
El art. 225 TFUE exige la **mayoria de los miembros** que componen el PE para solicitar a la Comision que presente propuestas legislativas. Esta mayoria se refiere a la mitad mas uno del total de eurodiputados (mayoria absoluta de la composicion), no de los presentes.

**Por que las demas son incorrectas:**

- **B)** "La **mayoria absoluta** de sus miembros." Falso como opcion diferenciada: en la terminologia del TFUE, "mayoria de los miembros que lo componen" es la expresion que utiliza el Tratado. Aunque en la practica equivale a una mayoria absoluta, la opcion B se presenta como alternativa a A, y el Tratado usa la formulacion de A, no la de B.

- **C)** "La **totalidad** de sus miembros." Falso: el art. 225 no exige unanimidad de todos los eurodiputados. Bastaria con la mayoria de la composicion. Exigir la totalidad haria practicamente imposible esta solicitud.

- **D)** "Ninguna de las opciones anteriores." Falso: la opcion A recoge correctamente el requisito del art. 225 TFUE.

**Clave:** El PE puede solicitar propuestas a la Comision por mayoria de sus miembros. Si la Comision no presenta propuesta, debe comunicar las razones al PE. La Comision mantiene el monopolio de la iniciativa legislativa, pero el PE puede "invitarla" a legislar.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7021d78d-3211-493e-98f9-469281305219");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TFUE art.225 PE solicita Comision (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.6 Defensor del Pueblo INCORRECTA criterio Comisión Mixta
  const exp2 = `**Articulo 6 de la LO 3/1981 - Prerrogativas del Defensor del Pueblo:**

> Art. 6.1: "El Defensor del Pueblo **no** estara sujeto a mandato imperativo alguno. **No** recibira instrucciones de ninguna Autoridad. Desempenara sus funciones con **autonomia** y **segun su criterio**."
>
> Art. 6.2: "El Defensor del Pueblo gozara de **inviolabilidad**."

**Por que B es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion B dice que el DP desempena sus funciones "segun el criterio marcado por la **Comision Mixta Congreso-Senado**". Falso: el art. 6.1 dice "segun **su criterio**", no segun el criterio de la Comision Mixta. La autonomia del DP significa que actua con independencia de todos los poderes, incluidas las propias Cortes que lo designan.

**Por que las demas SI son correctas:**

- **A)** "No esta sujeto a **mandato imperativo**." **Correcto**: reproduce literalmente el art. 6.1. Ningun organo puede darle ordenes sobre como actuar.

- **C)** "No recibira **instrucciones** de ninguna autoridad." **Correcto**: reproduce el art. 6.1. Ni el Gobierno, ni las Cortes, ni ningun poder puede instruirle.

- **D)** "Gozara de **inviolabilidad**." **Correcto**: el art. 6.2 le otorga inviolabilidad. No puede ser detenido, expedientado, perseguido ni juzgado por las opiniones que formule o actos que realice en el ejercicio de sus competencias.

**Prerrogativas del Defensor del Pueblo (art. 6 LO 3/1981):**
- No sujeto a **mandato imperativo**
- No recibe **instrucciones** de nadie
- Actua con **autonomia** y segun **su** criterio (no de la Comision Mixta)
- **Inviolabilidad** funcional

**Clave:** El DP actua segun "su criterio", no segun el de la Comision Mixta. La Comision Mixta es el organo parlamentario de relacion, pero no le marca pautas de actuacion.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a80c6f4d-dd6f-43e0-9905-a183aa5c8421");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 art.6 DP prerrogativas (" + exp2.length + " chars)");

  // #3 - CE derecho de gracia Rey todas correctas arts. 62.i, 87.3, 102.3
  const exp3 = `**Derecho de gracia del Rey en la Constitucion Espanola:**

**Por que D es correcta (todas son correctas):**
Las tres opciones A, B y C recogen disposiciones constitucionales validas sobre la prerrogativa de gracia. Cada una proviene de un articulo distinto de la CE:

**A)** "No podra autorizar **indultos generales**."
> Art. 62.i) CE: "Ejercer el derecho de gracia con arreglo a la ley, que **no podra autorizar indultos generales**."
**Correcto**: la CE prohibe expresamente los indultos generales (colectivos). Solo caben los indultos particulares (individuales).

**B)** "No sera aplicable a ningun supuesto relativo a la **responsabilidad criminal del Presidente y los demas miembros del Gobierno**."
> Art. 102.3 CE: "La prerrogativa real de gracia **no sera aplicable** a ninguno de los supuestos del presente articulo."
**Correcto**: el art. 102 regula la responsabilidad penal del Gobierno y excluye la posibilidad de indulto real en estos casos.

**C)** "No cabe la **iniciativa popular** en esta materia."
> Art. 87.3 CE: "No procedera dicha iniciativa en materias propias de ley organica, tributarias o de caracter internacional, ni en lo relativo a la **prerrogativa de gracia**."
**Correcto**: la CE excluye la prerrogativa de gracia de la iniciativa legislativa popular.

**Resumen del derecho de gracia en la CE:**

| Articulo | Contenido |
|----------|-----------|
| **62.i)** | El Rey ejerce el derecho de gracia; **no caben indultos generales** |
| **87.3** | **No cabe iniciativa popular** sobre prerrogativa de gracia |
| **102.3** | **No se aplica** a la responsabilidad penal del Gobierno |

**Clave:** Las tres limitaciones provienen de articulos diferentes (62, 87 y 102) pero todas son correctas. Cuando aparecen dispersas en la CE, hay que conocerlas todas.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "4b4af5ee-35b4-414d-9e4e-9908506b9fc3");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE derecho de gracia todas correctas (" + exp3.length + " chars)");
})();
