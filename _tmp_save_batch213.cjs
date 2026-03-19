require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Orden DSA/819/2020 Consejo Desarrollo Sostenible 61 vocalías total
  const exp1 = `**Orden DSA/819/2020, apartado Tercero - Composicion del Consejo de Desarrollo Sostenible:**

> Apartado d): "Las vocalias en representacion de la sociedad civil, en numero de **sesenta**, designadas por la persona titular de la Secretaria de Estado para la Agenda 2030 [...]"
>
> Apartado e): Una vocalia adicional: representante de la Secretaria de Estado para la Agenda 2030.

**Por que B es correcta (61 vocalias):**
El total de vocalias del Consejo es **61**: **60** del apartado d) (sociedad civil) + **1** del apartado e) (representante de la Secretaria de Estado). Es facil confundirse porque el apartado d) dice "en numero de sesenta", pero hay que sumar la vocalia adicional del apartado e).

**Distribucion de las 60 vocalias de sociedad civil (apartado d):**
- 16 vocalias: sector empresarial y sindicatos
- 3 vocalias: universidades e investigacion
- 18 vocalias: plataformas del tercer sector
- 13 vocalias: organizaciones de intereses sociales
- 3 vocalias: economia social y fundaciones
- 2 vocalias: redes de expertos Agenda 2030
- 5 vocalias: expertos independientes

**Por que las demas son incorrectas:**

- **A)** "**48** vocalias." Falso: 48 no coincide con ninguna suma de los apartados de la Orden. El total es 61 (60 + 1).

- **C)** "**30** vocalias." Falso: 30 es la mitad del numero de vocalias de sociedad civil (60). No corresponde al total real.

- **D)** "**60** vocalias." Falso: 60 es el numero de vocalias del apartado d) (sociedad civil), pero falta sumar la vocalia del apartado e). El total correcto es 60 + 1 = **61**.

**Clave:** Total = 60 (sociedad civil, apartado d) + 1 (Secretaria de Estado, apartado e) = **61** vocalias. No confundir las 60 del apartado d) con el total de 61.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "38aeb2f3-eef5-41c4-b79c-641ee62adac0");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Orden DSA/819/2020 61 vocalias (" + exp1.length + " chars)");

  // #2 - LCSP art.98 sucesión del contratista solvencia
  const exp2 = `**Articulo 98 de la Ley 9/2017 (LCSP) - Sucesion del contratista:**

> Art. 98.1: "En los casos de **fusion** de empresas [...] continuara el contrato vigente con la entidad absorbente o con la resultante de la fusion, que quedara subrogada en todos los **derechos y obligaciones** dimanantes del mismo."
>
> "Si no pudiese producirse la subrogacion por no reunir la entidad a la que se atribuya el contrato las condiciones de **solvencia** necesarias se **resolvera** el contrato, considerandose a todos los efectos como un supuesto de **resolucion por culpa del adjudicatario**."

**Por que C es correcta:**
El art. 98 LCSP establece que si la entidad sucesora no reune las condiciones de solvencia necesarias, la subrogacion no puede producirse y el contrato se resuelve. Esta resolucion se considera "por culpa del adjudicatario", con las consecuencias que ello implica (posible incautacion de garantia, indemnizacion de danos, etc.).

**Por que las demas son incorrectas:**

- **A)** "Quedara subrogada en todos los derechos **pero no en las obligaciones**." Falso: el art. 98.1 dice "derechos **y obligaciones**", no solo derechos. La subrogacion es completa: la entidad sucesora asume tanto los derechos como las obligaciones del contrato original. Separar derechos de obligaciones desnaturalizaria la continuidad contractual.

- **B)** "Quedara subrogada [...] **aunque no reuna las condiciones de capacidad**." Falso: el art. 98 exige que la entidad sucesora reuna las condiciones de solvencia (y capacidad). Si no las reune, el contrato se resuelve. No cabe subrogacion sin solvencia.

- **D)** "Todas las respuestas anteriores son incorrectas." Falso: la opcion C es correcta, ya que reproduce fielmente el contenido del art. 98 sobre la resolucion por falta de solvencia.

**Sucesion del contratista (art. 98 LCSP):**

| Supuesto | Resultado |
|----------|-----------|
| Fusion/escision + entidad solvente | Subrogacion en **derechos y obligaciones** |
| Fusion/escision + entidad **no solvente** | **Resolucion por culpa del adjudicatario** |

**Clave:** Subrogacion = derechos Y obligaciones (no solo derechos). Sin solvencia = resolucion por culpa del adjudicatario.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5b35a04b-bd66-4b87-907c-45af5f32706e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.98 sucesion contratista (" + exp2.length + " chars)");
})();
