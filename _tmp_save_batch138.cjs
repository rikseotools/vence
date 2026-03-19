require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/1981 art.2 Defensor del Pueblo plazo un mes sucesivas propuestas
  const exp1 = `**Articulo 2.5 de la LO 3/1981 (Defensor del Pueblo):**

> "Caso de no alcanzarse las mencionadas mayorias, se procedera en nueva sesion de la Comision, y en el **plazo maximo de un mes**, a formular sucesivas propuestas."

**Por que B es correcta (maximo de un mes):**
Si en la primera votacion no se alcanzan las mayorias de 3/5 en ambas Camaras, el art. 2.5 concede un **plazo maximo de un mes** para formular nuevas propuestas. En esta segunda oportunidad, ademas, la mayoria requerida en el Senado se rebaja a **mayoria absoluta** (manteniendo 3/5 en el Congreso).

**Por que las demas son incorrectas (plazos de otros apartados o inventados):**

- **A)** "Maximo de 10 dias". Falso: 10 dias es el **plazo minimo** para convocar el Pleno del Congreso tras la propuesta (art. 2.**4**: "se convocara en termino **no inferior a diez dias** al Pleno del Congreso"). La trampa confunde el plazo minimo de convocatoria con el plazo maximo de nuevas propuestas.

- **C)** "Maximo de veinte dias". Falso: 20 dias es el plazo maximo para que el **Senado ratifique** la designacion tras la votacion del Congreso (art. 2.**4**: "en un plazo maximo de **veinte dias**, fuese ratificado por esta misma mayoria del Senado"). La trampa sustituye el plazo de ratificacion por el de nuevas propuestas.

- **D)** "Maximo de 15 dias". Falso: este plazo **no aparece** en ningun apartado del art. 2 de la LO 3/1981. Es un distractor inventado.

**Plazos del art. 2 de la LO 3/1981:**

| Plazo | Concepto |
|-------|----------|
| No inferior a 10 dias | Convocatoria del Pleno del Congreso |
| Maximo 20 dias | Ratificacion por el Senado |
| **Maximo 1 mes** | **Nuevas propuestas si no hay 3/5** |

**Clave:** Un mes para nuevas propuestas. No confundir con 10 dias (convocatoria) ni 20 dias (ratificacion Senado).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d17d787d-0671-4064-b257-93e9f2ccf539");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/1981 Defensor plazo 1 mes (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.20 queja funcionario responde por escrito
  const exp2 = `**Articulo 20.2 de la LO 3/1981 (Defensor del Pueblo):**

> "El afectado respondera **por escrito**, y con la aportacion de cuantos documentos y testimonios considere oportunos, en el plazo que se le haya fijado, que en ningun caso sera inferior a **diez dias**, pudiendo ser prorrogado, a instancia de parte, por la mitad del concedido."

**Por que B es correcta (por escrito):**
Cuando una queja afecta a la conducta de un funcionario, el Defensor del Pueblo le da cuenta de la misma (art. 20.1). El funcionario afectado debe responder **por escrito**, aportando documentos y testimonios, en el plazo fijado (minimo 10 dias, prorrogable por la mitad). El medio de respuesta es escrito, no oral ni electronico.

**Por que las demas son incorrectas:**

- **A)** "Ante el Congreso de los Diputados". Falso: el funcionario responde **al Defensor del Pueblo**, no al Congreso. Es el Defensor quien investiga la queja y quien recibe la respuesta. El Congreso es el organo ante el que el Defensor rinde cuentas (mediante informes anuales), pero no el destinatario de las respuestas de los funcionarios.

- **C)** "Por medios electronicos". Falso: el art. 20.2 dice expresamente "por **escrito**". No menciona medios electronicos. La ley es de 1981 y establece el escrito como forma de respuesta.

- **D)** "Ante su superior jerarquico". Falso: esta trampa confunde dos actuaciones del art. 20. El art. 20.**1** dice que el Defensor dara cuenta al afectado **y a su inmediato superior** u Organismo. Pero la **respuesta** (art. 20.**2**) la da el afectado al Defensor, no a su superior. El superior es **notificado**, no es el destinatario de la respuesta.

**Procedimiento del art. 20 LO 3/1981:**
1. El Defensor notifica al afectado **y** a su superior (art. 20.1)
2. El afectado responde **por escrito** al Defensor (art. 20.2)
3. El Defensor puede proponer entrevista ampliatoria (art. 20.3)
4. La informacion del funcionario tiene caracter **reservado** (art. 20.4)

**Clave:** Responde por escrito al Defensor del Pueblo (no al Congreso, ni por medios electronicos, ni al superior).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d6f58ceb-fe91-4e03-b4e3-0b9f5c19cd20");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 art.20 responde escrito (" + exp2.length + " chars)");

  // #3 - LEC art.592.2 orden embargo sueldos ultimo
  const exp3 = `**Articulo 592.2 de la Ley 1/2000 (LEC) - Orden de embargo:**

> El art. 592.2 establece el orden en que se embargan los bienes si no hay pacto entre acreedor y deudor:
>
> 1. Dinero o cuentas corrientes
> 2. Creditos y derechos realizables en el acto
> 3. **Joyas y objetos de arte**
> 4. Rentas en dinero
> 5. **Intereses, rentas y frutos** de toda especie
> 6. Bienes muebles o semovientes
> 7. **Bienes inmuebles**
> 8. **Sueldos**, salarios, pensiones e ingresos de actividades profesionales
> 9. Creditos, derechos y valores realizables a medio/largo plazo

**Por que C es correcta (sueldos se embargan en ultimo lugar):**
De las cuatro opciones ofrecidas, los sueldos ocupan la posicion **8.a** en el orden del art. 592.2, que es la mas tardia de todas. Los sueldos se embargan casi al final porque constituyen el medio de subsistencia del deudor, y la ley protege su embargo.

**Posicion de cada opcion en el orden:**

| Opcion | Bien | Posicion |
|--------|------|----------|
| A | Intereses, rentas y frutos | 5.a |
| B | Bienes inmuebles | 7.a |
| **C** | **Sueldos** | **8.a** (ultimo de las 4 opciones) |
| D | Joyas y objetos de arte | 3.a |

**Por que las demas se embargan antes:**

- **D)** Joyas y objetos de arte: posicion **3.a**. Se embargan pronto porque son bienes valiosos y faciles de liquidar.

- **A)** Intereses, rentas y frutos: posicion **5.a**. Son rendimientos economicos que se pueden embargar con relativa facilidad.

- **B)** Bienes inmuebles: posicion **7.a**. Aunque estan cerca del final, se embargan antes que los sueldos. Los inmuebles requieren un proceso de venta mas complejo, pero no gozan de la misma proteccion que los ingresos laborales.

**Clave:** Sueldos = posicion 8 (penultima del listado completo, ultima de las 4 opciones). La ley protege especialmente los ingresos laborales, por eso se embargan al final.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b7435281-d96c-41f8-8bca-ed3a911aa16e");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LEC art.592.2 embargo sueldos ultimo (" + exp3.length + " chars)");
})();
