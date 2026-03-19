require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LEC art.152.6 requerimiento en sede tribunal diligencia firmada solo por funcionario
  const exp1 = `**Articulo 152.6 de la Ley 1/2000 (LEC):**

Cuando un acto de comunicacion se practica en la **sede del tribunal**, se documenta por medio de **diligencia** firmada **solo por el funcionario** que la realiza, haciendo constar los datos identificativos del destinatario.

**Por que B es correcta (diligencia firmada solo por el funcionario):**
El segundo requerimiento se practico en la **sede del tribunal**. En este caso, el art. 152.6 LEC establece que el acto de comunicacion se documenta mediante **diligencia** firmada unicamente por el funcionario que lo practica. A diferencia de la notificacion en domicilio, en la sede judicial no se requiere la firma del destinatario en la propia diligencia.

**Por que las demas son incorrectas:**

- **A)** "Por medio de **acta** firmada por el funcionario y por la Sra. Villarreal". Falso: el acto de comunicacion en sede judicial se documenta mediante **diligencia**, no mediante "acta". El "acta" es un documento propio de los notarios o de las Cortes, no el formato utilizado en las comunicaciones judiciales del art. 152 LEC.

- **C)** "Por medio de **nota** firmada por el funcionario y por la Sra. Villarreal". Falso: "nota" no es la forma de documentar actos de comunicacion en la LEC. Ademas, anade la firma de la destinataria, que no se requiere cuando el acto se practica en sede judicial.

- **D)** "Por medio de diligencia firmada por el funcionario **y por la Sra. Villarreal**". Falso: aunque acierta en el tipo de documento (diligencia), incluye erroneamente la firma de la Sra. Villarreal. En la comunicacion en sede judicial, la diligencia la firma **solo el funcionario**.

**Clave:** En sede del tribunal: **diligencia** firmada **solo** por el funcionario. No "acta", no "nota", y no firma del destinatario.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e22af636-d80b-4186-b619-5d51fc11ad54");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LEC art.152.6 diligencia sede (" + exp1.length + " chars)");

  // #2 - LEC art.206 decreto cuando preciso razonar lo resuelto
  const exp2 = `**Articulo 206.2 de la Ley 1/2000 (LEC) - Resoluciones del Letrado de la Administracion de Justicia:**

> Las resoluciones del Letrado de la Administracion de Justicia se denominan **diligencias** (de ordenacion, de constancia, de comunicacion o de ejecucion) y **decretos**.
>
> Cuando la ley no exprese la clase de resolucion: se dictara **decreto** "en cualquier clase de procedimiento, cuando fuere preciso o conveniente **razonar lo resuelto**."

**Por que A es correcta (decreto cuando sea preciso o conveniente razonar):**
El decreto es la resolucion motivada del Letrado de la Administracion de Justicia. Se utiliza cuando es necesario **fundamentar o razonar** la decision adoptada. A diferencia de las diligencias de ordenacion (que son resoluciones de mero tramite), el decreto requiere motivacion y razonamiento juridico.

**Por que las demas son incorrectas:**

- **B)** "Cuando se resuelva sobre admision o inadmision de demanda". Falso: la admision o inadmision de la demanda es una decision **judicial** que corresponde al **juez o tribunal**, no al Letrado. Se resuelve mediante **auto** (resolucion judicial motivada), no mediante decreto.

- **C)** "Cuando la resolucion tenga por objeto dar a los autos el curso que la ley establezca". Falso: dar a los autos su curso legal es exactamente la funcion de las **diligencias de ordenacion**, no de los decretos. Las diligencias de ordenacion son resoluciones de tramite del Letrado que impulsan el procedimiento.

- **D)** "Cuando se resuelva sobre la acumulacion de acciones". Falso: la acumulacion de acciones es una cuestion procesal que decide el **juez**, no el Letrado, y se resuelve mediante **auto** judicial.

**Resoluciones del Letrado (art. 206.2 LEC):**

| Tipo | Funcion |
|------|---------|
| Diligencia de ordenacion | Dar a los autos su curso legal (tramite) |
| **Decreto** | **Razonar lo resuelto** (motivado) |

**Clave:** Decreto = razonar lo resuelto. Diligencia de ordenacion = dar curso a los autos. No confundir con resoluciones judiciales (autos) para admision de demanda o acumulacion.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "71a74087-e982-49e3-88c9-16d077d32fe3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LEC art.206 decreto razonar (" + exp2.length + " chars)");

  // #3 - LEC art.592.2 embargo primer lugar dinero o cuentas corrientes
  const exp3 = `**Articulo 592.2 de la Ley 1/2000 (LEC) - Orden de embargo:**

> Los bienes se embargaran por el siguiente orden:
>
> 1. **Dinero o cuentas corrientes** de cualquier clase
> 2. Creditos y derechos realizables en el acto
> 3. Joyas y objetos de arte
> 4. Rentas en dinero
> 5. Intereses, rentas y frutos de toda especie
> 6. Bienes muebles o semovientes
> 7. Bienes inmuebles
> 8. Sueldos, salarios, pensiones e ingresos profesionales
> 9. Creditos, derechos y valores a medio/largo plazo

**Por que C es correcta (dinero o cuentas corrientes en primer lugar):**
El art. 592.2 LEC establece el **dinero o cuentas corrientes** como primer bien a embargar. La razon es logica: el dinero es el activo mas **liquido**, no requiere conversion ni subasta, y se puede aplicar directamente al pago de la deuda. Maxima facilidad de realizacion, minima onerosidad.

**Por que las demas no se embargan en primer lugar:**

- **A)** "Sueldos, salarios, pensiones e ingresos profesionales". Falso: los sueldos ocupan la posicion **8.a** del orden. Se embargan casi al final porque son el medio de subsistencia del deudor y gozan de especial proteccion (limites de inembargabilidad del art. 607 LEC).

- **B)** "Joyas y objetos de arte". Falso: las joyas ocupan la posicion **3.a**. Aunque son bienes valiosos, requieren tasacion y venta, por lo que van despues del dinero liquido.

- **D)** "Intereses, rentas y frutos de toda especie". Falso: ocupan la posicion **5.a**. Son rendimientos periodicos que requieren un proceso de embargo mas complejo que el simple bloqueo de cuentas.

**Regla general del art. 592.1:** Se procura la **mayor facilidad de enajenacion** y la **menor onerosidad** para el ejecutado. El dinero cumple ambos criterios de forma optima.

**Clave:** Primero el dinero (posicion 1), ultimo los sueldos (posicion 8 de las opciones). El orden va de mayor a menor liquidez.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "f5e18c04-8f61-44e2-bc7d-2a3783fd29ff");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LEC art.592.2 embargo dinero primero (" + exp3.length + " chars)");
})();
