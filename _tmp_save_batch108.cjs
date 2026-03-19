require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 2/2012 art.7.2 eficacia eficiencia economia calidad
  const exp1 = `**Articulo 7.2 de la LO 2/2012 de Estabilidad Presupuestaria:**

> "La gestion de los recursos publicos estara orientada por la **eficacia**, la **eficiencia**, la **economia** y la **calidad**, a cuyo fin se aplicaran politicas de racionalizacion del gasto y de mejora de la gestion del sector publico."

**Por que B es correcta:**
El art. 7.2 enumera exactamente cuatro principios: **eficacia, eficiencia, economia y calidad**. La opcion B los reproduce fielmente.

**Por que las demas son incorrectas (cada una sustituye algun principio):**

- **A)** "Eficacia, **transparencia**, economia y **universalidad**". Falso: cambia "eficiencia" por "transparencia" y "calidad" por "universalidad". Ninguno de estos dos aparece en el art. 7.2. La transparencia es un principio de la Ley 19/2013, no de este articulo.

- **C)** "**Estabilidad presupuestaria**, transparencia, eficiencia y calidad". Falso: sustituye "eficacia" por "estabilidad presupuestaria" y "economia" por "transparencia". Aunque la estabilidad presupuestaria es el principio general de la ley (art. 3), no es uno de los cuatro principios del art. 7.2.

- **D)** "Estabilidad presupuestaria, eficiencia, **sostenibilidad financiera** y calidad". Falso: sustituye "eficacia" por "estabilidad presupuestaria" y "economia" por "sostenibilidad financiera". Ambos son principios de la LO 2/2012 (arts. 3 y 4), pero no del art. 7.2 especificamente.

**Los 4 principios del art. 7.2 LO 2/2012:**
1. **Eficacia** (lograr resultados)
2. **Eficiencia** (con el minimo de recursos)
3. **Economia** (al menor coste)
4. **Calidad** (con el mejor estandar)

**Clave:** Eficacia + Eficiencia + Economia + Calidad. Las trampas mezclan estos con otros principios de la misma ley (estabilidad, sostenibilidad) o de otras leyes (transparencia).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b0cbc5a3-a84f-4228-a3f2-bbafbef952f5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 2/2012 art.7.2 eficacia (" + exp1.length + " chars)");

  // #2 - LGP art.73 fases gasto aprobacion
  const exp2 = `**Articulo 73.2 de la Ley 47/2003 (LGP):**

> "La **aprobacion** es el acto mediante el cual se autoriza la realizacion de un gasto determinado por una cuantia cierta o aproximada, **reservando a tal fin** la totalidad o parte de un credito presupuestario."

**Por que B es correcta (aprobacion del gasto):**
La aprobacion es la **primera fase** de la ejecucion del gasto presupuestario. En ella se autoriza gastar y se reserva el credito necesario. Es un acto interno de la Administracion que aun no genera obligacion con terceros.

**Por que las demas son incorrectas (son fases distintas):**

- **A)** "Disposicion del gasto". Falso: la disposicion (o compromiso) es la **segunda fase**, en la que se acuerda la realizacion del gasto con un tercero concreto (art. 73.3 LGP). Ya no es una mera reserva de credito, sino un acto que vincula a la Administracion con un acreedor.

- **C)** "Compromiso del gasto". Falso: es sinonimo de "disposicion" (fase 2). En esta fase se concreta la obligacion con un tercero. La diferencia con la aprobacion es que la aprobacion solo reserva credito; el compromiso vincula a la Administracion.

- **D)** "Reconocimiento del gasto". Falso: el reconocimiento de la obligacion es la **tercera fase** (art. 73.4 LGP), en la que se declara la existencia de un credito exigible contra la Administracion, derivado de un gasto aprobado y comprometido. Es posterior a la aprobacion y al compromiso.

**Las 5 fases del gasto presupuestario (art. 73.1 LGP):**

| Fase | Acto | Que hace |
|------|------|----------|
| 1. **Aprobacion** | Autorizar + reservar credito | Reserva interna |
| 2. Compromiso | Vincular con tercero | Obligacion con acreedor |
| 3. Reconocimiento | Declarar obligacion exigible | Deuda reconocida |
| 4. Ordenacion del pago | Dar orden de pagar | Instruccion a Tesoreria |
| 5. Pago material | Transferir fondos | Dinero al acreedor |

**Clave:** Aprobacion = autorizar + reservar credito (fase 1). No confundir con compromiso (fase 2) ni reconocimiento (fase 3).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "27b323a9-853a-41e1-98d4-35f9080c8575");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP art.73 aprobacion gasto (" + exp2.length + " chars)");
})();
