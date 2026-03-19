require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const updates = [
    {
      id: "2ae1344f-e268-423e-86ce-f9fd53d3d91a",
      name: "Ley 39/2015 art.106 revision oficio",
      explanation: `**Articulo 106.2 de la Ley 39/2015** (Revision de oficio de disposiciones administrativas):

> "Las Administraciones Publicas de oficio, y previo dictamen favorable del Consejo de Estado u organo consultivo equivalente de la Comunidad Autonoma si lo hubiere, podran declarar la nulidad de las disposiciones administrativas en los supuestos previstos en el articulo 47.2."

**Por que B es correcta:**
Reproduce fielmente el articulo 106.2. Tres elementos clave: de oficio, en cualquier momento, y con dictamen favorable del Consejo de Estado.

**Por que las demas son incorrectas:**

- **A)** Mezcla conceptos: la declaracion de lesividad (art. 107) es para actos administrativos anulables, no para disposiciones nulas de pleno derecho. Ademas, el plazo de lesividad es de 4 anios, no 2 meses.

- **C)** Dice "unicamente" recurso contencioso-administrativo. Falso: el art. 106.2 permite la revision de oficio como via administrativa previa. Ademas, el plazo de 3 meses no es correcto en este contexto.

- **D)** Dice que "no procede accion alguna de revision de oficio". Falso: precisamente el art. 106.2 establece que si procede la revision de oficio de disposiciones administrativas.

**Clave:** Las disposiciones administrativas nulas se pueden revisar de oficio en cualquier momento (art. 106.2). No confundir con la declaracion de lesividad (art. 107), que es para actos anulables y tiene plazo.`
    },
    {
      id: "c4b70047-b88c-48f1-9006-252ad66ea4ed",
      name: "Ley 39/2015 art.109 revocacion",
      explanation: `**Articulo 109 de la Ley 39/2015** (Revocacion de actos y rectificacion de errores):

> **109.1:** "Las Administraciones Publicas podran revocar, mientras no haya transcurrido el plazo de prescripcion, sus **actos de gravamen o desfavorables**, siempre que tal revocacion no constituya dispensa o exencion no permitida por las leyes, ni sea contraria al principio de igualdad, al interes publico o al ordenamiento juridico."
>
> **109.2:** "Las Administraciones Publicas podran, asimismo, rectificar en cualquier momento, de oficio o a instancia de los interesados, los errores materiales, de hecho o aritmeticos existentes en sus actos."

**Por que B es correcta:**
Reproduce literalmente el articulo 109.1: revocacion de actos de gravamen, dentro del plazo de prescripcion, con tres limites (no dispensa, no contraria a igualdad, no contraria a ordenamiento).

**Por que las demas son incorrectas:**

- **A)** Mezcla revocacion con rectificacion de errores. La rectificacion (109.2) es para errores materiales y no tiene plazo. La revocacion (109.1) es otra cosa. Ademas, la revocacion no se limita a "instancia de los interesados".

- **C)** Falso. La Administracion si puede revocar sus propios actos desfavorables. Lo que no puede es revocar actos favorables (para eso necesita la revision de oficio del art. 106).

- **D)** Confunde la revocacion con la revision de oficio. Los actos nulos de pleno derecho se revisan por el art. 106, no se "revocan" por el art. 109.

**Truco:** Revocar (art. 109) = solo actos desfavorables. Revisar de oficio (art. 106) = actos nulos. Son mecanismos distintos.`
    },
    {
      id: "0e3cab05-8d50-4327-8f55-7c8325c658d1",
      name: "Ley 39/2015 art.11 firma",
      explanation: `**Articulo 11.2 de la Ley 39/2015** (Uso obligatorio de firma):

> "Las Administraciones Publicas solo requeriran a los interesados el uso obligatorio de firma para:
> a) Formular solicitudes.
> b) Presentar declaraciones responsables o comunicaciones.
> c) Interponer recursos.
> d) Desistir de acciones.
> e) Renunciar a derechos."

La pregunta pide cual **NO** requiere firma obligatoria.

**Por que B es correcta:**
"Presentar alegaciones" no aparece en la lista del articulo 11.2. Las alegaciones son un tramite mas informal que no requiere firma obligatoria; basta con acreditar la identidad (art. 11.1).

**Por que las demas son incorrectas (si requieren firma):**

- **A)** "Interponer recursos" - Si requiere firma: es el apartado c) del articulo 11.2.

- **C)** "Desistir de acciones" - Si requiere firma: es el apartado d) del articulo 11.2.

- **D)** "Formular solicitudes" - Si requiere firma: es el apartado a) del articulo 11.2.

**Truco para recordar la lista:** Solicitudes, declaraciones responsables, recursos, desistimientos y renuncias. Son los 5 actos "formales" que exigen firma. Las alegaciones quedan fuera.`
    }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from("questions")
      .update({ explanation: u.explanation })
      .eq("id", u.id);
    if (error) console.error("Error " + u.name + ":", error);
    else console.log("OK -", u.name, "(" + u.explanation.length + " chars)");
  }
})();
