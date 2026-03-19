require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.122 recurso alzada 3 meses resolucion
  const exp1 = `**Articulo 122 de la Ley 39/2015 (LPAC) - Recurso de alzada:**

> Art. 122.1: "El plazo para la **interposicion** del recurso de alzada sera de **un mes**, si el acto fuera expreso."
>
> Art. 122.2: "El plazo maximo para **dictar y notificar la resolucion** sera de **tres meses**."

**Por que C es correcta (tres meses):**
La pregunta pide el plazo para **dictar y notificar la resolucion**, no para interponer el recurso. Segun el art. 122.2 LPAC, este plazo es de **tres meses**. Transcurrido sin resolucion expresa, se entiende desestimado por silencio administrativo negativo.

**Por que las demas son incorrectas:**

- **A)** "Dos meses". Falso: dos meses no corresponde a ningun plazo del recurso de alzada. Sin embargo, un mes es el plazo de interposicion (art. 122.1) y tres meses el de resolucion (art. 122.2). La trampa inventa un plazo intermedio.

- **B)** "Un mes". Trampa principal: un mes es el plazo para **interponer** el recurso (art. 122.1), no para resolverlo. La pregunta pide el plazo de **resolucion**, que es tres meses (art. 122.2). Es muy facil confundir interposicion (1 mes) con resolucion (3 meses).

- **D)** "Quince dias". Falso: quince dias no es ningun plazo del recurso de alzada. Sin embargo, es el plazo de alegaciones del tramite de audiencia (art. 82.2) y podria confundir.

**Plazos del recurso de alzada (art. 122 LPAC):**

| Concepto | Plazo |
|----------|-------|
| Interposicion (acto expreso) | **1 mes** |
| **Resolucion** | **3 meses** |
| Silencio si no se resuelve | Desestimatorio |

**Comparacion con reposicion (art. 124):**

| Recurso | Interposicion | Resolucion |
|---------|---------------|------------|
| Alzada | 1 mes | **3 meses** |
| Reposicion | 1 mes | 1 mes |

**Clave:** Interposicion = 1 mes. Resolucion = 3 meses. No confundir.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d6d946fc-ca6c-4e9f-9126-e7411364c41c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.122 alzada 3 meses (" + exp1.length + " chars)");
})();
