require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.45 publicacion actos
  const exp1 = `**Articulo 45.1 de la Ley 39/2015** (Publicacion de actos administrativos):

> "En todo caso, los actos administrativos seran objeto de publicacion, surtiendo esta los efectos de la notificacion, en los siguientes casos:
> a) Cuando el acto tenga por destinatario a una **pluralidad indeterminada de personas** o cuando la Administracion estime que la notificacion efectuada a un solo interesado es **insuficiente** para garantizar la notificacion a todos.
> b) Cuando se trate de actos integrantes de un **procedimiento selectivo o de concurrencia competitiva** de cualquier tipo."

**Por que C es la INCORRECTA:**
Los "procedimientos relativos a la responsabilidad patrimonial" NO aparecen en la lista del art. 45.1 como supuesto de publicacion obligatoria con efectos de notificacion. Es un distractor que suena plausible pero no esta en el articulo.

**Por que las demas son correctas (SI estan en el art. 45.1):**

- **A)** "Pluralidad indeterminada de personas". SI: art. 45.1.a) primera parte. Logico: si no se conocen todos los destinatarios, no se puede notificar individualmente.

- **B)** "Procedimiento selectivo o de concurrencia competitiva". SI: art. 45.1.b). Logico: oposiciones, concursos y similares afectan a muchos aspirantes; la publicacion garantiza que todos conozcan las resoluciones.

- **D)** "Notificacion a un solo interesado insuficiente, siendo publicacion adicional". SI: art. 45.1.a) segunda parte. Es complementaria a la notificacion individual, no la sustituye.

**Supuestos de publicacion obligatoria (art. 45.1):**
1. Pluralidad indeterminada de destinatarios
2. Notificacion individual insuficiente (publicacion adicional)
3. Procedimientos selectivos o de concurrencia competitiva`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "43ac400b-63a2-4766-9c48-5c558dfafc8d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.45 publicacion (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.121.2 recurso alzada remision
  const exp2 = `**Articulo 121.2 de la Ley 39/2015** (Recurso de alzada - interposicion):

> "Cuando el recurso se hubiera interpuesto ante el organo que dicto el acto impugnado, este debera **remitirlo al competente en el plazo de diez dias**, con su **informe** y con una **copia completa y ordenada del expediente**."

**Por que C es correcta:**
El art. 121.2 establece tres obligaciones del organo que recibe el recurso (si no es el competente): remitirlo en **10 dias**, adjuntar su informe, y enviar copia completa y ordenada del expediente.

**Por que las demas son incorrectas:**

- **A)** "Lo inadmitira a tramite y emplazara a los interesados". Falso: el organo que dicto el acto no inadmite ni emplaza. Su obligacion es **remitir** el recurso al organo competente. El interesado puede legalmente interponer el recurso ante el organo que dicto el acto, y este debe tramitarlo (remitirlo).

- **B)** "Lo inadmitira a tramite". Falso: no hay inadmision. El art. 121.2 permite presentar el recurso ante el organo que dicto el acto. Este tiene la obligacion de remitirlo, no de inadmitirlo.

- **D)** "En el plazo de **cinco** dias". Falso: el art. 121.2 dice **diez** dias, no cinco. Es un cambio numerico tipico en examen: 10 por 5.

**Proceso del recurso de alzada:**
1. El interesado puede presentarlo ante el organo que dicto el acto **o** ante el competente para resolverlo (art. 121.1)
2. Si lo presenta ante el que dicto el acto: remision en **10 dias** + informe + expediente completo
3. Lo resuelve el **superior jerarquico** del que dicto el acto`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "25b54e7e-f8fa-4b4b-83f7-47e5e7510478");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.121.2 alzada (" + exp2.length + " chars)");
})();
