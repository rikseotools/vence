require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.13 extranjeros solo espanoles titulares art.23 participacion publica
  const exp1 = `**Articulo 13.2 de la Constitucion Espanola:**

> "Solamente los espanoles seran titulares de los derechos reconocidos en el **articulo 23**, salvo lo que, atendiendo a criterios de reciprocidad, pueda establecerse por tratado o ley para el derecho de **sufragio activo y pasivo en las elecciones municipales**."

**Articulo 23 CE - Participacion en asuntos publicos:**
> 1. Los ciudadanos tienen el derecho a participar en los asuntos publicos, directamente o por medio de representantes.
> 2. Asimismo, tienen derecho a acceder en condiciones de igualdad a las funciones y cargos publicos.

**Por que A es correcta (participacion en asuntos publicos):**
El art. 13.2 CE reserva **exclusivamente a los espanoles** los derechos del **art. 23** (participacion politica y acceso a cargos publicos). La unica excepcion es el sufragio en elecciones **municipales** por reciprocidad. Por tanto, la opcion A (participacion en asuntos publicos = art. 23) es el derecho reservado a espanoles.

**Por que las demas son incorrectas (son derechos que SI tienen los extranjeros):**

- **B)** "Derecho de asociacion" (art. **22** CE). Falso: los extranjeros SI gozan del derecho de asociacion. No esta en el art. 23, por lo que no esta reservado a espanoles.

- **C)** "Derecho a la educacion" (art. **27** CE). Falso: los extranjeros SI tienen derecho a la educacion en Espana. Es un derecho universal, no reservado a nacionales.

- **D)** "Derecho de reunion" (art. **21** CE). Falso: los extranjeros SI gozan del derecho de reunion. Tampoco esta en el art. 23.

**Derechos y extranjeros (art. 13 CE):**

| Derecho | Articulo | Extranjeros |
|---------|----------|-------------|
| Reunion | Art. 21 | SI |
| Asociacion | Art. 22 | SI |
| **Participacion politica** | **Art. 23** | **Solo espanoles** (salvo municipales) |
| Educacion | Art. 27 | SI |

**Clave:** Solo el art. 23 (participacion politica) esta reservado a espanoles. Todos los demas derechos del Titulo I los comparten los extranjeros, en los terminos de la ley.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c69867c8-e12c-421b-9632-5e2eef0bb969");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.13 extranjeros art.23 (" + exp1.length + " chars)");

  // #2 - CE art.66.2 funciones Cortes Generales vs dirigir politica (Gobierno)
  const exp2 = `**Articulo 66.2 de la Constitucion Espanola:**

> "Las Cortes Generales **ejercen la potestad legislativa** del Estado, **aprueban sus Presupuestos**, **controlan la accion del Gobierno** y tienen las demas competencias que les atribuya la Constitucion."

**Articulo 97 CE (funciones del Gobierno):**

> "El Gobierno **dirige la politica interior y exterior**, la Administracion civil y militar y la defensa del Estado."

**Por que C es correcta (potestad legislativa + control del Gobierno):**
La opcion C recoge dos funciones que SI corresponden a las Cortes segun el art. 66.2: **ejercer la potestad legislativa** y **controlar la accion del Gobierno**. Ambas estan expresamente en el articulo.

**Por que las demas son incorrectas (mezclan funciones del Gobierno):**

- **A)** "Potestad legislativa y **dirigir la politica interior**". Falso: "dirigir la politica interior" es funcion del **Gobierno** (art. **97** CE), no de las Cortes. La trampa mezcla una funcion de las Cortes (legislar) con una del Gobierno (dirigir).

- **B)** "Potestad legislativa, controlar Gobierno y **dirigir la politica interior**". Falso: anade "dirigir la politica interior", que sigue siendo funcion del Gobierno. Aunque las dos primeras funciones son correctas, la tercera no lo es.

- **D)** "Controlar Gobierno y **dirigir la politica interior y exterior**". Falso: "dirigir la politica interior y exterior" es la funcion principal del Gobierno (art. 97). Las Cortes controlan al Gobierno, pero no dirigen la politica.

**Cortes vs Gobierno:**

| Organo | Funciones principales |
|--------|----------------------|
| **Cortes** (art. 66.2) | Potestad legislativa, aprobar Presupuestos, controlar al Gobierno |
| **Gobierno** (art. 97) | Dirigir politica interior/exterior, Administracion y defensa |

**Clave:** Las Cortes legislan y controlan. El Gobierno dirige. "Dirigir la politica" SIEMPRE es del Gobierno (art. 97), nunca de las Cortes.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "10856d25-63de-46d7-8f06-67dfd3df2a9a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.66.2 funciones Cortes (" + exp2.length + " chars)");
})();
